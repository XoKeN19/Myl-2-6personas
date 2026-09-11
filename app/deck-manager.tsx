'use client';

import { useEffect, useState } from 'react';
import DeckGallery from './deck-gallery';
import { deckStorage } from './deck-storage';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { cardImageUrl } from './card-images';

type Entry = { id?: string; catalogId?: string; edition?: string; image?: string; name: string; type: string; effect: string; race: string; cost: number; strength: number };
type Deck = { version: 1; name: string; cards: Entry[] };
type CatalogCard = Entry & { id: string; edition: string };
const key = 'imperio-decks-v1';
const types = ['Todas', 'Aliado', 'Arma', 'Tótem', 'Talismán', 'Oro'];
const normalized = (value: string) =>
  value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es');
const aliasKey = (value: string) => normalized(value).replace(/[^a-z0-9]/g, '');
// Names dictated from physical cards can differ in accents or transliteration.
// These are confirmed Imperio catalogue names, used when importing old decks.
const imperioAliases: Record<string, string> = {
  bibliotecadelacaballeria: 'Biblioteca de Caballeria',
  aegishajalmur: 'Aegishjalmur',
  aegisjalmour: 'Aegishjalmur',
  tiet: 'Tyet',
  templicahue: 'Tempilcahue',
  espadadeohiggins: 'Espada de Ohiggins',
  tremtenvilu: 'Trentren Vilu',
  pluquina: 'Piruquina',
  dakkunarenegado: 'Daikaiju Renacido',
  padredragon: 'Padre Dagon',
  genpiessp: 'Cienpies Sp',
  lossellossagrados: 'Los Siete Sellos',
  trapecedo: 'Trapezoedro',
  megadakkanu: 'Mecha-daikaiju',
  aziraqqotia: 'Azi Raoidita',
  cuchicucan: 'Kuchiku Kan',
  oricalon: 'Orikalon',
  canonhelios: 'Caon Helios',
  espadadehiggins: 'Espada de Ohiggins',
  barbebayan: 'Babr-e Bayan',
  nagualismo: 'Nahualismo',
  principeurnamo: 'Principe Ur Nammu',
  dampir: 'Dhampir',
  amuletodelcazador: 'Amuleto de Cazador',
  findelatravesia: 'Fin de Travesia',
};

function parse(text: string): Deck {
  const raw = JSON.parse(text), cards = Array.isArray(raw) ? raw : raw.cards;
  if (!Array.isArray(cards) || cards.length > 50) throw Error('Un mazo debe tener hasta 50 cartas.');
  if (cards.some((card) => !card || typeof card.name !== 'string' || !types.includes(card.type) || !Number.isInteger(card.cost) || !Number.isInteger(card.strength))) throw Error('El archivo tiene cartas con datos incompletos.');
  return { version: 1, name: typeof raw.name === 'string' ? raw.name : 'Mi mazo', cards: cards.map((card) => ({ ...card, race: card.race || '', effect: card.effect || '', cost: card.cost || 0, strength: card.strength || 0 })) };
}
function addCatalogPhotos(cards: Entry[], catalog: CatalogCard[]) {
  return cards.map((card) => {
    if (card.image) return card;
    const correctedName = imperioAliases[aliasKey(card.name)] || card.name;
    const wantedId = card.catalogId || card.id;
    const nameMatches = catalog.filter((item) => normalized(item.name) === normalized(correctedName));
    const match =
      (wantedId && catalog.find((item) => item.id === wantedId)) ||
      (card.edition && nameMatches.find((item) => normalized(item.edition) === normalized(card.edition)));
    return match ? { ...card, name: match.name, id: card.id || match.id, catalogId: card.catalogId || match.id, edition: card.edition || match.edition, image: match.image } : card;
  });
}

export default function DeckManager({ open, onOpenChange, loadRoom, importRoom }: { open: boolean; onOpenChange: (v: boolean) => void; loadRoom?: () => Promise<unknown>; importRoom?: (d: Deck) => Promise<boolean> }) {
  const [catalog, setCatalog] = useState<CatalogCard[]>([]), [catalogTotal, setCatalogTotal] = useState(0), [editions, setEditions] = useState<string[]>(['Todas']), [races, setRaces] = useState<string[]>(['Todas']), [catalogError, setCatalogError] = useState('');
  const [name, setName] = useState('Mi mazo'), [cards, setCards] = useState<Entry[]>([]), [library, setLibrary] = useState<Deck[]>([]);
  const [query, setQuery] = useState(''), [edition, setEdition] = useState('Todas'), [type, setType] = useState('Todas'), [race, setRace] = useState('Todas'), [cost, setCost] = useState('Todos');
  const [selected, setSelected] = useState<CatalogCard | null>(null), [message, setMessage] = useState(''), [showTools, setShowTools] = useState(false);

  useEffect(() => { if (!open) return; void (async () => {
    try { const response = await fetch('/api/catalog/meta'); if (!response.ok) throw Error(); const data = await response.json() as { editions?: string[]; races?: string[] }; setEditions(['Todas', ...(data.editions || [])]); setRaces(['Todas', ...(data.races || [])]); } catch { setCatalogError('No se pudo abrir el catálogo. Recarga e inténtalo de nuevo.'); }
    try { const saved = (await deckStorage()) ?? JSON.parse(localStorage.getItem(key) || '[]'); setLibrary(Array.isArray(saved) ? saved : []); } catch { setMessage('No se pudo leer la biblioteca guardada de este navegador.'); }
  })(); }, [open]);

  useEffect(() => { if (!open) return; const timer = window.setTimeout(() => { const params = new URLSearchParams({ q: query, edition, type, race, cost }); void fetch(`/api/catalog/search?${params}`).then(async (response) => { if (!response.ok) throw Error(); return response.json() as Promise<{ cards?: CatalogCard[]; total?: number }>; }).then((data) => { setCatalog(data.cards || []); setCatalogTotal(data.total || 0); }).catch(() => setCatalogError('No se pudo buscar en el catálogo.')); }, 160); return () => window.clearTimeout(timer); }, [open, query, edition, type, race, cost]);
  const cardKey = (card: Entry) => card.id || `${card.name}:${card.type}`;
  const copies = (card: Entry) => cards.filter((entry) => cardKey(entry) === cardKey(card)).length;
  const add = (card: CatalogCard) => { if (cards.length >= 50) return setMessage('El mazo ya tiene 50 cartas. Quita una antes de añadir otra.'); setCards((old) => [...old, { ...card }]); setMessage(`${card.name} añadida (${cards.length + 1}/50).`); };
  const remove = (card: Entry) => { const index = cards.map(cardKey).lastIndexOf(cardKey(card)); if (index >= 0) setCards((old) => old.filter((_, i) => i !== index)); };
  const photoCatalog = catalog;
  useEffect(() => {
    if (!photoCatalog.length) return;
    setCards((old) => addCatalogPhotos(old, photoCatalog));
    const upgraded = library.map((deck) => ({ ...deck, cards: addCatalogPhotos(deck.cards, photoCatalog) }));
    if (upgraded.some((deck, index) => deck.cards.some((card, cardIndex) => card.image !== library[index].cards[cardIndex]?.image))) {
      setLibrary(upgraded);
      void deckStorage(upgraded);
    }
  }, [photoCatalog]);
  const decorateDeck = (deck: Deck): Deck => ({
    ...deck,
    cards: addCatalogPhotos(deck.cards, photoCatalog),
  });
  const coverFor = (deck: Deck) => {
    const pictured = deck.cards.find((card) => card.image)?.image;
    if (pictured) return pictured;
    const matched = deck.cards.map((card) => catalog.find((item) => normalized(item.name) === normalized(imperioAliases[aliasKey(card.name)] || card.name))).find(Boolean);
    if (matched?.image) return matched.image;
    const words = normalized(`${deck.name} ${deck.cards.map((card) => card.race).join(' ')}`);
    const race = ['dragon', 'guerrero', 'heroe', 'caballero', 'sacerdote', 'bestia'].find((value) => words.includes(value));
    return catalog.find((card) => race && normalized(card.race).includes(race))?.image || catalog[0]?.image;
  };
  const fill = (deck: Deck) => { const decorated = decorateDeck(deck); setName(decorated.name); setCards(decorated.cards); setMessage(`«${decorated.name}» cargado: ${decorated.cards.length}/50 cartas.`); };
  const draft = (): Deck => ({ version: 1, name: name.trim() || 'Mi mazo', cards });
  const save = async () => { const deck = draft(), saved = [deck, ...library.filter((item) => item.name !== deck.name)].slice(0, 30); await deckStorage(saved); setLibrary(saved); setMessage(`«${deck.name}» quedó guardado en este navegador.`); };
  const exportDeck = () => { const deck = draft(), url = URL.createObjectURL(new Blob([JSON.stringify(deck, null, 2)], { type: 'application/json' })), a = document.createElement('a'); a.href = url; a.download = `${deck.name.replace(/[^\p{L}\p{N}_-]/gu, '-')}.json`; a.click(); URL.revokeObjectURL(url); };

  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="modal deck-modal deck-builder-modal">
    <DialogTitle>Constructor de mazos</DialogTitle>
    <DialogDescription>Busca cartas de Imperio, arma tus 50 cartas y guarda el resultado en este navegador.</DialogDescription>
    {message && <output className="deck-message">{message}</output>}
    <div className="deck-builder-title"><label>Nombre del mazo<input maxLength={80} value={name} onChange={(event) => setName(event.target.value)} /></label><strong className={cards.length === 50 ? 'deck-count ready' : 'deck-count'}>{cards.length} / 50</strong><button className="primary" onClick={() => void save()}>Guardar</button></div>
    <div className="deck-builder"><section className="deck-catalog-panel">
      <div className="deck-filters"><input aria-label="Buscar carta" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por nombre, código o texto" /><select aria-label="Filtrar por edición" value={edition} onChange={(event) => setEdition(event.target.value)}>{editions.map((value) => <option key={value}>{value}</option>)}</select><select aria-label="Filtrar por tipo" value={type} onChange={(event) => setType(event.target.value)}>{types.map((value) => <option key={value}>{value}</option>)}</select><select aria-label="Filtrar por raza" value={race} onChange={(event) => setRace(event.target.value)}>{races.map((value) => <option key={value}>{value}</option>)}</select><select aria-label="Filtrar por coste" value={cost} onChange={(event) => setCost(event.target.value)}><option>Todos</option>{[0, 1, 2, 3, 4, 5, 6, 7, 8].map((value) => <option key={value} value={value}>Coste {value}</option>)}</select></div>
      <p className="catalog-result">{catalogError || (catalog.length ? `${Math.min(catalog.length, catalogTotal)}${catalogTotal > catalog.length ? '+' : ''} de ${catalogTotal} cartas encontradas` : 'Cargando catálogo Imperio…')}</p>
      <div className="builder-card-grid">{catalog.map((card) => <article key={card.id} className="builder-card"><button className="builder-card-image" onClick={() => setSelected(card)} aria-label={`Ver ${card.name}`}><img src={cardImageUrl(card.image)} alt={`Carta ${card.name}`} loading="lazy" decoding="async" /></button><div><strong>{card.name}</strong><small>{card.type} · {card.cost}{card.type === 'Aliado' ? ` · ${card.strength} fuerza` : ''}</small></div><button className="builder-add" onClick={() => add(card)} aria-label={`Añadir ${card.name}`}>＋ <span>{copies(card)}</span></button></article>)}</div>
    </section><aside className="deck-list-panel"><header><h3>Tu mazo</h3><button disabled={!cards.length} onClick={() => setCards([])}>Vaciar</button></header>{!cards.length ? <p className="deck-empty">Elige cartas del catálogo para empezar.</p> : <div className="deck-list">{Array.from(new Map(cards.map((card) => [cardKey(card), card])).values()).map((card) => <article key={cardKey(card)}>{card.image ? <img src={cardImageUrl(card.image)} alt="" loading="lazy" decoding="async" /> : <span className="card-fallback">{card.type}</span>}<div><strong>{card.name}</strong><small>{card.type} · coste {card.cost}</small></div><b>×{copies(card)}</b><button onClick={() => remove(card)} aria-label={`Quitar ${card.name}`}>−</button></article>)}</div>}{importRoom && <button className="primary wide" disabled={cards.length !== 50} onClick={async () => { if (await importRoom(draft())) { setMessage('Mazo cargado para jugar.'); onOpenChange(false); } }}>Usar este mazo en la sala</button>}</aside></div>
    {library.length > 0 && <section className="saved-decks"><h3>Mis mazos guardados</h3>{library.map((deck, index) => <button key={`${deck.name}-${index}`} onClick={() => fill(deck)}>{coverFor(deck) ? <img src={cardImageUrl(coverFor(deck))} alt="" loading="lazy" decoding="async" /> : <span>◈</span>}<b>{deck.name}</b><small>{deck.cards.length} cartas</small></button>)}</section>}
    <div className="deck-tools"><button onClick={() => setShowTools(!showTools)}>{showTools ? 'Ocultar herramientas' : 'Importar, exportar y personalizar fotos'}</button></div>
    {showTools && <section className="deck-extra-tools"><div className="actions"><label className="file-button">Importar JSON<input type="file" accept=".json" onChange={async (event) => { const file = event.target.files?.[0]; if (!file) return; try { fill(parse(await file.text())); } catch (error) { setMessage((error as Error).message); } }} /></label><button onClick={exportDeck}>Exportar JSON</button>{loadRoom && <button onClick={async () => { try { fill((await loadRoom()) as Deck); } catch (error) { setMessage((error as Error).message); } }}>Recuperar mazo de la sala</button>}</div>{cards.length > 0 && <DeckGallery cards={cards} onSave={async (index, card, all) => { const original = cards[index], updated = cards.map((entry, i) => i === index || (all && entry.name === original.name && entry.type === original.type && entry.effect === original.effect) ? { ...entry, image: card.image } : entry); setCards(updated); setMessage('Las fotos quedaron aplicadas al mazo. Pulsa Guardar para conservarlo.'); }} />}</section>}
    {selected && <Dialog open onOpenChange={(isOpen) => !isOpen && setSelected(null)}><DialogContent className="modal builder-detail"><DialogTitle>{selected.name}</DialogTitle><img src={cardImageUrl(selected.image)} alt={`Carta ${selected.name}`} decoding="async" /><p><b>{selected.edition} · {selected.id}</b><br />{selected.type} · coste {selected.cost}{selected.type === 'Aliado' ? ` · fuerza ${selected.strength}` : ''}<br />{selected.race}</p><p>{selected.effect || 'Sin texto de efecto disponible.'}</p><button className="primary wide" onClick={() => add(selected)}>Añadir al mazo</button></DialogContent></Dialog>}
  </DialogContent></Dialog>;
}
