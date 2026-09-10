import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createRoom,
  player,
  view,
  action,
  log,
  exportDeck,
  migrate,
  addSpectator,
} from './lib/game.mjs';
import { createTutorialRoom, tutorialAction } from './lib/tutorial-room.mjs';
import { fetchOfficialCardImage } from './lib/card-image.mjs';
const root = path.dirname(fileURLToPath(import.meta.url));
const data = process.env.DATA_DIR || path.join(root, 'data');
fs.mkdirSync(data, { recursive: true });
const file = path.join(data, 'rooms.json');
let rooms = {};
if (fs.existsSync(file)) rooms = JSON.parse(fs.readFileSync(file, 'utf8'));
Object.values(rooms).forEach(migrate);
let torCatalog;
let cardImages;
const catalogFile = path.join(root, 'dist/client/catalogs/tor-imperio-image-index.json');
const catalogNormalize = (value) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es');
function getTorCatalog() {
  if (!torCatalog) torCatalog = JSON.parse(fs.readFileSync(catalogFile, 'utf8')).cards;
  return torCatalog;
}
function getCardImages() {
  if (cardImages) return cardImages;
  const sources = [
    getTorCatalog(),
    JSON.parse(fs.readFileSync(path.join(root, 'dist/client/catalogs/myths-imperio.json'), 'utf8')).cards,
    JSON.parse(fs.readFileSync(path.join(root, 'dist/client/catalogs/myths-image-index.json'), 'utf8')).cards,
  ];
  cardImages = new Map();
  for (const source of sources) for (const card of source) {
    const key = catalogNormalize(card.name);
    if (card.image && !cardImages.has(key)) cardImages.set(key, card.image);
  }
  return cardImages;
}
function hydrateRoomImages(room) {
  const images = getCardImages();
  for (const player of room.players) {
    for (const card of player.cards) {
      if (!card.image) card.image = images.get(catalogNormalize(card.name)) || '';
    }
    for (const card of player.deckList || []) {
      if (!card.image) card.image = images.get(catalogNormalize(card.name)) || '';
    }
  }
}
function save() {
  fs.writeFileSync(file + '.tmp', JSON.stringify(rooms));
  fs.renameSync(file + '.tmp', file);
}
function tutorialDeck(name) {
  return JSON.parse(fs.readFileSync(path.join(root, 'public/decks', name), 'utf8')).cards;
}
const buckets = new Map();
const server = http.createServer(async (req, res) => {
  const send = (code, obj) => {
    res.writeHead(code, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    });
    res.end(JSON.stringify(obj));
  };
  try {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname === '/api/health') {
      send(200, { ok: true });
      return;
    }
    if (url.pathname === '/api/catalog/meta') {
      const cards = getTorCatalog();
      send(200, {
        editions: [...new Set(cards.map((card) => card.edition))].sort((a, b) => a.localeCompare(b, 'es')),
        races: [...new Set(cards.map((card) => card.race).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es')),
      });
      return;
    }
    if (url.pathname === '/api/catalog/search') {
      const query = catalogNormalize(url.searchParams.get('q'));
      const edition = url.searchParams.get('edition') || 'Todas';
      const type = url.searchParams.get('type') || 'Todas';
      const race = url.searchParams.get('race') || 'Todas';
      const cost = url.searchParams.get('cost') || 'Todos';
      const cards = getTorCatalog().filter((card) =>
        (!query || `${card.id} ${card.name} ${card.effect || ''}`.toLocaleLowerCase('es').includes(query)) &&
        (edition === 'Todas' || card.edition === edition) &&
        (type === 'Todas' || card.type === type) &&
        (race === 'Todas' || card.race === race) &&
        (cost === 'Todos' || card.cost === Number(cost)),
      );
      send(200, { total: cards.length, cards: cards.slice(0, 160) });
      return;
    }
    if (!url.pathname.startsWith('/api/')) {
      let rel = decodeURIComponent(url.pathname);
      if (rel === '/') rel = '/index.html';
      const base = path.join(root, 'dist/client');
      const target = path.resolve(base, '.' + rel);
      if (
        !target.startsWith(base + path.sep) ||
        !fs.existsSync(target) ||
        !fs.statSync(target).isFile()
      ) {
        res.writeHead(404);
        res.end('Archivo no encontrado. Ejecuta npm run build.');
        return;
      }
      const mime = {
        '.html': 'text/html; charset=utf-8',
        '.js': 'text/javascript',
        '.css': 'text/css',
        '.svg': 'image/svg+xml',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.webp': 'image/webp',
        '.ico': 'image/x-icon',
      };
      res.writeHead(200, {
        'Content-Type':
          mime[path.extname(target)] ?? 'application/octet-stream',
        'X-Content-Type-Options': 'nosniff',
      });
      fs.createReadStream(target).pipe(res);
      return;
    }
    if (
      req.method === 'POST' &&
      req.headers.origin &&
      new URL(req.headers.origin).host !== req.headers.host &&
      req.headers.origin !== process.env.PUBLIC_ORIGIN
    ) {
      send(403, { error: 'Origen no permitido' });
      return;
    }
    const ip = req.socket.remoteAddress;
    const now = Date.now();
    let b = buckets.get(ip);
    if (!b || now - b.time > 60000) {
      b = { time: now, n: 0 };
      buckets.set(ip, b);
    }
    if (++b.n > 1200) {
      send(429, { error: 'Demasiadas solicitudes' });
      return;
    }
    if (url.pathname === '/api/card-image' && req.method === 'GET') {
      const image = await fetchOfficialCardImage(url.searchParams.get('url'));
      res.writeHead(200, {
        'Content-Type': image.type,
        'Content-Length': image.bytes.byteLength,
        'Cache-Control': 'public, max-age=604800, immutable',
        'X-Content-Type-Options': 'nosniff',
      });
      res.end(Buffer.from(image.bytes));
      return;
    }
    let body = {};
    if (req.method === 'POST') {
      let text = '';
      req.setEncoding('utf8');
      for await (const chunk of req) {
        text += chunk;
        if (text.length > 20000000) {
          send(413, { error: 'Archivo demasiado grande' });
          return;
        }
      }
      body = JSON.parse(text || '{}');
    }
    if (url.pathname === '/api/create' && req.method === 'POST') {
      if (Object.keys(rooms).length >= 200)
        throw Error('Límite de salas alcanzado');
      const room = createRoom(body.name, body.capacity);
      rooms[room.code] = room;
      log(
        room,
        'Sala creada. Mesa asistida: acuerden las excepciones antes de resolver.',
      );
      save();
      send(200, {
        token: room.players[0].token,
        room: view(room, room.players[0].token),
      });
      return;
    }
    if (url.pathname === '/api/tutorial' && req.method === 'POST') {
      const room = createTutorialRoom(
        body.name,
        tutorialDeck('mazo-heroe-imperio-corregido.json'),
        tutorialDeck('mazo-dragon-imperio-corregido.json'),
      );
      rooms[room.code] = room;
      save();
      send(200, { token: room.players[0].token, room: view(room, room.players[0].token) });
      return;
    }
    const code = url.pathname.split('/')[2]?.toUpperCase(),
      r = rooms[code];
    if (!r) {
      send(404, { error: 'Sala no encontrada' });
      return;
    }
    // Existing rooms created before the image catalogue are repaired the next
    // time they are opened, so players do not need to rebuild their deck.
    hydrateRoomImages(r);
    if (url.pathname.endsWith('/spectate') && req.method === 'POST') {
      if (r.tutorial?.private) throw Error('Esta sala de aprendizaje es privada');
      const spectator = addSpectator(r, body.name);
      save();
      send(200, { token: spectator.token, room: view(r, spectator.token) });
      return;
    }
    if (url.pathname.endsWith('/join') && req.method === 'POST') {
      if (r.tutorial?.private) throw Error('Esta sala de aprendizaje es privada');
      if (r.started || r.players.length >= r.capacity)
        throw Error('La sala ya comenzó o está llena');
      const p = player(body.name);
      r.players.push(p);
      log(r, `${p.name} entró a la sala`);
      save();
      send(200, { token: p.token, room: view(r, p.token) });
      return;
    }
    const token = req.headers.authorization?.replace(/^Bearer /, '');
    if (req.method === 'GET' && url.pathname.endsWith('/deck')) {
      send(200, exportDeck(r, token));
      return;
    }
    if (req.method === 'GET') {
      send(200, view(r, token));
      return;
    }
    if (req.method === 'POST' && url.pathname.endsWith('/action')) {
      const draft = structuredClone(r);
      const result = draft.tutorial
        ? tutorialAction(draft, token, body)
        : action(draft, token, body);
      rooms[code] = draft;
      save();
      send(200, result);
      return;
    }
    send(404, { error: 'Ruta no encontrada' });
  } catch (e) {
    send(400, { error: e.message || 'No se pudo realizar la acción' });
  }
});
setInterval(() => {
  const now = Date.now();
  for (const [k, b] of buckets) if (now - b.time > 60000) buckets.delete(k);
}, 60000).unref();
server.listen(
  Number(process.env.PORT || process.env.API_PORT || 3001),
  '0.0.0.0',
  () =>
    console.log(
      `Mesa Imperio: http://localhost:${process.env.PORT || process.env.API_PORT || 3001}`,
    ),
);
