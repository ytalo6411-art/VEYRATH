import { useState } from 'react';
import type { FormEvent } from 'react';
import { KeyRound, X } from 'lucide-react';
import type { CampaignDraft } from '../../types/campaign';

interface CreateCampaignDialogProps {
  onClose: () => void;
  onCreate: (draft: CampaignDraft) => Promise<void>;
}

export function CreateCampaignDialog({ onClose, onCreate }: CreateCampaignDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await onCreate({ name, description });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível criar a campanha.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}>
      <section className="dialog-card" role="dialog" aria-modal="true" aria-labelledby="create-campaign-title">
        <button className="icon-button dialog-close" type="button" onClick={onClose} aria-label="Fechar janela"><X size={19} /></button>
        <span className="eyebrow">PREPARE A JORNADA</span>
        <h2 id="create-campaign-title">Nova campanha</h2>
        <p className="dialog-lede">Dê um nome à sua mesa. A descrição pode ficar em branco e ser atualizada depois.</p>
        <form className="dialog-form" onSubmit={submit}>
          <label className="field-label" htmlFor="campaign-name">
            Nome da campanha
            <input id="campaign-name" autoFocus maxLength={80} minLength={3} required value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex.: As cinzas de Valedouro" />
          </label>
          <label className="field-label" htmlFor="campaign-description">
            Descrição <span className="optional-label">OPCIONAL</span>
            <textarea id="campaign-description" maxLength={500} rows={4} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="O que os aventureiros sabem sobre esta história?" />
            <span className="field-hint">{description.length}/500 caracteres</span>
          </label>
          {error && <p className="form-feedback form-feedback-error" role="alert">{error}</p>}
          <div className="dialog-actions">
            <button className="button button-quiet" type="button" disabled={busy} onClick={onClose}>Cancelar</button>
            <button className="button button-primary" type="submit" disabled={busy || name.trim().length < 3}>
              {busy ? 'Criando…' : 'Criar campanha'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

interface JoinCampaignDialogProps {
  onClose: () => void;
  onJoin: (code: string) => Promise<void>;
}

export function JoinCampaignDialog({ onClose, onJoin }: JoinCampaignDialogProps) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await onJoin(code);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível entrar na campanha.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}>
      <section className="dialog-card dialog-card-compact" role="dialog" aria-modal="true" aria-labelledby="join-campaign-title">
        <button className="icon-button dialog-close" type="button" onClick={onClose} aria-label="Fechar janela"><X size={19} /></button>
        <span className="dialog-icon"><KeyRound size={20} /></span>
        <span className="eyebrow">CONVITE DE MESA</span>
        <h2 id="join-campaign-title">Entrar em uma campanha</h2>
        <p className="dialog-lede">Use o código compartilhado pelo mestre. A entrada é validada pelo servidor.</p>
        <form className="dialog-form" onSubmit={submit}>
          <label className="field-label" htmlFor="campaign-invite-code">
            Código de convite
            <input id="campaign-invite-code" autoFocus autoCapitalize="characters" maxLength={19} required value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} placeholder="A1B2C3D4E5F6A7B8" />
          </label>
          {error && <p className="form-feedback form-feedback-error" role="alert">{error}</p>}
          <div className="dialog-actions">
            <button className="button button-quiet" type="button" disabled={busy} onClick={onClose}>Cancelar</button>
            <button className="button button-primary" type="submit" disabled={busy || code.trim().length < 8}>
              {busy ? 'Validando…' : 'Entrar na campanha'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
