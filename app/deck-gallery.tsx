'use client';
/* eslint-disable @next/next/no-img-element -- Photos are locally compressed data URLs. */
import { useState, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import CardPhoto, { type CardPhotoHandle } from './card-photo';
import { cardImageUrl } from './card-images';
type Card = {
  name: string;
  type: string;
  cost: number;
  strength: number;
  effect: string;
  race: string;
  image?: string;
};
export default function DeckGallery({
  cards,
  onSave,
}: {
  cards: Card[];
  onSave: (index: number, card: Card, all: boolean) => Promise<void>;
}) {
  const photo = useRef<CardPhotoHandle>(null);
  const [index, setIndex] = useState<number | null>(null),
    [draft, setDraft] = useState<Card | null>(null),
    [all, setAll] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  return (
    <section>
      <p>
        Pulsa una carta para personalizarla. Al guardar, queda en Mis mazos con
        su foto.
      </p>
      <div className="deck-gallery">
        {cards.map((c, i) => (
          <button
            className="deck-gallery-card"
            key={i}
            aria-label={`Personalizar ${i + 1}: ${c.name}`}
            onClick={() => {
              setIndex(i);
              setDraft({ ...c });
              setError('');
            }}
          >
            {c.image ? (
              <img src={cardImageUrl(c.image)} alt={c.name} loading="lazy" decoding="async" />
            ) : (
              <>
                <small>
                  {c.type} · Coste {c.cost}
                </small>
                <strong>{c.name}</strong>
                <span className="gallery-symbol">
                  {c.type === 'Oro' ? '◈' : '⚔'}
                </span>
                <small>{c.race}</small>
                <p>{c.effect || 'Sin habilidad'}</p>
                <b>
                  {c.type === 'Aliado' ? `Fuerza ${c.strength}` : 'IMPERIO'}
                </b>
              </>
            )}
            <span className="gallery-caption">
              {i + 1}. {c.name} · {c.image ? 'Editar foto' : 'Añadir foto'}
            </span>
          </button>
        ))}
      </div>
      <Dialog
        open={index !== null}
        onOpenChange={(v) => {
          if (!v && !busy) setIndex(null);
        }}
      >
        <DialogContent className="modal">
          <DialogTitle>Personalizar {draft?.name}</DialogTitle>
          <DialogDescription>
            Añade la carátula y guarda sin modificar el JSON a mano.
          </DialogDescription>
          {draft && (
            <>
              <CardPhoto
                ref={photo}
                key={index}
                value={draft.image}
                onChange={(image) => setDraft({ ...draft, image })}
              />
              <p>{draft.effect || 'Sin habilidad'}</p>
              <label>
                <input
                  type="checkbox"
                  checked={all}
                  onChange={(e) => setAll(e.target.checked)}
                />{' '}
                Usar esta foto en todas las copias de esta carta
              </label>
              {error && <p role="alert">{error}</p>}
              <button
                className="primary"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    const image = await photo.current?.prepare();
                    await onSave(index!, { ...draft, image }, all);
                    setIndex(null);
                  } catch (e) {
                    setError((e as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {busy ? 'Guardando…' : 'Guardar carta y mazo en este navegador'}
              </button>
              <button disabled={busy} onClick={() => setIndex(null)}>
                Cancelar
              </button>
            </>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
