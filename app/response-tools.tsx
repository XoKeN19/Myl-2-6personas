'use client';
import { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import type { Room } from './page';
type Props = {
  room: Room;
  act: (a: Record<string, unknown>) => Promise<unknown>;
  busy: boolean;
  play: (kind: 'attack' | 'alarm' | 'request' | 'defeat' | 'victory') => void;
};
export default function ResponseTools({ room, act, busy, play }: Props) {
  const battle = room.pendingBattles?.find((b) => b.target === room.me);
  const [snoozed, setSnoozed] = useState(''),
    [choices, setChoices] = useState<
      Record<string, { blocker: string; damage: number }>
    >({});
  const me = room.players.find((p) => p.id === room.me),
    attacker = room.players.find((p) => p.id === battle?.attacker);
  const blockers =
    me?.cards.filter((c) => c.zone === 'defensa' && c.type === 'Aliado') || [];
  const rows =
    battle?.rows.map((row) => {
      const live = attacker?.cards.find(
        (c) => c.id === row.cardId && c.zone === 'ataque',
      );
      return {
        ...row,
        ...(choices[battle.id + row.cardId] || {
          blocker: '',
          damage: live?.strength || 0,
        }),
      };
    }) || [];
  const [closedReveal, setClosedReveal] = useState(''),
    [closedDefeat, setClosedDefeat] = useState('');
  const reveal = room.revealEvent;
  const eliminated = room.defeated || [];
  const survivors = room.players.filter(p => !eliminated.some(d => d.id === p.id));
  const lost = eliminated.some(p => p.id === room.me);
  const winner = room.players.length > 1 && eliminated.length > 0 && survivors.length === 1 ? survivors[0] : undefined;
  const won = winner?.id === room.me && !!me;
  const watching = !me && !!winner;
  const defeat = lost ? `defeat:${room.me}` : won || watching ? `victory:${winner!.id}` : '';
  const last = useRef(new Set<string>());
  useEffect(() => {
    const events = [
      { key: reveal?.id, sound: 'request' as const },
      { key: battle?.id, sound: 'attack' as const },
      { key: defeat, sound: won || watching ? 'victory' as const : 'defeat' as const },
    ].filter((event) => event.key && !last.current.has(event.key));
    for (const event of events) last.current.add(event.key!);
    if (events.length) {
      play(events[events.length - 1].sound);
    }
  }, [defeat, won, watching, battle, reveal?.id, play]);
  return (
    <>
      {battle && (
        <button className="pending-response" onClick={() => setSnoozed('')}>
          ⚔ Responder a {battle.attackerName}
        </button>
      )}
      <div className="waiting-battles">
      {room.pendingBattles
        ?.filter((b) => b.attacker === room.me)
        .map((b) => (
          <div className="waiting-battle" key={b.id}>
            Esperando respuesta de{' '}
            {room.players.find((p) => p.id === b.target)?.name}{' '}
            <button
              disabled={busy}
              onClick={() => void act({ type: 'cancelStrike', battleId: b.id })}
            >
              Cancelar ataque
            </button>
          </div>
        ))}
      </div>
      <Dialog
        open={!!battle && snoozed !== battle.id}
        onOpenChange={(v) => {
          if (!v && battle) setSnoozed(battle.id);
        }}
      >
        <DialogContent className="modal">
          <DialogTitle>{battle?.attackerName} te ataca</DialogTitle>
          <DialogDescription>
            Escoge bloqueadores y cuánto daño entra de cada atacante. Sin
            bloqueador se propone el daño completo. Puedes jugar efectos antes
            de confirmar; las bajas y habilidades especiales se resuelven
            manualmente.
          </DialogDescription>
          <div className="battle-choices">
            {rows.map((row) => (
              <div key={row.cardId} className="defend-row">
                <strong>
                  {row.name} · Fuerza{' '}
                  {attacker?.cards.find((c) => c.id === row.cardId)?.strength ||
                    0}
                </strong>
                <label>
                  Bloquear con
                  <select
                    aria-label={'Bloquear ' + row.name}
                    value={row.blocker}
                    onChange={(e) => {
                      const blocker = blockers.find(
                        (c) => c.id === e.target.value,
                      );
                      const force =
                        attacker?.cards.find(
                          (c) => c.id === row.cardId && c.zone === 'ataque',
                        )?.strength || 0;
                      setChoices({
                        ...choices,
                        [battle!.id + row.cardId]: {
                          blocker: e.target.value,
                          damage: Math.max(0, force - (blocker?.strength || 0)),
                        },
                      });
                    }}
                  >
                    <option value="">Sin bloqueo</option>
                    {blockers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} · {c.strength}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Daño que entra
                  <input
                    aria-label={'Daño de ' + row.name}
                    type="number"
                    min={0}
                    max={999}
                    value={row.damage}
                    onChange={(e) =>
                      setChoices({
                        ...choices,
                        [battle!.id + row.cardId]: {
                          blocker: row.blocker,
                          damage: Number(e.target.value),
                        },
                      })
                    }
                  />
                </label>
              </div>
            ))}
          </div>
          <div className="actions">
            <button onClick={() => setSnoozed(battle!.id)}>
              Jugar efectos / revisar mesa
            </button>
            <button
              disabled={busy}
              onClick={() =>
                void act({ type: 'cancelStrike', battleId: battle!.id })
              }
            >
              Cancelar todo el daño
            </button>
            <button
              className="primary"
              disabled={busy}
              onClick={() =>
                void act({
                  type: 'defend',
                  battleId: battle!.id,
                  rows: rows.map((r) => ({
                    cardId: r.cardId,
                    blocker: r.blocker,
                    damage: r.damage,
                  })),
                })
              }
            >
              Confirmar · botar {rows.reduce((n, r) => n + r.damage, 0)}
            </button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!reveal && closedReveal !== reveal.id && !battle}
        onOpenChange={(v) => {
          if (!v && reveal) setClosedReveal(reveal.id);
        }}
      >
        <DialogContent className="modal">
          <DialogTitle>{reveal?.name} te muestra estas cartas</DialogTitle>
          <DialogDescription>
            {reveal?.found
              ? 'Se encontró un Aliado.'
              : 'No se encontró ningún Aliado.'}{' '}
            Las cartas conservan su orden en el Castillo.
          </DialogDescription>
          <div className="revealed-display">
            {reveal?.cards.map((c, i) => (
              <article key={c.id}>
                <small>
                  {i + 1} · {c.type} · Coste {c.cost}
                </small>
                <strong>{c.name}</strong>
                <p>{c.effect}</p>
              </article>
            ))}
          </div>
          <button onClick={() => setClosedReveal(reveal!.id)}>Entendido</button>
        </DialogContent>
      </Dialog>
      {defeat && closedDefeat !== defeat && (
        <div className={`game-over ${lost ? 'defeat-result' : 'victory-result'}`} role="alert">
          <small>{lost ? 'TU CASTILLO HA CAÍDO' : watching ? 'LA PARTIDA HA TERMINADO' : 'TU CASTILLO SIGUE EN PIE'}</small>
          <h1>{lost ? 'DERROTA' : 'VICTORIA'}</h1>
          <p>{lost ? `${me?.name} · Castillo vacío` : `${winner?.name} gana la partida`}</p>
          <button onClick={() => setClosedDefeat(defeat)}>
            Volver a la mesa
          </button>
        </div>
      )}
    </>
  );
}
