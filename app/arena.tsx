'use client';
import { useEffect, useRef, useState } from 'react';
import {
  Shield,
  Swords,
  Eye,
  Shuffle,
  Volume2,
  VolumeX,
  Clock3,
  Sparkles,
  ChevronRight,
  Layers,
  History,
  Hand,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import Effects from './effects-panel';
import { useTableMotion } from './table-motion';
import { useTavernMusic } from './tavern-music';
import { BattlePanel, BattleNotice } from './battle-panel';
import ResponseTools from './response-tools';
import BabylonTable from './babylon-table';
import TableFeedback from './table-feedback';
import InitiativeBanner from './initiative-banner';
import CombatLines from './combat-lines';
import type { Card, Player, Room } from './page';

const zones: Record<string, string> = {
  ataque: 'Ataque',
  defensa: 'Defensa',
  apoyo: 'Apoyo',
  reserva: 'Reserva',
  pagado: 'Oro pagado',
  castillo: 'Castillo',
  cementerio: 'Cementerio',
  destierro: 'Destierro',
  mano: 'Mano',
};
const phases = [
  'Agrupación',
  'Vigilia',
  'Ataque',
  'Bloqueo',
  'Guerra de Talismanes',
  'Asignación de daño',
  'Final',
];
const phaseLabel = (phase: string) =>
  phase === 'Asignación de daño' || phase === 'Final' ? 'Daño / Final' : phase;
type Act = (a: Record<string, unknown>) => Promise<Room | undefined>;
function Pick({
  label,
  value,
  options,
  onChange,
  disabled = false,
}: {
  label: string;
  value: string;
  options: Record<string, string>;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <label className="arena-pick">
      {label}
      <Select
        value={value}
        onValueChange={(v) => {
          if (v) onChange(v);
        }}
        disabled={disabled}
      >
        <SelectTrigger aria-label={label}>
          <SelectValue>{options[value] || 'Elegir'}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {Object.entries(options).map(([v, l]) => (
            <SelectItem key={v} value={v}>
              {l}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  );
}
export default function Arena({
  room,
  act,
  busy,
  onDeck,
  onEdit,
  onCreate,
  onInvite,
}: {
  room: Room;
  act: Act;
  busy: boolean;
  onDeck: () => void;
  onEdit: (c: Card) => void;
  onCreate: () => void;
  onInvite: (watch?: boolean) => void;
}) {
  const music = useTavernMusic();
  const [battleOpen, setBattleOpen] = useState(false);
  const [battleTarget,setBattleTarget] = useState<string | null>(null);
  const [requestMode, setRequestMode] = useState('all');
  const [costFilter, setCostFilter] = useState('');
  const [handWarning, setHandWarning] = useState(false);
  const [handOpen, setHandOpen] = useState(false);
  const [table3d, setTable3d] = useState(true);
  const [hudPanel, setHudPanel] = useState<string | null>(null);
  const [blockMode, setBlockMode] = useState(false);
  const [blockSource, setBlockSource] = useState<string | null>(null);
  const [enlarged, setEnlarged] = useState(false);
  const me = room.players.find((p) => p.id === room.me),
    spectator = !me;
  const [selected, setSelected] = useState<{
    id: string;
    player: string;
  } | null>(null);
  const [pile, setPile] = useState<{ player: string; zone: string } | null>(
    null,
  );
  const [logOpen, setLogOpen] = useState(false),
    [timerOpen, setTimerOpen] = useState(false);
  const [amount, setAmount] = useState(1),
    [reason, setReason] = useState('Consulta por efecto');
  const [search, setSearch] = useState(''),
    [chosen, setChosen] = useState<string[]>([]);
  const [recipient, setRecipient] = useState(''),
    [destination, setDestination] = useState('mano');
  const [focus, setFocus] = useState('all'),
    [note, setNote] = useState(''),
    [seconds, setSeconds] = useState(room.timer.duration),
    [timerMode, setTimerMode] = useState(room.timer.mode || 'turn');
  const [now, setNow] = useState(0);
  const [drag, setDrag] = useState<{
    card: Card;
    player: string;
    x: number;
    y: number;
  } | null>(null);
  const gesture = useRef<{
    card: Card;
    player: string;
    x: number;
    y: number;
    moved: boolean;
  } | null>(null);
  const suppressClick = useRef(false);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { root, sound, setSound, play, reduced } = useTableMotion(
    room.revision,
    room.log[0]?.id + ' ' + room.log[0]?.message,
  );
  const initiativeSound = useRef('');
  useEffect(() => {
    const event = room.initiative;
    if (!event) return;
    const round = Math.min(
      event.rounds.length - 1,
      Math.max(0, Math.floor((now - event.startedAt) / 2800)),
    );
    const key = `${event.id}:${round}`;
    if (initiativeSound.current === key) return;
    initiativeSound.current = key;
    play('dice');
  }, [room.initiative, now, play]);
  const timeOffset = useRef(0);
  useEffect(() => {
    timeOffset.current = room.serverTime - Date.now();
  }, [room.serverTime]);
  useEffect(() => {
    const tick = () => setNow(Date.now() + timeOffset.current);
    tick();
    const t = setInterval(tick, 250);
    return () => clearInterval(t);
  }, []);
  const remaining =
    room.timer?.deadline === null
      ? room.timer.remaining
      : Math.max(0, (room.timer?.deadline || 0) - now);
  const displaySeconds = Math.ceil(remaining / 1000);
  const clock = `${Math.floor(displaySeconds / 60)
    .toString()
    .padStart(2, '0')}:${(displaySeconds % 60).toString().padStart(2, '0')}`;
  const alertedDeadline = useRef<number | null>(null);
  useEffect(() => {
    if (
      room.timer.deadline !== null &&
      remaining === 0 &&
      alertedDeadline.current !== room.timer.deadline
    ) {
      alertedDeadline.current = room.timer.deadline;
      play('alarm');
    }
  }, [remaining, room.timer.deadline, play]);
  const incoming = room.requests.find((r) => r.owner === room.me);
  const owners = Object.fromEntries(room.players.map((p) => [p.id, p.name]));
  const owner = room.players.find((p) => p.id === selected?.player);
  const card =
    owner?.cards.find((c) => c.id === selected?.id && !c.hidden) ||
    (room.inspection?.owner === selected?.player
      ? room.privateCards.find((c) => c.id === selected?.id)
      : undefined);
  const pileOwner = room.players.find((p) => p.id === pile?.player);
  const hasInspection =
    room.inspection?.owner === pile?.player &&
    room.inspection?.zone === pile?.zone;
  const pileCards = hasInspection
    ? room.privateCards
    : pileOwner?.cards.filter((c) => c.zone === pile?.zone) || [];
  const [castleDraft, setCastleDraft] = useState<{
    key: string;
    ids: string[];
  }>({ key: '', ids: [] });
  const consultationKey = `${pile?.player}:${pile?.zone}:${room.privateCards.map((c) => c.id).join(',')}`;
  const castleOrder =
    castleDraft.key === consultationKey ? castleDraft.ids : [];
  const setCastleOrder = (ids: string[]) =>
    setCastleDraft({ key: consultationKey, ids });
  const orderedCards = castleOrder.length
    ? [...pileCards].sort(
        (a, b) => castleOrder.indexOf(a.id) - castleOrder.indexOf(b.id),
      )
    : pileCards;
  const canOrder =
    hasInspection &&
    pile?.player === room.me &&
    pile?.zone === 'castillo' &&
    !spectator;
  const [placingCard, setPlacingCard] = useState<string | null>(null);
  const consultationGesture = useRef<{
    id: string;
    x: number;
    y: number;
    moved: boolean;
  } | null>(null);
  const consultationClick = useRef(false);
  async function placeCastle(source: string, target: string) {
    const ids = orderedCards.map((c) => c.id),
      a = ids.indexOf(source),
      b = ids.indexOf(target);
    setPlacingCard(null);
    if (a < 0 || b < 0 || a === b || busy) return;
    [ids[a], ids[b]] = [ids[b], ids[a]];
    setCastleOrder(ids);
    if (await act({ type: 'orderCastle', ids })) {
      setCastleOrder([]);
      play('drop');
    }
  }
  const visible = orderedCards.filter(
    (c) =>
      !c.hidden &&
      (costFilter === '' || c.cost === Number(costFilter)) &&
      `${c.name} ${c.type} ${c.race}`
        .toLocaleLowerCase()
        .includes(search.toLocaleLowerCase()),
  );
  const selectedIds = chosen.filter((id) => visible.some((c) => c.id === id));
  const locked =
    !!pile &&
    (pile.zone === 'castillo' ||
      (pile.zone === 'mano' && pile.player !== room.me)) &&
    !hasInspection;
  const pending = room.requests.some(
    (r) =>
      r.actor === room.me &&
      r.owner === pile?.player &&
      r.zone === pile?.zone &&
      r.kind === 'look',
  );
  const openPile = (p: Player, z: string) => {
    setPile({ player: p.id, zone: z });
    setSelected(null);
    setChosen([]);
    setSearch('');
    setCostFilter('');
    setRecipient(room.me || p.id);
  };
  const move = async (c: Card, p: string, z: string, to = room.me || p) => {
    const result = await act({
      type: 'freeMove',
      cardId: c.id,
      sourcePlayerId: p,
      recipient: to,
      zone: z,
    });
    if (result) setSelected(null);
    return result;
  };
  async function look(mode: 'all' | 'top') {
    if (!pile) return;
    await act({
      type: pile.player === room.me ? 'look' : 'requestLook',
      playerId: pile.player,
      zone: pile.zone,
      mode,
      count: amount,
      reason: reason.trim() || 'Consulta por efecto',
    });
  }
  async function batch(operation: string) {
    if (!pile || !selectedIds.length) return;
    if (operation === 'move') {
      for (const id of selectedIds) {
        const c = visible.find((c) => c.id === id)!;
        if (
          !(await move(c, pile.player, destination, recipient || pile.player))
        )
          break;
      }
    } else {
      await act({
        type: pile.player === room.me ? 'effect' : 'requestEffect',
        playerId: pile.player,
        ids: selectedIds,
        operation,
        reason: reason.trim() || 'Efecto de mesa libre',
      });
    }
    setChosen([]);
  }
  function face(c: Card, p: Player, small = false, draggable = true) {
    const hidden = !!c.hidden;
    return (
      <button
        key={c.id}
        className={`tcg-card ${hidden ? 'card-back' : `tcg-${c.type}`} ${small ? 'mini' : ''}`}
        data-motion-card={draggable ? c.id : undefined}
        data-owner={p.id}
        data-card-target={!hidden ? c.id : undefined}
        data-card-player={p.id}
        aria-label={
          hidden
            ? 'Carta oculta — solicitar consulta'
            : `${c.name}, ${c.type}, fuerza ${c.strength}`
        }
        title={hidden ? 'Carta oculta' : c.name}
        onPointerDown={(e) => {
          if (hidden || spectator || !draggable || e.button !== 0) return;
          gesture.current = {
            card: c,
            player: p.id,
            x: e.clientX,
            y: e.clientY,
            moved: false,
          };
          e.currentTarget.setPointerCapture(e.pointerId);
          suppressClick.current = false;
          if (e.pointerType === 'touch') {
            holdTimer.current = setTimeout(() => {
              if (!gesture.current?.moved) {
                suppressClick.current = true;
                setSelected({ id: c.id, player: p.id });
                setPile(null);
              }
            }, 520);
          }
        }}
        onPointerMove={(e) => {
          const g = gesture.current;
          if (!g || !draggable) return;
          if (!g.moved && Math.hypot(e.clientX - g.x, e.clientY - g.y) < 7)
            return;
          if (!g.moved) play('pick');
          if (holdTimer.current) clearTimeout(holdTimer.current);
          g.moved = true;
          suppressClick.current = true;
          setDrag({
            card: g.card,
            player: g.player,
            x: e.clientX,
            y: e.clientY,
          });
        }}
        onPointerCancel={() => {
          if (holdTimer.current) clearTimeout(holdTimer.current);
          gesture.current = null;
          setDrag(null);
        }}
        onPointerUp={(e) => {
          if (holdTimer.current) clearTimeout(holdTimer.current);
          const g = gesture.current;
          gesture.current = null;
          setDrag(null);
          if (!g?.moved) return;
          const hit = document.elementFromPoint(e.clientX, e.clientY);
          const host = hit?.closest<HTMLElement>('[data-card-target]');
          if (
            g.card.type === 'Arma' &&
            g.player === room.me &&
            host?.dataset.cardPlayer === room.me &&
            host.dataset.cardTarget !== g.card.id
          ) {
            const h = me?.cards.find((c) => c.id === host.dataset.cardTarget);
            if (
              h?.type === 'Aliado' &&
              ['ataque', 'defensa'].includes(h.zone)
            ) {
              void act({ type: 'attach', cardId: g.card.id, hostId: h.id });
              return;
            }
          }
          const target = hit?.closest<HTMLElement>('[data-drop-zone]');
          if (target)
            void move(
              g.card,
              g.player,
              target.dataset.dropZone!,
              target.dataset.dropPlayer!,
            );
        }}
        onClick={() => {
          if (suppressClick.current) {
            suppressClick.current = false;
            return;
          }
          if (hidden) {
            openPile(p, c.zone);
            return;
          }
          if (blockMode) {
            if (c.zone === 'ataque' && p.id !== room.me) {
              setBlockSource(c.id);
              return;
            }
            if (c.zone === 'defensa' && p.id === room.me && blockSource) {
              void act({ type: 'block', cardId: c.id, attacker: blockSource });
              setBlockSource(null);
              return;
            }
          }
          setSelected({ id: c.id, player: p.id });
          setPile(null);
        }}
        onDoubleClick={() => {
          if (hidden || spectator || p.id !== room.me || c.zone !== 'mano') return;
          const zone = c.type === 'Aliado' ? 'defensa' : c.type === 'Oro' ? 'reserva' : c.type === 'Talismán' ? 'cementerio' : 'apoyo';
          void move(c, p.id, zone, p.id);
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          if (!hidden) {
            setSelected({ id: c.id, player: p.id });
            setPile(null);
          }
        }}
      >
        {hidden ? (
          <>
            <Shield size={22} />
            <span>IMPERIO</span>
            <i>MITOS · LEYENDAS</i>
          </>
        ) : c.image ? (
          <><img className="card-scan" src={c.image} alt={c.name} draggable={false}/><span className="scan-stats">{c.cost} ◈ {c.type === 'Aliado' ? `· ${c.strength} ⚔` : ''}</span></>
        ) : (
          <>
            <div className="tcg-heading">
              <span>{c.type}</span>
              <b>{c.type === 'Oro' ? '◈' : c.cost}</b>
            </div>
            <strong>{c.name}</strong>
            <div className="tcg-emblem">
              {c.type === 'Aliado' ? (
                <Swords />
              ) : c.type === 'Oro' ? (
                <span>◈</span>
              ) : c.type === 'Arma' ? (
                <Shield />
              ) : (
                <Sparkles />
              )}
            </div>
            <small>{c.race || c.type}</small>
            <div className="tcg-foot">
              <span>
                {c.revealed
                  ? 'Mostrada'
                  : c.attachedTo
                    ? 'Equipada'
                    : 'IMPERIO'}
              </span>
              {c.type === 'Aliado' && <b>{c.strength} ⚔</b>}
            </div>
          </>
        )}
      </button>
    );
  }
  function zone(p: Player, z: string) {
    const cards = p.cards.filter((c) => c.zone === z && !c.attachedTo);
    const stack = ['castillo', 'cementerio', 'destierro'].includes(z);
    return (
      <section
        key={z}
        className={`arena-zone az-${z} ${drag ? 'drop-ready' : ''}`}
        data-drop-zone={spectator ? undefined : z}
        data-drop-player={p.id}
      >
        <header>
          <button onClick={() => openPile(p, z)}>{zones[z]}</button>
          <span>{cards.length}</span>
          {z === 'ataque' && p.id === room.me && !spectator && (
            <button
              className="attack-total"
              onClick={() => setBattleOpen(true)}
            >
              Atacar con{' '}
              {cards
                .filter((c) => c.type === 'Aliado')
                .reduce((n, c) => n + c.strength, 0)}{' '}
              ⚔
            </button>
          )}
        </header>
        {stack ? (
          <button
            className={`pile-deck ${z === 'castillo' ? 'deck-back' : ''}`}
            data-pile-owner={z === 'castillo' ? p.id : undefined}
            onClick={() => openPile(p, z)}

            aria-label={`Abrir ${zones[z]} de ${p.name}, ${cards.length} cartas`}
          >
            <Layers size={20} />
            <strong>{cards.length}</strong>
            <span>{z === 'castillo' ? 'Abrir / robar' : 'Ver cartas'}</span>
          </button>
        ) : (
          <div className="arena-cards">
            {cards.map((c) => (
              <div className="tcg-stack" key={c.id}>
                {face(c, p)}
                {p.cards
                  .filter((w) => w.attachedTo === c.id)
                  .map((w) => face(w, p, true))}
              </div>
            ))}
            {!cards.length && (
              <span className="drop-hint">
                {spectator ? 'Vacío' : 'Soltar aquí'}
              </span>
            )}
          </div>
        )}
      </section>
    );
  }
  return (
    <div ref={root} className={`arena fixed-table ${table3d ? 'babylon-arena immersive-table' : ''} ${hudPanel ? 'hud-' + hudPanel : ''} ${drag ? 'is-dragging' : ''}`}>
      {table3d && <>
        <TableFeedback room={room} play={play} reduced={reduced}/>
        <InitiativeBanner room={room}/>
        {!room.started&&room.host===room.me&&room.players.length===room.capacity&&room.players.every(p=>p.ready||p.deckLoaded)&&<button className="start-d20" disabled={busy} onClick={()=>void act({type:'start'})}>Comenzar · Tirar d20</button>}
        <nav className="table-dock" aria-label="Controles de la partida">
          {[['menu','☰','Menú'],['setup','♧','Preparación'],['actions','⚔','Acciones'],['turn','◷','Turno y sonido']].map(([id,icon,label])=><button key={id} title={label} aria-label={label} aria-expanded={hudPanel===id} className={hudPanel===id?'active':''} onClick={()=>setHudPanel(hudPanel===id?null:id)}><span>{icon}</span><small>{label}</small></button>)}
          <button title="Ver mi mano" aria-label="Ver mi mano" disabled={!me} onClick={()=>me&&openPile(me,'mano')}><Eye size={21}/><small>Mi mano</small></button>
          {hudPanel && <button aria-label="Cerrar panel" onClick={()=>setHudPanel(null)}>×</button>}
        </nav>
        <div className="table-room-badge">MESA IMPERIO <span>{room.code}</span></div>
        <div className="table-turn-hud"><button onClick={()=>setHudPanel(hudPanel==='turn'?null:'turn')}><small>{room.players.find(p=>p.id===room.active)?.name} · Turno {room.turn}</small><strong>{phaseLabel(room.phase)}</strong><span>{clock}</span></button><button disabled={busy||spectator||room.active!==room.me} onClick={()=>{if((me?.cards.filter(c=>c.zone==='mano').length||0)>8)setHandWarning(true);else void act({type:'next'});}}>Pasar turno ›</button></div>
      </>}
      <div className="arena-toolbar">
        <div className="arena-room">
          <span>MESA LIBRE · {room.code}</span>
          <strong>
            {room.players.find((p) => p.id === room.active)?.name}
            <small> · Turno {room.turn}</small>
          </strong>
        </div>
        <Pick
          label="Fase"
          value={room.phase}
          options={Object.fromEntries(
            phases.map((p) => [
              p,
              p === 'Vigilia' ? 'Vigilia · preparar mesa' : phaseLabel(p),
            ]),
          )}
          onChange={(phase) => void act({ type: 'phase', phase })}
          disabled={spectator || busy}
        />
        <button
          className={`timer-pill ${remaining === 0 ? 'time-up' : ''}`}
          onClick={() => setTimerOpen(true)}
        >
          <Clock3 size={17} />
          {clock}
        </button>
        <button
          aria-label={sound ? 'Desactivar sonidos' : 'Activar sonidos'}
          title={sound ? 'Desactivar sonidos' : 'Activar sonidos'}
          onClick={() => setSound(!sound)}
        >
          {sound ? <Volume2 size={18} /> : <VolumeX size={18} />}
        </button>
        <button
          onClick={music.toggle}
          aria-pressed={music.playing}
          title="Música de taberna"
        >
          {music.playing ? '♫ Pausar' : '♫ Música'}
        </button>
        <button onClick={() => setLogOpen(true)} title="Bitácora">
          <History size={18} />
        </button>
        <button
          disabled={busy || spectator || room.active !== room.me}
          className="pass-turn"
          onClick={() => {
            if ((me?.cards.filter((c) => c.zone === 'mano').length || 0) > 8)
              setHandWarning(true);
            else void act({ type: 'next' });
          }}
        >
          Pasar turno <ChevronRight size={18} />
        </button>
      </div>
      {!spectator &&
        me &&
        me.cards.filter((c) => c.zone === 'mano').length > 8 && (
          <output className="hand-limit-warning">
            <span>
              Tienes {me.cards.filter((c) => c.zone === 'mano').length} cartas
              en la mano: {me.cards.filter((c) => c.zone === 'mano').length - 8}{' '}
              sobre el límite. Revisa tu robo de fin de turno y descarta el
              exceso antes de terminar.
            </span>
            <button
              onClick={() => {
                openPile(me, 'mano');
                setDestination('cementerio');
              }}
            >
              Revisar mano
            </button>
          </output>
        )}
      {!room.started && (
        <div className="arena-setup">
          <span>Preparación de la partida</span>
          <button disabled={spectator || me?.ready} onClick={onDeck}>
            Cargar mazo
          </button>
          <button onClick={() => setTimerOpen(true)}>
            Opciones de partida
          </button>
          <button
            disabled={busy || spectator || me?.ready}
            onClick={() => void act({ type: 'setup' })}
          >
            Repartir 8
          </button>
          <button
            disabled={busy || spectator || !me?.ready}
            onClick={() => void act({ type: 'mulligan' })}
          >
            Mulligan
          </button>
          <button
            disabled={busy || spectator || !me?.ready || me?.houseMulligan}
            onClick={() => void act({ type: 'houseMulligan' })}
          >
            Volver a 8
          </button>
          {room.host === room.me && (
            <button
              disabled={
                busy ||
                room.players.length < room.capacity ||
                room.players.some((p) => !p.ready && !p.deckLoaded)
              }
              onClick={() => void act({ type: 'start' })}
            >
              Comenzar
            </button>
          )}
          <button onClick={() => onInvite()}>Invitar</button>
          <button onClick={() => onInvite(true)}>Espectador</button>
        </div>
      )}
      <div className="arena-viewbar">
        <Pick
          label="Vista"
          value={focus}
          options={{ all: 'Todas las mesas', ...owners }}
          onChange={setFocus}
        />
        <span>
          <Hand size={14} /> Arrastra para jugar · Clic para ver acciones
        </span>
        {!table3d && <button onClick={() => setTable3d(true)}>Reintentar mesa 3D</button>}
        {!spectator && <button className={blockMode ? 'block-mode active' : 'block-mode'} onClick={() => { setBlockMode(!blockMode); setBlockSource(null); }}>
          {blockMode ? (blockSource ? 'Bloquear: elige defensor' : 'Bloquear: elige atacante') : '⌁ Bloqueo'}
        </button>}
        {table3d && me && <button onClick={() => setBattleOpen(true)}>Atacar · {me.cards.filter(c=>c.zone==='ataque'&&c.type==='Aliado').reduce((sum,c)=>sum+c.strength,0)} ⚔</button>}
        {me && (
          <button
            disabled={busy}
            onClick={() => void act({ type: 'freeDraw', count: 1 })}
          >
            Robar <Layers size={15} />
          </button>
        )}
        {me && (
          <button disabled={busy} onClick={() => void act({ type: 'shuffle' })}>
            <Shuffle size={15} /> Barajar
          </button>
        )}
      </div>
      {table3d ? <BabylonTable room={room} focus={focus} busy={busy} fallback={() => setTable3d(false)} callbacks={{
        select: (c,p) => {
          if(blockMode){
            if(c.zone==='ataque' && p.id!==room.me){setBlockSource(c.id);return;}
            if(c.zone==='defensa' && p.id===room.me && blockSource){void act({type:'block',cardId:c.id,attacker:blockSource});setBlockSource(null);return;}
          }
          setSelected({id:c.id,player:p.id});setPile(null);
        },
        pile: openPile,
        move: (c,p,z,to) => move(c,p.id,z,to.id),
        playCard: (c,p) => {if(busy||p.id!==room.me)return;
          if(c.zone==='mano')void move(c,p.id,c.type==='Aliado'?'defensa':c.type==='Oro'?'reserva':c.type==='Talismán'?'cementerio':'apoyo',p.id);
          else if(c.type==='Oro'&&['reserva','pagado'].includes(c.zone))void move(c,p.id,c.zone==='reserva'?'pagado':'reserva',p.id);
          else {setSelected({id:c.id,player:p.id});setPile(null);}
        },
        draw: () => {if(!busy&&me)void act({type:'freeDraw',count:1});},
        shuffle: () => {if(!busy&&me)void act({type:'shuffle'});},
        attack: (p) => {setBattleTarget(p.id);setBattleOpen(true);},
        attach: (c,h) => {if(!busy)void act({type:'attach',cardId:c.id,hostId:h.id});},
        sound: play,
      }}/> : <>
      <div
        className={`arena-boards players-${focus === 'all' ? room.players.length : 1}`}
      >
        {room.players
          .filter((p) => focus === 'all' || focus === p.id)
          .map((p) => (
            <article
              key={p.id}
              className={`arena-board ${p.id === room.me ? 'self' : ''} ${p.id === room.active ? 'active-board' : ''}`}
            >
              <header className="arena-player">
                <Shield size={18} />
                <strong>{p.name}</strong>
                <span>
                  {p.id === room.me ? 'Tú' : spectator ? 'Jugador' : 'Rival'} ·{' '}
                  {p.ready ? 'Preparado' : 'Preparando'}
                </span>
                {p.id !== room.me && <button onClick={() => openPile(p, 'mano')}>Mano · {p.cards.filter(c => c.zone === 'mano').length}</button>}
                {p.id === room.active && <i>SU TURNO</i>}
              </header>
              <div className="arena-battle">
                {zone(p, 'ataque')}
                {zone(p, 'defensa')}
              </div>
              <div className="arena-support">
                {zone(p, 'apoyo')}
                {zone(p, 'pagado')}
                {zone(p, 'reserva')}
                {p.id === room.me && !spectator && (
                  <button
                    className="quick-gold"
                    disabled={busy}
                    onClick={() => void act({ type: 'groupGold' })}
                  >
                    ↧ Agrupar oros
                  </button>
                )}
              </div>
              <div className="arena-piles">
                {zone(p, 'castillo')}
                {zone(p, 'cementerio')}
                {zone(p, 'destierro')}
              </div>
            </article>
          ))}
      </div>
      <CombatLines revision={room.revision} blocks={room.players.flatMap(player => player.cards.filter(card => card.blocks).map(card => ({ defender: card.id, attacker: card.blocks! })))} />
      {me && <div className={`hand-drawer ${handOpen ? 'open' : ''} ${drag ? 'dragging-hand' : ''}`}>
        <button className="hand-drawer-toggle" aria-expanded={handOpen} aria-controls="my-hand-tray" onClick={() => setHandOpen(!handOpen)} data-drop-zone="mano" data-drop-player={me.id}>
          {handOpen ? '⌄ Ocultar mano' : '⌃ Mi mano'} · {me.cards.filter(c => c.zone === 'mano').length} cartas
        </button>
        <div id="my-hand-tray" className="hand-drawer-content" inert={!handOpen}>
          {zone(me, 'mano')}
        </div>
      </div>}
      </>}
      <div className="arena-status">
        <span>{room.log[0]?.message || 'Mesa preparada'}</span>
        <button disabled={spectator} onClick={onCreate}>
          Crear carta
        </button>
        <button
          disabled={spectator || busy}
          onClick={() => void act({ type: 'group' })}
        >
          Agrupar mis cartas
        </button>
      </div>
      {drag && (
        <div className="drag-card" style={{ left: drag.x, top: drag.y }}>
          <Shield />
          <strong>{drag.card.name}</strong>
          <small>Suelta en una zona</small>
        </div>
      )}

      <Dialog
        open={!!card && !incoming}
        onOpenChange={(v) => {
          if (!v) setSelected(null);
        }}
      >
        <DialogContent className="modal arena-detail">
          <DialogTitle>{card?.name || 'Carta'}</DialogTitle>
          <Dialog open={enlarged && !!card?.image} onOpenChange={setEnlarged}>
            <DialogContent className="modal enlarged-card-modal">
              <DialogTitle>{card?.name}</DialogTitle>
              <DialogDescription>Imagen ampliada para leer las habilidades.</DialogDescription>
              <img src={card?.image} alt={card?.name} />
              <button onClick={() => setEnlarged(false)}>Volver a la carta</button>
            </DialogContent>
          </Dialog>
          <DialogDescription>
            {owner?.name} · {card?.type} · Coste {card?.cost}{' '}
            {card?.race && `· ${card.race}`}
          </DialogDescription>
          {card && owner && (
            <>
              <div className="detail-body">
                <div className="detail-face">
                  {card.image ? <button className="detail-photo-button" aria-label="Ampliar imagen de la carta" onClick={() => setEnlarged(true)}><img src={card.image} alt={card.name}/><span>Pulsa para ampliar</span></button> : face(card, owner, false, false)}
                </div>
                <div>
                  <p className="full-effect">
                    {card.effect || 'Sin habilidad.'}
                  </p>
                  <div className="actions">
                    {card.type === 'Aliado' && (
                      <strong>Fuerza {card.strength}</strong>
                    )}
                    {!spectator && owner.id === room.me && (
                      <>
                        <button
                          disabled={busy}
                          onClick={() =>
                            void act({
                              type: 'effect',
                              ids: [card.id],
                              operation: 'strength',
                              delta: -1,
                              reason: 'Ajuste manual',
                              until: 'permanent',
                            })
                          }
                        >
                          −1
                        </button>
                        <button
                          disabled={busy}
                          onClick={() =>
                            void act({
                              type: 'effect',
                              ids: [card.id],
                              operation: 'strength',
                              delta: 1,
                              reason: 'Ajuste manual',
                              until: 'permanent',
                            })
                          }
                        >
                          +1
                        </button>
                        <button
                          onClick={() => {
                            setSelected(null);
                            onEdit(card);
                          }}
                        >
                          Editar
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
              {!spectator && (
                <>
                  <div className="actions">
                    <button
                      className="primary"
                      disabled={busy}
                      onClick={() =>
                        void move(
                          card,
                          owner.id,
                          card.type === 'Oro'
                            ? 'reserva'
                            : card.type === 'Aliado'
                              ? 'defensa'
                              : card.type === 'Talismán'
                                ? 'cementerio'
                                : 'apoyo',
                        )
                      }
                    >
                      Jugar carta
                    </button>
                    <button
                      disabled={busy}
                      onClick={() => void move(card, owner.id, 'mano')}
                    >
                      A mi mano
                    </button>
                    <button
                      disabled={busy}
                      onClick={() => void move(card, owner.id, 'cementerio')}
                    >
                      Cementerio
                    </button>
                    <button
                      disabled={busy}
                      onClick={() => void move(card, owner.id, 'destierro')}
                    >
                      Desterrar
                    </button>
                  </div>
                  <details>
                    <summary>Otras zonas</summary>
                    <div className="quick-zones">
                      <span>Mover a mi mesa</span>
                      {Object.entries(zones).map(([z, label]) => (
                        <button
                          key={z}
                          disabled={busy}
                          onClick={() => void move(card, owner.id, z)}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </details>
                  {owner.id === room.me && (
                    <div className="actions">
                      <button
                        disabled={busy}
                        onClick={() =>
                          void act({
                            type: 'effect',
                            operation: card.revealed ? 'hide' : 'reveal',
                            ids: [card.id],
                            reason: card.name,
                          })
                        }
                      >
                        <Eye size={16} />
                        {card.revealed ? 'Ocultar' : 'Mostrar a todos'}
                      </button>
                      {card.type === 'Arma' && (
                        <Pick
                          label="Equipar a"
                          value=""
                          options={Object.fromEntries(
                            me!.cards
                              .filter(
                                (c) =>
                                  c.type === 'Aliado' &&
                                  ['defensa', 'ataque'].includes(c.zone),
                              )
                              .map((c) => [c.id, c.name]),
                          )}
                          onChange={(hostId) =>
                            void act({
                              type: 'attach',
                              cardId: card.id,
                              hostId,
                            })
                          }
                        />
                      )}
                      <button
                        disabled={busy || room.active !== room.me}
                        onClick={() => {
                          if (
                            (me?.cards.filter((c) => c.zone === 'mano')
                              .length || 0) > 8
                          ) {
                            setSelected(null);
                            setHandWarning(true);
                          } else void act({ type: 'next' });
                        }}
                      >
                        Pasar turno
                      </button>
                    </div>
                  )}
                  <Effects
                    room={room}
                    act={act}
                    busy={busy}
                    selectedCard={card}
                    onCastle={() => {
                      openPile(me!, 'castillo');
                      void act({
                        type: 'look',
                        zone: 'castillo',
                        mode: 'all',
                        reason: card.name,
                      });
                    }}
                  />
                </>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!pile && !incoming}
        onOpenChange={(v) => {
          if (!v) setPile(null);
        }}
      >
        <DialogContent className="modal arena-pile-modal">
          <DialogTitle>
            {pile ? zones[pile.zone] : ''} · {pileOwner?.name}
          </DialogTitle>
          <DialogDescription>
            {locked
              ? 'Las cartas permanecen boca abajo hasta abrir una consulta.'
              : 'Selecciona cartas para moverlas, mostrarlas o barajarlas.'}
          </DialogDescription>
          {pile && (
            <>
              {!spectator &&
                pile.player === room.me &&
                pile.zone === 'castillo' && (
                  <div className="castle-menu">
                    <button
                      className="primary"
                      disabled={busy}
                      onClick={() => void act({ type: 'freeDraw', count: 1 })}
                    >
                      Robar primera
                    </button>
                    <button
                      disabled={busy}
                      onClick={() =>
                        void act({
                          type: 'castleTake',
                          edge: 'last',
                          zone: 'mano',
                          count: 1,
                        })
                      }
                    >
                      Sacar última
                    </button>
                    <button
                      disabled={busy}
                      onClick={() => void act({ type: 'shuffle' })}
                    >
                      Barajar
                    </button>
                    <button disabled={busy} onClick={() => void look('all')}>
                      Buscar carta
                    </button>
                    <button
                      disabled={busy}
                      onClick={() => void act({ type: 'revealUntil' })}
                    >
                      Mostrar hasta Aliado
                    </button>
                    <button disabled={busy} onClick={() => void look('top')}>
                      Mirar primeras {amount}
                    </button>
                    <button
                      onClick={() => {
                        openPile(me!, 'mano');
                        setDestination('castillo');
                      }}
                    >
                      Poner arriba / abajo
                    </button>
                  </div>
                )}
              {locked && !spectator && pile.player !== room.me && (
                <>
                  <div className="consult-controls">
                    <label>
                      Cuántas cartas
                      <select
                        value={requestMode}
                        onChange={(e) => setRequestMode(e.target.value)}
                      >
                        <option value="all">Todas ({pileCards.length})</option>
                        <option value="top">Sólo algunas</option>
                      </select>
                    </label>
                    {requestMode === 'top' && (
                      <label>
                        Cantidad
                        <input
                          type="number"
                          min={1}
                          max={Math.max(1, pileCards.length)}
                          value={amount}
                          onChange={(e) => setAmount(Number(e.target.value))}
                        />
                      </label>
                    )}
                  </div>
                  <button
                    className="primary"
                    disabled={busy || pending}
                    onClick={() =>
                      void look(requestMode === 'all' ? 'all' : 'top')
                    }
                  >
                    {pending
                      ? 'Esperando respuesta…'
                      : requestMode === 'all'
                        ? 'Pedir ver todas (' + pileCards.length + ')'
                        : 'Pedir ver ' + amount + ' cartas'}
                  </button>
                </>
              )}
              {!spectator && (
                <details className="more-actions">
                  <summary>Cantidad y otras acciones</summary>
                  <div className="consult-controls">
                    <label>
                      Cantidad
                      <input
                        type="number"
                        min={1}
                        max={50}
                        value={amount}
                        onChange={(e) => setAmount(Number(e.target.value))}
                      />
                    </label>
                    <label>
                      Motivo opcional
                      <input
                        value={reason}
                        maxLength={300}
                        onChange={(e) => setReason(e.target.value)}
                      />
                    </label>
                    {pile.zone === 'castillo' && pile.player === room.me && (
                      <>
                        <button
                          disabled={busy}
                          onClick={() =>
                            void act({ type: 'freeDraw', count: amount })
                          }
                        >
                          Robar {amount}
                        </button>
                        <button
                          disabled={busy}
                          onClick={() =>
                            void act({ type: 'damage', count: amount })
                          }
                        >
                          Botar {amount}
                        </button>
                        <button
                          disabled={busy}
                          onClick={() =>
                            void act({
                              type: 'castleTake',
                              edge: 'first',
                              zone: 'destierro',
                              count: amount,
                            })
                          }
                        >
                          Desterrar {amount} del tope
                        </button>
                      </>
                    )}
                    {locked &&
                      pile.player !== room.me &&
                      pile.zone === 'castillo' && (
                        <button
                          disabled={busy || pending}
                          onClick={() => void look('top')}
                        >
                          Pedir mirar primeras {amount}
                        </button>
                      )}
                  </div>
                </details>
              )}
              {hasInspection && (
                <div className="consult-banner">
                  <Eye size={16} /> Consulta privada ·{' '}
                  {room.inspection?.mode === 'top'
                    ? 'Tope en orden'
                    : 'Búsqueda por nombre'}
                  <button onClick={() => void act({ type: 'closeLook' })}>
                    Cerrar consulta
                  </button>
                </div>
              )}
              {!locked && (
                <input
                  aria-label="Buscar cartas"
                  placeholder="Buscar por nombre, tipo o raza…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              )}
              {!locked && (
                <label className="cost-filter">
                  Coste
                  <select
                    value={costFilter}
                    aria-label="Filtrar por coste"
                    onChange={(e) => setCostFilter(e.target.value)}
                  >
                    <option value="">Todos los costes</option>
                    {[
                      ...new Set(
                        pileCards.filter((c) => !c.hidden).map((c) => c.cost),
                      ),
                    ]
                      .sort((a, b) => a - b)
                      .map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                  </select>
                </label>
              )}
              <div className="pile-card-grid">
                {locked
                  ? pileCards
                      .slice(0, pile.zone === 'castillo' ? 4 : 50)
                      .map((c) => (
                        <div key={c.id} className="pile-card-choice">
                          {face(c, pileOwner!, false, false)}
                        </div>
                      ))
                  : visible.map((c) => (
                      <div
                        key={c.id}
                        data-castle-slot={canOrder ? c.id : undefined}
                        onPointerDownCapture={(e) => {
                          if (
                            !canOrder ||
                            busy ||
                            search ||
                            e.button !== 0 ||
                            !(e.target as HTMLElement).closest('.tcg-card')
                          )
                            return;
                          consultationClick.current = false;
                          consultationGesture.current = {
                            id: c.id,
                            x: e.clientX,
                            y: e.clientY,
                            moved: false,
                          };
                          e.currentTarget.setPointerCapture(e.pointerId);
                        }}
                        onPointerMoveCapture={(e) => {
                          const g = consultationGesture.current;
                          if (
                            !g ||
                            Math.hypot(e.clientX - g.x, e.clientY - g.y) < 7
                          )
                            return;
                          e.stopPropagation();
                          if (!g.moved) play('pick');
                          g.moved = true;
                          consultationClick.current = true;
                          setDrag({
                            card: orderedCards.find((x) => x.id === g.id)!,
                            player: pile.player,
                            x: e.clientX,
                            y: e.clientY,
                          });
                        }}
                        onPointerUpCapture={(e) => {
                          const g = consultationGesture.current;
                          consultationGesture.current = null;
                          if (!g?.moved) return;
                          setTimeout(() => {
                            consultationClick.current = false;
                          }, 0);
                          e.stopPropagation();
                          setDrag(null);
                          const target = document
                            .elementFromPoint(e.clientX, e.clientY)
                            ?.closest<HTMLElement>('[data-castle-slot]')
                            ?.dataset.castleSlot;
                          if (target) void placeCastle(g.id, target);
                        }}
                        onPointerCancelCapture={() => {
                          consultationGesture.current = null;
                          setDrag(null);
                        }}
                        onClickCapture={(e) => {
                          if (consultationClick.current) {
                            e.stopPropagation();
                            consultationClick.current = false;
                            return;
                          }
                          if (
                            canOrder &&
                            placingCard &&
                            (e.target as HTMLElement).closest('.tcg-card')
                          ) {
                            e.stopPropagation();
                            void placeCastle(placingCard, c.id);
                          }
                        }}
                        className={`pile-card-choice ${selectedIds.includes(c.id) ? 'picked' : ''}`}
                      >
                        {face(c, pileOwner!, false, false)}
                        {!spectator && (
                          <>
                            <button
                              className="select-card"
                              aria-pressed={selectedIds.includes(c.id)}
                              onClick={() =>
                                setChosen((old) =>
                                  old.includes(c.id)
                                    ? old.filter((id) => id !== c.id)
                                    : [...old, c.id],
                                )
                              }
                            >
                              {selectedIds.includes(c.id)
                                ? '✓ Elegida'
                                : 'Seleccionar'}
                            </button>
                            {canOrder && placingCard && (
                              <button
                                className="select-card"
                                disabled={busy}
                                onClick={() =>
                                  void placeCastle(placingCard, c.id)
                                }
                              >
                                Colocar aquí ·{' '}
                                {orderedCards.findIndex((x) => x.id === c.id) +
                                  1}
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    ))}
              </div>
              {!pileCards.length && <p>Esta zona está vacía.</p>}
              {!locked && !spectator && (
                <div className="pile-footer">
                  <div className="pile-main-actions">
                    <span>
                      {selectedIds.length
                        ? selectedIds.length + ' elegidas'
                        : 'Selecciona una carta'}
                    </span>
                    <select
                      aria-label="Destino de cartas"
                      value={destination}
                      onChange={(e) => setDestination(e.target.value)}
                    >
                      {Object.entries(zones).map(([id, label]) => (
                        <option key={id} value={id}>
                          {label}
                        </option>
                      ))}
                    </select>
                    <button
                      className="primary"
                      disabled={busy || !selectedIds.length}
                      onClick={() => void batch('move')}
                    >
                      Mover seleccionadas
                    </button>
                    {canOrder && (
                      <button
                        disabled={busy || selectedIds.length !== 1}
                        onClick={() =>
                          setPlacingCard(placingCard ? null : selectedIds[0])
                        }
                      >
                        {placingCard ? 'Cancelar' : 'Cambiar posición'}
                      </button>
                    )}
                    <details className="pile-more">
                      <summary>Más acciones</summary>
                      <div className="pile-more-menu">
                        <button
                          onClick={() => setChosen(visible.map((c) => c.id))}
                        >
                          Seleccionar todas
                        </button>
                        <button onClick={() => setChosen([])}>
                          Limpiar selección
                        </button>
                        <label>
                          Mesa de destino
                          <select
                            value={recipient || pile.player}
                            onChange={(e) => setRecipient(e.target.value)}
                          >
                            {Object.entries(owners).map(([id, name]) => (
                              <option key={id} value={id}>
                                {name}
                              </option>
                            ))}
                          </select>
                        </label>
                        {(['reveal', 'shuffle', 'top', 'bottom'] as const).map(
                          (op, i) => (
                            <button
                              key={op}
                              disabled={busy || !selectedIds.length}
                              onClick={() => void batch(op)}
                            >
                              {
                                [
                                  'Mostrar',
                                  'Devolver y barajar',
                                  'Poner al tope',
                                  'Poner al fondo',
                                ][i]
                              }
                            </button>
                          ),
                        )}
                      </div>
                    </details>
                  </div>
                  {canOrder && (
                    <small>
                      {placingCard
                        ? 'Pulsa el lugar de destino.'
                        : 'Arrastra para intercambiar posiciones. Se guarda automáticamente.'}
                    </small>
                  )}
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      <BattlePanel
        key={(battleTarget||'all')+String(battleOpen)}
        preferredTarget={battleTarget||undefined}
        room={room}
        open={battleOpen}
        onOpenChange={setBattleOpen}
        act={act}
        busy={busy}
      />
      <BattleNotice room={room} play={() => play('attack')} />
      <ResponseTools room={room} act={act} busy={busy} play={play} />
      <Dialog open={handWarning && !incoming} onOpenChange={setHandWarning}>
        <DialogContent className="modal">
          <DialogTitle>Revisa tu mano antes de terminar</DialogTitle>
          <DialogDescription>
            Tienes {me?.cards.filter((c) => c.zone === 'mano').length || 0}{' '}
            cartas. Si ya resolviste tu robo de fin de turno, descarta hasta
            quedar con ocho. La mesa no descarta cartas por ti.
          </DialogDescription>
          <div className="actions">
            <button
              className="primary"
              onClick={() => {
                setHandWarning(false);
                if (me) openPile(me, 'mano');
                setDestination('cementerio');
              }}
            >
              Elegir cartas para descartar
            </button>
            <button onClick={() => setHandWarning(false)}>
              Seguir en mi turno
            </button>
            <button
              disabled={busy || room.active !== room.me}
              onClick={async () => {
                if (await act({ type: 'next' })) setHandWarning(false);
              }}
            >
              Pasar de todos modos
            </button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={!!incoming} onOpenChange={() => {}}>
        <DialogContent className="modal request-modal" showCloseButton={false}>
          <DialogTitle>
            <Eye />{' '}
            {incoming?.kind === 'look'
              ? 'Te piden consultar cartas'
              : 'Te proponen un efecto'}
          </DialogTitle>
          <DialogDescription>
            {incoming ? owners[incoming.actor] : ''} espera tu respuesta.
          </DialogDescription>
          <p>{incoming?.reason}</p>
          <strong>
            {incoming?.kind === 'look'
              ? `${incoming.mode === 'top' ? `Sólo ${incoming.count} cartas de ` : 'Todas las cartas de '}${zones[incoming.zone || ''] || incoming.zone}`
              : `${incoming?.operation} · ${incoming?.count} cartas`}
          </strong>
          <p>
            La consulta sólo será visible para ese jugador. Puedes retirarla con
            «Cerrar consultas».
          </p>
          <div className="actions">
            <button
              className="primary"
              disabled={busy}
              onClick={() =>
                void act({
                  type:
                    incoming?.kind === 'look' ? 'grantLook' : 'approveEffect',
                  requestId: incoming?.id,
                })
              }
            >
              Aceptar
            </button>
            <button
              disabled={busy}
              onClick={() =>
                void act({ type: 'denyRequest', requestId: incoming?.id })
              }
            >
              Rechazar
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={timerOpen && !incoming} onOpenChange={setTimerOpen}>
        <DialogContent className="modal">
          <DialogTitle>Opciones de partida</DialogTitle>
          <DialogDescription>
            Elige un límite por turno o para toda la partida. Al llegar a cero
            suena una alerta; no mueve cartas ni pasa el turno.
          </DialogDescription>
          <strong className="clock-display">{clock}</strong>
          <label>
            Temporizador
            <select
              value={timerMode}
              onChange={(e) => setTimerMode(e.target.value)}
            >
              <option value="turn">Por turno</option>
              <option value="game">Partida completa</option>
            </select>
          </label>
          <label>
            <input
              type="checkbox"
              checked={sound}
              onChange={(e) => setSound(e.target.checked)}
            />{' '}
            Sonidos de la mesa
          </label>
          <label>
            Volumen de la taberna · {music.volume}%
            <input
              aria-label="Volumen de música"
              type="range"
              min="0"
              max="100"
              value={music.volume}
              onChange={(e) => music.setVolume(Number(e.target.value))}
            />
          </label>
          <button onClick={music.toggle}>
            {music.playing ? 'Pausar música' : 'Escuchar música de taberna'}
          </button>
          <label>
            Minutos
            <input
              type="number"
              min={1}
              max={180}
              value={seconds / 60}
              onChange={(e) => setSeconds(Number(e.target.value) * 60)}
            />
          </label>
          <div className="actions">
            {!room.started && (
              <button
                disabled={spectator || busy}
                onClick={async () => {
                  if (
                    await act({
                      type: 'timer',
                      command: 'configure',
                      seconds,
                      mode: timerMode,
                    })
                  )
                    setTimerOpen(false);
                }}
              >
                Guardar para el comienzo
              </button>
            )}
            <button
              disabled={spectator || busy}
              onClick={() =>
                void act({
                  type: 'timer',
                  command: 'start',
                  seconds,
                  mode: timerMode,
                })
              }
            >
              Iniciar / reiniciar
            </button>
            <button
              disabled={spectator || busy}
              onClick={() =>
                void act({
                  type: 'timer',
                  command: room.timer?.deadline === null ? 'resume' : 'pause',
                })
              }
            >
              {room.timer?.deadline === null ? 'Continuar' : 'Pausar'}
            </button>
            <button
              disabled={spectator || busy}
              onClick={() => void act({ type: 'timer', command: 'reset' })}
            >
              Detener
            </button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={logOpen && !incoming} onOpenChange={setLogOpen}>
        <DialogContent className="modal">
          <DialogTitle>Bitácora de la partida</DialogTitle>
          <DialogDescription>
            Movimientos, acuerdos y consultas de la mesa.
          </DialogDescription>
          <label>
            Registrar un acuerdo
            <input
              value={note}
              maxLength={500}
              onChange={(e) => setNote(e.target.value)}
            />
          </label>
          <button
            disabled={spectator || busy || !note.trim()}
            onClick={async () => {
              if (await act({ type: 'note', text: note })) setNote('');
            }}
          >
            Registrar
          </button>
          <button
            disabled={spectator || busy}
            onClick={() => void act({ type: 'revokeLook' })}
          >
            Cerrar consultas de mis cartas
          </button>
          <ol className="log">
            {room.log.map((l) => (
              <li key={l.id}>{l.message}</li>
            ))}
          </ol>
        </DialogContent>
      </Dialog>
    </div>
  );
}
