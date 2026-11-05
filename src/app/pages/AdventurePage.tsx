import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Heart,
  MapPin,
  MessageCircle,
  Moon,
  ScrollText,
  Shield,
  Sparkles,
  Swords,
  X,
} from 'lucide-react';
import { beginFirstEncounter, resolveFirstEncounterTurn } from '../../engine/combat/firstEncounter';
import type { FirstEncounterState } from '../../engine/combat/firstEncounter';
import type { GameRuntime } from '../../game/core/GameRuntime';
import { FIRST_REGION } from '../../game/world/firstRegionData';
import {
  createStartingAdventure,
  loadLocalAdventure,
  saveLocalAdventure,
} from '../../services/game/localAdventureStore';
import type { LocalAdventureState } from '../../services/game/localAdventureStore';
import type { CampaignSummary } from '../../types/campaign';

type DialogView = 'lira' | 'camp' | 'slime-warning' | 'slime-defeated' | 'fallen' | null;
type NearbyTarget = 'lira' | 'marsh-slime' | 'camp' | null;
type WorldPosition = Pick<LocalAdventureState, 'col' | 'row'>;

interface AdventurePageProps {
  campaign: CampaignSummary;
  onBack: () => void;
}

export function AdventurePage({ campaign, onBack }: AdventurePageProps) {
  const saveOnLoad = useMemo(() => {
    try {
      return { state: loadLocalAdventure(campaign.id), error: '' };
    } catch (cause) {
      return {
        state: createStartingAdventure(campaign.id),
        error: cause instanceof Error ? cause.message : 'O progresso local não pôde ser lido.',
      };
    }
  }, [campaign.id]);
  const [adventure, setAdventure] = useState(saveOnLoad.state);
  const adventureRef = useRef(adventure);
  adventureRef.current = adventure;
  const canSaveRef = useRef(!saveOnLoad.error);
  const [saveMessage, setSaveMessage] = useState(saveOnLoad.error);
  const [nearby, setNearby] = useState<NearbyTarget>(null);
  const [dialog, setDialog] = useState<DialogView>(null);
  const [combat, setCombat] = useState<FirstEncounterState | null>(null);
  const [combatLog, setCombatLog] = useState<string[]>([]);
  const [notice, setNotice] = useState('');
  const [gameError, setGameError] = useState('');
  const mountRef = useRef<HTMLDivElement>(null);
  const runtimeRef = useRef<GameRuntime | null>(null);

  const updateAdventure = useCallback((patch: Partial<LocalAdventureState>) => {
    const next: LocalAdventureState = {
      ...adventureRef.current,
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    adventureRef.current = next;
    setAdventure(next);
    if (!canSaveRef.current) return;
    try {
      saveLocalAdventure(next);
      setSaveMessage('');
    } catch (cause) {
      setSaveMessage(cause instanceof Error ? cause.message : 'O progresso não pôde ser salvo neste navegador.');
    }
  }, []);

  const startCombat = useCallback(() => {
    const state = adventureRef.current;
    if (state.hp <= 0) {
      setDialog('fallen');
      return;
    }
    if (state.slimeHp <= 0) {
      setDialog('slime-defeated');
      return;
    }
    const encounter = beginFirstEncounter(state.hp, state.maxHp, state.slimeHp);
    setCombat(encounter);
    setCombatLog([
      `Iniciativa: você ${encounter.heroInitiative} · lodo ${encounter.slimeInitiative}.`,
      encounter.lastAction,
    ]);
    setNotice('');
  }, []);

  const handleWorldInteraction = useCallback((event: { target: NearbyTarget }) => {
    if (event.target === 'lira') {
      setDialog('lira');
      return;
    }
    if (event.target === 'camp') {
      setDialog('camp');
      return;
    }
    if (event.target === 'marsh-slime') {
      const state = adventureRef.current;
      if (state.slimeHp <= 0) setDialog('slime-defeated');
      else if (state.questStatus !== 'active') setDialog('slime-warning');
      else startCombat();
    }
  }, [startCombat]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    let disposed = false;
    let runtime: GameRuntime | null = null;
    let detachEvents: () => void = () => {};

    async function bootGame() {
      try {
        const [{ GameRuntime: Runtime }, { FirstRegionScene: Scene }] = await Promise.all([
          import('../../game/core/GameRuntime'),
          import('../../game/scenes/FirstRegionScene'),
        ]);
        if (disposed || !mount) return;
        runtime = new Runtime(mount, [new Scene(adventureRef.current)]);
        runtimeRef.current = runtime;
        const events = runtime.game.events;
        const onPosition = (position: WorldPosition) => updateAdventure({ col: position.col, row: position.row });
        const onNearby = (target: NearbyTarget) => setNearby(target);
        const onInteraction = (event: { target: NearbyTarget }) => handleWorldInteraction(event);
        const onBlocked = () => setNotice('O caminho está bloqueado. Procure uma passagem livre pela clareira.');
        const onWorldMessage = (message: string) => setNotice(message);

        events.on('world:position', onPosition);
        events.on('world:nearby', onNearby);
        events.on('world:interaction', onInteraction);
        events.on('world:blocked', onBlocked);
        events.on('world:message', onWorldMessage);
        events.emit('world:request-state');
        detachEvents = () => {
          events.off('world:position', onPosition);
          events.off('world:nearby', onNearby);
          events.off('world:interaction', onInteraction);
          events.off('world:blocked', onBlocked);
          events.off('world:message', onWorldMessage);
        };
      } catch (cause) {
        if (!disposed) setGameError(cause instanceof Error ? cause.message : 'Não foi possível iniciar a cena do jogo.');
      }
    }

    void bootGame();
    return () => {
      disposed = true;
      detachEvents();
      runtime?.destroy();
      runtimeRef.current = null;
    };
  }, [handleWorldInteraction, updateAdventure]);

  useEffect(() => {
    runtimeRef.current?.game.events.emit('world:lock-controls', Boolean(combat || dialog));
  }, [combat, dialog]);

  function restAtCamp() {
    updateAdventure({ hp: adventureRef.current.maxHp });
    runtimeRef.current?.game.events.emit('world:teleport', FIRST_REGION.start);
    setCombat(null);
    setDialog(null);
    setNotice('Você descansou no acampamento. Seus pontos de vida foram restaurados.');
  }

  function acceptQuest() {
    updateAdventure({ questStatus: 'active' });
    setNotice('Missão aceita: encontre o lodo no brejo e traga um fragmento de âmbar para Lira.');
  }

  function deliverShard() {
    const current = adventureRef.current;
    const shard = current.inventory.find((item) => item.itemId === 'amber-shard');
    if (!shard || shard.quantity < 1) return;
    const inventory = current.inventory
      .map((item) => item.itemId === 'amber-shard' ? { ...item, quantity: item.quantity - 1 } : item)
      .filter((item) => item.quantity > 0);
    updateAdventure({ questStatus: 'completed', inventory, experience: current.experience + 25 });
    setNotice('Missão concluída. Lira guarda o fragmento e anota seu nome na crônica.');
  }

  function resolveCombatAction() {
    if (!combat || combat.phase !== 'active') return;
    const resolution = resolveFirstEncounterTurn(combat);
    const modifier = resolution.actor === 'hero' ? 4 : 2;
    const defense = resolution.actor === 'hero' ? 11 : 13;
    const roll = resolution.attack;
    const rollText = `D20 ${roll.natural} + ${modifier} = ${roll.total} contra CA ${defense}${roll.hit ? ` · dano ${roll.damageRolls.join(' + ')}${resolution.attack.critical ? ' (crítico)' : ''}` : ''}.`;
    setCombat(resolution.state);
    setCombatLog((current) => [...current, `${rollText} ${resolution.state.lastAction}`]);

    if (resolution.state.phase === 'victory') {
      const current = adventureRef.current;
      const alreadyHasShard = current.inventory.some((item) => item.itemId === 'amber-shard');
      updateAdventure({
        hp: resolution.state.heroHp,
        slimeHp: 0,
        experience: current.experience + 15,
        inventory: alreadyHasShard ? current.inventory : [...current.inventory, { itemId: 'amber-shard', quantity: 1 }],
      });
      runtimeRef.current?.game.events.emit('world:slime-defeated');
      setNotice('Encontro vencido: +15 XP e 1 fragmento de âmbar.');
    } else {
      updateAdventure({ hp: resolution.state.heroHp, slimeHp: resolution.state.slimeHp });
      if (resolution.state.phase === 'defeat') setNotice('Você caiu. Recupere-se no acampamento para tentar novamente.');
    }
  }

  const shardCount = adventure.inventory.find((item) => item.itemId === 'amber-shard')?.quantity ?? 0;
  const nearbyLabel = nearby === 'lira' ? 'Conversar com Lira'
    : nearby === 'marsh-slime' ? (adventure.questStatus === 'active' ? 'Enfrentar o lodo' : 'Examinar o lodo')
      : nearby === 'camp' ? 'Examinar o acampamento'
        : '';

  return (
    <main className="adventure-page">
      <header className="adventure-topbar">
        <button className="adventure-back" type="button" onClick={onBack}><ArrowLeft size={17} /> Campanha</button>
        <div className="adventure-brand"><span className="adventure-brand-mark">V</span><span><strong>VEYRATH</strong><small>PRIMEIRA CRÔNICA</small></span></div>
        <div className="local-save-pill"><span /> PROGRESSO LOCAL · NESTE NAVEGADOR</div>
      </header>

      <div className="adventure-content">
        <div className="adventure-heading">
          <div>
            <span className="eyebrow">{campaign.name} <span className="adventure-heading-divider">/</span> REGIÃO 01</span>
            <h1>{FIRST_REGION.name}</h1>
            <p>{FIRST_REGION.subtitle} · uma aventura solo de demonstração</p>
          </div>
          <div className="adventure-hud" aria-label="Estado do personagem">
            <div className="hud-stat"><Heart size={15} /><span>VIDA</span><strong>{adventure.hp}<small>/{adventure.maxHp}</small></strong></div>
            <div className="hud-stat hud-xp"><Sparkles size={15} /><span>XP</span><strong>{adventure.experience}</strong></div>
            <div className="hud-stat hud-position"><MapPin size={15} /><span>POSIÇÃO</span><strong>{adventure.col + 1} · {adventure.row + 1}</strong></div>
          </div>
        </div>

        {saveMessage && <div className="adventure-warning" role="status"><Shield size={16} /><span>{saveMessage} {canSaveRef.current ? 'A aventura continua disponível nesta sessão, mas pode não persistir.' : 'O arquivo existente foi preservado e não será sobrescrito.'}</span></div>}
        {notice && <div className="adventure-notice" role="status"><Sparkles size={16} /><span>{notice}</span><button type="button" onClick={() => setNotice('')} aria-label="Fechar aviso"><X size={15} /></button></div>}

        {gameError ? (
          <div className="adventure-game-error" role="alert"><h2>A cena não iniciou</h2><p>{gameError}</p><button className="button button-outline" type="button" onClick={onBack}>Voltar à campanha</button></div>
        ) : (
          <div className="adventure-layout">
            <section className="adventure-map-panel" aria-label="Mapa jogável">
              <div className="map-panel-heading"><div><span className="eyebrow">EXPLORAÇÃO SOLO</span><strong><MapPin size={15} /> {FIRST_REGION.subtitle}</strong></div><span className="region-chip">13 × 11 · REGIÃO FINITA</span></div>
              <div className="adventure-viewport" ref={mountRef} aria-label="Mapa isométrico da Clareira da Vigília" />
              <div className="adventure-controls">
                <div className="control-instructions"><strong>Explorar</strong><span>WASD ou setas · siga os eixos do losango</span><small>Colisões ativas · água e rochas bloqueiam passagem</small></div>
                <div className="control-cluster" aria-label="Controles de movimento">
                  <button type="button" aria-label="Mover para cima" disabled={Boolean(combat || dialog)} onClick={() => runtimeRef.current?.game.events.emit('world:step', 'up')}><ArrowUp size={17} /></button>
                  <button type="button" aria-label="Mover para a esquerda" disabled={Boolean(combat || dialog)} onClick={() => runtimeRef.current?.game.events.emit('world:step', 'left')}><ArrowLeft size={17} /></button>
                  <button type="button" aria-label="Mover para baixo" disabled={Boolean(combat || dialog)} onClick={() => runtimeRef.current?.game.events.emit('world:step', 'down')}><ArrowDown size={17} /></button>
                  <button type="button" aria-label="Mover para a direita" disabled={Boolean(combat || dialog)} onClick={() => runtimeRef.current?.game.events.emit('world:step', 'right')}><ArrowRight size={17} /></button>
                </div>
                <button
                  className="button button-primary adventure-interact"
                  type="button"
                  disabled={!nearby || Boolean(combat || dialog)}
                  onClick={() => runtimeRef.current?.game.events.emit('world:interact-request')}
                >
                  <MessageCircle size={16} /> {nearbyLabel || 'Sem interação próxima'} <span className="key-hint">E</span>
                </button>
              </div>
            </section>

            <aside className="adventure-sidebar">
              <section className="adventure-card quest-card">
                <div className="adventure-card-title"><span className="card-icon"><ScrollText size={17} /></span><div><span className="eyebrow">DIÁRIO</span><h2>Um pedido de Lira</h2></div></div>
                <p>Ajude Lira a recuperar um fragmento de âmbar perdido na margem do brejo.</p>
                <div className="quest-status-row"><span className={`quest-status-dot quest-status-${adventure.questStatus}`} />{adventure.questStatus === 'unstarted' ? 'Ainda não aceita' : adventure.questStatus === 'active' ? 'Em andamento' : 'Concluída'}</div>
                <div className="quest-objective"><span>{adventure.slimeHp === 0 ? '✓' : '01'}</span><p>Encontre o lodo e recupere o fragmento</p></div>
                <div className="quest-objective"><span>{adventure.questStatus === 'completed' ? '✓' : '02'}</span><p>Entregue o fragmento a Lira</p></div>
                {adventure.questStatus === 'unstarted' && <p className="quest-hint">Procure Lira perto do caminho de pedra e pressione E.</p>}
                {adventure.questStatus === 'active' && shardCount > 0 && <p className="quest-hint">O fragmento está na sua bolsa. Volte até Lira para concluir.</p>}
              </section>

              <section className="adventure-card inventory-card">
                <div className="adventure-card-title"><span className="card-icon card-icon-amber"><Sparkles size={17} /></span><div><span className="eyebrow">PERSONAGEM · NÍVEL 1</span><h2>Bolsa de viagem</h2></div></div>
                {shardCount > 0 ? (
                  <div className="inventory-item"><span className="inventory-gem">✦</span><span><strong>Fragmento de âmbar</strong><small>Prova da vitória sobre o lodo</small></span><b>× {shardCount}</b></div>
                ) : <p className="inventory-empty">Sua bolsa ainda está vazia.</p>}
                <div className="inventory-footer"><span>PRÓXIMO NÍVEL</span><strong>{Math.max(0, 100 - (adventure.experience % 100))} XP</strong></div>
              </section>

              <section className="adventure-card rules-card">
                <div className="adventure-card-title"><span className="card-icon"><Swords size={17} /></span><div><span className="eyebrow">REGRAS DA PRÉVIA</span><h2>Encontros D20</h2></div></div>
                <p>Iniciativa, ataque, defesa e dano são rolados ao vivo no seu navegador. Um 20 natural causa crítico.</p>
              </section>

              {nearby === 'camp' && <button className="rest-button" type="button" onClick={() => setDialog('camp')}><Moon size={16} /> Descansar no acampamento <span>HP cheio</span></button>}
            </aside>
          </div>
        )}
      </div>

      {dialog && (
        <div className="adventure-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setDialog(null); }}>
          <section className="adventure-dialog" role="dialog" aria-modal="true" aria-labelledby="adventure-dialog-title">
            <button className="adventure-dialog-close" type="button" onClick={() => setDialog(null)} aria-label="Fechar diálogo"><X size={18} /></button>
            <span className="eyebrow">CLAREIRA DA VIGÍLIA</span>
            {dialog === 'lira' ? (
              <>
                <h2 id="adventure-dialog-title">Lira, batedora da margem</h2>
                {adventure.questStatus === 'unstarted' ? (
                  <><p>“Um lodo levou o fragmento de âmbar que eu procurava. Se puder recuperá-lo, a trilha do brejo ficará segura outra vez.”</p><button className="button button-primary" type="button" onClick={acceptQuest}><ScrollText size={16} /> Aceitar missão</button></>
                ) : adventure.questStatus === 'active' && shardCount > 0 ? (
                  <><p>“Você conseguiu! Esse fragmento vai iluminar a trilha por muitas noites. Obrigada, viajante.”</p><button className="button button-primary" type="button" onClick={deliverShard}><Sparkles size={16} /> Entregar e concluir missão</button></>
                ) : adventure.questStatus === 'active' ? (
                  <><p>“O lodo ronda as pedras úmidas ao norte. Traga o fragmento de âmbar de volta para mim.”</p><button className="button button-outline" type="button" onClick={() => setDialog(null)}>Vou procurar</button></>
                ) : (
                  <><p>“A trilha está segura por enquanto. Obrigada por ajudar a clareira.”</p><button className="button button-outline" type="button" onClick={() => setDialog(null)}>Até mais</button></>
                )}
              </>
            ) : dialog === 'camp' ? (
              <><h2 id="adventure-dialog-title">Acampamento da Vigília</h2><p>Um pequeno fogo mantém o frio do brejo à distância. Descansar recupera toda a vida e devolve você ao início da trilha.</p><button className="button button-primary" type="button" onClick={restAtCamp}><Moon size={16} /> Descansar e recuperar vida</button></>
            ) : dialog === 'slime-warning' ? (
              <><h2 id="adventure-dialog-title">Um lodo no brejo</h2><p>Uma criatura verde se agita entre as pedras. Lira pediu que você recupere o fragmento de âmbar. Converse com ela e aceite a missão antes de entrar no combate.</p><button className="button button-outline" type="button" onClick={() => setDialog(null)}>Entendi</button></>
            ) : dialog === 'slime-defeated' ? (
              <><h2 id="adventure-dialog-title">A margem está quieta</h2><p>O lodo já foi vencido. Você pode voltar a Lira com o fragmento ou continuar explorando a clareira.</p><button className="button button-outline" type="button" onClick={() => setDialog(null)}>Continuar</button></>
            ) : (
              <><h2 id="adventure-dialog-title">Você precisa se recuperar</h2><p>Seu personagem está sem pontos de vida. Volte ao acampamento para descansar antes de tentar outro encontro.</p><button className="button button-primary" type="button" onClick={restAtCamp}><Moon size={16} /> Descansar no acampamento</button></>
            )}
          </section>
        </div>
      )}

      {combat && (
        <div className="adventure-modal-backdrop combat-backdrop">
          <section className="adventure-dialog combat-dialog" role="dialog" aria-modal="true" aria-labelledby="combat-dialog-title">
            {combat.phase !== 'active' && <button className="adventure-dialog-close" type="button" onClick={() => setCombat(null)} aria-label="Fechar combate"><X size={18} /></button>}
            <span className="eyebrow">ENCONTRO · RODADA {combat.round}</span>
            <h2 id="combat-dialog-title">{combat.phase === 'victory' ? 'Vitória na margem!' : combat.phase === 'defeat' ? 'Você caiu na trilha' : 'Lodo do Brejo de Varda'}</h2>
            <p>{combat.phase === 'victory' ? 'O lodo se desfaz e deixa um fragmento de âmbar para trás.' : combat.phase === 'defeat' ? 'O encontro terminou. O fragmento continua com o lodo; descanse e tente outra vez.' : `Iniciativa ${combat.heroInitiative} contra ${combat.slimeInitiative}. ${combat.turn === 'hero' ? 'Sua vez de atacar.' : 'O lodo prepara sua investida.'}`}</p>
            <div className="combat-bars">
              <div><span>VOCÊ</span><strong>{combat.heroHp}/{combat.heroMaxHp} HP</strong><div className="combat-bar"><i style={{ width: `${Math.max(0, combat.heroHp / combat.heroMaxHp * 100)}%` }} /></div></div>
              <div><span>LODO</span><strong>{combat.slimeHp}/{combat.slimeMaxHp} HP</strong><div className="combat-bar combat-bar-slime"><i style={{ width: `${Math.max(0, combat.slimeHp / combat.slimeMaxHp * 100)}%` }} /></div></div>
            </div>
            <div className="combat-log" aria-live="polite">{combatLog.slice(-4).map((line, index) => <p key={`${index}-${line}`}>{line}</p>)}</div>
            {combat.phase === 'active' ? (
              <button className="button button-primary combat-action" type="button" onClick={resolveCombatAction}>
                <Swords size={16} /> {combat.turn === 'hero' ? 'Rolar ataque D20' : 'Resolver turno do lodo'}
              </button>
            ) : combat.phase === 'defeat' ? (
              <button className="button button-primary combat-action" type="button" onClick={restAtCamp}><Moon size={16} /> Recuperar no acampamento</button>
            ) : (
              <button className="button button-primary combat-action" type="button" onClick={() => setCombat(null)}><Sparkles size={16} /> Voltar à clareira</button>
            )}
            <p className="combat-disclaimer">Rolagens e combate desta prévia são locais; nenhum resultado é validado por servidor.</p>
          </section>
        </div>
      )}
    </main>
  );
}
