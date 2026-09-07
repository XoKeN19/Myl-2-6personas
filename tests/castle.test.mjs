import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRoom, action, player } from '../lib/game.mjs';
test('Sacar primera y última conserva el orden y la cantidad total', () => {
  const r = createRoom('Uno', 2),
    p = r.players[0],
    cards = p.cards.filter((c) => c.zone === 'castillo');
  action(r, p.token, {
    type: 'castleTake',
    edge: 'last',
    zone: 'mano',
    count: 2,
  });
  assert.deepEqual(
    p.cards.filter((c) => c.zone === 'castillo').map((c) => c.id),
    cards.slice(0, -2).map((c) => c.id),
  );
  action(r, p.token, {
    type: 'castleTake',
    edge: 'first',
    zone: 'destierro',
    count: 1,
  });
  assert.equal(cards[0].zone, 'destierro');
  assert.equal(p.cards.length, 50);
  assert.throws(() =>
    action(r, p.token, {
      type: 'castleTake',
      edge: 'first',
      zone: 'invalido',
      count: 1,
    }),
  );
});
test('Las fases sugeridas acompañan la jugada sin bloquear ni cambiar el turno rival', () => {
  const r = createRoom('Uno', 2),
    p = r.players[0],
    q = player('Dos');
  r.players.push(q);
  r.phase = 'Agrupación';
  const c = p.cards[1];
  c.zone = 'mano';
  action(r, p.token, {
    type: 'freeMove',
    cardId: c.id,
    sourcePlayerId: p.id,
    zone: 'defensa',
  });
  assert.equal(r.phase, 'Vigilia');
  action(r, p.token, {
    type: 'freeMove',
    cardId: c.id,
    sourcePlayerId: p.id,
    zone: 'ataque',
  });
  assert.equal(r.phase, 'Ataque');
  const d = q.cards[1];
  d.zone = 'mano';
  action(r, q.token, {
    type: 'freeMove',
    cardId: d.id,
    sourcePlayerId: q.id,
    zone: 'defensa',
  });
  assert.equal(r.phase, 'Ataque');
});
import { createRoom as makeRoom, action as actRoom } from '../lib/game.mjs';
test('Ordenar consulta conserva resto del Castillo y determina el siguiente robo', () => {
  const r = makeRoom('Uno', 2),
    p = r.players[0];
  const before = p.cards.filter((c) => c.zone === 'castillo').map((c) => c.id);
  actRoom(r, p.token, {
    type: 'look',
    zone: 'castillo',
    mode: 'top',
    count: 3,
    reason: 'Ordenar',
  });
  const ids = [before[2], before[0], before[1]];
  actRoom(r, p.token, { type: 'orderCastle', ids });
  assert.deepEqual(
    p.cards.filter((c) => c.zone === 'castillo').map((c) => c.id),
    [...ids, ...before.slice(3)],
  );
  assert.throws(() =>
    actRoom(r, p.token, { type: 'orderCastle', ids: [ids[0], ids[0], ids[1]] }),
  );
  actRoom(r, p.token, { type: 'freeDraw', count: 1 });
  assert.ok(p.cards.some((c) => c.id === ids[0] && c.zone === 'mano'));
  assert.throws(() => actRoom(r, p.token, { type: 'orderCastle', ids }));
  actRoom(r, p.token, { type: 'orderCastle', ids: [ids[2], ids[1]] });
  assert.deepEqual(
    p.cards
      .filter((c) => c.zone === 'castillo')
      .slice(0, 2)
      .map((c) => c.id),
    [ids[2], ids[1]],
  );
});

