import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
test('HTTP: seis jugadores, sala llena, privacidad, rechazo de origen y persistencia', async () => {
  fs.mkdirSync(path.join(root, 'work'), { recursive: true });
  const data = fs.mkdtempSync(path.join(root, 'work/http-test-'));
  let child;
  const start = async () => {
    child = spawn(process.execPath, ['server.mjs'], {
      cwd: root,
      env: { ...process.env, API_PORT: '3017', DATA_DIR: data },
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    await new Promise((ok, bad) => {
      const t = setTimeout(() => bad(Error('No inició')), 10000);
      child.stdout.once('data', () => {
        clearTimeout(t);
        ok();
      });
      child.once('error', bad);
    });
  };
  const stop = async () => {
    if (!child) return;
    const p = new Promise((ok) => child.once('exit', ok));
    child.kill();
    await p;
    child = null;
  };
  const req = async (url, body, token, origin) => {
    const r = await fetch('http://localhost:3017' + url, {
      method: body ? 'POST' : 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(origin ? { Origin: origin } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: r.status, data: await r.json() };
  };
  try {
    await start();
    const first = await req('/api/create', { name: 'Uno', capacity: 6 });
    assert.equal(first.status, 200);
    const code = first.data.room.code,
      token = first.data.token;
    const joined = await Promise.all(
      Array.from({ length: 5 }, (_, i) =>
        req(`/api/${code}/join`, { name: `Jugador ${i + 2}` }),
      ),
    );
    assert.ok(joined.every((x) => x.status === 200));
    assert.equal(
      (await req(`/api/${code}/join`, { name: 'Siete' })).status,
      400,
    );
    assert.equal((await req(`/api/${code}`, undefined, 'falso')).status, 400);
    await req(`/api/${code}/action`, { type: 'setup' }, token);
    const own = await req(`/api/${code}`, undefined, token);
    const hand = own.data.players[0].cards.find((c) => c.zone === 'mano');
    await req(
      `/api/${code}/action`,
      {
        type: 'edit',
        cardId: hand.id,
        card: {
          name: 'Nombre secreto',
          type: 'Aliado',
          effect: 'Efecto secreto',
        },
      },
      token,
    );
    assert.equal(
      (await req(`/api/${code}/deck`, undefined, token)).data.cards.length,
      50,
    );
    const other = await req(`/api/${code}`, undefined, joined[0].data.token);
    assert.ok(!JSON.stringify(other).includes('Nombre secreto'));
    assert.equal(
      (
        await req(
          `/api/${code}/action`,
          { type: 'draw', count: 1 },
          token,
          'https://malicioso.example',
        )
      ).status,
      403,
    );
    await stop();
    await start();
    const restored = await req(`/api/${code}`, undefined, token);
    assert.equal(restored.data.players.length, 6);
    assert.ok(JSON.stringify(restored.data).includes('Nombre secreto'));
    const watcher = await req(`/api/${code}/spectate`, { name: 'Observador' });
    assert.equal(watcher.status, 200);
    assert.equal(watcher.data.room.role, 'spectator');
    assert.equal(watcher.data.room.players.length, 6);
    assert.ok(!JSON.stringify(watcher.data.room).includes('Nombre secreto'));
    assert.equal(
      (
        await req(
          `/api/${code}/action`,
          { type: 'note', text: 'No autorizado' },
          watcher.data.token,
        )
      ).status,
      400,
    );
    assert.equal(
      (await req(`/api/${code}/deck`, undefined, watcher.data.token)).status,
      400,
    );
    const homepage = await fetch('http://localhost:3017/');
    assert.equal(homepage.status, 200);
    const html = await homepage.text();
    assert.ok(html.includes('Mesa Imperio'));
    const sources = [...html.matchAll(/(?:src|href)="(\/_next\/[^" ]+)"/g)].map(
      (m) => m[1],
    );
    assert.ok(sources.length > 0);
    for (const source of sources) {
      assert.equal((await fetch('http://localhost:3017' + source)).status, 200);
    }
  } finally {
    await stop();
  }
});
