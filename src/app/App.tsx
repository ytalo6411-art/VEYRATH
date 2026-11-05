import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { AuthPage } from './pages/AuthPage';
import { DashboardPage } from './pages/DashboardPage';
import { appEnvironment } from '../config/env';
import { localWorkspace } from '../services/campaigns/localCampaignStore';
import { authService } from '../services/auth/authService';
import { supabase } from '../services/supabase/client';

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [localPreview, setLocalPreview] = useState(false);
  const [authReady, setAuthReady] = useState(!appEnvironment.isSupabaseConfigured);

  useEffect(() => {
    if (!supabase) {
      setAuthReady(true);
      return;
    }

    let isMounted = true;
    void supabase.auth.getSession().then(({ data, error }) => {
      if (!isMounted) return;
      if (error) console.error('Falha ao recuperar a sessão Supabase:', error.message);
      setSession(data.session);
      setAuthReady(true);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setAuthReady(true);
    });

    return () => {
      isMounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  if (appEnvironment.hasPartialSupabaseConfig) {
    return (
      <main className="startup-screen" role="alert">
        <div className="brand-mark brand-mark-large"><span>V</span></div>
        <h1>Configuração online incompleta</h1>
        <p>Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY juntos em .env.local. Nenhum dado foi redirecionado para o armazenamento local.</p>
      </main>
    );
  }

  if (!appEnvironment.isSupabaseConfigured) {
    return <DashboardPage mode="local" workspaceId={localWorkspace.id} />;
  }

  if (localPreview) {
    return <DashboardPage mode="local" workspaceId={localWorkspace.id} onExitLocalPreview={() => setLocalPreview(false)} />;
  }

  if (!authReady) {
    return (
      <main className="startup-screen" aria-live="polite">
        <div className="brand-mark brand-mark-large"><span>V</span></div>
        <p>Reabrindo sua mesa…</p>
      </main>
    );
  }

  if (!session?.user) return <AuthPage onLocalPreview={() => setLocalPreview(true)} />;

  return (
    <DashboardPage
      mode="cloud"
      workspaceId={session.user.id}
      userEmail={session.user.email ?? ''}
      onSignOut={() => authService.signOut()}
    />
  );
}
