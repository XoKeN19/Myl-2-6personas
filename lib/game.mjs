import { effectAction, power, has, expire } from './effects.mjs';
import { randomBytes, randomInt } from 'node:crypto';
export const ZONES = [
  'castillo',
  'mano',
  'defensa',
  'ataque',
  'apoyo',
  'reserva',
  'pagado',
  'cementerio',
  'destierro',
];
export const TYPES = ['Aliado', 'Arma', 'Tótem', 'Talismán', 'Oro'];
export const PHASES = [
  'Agrupación',
  'Vigilia',
  'Ataque',
  'Bloqueo',
  'Guerra de Talismanes',
  'Asignación de daño',
  'Final',
];
const id = () => randomBytes(12).toString('hex');
const fail = (m) => {
  throw new Error(m);
};
const num = (v, min = 0, max = 999) =>
  Number.isInteger(Number(v)) && Number(v) >= min && Number(v) <= max
    ? Number(v)
    : fail('Número fuera de rango');
const str = (v, max = 100) =>
  typeof v === 'string' ? v.trim().slice(0, max) : '';
export function definition(data = {}) {
  if (!data || typeof data !== 'object') fail('Carta inválida');
  return {
    name: str(data.name) || 'Carta sin nombre',
    type: TYPES.includes(data.type)
      ? data.type
      : fail('Tipo de carta inválido'),
    effect: str(data.effect, 3000),
    race: str(data.race, 60),
    cost: num(data.cost ?? 0),
    strength: num(data.strength ?? 0),
  };
}
export function card(data = {}) {
  return {
    ...definition({ type: 'Aliado', ...data }),
    id: id(),
    zone: ZONES.includes(data.zone) ? data.zone : 'mano',
    attachedTo: null,
    target: null,
    blocks: null,
    canAttack: false,
    statuses: {},
    modifiers: [],
  };
}
export function player(name) {
  const playerId = id();
  const cards = [
    card({ name: 'Oro inicial', type: 'Oro', zone: 'reserva' }),
    ...Array.from({ length: 49 }, (_, i) =>
      card({ name: `Carta ${i + 1}`, zone: 'castillo' }),
    ),
  ];
  cards.forEach((c) => {
    c.deckKey = c.id;
    c.ownerId = playerId;
  });
  return {
    id: playerId,
    temporaryGold: 0,
    token: id() + id(),
    name: str(name, 32) || 'Gladiador',
    cards,
    deckList: cards.map((c) => ({ ...definition(c), key: c.id })),
    ready: false,
    mulligans: 0,
    freeMulligan: false,
    houseMulligan: false,
  };
}
export function createRoom(name, capacity) {
  const p = player(name);
  return {
    code: randomBytes(5).toString('hex').toUpperCase(),
    capacity: num(capacity, 2, 6),
    players: [p],
    host: p.id,
    active: p.id,
    turn: 1,
    phase: 'Vigilia',
    started: false,
    drawn: false,
    played: false,
    goldPlayed: false,
    resolved: [],
    battleReady: [],
    log: [],
    updated: Date.now(),
    revision: 0,
  };
}
export function migrate(room) {
  room.spectators ??= [];
  room.inspections ??= {};
  room.requests ??= [];
  room.uses ??= {};
  room.drawn ??= false;
  room.played ??= false;
  room.goldPlayed ??= false;
  room.resolved ??= [];
  room.battleReady ??= [];
  for (const p of room.players) {
    p.temporaryGold ??= 0;
    p.cards.forEach((c) => {
      c.ownerId ??= p.id;
      c.statuses ??= {};
      c.modifiers ??= [];
    });
    p.freeMulligan ??= false;
    p.houseMulligan ??= false;
    if (!p.deckList) {
      p.cards.forEach((c) => (c.deckKey = c.id));
      p.deckList = p.cards.map((c) => ({ ...definition(c), key: c.id }));
    }
  }
  return room;
}
export function log(room, message) {
  room.log.unshift({ id: id(), time: Date.now(), message });
  room.log = room.log.slice(0, 120);
  room.updated = Date.now();
  room.revision++;
}
export function addSpectator(room, name) {
  migrate(room);
  if (room.spectators.length >= 100) fail('Límite de espectadores');
  const spectator = {
    id: id(),
    token: id() + id(),
    name: str(name, 32) || 'Espectador',
  };
  room.spectators.push(spectator);
  return spectator;
}
function visibleCard(c) {
  return { ...c, baseStrength: c.strength, strength: power(c) };
}
export function view(room, token) {
  migrate(room);
  const p = room.players.find((p) => p.token === token),
    spectator = room.spectators.find((x) => x.token === token);
  if (!p && !spectator) fail('Sesión inválida. Vuelve a entrar.');
  const { players, spectators, inspections, requests, ...publicRoom } = room;
  const inspection = p ? inspections[p.id] : null;
  const privateCards = inspection
    ? inspection.ids
        .map((id) =>
          room.players
            .find((x) => x.id === inspection.owner)
            ?.cards.find((c) => c.id === id && c.zone === inspection.zone),
        )
        .filter(Boolean)
        .map(visibleCard)
    : [];
  return {
    ...publicRoom,
    role: p ? 'player' : 'spectator',
    spectatorCount: spectators.length,
    players: players.map((q) => ({
      id: q.id,
      name: q.name,
      ready: q.ready,
      mulligans: q.mulligans,
      freeMulligan: q.freeMulligan,
      houseMulligan: q.houseMulligan,
      temporaryGold: q.temporaryGold,
      cards: q.cards.map((c, i) =>
        (c.zone === 'castillo' || (c.zone === 'mano' && q.id !== p?.id)) &&
        !c.revealed
          ? { id: `hidden-${q.id}-${c.zone}-${i}`, zone: c.zone, hidden: true }
          : visibleCard(c),
      ),
    })),
    me: p?.id ?? null,
    privateCards,
    inspection: inspection
      ? {
          owner: inspection.owner,
          zone: inspection.zone,
          mode: inspection.mode,
        }
      : null,
    requests: requests
      .filter((x) => x.owner === p?.id || x.actor === p?.id)
      .map((x) => ({
        id: x.id,
        kind: x.kind,
        actor: x.actor,
        owner: x.owner,
        zone: x.zone,
        reason: x.reason,
        operation: x.payload?.operation,
        count: x.snapshot?.length,
      })),
  };
}
export function exportDeck(room, token) {
  const p = room.players.find((p) => p.token === token);
  if (!p) fail('Sesión inválida');
  return {
    version: 1,
    name: `Mazo de ${p.name}`,
    cards: p.deckList.map(definition),
  };
}
export function shuffle(p) {
  const deck = p.cards.filter((c) => c.zone === 'castillo');
  for (let i = deck.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  p.cards = [...p.cards.filter((c) => c.zone !== 'castillo'), ...deck];
}
function move(p, c, zone) {
  const before = c.zone;
  c.revealed = false;
  if (
    c.originalForm &&
    ['defensa', 'ataque', 'apoyo', 'reserva', 'pagado'].includes(before) &&
    ['castillo', 'mano', 'cementerio', 'destierro'].includes(zone)
  ) {
    Object.assign(c, c.originalForm);
    delete c.originalForm;
  }
  if (['castillo', 'mano', 'cementerio', 'destierro'].includes(zone)) {
    c.modifiers = [];
    c.statuses = {};
    c.canAttack = false;
  }
  c.zone = zone;
  c.attachedTo = null;
  c.target = null;
  c.blocks = null;
  if (zone === 'defensa' && !['defensa', 'ataque'].includes(before))
    c.canAttack = false;
  if (!['defensa', 'ataque'].includes(zone)) {
    for (const a of p.cards.filter((a) => a.attachedTo === c.id)) {
      move(p, a, zone);
    }
  }
}
function take(p, count, zone) {
  const deck = p.cards.filter((c) => c.zone === 'castillo').slice(0, count);
  deck.forEach((c) => move(p, c, zone));
  return deck.length;
}
function group(p) {
  for (const c of p.cards) {
    if (c.zone === 'ataque') {
      c.zone = 'defensa';
      c.target = null;
    }
    if (c.zone === 'defensa' && c.type === 'Aliado') c.canAttack = true;
    if (c.zone === 'pagado') c.zone = 'reserva';
    c.blocks = null;
  }
}
export function combat(room, defender) {
  const a = room.players.find((p) => p.id === room.active),
    d = room.players.find((p) => p.id === defender);
  if (!d || !a) fail('Elige un defensor');
  return a.cards
    .filter(
      (c) => c.zone === 'ataque' && c.target === d.id && c.type === 'Aliado',
    )
    .map((c) => {
      const b = d.cards.find(
        (x) => x.zone === 'defensa' && x.type === 'Aliado' && x.blocks === c.id,
      );
      return {
        attackerId: c.id,
        blockerId: b?.id,
        attacker: c.name,
        blocker: b?.name ?? 'Sin bloqueo',
        damage: Math.max(0, power(c) - (b ? power(b) : 0)),
        destroyAttacker:
          !!b && power(b) >= power(c) && !has(c, 'indestructible'),
        destroyBlocker:
          !!b && power(c) >= power(b) && !has(b, 'indestructible'),
      };
    });
}
export function action(room, token, a) {
  migrate(room);
  const p = room.players.find((p) => p.token === token);
  if (!p) fail('Sesión inválida');
  const own = () =>
    p.cards.find((c) => c.id === a.cardId) ?? fail('Carta no encontrada');
  const active = () => {
    if (room.active !== p.id) fail('No es tu turno');
  };
  const phase = (...allowed) => {
    if (!room.started || !allowed.includes(room.phase))
      fail(`Esta acción corresponde a: ${allowed.join(', ')}`);
  };
  let message = '';
  switch (a.type) {
    case 'look':
    case 'closeLook':
    case 'requestLook':
    case 'grantLook':
    case 'denyRequest':
    case 'revokeLook':
    case 'requestEffect':
    case 'approveEffect':
    case 'markUse':
    case 'temporaryGold':
    case 'effect':
      message = effectAction(room, p, a, {
        id,
        move,
        shuffle,
        definition,
        ZONES,
        TYPES,
      });
      break;

    case 'add':
      if (p.cards.length >= 250) fail('Límite de 250 cartas');
      if (room.started && !str(a.reason, 300))
        fail('Explica qué efecto crea la carta');
      p.cards.push(card(a.card));
      message =
        'añadió una carta' + (a.reason ? `: ${str(a.reason, 300)}` : '');
      break;
    case 'edit': {
      const c = own(),
        n = definition(a.card),
        original = p.deckList.find((x) => x.key === c.deckKey);
      if (original && (!room.started || /^Carta \d+$/.test(original.name)))
        Object.assign(original, n);
      if (n.strength === power(c)) n.strength = c.strength;
      else c.modifiers = [];
      Object.assign(c, n);
      message = 'editó una carta';
      break;
    }
    case 'move': {
      const c = own();
      if (!ZONES.includes(a.zone)) fail('Zona inválida');
      move(p, c, a.zone);
      message = `movió libremente ${c.name} a ${a.zone}`;
      break;
    }
    case 'freeMove': {
      if (!ZONES.includes(a.zone)) fail('Zona inválida');
      const source = room.players.find((q) => q.id === a.sourcePlayerId) || p;
      const c = source.cards.find((x) => x.id === a.cardId);
      if (!c) fail('Carta no encontrada');
      if (source.id !== p.id) {
        const inspection = room.inspections[p.id];
        const isPrivate = ['mano', 'castillo'].includes(c.zone) && !c.revealed;
        if (
          isPrivate &&
          !(inspection?.owner === source.id && inspection.ids.includes(c.id))
        )
          fail('Primero pide permiso para mirar esa zona privada');
        const transferIds = new Set([
          c.id,
          ...source.cards.filter((x) => x.attachedTo === c.id).map((x) => x.id),
        ]);
        move(source, c, a.zone);
        const transferred = source.cards.filter((x) => transferIds.has(x.id));
        source.cards = source.cards.filter((x) => !transferIds.has(x.id));
        transferred.forEach((x) => (x.freeControl = true));
        p.cards.push(...transferred);
        message = `tomó control de ${c.name} desde ${source.name} y la movió a ${a.zone}`;
      } else {
        move(p, c, a.zone);
        message = `movió libremente ${c.name} a ${a.zone}`;
      }
      break;
    }
    case 'draw':
      active();
      phase('Final');
      if (room.turn === 1) fail('En el primer turno de la partida no se roba');
      if (room.drawn) fail('Ya robaste tu carta de este turno');
      take(p, 1, 'mano');
      room.drawn = true;
      message = 'robó su carta de fin de turno';
      break;
    case 'effectDraw':
      phase(...PHASES);
      if (!str(a.reason, 300))
        fail('Indica la carta o efecto que permite robar');
      message = `robó ${take(p, num(a.count, 1, 50), 'mano')} por efecto: ${str(a.reason, 300)}`;
      break;
    case 'freeDraw':
      message = `robó libremente ${take(p, num(a.count, 1, 50), 'mano')} carta(s)`;
      break;
    case 'damage':
      message = `botó ${take(p, num(a.count, 1, 250), 'cementerio')} carta(s) de su Castillo`;
      break;
    case 'shuffle':
      shuffle(p);
      for (const [k, v] of Object.entries(room.inspections))
        if (v.owner === p.id && v.zone === 'castillo')
          delete room.inspections[k];
      p.cards
        .filter((c) => c.zone === 'castillo')
        .forEach((c) => (c.revealed = false));
      message = 'barajó su Castillo';
      break;
    case 'setup':
      if (room.started || p.ready) fail('La mano inicial ya está preparada');
      if (p.cards.filter((c) => c.zone === 'mano').length)
        fail('Devuelve las cartas de tu mano al Castillo antes de prepararla');
      shuffle(p);
      take(p, 8, 'mano');
      p.ready = true;
      message = 'preparó su mano inicial';
      break;
    case 'mulligan':
    case 'houseMulligan':
    case 'freeMulligan': {
      if (room.started || !p.ready)
        fail('El mulligan sólo está disponible antes de comenzar');
      const hand = p.cards.filter((c) => c.zone === 'mano');
      let count = hand.length - 1;
      if (a.type === 'houseMulligan') {
        if (p.houseMulligan) fail('Ya usaste Volver a ocho');
        p.houseMulligan = true;
        count = 8;
        message = 'usó Volver a ocho (regla de la casa, una vez)';
      } else if (a.type === 'freeMulligan') {
        if (p.freeMulligan || hand.filter((c) => c.type === 'Oro').length > 1)
          fail('Sólo una vez, con uno o ningún Oro');
        count = hand.length;
        p.freeMulligan = true;
        message = `mostró su mano (${hand.map((c) => c.name).join(', ')}) e hizo mulligan excepcional conservando ${count} cartas`;
      } else {
        if (count < 1) fail('No puedes reducir más la mano');
        p.mulligans++;
        message = 'hizo mulligan normal';
      }
      hand.forEach((c) => move(p, c, 'castillo'));
      shuffle(p);
      take(p, count, 'mano');
      break;
    }
    case 'start':
      if (room.host !== p.id) fail('Sólo el anfitrión puede comenzar');
      if (
        room.started ||
        room.players.length < 2 ||
        room.players.some((q) => !q.ready)
      )
        fail('Se necesitan al menos 2 jugadores con mano preparada');
      room.started = true;
      room.phase = 'Vigilia';
      room.drawn = false;
      message = 'comenzó la partida';
      break;
    case 'phase': {
      if (!PHASES.includes(a.phase)) fail('Fase inválida');
      room.phase = a.phase;
      room.battleReady = [];
      message = `cambió libremente la fase a ${a.phase}`;
      break;
    }
    case 'next':
      active();
      room.active =
        room.players[
          (room.players.findIndex((q) => q.id === p.id) + 1) %
            room.players.length
        ].id;
      room.turn++;
      expire(room);
      room.phase = 'Agrupación';
      room.drawn = false;
      room.played = false;
      room.goldPlayed = false;
      room.resolved = [];
      room.battleReady = [];
      group(room.players.find((q) => q.id === room.active));
      message = 'terminó el turno; el siguiente jugador agrupó sus cartas';
      break;
    case 'group':
      active();
      phase('Agrupación');
      group(p);
      message = 'agrupó sus cartas';
      break;
    case 'attach': {
      active();
      phase('Vigilia');
      const c = own(),
        host = p.cards.find(
          (x) =>
            x.id === a.hostId &&
            x.type === 'Aliado' &&
            ['defensa', 'ataque'].includes(x.zone),
        );
      if (has(c, 'noJugable')) fail('Esta carta no puede jugarse');
      if (c.type !== 'Arma' || c.zone !== 'mano' || !host)
        fail('Selecciona un Arma de tu mano y un Aliado en juego');
      if (p.cards.some((x) => x.attachedTo === host.id))
        fail(
          'El aliado ya porta un Arma; resuelve las excepciones manualmente',
        );
      c.attachedTo = host.id;
      c.zone = 'apoyo';
      room.played = true;
      message = `equipó ${c.name} a ${host.name}`;
      break;
    }
    case 'attack': {
      active();
      phase('Ataque');
      const c = own();
      if (
        c.type !== 'Aliado' ||
        c.zone !== 'defensa' ||
        !room.players.some((q) => q.id === a.target && q.id !== p.id)
      )
        fail('Ataque inválido');
      if (has(c, 'noAtacaBloquea'))
        fail('El aliado está marcado: no puede atacar ni bloquear');
      if (!c.canAttack && !has(c, 'furia') && !str(a.reason, 300))
        fail(
          'Este aliado necesita pasar por Agrupación. Para Furia u otra excepción, indica el efecto',
        );
      c.zone = 'ataque';
      c.target = a.target;
      c.blocks = null;
      message =
        `declaró atacante a ${c.name}` +
        (a.reason ? `: ${str(a.reason, 300)}` : '');
      break;
    }
    case 'block': {
      phase('Bloqueo');
      const c = own(),
        attacker = room.players
          .find((q) => q.id === room.active)
          ?.cards.find(
            (x) =>
              x.id === a.attacker && x.zone === 'ataque' && x.target === p.id,
          );
      if (
        has(c, 'noAtacaBloquea') ||
        (attacker && has(attacker, 'imbloqueable'))
      )
        fail('Un estado impide este bloqueo');
      if (c.type !== 'Aliado' || c.zone !== 'defensa' || !attacker)
        fail('Bloqueo inválido');
      p.cards.forEach((x) => {
        if (x.blocks === attacker.id) x.blocks = null;
      });
      c.blocks = attacker.id;
      message = `asignó ${c.name} para bloquear a ${attacker.name}`;
      break;
    }
    case 'clearBlock':
      phase('Bloqueo');
      own().blocks = null;
      message = 'retiró un bloqueo';
      break;
    case 'battleReady':
      phase('Asignación de daño');
      if (!room.battleReady.includes(p.id)) room.battleReady.push(p.id);
      message =
        'confirmó que las fuerzas y efectos están listos para resolver el daño básico';
      break;
    case 'resolveManual':
      active();
      phase('Asignación de daño');
      if (!str(a.reason, 300)) fail('Describe el resultado manual');
      if (!room.players.some((q) => q.id === a.defender && q.id !== p.id))
        fail('Defensor inválido');
      if (
        !room.battleReady.includes(p.id) ||
        !room.battleReady.includes(a.defender)
      )
        fail('Ambos deben confirmar');
      if (room.resolved.includes(a.defender)) fail('Ya fue resuelto');
      room.resolved.push(a.defender);
      message = `cerró un combate resuelto manualmente: ${str(a.reason, 300)}`;
      break;
    case 'resolve': {
      active();
      phase('Asignación de daño');
      const d = room.players.find((q) => q.id === a.defender && q.id !== p.id);
      if (!d) fail('Defensor inválido');
      if (room.resolved.includes(d.id)) fail('Este combate ya fue resuelto');
      if (!room.battleReady.includes(p.id) || !room.battleReady.includes(d.id))
        fail(
          'Atacante y defensor deben confirmar los efectos antes de resolver',
        );
      const rows = combat(room, d.id);
      if (!rows.length) fail('No hay ataques contra este defensor');
      let damage = 0;
      for (const row of rows) {
        damage += row.damage;
        if (row.destroyAttacker)
          move(
            p,
            p.cards.find((c) => c.id === row.attackerId),
            'cementerio',
          );
        if (row.destroyBlocker)
          move(
            d,
            d.cards.find((c) => c.id === row.blockerId),
            'cementerio',
          );
      }
      const actual = take(d, damage, 'cementerio');
      room.resolved.push(d.id);
      message = `resolvió combate contra ${d.name}: ${damage} daño, ${actual} cartas botadas; bajas enviadas al Cementerio`;
      break;
    }
    case 'note':
      message = str(a.text, 500);
      if (!message) fail('Escribe una nota');
      break;
    case 'import': {
      if (room.started || p.ready)
        fail('Importa el mazo antes de preparar tu mano');
      const list = Array.isArray(a.cards) ? a.cards : a.cards?.cards;
      if (!Array.isArray(list) || list.length !== 50)
        fail('El mazo debe contener exactamente 50 cartas');
      const cards = list.map((c) =>
        card({ ...definition(c), zone: 'castillo' }),
      );
      const gold = cards.find(
        (c) => c.type === 'Oro' && (!c.effect || /oro inicial/i.test(c.effect)),
      );
      if (!gold) fail('Falta un Oro sin habilidad o con Oro Inicial');
      gold.zone = 'reserva';
      cards.forEach((c) => (c.deckKey = c.id));
      p.cards = cards;
      p.deckList = cards.map((c) => ({ ...definition(c), key: c.id }));
      message = 'cargó un mazo completo de 50 cartas';
      break;
    }
    default:
      fail('Acción desconocida');
  }
  if (
    ![
      'battleReady',
      'resolve',
      'resolveManual',
      'note',
      'look',
      'closeLook',
      'requestLook',
      'grantLook',
      'denyRequest',
      'revokeLook',
      'requestEffect',
    ].includes(a.type)
  )
    room.battleReady = [];
  for (const q of room.players)
    for (const c of q.cards)
      if (
        c.blocks &&
        !room.players
          .find((x) => x.id === room.active)
          ?.cards.some(
            (x) =>
              x.id === c.blocks && x.zone === 'ataque' && x.target === q.id,
          )
      )
        c.blocks = null;
  for (const controller of room.players) {
    for (const c of controller.cards)
      if (
        c.ownerId &&
        c.ownerId !== controller.id &&
        !c.freeControl &&
        ['mano', 'castillo', 'cementerio', 'destierro'].includes(c.zone)
      ) {
        const owner = room.players.find((x) => x.id === c.ownerId);
        if (owner) {
          controller.cards = controller.cards.filter((x) => x !== c);
          owner.cards.push(c);
        }
      }
  }
  log(room, `${p.name}: ${message}`);
  return view(room, token);
}
