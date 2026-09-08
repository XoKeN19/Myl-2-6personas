'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
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
import Arena from './arena';
import { useTavernMusic } from './tavern-music';
import {
  Shield,
  Swords,
  Castle,
  Coins,
  BookOpen,
  ArrowRight,
  ScrollText,
  LogOut,
} from 'lucide-react';
export type Card = {
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
export type Player = {
  id: string;
  name: string;
  cards: Card[];
  ready: boolean;
  freeMulligan: boolean;
  houseMulligan: boolean;
  temporaryGold?: number;
};
export type Room = {
  defeated?: { id: string; name: string }[];
  revealEvent?: {
    id: string;
    player: string;
    name: string;
    cards: Card[];
    found: boolean;
  };
  pendingBattles?: {
    id: string;
    attacker: string;
    attackerName: string;
    target: string;
    turn: number;
    rows: { cardId: string; name: string; strength: number }[];
  }[];
  struck?: string[];
  combatEvents?: {
    id: string;
    attacker: string;
    attackerName: string;
    target: string;
    targetName: string;
    damage: number;
    cards: number;
    turn: number;
  }[];
  revision: number;
  serverTime: number;
  timer: {
    mode?: string;
    duration: number;
    remaining: number;
    deadline: number | null;
  };
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
    mode?: string;
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
const blank = {
  name: '',
  type: 'Aliado',
  effect: '',
  race: '',
  cost: 1,
  strength: 2,
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
  const music = useTavernMusic();
  const [name, setName] = useState(''),
    [code, setCode] = useState(''),
    [capacity, setCapacity] = useState('2'),
    [room, setRoom] = useState<Room | null>(null),
    [token, setToken] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [online, setOnline] = useState(true),
    [editor, setEditor] = useState(false),
    [draft, setDraft] = useState(blank),
    [editing, setEditing] = useState<string | null>(null),
    [rules, setRules] = useState(false),
    [deck, setDeck] = useState(false),
    [notice, setNotice] = useState(''),
    [canResume, setCanResume] = useState(false);
  const actionBusy = useRef(false);
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
      const responseText = await res.text();
      if (!responseText.trim()) {
        throw Error(
          `El servidor no respondió${res.status ? ` (estado ${res.status})` : ''}. Comprueba que Mesa Imperio siga abierta y vuelve a intentarlo.`,
        );
      }
      let parsed: unknown;
      try {
        parsed = JSON.parse(responseText);
      } catch {
        throw Error(
          `El servidor devolvió una respuesta inválida (estado ${res.status}). Recarga la página y vuelve a intentarlo.`,
        );
      }
      const data = parsed as Room & {
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
              setRoom((previous) =>
                previous &&
                previous.code === r.code &&
                previous.revision > r.revision
                  ? previous
                  : r,
              );
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
      const saved = JSON.parse(
        sessionStorage.getItem('imperio-session') || 'null',
      );
      if (
        join &&
        !watch &&
        saved?.code === code.trim().toUpperCase() &&
        saved.role !== 'spectator'
      ) {
        await resumeRoom();
        return;
      }
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
    if (!room || actionBusy.current) return;
    actionBusy.current = true;
    setBusy(true);
    setError('');
    try {
      const r = await request(`/api/${room.code}/action`, a, token);
      setRoom(r);
      return r;
    } catch (e) {
      setError((e as Error).message);
    } finally {
      actionBusy.current = false;
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
  function newCard() {
    setEditing(null);
    setDraft(blank);
    setEditor(true);
  }
  function leaveRoom() {
    // Keep the seat credential so the menu can resume this same player.
    setRoom(null);
    setToken('');
    setCanResume(true);
    history.replaceState(null, '', location.pathname);
  }
  async function resumeRoom() {
    try {
      const saved = JSON.parse(
        sessionStorage.getItem('imperio-session') || 'null',
      );
      if (!saved) return;
      const r = await request(`/api/${saved.code}`, undefined, saved.token);
      setToken(saved.token);
      setRoom(r);
      history.replaceState(null, '', `?sala=${saved.code}`);
    } catch {
      setError('No se pudo recuperar la sala. Comprueba la conexión.');
    }
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
  return (
    <>
      <header className="topbar">
        {!room && (
          <button title={music.status} onClick={music.toggle}>
            {music.playing ? '♫ Pausar música' : '♫ Reproducir música'}
          </button>
        )}
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
        {room && (
          <button onClick={leaveRoom}>
            <LogOut size={16} /> Volver al menú
          </button>
        )}
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
          {canResume && (
            <button className="primary" onClick={() => void resumeRoom()}>
              Volver a mi partida
            </button>
          )}
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
        <>
          <output className="connection-state">
            {online
              ? ''
              : 'Reconectando… no repitas movimientos hasta recuperar la conexión.'}
          </output>
          <Arena
            room={room}
            act={act}
            busy={busy}
            onDeck={() => setDeck(true)}
            onCreate={newCard}
            onInvite={(watch) => void copy(watch)}
            onEdit={(c) => {
              setEditing(c.id);
              setDraft({
                name: c.name,
                type: c.type,
                effect: c.effect,
                race: c.race,
                cost: c.cost,
                strength: c.strength,
                zone: c.zone,
              });
              setEditor(true);
            }}
          />
        </>
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
                  reason: 'Carta creada manualmente',
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
          room &&
          room.role !== 'spectator' &&
          !room.players.find((p) => p.id === room.me)?.ready
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
            Después de repartir puedes hacer mulligan para robar una carta
            menos, y Volver a ocho una vez. Al comenzar se cierran estas
            opciones; la recarga del mazo sigue bloqueada tras repartir.
          </p>
          <p>
            Agrupación → Vigilia → Batalla Mitológica (Ataque, Bloqueo, Guerra
            de Talismanes y daño) → Final. Estas fases sirven como referencia:
            cualquier jugador puede elegir otra fase y terminar el turno sin que
            la mesa compruebe las condiciones. Robar permite resolver libremente
            los efectos. La agrupación se resuelve manualmente. Jugar desde la
            mano sugiere Vigilia; mover un aliado a la línea de ataque marca
            Ataque. Pueden corregir la fase en cualquier momento.
          </p>
          <p>
            Arrastra tus cartas entre cualquier zona. Comprueben entre ustedes
            los costes, el Oro de Vigilia, requisitos de ataque, prioridades y
            excepciones.
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
            permite arrastrar cartas, equipar armas, marcar ataques y bloqueos,
            barajar, robar y botar. Cada zona y cada carta abre sus detalles en
            una ventana flotante. Al mover un portador fuera de las líneas de
            batalla, sus armas lo acompañan; corrige manualmente cualquier
            excepción.
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
