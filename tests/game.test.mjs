import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createRoom,
  player,
  action,
  view,
  card,
  combat,
  exportDeck,
} from '../lib/game.mjs';
const setup = () => {
  const r = createRoom('Ana', 6);
  r.players.push(player('Luis'));
  return [r, r.players[0], r.players[1]];
};
const start = (r) => {
  for (const p of r.players) action(r, p.token, { type: 'setup' });
  action(r, r.players[0].token, { type: 'start' });
};
const phase = (r, p, v) => action(r, p.token, { type: 'phase', phase: v });
test('Preparación conserva 50 cartas: 8 mano, 41 Castillo, 1 Oro', () => {
  const [r, p] = setup();
  action(r, p.token, { type: 'setup' });
  assert.equal(p.cards.length, 50);
  assert.equal(p.cards.filter((c) => c.zone === 'mano').length, 8);
  assert.equal(p.cards.filter((c) => c.zone === 'castillo').length, 41);
  assert.throws(() => action(r, p.token, { type: 'setup' }));
});
test('Manos, Castillos, tokens y listas ajenas son privados', () => {
  const [r, p, q] = setup();
  action(r, p.token, { type: 'setup' });
  const c = p.cards.find((c) => c.zone === 'mano');
  c.name = 'SECRETO';
  const v = JSON.stringify(view(r, q.token));
  assert.ok(!v.includes('SECRETO'));
  assert.ok(!v.includes(p.token));
  assert.ok(!v.includes(q.token));
  assert.ok(!v.includes('deckList'));
  assert.ok(!v.includes(p.cards.find((c) => c.zone === 'castillo').id));
  assert.equal(
    view(r, p.token).players[0].cards.find((x) => x.id === c.id).name,
    'SECRETO',
  );
});
test('No permite editar cartas ajenas ni sesiones falsas', () => {
  const [r, p, q] = setup();
  assert.throws(() =>
    action(r, q.token, { type: 'move', cardId: p.cards[0].id, zone: 'mano' }),
  );
  assert.throws(() => view(r, 'falso'));
  assert.throws(() => exportDeck(r, 'falso'));
});
test('Mulligan normal reduce y excepcional no recupera las ocho', () => {
  const [r, p] = setup();
  action(r, p.token, { type: 'setup' });
  action(r, p.token, { type: 'mulligan' });
  assert.equal(p.cards.filter((c) => c.zone === 'mano').length, 7);
  action(r, p.token, { type: 'freeMulligan' });
  assert.equal(p.cards.filter((c) => c.zone === 'mano').length, 7);
  assert.throws(() => action(r, p.token, { type: 'freeMulligan' }));
  assert.equal(p.cards.length, 50);
});
test('Volver a ocho funciona una vez y antes de comenzar', () => {
  const [r, p, q] = setup();
  action(r, p.token, { type: 'setup' });
  action(r, p.token, { type: 'mulligan' });
  action(r, p.token, { type: 'mulligan' });
  action(r, p.token, { type: 'houseMulligan' });
  assert.equal(p.cards.filter((c) => c.zone === 'mano').length, 8);
  assert.equal(p.cards.length, 50);
  assert.throws(() => action(r, p.token, { type: 'houseMulligan' }));
  action(r, q.token, { type: 'setup' });
  action(r, p.token, { type: 'start' });
  assert.throws(() => action(r, q.token, { type: 'houseMulligan' }));
});
test('Excepcional rechaza manos con dos Oros sin consumirlo', () => {
  const [r, p] = setup();
  action(r, p.token, { type: 'setup' });
  p.cards
    .filter((c) => c.zone === 'mano')
    .slice(0, 2)
    .forEach((c) => (c.type = 'Oro'));
  assert.throws(() => action(r, p.token, { type: 'freeMulligan' }));
  assert.equal(p.freeMulligan, false);
});
test('Robo normal sólo al final, no en primer turno ni más de una vez', () => {
  const [r, p, q] = setup();
  start(r);
  assert.throws(() => action(r, p.token, { type: 'draw' }));
  phase(r, p, 'Final');
  assert.throws(() => action(r, p.token, { type: 'draw' }));
  action(r, p.token, { type: 'next' });
  phase(r, q, 'Vigilia');
  assert.throws(() => action(r, q.token, { type: 'draw' }));
  phase(r, q, 'Final');
  assert.throws(() => action(r, q.token, { type: 'next' }));
  action(r, q.token, { type: 'draw' });
  assert.throws(() => action(r, q.token, { type: 'draw' }));
  assert.throws(() => action(r, p.token, { type: 'draw' }));
  assert.throws(() => action(r, q.token, { type: 'next' }));
  const c = q.cards.find((c) => c.zone === 'mano');
  action(r, q.token, { type: 'move', cardId: c.id, zone: 'cementerio' });
  action(r, q.token, { type: 'next' });
  assert.equal(r.active, p.id);
});
test('No permite retroceder fases ni saltar el daño', () => {
  const [r, p] = setup();
  start(r);
  assert.throws(() => phase(r, p, 'Bloqueo'));
  phase(r, p, 'Ataque');
  assert.throws(() => phase(r, p, 'Vigilia'));
});
test('Robo por efecto requiere motivo y no consume el robo normal', () => {
  const [r, p] = setup();
  start(r);
  assert.throws(() => action(r, p.token, { type: 'effectDraw', count: 1 }));
  action(r, p.token, {
    type: 'effectDraw',
    count: 1,
    reason: 'Talismán de prueba',
  });
  assert.equal(r.drawn, false);
  assert.ok(r.log[0].message.includes('Talismán de prueba'));
});
test('Oro es primero y sólo uno en Vigilia', () => {
  const [r, p] = setup();
  start(r);
  const [a, b] = p.cards.filter((c) => c.zone === 'mano');
  a.type = b.type = 'Oro';
  action(r, p.token, { type: 'move', cardId: a.id, zone: 'reserva' });
  assert.throws(() =>
    action(r, p.token, { type: 'move', cardId: b.id, zone: 'reserva' }),
  );
});
test('Ataque necesita fase y Agrupación o excepción explícita', () => {
  const [r, p, q] = setup();
  start(r);
  const c = p.cards.find((c) => c.zone === 'mano');
  action(r, p.token, { type: 'move', cardId: c.id, zone: 'defensa' });
  assert.throws(() =>
    action(r, p.token, { type: 'attack', cardId: c.id, target: q.id }),
  );
  phase(r, p, 'Ataque');
  assert.throws(() =>
    action(r, p.token, { type: 'attack', cardId: c.id, target: q.id }),
  );
  action(r, p.token, {
    type: 'attack',
    cardId: c.id,
    target: q.id,
    reason: 'Furia',
  });
  assert.equal(c.zone, 'ataque');
});
test('Arma acompaña al portador al Destierro', () => {
  const [r, p] = setup();
  start(r);
  const a = p.cards.find((c) => c.zone === 'mano'),
    w = p.cards.filter((c) => c.zone === 'mano')[1];
  w.type = 'Arma';
  action(r, p.token, { type: 'move', cardId: a.id, zone: 'defensa' });
  action(r, p.token, { type: 'attach', cardId: w.id, hostId: a.id });
  action(r, p.token, { type: 'move', cardId: a.id, zone: 'destierro' });
  assert.equal(w.zone, 'destierro');
  assert.equal(w.attachedTo, null);
});
test('Combate directo: confirma ambos, destruye, bota y no duplica daño', () => {
  const [r, p, q] = setup();
  start(r);
  const a = card({ name: 'A', zone: 'defensa', strength: 5 }),
    b = card({ name: 'B', zone: 'defensa', strength: 3 }),
    w = card({ name: 'Arma', type: 'Arma', zone: 'apoyo' });
  a.canAttack = true;
  w.attachedTo = b.id;
  p.cards.push(a);
  q.cards.push(b, w);
  phase(r, p, 'Ataque');
  action(r, p.token, { type: 'attack', cardId: a.id, target: q.id });
  phase(r, p, 'Bloqueo');
  action(r, q.token, { type: 'block', cardId: b.id, attacker: a.id });
  assert.equal(combat(r, q.id)[0].damage, 2);
  phase(r, p, 'Guerra de Talismanes');
  phase(r, p, 'Asignación de daño');
  assert.throws(() => phase(r, p, 'Final'));
  assert.throws(() => action(r, p.token, { type: 'resolve', defender: q.id }));
  action(r, p.token, { type: 'battleReady' });
  action(r, q.token, { type: 'battleReady' });
  const n = q.cards.filter((c) => c.zone === 'castillo').length;
  action(r, p.token, { type: 'resolve', defender: q.id });
  assert.equal(b.zone, 'cementerio');
  assert.equal(w.zone, 'cementerio');
  assert.equal(q.cards.filter((c) => c.zone === 'castillo').length, n - 2);
  assert.throws(() => action(r, p.token, { type: 'resolve', defender: q.id }));
  phase(r, p, 'Final');
});
test('Cambio de fuerza invalida confirmaciones', () => {
  const [r, p, q] = setup();
  start(r);
  r.phase = 'Asignación de daño';
  action(r, p.token, { type: 'battleReady' });
  action(r, q.token, { type: 'battleReady' });
  const c = p.cards.find((c) => c.zone === 'mano');
  action(r, p.token, {
    type: 'edit',
    cardId: c.id,
    card: { ...c, strength: 7 },
  });
  assert.deepEqual(r.battleReady, []);
});
test('Exporta 50 definiciones completas sin orden actual ni datos de batalla', () => {
  const [r, p, q] = setup();
  const before = exportDeck(r, p.token);
  action(r, p.token, { type: 'setup' });
  action(r, p.token, { type: 'shuffle' });
  assert.deepEqual(exportDeck(r, p.token), before);
  assert.equal(before.cards.length, 50);
  assert.ok(before.cards.every((c) => !('id' in c) && !('zone' in c)));
  action(r, q.token, { type: 'import', cards: before });
  assert.deepEqual(exportDeck(r, q.token).cards, before.cards);
});
test('Editar carta sin definir actualiza su definición exportable', () => {
  const [r, p] = setup();
  action(r, p.token, { type: 'setup' });
  const c = p.cards.find((c) => c.zone === 'mano');
  action(r, p.token, {
    type: 'edit',
    cardId: c.id,
    card: { ...c, name: 'Mi aliado', effect: 'Efecto' },
  });
  assert.ok(exportDeck(r, p.token).cards.some((c) => c.name === 'Mi aliado'));
  assert.equal(exportDeck(r, p.token).cards.length, 50);
});
test('Importación inválida conserva el mazo anterior', () => {
  const [r, p] = setup();
  const before = structuredClone(p.cards);
  assert.throws(() => action(r, p.token, { type: 'import', cards: [] }));
  assert.throws(() =>
    action(r, p.token, {
      type: 'import',
      cards: Array.from({ length: 50 }, () => ({
        name: 'Carta',
        type: 'Aliado',
      })),
    }),
  );
  assert.deepEqual(p.cards, before);
});
