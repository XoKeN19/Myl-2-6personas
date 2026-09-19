import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRoom, player, action } from '../lib/game.mjs';

test('An effect retains the exact originating card, not an entered name', () => {
  const room = createRoom('Uno', 2);
  const p = room.players[0], origin = p.cards[0];
  origin.name = 'Biblioteca de Caballería';
  action(room, p.token, { type: 'temporaryGold', delta: 1,
    reason: 'Nombre incorrecto', effectCardId: origin.id });
  assert.equal(room.lastEffect.cardId, origin.id);
  assert.equal(room.lastEffect.playerId, p.id);
  assert.equal(room.lastEffect.actorId, p.id);
  assert.equal(p.temporaryGold, 1);
});

test('Hidden or missing originating cards cannot be guessed by ID', () => {
  const room = createRoom('Uno', 2), other = player('Dos');
  room.players.push(other);
  const p = room.players[0];
  const run = (effectCardId) => action(room, p.token, {
    type: 'temporaryGold', delta: 1, effectCardId, reason: 'Prueba',
  });
  assert.throws(() => run(other.cards[1].id), /ya no está visible/);
  assert.throws(() => run(p.cards[1].id), /ya no está visible/);
  assert.throws(() => run('missing'), /ya no está visible/);
  assert.equal(p.temporaryGold, 0);
});

test('Approval preserves the origin in the requesting player hand', () => {
  const room = createRoom('Uno', 2), other = player('Dos');
  room.players.push(other);
  const p = room.players[0], origin = p.cards[1], target = other.cards[0];
  origin.zone = 'mano';
  action(room, p.token, { type: 'requestEffect', playerId: other.id,
    ids: [target.id], operation: 'reveal', effectCardId: origin.id, reason: origin.name });
  assert.equal(room.requests[0].payload.effectCardId, origin.id);
  action(room, other.token, { type: 'approveEffect', requestId: room.requests[0].id });
  assert.equal(room.lastEffect.cardId, origin.id);
  assert.equal(room.lastEffect.actorId, p.id);
  assert.equal(target.revealed, true);
});
