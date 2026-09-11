import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRoom, player, action, card } from '../lib/game.mjs';
test('Defensor ajusta daño y sólo él puede resolver; cancelar no bota', () => {
  const r = createRoom('A', 2),
    p = r.players[0],
    q = player('B');
  r.players.push(q);
  const c = card({ type: 'Aliado', strength: 8, zone: 'ataque' }),
    d = card({ type: 'Aliado', strength: 3, zone: 'defensa' });
  p.cards.push(c);
  q.cards.push(d);
  action(r, p.token, {
    type: 'strike',
    assignments: [{ cardId: c.id, target: q.id }],
  });
  assert.equal(r.phase, 'Guerra de Talismanes');
  const battle = r.pendingBattles[0];
  assert.throws(() =>
    action(r, p.token, {
      type: 'defend',
      battleId: battle.id,
      rows: [{ cardId: c.id, damage: 8 }],
    }),
  );
  action(r, q.token, {
    type: 'defend',
    battleId: battle.id,
    rows: [{ cardId: c.id, blocker: d.id, damage: 2 }],
  });
  assert.equal(r.phase, 'Asignación de daño');
  assert.equal(q.cards.filter((c) => c.zone === 'cementerio').length, 2);
  assert.equal(d.zone, 'defensa');
  assert.throws(() =>
    action(r, q.token, { type: 'defend', battleId: battle.id, rows: [] }),
  );
});
test('Revelado hasta aliado no altera orden; agrupar oros no mueve aliados; castillo vacío marca derrota', () => {
  const r = createRoom('A', 2),
    p = r.players[0];
  p.cards = [
    card({ type: 'Oro', zone: 'castillo' }),
    card({ type: 'Arma', zone: 'castillo' }),
    card({ type: 'Aliado', zone: 'castillo' }),
    card({ type: 'Aliado', zone: 'castillo' }),
    card({ type: 'Oro', zone: 'pagado' }),
    card({ type: 'Aliado', zone: 'ataque' }),
  ];
  const before = p.cards.map((c) => c.id);
  action(r, p.token, { type: 'revealUntil' });
  assert.equal(r.revealEvent.cards.length, 3);
  assert.deepEqual(
    p.cards.map((c) => c.id),
    before,
  );
  action(r, p.token, { type: 'groupGold' });
  assert.equal(p.cards[4].zone, 'reserva');
  assert.equal(p.cards[5].zone, 'ataque');
  p.ready = true;
  action(r, p.token, { type: 'damage', count: 4 });
  assert.equal(r.defeated[0].id, p.id);
});
