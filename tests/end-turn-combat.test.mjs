import test from 'node:test';
import assert from 'node:assert/strict';
import { createRoom, player, card, action } from '../lib/game.mjs';

test('Pasar turno tras asignación de daño roba una carta automáticamente salvo en turno uno', () => {
  const r = createRoom('A', 2), p = r.players[0], q = player('B');
  r.players.push(q);
  r.phase = 'Asignación de daño';
  r.turn = 2;
  const castleBefore = p.cards.filter((c) => c.zone === 'castillo').length;
  const handBefore = p.cards.filter((c) => c.zone === 'mano').length;
  action(r, p.token, { type: 'next' });
  assert.equal(p.cards.filter((c) => c.zone === 'castillo').length, castleBefore - 1);
  assert.equal(p.cards.filter((c) => c.zone === 'mano').length, handBefore + 1);
  assert.equal(r.drawn, false);
  action(r, q.token, { type: 'next' });
  r.phase = 'Asignación de daño';
  r.turn = 1;
  const before = p.cards.filter((c) => c.zone === 'mano').length;
  action(r, p.token, { type: 'next' });
  assert.equal(p.cards.filter((c) => c.zone === 'mano').length, before);
});

test('Cancelar un aliado atacante conserva el daño de los demás aliados del mismo ataque', () => {
  const r = createRoom('A', 2), p = r.players[0], q = player('B');
  r.players.push(q);
  const first = card({ name: 'Primero', type: 'Aliado', strength: 2, zone: 'ataque' });
  const second = card({ name: 'Segundo', type: 'Aliado', strength: 4, zone: 'ataque' });
  p.cards.push(first, second);
  action(r, p.token, { type: 'strike', assignments: [
    { cardId: first.id, target: q.id }, { cardId: second.id, target: q.id },
  ] });
  action(r, p.token, { type: 'effect', operation: 'cancelAttack', ids: [first.id], reason: 'Cancelar primero' });
  assert.deepEqual(r.pendingBattles[0].rows.map((row) => row.cardId), [second.id]);
  const battle = r.pendingBattles[0];
  action(r, q.token, { type: 'defend', battleId: battle.id, rows: [{ cardId: second.id, damage: 4 }] });
  assert.equal(q.cards.filter((c) => c.zone === 'cementerio').length, 4);
  assert.equal(r.pendingBattles.length, 0);
});
