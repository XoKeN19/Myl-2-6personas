import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createRoom,
  player,
  addSpectator,
  view,
  action,
  exportDeck,
  card,
  combat,
} from '../lib/game.mjs';
const setup = () => {
  const r = createRoom('A', 2);
  r.players.push(player('B'));
  for (const p of r.players) action(r, p.token, { type: 'setup' });
  return [r, ...r.players];
};
const effect = (r, p, operation, ids, extra = {}) =>
  action(r, p.token, {
    type: 'effect',
    operation,
    ids,
    reason: 'Prueba de carta',
    ...extra,
  });
test('Espectador entra con sala llena y no ve manos, tokens, lista ni inspecciones', () => {
  const [r, p] = setup(),
    s = addSpectator(r, 'Mira');
  const c = p.cards.find((c) => c.zone === 'mano');
  c.name = 'CARTA PRIVADA';
  action(r, p.token, {
    type: 'look',
    zone: 'castillo',
    mode: 'all',
    reason: 'Buscar',
  });
  const v = view(r, s.token);
  assert.equal(v.role, 'spectator');
  assert.equal(v.me, null);
  assert.equal(v.privateCards.length, 0);
  assert.equal(v.requests.length, 0);
  assert.ok(!JSON.stringify(v).includes('CARTA PRIVADA'));
  assert.ok(!JSON.stringify(v).includes(s.token));
  assert.ok(!JSON.stringify(v).includes(p.token));
  assert.throws(() => action(r, s.token, { type: 'draw' }));
  assert.throws(() => exportDeck(r, s.token));
  assert.equal(r.players.length, 2);
});
test('Mostrar y ocultar mano es visible para espectador, sin filtrarse el resto', () => {
  const [r, p] = setup(),
    s = addSpectator(r, 'Mira');
  const c = p.cards.find((c) => c.zone === 'mano');
  c.name = 'Mostrada';
  effect(r, p, 'reveal', [c.id]);
  assert.ok(
    view(r, s.token).players[0].cards.some((c) => c.name === 'Mostrada'),
  );
  effect(r, p, 'hide', [c.id]);
  assert.ok(
    !view(r, s.token).players[0].cards.some((c) => c.name === 'Mostrada'),
  );
});
test('Mirar tope es privado y mantiene orden; búsqueda general ordena por nombre', () => {
  const [r, p, q] = setup();
  const top = p.cards.filter((c) => c.zone === 'castillo').slice(0, 3);
  action(r, p.token, {
    type: 'look',
    zone: 'castillo',
    mode: 'top',
    count: 3,
    reason: 'Signo',
  });
  assert.deepEqual(
    view(r, p.token).privateCards.map((c) => c.id),
    top.map((c) => c.id),
  );
  assert.equal(view(r, q.token).privateCards.length, 0);
  action(r, p.token, {
    type: 'look',
    zone: 'castillo',
    mode: 'all',
    reason: 'Karna',
  });
  const names = view(r, p.token).privateCards.map((c) => c.name);
  assert.deepEqual(
    names,
    [...names].sort((a, b) => a.localeCompare(b)),
  );
});
test('Consultar mano rival requiere consentimiento y permite revocación', () => {
  const [r, p, q] = setup();
  action(r, p.token, {
    type: 'requestLook',
    playerId: q.id,
    zone: 'mano',
    reason: 'Chakram',
  });
  const req = r.requests[0];
  assert.throws(() =>
    action(r, p.token, { type: 'grantLook', requestId: req.id }),
  );
  assert.equal(view(r, p.token).privateCards.length, 0);
  action(r, q.token, { type: 'grantLook', requestId: req.id });
  assert.equal(view(r, p.token).privateCards.length, 8);
  action(r, q.token, { type: 'revokeLook' });
  assert.equal(view(r, p.token).privateCards.length, 0);
});
test('Efectos sobre rival requieren aprobación; no puede proponer cartas privadas no vistas', () => {
  const [r, p, q] = setup();
  const c = q.cards.find((c) => c.zone === 'mano');
  assert.throws(() => effect(r, p, 'banish', [c.id]));
  assert.throws(() =>
    action(r, p.token, {
      type: 'requestEffect',
      playerId: q.id,
      ids: [c.id],
      operation: 'banish',
      reason: 'Efecto',
    }),
  );
  action(r, q.token, { type: 'move', cardId: c.id, zone: 'defensa' });
  action(r, p.token, {
    type: 'requestEffect',
    playerId: q.id,
    ids: [c.id],
    operation: 'banish',
    reason: 'Efecto',
  });
  assert.equal(c.zone, 'defensa');
  action(r, q.token, { type: 'approveEffect', requestId: r.requests[0].id });
  assert.equal(c.zone, 'destierro');
});
test('Solicitud obsoleta no mueve una carta de otra zona', () => {
  const [r, p, q] = setup();
  const c = q.cards.find((c) => c.zone === 'mano');
  effect(r, q, 'move', [c.id], { zone: 'defensa' });
  action(r, p.token, {
    type: 'requestEffect',
    playerId: q.id,
    ids: [c.id],
    operation: 'banish',
    reason: 'Efecto',
  });
  effect(r, q, 'move', [c.id], { zone: 'cementerio' });
  assert.throws(() =>
    action(r, q.token, { type: 'approveEffect', requestId: r.requests[0].id }),
  );
  assert.equal(c.zone, 'cementerio');
});
test('Barajar cementerio devuelve todas las seleccionadas sin duplicar y cierra consulta', () => {
  const [r, p] = setup();
  const cards = p.cards.filter((c) => c.zone === 'mano').slice(0, 3);
  effect(
    r,
    p,
    'move',
    cards.map((c) => c.id),
    { zone: 'cementerio' },
  );
  action(r, p.token, {
    type: 'look',
    zone: 'castillo',
    mode: 'top',
    count: 3,
    reason: 'Mirar',
  });
  effect(
    r,
    p,
    'shuffle',
    cards.map((c) => c.id),
  );
  assert.ok(cards.every((c) => c.zone === 'castillo'));
  assert.equal(p.cards.length, 50);
  assert.equal(new Set(p.cards.map((c) => c.id)).size, 50);
  assert.equal(view(r, p.token).privateCards.length, 0);
});
test('Tope y fondo preservan el orden elegido', () => {
  const [r, p] = setup();
  const cards = p.cards.filter((c) => c.zone === 'mano').slice(0, 3);
  const ids = cards.map((c) => c.id).reverse();
  effect(r, p, 'top', ids);
  assert.deepEqual(
    p.cards
      .filter((c) => c.zone === 'castillo')
      .slice(0, 3)
      .map((c) => c.id),
    ids,
  );
  effect(r, p, 'bottom', ids);
  assert.deepEqual(
    p.cards
      .filter((c) => c.zone === 'castillo')
      .slice(-3)
      .map((c) => c.id),
    ids,
  );
});
test('Fuerza y estados temporales expiran al terminar turno y afectan combate', () => {
  const [r, p, q] = setup();
  action(r, p.token, { type: 'start' });
  const c = p.cards.find((c) => c.zone === 'mano');
  effect(r, p, 'move', [c.id], { zone: 'defensa' });
  effect(r, p, 'strength', [c.id], { delta: 2, until: 'endTurn' });
  effect(r, p, 'status', [c.id], {
    status: 'indestructible',
    until: 'endTurn',
    enabled: true,
  });
  assert.equal(
    view(r, p.token).players[0].cards.find((x) => x.id === c.id).strength,
    c.strength + 2,
  );
  assert.throws(() => effect(r, p, 'destroy', [c.id]));
  action(r, p.token, { type: 'phase', phase: 'Final' });
  action(r, p.token, { type: 'next' });
  assert.equal(c.modifiers.length, 0);
  assert.equal(c.statuses.indestructible, undefined);
  assert.equal(q.temporaryGold, 0);
});
test('Indestructible preserva aliado al resolver igualdad de fuerza', () => {
  const [r, p, q] = setup();
  const a = card({ name: 'A', strength: 3, zone: 'ataque' }),
    b = card({ name: 'B', strength: 3, zone: 'defensa' });
  a.target = q.id;
  b.blocks = a.id;
  p.cards.push(a);
  q.cards.push(b);
  effect(r, p, 'status', [a.id], { status: 'indestructible', enabled: true });
  const rows = combat(r, q.id);
  assert.equal(rows[0].destroyAttacker, false);
  assert.equal(rows[0].destroyBlocker, true);
});
test('Transformar y equipar Oricalón; al salir recupera su forma original', () => {
  const [r, p] = setup();
  const c = p.cards.find((c) => c.zone === 'mano'),
    host = p.cards.filter((c) => c.zone === 'mano')[1];
  effect(r, p, 'move', [host.id], { zone: 'defensa' });
  effect(r, p, 'move', [c.id], { zone: 'cementerio' });
  effect(r, p, 'transform', [c.id], {
    cardType: 'Arma',
    strength: 0,
    effect: 'El portador gana dos',
  });
  effect(r, p, 'attach', [c.id], { hostId: host.id });
  assert.equal(c.type, 'Arma');
  assert.equal(c.attachedTo, host.id);
  effect(r, p, 'move', [host.id], { zone: 'cementerio' });
  assert.equal(c.type, 'Aliado');
  assert.equal(c.attachedTo, null);
});
test('Cambio de controlador conserva propietario y devuelve al cementerio correcto', () => {
  const [r, p, q] = setup();
  const c = p.cards.find((c) => c.zone === 'reserva');
  effect(r, p, 'give', [c.id], { recipient: q.id, zone: 'reserva' });
  assert.ok(q.cards.includes(c));
  assert.ok(!p.cards.includes(c));
  effect(r, q, 'move', [c.id], { zone: 'cementerio' });
  assert.ok(p.cards.includes(c));
  assert.ok(!q.cards.includes(c));
  assert.equal(c.zone, 'cementerio');
});
test('Uso hasta tres veces y oro temporal reinician por turno', () => {
  const [r, p] = setup();
  action(r, p.token, { type: 'start' });
  const c = p.cards.find((c) => c.zone === 'mano');
  for (let i = 0; i < 3; i++)
    action(r, p.token, {
      type: 'markUse',
      cardId: c.id,
      limit: 3,
      ability: 'Dampir',
      reason: 'Activación',
    });
  assert.throws(() =>
    action(r, p.token, {
      type: 'markUse',
      cardId: c.id,
      limit: 3,
      ability: 'Dampir',
      reason: 'Activación',
    }),
  );
  action(r, p.token, { type: 'temporaryGold', delta: 1, reason: 'Bandido' });
  assert.equal(p.temporaryGold, 1);
  action(r, p.token, { type: 'phase', phase: 'Final' });
  action(r, p.token, { type: 'next' });
  assert.equal(p.temporaryGold, 0);
  assert.deepEqual(r.uses, {});
});

test('Retador permite proponer bloqueo y los estados expiran por el jugador elegido',()=>{const[r,p,q]=setup();const a=card({name:'Atacante',strength:3,zone:'ataque'}),b=card({name:'Bloqueador',strength:2,zone:'defensa'});a.target=q.id;p.cards.push(a);q.cards.push(b);action(r,p.token,{type:'requestEffect',playerId:q.id,ids:[b.id],operation:'forceBlock',attackerId:a.id,reason:'Cañón Helios'});action(r,q.token,{type:'approveEffect',requestId:r.requests[0].id});assert.equal(b.blocks,a.id);effect(r,q,'status',[b.id],{status:'noJugable',enabled:true,until:'nextTurn',durationPlayer:p.id});assert.equal(b.statuses.noJugable.player,p.id);assert.throws(()=>effect(r,q,'move',[b.id],{zone:'defensa'}));});
