import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
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
  Play,
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

const AdventurePage = lazy(() => import('./AdventurePage').then((module) => ({ default: module.AdventurePage })));
const OnlineAdventurePage = lazy(() => import('./OnlineAdventurePage').then((module) => ({ default: module.OnlineAdventurePage })));

interface DashboardPageProps {
  mode: WorkspaceMode;
  workspaceId: string;
  userEmail?: string;
  onSignOut?: () => Promise<void>;
  onExitLocalPreview?: () => void;
}

type PageKey = 'overview' | 'campaigns';
type DialogKey = 'create' | 'join' | null;

export function DashboardPage({ mode, workspaceId, userEmail, onSignOut, onExitLocalPreview }: DashboardPageProps) {
  const [page, setPage] = useState<PageKey>('overview');
  const [campaigns, setCampaigns] = useState<CampaignSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [adventureOpen, setAdventureOpen] = useState(false);
  const [onlineAdventureOpen, setOnlineAdventureOpen] = useState(false);
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

  if (selectedCampaign && onlineAdventureOpen) {
    return <Suspense fallback={<AdventureLoading />}><OnlineAdventurePage key={selectedCampaign.id} campaign={selectedCampaign} onBack={() => setOnlineAdventureOpen(false)} /></Suspense>;
  }
  if (selectedCampaign && adventureOpen) {
    return <Suspense fallback={<AdventureLoading />}><AdventurePage key={selectedCampaign.id} campaign={selectedCampaign} onBack={() => setAdventureOpen(false)} /></Suspense>;
  }

  async function createCampaign(draft: CampaignDraft) {
    const campaign = mode === 'local'
      ? createLocalCampaign(draft)
      : await campaignService.createCampaign(workspaceId, draft);
    setCampaigns((current) => [campaign, ...current.filter((item) => item.id !== campaign.id)]);
    setSelectedId(campaign.id);
    setAdventureOpen(false);
    setOnlineAdventureOpen(false);
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
    setAdventureOpen(false);
    setOnlineAdventureOpen(false);
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
          <button className={`nav-item ${page === 'overview' && !selectedCampaign ? 'is-active' : ''}`} type="button" onClick={() => { setPage('overview'); setSelectedId(null); setAdventureOpen(false); setOnlineAdventureOpen(false); }}>
            <Compass size={18} /><span>Visão geral</span><ChevronRight size={15} className="nav-chevron" />
          </button>
          <button className={`nav-item ${page === 'campaigns' ? 'is-active' : ''}`} type="button" onClick={() => { setPage('campaigns'); setSelectedId(null); setAdventureOpen(false); setOnlineAdventureOpen(false); }}>
            <ScrollText size={18} /><span>Campanhas</span><span className="nav-count">{campaigns.length}</span>
          </button>
        </nav>

        <div className="sidebar-section-label sidebar-section-spaced">RECURSOS DA MESA</div>
        <div className="sidebar-feature"><Users size={17} /><span><strong>Personagens</strong><small>Ficha salva na campanha</small></span><Check size={14} /></div>
        <div className="sidebar-feature"><Map size={17} /><span><strong>Região compartilhada</strong><small>Posições sincronizadas</small></span><Check size={14} /></div>
        <div className="sidebar-feature"><Shield size={17} /><span><strong>Combate D20</strong><small>Resolução no servidor</small></span><Check size={14} /></div>

        <div className="sidebar-spacer" />
        <div className="sidebar-help"><CircleHelp size={17} /><span><strong>{mode === 'cloud' ? 'Mesa online' : 'Prévia local'}</strong><small>{mode === 'cloud' ? 'Convide jogadores para a campanha' : 'Solo · progresso neste navegador'}</small></span></div>
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
              <>
                <span className="mode-pill mode-pill-local"><span className="mode-dot" /> LOCAL · SEM SINCRONIZAÇÃO</span>
                {onExitLocalPreview && <button className="local-exit-button" type="button" onClick={onExitLocalPreview}><ArrowLeft size={14} /> Login online</button>}
              </>
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
            <CampaignDetail
              campaign={selectedCampaign}
              onBack={() => { setSelectedId(null); setPage('campaigns'); setAdventureOpen(false); setOnlineAdventureOpen(false); }}
              onPlayPreview={() => { setOnlineAdventureOpen(false); setAdventureOpen(true); }}
              onPlayOnline={() => { setAdventureOpen(false); setOnlineAdventureOpen(true); }}
            />
          ) : page === 'overview' ? (
            <OverviewPage
              campaigns={campaigns}
              loading={loading}
              error={loadError}
              mode={mode}
              onCreate={() => setDialog('create')}
              onJoin={() => setDialog('join')}
              onOpen={(campaign) => { setSelectedId(campaign.id); setPage('campaigns'); setAdventureOpen(false); setOnlineAdventureOpen(false); }}
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
              onOpen={(campaign) => { setSelectedId(campaign.id); setAdventureOpen(false); setOnlineAdventureOpen(false); }}
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

function AdventureLoading() {
  return <main className="adventure-page adventure-loading" role="status"><span className="loading-spinner" />Abrindo a aventura…</main>;
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
          <p>{mode === 'cloud'
            ? 'Crie uma campanha, convide sua mesa e entre na Clareira da Vigília com uma ficha salva na nuvem. A prévia solo continua disponível separadamente.'
            : 'Crie campanhas locais e jogue a prévia solo da Clareira da Vigília. O progresso desta oficina fica apenas neste navegador.'}</p>
          <div className="hero-actions">
            <button className="button button-primary" type="button" onClick={onCreate}><Plus size={17} /> Criar campanha</button>
            {mode === 'cloud' && <button className="button button-outline" type="button" onClick={onJoin}><KeyRound size={16} /> Tenho um convite</button>}
          </div>
        </div>
        <div className="hero-footnote"><span className="footnote-line" /> {mode === 'cloud' ? 'MESA ONLINE E PRÉVIA SOLO DISPONÍVEIS' : 'PRÉVIA SOLO · SEM SINCRONIZAÇÃO'}</div>
      </section>

      <section className="overview-metrics" aria-label="Estado atual do projeto">
        <div className="metric-card"><span className="metric-icon metric-icon-amber"><ScrollText size={17} /></span><span className="metric-value">{loading ? '—' : campaigns.length.toString().padStart(2, '0')}</span><span className="metric-label">{campaigns.length === 1 ? 'campanha na mesa' : 'campanhas na mesa'}</span></div>
        <div className="metric-card"><span className="metric-icon metric-icon-green"><Shield size={17} /></span><span className="metric-value">{mode === 'cloud' ? 'CLOUD' : 'LOCAL'}</span><span className="metric-label">armazenamento atual</span></div>
        <div className="metric-card metric-card-next"><span className="metric-icon metric-icon-purple"><Sparkles size={17} /></span><span className="metric-value">{mode === 'cloud' ? 'ONLINE' : 'SOLO'}</span><span className="metric-label">{mode === 'cloud' ? 'mesa compartilhada' : 'sem sincronização'}</span></div>
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
          <div className="next-panel-heading"><span className="eyebrow">{mode === 'cloud' ? 'AVENTURA COMPARTILHADA' : 'MODO DE JOGO'}</span><span className="phase-badge">{mode === 'cloud' ? 'ONLINE' : 'LOCAL'}</span></div>
          <div className="next-art" aria-hidden="true"><div className="next-orbit orbit-one" /><div className="next-orbit orbit-two" /><div className="next-crystal">✦</div></div>
          <h3>{mode === 'cloud' ? 'A clareira espera pela sua mesa.' : 'Uma história começa em cada campanha.'}</h3>
          <p>{mode === 'cloud'
            ? 'Fichas, posição, missão e combate são salvos no Supabase. As ações do jogo são validadas pelo servidor e sincronizadas com os membros da campanha.'
            : 'A prévia jogável fica salva neste navegador. Para reunir outras pessoas e sincronizar o progresso, entre em uma conta online.'}</p>
          <div className="next-divider" />
          <div className="next-check-row"><span className="check-circle"><Check size={13} /></span><span>{mode === 'cloud' ? 'Campanhas e convites' : 'Campanhas locais'}</span><span className="done-label">ATIVO</span></div>
          <div className="next-check-row"><span className="check-circle"><Check size={13} /></span><span>{mode === 'cloud' ? 'Personagens persistentes' : 'Prévia da Clareira'}</span><span className="done-label">ATIVO</span></div>
          <div className="next-check-row"><span className="check-circle"><Check size={13} /></span><span>{mode === 'cloud' ? 'Exploração e combate em grupo' : 'Progresso local'}</span><span className="done-label">ATIVO</span></div>
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

function CampaignDetail({ campaign, onBack, onPlayPreview, onPlayOnline }: { campaign: CampaignSummary; onBack: () => void; onPlayPreview: () => void; onPlayOnline: () => void }) {
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

      <section className={`campaign-play-entry ${campaign.mode === 'cloud' ? 'campaign-play-entry-online' : ''}`}>
        <span className="campaign-play-icon"><Play size={19} fill="currentColor" /></span>
        <div>
          <span className="eyebrow">{campaign.mode === 'cloud' ? 'MESA ONLINE + PRÉVIA LOCAL' : 'PRÉVIA JOGÁVEL · LOCAL'}</span>
          <h2>Entre na Clareira da Vigília</h2>
          <p>{campaign.mode === 'cloud'
            ? 'Crie seu personagem, explore com os membros da campanha e resolva ações no servidor.'
            : 'Explore uma região finita, converse com Lira e enfrente um lodo usando regras D20.'}</p>
          <small>{campaign.mode === 'cloud'
            ? 'A mesa online salva personagens, posição, missão e combate no Supabase; a prévia solo continua local.'
            : 'O progresso desta aventura é salvo apenas neste navegador — não é sincronizado com a campanha na nuvem.'}</small>
        </div>
        <div className="campaign-play-actions">
          {campaign.mode === 'cloud' && <button className="button button-primary" type="button" onClick={onPlayOnline}><Users size={16} /> Entrar na mesa online</button>}
          <button className={campaign.mode === 'cloud' ? 'button button-outline' : 'button button-primary'} type="button" onClick={onPlayPreview}><Play size={16} fill="currentColor" /> {campaign.mode === 'cloud' ? 'Abrir prévia local' : 'Jogar prévia'}</button>
        </div>
      </section>

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

      <div className="phase-note"><div className="phase-note-icon"><ArrowDownRight size={18} /></div><div><span className="eyebrow">{campaign.mode === 'cloud' ? 'MESA ONLINE' : 'OFICINA LOCAL'}</span><p>{campaign.mode === 'cloud'
        ? 'Personagens, posição, missão e combate ficam salvos no Supabase. As ações são validadas no banco e sincronizadas para os membros da campanha. A prévia solo continua isolada neste navegador.'
        : 'Esta campanha e o progresso da aventura existem apenas neste navegador. Para jogar online com uma mesa, entre com uma conta conectada ao Supabase.'}</p></div><span className="phase-badge">{campaign.mode === 'cloud' ? 'ONLINE' : 'LOCAL'}</span></div>
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
