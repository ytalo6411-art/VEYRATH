import { useCallback, useEffect, useState } from 'react';
import {
  ArrowDownRight,
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronRight,
  CircleHelp,
  Compass,
  Copy,
  Crown,
  DoorOpen,
  FlaskConical,
  KeyRound,
  Map,
  Plus,
  ScrollText,
  Shield,
  Sparkles,
  Users,
  X,
} from 'lucide-react';
import type { CampaignDraft, CampaignSummary, WorkspaceMode } from '../../types/campaign';
import { campaignService } from '../../services/campaigns/campaignService';
import { createLocalCampaign, listLocalCampaigns } from '../../services/campaigns/localCampaignStore';
import { CreateCampaignDialog, JoinCampaignDialog } from '../components/CampaignDialogs';

interface DashboardPageProps {
  mode: WorkspaceMode;
  workspaceId: string;
  userEmail?: string;
  onSignOut?: () => Promise<void>;
}

type PageKey = 'overview' | 'campaigns';
type DialogKey = 'create' | 'join' | null;

export function DashboardPage({ mode, workspaceId, userEmail, onSignOut }: DashboardPageProps) {
  const [page, setPage] = useState<PageKey>('overview');
  const [campaigns, setCampaigns] = useState<CampaignSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dialog, setDialog] = useState<DialogKey>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [toast, setToast] = useState('');
  const [signOutBusy, setSignOutBusy] = useState(false);

  const refreshCampaigns = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const loaded = mode === 'local'
        ? listLocalCampaigns()
        : await campaignService.listCampaigns(workspaceId);
      setCampaigns(loaded);
      setSelectedId((current) => current && loaded.some((campaign) => campaign.id === current) ? current : null);
      return loaded;
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Não foi possível carregar as campanhas.';
      setLoadError(message);
      throw cause;
    } finally {
      setLoading(false);
    }
  }, [mode, workspaceId]);

  useEffect(() => {
    void refreshCampaigns().catch(() => undefined);
  }, [refreshCampaigns]);

  const selectedCampaign = campaigns.find((campaign) => campaign.id === selectedId) ?? null;

  async function createCampaign(draft: CampaignDraft) {
    const campaign = mode === 'local'
      ? createLocalCampaign(draft)
      : await campaignService.createCampaign(workspaceId, draft);
    setCampaigns((current) => [campaign, ...current.filter((item) => item.id !== campaign.id)]);
    setSelectedId(campaign.id);
    setPage('campaigns');
    setDialog(null);
    setToast(mode === 'local'
      ? 'Campanha salva neste navegador. Ela ainda não está sincronizada com a nuvem.'
      : 'Campanha criada e salva no banco da campanha.');
  }

  async function joinCampaign(code: string) {
    if (mode !== 'cloud') {
      throw new Error('Convites entre dispositivos precisam do modo online configurado.');
    }
    const campaignId = await campaignService.joinByInviteCode(code);
    const loaded = await refreshCampaigns();
    const joined = loaded.find((campaign) => campaign.id === campaignId);
    if (!joined) throw new Error('A entrada foi registrada, mas a campanha não apareceu na lista. Atualize e tente novamente.');
    setSelectedId(joined.id);
    setPage('campaigns');
    setDialog(null);
    setToast(`Você entrou na campanha “${joined.name}”.`);
  }

  async function signOut() {
    if (!onSignOut) return;
    setSignOutBusy(true);
    setToast('');
    try {
      await onSignOut();
    } catch (cause) {
      setToast(cause instanceof Error ? cause.message : 'Não foi possível encerrar a sessão.');
    } finally {
      setSignOutBusy(false);
    }
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Brand />
        <div className="sidebar-world-label"><span className="status-dot" /> PRIMEIRA CRÔNICA</div>

        <div className="sidebar-section-label">SUA MESA</div>
        <nav className="primary-nav" aria-label="Navegação principal">
          <button className={`nav-item ${page === 'overview' && !selectedCampaign ? 'is-active' : ''}`} type="button" onClick={() => { setPage('overview'); setSelectedId(null); }}>
            <Compass size={18} /><span>Visão geral</span><ChevronRight size={15} className="nav-chevron" />
          </button>
          <button className={`nav-item ${page === 'campaigns' ? 'is-active' : ''}`} type="button" onClick={() => { setPage('campaigns'); setSelectedId(null); }}>
            <ScrollText size={18} /><span>Campanhas</span><span className="nav-count">{campaigns.length}</span>
          </button>
        </nav>

        <div className="sidebar-section-label sidebar-section-spaced">EM DESENVOLVIMENTO</div>
        <div className="nav-item nav-item-muted" aria-disabled="true" title="Disponível nas próximas fases"><Users size={18} /><span>Personagens</span><span className="coming-tag">FASE 3</span></div>
        <div className="nav-item nav-item-muted" aria-disabled="true" title="Disponível nas próximas fases"><Map size={18} /><span>Mundo</span><span className="coming-tag">FASE 4</span></div>
        <div className="nav-item nav-item-muted" aria-disabled="true" title="Disponível nas próximas fases"><Shield size={18} /><span>Combate</span><span className="coming-tag">FASE 5</span></div>

        <div className="sidebar-spacer" />
        <div className="sidebar-help"><CircleHelp size={17} /><span><strong>Primeira fase</strong><small>Campanhas e fundação online</small></span></div>
        <div className="sidebar-profile">
          <div className="profile-avatar">{mode === 'cloud' ? <Crown size={17} /> : <FlaskConical size={17} />}</div>
          <div className="profile-copy"><strong>{mode === 'cloud' ? 'Aventureiro' : 'Oficina local'}</strong><span>{userEmail ?? 'somente neste navegador'}</span></div>
          {onSignOut && <button className="icon-button sidebar-signout" type="button" disabled={signOutBusy} onClick={() => void signOut()} aria-label="Sair da conta" title="Sair"><DoorOpen size={17} /></button>}
        </div>
      </aside>

      <main className="workspace-main">
        <header className="topbar">
          <div className="topbar-crumb"><span>VEYRATH</span><span className="crumb-separator">/</span><span>{selectedCampaign ? 'CAMPANHA' : page === 'overview' ? 'VISÃO GERAL' : 'CAMPANHAS'}</span></div>
          <div className="topbar-actions">
            {mode === 'local' ? (
              <span className="mode-pill mode-pill-local"><span className="mode-dot" /> LOCAL · SEM SINCRONIZAÇÃO</span>
            ) : (
              <span className="mode-pill mode-pill-cloud"><span className="mode-dot" /> CONTA CONECTADA</span>
            )}
          </div>
        </header>

        <div className="workspace-content">
          {mode === 'local' && (
            <div className="local-mode-banner" role="status">
              <FlaskConical size={17} aria-hidden="true" />
              <p><strong>Oficina local:</strong> suas campanhas ficam apenas neste navegador. Para contas, convites reais e sincronização, configure o Supabase seguindo o guia do projeto.</p>
              <button type="button" onClick={() => setToast('Configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY em .env.local e aplique a migração inicial.')} aria-label="Como ativar o modo online"><CircleHelp size={17} /></button>
            </div>
          )}

          {toast && (
            <div className="toast-message" role="status"><Sparkles size={16} /><span>{toast}</span><button className="icon-button" type="button" onClick={() => setToast('')} aria-label="Fechar aviso"><X size={16} /></button></div>
          )}

          {selectedCampaign ? (
            <CampaignDetail campaign={selectedCampaign} onBack={() => { setSelectedId(null); setPage('campaigns'); }} />
          ) : page === 'overview' ? (
            <OverviewPage
              campaigns={campaigns}
              loading={loading}
              error={loadError}
              mode={mode}
              onCreate={() => setDialog('create')}
              onJoin={() => setDialog('join')}
              onOpen={(campaign) => { setSelectedId(campaign.id); setPage('campaigns'); }}
              onRetry={() => void refreshCampaigns().catch(() => undefined)}
            />
          ) : (
            <CampaignsPage
              campaigns={campaigns}
              loading={loading}
              error={loadError}
              mode={mode}
              onCreate={() => setDialog('create')}
              onJoin={() => setDialog('join')}
              onOpen={(campaign) => setSelectedId(campaign.id)}
              onRetry={() => void refreshCampaigns().catch(() => undefined)}
            />
          )}
        </div>
      </main>

      {dialog === 'create' && <CreateCampaignDialog onClose={() => setDialog(null)} onCreate={createCampaign} />}
      {dialog === 'join' && mode === 'cloud' && <JoinCampaignDialog onClose={() => setDialog(null)} onJoin={joinCampaign} />}
    </div>
  );
}

function OverviewPage({
  campaigns,
  loading,
  error,
  mode,
  onCreate,
  onJoin,
  onOpen,
  onRetry,
}: {
  campaigns: CampaignSummary[];
  loading: boolean;
  error: string;
  mode: WorkspaceMode;
  onCreate: () => void;
  onJoin: () => void;
  onOpen: (campaign: CampaignSummary) => void;
  onRetry: () => void;
}) {
  return (
    <>
      <section className="welcome-heading">
        <div>
          <span className="eyebrow">O REFÚGIO DA SUA MESA</span>
          <h1>A mesa está <em>pronta?</em></h1>
          <p>Organize uma campanha, reúna suas ideias e prepare o primeiro passo para a aventura.</p>
        </div>
        <div className="heading-mark" aria-hidden="true"><span>V</span></div>
      </section>

      <section className="campaign-hero">
        <div className="hero-art" aria-hidden="true">
          <div className="hero-art-sun" />
          <div className="hero-ridge hero-ridge-back" />
          <div className="hero-ridge hero-ridge-front" />
          <div className="hero-tower"><span /></div>
          <div className="hero-road" />
          <div className="hero-star hero-star-one" />
          <div className="hero-star hero-star-two" />
          <div className="hero-star hero-star-three" />
        </div>
        <div className="hero-content">
          <span className="hero-kicker"><span className="tiny-star">✦</span> AS CRÔNICAS COMEÇAM AQUI</span>
          <h2>Uma história.<br /><em>Várias possibilidades.</em></h2>
          <p>Crie a mesa que vai dar vida ao seu mundo. O mapa, os personagens e os encontros chegam em etapas — sem atalhos de mentirinha.</p>
          <div className="hero-actions">
            <button className="button button-primary" type="button" onClick={onCreate}><Plus size={17} /> Criar campanha</button>
            {mode === 'cloud' && <button className="button button-outline" type="button" onClick={onJoin}><KeyRound size={16} /> Tenho um convite</button>}
          </div>
        </div>
        <div className="hero-footnote"><span className="footnote-line" /> PRIMEIRA REGIÃO EM PREPARAÇÃO</div>
      </section>

      <section className="overview-metrics" aria-label="Estado atual do projeto">
        <div className="metric-card"><span className="metric-icon metric-icon-amber"><ScrollText size={17} /></span><span className="metric-value">{loading ? '—' : campaigns.length.toString().padStart(2, '0')}</span><span className="metric-label">{campaigns.length === 1 ? 'campanha na mesa' : 'campanhas na mesa'}</span></div>
        <div className="metric-card"><span className="metric-icon metric-icon-green"><Shield size={17} /></span><span className="metric-value">{mode === 'cloud' ? 'CLOUD' : 'LOCAL'}</span><span className="metric-label">armazenamento atual</span></div>
        <div className="metric-card metric-card-next"><span className="metric-icon metric-icon-purple"><Sparkles size={17} /></span><span className="metric-value">PRÓXIMO</span><span className="metric-label">personagens e mundo</span></div>
      </section>

      <div className="content-grid">
        <section className="panel campaign-panel">
          <div className="panel-heading">
            <div><span className="eyebrow">SUAS HISTÓRIAS</span><h2>Campanhas</h2></div>
            <button className="text-button" type="button" onClick={onCreate}><Plus size={16} /> Nova campanha</button>
          </div>
          {error ? <ErrorState message={error} onRetry={onRetry} /> : loading ? <LoadingState /> : campaigns.length === 0 ? <EmptyCampaigns onCreate={onCreate} /> : <CampaignGrid campaigns={campaigns.slice(0, 3)} mode={mode} onOpen={onOpen} />}
          {campaigns.length > 3 && <p className="more-campaigns-note">Mais {campaigns.length - 3} campanhas na sua lista.</p>}
        </section>

        <aside className="panel next-panel">
          <div className="next-panel-heading"><span className="eyebrow">PRÓXIMO CAPÍTULO</span><span className="phase-badge">FASE 1 / 8</span></div>
          <div className="next-art" aria-hidden="true"><div className="next-orbit orbit-one" /><div className="next-orbit orbit-two" /><div className="next-crystal">✦</div></div>
          <h3>Uma boa história precisa de uma mesa.</h3>
          <p>Esta fundação já cuida da sua campanha. Personagens, mundo explorável e regras entram nas próximas etapas.</p>
          <div className="next-divider" />
          <div className="next-check-row"><span className="check-circle"><Check size={13} /></span><span>Campanhas e acessos</span><span className="done-label">AGORA</span></div>
          <div className="next-check-row next-check-muted"><span className="empty-circle" /><span>Personagens e ficha</span><span className="next-phase-label">FASE 3</span></div>
          <div className="next-check-row next-check-muted"><span className="empty-circle" /><span>Mundo isométrico</span><span className="next-phase-label">FASE 4</span></div>
        </aside>
      </div>
    </>
  );
}

function CampaignsPage({
  campaigns,
  loading,
  error,
  mode,
  onCreate,
  onJoin,
  onOpen,
  onRetry,
}: {
  campaigns: CampaignSummary[];
  loading: boolean;
  error: string;
  mode: WorkspaceMode;
  onCreate: () => void;
  onJoin: () => void;
  onOpen: (campaign: CampaignSummary) => void;
  onRetry: () => void;
}) {
  return (
    <section className="campaigns-page">
      <div className="page-title-row">
        <div><span className="eyebrow">SEU ARQUIVO DE AVENTURAS</span><h1>Campanhas</h1><p>As mesas em que você participa, salvas no espaço de trabalho atual.</p></div>
        <div className="page-title-actions"><button className="button button-primary" type="button" onClick={onCreate}><Plus size={17} /> Criar campanha</button>{mode === 'cloud' && <button className="button button-outline" type="button" onClick={onJoin}><KeyRound size={16} /> Usar convite</button>}</div>
      </div>
      {error ? <ErrorState message={error} onRetry={onRetry} /> : loading ? <LoadingState /> : campaigns.length === 0 ? <EmptyCampaigns onCreate={onCreate} /> : <CampaignGrid campaigns={campaigns} mode={mode} onOpen={onOpen} />}
    </section>
  );
}

function CampaignGrid({ campaigns, mode, onOpen }: { campaigns: CampaignSummary[]; mode: WorkspaceMode; onOpen: (campaign: CampaignSummary) => void }) {
  return (
    <div className="campaign-grid">
      {campaigns.map((campaign, index) => (
        <button className="campaign-card" type="button" key={campaign.id} onClick={() => onOpen(campaign)}>
          <span className={`campaign-card-art campaign-card-art-${index % 3}`} aria-hidden="true"><span className="card-art-moon" /><span className="card-art-ridge" /><span className="card-art-mark">V</span></span>
          <span className="campaign-card-content">
            <span className="campaign-card-top"><span className="campaign-card-role"><Crown size={13} /> {campaign.role === 'master' ? 'MESTRE' : 'AVENTUREIRO'}</span><span className={`mini-mode ${mode === 'local' ? 'mini-mode-local' : ''}`}>{mode === 'local' ? 'LOCAL' : 'CLOUD'}</span></span>
            <strong className="campaign-card-title">{campaign.name}</strong>
            <span className="campaign-card-description">{campaign.description || 'Uma nova história aguarda o primeiro capítulo.'}</span>
            <span className="campaign-card-foot"><span>{formatDate(campaign.createdAt)}</span><span className="campaign-card-open">Abrir <ArrowRight size={14} /></span></span>
          </span>
        </button>
      ))}
    </div>
  );
}

function CampaignDetail({ campaign, onBack }: { campaign: CampaignSummary; onBack: () => void }) {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState('');

  async function copyInvite() {
    if (!campaign.inviteCode) return;
    setCopyError('');
    try {
      await navigator.clipboard.writeText(campaign.inviteCode);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      setCopyError('Não foi possível copiar automaticamente. Selecione o código para copiá-lo.');
    }
  }

  return (
    <section className="campaign-detail">
      <button className="back-link" type="button" onClick={onBack}><ArrowLeft size={16} /> Voltar às campanhas</button>
      <div className="detail-cover">
        <div className="detail-cover-art" aria-hidden="true"><div className="detail-sun" /><div className="detail-ridge detail-ridge-back" /><div className="detail-ridge detail-ridge-front" /><div className="detail-star">✦</div></div>
        <div className="detail-cover-copy"><span className="eyebrow">CAMPANHA · {campaign.role === 'master' ? 'VOCÊ É MESTRE' : 'PARTICIPANTE'}</span><h1>{campaign.name}</h1><p>Criada em {formatDate(campaign.createdAt)}</p></div>
      </div>

      <div className="detail-grid">
        <section className="panel detail-info-panel"><span className="eyebrow">SOBRE ESTA MESA</span><h2>O começo da história</h2><p className="detail-description">{campaign.description || 'Nenhuma descrição foi adicionada ainda. A história pode começar aqui.'}</p><div className="detail-facts"><div><span>ESTADO</span><strong><span className="status-dot" /> Campanha ativa</strong></div><div><span>ESPAÇO DE DADOS</span><strong>{campaign.mode === 'cloud' ? 'Supabase · sincronizado' : 'Este navegador · local'}</strong></div></div></section>

        <section className="panel detail-invite-panel">
          <span className="eyebrow">REÚNA SUA MESA</span><h2>Convide participantes</h2>
          {campaign.inviteCode ? (
            <>
              <p>Compartilhe este código para que uma pessoa autenticada entre na campanha.</p>
              <div className="invite-code-box"><code>{campaign.inviteCode}</code><button className="icon-button" type="button" onClick={() => void copyInvite()} aria-label="Copiar código de convite" title="Copiar código">{copied ? <Check size={17} /> : <Copy size={17} />}</button></div>
              {copyError && <p className="field-hint copy-error">{copyError}</p>}
              <p className="invite-security"><Shield size={14} /> A entrada é validada pelo banco e vinculada à conta do jogador.</p>
            </>
          ) : (
            <>
              <p>Convites entre dispositivos não estão ativos na Oficina local. Configure Supabase para criar códigos reais e compartilhar a campanha.</p>
              <div className="local-invite-note"><FlaskConical size={18} /><span><strong>Sem código de convite</strong><small>Esta campanha existe apenas neste navegador.</small></span></div>
            </>
          )}
        </section>
      </div>

      <div className="phase-note"><div className="phase-note-icon"><ArrowDownRight size={18} /></div><div><span className="eyebrow">ESTA É A FUNDAÇÃO</span><p>Esta campanha já pode ser criada e retomada. Personagens, mapas e cenas de jogo serão conectados nas próximas fases; ainda não há exploração ou combate ativo.</p></div><span className="phase-badge">FASE 1</span></div>
    </section>
  );
}

function EmptyCampaigns({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="empty-state">
      <div className="empty-crest"><ScrollText size={23} /></div>
      <span className="eyebrow">PÁGINAS EM BRANCO</span>
      <h3>Nenhuma campanha por aqui — ainda.</h3>
      <p>Crie a primeira mesa para guardar o nome e a premissa da sua aventura.</p>
      <button className="button button-primary" type="button" onClick={onCreate}><Plus size={16} /> Criar primeira campanha</button>
    </div>
  );
}

function LoadingState() {
  return <div className="loading-state" role="status"><span className="loading-spinner" />Consultando suas campanhas…</div>;
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="error-state" role="alert"><span className="error-state-icon"><CircleHelp size={18} /></span><div><strong>Não foi possível carregar as campanhas.</strong><p>{message}</p><button className="text-button" type="button" onClick={onRetry}>Tentar novamente <ArrowRight size={14} /></button></div></div>
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

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Data indisponível';
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
}
