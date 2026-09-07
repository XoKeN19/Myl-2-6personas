import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createRoom,
  player,
  action,
  view,
  addSpectator,
  exportDeck,
} from '../lib/game.mjs';
function table() {
  const r = createRoom('Uno', 2);
  r.players.push(player('Dos'));
  return [r, ...r.players];
}
test('Oro transformado conserva protecciones hasta el próximo turno y recupera su forma', () => {
  const [r, p, q] = table();
  const c = p.cards.find((c) => c.zone === 'reserva');
  const original = c.effect;
  action(r, p.token, {
    type: 'effect',
    operation: 'transform',
    ids: [c.id],
    reason: 'Gema del grifo',
    cardType: 'Aliado',
    strength: 4,
    effect: 'Indestructible. Indesterrable.',
    traits: ['indestructible', 'indesterrable'],
    until: 'nextTurn',
  });
  assert.equal(c.type, 'Aliado');
  assert.equal(c.strength, 4);
  assert.ok(c.statuses.indesterrable);
  action(r, p.token, { type: 'next' });
  assert.equal(c.type, 'Aliado');
  action(r, q.token, { type: 'next' });
  assert.equal(c.type, 'Oro');
  assert.equal(c.effect, original);
  assert.ok(!c.statuses.indesterrable);
  action(r, p.token, {
    type: 'effect',
    operation: 'transform',
    ids: [c.id],
    reason: 'Sin habilidad',
    cardType: 'Oro',
    strength: 0,
    effect: '',
    traits: [],
  });
  assert.equal(c.effect, '');
});
test('Tiempo de partida se configura antes de comenzar y no reinicia al pasar turno', () => {
  const [r, p, q] = table();
  action(r, p.token, {
    type: 'timer',
    command: 'configure',
    mode: 'game',
    seconds: 1800,
  });
  assert.equal(r.timer.deadline, null);
  for (const x of [p, q]) action(r, x.token, { type: 'setup' });
  action(r, p.token, { type: 'start' });
  const deadline = r.timer.deadline;
  assert.ok(deadline > Date.now());
  action(r, p.token, { type: 'next' });
  assert.equal(r.timer.deadline, deadline);
});
test('Consulta del tope ajeno revela sólo la cantidad aprobada y conserva orden', () => {
  const [r, p, q] = table();
  const expected = q.cards
    .filter((c) => c.zone === 'castillo')
    .slice(0, 2)
    .map((c) => c.id);
  action(r, p.token, {
    type: 'requestLook',
    playerId: q.id,
    zone: 'castillo',
    mode: 'top',
    count: 2,
    reason: 'Azi Zairita',
  });
  assert.equal(view(r, p.token).privateCards.length, 0);
  assert.equal(view(r, q.token).requests[0].count, 2);
  assert.throws(() =>
    action(r, p.token, { type: 'grantLook', requestId: r.requests[0].id }),
  );
  action(r, q.token, { type: 'grantLook', requestId: r.requests[0].id });
  assert.deepEqual(
    view(r, p.token).privateCards.map((c) => c.id),
    expected,
  );
  assert.equal(view(r, q.token).privateCards.length, 0);
  action(r, p.token, {
    type: 'freeMove',
    sourcePlayerId: q.id,
    cardId: expected[0],
    recipient: p.id,
    zone: 'mano',
  });
  assert.ok(p.cards.some((c) => c.id === expected[0] && c.zone === 'mano'));
  assert.ok(
    view(r, q.token)
      .players.find((x) => x.id === p.id)
      .cards.find((c) => c.zone === 'mano').hidden,
  );
  action(r, q.token, { type: 'revokeLook' });
  assert.equal(view(r, p.token).privateCards.length, 0);
  assert.throws(() =>
    action(r, p.token, {
      type: 'freeMove',
      sourcePlayerId: q.id,
      cardId: expected[1],
      zone: 'mano',
    }),
  );
});
test('La consulta no autoriza cartas que hayan cambiado de zona privada', () => {
  const [r, p, q] = table();
  const c = q.cards.find((c) => c.zone === 'castillo');
  action(r, p.token, {
    type: 'requestLook',
    playerId: q.id,
    zone: 'castillo',
    reason: 'Buscar',
  });
  action(r, q.token, { type: 'grantLook', requestId: r.requests[0].id });
  action(r, q.token, { type: 'move', cardId: c.id, zone: 'mano' });
  assert.throws(() =>
    action(r, p.token, {
      type: 'freeMove',
      sourcePlayerId: q.id,
      cardId: c.id,
      zone: 'defensa',
    }),
  );
});
test('Un movimiento privado no revela nombres en la bitácora', () => {
  const [r, p, q] = table();
  const c = p.cards.find((c) => c.zone === 'castillo');
  c.name = 'Identidad privada';
  action(r, p.token, { type: 'move', cardId: c.id, zone: 'mano' });
  assert.ok(!JSON.stringify(view(r, q.token)).includes('Identidad privada'));
  action(r, p.token, {
    type: 'freeMove',
    sourcePlayerId: p.id,
    cardId: c.id,
    zone: 'castillo',
  });
  assert.ok(!JSON.stringify(view(r, q.token)).includes('Identidad privada'));
});
test('Las cartas transferidas pueden devolverse y el mazo exportado no cambia', () => {
  const [r, p, q] = table();
  const before = exportDeck(r, q.token);
  const c = q.cards.find((c) => c.zone === 'reserva');
  action(r, p.token, {
    type: 'freeMove',
    sourcePlayerId: q.id,
    cardId: c.id,
    recipient: p.id,
    zone: 'reserva',
  });
  action(r, p.token, {
    type: 'freeMove',
    sourcePlayerId: p.id,
    cardId: c.id,
    recipient: q.id,
    zone: 'reserva',
  });
  assert.ok(q.cards.includes(c));
  assert.equal(p.cards.length + q.cards.length, 100);
  assert.deepEqual(exportDeck(r, q.token), before);
});
test('Temporizador compartido pausa, continúa y reinicia al pasar turno sin agrupar cartas', () => {
  const [r, p, q] = table();
  action(r, p.token, { type: 'timer', command: 'start', seconds: 60 });
  assert.equal(view(r, q.token).timer.deadline, r.timer.deadline);
  assert.ok(r.timer.deadline > Date.now());
  action(r, q.token, { type: 'timer', command: 'pause' });
  assert.equal(r.timer.deadline, null);
  assert.ok(r.timer.remaining <= 60000);
  action(r, p.token, { type: 'timer', command: 'resume' });
  assert.ok(r.timer.deadline);
  const c = q.cards.find((c) => c.zone === 'reserva');
  c.zone = 'pagado';
  action(r, p.token, { type: 'next' });
  assert.equal(r.active, q.id);
  assert.equal(c.zone, 'pagado');
  assert.equal(r.timer.remaining, 60000);
  action(r, q.token, { type: 'timer', command: 'reset' });
  assert.equal(r.timer.deadline, null);
  assert.throws(() =>
    action(r, p.token, { type: 'timer', command: 'start', seconds: -1 }),
  );
});
test('Espectador no puede usar controles libres ni permisos ni temporizador', () => {
  const [r, p] = table(),
    s = addSpectator(r, 'Observador');
  for (const a of [
    { type: 'timer', command: 'start', seconds: 30 },
    { type: 'freeDraw', count: 1 },
    { type: 'phase', phase: 'Final' },
    {
      type: 'freeMove',
      sourcePlayerId: p.id,
      cardId: p.cards[0].id,
      zone: 'mano',
    },
    { type: 'grantLook', requestId: 'falso' },
  ])
    assert.throws(() => action(r, s.token, a));
  assert.deepEqual(view(r, s.token).privateCards, []);
});
test('Equipar desde Cementerio funciona antes de comenzar y en cualquier fase', () => {
  const [r, p] = table();
  const c = p.cards[1],
    host = p.cards[2];
  c.type = 'Arma';
  c.zone = 'cementerio';
  host.zone = 'defensa';
  action(r, p.token, { type: 'attach', cardId: c.id, hostId: host.id });
  assert.equal(c.attachedTo, host.id);
});
