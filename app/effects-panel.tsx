'use client';

import { useState } from 'react';

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

import { Checkbox } from '@/components/ui/checkbox';

type C = {
  id: string;

  name: string;

  zone: string;

  type: string;

  cost: number;

  strength: number;

  effect: string;

  hidden?: boolean;
};

type R = {
  me: string | null;

  role: string;

  phase: string;

  players: { id: string; name: string; cards: C[]; temporaryGold?: number }[];

  privateCards: C[];

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
};

const zones = {
  mano: 'Mano',

  castillo: 'Castillo',

  defensa: 'Defensa',

  ataque: 'Ataque',

  apoyo: 'Apoyo / Armas',

  reserva: 'Reserva',

  pagado: 'Oro pagado',

  cementerio: 'Cementerio',

  destierro: 'Destierro',

  consulta: 'Consulta privada',
};

const operations = {
  move: 'Mover / jugar por efecto',

  reveal: 'Mostrar a todos',

  hide: 'Dejar de mostrar',

  shuffle: 'Devolver al Castillo y barajar',

  top: 'Poner en el tope, en este orden',

  bottom: 'Poner al fondo, en este orden',

  destroy: 'Destruir',

  banish: 'Desterrar',

  strength: 'Modificar fuerza',

  status: 'Aplicar / quitar estado',

  transform: 'Transformar carta',

  attach: 'Equipar por efecto / Exhumar',

  give: 'Cambiar controlador',

  cancelAttack: 'Cancelar ataque',

  ready: 'Agrupar seleccionadas',

  forceBlock: 'Elegir bloqueador / Retador',
};

const statuses = {
  furia: 'Furia',

  indestructible: 'Indestructible',

  indesterrable: 'Indesterrable',

  imbloqueable: 'Imbloqueable',

  sinHabilidad: 'Sin habilidad',

  noAtacaBloquea: 'No puede atacar ni bloquear',

  protegido: 'Protegido (recordatorio)',

  noJugable: 'No puede jugarse',
};

function Pick({
  label,

  value,

  onChange,

  items,
}: {
  label: string;

  value: string;

  onChange: (v: string) => void;

  items: Record<string, string>;
}) {
  return (
    <label>
      {label}

      <Select value={value} onValueChange={(v) => v && onChange(v)}>
        <SelectTrigger aria-label={label} className="choice">
          <SelectValue>{items[value] || 'Seleccionar'}</SelectValue>
        </SelectTrigger>

        <SelectContent>
          {Object.entries(items).map(([v, t]) => (
            <SelectItem key={v} value={v}>
              {t}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  );
}

export default function Effects({
  room,

  act,

  busy,
  selectedCard,
  onCastle,
}: {
  room: R;

  act: (a: Record<string, unknown>) => Promise<unknown>;

  busy: boolean;

  selectedCard?: C;
  onCastle?: () => void;
}) {
  const [open, setOpen] = useState(false),
    [reason, setReason] = useState(''),
    [playerId, setPlayerId] = useState(''),
    [zone, setZone] = useState('cementerio'),
    [operation, setOperation] = useState('shuffle'),
    [ids, setIds] = useState<string[]>([]),
    [dest, setDest] = useState('mano'),
    [count, setCount] = useState(3),
    [delta, setDelta] = useState(1),
    [until, setUntil] = useState('permanent'),
    [status, setStatus] = useState('indestructible'),
    [enabled, setEnabled] = useState('yes'),
    [cardType, setCardType] = useState('Arma'),
    [strength, setStrength] = useState(0),
    [effect, setEffect] = useState(''),
    [traits, setTraits] = useState<string[]>([]),
    [hostId, setHostId] = useState(''),
    [recipient, setRecipient] = useState(''),
    [limit, setLimit] = useState(1),
    [ability, setAbility] = useState('principal'),
    [attackerId, setAttackerId] = useState(''),
    [durationPlayer, setDurationPlayer] = useState('');

  const current = playerId || room.me || '',
    p = room.players.find((p) => p.id === current),
    own = current === room.me;

  const available =
    zone === 'consulta'
      ? room.inspection?.owner === current
        ? room.privateCards
        : []
      : p?.cards.filter((c) => c.zone === zone && !c.hidden) || [];

  const selected = ids.filter((id) => available.some((c) => c.id === id));

  const owners = Object.fromEntries(room.players.map((p) => [p.id, p.name]));

  const send = async (a: Record<string, unknown>) => {
    const r = await act(a);

    if (r) setIds([]);

    return r;
  };

  function reorder(id: string, d: number) {
    const a = [...selected],
      i = a.indexOf(id),
      j = i + d;

    if (j < 0 || j >= a.length) return;

    [a[i], a[j]] = [a[j], a[i]];

    setIds(a);
  }

  if (room.role === 'spectator') return null;

  const selectedText = selectedCard?.effect.toLocaleLowerCase('es') || '';

  const openSelected = (preset?: string) => {
    if (!selectedCard) return;

    setReason(selectedCard.name);

    if (preset === 'castillo' && onCastle) {
      onCastle();
      return;
    }
    if (preset === 'transform') {
      setPlayerId(room.me || '');
      setZone(selectedCard.zone);
      setIds([selectedCard.id]);
      setOperation('transform');
      const grifo = /grifo/i.test(selectedCard.name);
      setCardType(
        grifo
          ? 'Aliado'
          : /orical/i.test(selectedCard.name)
            ? 'Arma'
            : selectedCard.type,
      );
      setStrength(grifo ? 4 : selectedCard.strength);
      setEffect(grifo ? 'Indestructible. Indesterrable.' : selectedCard.effect);
      setTraits(grifo ? ['indestructible', 'indesterrable'] : []);
      setUntil(grifo ? 'nextTurn' : 'permanent');
    }
    if (preset === 'castillo') {
      setPlayerId(room.me || '');
      setZone('castillo');
    }

    if (preset === 'cementerio') {
      setPlayerId(room.me || '');
      setZone('cementerio');
    }

    if (preset === 'desterrar') setOperation('banish');

    if (preset === 'barajar') setOperation('shuffle');

    setOpen(true);
  };

  return (
    <section className="panel">
      <h3>Habilidades y efectos</h3>

      <button className="primary wide" onClick={() => setOpen(true)}>
        Resolver un efecto
      </button>

      {selectedCard && (
        <div className="effect-shortcuts">
          <strong>{selectedCard.name}</strong>
          <div className="actions">
            <button onClick={() => openSelected()}>Resolver esta carta</button>
            <button onClick={() => openSelected('transform')}>
              Transformar esta carta
            </button>
            {selectedText.includes('roba') &&
              [1, 2, 3].map((amount) => (
                <button
                  key={amount}
                  disabled={busy}
                  onClick={() =>
                    act({
                      type: 'effectDraw',
                      count: amount,
                      reason: selectedCard.name,
                    })
                  }
                >
                  Robar {amount}
                </button>
              ))}
            {selectedText.includes('castillo') && (
              <button onClick={() => openSelected('castillo')}>
                Buscar / mirar Castillo
              </button>
            )}
            {selectedText.includes('cementerio') && (
              <button onClick={() => openSelected('cementerio')}>
                Elegir del Cementerio
              </button>
            )}
            {selectedText.includes('destierra') && (
              <button onClick={() => openSelected('desterrar')}>
                Elegir para Destierro
              </button>
            )}
            {selectedText.includes('baraja') && (
              <button onClick={() => openSelected('barajar')}>
                Elegir para barajar
              </button>
            )}
          </div>
        </div>
      )}

      {room.requests.length > 0 && (
        <p className="hint">
          {room.requests.length} solicitud(es) de efecto o consulta.
        </p>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="modal effect-modal">
          <DialogTitle>Resolver habilidades</DialogTitle>

          <DialogDescription>
            Selecciona cartas y ejecuta el efecto indicado. Las condiciones y
            costes del texto se acuerdan entre jugadores. Las cartas ajenas
            requieren aprobación.
          </DialogDescription>

          <label>
            Nombre de la carta y efecto que estás resolviendo
            <input
              maxLength={500}

              value={reason}

              onChange={(e) => setReason(e.target.value)}

              placeholder="Ej.: Karna — buscar un Aliado"
            />
          </label>

          {room.requests.length > 0 && (
            <section className="requests">
              <h3>Solicitudes</h3>

              {room.requests.map((r) => (
                <div key={r.id}>
                  <p>
                    {owners[r.actor]} → {owners[r.owner]}: {r.reason}
                    <br />
                    {r.kind === 'look'
                      ? `Mirar ${r.zone}`
                      : `${r.operation} · ${r.count} cartas`}
                  </p>

                  {r.owner === room.me && (
                    <button
                      disabled={busy}

                      onClick={() =>
                        act({
                          type:
                            r.kind === 'look' ? 'grantLook' : 'approveEffect',

                          requestId: r.id,
                        })
                      }
                    >
                      Autorizar
                    </button>
                  )}

                  <button
                    disabled={busy}

                    onClick={() =>
                      act({ type: 'denyRequest', requestId: r.id })
                    }
                  >
                    Rechazar / cancelar
                  </button>
                </div>
              ))}
            </section>
          )}

          <Pick
            label="Cartas de"

            value={current}

            onChange={(v) => {
              setPlayerId(v);

              setIds([]);
            }}

            items={owners}
          />

          <div className="fields">
            <Pick
              label="Zona"

              value={zone}

              onChange={(v) => {
                setZone(v);

                setIds([]);
              }}

              items={zones}
            />

            <label>
              Cantidad para mirar el tope / robar
              <input
                type="number"

                min={1}

                max={50}

                value={count}

                onChange={(e) => setCount(Number(e.target.value))}
              />
            </label>
          </div>

          <div className="actions">
            {own ? (
              <>
                <button
                  disabled={busy || !reason.trim()}

                  onClick={async () => {
                    if (
                      await send({
                        type: 'look',

                        zone: 'castillo',

                        mode: 'all',

                        reason,
                      })
                    )
                      setZone('consulta');
                  }}
                >
                  Buscar en mi Castillo
                </button>

                <button
                  disabled={busy || !reason.trim()}

                  onClick={async () => {
                    if (
                      await send({
                        type: 'look',

                        zone: 'castillo',

                        mode: 'top',

                        count,

                        reason,
                      })
                    )
                      setZone('consulta');
                  }}
                >
                  Mirar primeras {count}
                </button>

                <button
                  disabled={busy || !reason.trim()}

                  onClick={() => act({ type: 'effectDraw', count, reason })}
                >
                  Robar {count} por efecto
                </button>
              </>
            ) : (
              <>
                <button
                  disabled={busy || !reason.trim()}

                  onClick={() =>
                    act({
                      type: 'requestLook',

                      playerId: current,

                      zone: 'mano',

                      reason,
                    })
                  }
                >
                  Pedir mirar mano
                </button>

                <button
                  disabled={busy || !reason.trim()}

                  onClick={() =>
                    act({
                      type: 'requestLook',

                      playerId: current,

                      zone: 'castillo',

                      reason,
                    })
                  }
                >
                  Pedir buscar en Castillo
                </button>
              </>
            )}

            <button
              disabled={!room.inspection}

              onClick={() => send({ type: 'closeLook' })}
            >
              Cerrar consulta
            </button>

            <button onClick={() => send({ type: 'revokeLook' })}>
              Retirar permisos sobre mis cartas
            </button>
          </div>

          {room.inspection && (
            <p className="hint">
              Consulta privada de {owners[room.inspection.owner]} ·{' '}
              {room.inspection.zone}. Elige «Consulta privada» para
              seleccionarlas. Sólo tú puedes ver esta consulta. Se cierra al
              cambiar el turno.
            </p>
          )}

          <div className="selection-list">
            {available.length ? (
              available.map((c) => (
                <label
                  key={c.id}

                  htmlFor={`effect-${c.id}`}

                  className="selection-row"
                >
                  <Checkbox
                    id={`effect-${c.id}`}

                    checked={selected.includes(c.id)}

                    onCheckedChange={(v) =>
                      setIds(
                        v
                          ? [...selected, c.id]
                          : selected.filter((id) => id !== c.id),
                      )
                    }
                  />

                  <span>
                    <strong>{c.name}</strong>

                    <small>
                      {c.type} · Coste {c.cost} · Fuerza {c.strength}
                    </small>

                    <span className="effect-snippet">{c.effect}</span>
                  </span>
                </label>
              ))
            ) : (
              <p className="hint">
                No hay cartas visibles en esta selección. Para el Castillo, usa
                Buscar o Mirar el tope. Para cartas privadas del rival, pide
                permiso.
              </p>
            )}
          </div>

          <div className="actions">
            <button onClick={() => setIds(available.map((c) => c.id))}>
              Seleccionar todas ({available.length})
            </button>

            <button onClick={() => setIds([])}>Limpiar</button>
          </div>

          <Pick
            label="Acción"

            value={operation}

            onChange={setOperation}

            items={operations}
          />

          {['move', 'give'].includes(operation) && (
            <Pick
              label="Destino"

              value={dest}

              onChange={setDest}

              items={Object.fromEntries(
                Object.entries(zones).filter(([z]) => z !== 'consulta'),
              )}
            />
          )}

          {['top', 'bottom'].includes(operation) && (
            <div>
              <p>
                Primera de la lista = primera del tope o del grupo al fondo.
              </p>

              {selected.map((id) => (
                <div className="order-row" key={id}>
                  <span>{available.find((c) => c.id === id)?.name}</span>

                  <button
                    onClick={() => reorder(id, -1)}

                    aria-label="Mover antes"
                  >
                    ↑
                  </button>

                  <button
                    onClick={() => reorder(id, 1)}

                    aria-label="Mover después"
                  >
                    ↓
                  </button>
                </div>
              ))}
            </div>
          )}

          {operation === 'strength' && (
            <label>
              Cambio de fuerza (por ejemplo 2 o -1)
              <input
                type="number"

                min={-999}

                max={999}

                value={delta}

                onChange={(e) => setDelta(Number(e.target.value))}
              />
            </label>
          )}

          {operation === 'status' && (
            <>
              <Pick
                label="Estado"

                value={status}

                onChange={setStatus}

                items={statuses}
              />

              <Pick
                label="Aplicar o quitar"

                value={enabled}

                onChange={setEnabled}

                items={{ yes: 'Aplicar', no: 'Quitar' }}
              />
            </>
          )}

          {['strength', 'status', 'transform'].includes(operation) && (
            <Pick
              label="Duración"

              value={until}

              onChange={setUntil}

              items={{
                permanent: 'Permanente / hasta que se retire',

                endTurn: 'Hasta que termine este turno',

                nextTurn: 'Hasta el próximo turno del jugador elegido',
              }}
            />
          )}

          {['strength', 'status', 'transform'].includes(operation) &&
            until === 'nextTurn' && (
              <Pick
                label="Hasta el próximo turno de"
                value={durationPlayer || room.me || ''}
                onChange={setDurationPlayer}
                items={owners}
              />
            )}

          {operation === 'transform' && (
            <>
              <div className="actions">
                {Object.entries(statuses).map(([key, label]) => (
                  <label key={key}>
                    <input
                      type="checkbox"
                      checked={traits.includes(key)}
                      onChange={(e) =>
                        setTraits(
                          e.target.checked
                            ? [...traits, key]
                            : traits.filter((x) => x !== key),
                        )
                      }
                    />
                    {label}
                  </label>
                ))}
              </div>
              <Pick
                label="Nuevo tipo"

                value={cardType}

                onChange={setCardType}

                items={Object.fromEntries(
                  ['Aliado', 'Arma', 'Tótem', 'Talismán', 'Oro'].map((t) => [
                    t,

                    t,
                  ]),
                )}
              />

              <label>
                Nueva fuerza base
                <input
                  type="number"

                  min={0}

                  max={999}

                  value={strength}

                  onChange={(e) => setStrength(Number(e.target.value))}
                />
              </label>

              <label>
                Nuevo efecto (vacío para quedar sin habilidad)
                <textarea
                  value={effect}

                  onChange={(e) => setEffect(e.target.value)}
                />
              </label>

              <p className="hint">
                Para Oricalón: transfórmalo en Arma y luego usa Equipar por
                efecto.
              </p>
            </>
          )}

          {operation === 'attach' && (
            <Pick
              label="Portador"

              value={hostId}

              onChange={setHostId}

              items={Object.fromEntries(
                (p?.cards || [])

                  .filter(
                    (c) =>
                      c.type === 'Aliado' &&
                      ['defensa', 'ataque'].includes(c.zone),
                  )

                  .map((c) => [c.id, c.name]),
              )}
            />
          )}

          {operation === 'give' && (
            <Pick
              label="Nuevo controlador"

              value={recipient}

              onChange={setRecipient}

              items={Object.fromEntries(
                room.players

                  .filter((p) => p.id !== current)

                  .map((p) => [p.id, p.name]),
              )}
            />
          )}

          {operation === 'forceBlock' && (
            <Pick
              label="Atacante que debe bloquear"

              value={attackerId}

              onChange={setAttackerId}

              items={Object.fromEntries(
                room.players

                  .flatMap((x) => x.cards)

                  .filter(
                    (c) =>
                      c.zone === 'ataque' &&
                      (c as C & { target?: string }).target === current,
                  )

                  .map((c) => [c.id, c.name]),
              )}
            />
          )}

          <button
            className="primary wide"

            disabled={busy || !reason.trim() || !selected.length}

            onClick={() =>
              send({
                type: own ? 'effect' : 'requestEffect',

                playerId: current,

                reason,

                ids: selected,

                operation,

                zone: dest,

                delta,

                until,

                status,

                enabled: enabled === 'yes',

                traits,
                cardType,

                strength,

                effect,

                hostId,

                recipient,

                attackerId,

                durationPlayer: durationPlayer || room.me,
              })
            }
          >
            {own ? 'Aplicar' : 'Pedir aprobación'} · {selected.length} carta(s)
          </button>

          <details>
            <summary>Contadores de habilidad y Oro temporal</summary>

            <p className="hint">
              Registra los usos de tus cartas (por ejemplo, Dampir hasta tres
              veces). Estos contadores se reinician al cambiar de turno.
            </p>

            <label>
              Nombre de la habilidad
              <input
                value={ability}

                onChange={(e) => setAbility(e.target.value)}
              />
            </label>

            <label>
              Límite por turno
              <input
                type="number"

                min={1}

                max={10}

                value={limit}

                onChange={(e) => setLimit(Number(e.target.value))}
              />
            </label>

            <button
              disabled={busy || !own || selected.length !== 1 || !reason.trim()}

              onClick={() =>
                act({
                  type: 'markUse',

                  cardId: selected[0],

                  ability,

                  limit,

                  reason,
                })
              }
            >
              Registrar uso
            </button>

            <p className="hint">
              Oro temporal propio:{' '}
              {room.players.find((p) => p.id === room.me)?.temporaryGold || 0}
            </p>

            <button
              disabled={!reason.trim()}

              onClick={() => act({ type: 'temporaryGold', delta: 1, reason })}
            >
              Generar un Oro temporal
            </button>

            <button
              disabled={!reason.trim()}

              onClick={() => act({ type: 'temporaryGold', delta: -1, reason })}
            >
              Gastar un Oro temporal
            </button>
          </details>

          <p className="hint">
            Sin habilidad y Protegido son recordatorios para resolver el texto
            manualmente. Indestructible, Indesterrable, Imbloqueable, Furia y No
            ataca/bloquea intervienen en las acciones básicas. Los aumentos de
            fuerza se suman al cálculo de combate.
          </p>
        </DialogContent>
      </Dialog>
    </section>
  );
}
