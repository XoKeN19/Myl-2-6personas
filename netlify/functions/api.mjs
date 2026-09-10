import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getStore } from '@netlify/blobs';
import {
  createRoom,
  player,
  view,
  action,
  log,
  exportDeck,
  migrate,
  addSpectator,
} from '../../lib/game.mjs';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const normalize = (value) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('es');

let torCatalog;
let cardImages;

function catalogPath(name) {
  const candidates = [
    path.join(projectRoot, 'public/catalogs', name),
    path.join(process.cwd(), 'public/catalogs', name),
  ];
  const found = candidates.find((candidate) => fs.existsSync(candidate));
  if (!found) throw new Error(`Catálogo no incluido en el despliegue: ${name}`);
  return found;
}

function getTorCatalog() {
  if (!torCatalog) {
    torCatalog = JSON.parse(
      fs.readFileSync(catalogPath('tor-imperio-image-index.json'), 'utf8'),
    ).cards;
  }
  return torCatalog;
}

function getCardImages() {
  if (cardImages) return cardImages;
  const sources = [
    getTorCatalog(),
    JSON.parse(fs.readFileSync(catalogPath('myths-imperio.json'), 'utf8')).cards,
    JSON.parse(fs.readFileSync(catalogPath('myths-image-index.json'), 'utf8')).cards,
  ];
  cardImages = new Map();
  for (const source of sources) {
    for (const card of source) {
      const key = normalize(card.name);
      if (card.image && !cardImages.has(key)) cardImages.set(key, card.image);
    }
  }
  return cardImages;
}

function hydrateRoomImages(room) {
  const images = getCardImages();
  let changed = false;
  for (const participant of room.players) {
    for (const card of participant.cards) {
      if (!card.image) {
        card.image = images.get(normalize(card.name)) || '';
        changed ||= Boolean(card.image);
      }
    }
    for (const card of participant.deckList || []) {
      if (!card.image) {
        card.image = images.get(normalize(card.name)) || '';
        changed ||= Boolean(card.image);
      }
    }
  }
  return changed;
}

function json(status, value) {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
    },
  });
}

function apiPath(url) {
  return url.pathname
    .replace(/^\/\.netlify\/functions\/api/, '/api')
    .replace(/\/+$/, '');
}

export default async function handler(request) {
  try {
    const url = new URL(request.url);
    const pathname = apiPath(url);

    if (pathname === '/api/health') return json(200, { ok: true, hosting: 'netlify' });

    if (pathname === '/api/catalog/meta') {
      const cards = getTorCatalog();
      return json(200, {
        editions: [...new Set(cards.map((card) => card.edition))].sort((a, b) => a.localeCompare(b, 'es')),
        races: [...new Set(cards.map((card) => card.race).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es')),
      });
    }

    if (pathname === '/api/catalog/search') {
      const query = normalize(url.searchParams.get('q'));
      const edition = url.searchParams.get('edition') || 'Todas';
      const type = url.searchParams.get('type') || 'Todas';
      const race = url.searchParams.get('race') || 'Todas';
      const cost = url.searchParams.get('cost') || 'Todos';
      const cards = getTorCatalog().filter((card) =>
        (!query || normalize(`${card.id} ${card.name} ${card.effect || ''}`).includes(query)) &&
        (edition === 'Todas' || card.edition === edition) &&
        (type === 'Todas' || card.type === type) &&
        (race === 'Todas' || card.race === race) &&
        (cost === 'Todos' || card.cost === Number(cost)),
      );
      return json(200, { total: cards.length, cards: cards.slice(0, 160) });
    }

    let body = {};
    if (request.method === 'POST') {
      const length = Number(request.headers.get('content-length') || 0);
      if (length > 20_000_000) return json(413, { error: 'Archivo demasiado grande' });
      body = await request.json().catch(() => ({}));
    }

    const rooms = getStore({ name: 'mesa-imperio-rooms', consistency: 'strong' });
    if (pathname === '/api/create' && request.method === 'POST') {
      const room = createRoom(body.name, body.capacity);
      log(room, 'Sala creada. Mesa asistida: acuerden las excepciones antes de resolver.');
      await rooms.setJSON(room.code, room, { onlyIfNew: true });
      return json(200, {
        token: room.players[0].token,
        room: view(room, room.players[0].token),
      });
    }

    const parts = pathname.split('/').filter(Boolean);
    const code = parts[1]?.toUpperCase();
    if (!code) return json(404, { error: 'Ruta no encontrada' });
    const room = await rooms.get(code, { type: 'json', consistency: 'strong' });
    if (!room) return json(404, { error: 'Sala no encontrada' });
    migrate(room);
    const repaired = hydrateRoomImages(room);

    if (parts[2] === 'spectate' && request.method === 'POST') {
      const spectator = addSpectator(room, body.name);
      await rooms.setJSON(code, room);
      return json(200, { token: spectator.token, room: view(room, spectator.token) });
    }

    if (parts[2] === 'join' && request.method === 'POST') {
      if (room.started || room.players.length >= room.capacity) {
        throw new Error('La sala ya comenzó o está llena');
      }
      const participant = player(body.name);
      room.players.push(participant);
      log(room, `${participant.name} entró a la sala`);
      await rooms.setJSON(code, room);
      return json(200, { token: participant.token, room: view(room, participant.token) });
    }

    const token = request.headers.get('authorization')?.replace(/^Bearer /, '');
    if (request.method === 'GET' && parts[2] === 'deck') {
      if (repaired) await rooms.setJSON(code, room);
      return json(200, exportDeck(room, token));
    }
    if (request.method === 'GET' && parts.length === 2) {
      if (repaired) await rooms.setJSON(code, room);
      return json(200, view(room, token));
    }
    if (request.method === 'POST' && parts[2] === 'action') {
      const draft = structuredClone(room);
      const result = action(draft, token, body);
      await rooms.setJSON(code, draft);
      return json(200, result);
    }
    return json(404, { error: 'Ruta no encontrada' });
  } catch (error) {
    return json(400, { error: error?.message || 'No se pudo realizar la acción' });
  }
}
