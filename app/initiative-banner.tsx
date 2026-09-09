'use client';
import { useEffect, useState } from 'react';
import type { Room } from './page';
import { playerColor } from './player-colors';
export default function InitiativeBanner({ room }: { room: Room }) {
  const [now, setNow] = useState(room.serverTime);
  useEffect(() => {
    const offset = room.serverTime - Date.now();
    const timer = setInterval(() => setNow(Date.now() + offset), 100);
    return () => clearInterval(timer);
  }, [room.serverTime]);
  const event = room.initiative;
  if (!event || now > event.endsAt) return null;
  const round = Math.min(
      event.rounds.length - 1,
      Math.max(0, Math.floor((now - event.startedAt) / 4400)),
    ),
    settled = now - event.startedAt - round * 4400 >= 3400,
    done = settled && round === event.rounds.length - 1;
  return (
    <div className="initiative-overlay" aria-live="polite">
      <div className="initiative-heading">
        <small>INICIO DE LA PARTIDA · D20</small>
        <h2>
          {done
            ? room.players.find((p) => p.id === event.winner)?.name +
              ' comienza'
            : round
              ? 'Desempate · vuelven a tirar'
              : '¿Quién comienza?'}
        </h2>
      </div>
      <div className="initiative-results">
        {event.rounds[round].map((r) => (
          <div
            key={r.player}
            className={done && r.player === event.winner ? 'winner' : ''}
            style={{ borderColor: playerColor(room, r.player) }}
          >
            <i style={{ background: playerColor(room, r.player) }} />
            <span>{room.players.find((p) => p.id === r.player)?.name}</span>
            <strong>{settled ? r.value : '…'}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}
