import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRoom, player, card, action, view, exportDeck } from '../lib/game.mjs';
import { expire } from '../lib/effects.mjs';

function setup() {
  const room = createRoom('Biblioteca', 2);
  const owner = room.players[0], copier = player('Dragón');
  room.players.push(copier);
  const source = card({ name: 'Biblioteca de Caballería', type: 'Oro', zone: 'reserva',
    catalogId: 'biblioteca-imperio', edition: 'Imperio',
    image: 'https://myths.cl/cards/biblioteca.png', effect: 'Usa una carta del Castillo oponente.' });
  const target = card({ name: 'Corazón del Dragón', type: 'Oro', zone: 'pagado',
    catalogId: 'corazon-imperio', image: 'https://myths.cl/cards/corazon.png', effect: 'Copia un Oro.' });
  source.ownerId = owner.id; target.ownerId = copier.id;
  owner.cards.push(source); copier.cards.push(target);
  const copy = (extra = {}, actor = copier) => action(room, actor.token, {
    type: 'effect', operation: 'copy', ids: [target.id], sourceId: source.id,
    copyMode: 'full', reason: 'Corazón del Dragón', ...extra,
  });
  return { room, owner, copier, source, target, copy };
}

test('Copy changes only recipient, includes artwork identity and is visible to both players', () => {
  const { room, owner, copier, source, target, copy } = setup();
  const originalSource = structuredClone(source), targetId = target.id;
  const deck = exportDeck(room, copier.token);
  target.modifiers = [{ delta: 2, until: 'permanent' }];
  copy();
  assert.deepEqual(source, originalSource);
  for (const key of ['name', 'image', 'catalogId', 'edition', 'type', 'cost', 'strength', 'race', 'effect'])
    assert.equal(target[key], source[key], key);
  assert.equal(target.id, targetId);
  assert.equal(target.zone, 'pagado');
  assert.equal(target.modifiers[0].delta, 2);
  assert.deepEqual(exportDeck(room, copier.token), deck);
  for (const viewer of [owner, copier])
    assert.equal(view(room, viewer.token).players.find(p => p.id === copier.id).cards.find(c => c.id === targetId).image, source.image);
});

test('Ability-only copy keeps name, photo and printing, and expires completely', () => {
  const { room, target, source, copy } = setup();
  const before = structuredClone(target);
  copy({ copyMode: 'ability', until: 'endTurn' });
  assert.equal(target.effect, source.effect);
  for (const key of ['name', 'image', 'catalogId', 'type']) assert.equal(target[key], before[key]);
  room.turn++;
  expire(room);
  assert.deepEqual(target, before);
});

test('Full copy returns original artwork and identity when leaving play', () => {
  const { room, copier, target, copy } = setup();
  const before = structuredClone(target);
  copy();
  action(room, copier.token, { type: 'effect', operation: 'move', ids: [target.id], zone: 'cementerio', reason: 'Sale del juego' });
  for (const key of ['name', 'image', 'catalogId', 'edition', 'effect']) assert.equal(target[key], before[key]);
  assert.equal(target.originalForm, undefined);
});

test('Opponent recipient only changes after its controller approves the copy', () => {
  const { room, owner, copier, source, target } = setup();
  action(room, owner.token, { type: 'requestEffect', playerId: copier.id,
    operation: 'copy', ids: [target.id], sourceId: source.id, copyMode: 'full', reason: 'Copia acordada' });
  assert.equal(target.name, 'Corazón del Dragón');
  action(room, copier.token, { type: 'approveEffect', requestId: room.requests[0].id });
  assert.equal(target.name, source.name);
  assert.equal(target.image, source.image);
  assert.equal(source.name, 'Biblioteca de Caballería');
});

test('Copy rejects hidden source, self copy, multiple recipients and changing opponent without approval', () => {
  const { source, target, copy, owner, copier } = setup();
  const before = structuredClone(target);
  source.zone = 'mano';
  assert.throws(() => copy(), /visible/);
  source.zone = 'reserva';
  assert.throws(() => copy({ sourceId: target.id }), /sí misma/);
  assert.throws(() => copy({ ids: [target.id, copier.cards[0].id] }), /una sola/);
  assert.throws(() => copy({}, owner), /Carta no encontrada/);
  assert.deepEqual(target, before);
});
