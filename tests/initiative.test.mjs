import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  rollInitiative,
  INITIATIVE_ROUND_MS,
  INITIATIVE_RESULT_MS,
} from '../lib/initiative.mjs';
import { createRoom, player, action, view } from '../lib/game.mjs';
test('d20: el mayor gana y sólo los empatados repiten', () => {
  const values = [7, 19, 19, 2, 15];
  const result = rollInitiative(
    [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
    () => values.shift(),
    100,
  );
  assert.equal(result.winner, 'c');
  assert.deepEqual(result.rounds[1], [
    { player: 'b', value: 2 },
    { player: 'c', value: 15 },
  ]);
  assert.equal(
    result.endsAt,
    100 + result.rounds.length * INITIATIVE_ROUND_MS + INITIATIVE_RESULT_MS,
  );
});
test('Iniciativa del servidor: anfitrión, mazos, mano inicial, bloqueo y resultado compartido', () => {
  const room = createRoom('A', 2),
    a = room.players[0],
    b = player('B');
  room.players.push(b);
  assert.throws(() => action(room, a.token, { type: 'start' }));
  a.deckLoaded = b.deckLoaded = true;
  assert.throws(() => action(room, b.token, { type: 'start' }));
  action(room, a.token, { type: 'start' });
  assert.ok(room.timer.deadline > Date.now());
  for (const p of [a, b]) {
    assert.equal(p.cards.filter((c) => c.zone === 'mano').length, 8);
    assert.equal(p.ready, true);
  }
  const result = room.initiative;
  const final = result.rounds.at(-1);
  assert.equal(
    final.find((x) => x.player === result.winner).value,
    Math.max(...final.map((x) => x.value)),
  );
  assert.equal(room.active, result.winner);
  assert.deepEqual(
    view(room, a.token).initiative,
    view(room, b.token).initiative,
  );
  assert.throws(() => action(room, a.token, { type: 'next' }), /tirada/);
  room.initiative.endsAt = 0;
  assert.throws(() => action(room, a.token, { type: 'start' }));
});

test('Una sala de tres espera al tercero antes de comenzar', () => {
 const r=createRoom('A',3);r.players.push(player('B'));
 r.players.forEach(p=>p.deckLoaded=true);
 assert.throws(()=>action(r,r.players[0].token,{type:'start'}));
 assert.equal(r.started,false);
 r.players.push(player('C'));r.players[2].deckLoaded=true;
 action(r,r.players[0].token,{type:'start'});
  assert.equal(r.initiative.rounds[0].length,3);
});

test('Crear una carta marca al jugador como mazo preparado', () => {
  const room = createRoom('A', 2), playerA = room.players[0];
  assert.equal(playerA.deckLoaded, undefined);
  action(room, playerA.token, {
    type: 'add',
    card: { name: 'Aliado de prueba', type: 'Aliado', zone: 'mano' },
  });
  assert.equal(playerA.deckLoaded, true);
});
