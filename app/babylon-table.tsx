'use client';
/* oxlint-disable next/no-img-element -- Deck photos are local data URLs, already compressed on import. */

import { useEffect, useRef, useState } from 'react';
import type { Card, Player, Room } from './page';
import type { TableRuntime, TableSnapshot } from './babylon/runtime';
import { cardImageUrl } from './card-images';

export type TableCallbacks = {
  select: (card: Card, player: Player) => void;
  pile: (player: Player, zone: string) => void;
  move: (
    card: Card,
    player: Player,
    zone: string,
    recipient: Player,
  ) => Promise<unknown>;
  playCard: (card: Card, player: Player) => void;
  draw: () => void;
  shuffle: () => void;
  attack: (player: Player) => void;
  attach: (card: Card, host: Card) => void;
  sound: (kind: 'pick' | 'drop' | 'draw' | 'hover') => void;
  hover?: (card: Card | null) => void;
};

export default function BabylonTable({
  room,
  focus,
  busy,
  callbacks,
  fallback,
}: {
  room: Room;
  focus: string;
  busy: boolean;
  callbacks: TableCallbacks;
  fallback: () => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const runtime = useRef<TableRuntime | null>(null);
  const snapshot = useRef<TableSnapshot>({ room, focus, busy });
  const current = useRef(callbacks);
  const [status, setStatus] = useState('Preparando la mesa…');
  const [error, setError] = useState('');
  const [hand, setHand] = useState(true);
  const [preview, setPreview] = useState<Card | null>(null);
  useEffect(() => {
    current.current = callbacks;
  }, [callbacks]);
  useEffect(() => {
    snapshot.current = { room, focus, busy };
    runtime.current?.sync(snapshot.current);
  }, [room, focus, busy]);
  useEffect(() => {
    let disposed = false;
    import('./babylon/runtime')
      .then(({ createTable }) => {
        if (disposed || !canvas.current) return;
        try {
          const table = createTable(
            canvas.current,
            () => ({ ...current.current, hover: setPreview }),
            (message) => {
              if (!disposed) setError(message);
            },
          );
          runtime.current = table;
          table.sync(snapshot.current);
          setStatus('');
        } catch {
          setError(
            'No se pudo iniciar la mesa 3D. Puedes continuar en la vista clásica.',
          );
        }
      })
      .catch(() => {
        if (!disposed)
          setError(
            'No se pudo cargar la mesa. Recarga o usa la vista clásica.',
          );
      });
    return () => {
      disposed = true;
      runtime.current?.dispose();
      runtime.current = null;
    };
  }, []);
  const me = room.players.find((p) => p.id === room.me);
  return (
    <section className="babylon-stage" aria-label="Mesa de cartas 3D">
      {preview && !preview.hidden && (
        <aside
          className="card-hover-preview"
          aria-label="Vista ampliada de carta"
        >
          <strong>{preview.name}</strong>
          {preview.image ? (
            <img src={cardImageUrl(preview.image)} alt={preview.name} decoding="async" />
          ) : (
            <div className="card-preview-text">
              <b>
                {preview.type} · {preview.race}
              </b>
              <p>{preview.effect || 'Sin habilidad'}</p>
            </div>
          )}
          <footer>
            Coste {preview.cost}{' '}
            {preview.type === 'Aliado' && ' · Fuerza ' + preview.strength}
          </footer>
        </aside>
      )}
      <canvas
        ref={canvas}
        className="babylon-canvas"
        tabIndex={0}
        aria-label="Tablero 3D. Arrastra cartas para moverlas; pulsa una carta para sus acciones."
      />
      {status && !error && <output className="scene-loading">{status}</output>}
      {error && (
        <div className="scene-loading" role="alert">
          <p>{error}</p>
          <button onClick={fallback}>Usar vista clásica</button>
        </div>
      )}
      <div className="scene-camera" aria-label="Cámara">
        <button
          aria-label="Acercar cámara"
          onClick={() => runtime.current?.zoom(-2)}
        >
          ＋
        </button>
        <button
          aria-label="Alejar cámara"
          onClick={() => runtime.current?.zoom(2)}
        >
          −
        </button>
        <button onClick={() => runtime.current?.resetCamera()}>
          Centrar mesa
        </button>
      </div>
      <div className="scene-hint">
        Arrastra · Doble clic para jugar · Clic derecho para leer
      </div>
      {me && (
        <div className="scene-hand-controls">
          <button
            aria-pressed={hand}
            onClick={() => {
              setHand(!hand);
              runtime.current?.showHand(!hand);
            }}
          >
            {hand ? 'Ocultar mano' : 'Mostrar mano'} ·{' '}
            {me.cards.filter((c) => c.zone === 'mano').length}
          </button>
          <button onClick={() => callbacks.pile(me, 'mano')}>
            Ver mano y acciones
          </button>
          <button onClick={() => callbacks.pile(me, 'castillo')}>
            Castillo
          </button>
        </div>
      )}
    </section>
  );
}
