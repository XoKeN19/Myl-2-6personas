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
  };
}
export function player(name) {
  const cards = [
    card({ name: 'Oro inicial', type: 'Oro', zone: 'reserva' }),
    ...Array.from({ length: 49 }, (_, i) =>
      card({ name: `Carta ${i + 1}`, zone: 'castillo' }),
    ),
  ];
  cards.forEach((c) => (c.deckKey = c.id));
  return {
    id: id(),
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
  room.drawn ??= false;
  room.played ??= false;
  room.goldPlayed ??= false;
  room.resolved ??= [];
  room.battleReady ??= [];
  for (const p of room.players) {
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
export function view(room, token) {
  const p = room.players.find((p) => p.token === token);
  if (!p) fail('Sesión inválida. Vuelve a entrar.');
  return {
    ...room,
    players: room.players.map((q) => ({
      id: q.id,
      name: q.name,
      ready: q.ready,
      mulligans: q.mulligans,
      freeMulligan: q.freeMulligan,
      houseMulligan: q.houseMulligan,
      cards: q.cards.map((c, i) =>
        c.zone === 'castillo' || (c.zone === 'mano' && q.id !== p.id)
          ? { id: `hidden-${q.id}-${c.zone}-${i}`, zone: c.zone, hidden: true }
          : c,
      ),
    })),
    me: p.id,
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
  c.zone = zone;
  c.attachedTo = null;
  c.target = null;
  c.blocks = null;
  if (zone === 'defensa' && !['defensa', 'ataque'].includes(before))
    c.canAttack = false;
  if (!['defensa', 'ataque'].includes(zone)) {
    for (const a of p.cards.filter((a) => a.attachedTo === c.id)) {
      a.attachedTo = null;
      a.zone = zone;
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
        damage: Math.max(0, c.strength - (b?.strength ?? 0)),
        destroyAttacker: !!b && b.strength >= c.strength,
        destroyBlocker: !!b && c.strength >= b.strength,
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
      Object.assign(c, n);
      message = 'editó una carta';
      break;
    }
    case 'move': {
      const c = own();
      if (!ZONES.includes(a.zone)) fail('Zona inválida');
      if (room.started) {
        if (a.zone === 'ataque') fail('Usa Declarar atacante');
        if (c.zone === 'castillo')
          fail('Usa el robo de turno o Robo por efecto');
        if (
          c.zone === 'mano' &&
          ['defensa', 'apoyo', 'reserva'].includes(a.zone)
        ) {
          active();
          phase('Vigilia');
          if (c.type === 'Oro') {
            if (a.zone !== 'reserva' || room.played || room.goldPlayed)
              fail(
                'El Oro debe ser la primera carta de Vigilia y sólo uno por turno',
              );
            room.goldPlayed = true;
          } else {
            if (c.type === 'Arma') fail('Usa Equipar arma');
            if (
              (c.type === 'Aliado' && a.zone !== 'defensa') ||
              (c.type === 'Tótem' && a.zone !== 'apoyo') ||
              !['Aliado', 'Tótem'].includes(c.type)
            )
              fail('Zona incorrecta para este tipo');
            room.played = true;
          }
        }
      }
      move(p, c, a.zone);
      message = `movió una carta a ${a.zone}`;
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
    case 'damage':
      message = `botó ${take(p, num(a.count, 1, 250), 'cementerio')} carta(s) de su Castillo`;
      break;
    case 'shuffle':
      shuffle(p);
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
      active();
      phase(...PHASES);
      const next = PHASES[PHASES.indexOf(room.phase) + 1];
      if (
        a.phase !== next &&
        !(room.phase === 'Vigilia' && a.phase === 'Final')
      )
        fail('Avanza en orden; sólo puedes omitir la batalla desde Vigilia');
      if (room.phase === 'Asignación de daño') {
        const targets = room.players
          .find((q) => q.id === room.active)
          .cards.filter((c) => c.zone === 'ataque' && c.target)
          .map((c) => c.target);
        if (targets.some((t) => !room.resolved.includes(t)))
          fail('Resuelve el daño contra cada defensor antes de finalizar');
      }
      room.phase = a.phase;
      room.battleReady = [];
      message = `avanzó a ${a.phase}`;
      break;
    }
    case 'next':
      active();
      phase('Final');
      if (room.turn !== 1 && !room.drawn)
        fail('Primero roba tu carta de fin de turno');
      if (p.cards.filter((c) => c.zone === 'mano').length > 8)
        fail('Descarta hasta tener 8 cartas antes de terminar');
      room.active =
        room.players[
          (room.players.findIndex((q) => q.id === p.id) + 1) %
            room.players.length
        ].id;
      room.turn++;
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
      if (!c.canAttack && !str(a.reason, 300))
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
  if (!['battleReady', 'resolve', 'note'].includes(a.type))
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
  log(room, `${p.name}: ${message}`);
  return view(room, token);
}
