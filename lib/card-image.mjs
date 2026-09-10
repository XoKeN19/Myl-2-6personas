const sources = new Map([
  ['myths.cl', '/cards/'],
  ['api.myl.cl', '/static/cards/'],
]);

export function officialCardImageUrl(value) {
  try {
    const url = new URL(String(value || ''));
    const path = sources.get(url.hostname);
    if (
      url.protocol !== 'https:' ||
      url.port ||
      url.username ||
      url.password ||
      !path ||
      !url.pathname.startsWith(path)
    ) {
      return null;
    }
    return url;
  } catch {
    return null;
  }
}

export async function fetchOfficialCardImage(value) {
  const source = officialCardImageUrl(value);
  if (!source) throw new Error('Imagen de carta no permitida');
  const response = await fetch(source, {
    headers: {
      accept: 'image/avif,image/webp,image/png,image/jpeg,*/*;q=0.5',
      'user-agent': 'Mesa-Imperio/1.0 card-image-cache',
    },
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) throw new Error('La imagen de la carta no está disponible');
  const type = response.headers.get('content-type') || '';
  if (!type.toLowerCase().startsWith('image/')) throw new Error('La fuente no devolvió una imagen');
  const declared = Number(response.headers.get('content-length') || 0);
  if (declared > 5_000_000) throw new Error('Imagen demasiado grande');
  const bytes = await response.arrayBuffer();
  if (bytes.byteLength > 5_000_000) throw new Error('Imagen demasiado grande');
  return { bytes, type };
}
