const normalize = (value) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('es')
    .trim();

export function buildCardImageIndex(sources) {
  const byId = new Map();
  const byEditionAndName = new Map();
  const byUniqueName = new Map();
  const conflictingNames = new Set();

  for (const [sourceIndex, source] of sources.entries()) {
    for (const card of source || []) {
      if (!card?.image) continue;
      const id = normalize(card.id || card.catalogId);
      const name = normalize(card.name);
      const edition = normalize(card.edition);
      if (id && !byId.has(id)) byId.set(id, card.image);
      if (edition && name && !byEditionAndName.has(`${edition}|${name}`)) {
        byEditionAndName.set(`${edition}|${name}`, card.image);
      }
      // The first source is the curated Imperio catalogue. Name-only recovery
      // is deliberately restricted to it so a legacy deck can never receive
      // artwork from Primera Era merely because that result appeared first.
      if (sourceIndex !== 0 || !name || conflictingNames.has(name)) continue;
      const previous = byUniqueName.get(name);
      if (previous && previous !== card.image) {
        byUniqueName.delete(name);
        conflictingNames.add(name);
      } else if (!previous) {
        byUniqueName.set(name, card.image);
      }
    }
  }
  return { byId, byEditionAndName, byUniqueName };
}

export function catalogImageFor(card, index) {
  const id = normalize(card?.catalogId);
  const name = normalize(card?.name);
  const edition = normalize(card?.edition);
  return (
    (id && index.byId.get(id)) ||
    (edition && name && index.byEditionAndName.get(`${edition}|${name}`)) ||
    (name && index.byUniqueName.get(name)) ||
    ''
  );
}
