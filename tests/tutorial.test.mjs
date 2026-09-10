import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createTutorialRoom, tutorialAction } from '../lib/tutorial-room.mjs';

const deck = (name) => JSON.parse(fs.readFileSync(new URL(`../public/decks/${name}`, import.meta.url), 'utf8')).cards;

test('partida tutorial usa la mesa real y verifica la secuencia guiada', () => {
  const room = createTutorialRoom(
    'Aprendiz',
    deck('mazo-heroe-imperio-corregido.json'),
    deck('mazo-dragon-imperio-corregido.json'),
  );
  const human = room.players[0], guide = room.players[1], act = (payload) => tutorialAction(room, human.token, payload);
  assert.equal(room.players.length, 2);
  assert.equal(room.tutorial.private, true);
  assert.equal(human.deckLoaded, true);
  act({ type: 'setup' });
  assert.equal(room.tutorial.step, 1);
  assert.equal(human.cards.filter((card) => card.zone === 'mano').length, 8);
  assert.ok(human.cards.some((card) => card.name === 'Akari Musashi' && card.zone === 'mano'));
  act({ type: 'tutorialContinue' });
  act({ type: 'start' });
  room.initiative.endsAt = 0;
  assert.equal(room.active, human.id);
  const initial = human.cards.find((card) => card.type === 'Oro' && card.zone === 'reserva');
  act({ type: 'tutorialInspect', cardId: initial.id });
  const handGold = human.cards.find((card) => card.type === 'Oro' && card.zone === 'mano');
  act({ type: 'freeMove', cardId: handGold.id, sourcePlayerId: human.id, recipient: human.id, zone: 'reserva' });
  for (const gold of human.cards.filter((card) => card.type === 'Oro' && card.zone === 'reserva').slice(0, 2)) {
    act({ type: 'freeMove', cardId: gold.id, sourcePlayerId: human.id, recipient: human.id, zone: 'pagado' });
  }
  const akari = human.cards.find((card) => card.name === 'Akari Musashi' && card.zone === 'mano');
  act({ type: 'freeMove', cardId: akari.id, sourcePlayerId: human.id, recipient: human.id, zone: 'defensa' });
  act({ type: 'tutorialInspect', cardId: akari.id });
  const talisman = human.cards.find((card) => card.name === 'Tempilcahue' && card.zone === 'mano');
  act({ type: 'freeMove', cardId: talisman.id, sourcePlayerId: human.id, recipient: human.id, zone: 'destierro' });
  act({ type: 'freeMove', cardId: akari.id, sourcePlayerId: human.id, recipient: human.id, zone: 'ataque' });
  act({ type: 'strike', assignments: [{ cardId: akari.id, target: guide.id }] });
  assert.equal(room.tutorial.step, 11);
  assert.equal(room.pendingBattles.length, 0);
  act({ type: 'tutorialContinue' });
  act({ type: 'tutorialContinue' });
  assert.equal(room.tutorial.complete, true);
});

