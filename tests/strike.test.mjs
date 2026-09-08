import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRoom, player, action, card, view } from '../lib/game.mjs';
test('Daño repartido por fuerza, aviso a cada rival y rechazo de duplicados', () => {
  const r = createRoom('A', 3),
    p = r.players[0],
    q = player('B'),
    z = player('C');
  r.players.push(q, z);
  const a = card({
      type: 'Aliado',
      name: 'Atacante A',
      strength: 4,
      zone: 'ataque',
    }),
    b = card({
      type: 'Aliado',
      name: 'Atacante B',
      strength: 3,
      zone: 'ataque',
    });
  p.cards.push(a, b);
  action(r, p.token, {
    type: 'strike',
    assignments: [
      { cardId: a.id, target: q.id },
      { cardId: b.id, target: z.id },
    ],
  });
  assert.equal(q.cards.filter((c) => c.zone === 'cementerio').length, 0);
  assert.throws(() => action(r, p.token, { type: 'next' }));
  for (const target of [q, z]) {
    const battle = r.pendingBattles.find((b) => b.target === target.id);
    action(r, target.token, {
      type: 'defend',
      battleId: battle.id,
      rows: battle.rows.map((row) => ({
        cardId: row.cardId,
        damage: row.strength,
      })),
    });
  }
  assert.equal(q.cards.filter((c) => c.zone === 'cementerio').length, 4);
  assert.equal(z.cards.filter((c) => c.zone === 'cementerio').length, 3);
  assert.equal(
    view(r, q.token).combatEvents.find((e) => e.target === q.id).attackerName,
    'A',
  );
  assert.throws(() =>
    action(r, p.token, {
      type: 'strike',
      assignments: [{ cardId: a.id, target: q.id }],
    }),
  );
  assert.throws(() =>
    action(r, q.token, {
      type: 'strike',
      assignments: [{ cardId: b.id, target: p.id }],
    }),
  );
});
test('Asignación inválida no aplica parcialmente daño', () => {
  const r = createRoom('A', 2),
    p = r.players[0],
    q = player('B');
  r.players.push(q);
  const c = card({ type: 'Aliado', strength: 4, zone: 'ataque' });
  p.cards.push(c);
  assert.throws(() =>
    action(r, p.token, {
      type: 'strike',
      assignments: [
        { cardId: c.id, target: q.id },
        { cardId: 'missing', target: q.id },
      ],
    }),
  );
  assert.equal(q.cards.filter((c) => c.zone === 'cementerio').length, 0);
});
