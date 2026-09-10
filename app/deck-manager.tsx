'use client';
import { useState, useEffect, useRef } from 'react';
import CardPhoto, { type CardPhotoHandle } from './card-photo';
import DeckGallery from './deck-gallery';
import { deckStorage } from './deck-storage';
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
type Entry = {
  id?: string;
  edition?: string;
  image?: string;
  name: string;
  type: string;
  effect: string;
  race: string;
  cost: number;
  strength: number;
};
type Deck = { version: 1; name: string; cards: Entry[] };
type CatalogCard = Entry & { id: string; edition: string };
const empty: Entry = {
  name: '',
  type: 'Aliado',
  effect: '',
  race: '',
  cost: 0,
  strength: 0,
};
const template = (): Entry[] =>
  Array.from({ length: 50 }, (_, i) => ({
    name: i < 14 ? `Oro ${i + 1}` : `Carta ${i + 1}`,
    type: i < 14 ? 'Oro' : i < 34 ? 'Aliado' : 'Talismán',
    effect: '',
    race: i >= 14 && i < 34 ? 'Guerrero' : '',
    cost: 0,
    strength: 0,
  }));
const key = 'imperio-decks-v1';
function parse(text: string): Deck {
  const raw = JSON.parse(text),
    cards = Array.isArray(raw) ? raw : raw.cards;
  if (!Array.isArray(cards) || cards.length > 250)
    throw Error('Usa una lista de hasta 250 cartas');
  for (const c of cards) {
    if (
      !c ||
      typeof c.name !== 'string' ||
      !['Aliado', 'Arma', 'Tótem', 'Talismán', 'Oro'].includes(c.type) ||
      !Number.isInteger(c.cost) ||
      c.cost < 0 ||
      !Number.isInteger(c.strength) ||
      c.strength < 0
    )
      throw Error('Revisa nombre, tipo, coste y fuerza de cada carta');
  }
  return {
    version: 1,
    name: typeof raw.name === 'string' ? raw.name : 'Mi mazo',
    cards: cards.map((c) => ({ ...empty, ...c })),
  };
}
export default function DeckManager({
  open,
  onOpenChange,
  loadRoom,
  importRoom,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  loadRoom?: () => Promise<unknown>;
  importRoom?: (d: Deck) => Promise<boolean>;
}) {
  const [text, setText] = useState('[]'),
    [personalize, setPersonalize] = useState(true),
    [editing, setEditing] = useState<number | null>(null),
    [name, setName] = useState('Mi mazo'),
    [library, setLibrary] = useState<Deck[]>([]),
    [draft, setDraft] = useState(empty),
    [quantity, setQuantity] = useState(1),
    [message, setMessage] = useState(''),
    [catalog, setCatalog] = useState<CatalogCard[] | null>(null),
    [catalogQuery, setCatalogQuery] = useState('');
  const photo = useRef<CardPhotoHandle>(null);
  useEffect(() => {
    if (open)
      queueMicrotask(async () => {
        try {
          const saved =
            (await deckStorage()) ??
            JSON.parse(localStorage.getItem(key) || '[]');
          setLibrary(Array.isArray(saved) ? saved : []);
        } catch {
          setMessage(
            'No se pudo leer la biblioteca local. Puedes importar un JSON.',
          );
        }
      });
  }, [open]);
  function current() {
    return { ...parse(text), name: name.trim() || 'Mi mazo' };
  }
  function run(fn: () => void) {
    try {
      fn();
    } catch (e) {
      setMessage((e as Error).message);
    }
  }
  function fill(d: Deck) {
    setEditing(null);
    setName(d.name);
    setText(JSON.stringify(d.cards, null, 2));
    setMessage(`${d.cards.length} cartas cargadas`);
  }
  async function openImperioCatalog() {
    try {
      if (!catalog) {
        const response = await fetch('/catalogs/myths-imperio.json');
        if (!response.ok) throw Error('No se pudo cargar el catálogo Imperio.');
        const data = (await response.json()) as { cards?: CatalogCard[] };
        setCatalog(data.cards || []);
      }
      setMessage('Catálogo Imperio listo: busca una carta y añádela al mazo.');
    } catch (e) {
      setMessage((e as Error).message);
    }
  }
  function addCatalogCard(card: CatalogCard) {
    run(() => {
      const deck = current();
      if (deck.cards.length >= 50)
        throw Error('El mazo ya tiene 50 cartas. Quita una antes de añadir otra.');
      const cards = [...deck.cards, { ...card }];
      setText(JSON.stringify(cards, null, 2));
      setMessage(`${card.name} añadida al mazo (${cards.length}/50).`);
    });
  }
  function exportFile() {
    run(() => {
      const d = current();
      const u = URL.createObjectURL(
        new Blob([JSON.stringify(d, null, 2)], { type: 'application/json' }),
      );
      const a = document.createElement('a');
      a.href = u;
      a.download = `${d.name.replace(/[^\p{L}\p{N}_-]/gu, '-')}.json`;
      a.click();
      URL.revokeObjectURL(u);
    });
  }
  let count = 0;
  try {
    count = parse(text).cards.length;
  } catch {}
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="modal deck-modal">
        <DialogTitle>Mis mazos</DialogTitle>
        <DialogDescription>
          Guarda mazos en este navegador o llévalos a otro equipo con un archivo
          JSON completo. La lista nunca revela el orden del Castillo en juego.
        </DialogDescription>
        {message && <output className="deck-message">{message}</output>}
        <div className="actions">
          <button
            onClick={() => document.getElementById('deck-json-import')?.click()}
          >
            Importar mi mazo JSON
          </button>
          <button
            aria-pressed={personalize}
            onClick={() => setPersonalize(!personalize)}
          >
            {personalize ? 'Ocultar vista de cartas' : 'Personalizar mazo'}
          </button>
          <button onClick={() => void openImperioCatalog()}>
            Explorar catálogo Imperio
          </button>
        </div>
        <label>
          Nombre del mazo
          <input
            maxLength={80}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <div className="actions">
          <button
            onClick={() =>
              fill({ version: 1, name: 'Mazo de prueba', cards: template() })
            }
          >
            Crear plantilla de 50
          </button>
          {loadRoom && (
            <button
              onClick={async () => {
                try {
                  fill((await loadRoom()) as Deck);
                } catch (e) {
                  setMessage((e as Error).message);
                }
              }}
            >
              Recuperar mazo completo de la sala
            </button>
          )}
          <button
            onClick={async () => {
              try {
                const d = current();
                const saved = [
                  d,
                  ...library.filter((x) => x.name !== d.name),
                ].slice(0, 30);
                await deckStorage(saved);
                setLibrary(saved);
                setMessage(`«${d.name}» guardado en este navegador`);
              } catch (e) {
                setMessage((e as Error).message);
              }
            }}
          >
            Guardar en mis mazos
          </button>
          <button onClick={exportFile}>Exportar JSON completo</button>
          <button
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(
                  JSON.stringify(current(), null, 2),
                );
                setMessage('JSON copiado');
              } catch (e) {
                setMessage(
                  `No se pudo copiar: ${(e as Error).message}. Usa Exportar.`,
                );
              }
            }}
          >
            Copiar JSON
          </button>
        </div>
        {catalog && (
          <section className="imperio-catalog">
            <div className="catalog-heading">
              <div>
                <h3>Catálogo Imperio · {catalog.length} cartas</h3>
                <p>Portadas autorizadas por el administrador de Myths.</p>
              </div>
              <button onClick={() => setCatalog(null)}>Cerrar catálogo</button>
            </div>
            <input
              aria-label="Buscar carta Imperio"
              value={catalogQuery}
              onChange={(e) => setCatalogQuery(e.target.value)}
              placeholder="Buscar por nombre, código, raza o edición"
            />
            <div className="imperio-catalog-grid">
              {catalog
                .filter((card) =>
                  `${card.id} ${card.name} ${card.race} ${card.edition}`
                    .toLocaleLowerCase('es')
                    .includes(catalogQuery.toLocaleLowerCase('es').trim()),
                )
                .slice(0, 80)
                .map((card) => (
                  <button
                    key={card.id}
                    className="imperio-catalog-card"
                    onClick={() => addCatalogCard(card)}
                    title={`Añadir ${card.name}`}
                  >
                    <img src={card.image} alt="" loading="lazy" />
                    <span>{card.id}</span>
                    <strong>{card.name}</strong>
                    <small>
                      {card.type} · {card.cost}
                      {card.type === 'Aliado' ? ` · ${card.strength} fuerza` : ''}
                    </small>
                  </button>
                ))}
            </div>
          </section>
        )}
        {library.length > 0 && (
          <section>
            <h3>Guardados en este navegador</h3>
            <div className="actions">
              {library.map((d, i) => (
                <button key={i} onClick={() => fill(d)}>
                  {d.name} · {d.cards.length}
                </button>
              ))}
            </div>
          </section>
        )}
        {personalize && count > 0 && (
          <DeckGallery
            cards={current().cards}
            onSave={async (index, card, all) => {
              const d = current();
              const original = d.cards[index];
              d.cards = d.cards.map((c, i) =>
                i === index
                  ? card
                  : all &&
                      c.name === original.name &&
                      c.type === original.type &&
                      c.effect === original.effect
                    ? { ...c, image: card.image }
                    : c,
              );
              const saved = [
                d,
                ...library.filter((x) => x.name !== d.name),
              ].slice(0, 30);
              await deckStorage(saved);
              setLibrary(saved);
              fill(d);
              setMessage(
                `«${d.name}» guardado con sus fotos en este navegador`,
              );
            }}
          />
        )}
        <label>
          Editar una carta del mazo
          <select
            aria-label="Editar carta del mazo"
            value={editing ?? ''}
            onChange={(e) =>
              run(() => {
                const index = e.target.value;
                setEditing(index === '' ? null : Number(index));
                setDraft(index === '' ? empty : current().cards[Number(index)]);
              })
            }
          >
            <option value="">Añadir una carta nueva</option>
            {(() => {
              try {
                return current().cards.map((c, i) => (
                  <option key={i} value={i}>
                    {i + 1}. {c.name}
                  </option>
                ));
              } catch {
                return null;
              }
            })()}
          </select>
        </label>
        <details open={editing !== null || undefined}>
          <summary>
            {editing !== null
              ? 'Editar carta seleccionada'
              : 'Añadir cartas al mazo'}
          </summary>
          <CardPhoto
            ref={photo}
            value={draft.image}
            onChange={(image) => setDraft({ ...draft, image })}
          />
          <label>
            Nombre
            <input
              maxLength={100}
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
          </label>
          <label htmlFor="deck-type">
            Tipo
            <Select
              value={draft.type}
              onValueChange={(v) => v && setDraft({ ...draft, type: v })}
            >
              <SelectTrigger
                id="deck-type"
                aria-label="Tipo de carta"
                className="choice"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {['Aliado', 'Arma', 'Tótem', 'Talismán', 'Oro'].map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
          <div className="fields">
            <label>
              Coste
              <input
                type="number"
                min={0}
                max={999}
                value={draft.cost}
                onChange={(e) =>
                  setDraft({ ...draft, cost: Number(e.target.value) })
                }
              />
            </label>
            <label>
              Fuerza base
              <input
                type="number"
                min={0}
                max={999}
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
              value={draft.race}
              onChange={(e) => setDraft({ ...draft, race: e.target.value })}
            />
          </label>
          <label>
            Efecto
            <textarea
              value={draft.effect}
              maxLength={3000}
              onChange={(e) => setDraft({ ...draft, effect: e.target.value })}
            />
          </label>
          <label>
            Copias
            <input
              type="number"
              min={1}
              max={50}
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
            />
          </label>
          <button
            disabled={!draft.name.trim()}
            onClick={async () => {
              try {
                const updated = {
                  ...draft,
                  image: await photo.current?.prepare(),
                };
                if (
                  !Number.isInteger(quantity) ||
                  quantity < 1 ||
                  quantity > 50
                )
                  throw Error('Usa de 1 a 50 copias');
                const d = current();
                if (editing !== null) {
                  d.cards[editing] = updated;
                  fill(d);
                  setMessage(
                    'Carta actualizada. Guarda el mazo para conservarla.',
                  );
                  setDraft(empty);
                  return;
                }
                fill({
                  ...d,
                  cards: [
                    ...d.cards,
                    ...Array.from({ length: quantity }, () => ({ ...updated })),
                  ],
                });
                setDraft(empty);
              } catch (e) {
                setMessage((e as Error).message);
              }
            }}
          >
            {editing !== null
              ? 'Guardar cambios de la carta'
              : 'Añadir al mazo'}
          </button>
        </details>
        <label>
          Importar archivo
          <input
            type="file"
            accept=".json"
            id="deck-json-import"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              if (f.size > 20000000) {
                setMessage('El archivo supera el tamaño permitido');
                return;
              }
              try {
                fill(parse(await f.text()));
              } catch (e) {
                setMessage((e as Error).message);
              }
            }}
          />
        </label>
        <label>
          Cartas · {count}/50 · Puedes pegar o editar JSON
          <textarea
            rows={9}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </label>
        {importRoom && (
          <button
            className="primary wide"
            disabled={count !== 50}
            onClick={async () => {
              try {
                if (await importRoom(current())) {
                  setMessage('Mazo cargado para jugar');
                  onOpenChange(false);
                }
              } catch (e) {
                setMessage((e as Error).message);
              }
            }}
          >
            Usar este mazo en la sala
          </button>
        )}
        <p className="hint">
          Para reemplazar un mazo debes estar en preparación, antes de repartir
          la mano. El guardado es local al navegador y a la dirección del sitio;
          exporta el JSON para conservar una copia y compartirlo.
        </p>
      </DialogContent>
    </Dialog>
  );
}
