'use client';
import { useEffect, useState, useCallback } from 'react';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import DeckManager from './deck-manager';
import Effects from './effects-panel';
import {
  Shield,
  Swords,
  Castle,
  Coins,
  BookOpen,
  Plus,
  Copy,
  ArrowRight,
  ScrollText,
} from 'lucide-react';
type Card = {
  id: string;
  name: string;
  type: string;
  effect: string;
  race: string;
  cost: number;
  strength: number;
  zone: string;
  attachedTo?: string;
  target?: string;
  blocks?: string;
  hidden?: boolean;
  revealed?: boolean;
  statuses?: Record<string, unknown>;
};
type Player = {
  id: string;
  name: string;
  cards: Card[];
  ready: boolean;
  freeMulligan: boolean;
  houseMulligan: boolean;
  temporaryGold?: number;
};
type Room = {
  code: string;
  me: string | null;
  role: string;
  spectatorCount: number;
  privateCards: Card[];
  inspection: { owner: string; zone: string; mode: string } | null;
  requests: {
    id: string;
    kind: string;
    owner: string;
    actor: string;
    reason: string;
    zone?: string;
    operation?: string;
    count?: number;
  }[];
  uses: Record<string, number>;
  host: string;
  active: string;
  turn: number;
  phase: string;
  capacity: number;
  started: boolean;
  drawn: boolean;
  resolved: string[];
  battleReady: string[];
  players: Player[];
  log: { id: string; message: string; time: number }[];
};
const zones: Record<string, string> = {
  castillo: 'Mazo Castillo',
  mano: 'Mano',
  defensa: 'Línea de defensa',
  ataque: 'Línea de ataque',
  apoyo: 'Apoyo · Tótem',
  reserva: 'Reserva de oros',
  pagado: 'Oro pagado',
  cementerio: 'Cementerio',
  destierro: 'Destierro',
};
const types = ['Aliado', 'Arma', 'Tótem', 'Talismán', 'Oro'];
const phases = [
  'Agrupación',
  'Vigilia',
  'Ataque',
  'Bloqueo',
  'Guerra de Talismanes',
  'Asignación de daño',
  'Final',
];
const blank = {
  name: '',
  type: 'Aliado',
  effect: '',
  race: '',
  cost: 0,
  strength: 0,
  zone: 'mano',
};
function Choice({
  label,
  value,
  onChange,
  items,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  items: { value: string; label: string }[];
}) {
  return (
    <label>
      {label}
      <Select value={value} onValueChange={(v) => v && onChange(v)}>
        <SelectTrigger className="choice" aria-label={label}>
          <SelectValue>
            {items.find((i) => i.value === value)?.label ?? 'Seleccionar'}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {items.map((i) => (
            <SelectItem key={i.value} value={i.value}>
              {i.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  );
}
const options = (a: string[]) => a.map((v) => ({ value: v, label: v }));
export default function Home() {
  const [name, setName] = useState(''),
    [code, setCode] = useState(''),
    [capacity, setCapacity] = useState('2'),
    [room, setRoom] = useState<Room | null>(null),
    [token, setToken] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [online, setOnline] = useState(true),
    [selected, setSelected] = useState<string | null>(null),
    [editor, setEditor] = useState(false),
    [draft, setDraft] = useState(blank),
    [editing, setEditing] = useState<string | null>(null),
    [rules, setRules] = useState(false),
    [deck, setDeck] = useState(false),
    [reason, setReason] = useState(''),
    [target, setTarget] = useState(''),
    [host, setHost] = useState(''),
    [block, setBlock] = useState(''),
    [amount, setAmount] = useState('1'),
    [note, setNote] = useState(''),
    [notice, setNotice] = useState(''),
    [boardView, setBoardView] = useState('all');
  const request = useCallback(
    async (url: string, body?: unknown, auth = '') => {
      const res = await fetch(url, {
        method: body === undefined ? 'GET' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${auth}`,
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const data = (await res.json()) as Room & {
        error?: string;
        room: Room;
        token: string;
        cards: unknown[];
        name: string;
        version: number;
      };
      if (!res.ok) throw Error(data.error || 'No se pudo conectar');
      return data;
    },
    [],
  );
  useEffect(() => {
    queueMicrotask(() => {
      const q = new URLSearchParams(location.search);
      setCode(q.get('sala') || '');
      try {
        const s = JSON.parse(
          sessionStorage.getItem('imperio-session') || 'null',
        );
        if (
          s &&
          (!q.get('sala') || q.get('sala') === s.code) &&
          (!q.has('espectador') || s.role === 'spectator')
        ) {
          setToken(s.token);
          request(`/api/${s.code}`, undefined, s.token)
            .then(setRoom)
            .catch(() =>
              setError(
                'Tu sala anterior no está disponible. Puedes crear otra.',
              ),
            );
        }
      } catch {}
    });
  }, [request]);
  const roomCode = room?.code;
  useEffect(() => {
    if (!roomCode || !token) return;
    let live = true;
    const timer = setInterval(
      () =>
        request(`/api/${roomCode}`, undefined, token)
          .then((r) => {
            if (live) {
              setRoom(r);
              setOnline(true);
            }
          })
          .catch(() => {
            if (live) setOnline(false);
          }),
      1000,
    );
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [roomCode, token, request]);
  async function enter(join = false, watch = false) {
    if (!name.trim() && !watch) {
      setError('Escribe tu nombre para entrar.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const r = await request(
        watch
          ? `/api/${code.trim().toUpperCase()}/spectate`
          : join
            ? `/api/${code.trim().toUpperCase()}/join`
            : '/api/create',
        { name, capacity: Number(capacity) },
      );
      setRoom(r.room);
      setToken(r.token);
      sessionStorage.setItem(
        'imperio-session',
        JSON.stringify({
          code: r.room.code,
          token: r.token,
          role: r.room.role,
        }),
      );
      history.replaceState(null, '', `?sala=${r.room.code}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function act(a: Record<string, unknown>) {
    if (!room) return;
    setBusy(true);
    setError('');
    try {
      const r = await request(`/api/${room.code}/action`, a, token);
      setRoom(r);
      return r;
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    const context = (
      document as unknown as {
        modelContext?: { registerTool: (t: unknown, o: unknown) => unknown };
      }
    ).modelContext;
    if (!context?.registerTool || !roomCode) return;
    const life = new AbortController();
    try {
      Promise.resolve(
        context.registerTool(
          {
            name: 'read_imperio_table',
            description:
              'Consultar la mesa visible y la mano propia. No revela cartas ocultas.',
            inputSchema: {
              type: 'object',
              properties: {},
              additionalProperties: false,
            },
            annotations: { readOnlyHint: true, untrustedContentHint: true },
            execute: async () => request(`/api/${roomCode}`, undefined, token),
          },
          { signal: life.signal },
        ),
      ).catch(() => {});
    } catch {}
    return () => life.abort();
  }, [roomCode, token, request]);
  const me = room?.players.find((p) => p.id === room.me);
  const found = room?.players
    .flatMap((p) => p.cards.map((c) => ({ c, p })))
    .find((x) => x.c.id === selected && !x.c.hidden);
  const card = found?.c;
  const mine = found?.p.id === me?.id;
  function newCard() {
    setEditing(null);
    setDraft(blank);
    setEditor(true);
  }
  function editCard() {
    if (!card) return;
    setEditing(card.id);
    setDraft({
      name: card.name,
      type: card.type,
      effect: card.effect,
      race: card.race,
      cost: card.cost,
      strength: card.strength,
      zone: card.zone,
    });
    setEditor(true);
  }
  async function copy(watch = false) {
    try {
      await navigator.clipboard.writeText(
        `${location.origin}/?sala=${room?.code}${watch ? '&espectador=1' : ''}`,
      );
      setNotice('Enlace copiado. Compártelo con tus amigos.');
    } catch {
      setNotice(`Código de sala: ${room?.code}`);
    }
  }
  function tile(c: Card, p: Player, attached = false) {
    return (
      <button
        key={c.id}
        className={`card type-${c.type} ${attached ? 'weapon' : ''} ${selected === c.id ? 'chosen' : ''}`}
        onClick={() => {
          setSelected(c.id);
          setTarget('');
          setHost('');
          setBlock('');
        }}
      >
        <div className="card-top">
          <span>{c.type}</span>
          <b>{c.type === 'Oro' ? '◈' : c.cost}</b>
        </div>
        <strong>{c.name}</strong>
        {c.race && <small>{c.race}</small>}
        <p>
          {c.statuses?.sinHabilidad
            ? 'Sin habilidad (estado activo)'
            : c.effect || 'Sin habilidad escrita'}
        </p>
        <div className="card-bottom">
          {c.type === 'Aliado' ? (
            <>
              <Shield size={14} />
              <b>{c.strength}</b>
              <span>Fuerza actual</span>
            </>
          ) : (
            <span>{attached ? 'Arma equipada' : 'IMPERIO'}</span>
          )}
        </div>
        {c.revealed && <small className="tag">Mostrada a todos</small>}
        {Object.keys(c.statuses || {}).length > 0 && (
          <small className="tag">
            {Object.keys(c.statuses || {}).join(' · ')}
          </small>
        )}
        {c.target && (
          <small className="tag">
            Ataca a {room?.players.find((x) => x.id === c.target)?.name}
          </small>
        )}
        {c.blocks && (
          <small className="tag">
            Bloquea a{' '}
            {room?.players
              .flatMap((x) => x.cards)
              .find((x) => x.id === c.blocks)?.name || 'un atacante'}
          </small>
        )}
      </button>
    );
  }
  function zone(p: Player, z: string) {
    const cards = p.cards.filter((c) => c.zone === z && !c.attachedTo);
    return (
      <section className={`zone z-${z}`} key={z}>
        <div className="zone-title">
          <span>{zones[z]}</span>
          <b>{cards.length}</b>
        </div>
        <div className="cards">
          {z === 'castillo' ? (
            <div className="pile">
              <Castle size={28} />
              <strong>{cards.length}</strong>
              <small>cartas en Castillo</small>
              {cards
                .filter((c) => c.revealed && !c.hidden)
                .map((c) => tile(c, p))}
            </div>
          ) : z === 'mano' && p.id !== me?.id ? (
            <div className="hidden-hand">
              {cards.length} cartas en mano
              <div className="cards">
                {cards
                  .filter((c) => c.revealed && !c.hidden)
                  .map((c) => tile(c, p))}
              </div>
            </div>
          ) : cards.length ? (
            cards.map((c) => (
              <div className="stack" key={c.id}>
                {tile(c, p)}
                {p.cards
                  .filter((a) => a.attachedTo === c.id)
                  .map((a) => tile(a, p, true))}
              </div>
            ))
          ) : (
            <div className="empty-zone">
              {z === 'defensa'
                ? 'Tus aliados se despliegan aquí'
                : z === 'ataque'
                  ? 'Sin atacantes'
                  : 'Sin cartas'}
            </div>
          )}
        </div>
      </section>
    );
  }
  return (
    <>
      <header className="topbar">
        <div className="brand">
          <Shield size={26} />
          <span>
            MESA <b>IMPERIO</b>
          </span>
        </div>
        <span className="format">Mitos y Leyendas · Mesa asistida</span>
        <button onClick={() => setDeck(true)}>Mis mazos</button>
        <button onClick={() => setRules(true)}>
          <BookOpen size={16} /> Reglas y ayuda
        </button>
      </header>
      {error && (
        <div className="banner error" role="alert">
          {error}
          <button onClick={() => setError('')} aria-label="Cerrar error">
            ×
          </button>
        </div>
      )}
      {notice && (
        <output className="banner">
          {notice}
          <button onClick={() => setNotice('')} aria-label="Cerrar aviso">
            ×
          </button>
        </output>
      )}
      {!room ? (
        <main className="lobby">
          <div className="eyebrow">EL CAMPO DE BATALLA ES TUYO</div>
          <h1>
            Mesa Imperio<span>Tu próxima batalla.</span>
          </h1>
          <p className="muted">
            Una mesa compartida para probar cartas y jugar con amigos.
          </p>
          <div className="lobby-grid">
            <section className="entry">
              <h2>Reúne a tu compañía</h2>
              <label>
                Tu nombre
                <input
                  maxLength={32}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="¿Cómo te llamas?"
                />
              </label>
              <Choice
                label="Capacidad de la sala"
                value={capacity}
                onChange={setCapacity}
                items={['2', '3', '4', '5', '6'].map((v) => ({
                  value: v,
                  label: `${v} jugadores${v === '2' ? ' · Duelo' : ' · Variante entre amigos'}`,
                }))}
              />
              <button
                disabled={busy}
                onClick={() => enter()}
                className="wide primary"
              >
                Crear sala <ArrowRight size={17} />
              </button>
              <div className="divider">O ENTRA CON TUS AMIGOS</div>
              <label>
                Código de sala
                <input
                  value={code}
                  maxLength={10}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="Código de invitación"
                />
              </label>
              <button
                disabled={busy || !code}
                className="wide"
                onClick={() => enter(true)}
              >
                Unirme a la mesa
              </button>
              <button
                disabled={busy || !code}
                className="wide"
                onClick={() => enter(false, true)}
              >
                Entrar como espectador
              </button>
            </section>
            <section className="lobby-aside">
              <Swords size={42} />
              <h2>Sin cargar todo tu mazo.</h2>
              <p>
                Empieza con un oro y 49 cartas sin definir. Roba, escribe el
                nombre y el efecto, y juega.
              </p>
              <div className="mini-zones">
                <span>
                  <Castle />
                  Castillo y mano privada
                </span>
                <span>
                  <Shield />
                  Aliados y armas vinculadas
                </span>
                <span>
                  <Coins />
                  Reserva y oro pagado
                </span>
                <span>
                  <ScrollText />
                  Movimientos compartidos
                </span>
              </div>
              <small>
                Proyecto de aficionados, sin afiliación oficial. Las habilidades
                se resuelven de común acuerdo.
              </small>
            </section>
          </div>
        </main>
      ) : (
        <main className="game">
          <section className="room-bar">
            <div>
              <div className="eyebrow">
                {room.players.length}/{room.capacity} JUGADORES ·{' '}
                {online ? 'CONECTADO' : 'RECONECTANDO…'}
              </div>
              <h2>Sala {room.code}</h2>
              <small>
                {room.role === 'spectator'
                  ? 'Modo espectador · Sólo lectura'
                  : 'Jugador'}{' '}
                · {room.spectatorCount || 0} espectadores registrados
              </small>
            </div>
            <button onClick={() => copy()}>
              <Copy size={16} /> Invitar
            </button>
            <button onClick={() => copy(true)}>Invitar espectador</button>
            <div className="turn">
              <small>Turno {room.turn}</small>
              <strong>
                {room.players.find((p) => p.id === room.active)?.name}
              </strong>
            </div>
            <div className="phase-now">
              <small>Fase actual</small>
              <strong>{room.phase}</strong>
            </div>
            <button
              disabled={
                busy ||
                room.active !== me?.id ||
                !room.started ||
                room.phase === 'Final'
              }
              onClick={() =>
                act({
                  type: 'phase',
                  phase: phases[phases.indexOf(room.phase) + 1],
                })
              }
            >
              Siguiente fase →
            </button>
            {room.phase === 'Vigilia' && (
              <button
                disabled={busy || room.active !== me?.id || !room.started}
                onClick={() => act({ type: 'phase', phase: 'Final' })}
              >
                Finalizar sin atacar
              </button>
            )}
            <button
              disabled={
                busy ||
                room.active !== me?.id ||
                !room.started ||
                room.phase !== 'Final' ||
                (room.turn > 1 && !room.drawn)
              }
              onClick={() => act({ type: 'next' })}
            >
              Terminar turno →
            </button>
          </section>
          {!room.started && room.role !== 'spectator' && (
            <section className="preparation">
              <span>
                <b>Preparación</b> · Importa tu mazo o usa cartas sin definir.
                Prepara tu mano antes de comenzar.
              </span>
              <button
                disabled={busy || me?.ready}
                onClick={() => act({ type: 'setup' })}
              >
                Preparar mano · 8 cartas
              </button>
              <button
                disabled={busy || !me?.ready}
                onClick={() => act({ type: 'mulligan' })}
              >
                Mulligan · una menos
              </button>
              <button
                disabled={busy || !me?.ready || me.houseMulligan}
                onClick={() => act({ type: 'houseMulligan' })}
              >
                Volver a ocho · regla de la casa
              </button>
              <button
                disabled={
                  busy ||
                  !me?.ready ||
                  me.freeMulligan ||
                  me.cards.filter((c) => c.zone === 'mano' && c.type === 'Oro')
                    .length > 1
                }
                onClick={() => act({ type: 'freeMulligan' })}
              >
                Mulligan excepcional · conservar mano
              </button>
              {room.host === me?.id && (
                <button
                  className="primary"
                  disabled={
                    busy ||
                    room.players.length < 2 ||
                    room.players.some((p) => !p.ready)
                  }
                  onClick={() => act({ type: 'start' })}
                >
                  Comenzar partida
                </button>
              )}
            </section>
          )}
          <nav className="board-nav" aria-label="Ver mesas">
            <button
              className={boardView === 'all' ? 'primary' : ''}
              onClick={() => setBoardView('all')}
            >
              Todas las mesas
            </button>
            {room.players.map((p) => (
              <button
                className={boardView === p.id ? 'primary' : ''}
                key={p.id}
                onClick={() => setBoardView(p.id)}
              >
                {p.name}
                {p.id === me?.id ? ' · Tú' : ' · Rival'}
              </button>
            ))}
          </nav>
          <div className="workspace">
            <div className="tables">
              {room.players
                .filter((p) => boardView === 'all' || boardView === p.id)
                .map((p) => (
                  <article
                    className={`player-board ${p.id === me?.id ? 'own' : ''}`}
                    key={p.id}
                  >
                    <header className="player-head">
                      <div className="avatar">
                        {p.name.slice(0, 1).toUpperCase()}
                      </div>
                      <h2>
                        {p.name} {p.id === me?.id && <small>· Tú</small>}
                      </h2>
                      {p.ready && <span className="status">Preparado</span>}
                      {p.id === room.active && (
                        <span className="status gold">Turno actual</span>
                      )}
                      <span className="board-count">
                        {p.cards.filter((c) => c.zone === 'castillo').length} en
                        Castillo
                      </span>
                    </header>
                    <div className="battle-lines">
                      {zone(p, 'ataque')}
                      {zone(p, 'defensa')}
                    </div>
                    <div className="resources">
                      {zone(p, 'apoyo')}
                      {zone(p, 'reserva')}
                      {zone(p, 'pagado')}
                    </div>
                    <div className="piles">
                      {zone(p, 'castillo')}
                      {zone(p, 'cementerio')}
                      {zone(p, 'destierro')}
                    </div>
                    {zone(p, 'mano')}
                  </article>
                ))}
            </div>
            <aside className="inspector">
              <Effects room={room} act={act} busy={busy} />
              <fieldset disabled={room.role === 'spectator'}>
                <section className="panel">
                  <h3>Tu mesa</h3>
                  <div className="actions">
                    <button
                      className="primary"
                      disabled={busy}
                      onClick={newCard}
                    >
                      <Plus size={16} /> Crear carta
                    </button>
                    <button onClick={() => setDeck(true)}>Mazo</button>
                    <button
                      disabled={
                        busy ||
                        !room.started ||
                        room.active !== me?.id ||
                        room.phase !== 'Final' ||
                        room.turn === 1 ||
                        room.drawn
                      }
                      onClick={() => act({ type: 'draw' })}
                    >
                      {room.drawn
                        ? 'Robo del turno realizado'
                        : 'Robar carta de fin de turno'}
                    </button>
                    <button
                      disabled={busy}
                      onClick={() => act({ type: 'shuffle' })}
                    >
                      Barajar
                    </button>
                    <button
                      disabled={
                        busy ||
                        !room.started ||
                        room.active !== me?.id ||
                        room.phase !== 'Agrupación'
                      }
                      onClick={() => act({ type: 'group' })}
                    >
                      Agrupar
                    </button>
                  </div>
                  <p className="hint">
                    Robo normal: una carta en tu fase Final, excepto el primer
                    turno de la partida.
                  </p>
                  <label>
                    Carta o efecto excepcional
                    <input
                      maxLength={300}
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="Ej.: efecto que permite robar o Furia"
                    />
                  </label>
                  <button
                    disabled={busy || !room.started || !reason.trim()}
                    onClick={() =>
                      act({ type: 'effectDraw', count: 1, reason })
                    }
                  >
                    Robar 1 por efecto · registrar motivo
                  </button>
                  <label>
                    Cartas a botar de tu Castillo
                    <input
                      type="number"
                      min="1"
                      max="250"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                    />
                  </label>
                  <button
                    disabled={busy}
                    onClick={() =>
                      act({ type: 'damage', count: Number(amount) })
                    }
                  >
                    Aplicar daño / botar
                  </button>
                  {me && !me.cards.some((c) => c.zone === 'castillo') && (
                    <p className="warning">
                      Tu Castillo está vacío. Comprueben el fin de partida y los
                      efectos pendientes.
                    </p>
                  )}
                </section>
                <section className="panel">
                  <h3>{card ? 'Detalle de carta' : 'Inspeccionar carta'}</h3>
                  {card ? (
                    <>
                      <span className="eyebrow">
                        {found?.p.name} · {card.type}
                      </span>
                      <h2>{card.name}</h2>
                      <p className="effect">
                        {card.effect || 'Sin habilidad escrita.'}
                      </p>
                      <div className="stats">
                        <span>
                          Coste <b>{card.cost}</b>
                        </span>
                        {card.type === 'Aliado' && (
                          <span>
                            Fuerza actual <b>{card.strength}</b>
                          </span>
                        )}
                      </div>
                      {mine && (
                        <>
                          <button onClick={editCard}>
                            Editar nombre, efecto y valores
                          </button>
                          <Choice
                            label="Mover a una zona"
                            value={card.zone}
                            onChange={(zone) =>
                              act({ type: 'move', cardId: card.id, zone })
                            }
                            items={Object.entries(zones).map(
                              ([value, label]) => ({ value, label }),
                            )}
                          />
                          {card.type === 'Arma' && (
                            <>
                              <Choice
                                label="Aliado portador"
                                value={host}
                                onChange={setHost}
                                items={(
                                  me?.cards.filter(
                                    (c) =>
                                      c.type === 'Aliado' &&
                                      ['defensa', 'ataque'].includes(c.zone),
                                  ) || []
                                ).map((c) => ({ value: c.id, label: c.name }))}
                              />
                              <button
                                disabled={!host || busy}
                                onClick={() =>
                                  act({
                                    type: 'attach',
                                    cardId: card.id,
                                    hostId: host,
                                  })
                                }
                              >
                                Equipar arma
                              </button>
                              <p className="hint">
                                Actualiza la fuerza del portador si el efecto la
                                modifica.
                              </p>
                            </>
                          )}
                          {card.type === 'Aliado' && (
                            <>
                              <Choice
                                label="Atacar a"
                                value={target}
                                onChange={setTarget}
                                items={room.players
                                  .filter((p) => p.id !== me?.id)
                                  .map((p) => ({ value: p.id, label: p.name }))}
                              />
                              <button
                                disabled={
                                  !target ||
                                  busy ||
                                  room.active !== me?.id ||
                                  room.phase !== 'Ataque'
                                }
                                onClick={() =>
                                  act({
                                    type: 'attack',
                                    cardId: card.id,
                                    target,
                                    reason,
                                  })
                                }
                              >
                                Declarar atacante
                              </button>
                              <Choice
                                label="Bloquear a"
                                value={block}
                                onChange={setBlock}
                                items={room.players
                                  .flatMap((p) => p.cards)
                                  .filter(
                                    (c) =>
                                      c.zone === 'ataque' &&
                                      c.target === me?.id,
                                  )
                                  .map((c) => ({ value: c.id, label: c.name }))}
                              />
                              <button
                                disabled={
                                  !block || busy || room.phase !== 'Bloqueo'
                                }
                                onClick={() =>
                                  act({
                                    type: 'block',
                                    cardId: card.id,
                                    attacker: block,
                                  })
                                }
                              >
                                Asignar bloqueo
                              </button>
                              {card.blocks && (
                                <button
                                  onClick={() =>
                                    act({ type: 'clearBlock', cardId: card.id })
                                  }
                                >
                                  Quitar bloqueo
                                </button>
                              )}
                            </>
                          )}
                        </>
                      )}
                    </>
                  ) : (
                    <p className="muted">
                      Haz clic en una carta de la mesa para leer su efecto. Tus
                      cartas se pueden editar y mover desde aquí.
                    </p>
                  )}
                </section>
                <section className="panel">
                  <h3>Resolver combate</h3>
                  <p className="hint">
                    Actualicen fuerzas y resuelvan efectos. Atacante y defensor
                    confirman antes de aplicar automáticamente daño y bajas.
                  </p>
                  {room.players
                    .filter((p) => p.id !== room.active)
                    .map((d) => {
                      const at =
                        room.players
                          .find((p) => p.id === room.active)
                          ?.cards.filter(
                            (c) =>
                              c.zone === 'ataque' &&
                              c.target === d.id &&
                              c.type === 'Aliado',
                          ) || [];
                      if (!at.length) return null;
                      let total = 0;
                      return (
                        <div key={d.id}>
                          <h4>Contra {d.name}</h4>
                          {at.map((a) => {
                            const b = d.cards.find(
                              (c) => c.zone === 'defensa' && c.blocks === a.id,
                            );
                            const damage = Math.max(
                              0,
                              a.strength - (b?.strength || 0),
                            );
                            total += damage;
                            return (
                              <p className="combat-row" key={a.id}>
                                <b>
                                  {a.name} ({a.strength})
                                </b>
                                <br />
                                {b
                                  ? `${b.name} (${b.strength})`
                                  : 'Sin bloqueo'}{' '}
                                → {damage} daño
                                {b && (
                                  <small>
                                    {`Destrucciones: ${[a.strength <= b.strength && !a.statuses?.indestructible ? a.name : '', b.strength <= a.strength && !b.statuses?.indestructible ? b.name : ''].filter(Boolean).join(' y ') || 'ninguna (protecciones activas)'}`}
                                  </small>
                                )}
                              </p>
                            );
                          })}
                          <strong>Daño total: {total}</strong>
                          {room.resolved?.includes(d.id) ? (
                            <p className="status">Combate resuelto</p>
                          ) : (
                            <button
                              className="primary"
                              disabled={
                                busy ||
                                room.phase !== 'Asignación de daño' ||
                                room.active !== me?.id ||
                                !room.battleReady?.includes(room.active) ||
                                !room.battleReady?.includes(d.id)
                              }
                              onClick={() =>
                                act({ type: 'resolve', defender: d.id })
                              }
                            >
                              Aplicar daño y destrucciones
                            </button>
                          )}
                        </div>
                      );
                    })}
                  <button
                    disabled={
                      busy ||
                      room.phase !== 'Asignación de daño' ||
                      room.battleReady?.includes(me?.id || '')
                    }
                    onClick={() => act({ type: 'battleReady' })}
                  >
                    {room.battleReady?.includes(me?.id || '')
                      ? 'Confirmación enviada'
                      : 'Confirmo efectos y fuerzas'}
                  </button>
                  <p className="hint">
                    Aplica las reglas básicas. Si hay prevención,
                    indestructibilidad u otra excepción, resuélvanla manualmente
                    antes de confirmar.
                  </p>
                </section>
                <section className="panel">
                  <h3>Bitácora</h3>
                  <label>
                    Registrar efecto o acuerdo
                    <textarea
                      rows={2}
                      maxLength={500}
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="Ej.: el aliado gana 2 de fuerza…"
                    />
                  </label>
                  <button
                    disabled={!note.trim() || busy}
                    onClick={async () => {
                      if (await act({ type: 'note', text: note })) setNote('');
                    }}
                  >
                    Registrar
                  </button>
                  <ol className="log">
                    {room.log.map((e) => (
                      <li key={e.id}>
                        <time>
                          {new Date(e.time).toLocaleTimeString('es-CL', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </time>
                        {e.message}
                      </li>
                    ))}
                  </ol>
                </section>
              </fieldset>
            </aside>
          </div>
        </main>
      )}
      <Dialog open={editor} onOpenChange={setEditor}>
        <DialogContent className="modal">
          <DialogTitle>
            {editing ? 'Editar carta' : 'Crear carta de texto'}
          </DialogTitle>
          <DialogDescription>
            Escribe el texto de tu carta. Los efectos se resuelven manualmente.
          </DialogDescription>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (
                await act({
                  type: editing ? 'edit' : 'add',
                  cardId: editing,
                  card: draft,
                  reason,
                })
              )
                setEditor(false);
            }}
          >
            <label>
              Nombre
              <input
                required
                maxLength={100}
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              />
            </label>
            <Choice
              label="Tipo"
              value={draft.type}
              onChange={(type) => setDraft({ ...draft, type })}
              items={options(types)}
            />
            <div className="fields">
              <label>
                Coste
                <input
                  type="number"
                  min="0"
                  max="999"
                  value={draft.cost}
                  onChange={(e) =>
                    setDraft({ ...draft, cost: Number(e.target.value) })
                  }
                />
              </label>
              <label>
                Fuerza actual
                <input
                  type="number"
                  min="0"
                  max="999"
                  value={draft.strength}
                  onChange={(e) =>
                    setDraft({ ...draft, strength: Number(e.target.value) })
                  }
                />
              </label>
            </div>
            <label>
              Raza
              <input
                maxLength={60}
                value={draft.race}
                onChange={(e) => setDraft({ ...draft, race: e.target.value })}
              />
            </label>
            <label>
              Efecto
              <textarea
                rows={5}
                maxLength={3000}
                value={draft.effect}
                onChange={(e) => setDraft({ ...draft, effect: e.target.value })}
              />
            </label>
            {!editing && (
              <Choice
                label="Colocar en"
                value={draft.zone}
                onChange={(zone) => setDraft({ ...draft, zone })}
                items={Object.entries(zones)
                  .filter(([v]) => v !== 'castillo')
                  .map(([value, label]) => ({ value, label }))}
              />
            )}
            <button type="submit" className="primary wide" disabled={busy}>
              Guardar carta
            </button>
          </form>
        </DialogContent>
      </Dialog>
      <DeckManager
        open={deck}
        onOpenChange={setDeck}
        loadRoom={
          room && room.role !== 'spectator'
            ? () => request(`/api/${room.code}/deck`, undefined, token)
            : undefined
        }
        importRoom={
          room && room.role !== 'spectator'
            ? async (d) => !!(await act({ type: 'import', cards: d }))
            : undefined
        }
      />
      <Dialog open={rules} onOpenChange={setRules}>
        <DialogContent className="modal rules">
          <DialogTitle>Imperio · Reglas y ayuda</DialogTitle>
          <DialogDescription>
            Mesa con reglas básicas asistidas. Fuentes oficiales consultadas el
            6 de septiembre de 2026.
          </DialogDescription>
          <h3>Preparación y turno</h3>
          <p>
            Mazo de 50 cartas, incluyendo el Oro inicial. Se roba una mano de 8.
            El mulligan normal reduce la mano en una carta. El mulligan
            excepcional, una vez con uno o ningún Oro, muestra la mano en la
            bitácora y conserva su cantidad. Volver a ocho es una regla de la
            casa: una vez antes de comenzar.
          </p>
          <p>
            Agrupación → Vigilia → Batalla Mitológica (Ataque, Bloqueo, Guerra
            de Talismanes y daño) → Final. En el primer turno de la partida se
            omiten la Agrupación y el robo final. El robo normal sólo se permite
            en Final y una vez por turno. Debes descartar hasta 8 antes de
            terminar. Al cambiar de turno se agrupa al siguiente jugador.
          </p>
          <p>
            En Vigilia, el Oro debe ser la primera carta que pongas en juego.
            Comprueben los costes, requisitos de ataque, prioridades y
            excepciones antes de mover las cartas.
          </p>
          <h3>Bloqueo y daño</h3>
          <p>
            El bloqueo básico es uno a uno. Atacante más fuerte: destruye al
            bloqueador y la diferencia llega al Castillo. Misma fuerza: ambos se
            destruyen, sin daño al Castillo. Defensor más fuerte: destruye al
            atacante, sin daño al Castillo. Esto es destrucción, no anulación.
          </p>
          <h3>Qué hace esta mesa</h3>
          <p>
            Comparte cartas y movimientos; oculta manos ajenas y Castillos;
            permite equipar armas, marcar ataques y bloqueos, barajar, robar y
            botar. Al mover un portador fuera de las líneas de batalla, sus
            armas acompañan al portador a la misma zona; corrige manualmente
            cualquier excepción.
          </p>
          <p>
            No interpreta textos ni valida automáticamente la legalidad, la
            banlist, las razas o las habilidades. Los 49 espacios iniciales son
            cartas sin definir. Edita una carta robada para darle su identidad
            sin añadir una carta extra.
          </p>
          <h3>Salas de 3 a 6</h3>
          <p>
            Variante de la casa: turnos por orden de entrada y objetivo indicado
            por cada atacante. Acuerden prioridades, equipos y condiciones de
            victoria. No es una modalidad oficial implementada.
          </p>
          <h3>Documentación oficial</h3>
          <ul>
            <li>
              <a
                href="https://drive.google.com/file/d/1nKsn1ZtcgVa-bCDhKuKiPVhp8urNU6wZ/view"
                target="_blank"
                rel="noreferrer"
              >
                DAR Imperio · abril 2026
              </a>
            </li>
            <li>
              <a
                href="https://blog.myl.cl/como-jugar-imperio/"
                target="_blank"
                rel="noreferrer"
              >
                Formato vigente y documentos oficiales
              </a>
            </li>
            <li>
              <a
                href="https://blog.myl.cl/banlists-actualizadas/"
                target="_blank"
                rel="noreferrer"
              >
                Restricciones actualizadas
              </a>
            </li>
            <li>
              <a
                href="https://blog.myl.cl/faq-preguntas-frecuentes/"
                target="_blank"
                rel="noreferrer"
              >
                FAQ por edición
              </a>
            </li>
            <li>
              <a
                href="https://blog.myl.cl/ultimas-aclaraciones-de-interacciones-para-el-formato-imperio/"
                target="_blank"
                rel="noreferrer"
              >
                Aclaraciones de interacciones
              </a>
            </li>
          </ul>
          <p className="hint">
            Para jugar en el mismo PC, usa otro navegador o una ventana privada.
            Para amigos en otra red, comparte un túnel HTTPS al puerto de la
            aplicación. localhost sólo funciona en tu equipo.
          </p>
        </DialogContent>
      </Dialog>
      <footer>
        MESA IMPERIO · PROYECTO NO OFICIAL · HECHO PARA JUGAR ENTRE AMIGOS
      </footer>
    </>
  );
}
