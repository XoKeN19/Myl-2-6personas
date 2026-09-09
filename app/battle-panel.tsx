'use client';
import { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import type { Room } from './page';
export function BattlePanel({
  room,
  open,
  onOpenChange,
  act,
  busy,
  preferredTarget,
}: {
  room: Room;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  act: (a: Record<string, unknown>) => Promise<unknown>;
  busy: boolean;
  preferredTarget?: string;
}) {
  const [picked, setPicked] = useState<Record<string, string>>({});
  const me = room.players.find((p) => p.id === room.me),
    rivals = room.players.filter((p) => p.id !== room.me);
  const cards =
    me?.cards.filter((c) => c.zone === 'ataque' && c.type === 'Aliado') || [];
  const selected = cards.filter(
    (c) => picked[c.id] && !room.struck?.includes(c.id),
  );
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="modal battle-panel">
        <DialogTitle>
          {preferredTarget
            ? 'Atacar a ' + rivals.find((p) => p.id === preferredTarget)?.name
            : 'Atacar con aliados'}
        </DialogTitle>
        <DialogDescription>
          Elige quién ataca a cada rival. El defensor puede bloquear o cancelar
          antes de confirmar. Fuerza seleccionada. Resuelvan bloqueos y
          prevenciones antes de aplicar este daño directo.
        </DialogDescription>
        <div className="battle-choices">
          {cards.map((c) => (
            <div className="battle-choice" key={c.id}>
              <label>
                <input
                  type="checkbox"
                  disabled={busy || room.struck?.includes(c.id)}
                  checked={!!picked[c.id] && !room.struck?.includes(c.id)}
                  onChange={(e) =>
                    setPicked({
                      ...picked,
                      [c.id]: e.target.checked
                        ? preferredTarget || c.target || rivals[0]?.id || ''
                        : '',
                    })
                  }
                />
                {c.name} · Fuerza {c.strength}
                {room.struck?.includes(c.id) ? ' · Ya aplicado' : ''}
              </label>
              <select
                aria-label={`Objetivo de ${c.name}`}
                disabled={!picked[c.id] || busy || room.struck?.includes(c.id)}
                value={picked[c.id] || preferredTarget || rivals[0]?.id || ''}
                onChange={(e) =>
                  setPicked({ ...picked, [c.id]: e.target.value })
                }
              >
                {rivals.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
        <div>
          {rivals.map((p) => {
            const damage = selected
              .filter((c) => picked[c.id] === p.id)
              .reduce((n, c) => n + c.strength, 0);
            return damage > 0 ? (
              <p key={p.id}>
                {p.name}: botar {damage} cartas
              </p>
            ) : null;
          })}
        </div>
        <button
          className="primary"
          disabled={busy || !selected.length || room.active !== room.me}
          onClick={async () => {
            if (
              await act({
                type: 'strike',
                assignments: selected.map((c) => ({
                  cardId: c.id,
                  target: picked[c.id],
                })),
              })
            ) {
              setPicked({});
              onOpenChange(false);
            }
          }}
        >
          Declarar ataque · {selected.reduce((n, c) => n + c.strength, 0)}
        </button>
      </DialogContent>
    </Dialog>
  );
}
export function BattleNotice({ room, play }: { room: Room; play: () => void }) {
  const event = room.combatEvents?.filter((e) => e.target === room.me).at(-1);
  const last = useRef(event?.id);
  const [dismissed, setDismissed] = useState(event?.id);
  useEffect(() => {
    if (event && last.current !== event.id) {
      last.current = event.id;
      play();
    }
  }, [event, play]);
  if (!event || dismissed === event.id) return null;
  return (
    <div className="attack-notice" key={event.id} role="alert">
      <strong>⚔ {event.attackerName} te atacó</strong>
      <span>
        {event.cards} cartas de tu Castillo fueron al Cementerio ·{' '}
        {event.damage} de daño.
      </span>
      <button onClick={() => setDismissed(event.id)}>Entendido</button>
    </div>
  );
}
