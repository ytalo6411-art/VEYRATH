import type { AuthError, User } from '@supabase/supabase-js';
import { supabase } from '../supabase/client';

function requireSupabase() {
  if (!supabase) {
    throw new Error('O modo online ainda não foi configurado. Consulte .env.example.');
  }
  return supabase;
}

function throwAuthError(error: AuthError | null): void {
  if (error) throw new Error(error.message);
}

export const authService = {
  async signIn(email: string, password: string): Promise<User> {
    const client = requireSupabase();
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    throwAuthError(error);
    if (!data.user) throw new Error('O Supabase não retornou um usuário autenticado.');
    return data.user;
  },

  async signUp(email: string, password: string, displayName: string) {
    const client = requireSupabase();
    const { data, error } = await client.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: displayName },
        ...(typeof window === 'undefined' ? {} : { emailRedirectTo: window.location.origin }),
      },
    });
    throwAuthError(error);
    return data;
  },

  async signOut(): Promise<void> {
    const client = requireSupabase();
    const { error } = await client.auth.signOut();
    throwAuthError(error);
  },
};
