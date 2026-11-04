import { useState } from 'react';
import type { FormEvent } from 'react';
import { ArrowRight, BookOpen, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { authService } from '../../services/auth/authService';

type AuthMode = 'sign-in' | 'sign-up';

export function AuthPage() {
  const [mode, setMode] = useState<AuthMode>('sign-in');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    setError('');

    try {
      if (mode === 'sign-up') {
        const result = await authService.signUp(email.trim(), password, displayName.trim());
        if (!result.session) {
          setMessage('Conta criada. Confirme seu e-mail para entrar na campanha.');
        } else {
          setMessage('Conta criada. Abrindo sua mesa…');
        }
      } else {
        await authService.signIn(email.trim(), password);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível autenticar. Tente novamente.');
    } finally {
      setBusy(false);
    }
  }

  function changeMode(nextMode: AuthMode) {
    setMode(nextMode);
    setMessage('');
    setError('');
  }

  return (
    <main className="auth-page">
      <section className="auth-story" aria-label="Sobre Veyrath">
        <div className="auth-story-top">
          <Brand />
          <span className="eyebrow">UM MUNDO, MUITAS HISTÓRIAS</span>
        </div>
        <div className="auth-story-copy">
          <div className="story-ornament"><span /><span /><span /></div>
          <p className="eyebrow">SUA MESA DE AVENTURAS</p>
          <h1>O próximo capítulo começa <em>com vocês.</em></h1>
          <p className="story-lede">Reúna seu grupo, prepare a campanha e deixe que o mundo de Veyrath se revele no ritmo da sua mesa.</p>
          <div className="story-note">
            <BookOpen size={18} aria-hidden="true" />
            <span>Um RPG em construção, feito para histórias compartilhadas.</span>
          </div>
        </div>
        <div className="auth-story-foot"><span>VEYRATH</span><span>EST. 2026</span></div>
      </section>

      <section className="auth-panel">
        <div className="auth-panel-inner">
          <div className="auth-mobile-brand"><Brand /></div>
          <div className="auth-form-heading">
            <span className="eyebrow">BEM-VINDO À MESA</span>
            <h2>{mode === 'sign-in' ? 'Entre na sua conta' : 'Crie seu acesso'}</h2>
            <p>{mode === 'sign-in' ? 'Retome sua campanha de onde a história parou.' : 'Sua conta será protegida pelo Supabase Auth.'}</p>
          </div>

          <div className="auth-tabs" role="tablist" aria-label="Acesso">
            <button className={mode === 'sign-in' ? 'is-active' : ''} type="button" role="tab" aria-selected={mode === 'sign-in'} onClick={() => changeMode('sign-in')}>Entrar</button>
            <button className={mode === 'sign-up' ? 'is-active' : ''} type="button" role="tab" aria-selected={mode === 'sign-up'} onClick={() => changeMode('sign-up')}>Criar conta</button>
          </div>

          <form className="auth-form" onSubmit={submit}>
            {mode === 'sign-up' && (
              <label className="field-label" htmlFor="display-name">
                Nome de aventureiro
                <input id="display-name" autoComplete="name" maxLength={80} required value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="Como sua mesa vai chamar você?" />
              </label>
            )}
            <label className="field-label" htmlFor="email">
              E-mail
              <input id="email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="voce@exemplo.com" />
            </label>
            <label className="field-label" htmlFor="password">
              Senha
              <span className="password-field">
                <input id="password" type={showPassword ? 'text' : 'password'} autoComplete={mode === 'sign-up' ? 'new-password' : 'current-password'} minLength={6} required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Mínimo de 6 caracteres" />
                <button className="password-toggle" type="button" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}>
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </span>
            </label>

            {error && <p className="form-feedback form-feedback-error" role="alert">{error}</p>}
            {message && <p className="form-feedback form-feedback-success" role="status">{message}</p>}

            <button className="button button-primary auth-submit" type="submit" disabled={busy}>
              <span>{busy ? 'Aguarde…' : mode === 'sign-in' ? 'Entrar na mesa' : 'Criar conta'}</span>
              {!busy && <ArrowRight size={17} aria-hidden="true" />}
            </button>
          </form>

          <div className="auth-security"><ShieldCheck size={16} aria-hidden="true" /><span>Autenticação e sessão gerenciadas pelo Supabase.</span></div>
          <p className="auth-legal">Ao continuar, você cria um acesso ao Veyrath. Os dados de campanha só ficam disponíveis aos participantes autorizados.</p>
        </div>
      </section>
    </main>
  );
}

function Brand() {
  return (
    <a className="brand-lockup" href="/" aria-label="Veyrath — início">
      <span className="brand-mark"><span>V</span></span>
      <span className="brand-wordmark"><strong>VEYRATH</strong><small>CHRONICLES IN MOTION</small></span>
    </a>
  );
}
