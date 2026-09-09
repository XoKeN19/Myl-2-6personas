'use client';
import { useEffect, useRef, useState } from 'react';
import type { Room } from './page';
const phases = [
  'Agrupación',
  'Vigilia',
  'Ataque',
  'Bloqueo',
  'Guerra de Talismanes',
  'Asignación de daño',
  'Final',
];
export default function TableFeedback({
  room,
  play,
  reduced,
}: {
  room: Room;
  play: (kind: 'low' | 'turn') => void;
  reduced: boolean;
}) {
  const node = useRef<HTMLDivElement>(null),
    phaseBefore = useRef(room.phase + room.turn),
    previousDamage = useRef(
      new Set([room.log[0]?.id, ...(room.combatEvents || []).map((e) => e.id)]),
    );
  const damageTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => damageTimers.current.forEach(clearTimeout), []);
  const castle = room.players
    .find((p) => p.id === room.me)
    ?.cards.filter((c) => c.zone === 'castillo').length;
  const previousCastle = useRef(castle),
    [announcement, setAnnouncement] = useState(''),
    [damage, setDamage] = useState(0);
  useEffect(() => {
    const key = room.phase + room.turn;
    if (phaseBefore.current === key) return;
    phaseBefore.current = key;
    const start = setTimeout(() => setAnnouncement(room.phase), 0);
    play('turn');
    const timer = setTimeout(() => setAnnouncement(''), 1800);
    return () => {
      clearTimeout(start);
      clearTimeout(timer);
    };
  }, [room.phase, room.turn, play]);
  const event = room.combatEvents?.filter((e) => e.target === room.me).at(-1);
  const latest = room.log[0],
    me = room.players.find((p) => p.id === room.me),
    manual =
      me && latest?.message.startsWith(me.name + ':')
        ? latest.message.match(/botó (\d+) carta\(s\) de su Castillo/)
        : null;
  const eventId = manual ? latest.id : event?.id,
    damageCards = manual ? Number(manual[1]) : event?.cards;
  useEffect(() => {
    if (!eventId || previousDamage.current.has(eventId)) return;
    previousDamage.current.add(eventId);
    if (!damageCards || damageCards <= 0) return;
    damageTimers.current.forEach(clearTimeout);
    damageTimers.current = [
      setTimeout(() => setDamage(damageCards), 0),
      setTimeout(() => setDamage(0), 1800),
    ];
    if (!reduced)
      node.current
        ?.closest('.arena')
        ?.querySelector('.babylon-stage')
        ?.animate(
          [
            { transform: 'translate(0)' },
            { transform: 'translate(-5px,2px)' },
            { transform: 'translate(4px,-2px)' },
            { transform: 'translate(-2px,1px)' },
            { transform: 'translate(0)' },
          ],
          { duration: 320 },
        );
  }, [eventId, damageCards, reduced]);
  useEffect(() => {
    const old = previousCastle.current;
    previousCastle.current = castle;
    if (
      castle !== undefined &&
      old !== undefined &&
      castle > 0 &&
      ((old > 10 && castle <= 10) || (old > 5 && castle <= 5))
    )
      play('low');
  }, [castle, play]);
  return (
    <div ref={node} className="table-feedback">
      <nav className="phase-timeline" aria-label="Fases de la partida">
        {phases.map((phase, i) => (
          <div
            key={phase}
            aria-current={room.phase === phase ? 'step' : undefined}
            className={
              room.phase === phase
                ? 'current'
                : i < phases.indexOf(room.phase)
                  ? 'past'
                  : ''
            }
          >
            <span>
              {phase === 'Guerra de Talismanes'
                ? 'Guerra'
                : phase === 'Asignación de daño'
                  ? 'Daño'
                  : phase}
            </span>
            <i />
          </div>
        ))}
      </nav>
      {announcement && (
        <output className="phase-announcement" key={room.phase + room.turn}>
          <small>
            {room.active === room.me
              ? 'TU TURNO'
              : 'TURNO DE ' +
                room.players.find((p) => p.id === room.active)?.name}
          </small>
          <strong>{announcement}</strong>
        </output>
      )}
      {damage > 0 && (
        <output className="castle-damage" key={event?.id}>
          <small>CASTILLO</small>
          <strong>−{damage}</strong>
        </output>
      )}
      {castle !== undefined && castle > 0 && castle <= 10 && (
        <output className="castle-low">
          Castillo en peligro · {castle} cartas
        </output>
      )}
    </div>
  );
}
