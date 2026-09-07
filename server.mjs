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
const root = path.dirname(fileURLToPath(import.meta.url));
const data = process.env.DATA_DIR || path.join(root, 'data');
fs.mkdirSync(data, { recursive: true });
const file = path.join(data, 'rooms.json');
let rooms = {};
if (fs.existsSync(file)) rooms = JSON.parse(fs.readFileSync(file, 'utf8'));
Object.values(rooms).forEach(migrate);
function save() {
  fs.writeFileSync(file + '.tmp', JSON.stringify(rooms));
  fs.renameSync(file + '.tmp', file);
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
    let body = {};
    if (req.method === 'POST') {
      let text = '';
      req.setEncoding('utf8');
      for await (const chunk of req) {
        text += chunk;
        if (text.length > 500000) {
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
    const code = url.pathname.split('/')[2]?.toUpperCase(),
      r = rooms[code];
    if (!r) {
      send(404, { error: 'Sala no encontrada' });
      return;
    }
    if (url.pathname.endsWith('/spectate') && req.method === 'POST') {
      const spectator = addSpectator(r, body.name);
      save();
      send(200, { token: spectator.token, room: view(r, spectator.token) });
      return;
    }
    if (url.pathname.endsWith('/join') && req.method === 'POST') {
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
      const result = action(draft, token, body);
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
