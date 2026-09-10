const officialCardImage =
  /^https:\/\/(?:myths\.cl\/cards\/|api\.myl\.cl\/static\/cards\/)/i;

/**
 * Official card art is served through our own origin. This lets Babylon use it
 * as a WebGL texture on every browser and gives the deployed site one shared
 * CDN cache instead of asking the source site again for every player.
 */
export function cardImageUrl(source?: string) {
  if (!source || !officialCardImage.test(source)) return source || '';
  return `/api/card-image?url=${encodeURIComponent(source)}`;
}

/** Keep scans in the browser. Sending fifty base64 photos can exceed the
 * hosting request limit before the game server gets a chance to read the deck.
 */
export function lightweightDeck<T extends { cards: Array<{ image?: string }> }>(
  deck: T,
): T {
  return {
    ...deck,
    cards: deck.cards.map((card) => ({
      ...card,
      image: card.image?.startsWith('data:image/') ? '' : card.image,
    })),
  } as T;
}

export function localImageKey(card: { name?: string; type?: string }) {
  return `${String(card.name || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('es')}|${String(card.type || '')}`;
}
