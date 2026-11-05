import { useCallback, useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Heart,
  MapPin,
  MessageCircle,
  Moon,
  RefreshCw,
  ScrollText,
  Shield,
  Sparkles,
  Swords,
  Users,
  X,
} from 'lucide-react';
import type { GameRuntime } from '../../game/core/GameRuntime';
import { FIRST_REGION } from '../../game/world/firstRegionData';
import { onlineAdventureService } from '../../services/game/onlineAdventureService';
import type {
  CharacterClass,
  MoveDirection,
  OnlineAdventureSnapshot,
  OnlineGameEvent,
} from '../../services/game/onlineAdventureService';
import type { CampaignSummary } from '../../types/campaign';

type NearbyTarget = 'lira' | 'marsh-slime' | 'camp' | null;
type DialogView = 'lira' | 'slime' | 'camp' | 'reset' | null;

interface OnlineAdventurePageProps {
  campaign: CampaignSummary;
  onBack: () => void;
}

const CLASS_OPTIONS: Array<{ id: CharacterClass; label: string; summary: string; stats: string }> = [
  { id: 'guardian', label: 'Guardião', summary: 'Resistente e confiável na linha de frente.', stats: '18 PV · defesa 14 · ataque +3' },
  { id: 'ranger', label: 'Batedor', summary: 'Equilíbrio entre vigor, mobilidade e precisão.', stats: '14 PV · defesa 13 · ataque +4' },
  { id: 'arcanist', label: 'Arcanista', summary: 'Ataques precisos; depende de evitar golpes.', stats: '12 PV · defesa 12 · ataque +5' },
];

export function OnlineAdventurePage({ campaign, onBack }: OnlineAdventurePageProps) {
  const [snapshot, setSnapshot] = useState<OnlineAdventureSnapshot | null>(null);
  const snapshotRef = useRef<OnlineAdventureSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [nearby, setNearby] = useState<NearbyTarget>(null);
  const [dialog, setDialog] = useState<DialogView>(null);
  const dialogRef = useRef(dialog);
  dialogRef.current = dialog;
  const [notice, setNotice] = useState('');
  const [gameError, setGameError] = useState('');
  const [screenError, setScreenError] = useState('');
  const [characterName, setCharacterName] = useState('');
  const [characterClass, setCharacterClass] = useState<CharacterClass>('guardian');
  const mountRef = useRef<HTMLDivElement>(null);
  const runtimeRef = useRef<GameRuntime | null>(null);

  const applySnapshot = useCallback((next: OnlineAdventureSnapshot) => {
    snapshotRef.current = next;
    setSnapshot(next);
    const events = runtimeRef.current?.game.events;
    if (!events || !next.character) return;
    events.emit('world:authoritative-state', {
      col: next.character.col,
      row: next.character.row,
      slimeHp: next.world.slimeHp,
    });
    events.emit('world:players', next.players
      .filter((player) => player.id !== next.character?.id)
      .map((player) => ({
        id: player.id,
        name: player.name,
        characterClass: player.characterClass,
        col: player.col,
        row: player.row,
      })));
  }, []);

  const refreshSnapshot = useCallback(async () => {
    try {
      const next = await onlineAdventureService.getSnapshot(campaign.id);
      applySnapshot(next);
      setScreenError('');
      return next;
    } catch (cause) {
      setScreenError(errorMessage(cause));
      throw cause;
    }
  }, [applySnapshot, campaign.id]);

  useEffect(() => {
    let disposed = false;
    let refreshTimer: number | null = null;
    let unsubscribe = () => {};

    const scheduleRefresh = () => {
      if (refreshTimer !== null) window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(() => {
        refreshTimer = null;
        void onlineAdventureService.getSnapshot(campaign.id)
          .then((next) => {
            if (!disposed) applySnapshot(next);
          })
          .catch((cause: unknown) => {
            if (!disposed) setNotice(errorMessage(cause));
          });
      }, 100);
    };

    setLoading(true);
    setScreenError('');
    void onlineAdventureService.getSnapshot(campaign.id)
      .then((next) => {
        if (!disposed) {
          applySnapshot(next);
          setLoading(false);
        }
      })
      .catch((cause: unknown) => {
        if (!disposed) {
          setScreenError(errorMessage(cause));
          setLoading(false);
        }
      });

    try {
      unsubscribe = onlineAdventureService.watchCampaign(
        campaign.id,
        scheduleRefresh,
        (isConnected) => {
          if (!disposed) {
            setConnected(isConnected);
            if (isConnected) scheduleRefresh();
          }
        },
      );
    } catch (cause) {
      setConnected(false);
      setNotice(errorMessage(cause));
    }

    return () => {
      disposed = true;
      if (refreshTimer !== null) window.clearTimeout(refreshTimer);
      unsubscribe();
    };
  }, [applySnapshot, campaign.id]);

  useEffect(() => {
    const character = snapshot?.character;
    const mount = mountRef.current;
    if (!character || !mount) return;
    let disposed = false;
    let runtime: GameRuntime | null = null;
    let detachEvents = () => {};

    async function bootGame() {
      try {
        const [{ GameRuntime: Runtime }, { FirstRegionScene: Scene }] = await Promise.all([
          import('../../game/core/GameRuntime'),
          import('../../game/scenes/FirstRegionScene'),
        ]);
        if (disposed || !mount) return;
        const current = snapshotRef.current;
        if (!current?.character) return;
        runtime = new Runtime(mount, [new Scene({
          col: current.character.col,
          row: current.character.row,
          slimeHp: current.world.slimeHp,
        }, true)]);
        runtimeRef.current = runtime;
        const events = runtime.game.events;
        const onNearby = (target: NearbyTarget) => setNearby(target);
        const onInteraction = (event: { target: NearbyTarget }) => {
          if (event.target === 'lira') setDialog('lira');
          else if (event.target === 'camp') setDialog('camp');
          else if (event.target === 'marsh-slime') setDialog('slime');
        };
        const onMoveRequest = (direction: MoveDirection) => {
          void executeAction(
            () => onlineAdventureService.move(campaign.id, direction),
            '',
            true,
          );
        };
        const onBlocked = () => setNotice('O caminho está bloqueado. Procure uma passagem livre pela clareira.');
        const onWorldMessage = (message: string) => setNotice(message);

        events.on('world:nearby', onNearby);
        events.on('world:interaction', onInteraction);
        events.on('world:move-request', onMoveRequest);
        events.on('world:blocked', onBlocked);
        events.on('world:message', onWorldMessage);
        const currentSnapshot = snapshotRef.current;
        if (currentSnapshot?.character) {
          events.emit('world:authoritative-state', {
            col: currentSnapshot.character.col,
            row: currentSnapshot.character.row,
            slimeHp: currentSnapshot.world.slimeHp,
          });
          events.emit('world:players', markerPlayers(currentSnapshot));
        }
        events.emit('world:request-state');
        detachEvents = () => {
          events.off('world:nearby', onNearby);
          events.off('world:interaction', onInteraction);
          events.off('world:move-request', onMoveRequest);
          events.off('world:blocked', onBlocked);
          events.off('world:message', onWorldMessage);
        };
      } catch (cause) {
        if (!disposed) setGameError(errorMessage(cause));
      }
    }

    void bootGame();
    return () => {
      disposed = true;
      detachEvents();
      runtime?.destroy();
      runtimeRef.current = null;
      setNearby(null);
    };
    // The runtime belongs to a character and campaign, not each realtime snapshot update.
  }, [campaign.id, snapshot?.character?.id]);

  useEffect(() => {
    runtimeRef.current?.game.events.emit('world:lock-controls', busy || Boolean(dialog));
  }, [busy, dialog]);

  function submitCharacter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedName = characterName.trim();
    if (trimmedName.length < 2 || trimmedName.length > 24) {
      setNotice('O nome precisa ter entre 2 e 24 caracteres.');
      return;
    }
    void executeAction(
      () => onlineAdventureService.createCharacter(campaign.id, trimmedName, characterClass),
      'Personagem criado na campanha e salvo no servidor.',
    );
  }

  function acceptQuest() {
    void executeAction(() => onlineAdventureService.acceptQuest(campaign.id), 'Missão aceita por toda a mesa.');
  }

  function attackSlime() {
    void executeAction(() => onlineAdventureService.attackSlime(campaign.id), 'A ação de combate foi resolvida pelo servidor.');
  }

  function deliverQuest() {
    void executeAction(() => onlineAdventureService.deliverQuest(campaign.id), 'Missão concluída; recompensa e progressão foram salvas.');
  }

  function restAtCamp() {
    void executeAction(() => onlineAdventureService.rest(campaign.id), 'Vida restaurada no servidor.')
      .then((result) => {
        if (result) setDialog(null);
      });
  }

  function resetRegion() {
    void executeAction(
      () => onlineAdventureService.resetRegion(campaign.id),
      'O mestre reiniciou a região para toda a campanha. XP dos personagens foi preservado.',
    ).then((result) => {
      if (result) setDialog(null);
    });
  }

  const character = snapshot?.character ?? null;
  const shardCount = snapshot?.inventory.find((item) => item.itemId === 'amber-shard')?.quantity ?? 0;
  const nearbyLabel = nearby === 'lira' ? 'Conversar com Lira'
    : nearby === 'marsh-slime' ? (character?.questStatus === 'active' ? 'Enfrentar o lodo' : 'Examinar o lodo')
      : nearby === 'camp' ? 'Examinar o acampamento'
        : '';
  const currentCombat = snapshot?.recentEvents.find((event) => event.eventType === 'combat');

  return (
    <main className="adventure-page online-adventure-page">
      <header className="adventure-topbar">
        <button className="adventure-back" type="button" onClick={onBack}><ArrowLeft size={17} /> Campanha</button>
        <div className="adventure-brand"><span className="adventure-brand-mark">V</span><span><strong>VEYRATH</strong><small>PRIMEIRA CRÔNICA</small></span></div>
        <span className={`online-save-pill ${connected ? 'is-connected' : ''}`}><span /> {connected ? 'MESA SINCRONIZADA' : 'CONECTANDO À MESA'}</span>
      </header>

      <div className="adventure-content">
        <div className="adventure-heading">
          <div>
            <span className="eyebrow">{campaign.name} <span className="adventure-heading-divider">/</span> MESA ONLINE · REGIÃO 01</span>
            <h1>{FIRST_REGION.name}</h1>
            <p>Exploração compartilhada · progresso e rolagens validados pelo servidor</p>
          </div>
          {character && <div className="adventure-hud" aria-label="Estado do personagem">
            <div className="hud-stat"><Heart size={15} /><span>VIDA</span><strong>{character.hp}<small>/{character.maxHp}</small></strong></div>
            <div className="hud-stat"><Shield size={15} /><span>DEFESA</span><strong>{character.defense}</strong></div>
            <div className="hud-stat"><Sparkles size={15} /><span>XP</span><strong>{character.experience}</strong></div>
          </div>}
        </div>

        {notice && <div className="adventure-notice" role="status"><Sparkles size={15} /><span>{notice}</span><button type="button" onClick={() => setNotice('')} aria-label="Fechar aviso"><X size={15} /></button></div>}

        {loading ? (
          <div className="online-state-card" role="status"><span className="loading-spinner" />Carregando a mesa compartilhada…</div>
        ) : screenError ? (
          <div className="online-state-card online-state-error" role="alert"><strong>Não foi possível entrar na mesa online.</strong><p>{screenError}</p><button className="button button-outline" type="button" onClick={() => void refreshSnapshot().catch(() => undefined)}><RefreshCw size={15} /> Tentar novamente</button></div>
        ) : !character ? (
          <section className="online-character-setup">
            <div className="online-setup-copy"><span className="eyebrow">SUA PRIMEIRA FICHA</span><h2>Crie o personagem desta campanha</h2><p>O personagem ficará associado à sua conta e visível para os membros autorizados da mesa.</p></div>
            <form onSubmit={submitCharacter}>
              <label className="field-label" htmlFor="online-character-name">Nome do personagem</label>
              <input id="online-character-name" className="text-input" value={characterName} onChange={(event) => setCharacterName(event.target.value)} minLength={2} maxLength={24} required placeholder="Ex.: Maelis" />
              <fieldset className="online-class-options">
                <legend className="field-label">Escolha uma classe</legend>
                {CLASS_OPTIONS.map((option) => (
                  <label key={option.id} className={`online-class-option ${characterClass === option.id ? 'is-selected' : ''}`}>
                    <input type="radio" name="character-class" value={option.id} checked={characterClass === option.id} onChange={() => setCharacterClass(option.id)} />
                    <span><strong>{option.label}</strong><small>{option.summary}</small><em>{option.stats}</em></span>
                  </label>
                ))}
              </fieldset>
              <button className="button button-primary" type="submit" disabled={busy}>{busy ? 'Salvando no servidor…' : 'Criar personagem e entrar'} <ArrowRight size={16} /></button>
            </form>
          </section>
        ) : (
          <div className="adventure-layout online-adventure-layout">
            <section className="game-stage online-game-stage">
              <div className="game-stage-topline"><span><MapPin size={14} /> REGIÃO COMPARTILHADA</span><span className="game-stage-live"><i /> {connected ? 'REALTIME ATIVO' : 'TENTANDO RECONECTAR'}</span></div>
              <div className="game-canvas-wrap" ref={mountRef} aria-label="Mapa compartilhado da Clareira da Vigília" />
              {gameError && <div className="game-load-error" role="alert"><strong>O mapa não pôde iniciar.</strong><span>{gameError}</span></div>}
              <div className="game-stage-controls">
                <div className="movement-pad" aria-label="Controles de movimento">
                  <span className="movement-label">MOVER</span>
                  <button type="button" aria-label="Mover para cima" disabled={busy || Boolean(dialog)} onClick={() => runtimeRef.current?.game.events.emit('world:step', 'up')}><ArrowUp size={17} /></button>
                  <button type="button" aria-label="Mover para a esquerda" disabled={busy || Boolean(dialog)} onClick={() => runtimeRef.current?.game.events.emit('world:step', 'left')}><ArrowLeft size={17} /></button>
                  <button type="button" aria-label="Mover para baixo" disabled={busy || Boolean(dialog)} onClick={() => runtimeRef.current?.game.events.emit('world:step', 'down')}><ArrowDown size={17} /></button>
                  <button type="button" aria-label="Mover para a direita" disabled={busy || Boolean(dialog)} onClick={() => runtimeRef.current?.game.events.emit('world:step', 'right')}><ArrowRight size={17} /></button>
                </div>
                <button className="button button-primary adventure-interact" type="button" disabled={!nearby || busy || Boolean(dialog)} onClick={() => runtimeRef.current?.game.events.emit('world:interact-request')}>
                  <MessageCircle size={16} /> {nearbyLabel || 'Sem interação próxima'} <span className="key-hint">E</span>
                </button>
              </div>
            </section>

            <aside className="adventure-sidebar">
              <section className="adventure-card quest-card">
                <div className="adventure-card-title"><span className="card-icon"><ScrollText size={17} /></span><div><span className="eyebrow">DIÁRIO DA MESA</span><h2>O fragmento de Lira</h2></div></div>
                <p>Recupere o fragmento de âmbar na margem do brejo e leve-o de volta à batedora.</p>
                <div className="quest-status-row"><span className={`quest-status-dot quest-status-${character.questStatus}`} />{questLabel(character.questStatus)}</div>
                <div className="quest-objective"><span>{snapshot?.world.slimeDefeated ? '✓' : '01'}</span><p>Encontre o lodo e recupere o fragmento</p></div>
                <div className="quest-objective"><span>{character.questStatus === 'completed' ? '✓' : '02'}</span><p>Entregue o fragmento a Lira</p></div>
                {character.questStatus === 'unstarted' && <p className="quest-hint">Converse com Lira no caminho de pedra para aceitar a missão.</p>}
                {character.questStatus === 'active' && shardCount > 0 && <p className="quest-hint">Seu fragmento está na bolsa. Volte até Lira para concluir.</p>}
              </section>

              <section className="adventure-card inventory-card">
                <div className="adventure-card-title"><span className="card-icon card-icon-amber"><Sparkles size={17} /></span><div><span className="eyebrow">NÍVEL {character.level} · {classLabel(character.characterClass).toUpperCase()}</span><h2>{character.name}</h2></div></div>
                {shardCount > 0 ? <div className="inventory-item"><span className="inventory-gem">✦</span><span><strong>Fragmento de âmbar</strong><small>Prova da vitória sobre o lodo</small></span><b>× {shardCount}</b></div> : <p className="inventory-empty">A bolsa ainda está vazia.</p>}
                <div className="inventory-footer"><span>PRÓXIMO NÍVEL</span><strong>{Math.max(0, character.level * 100 - character.experience)} XP</strong></div>
              </section>

              <section className="adventure-card party-card">
                <div className="adventure-card-title"><span className="card-icon"><Users size={17} /></span><div><span className="eyebrow">CAMPANHA · {snapshot?.players.length ?? 0} PERSONAGENS</span><h2>Na mesa</h2></div></div>
                {snapshot?.players.length ? (
                  <ul className="online-party-list">{snapshot.players.map((player) => (
                    <li key={player.id} className={player.id === character.id ? 'is-self' : ''}>
                      <span className={`online-party-marker class-${player.characterClass}`} />
                      <span><strong>{player.name}{player.id === character.id ? ' (você)' : ''}</strong><small>{classLabel(player.characterClass)} · {player.hp}/{player.maxHp} PV · {player.col + 1},{player.row + 1}</small></span>
                    </li>
                  ))}</ul>
                ) : <p className="inventory-empty">Nenhum personagem entrou nesta mesa ainda.</p>}
              </section>

              <section className="adventure-card table-log-card">
                <div className="adventure-card-title"><span className="card-icon"><Swords size={17} /></span><div><span className="eyebrow">REGISTRO SINCRONIZADO</span><h2>Crônica recente</h2></div></div>
                {snapshot?.recentEvents.length ? <ul className="online-event-list">{snapshot.recentEvents.slice(0, 6).map((event) => <li key={event.id}><strong>{event.actorName}</strong><span>{eventLabel(event)}</span><time>{timeLabel(event.createdAt)}</time></li>)}</ul> : <p className="inventory-empty">As ações da mesa aparecerão aqui.</p>}
              </section>

              {campaign.role === 'master' && <button className="master-reset-button" type="button" disabled={busy} onClick={() => setDialog('reset')}><RefreshCw size={15} /> Reiniciar região para a mesa</button>}
            </aside>
          </div>
        )}
      </div>

      {character && dialog && (
        <div className="adventure-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) setDialog(null); }}>
          <section className="adventure-dialog online-action-dialog" role="dialog" aria-modal="true" aria-labelledby="online-dialog-title">
            <button className="adventure-dialog-close" type="button" onClick={() => !busy && setDialog(null)} aria-label="Fechar diálogo"><X size={18} /></button>
            <span className="eyebrow">{campaign.name} · MESA ONLINE</span>
            {dialog === 'lira' ? (
              <>
                <h2 id="online-dialog-title">Lira, batedora da margem</h2>
                {character.questStatus === 'unstarted' ? <><p>“Um lodo levou o fragmento de âmbar que eu procurava. Se puder recuperá-lo, a trilha do brejo ficará segura outra vez.” A missão é compartilhada pela mesa.</p><button className="button button-primary" type="button" disabled={busy} onClick={acceptQuest}><ScrollText size={16} /> {busy ? 'Registrando…' : 'Aceitar missão'}</button></>
                  : character.questStatus === 'active' && shardCount > 0 ? <><p>“Você conseguiu! Esse fragmento vai iluminar a trilha por muitas noites. Obrigada, viajante.”</p><button className="button button-primary" type="button" disabled={busy} onClick={deliverQuest}><Sparkles size={16} /> {busy ? 'Validando entrega…' : 'Entregar e concluir missão'}</button></>
                    : character.questStatus === 'active' ? <><p>“O lodo ronda as pedras úmidas ao norte. Traga o fragmento de âmbar de volta para mim.”</p><button className="button button-outline" type="button" onClick={() => setDialog(null)}>Vou procurar</button></>
                      : <><p>“A trilha está segura por enquanto. Obrigada por ajudar a clareira.”</p><button className="button button-outline" type="button" onClick={() => setDialog(null)}>Até mais</button></>}
              </>
            ) : dialog === 'slime' ? (
              <>
                <h2 id="online-dialog-title">{character.hp <= 0 ? 'Retornar ao acampamento' : snapshot?.world.slimeDefeated ? 'A margem está quieta' : 'Lodo do Brejo de Varda'}</h2>
                {character.hp <= 0 ? <><p className="field-hint">Seu personagem caiu. Retorne ao acampamento para recuperar a vida e continuar a aventura.</p><button className="button button-primary" type="button" disabled={busy} onClick={restAtCamp}><Moon size={16} /> {busy ? 'Voltando ao acampamento…' : 'Retornar ao acampamento e recuperar vida'}</button></>
                  : character.questStatus !== 'active' && !snapshot?.world.slimeDefeated ? <><p>Lira pediu ajuda para recuperar o fragmento. Aceite a missão com ela antes de lutar.</p><button className="button button-outline" type="button" onClick={() => setDialog(null)}>Voltar à trilha</button></>
                    : snapshot?.world.slimeDefeated ? <><p>A criatura foi derrotada nesta campanha. Os aventureiros com a missão ativa receberam a recompensa; veja o registro da mesa.</p><button className="button button-outline" type="button" onClick={() => setDialog(null)}>Continuar</button></>
                      : <>
                        <p>PV do lodo: <strong>{snapshot?.world.slimeHp}/7</strong>. Cada ataque e contra-ataque é rolado pelo banco e sincronizado para os membros da mesa.</p>
                        {currentCombat && <div className="online-combat-result">{combatSummary(currentCombat)}</div>}
                        <button className="button button-primary" type="button" disabled={busy} onClick={attackSlime}><Swords size={16} /> {busy ? 'Resolvendo no servidor…' : 'Atacar e resolver rodada'}</button>
                      </>}
              </>
            ) : dialog === 'camp' ? (
              <><h2 id="online-dialog-title">Acampamento da Vigília</h2><p>Descansar recupera os pontos de vida do seu personagem no servidor. A posição e o histórico da mesa também ficam salvos.</p><button className="button button-primary" type="button" disabled={busy || character.hp === character.maxHp} onClick={restAtCamp}><Moon size={16} /> {busy ? 'Descansando…' : character.hp === character.maxHp ? 'Vida já está completa' : 'Descansar e recuperar vida'}</button></>
            ) : (
              <><h2 id="online-dialog-title">Reiniciar a região para toda a mesa?</h2><p>Esta ação do mestre restaura o lodo, reinicia a missão e a posição de todos e remove os fragmentos desta região. A experiência dos personagens é preservada.</p><button className="button button-danger" type="button" disabled={busy} onClick={resetRegion}><RefreshCw size={15} /> {busy ? 'Reiniciando…' : 'Confirmar reinício da região'}</button></>
            )}
          </section>
        </div>
      )}
    </main>
  );

  async function executeAction(
    action: () => Promise<OnlineAdventureSnapshot>,
    successMessage: string,
    isMove = false,
  ) {
    if (busyRef.current) return null;
    busyRef.current = true;
    setBusy(true);
    setNotice('');
    runtimeRef.current?.game.events.emit('world:lock-controls', true);
    try {
      const next = await action();
      applySnapshot(next);
      if (successMessage) setNotice(successMessage);
      return next;
    } catch (cause) {
      setNotice(errorMessage(cause));
      if (isMove) runtimeRef.current?.game.events.emit('world:move-rejected');
      void onlineAdventureService.getSnapshot(campaign.id).then(applySnapshot).catch(() => undefined);
      return null;
    } finally {
      busyRef.current = false;
      setBusy(false);
      runtimeRef.current?.game.events.emit('world:lock-controls', Boolean(dialogRef.current));
    }
  }
}

function markerPlayers(snapshot: OnlineAdventureSnapshot) {
  return snapshot.players
    .filter((player) => player.id !== snapshot.character?.id)
    .map((player) => ({
      id: player.id,
      name: player.name,
      characterClass: player.characterClass,
      col: player.col,
      row: player.row,
    }));
}

function classLabel(characterClass: CharacterClass): string {
  return CLASS_OPTIONS.find((option) => option.id === characterClass)?.label ?? 'Aventureiro';
}

function questLabel(status: 'unstarted' | 'active' | 'completed'): string {
  return status === 'unstarted' ? 'Ainda não aceita' : status === 'active' ? 'Em andamento' : 'Concluída';
}

function errorMessage(cause: unknown): string {
  const message = cause instanceof Error ? cause.message : 'A operação online falhou. Tente novamente.';
  if (message.includes('bloqueado')) return 'O caminho está bloqueado pela região ou por outro personagem.';
  if (message.includes('Aproxime-se')) return message;
  if (message.includes('personagem')) return message;
  if (message.includes('missão') || message.includes('fragmento') || message.includes('lodo')) return message;
  if (message.includes('participante') || message.includes('mestre')) return message;
  return message.replace(/^[A-Z0-9]{4,6}:\s*/, '');
}

function eventLabel(event: OnlineGameEvent): string {
  switch (event.eventType) {
    case 'character_created': return 'entrou na campanha com um novo personagem.';
    case 'moved': return `explorou a região (${event.payload.col ?? '?'}, ${event.payload.row ?? '?'}).`;
    case 'quest_accepted': return 'aceitou o pedido de Lira.';
    case 'quest_completed': return `concluiu a missão e recebeu ${event.payload.experienceAwarded ?? 25} XP.`;
    case 'rested': return event.payload.returnedToCamp === true ? 'retornou ao acampamento após cair e recuperou a vida.' : 'descansou no acampamento.';
    case 'region_reset': return 'reiniciou a região para a mesa.';
    case 'combat': return combatSummary(event);
  }
}

function combatSummary(event: OnlineGameEvent): string {
  const roll = event.payload.playerRoll;
  const total = event.payload.playerTotal;
  if (event.payload.victory === true) return `derrotou o lodo (D20 ${roll ?? '?'} + bônus ${typeof total === 'number' && typeof roll === 'number' ? total - roll : '?'}). Recompensa distribuída.`;
  const hit = event.payload.playerHit === true;
  const damage = event.payload.playerDamage;
  const enemyHit = event.payload.enemyHit === true;
  const enemyDamage = event.payload.enemyDamage;
  return `atacou: D20 ${roll ?? '?'} · ${hit ? `${damage ?? 0} de dano` : 'errou'}${enemyHit ? `; recebeu ${enemyDamage ?? 0} de dano` : '; o lodo errou'}.`;
}

function timeLabel(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}
