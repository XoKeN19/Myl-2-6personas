// Explicit tabletop actions. Card text is never evaluated as executable code.

const fail = (m) => {
  throw Error(m);
};

const int = (v, min, max) =>
  Number.isInteger(Number(v)) && Number(v) >= min && Number(v) <= max
    ? Number(v)
    : fail('Cantidad fuera de rango');

const text = (v) => (typeof v === 'string' ? v.trim().slice(0, 500) : '');

export const STATUS = [
  'furia',

  'indestructible',

  'indesterrable',

  'imbloqueable',

  'sinHabilidad',

  'noAtacaBloquea',

  'protegido',

  'noJugable',
];

export function power(c) {
  return Math.max(
    0,

    c.strength + (c.modifiers || []).reduce((n, x) => n + x.delta, 0),
  );
}

export function has(c, status) {
  return !!c.statuses?.[status];
}

export function expire(room) {
  for (const p of room.players)
    for (const c of p.cards) {
      c.modifiers = (c.modifiers || []).filter((x) => !expired(x, room));

      for (const [k, v] of Object.entries(c.statuses || {}))
        if (expired(v, room)) delete c.statuses[k];
    }

  room.inspections = {};

  room.requests = [];

  room.uses = {};

  for (const p of room.players) p.temporaryGold = 0;
}

function expired(x, r) {
  return (
    (x.until === 'endTurn' && x.turn < r.turn) ||
    (x.until === 'nextTurn' && x.turn < r.turn && x.player === r.active)
  );
}

function duration(r, p, a) {
  const until = ['permanent', 'endTurn', 'nextTurn'].includes(a.until)
    ? a.until
    : 'permanent';

  return {
    until,
    turn: r.turn,
    player: r.players.some((x) => x.id === a.durationPlayer)
      ? a.durationPlayer
      : p.id,
  };
}

export function effectAction(room, p, a, h) {
  const { id, move, shuffle, definition, ZONES, TYPES } = h;

  room.inspections ??= {};

  room.requests ??= [];

  room.uses ??= {};

  let message;

  const reason = text(a.reason);

  if (
    !reason &&
    ![
      'closeLook',

      'grantLook',

      'denyRequest',

      'approveEffect',

      'revokeLook',
    ].includes(a.type)
  )
    fail('Indica la carta o habilidad que permite esta acción');

  if (a.type === 'look') {
    if (!['castillo', 'mano'].includes(a.zone)) fail('Sólo Mano o Castillo');

    if (!['all', 'top'].includes(a.mode)) fail('Modo de consulta inválido');

    const ids = p.cards.filter((c) => c.zone === a.zone);

    const list =
      a.mode === 'top'
        ? ids.slice(0, int(a.count, 1, 50))
        : ids.toSorted(
            (x, y) => x.name.localeCompare(y.name) || x.id.localeCompare(y.id),
          );

    room.inspections[p.id] = {
      owner: p.id,

      zone: a.zone,

      ids: list.map((c) => c.id),

      mode: a.mode,
    };

    message = `consultó ${a.mode === 'top' ? 'el tope de' : 'cartas en'} su ${a.zone}: ${reason}`;
  } else if (a.type === 'closeLook') {
    delete room.inspections[p.id];

    message = 'cerró su consulta privada';
  } else if (a.type === 'requestLook') {
    const q = room.players.find((x) => x.id === a.playerId && x.id !== p.id);

    if (!q || !['mano', 'castillo'].includes(a.zone))
      fail('Selecciona el jugador y la zona');

    const mode = a.mode === 'top' ? 'top' : 'all';
    const count = mode === 'top' ? int(a.count, 1, 50) : null;
    if (
      room.requests.some(
        (r) =>
          r.kind === 'look' &&
          r.actor === p.id &&
          r.owner === q.id &&
          r.zone === a.zone,
      )
    )
      fail('Ya tienes una solicitud pendiente para esa zona');

    if (room.requests.length >= 40) fail('Demasiadas solicitudes pendientes');

    room.requests.push({
      id: id(),

      kind: 'look',
      mode,
      count,

      actor: p.id,

      owner: q.id,

      zone: a.zone,

      reason,
    });

    message = `pidió mirar ${a.zone} de ${q.name}: ${reason}`;
  } else if (a.type === 'grantLook') {
    const req = room.requests.find(
      (x) => x.id === a.requestId && x.owner === p.id && x.kind === 'look',
    );

    if (!req) fail('Solicitud no disponible');

    room.inspections[req.actor] = {
      owner: p.id,

      zone: req.zone,

      mode: req.mode || 'all',

      ids: (req.mode === 'top'
        ? p.cards.filter((c) => c.zone === req.zone).slice(0, req.count)
        : p.cards
            .filter((c) => c.zone === req.zone)
            .toSorted(
              (x, y) =>
                x.name.localeCompare(y.name) || x.id.localeCompare(y.id),
            )
      ).map((c) => c.id),
    };

    room.requests = room.requests.filter((x) => x !== req);

    message = `autorizó una consulta privada de su ${req.zone}`;
  } else if (a.type === 'revokeLook') {
    for (const [k, v] of Object.entries(room.inspections))
      if (v.owner === p.id) delete room.inspections[k];

    message = 'cerró los permisos para mirar sus cartas';
  } else if (a.type === 'denyRequest') {
    const req = room.requests.find(
      (x) => x.id === a.requestId && (x.owner === p.id || x.actor === p.id),
    );

    if (!req) fail('Solicitud no disponible');

    room.requests = room.requests.filter((x) => x !== req);

    message = 'canceló una solicitud';
  } else if (a.type === 'requestEffect') {
    const q = room.players.find((x) => x.id === a.playerId && x.id !== p.id);

    if (!q) fail('Jugador inválido');

    const ids = select(q, a.ids);

    const inspection = room.inspections[p.id];

    if (
      ids.some(
        (c) =>
          ['mano', 'castillo'].includes(c.zone) &&
          !c.revealed &&
          !(inspection?.owner === q.id && inspection.ids.includes(c.id)),
      )
    )
      fail('Primero pide permiso para mirar las cartas privadas');

    if (room.requests.length >= 40) fail('Demasiadas solicitudes pendientes');

    room.requests.push({
      id: id(),

      kind: 'effect',

      actor: p.id,

      owner: q.id,

      reason,

      payload: { ...a, type: 'effect' },

      snapshot: ids.map((c) => ({ id: c.id, zone: c.zone })),
    });

    message = `propuso ${a.operation} sobre ${ids.length} carta(s) de ${q.name}: ${reason}`;
  } else if (a.type === 'approveEffect') {
    const req = room.requests.find(
      (x) => x.id === a.requestId && x.kind === 'effect' && x.owner === p.id,
    );

    if (!req) fail('Solicitud no disponible');

    if (
      req.snapshot.some(
        (x) => !p.cards.some((c) => c.id === x.id && c.zone === x.zone),
      )
    )
      fail('Las cartas cambiaron de zona. Rechaza la solicitud y repítela');

    message = effectAction(room, p, { ...req.payload, type: 'effect' }, h);

    room.requests = room.requests.filter((x) => x !== req);

    message = `aceptó un efecto propuesto: ${message}`;
  } else if (a.type === 'markUse') {
    const c = p.cards.find((c) => c.id === a.cardId);

    if (!c) fail('Selecciona la carta');

    const key = `${p.id}:${c.id}:${text(a.ability) || 'principal'}`;

    const max = int(a.limit, 1, 10);

    if ((room.uses[key] || 0) >= max)
      fail('Ya se alcanzó el límite de esta habilidad en este turno');

    room.uses[key] = (room.uses[key] || 0) + 1;

    message = `registró uso ${room.uses[key]}/${max} de ${c.name}: ${reason}`;
  } else if (a.type === 'temporaryGold') {
    p.temporaryGold = Math.max(
      0,

      (p.temporaryGold || 0) + int(a.delta, -50, 50),
    );

    message = `tiene ${p.temporaryGold} Oro(s) temporal(es) este turno: ${reason}`;
  } else if (a.type === 'effect') {
    const cards = select(p, a.ids),
      operation = a.operation;

    const names = cards

      .filter((c) => !['mano', 'castillo'].includes(c.zone) || c.revealed)

      .map((c) => c.name)

      .join(', ');

    if (
      [
        'move',

        'destroy',

        'banish',

        'shuffle',

        'top',

        'bottom',

        'reveal',

        'hide',

        'strength',

        'status',

        'transform',

        'attach',

        'give',

        'cancelAttack',

        'ready',

        'forceBlock',
      ].includes(operation) === false
    )
      fail('Operación inválida');

    if (
      operation === 'move' &&
      ['defensa', 'ataque', 'apoyo', 'reserva'].includes(a.zone) &&
      cards.some((c) => has(c, 'noJugable'))
    )
      fail('Una carta está marcada: no puede jugarse');

    if (operation === 'move' && !ZONES.includes(a.zone)) fail('Zona inválida');

    if (operation === 'attach' && cards.some((c) => has(c, 'noJugable')))
      fail('Esta carta no puede jugarse');
    if (operation === 'strength') int(a.delta, -999, 999);

    if (operation === 'status' && !STATUS.includes(a.status))
      fail('Estado inválido');

    if (operation === 'transform') {
      if (!TYPES.includes(a.cardType)) fail('Tipo inválido');

      int(a.strength, 0, 999);
    }

    if (
      operation === 'attach' &&
      (cards.length !== 1 ||
        cards[0].type !== 'Arma' ||
        !p.cards.some(
          (c) =>
            c.id === a.hostId &&
            c.type === 'Aliado' &&
            ['defensa', 'ataque'].includes(c.zone),
        ))
    )
      fail('Elige un Arma y un portador');

    const recipient =
      operation === 'give'
        ? room.players.find((x) => x.id === a.recipient && x.id !== p.id)
        : null;

    if (
      operation === 'give' &&
      cards.some((c) => cards.some((parent) => c.attachedTo === parent.id))
    )
      fail('Selecciona sólo al portador; sus Armas lo acompañan');

    if (
      operation === 'give' &&
      (!recipient ||
        cards.some(
          (c) =>
            ![
              'defensa',

              'ataque',

              'apoyo',

              'reserva',

              'pagado',

              'cementerio',
            ].includes(c.zone),
        ) ||
        !['defensa', 'apoyo', 'reserva'].includes(a.zone))
    )
      fail('Selecciona otro jugador y una zona de juego');

    if (operation === 'destroy' && cards.some((c) => has(c, 'indestructible')))
      fail(
        'Hay cartas marcadas Indestructibles. Resuelve o retira esa protección primero',
      );

    if (operation === 'banish' && cards.some((c) => has(c, 'indesterrable')))
      fail('Hay cartas marcadas Indesterrables');

    const attacker =
      operation === 'forceBlock'
        ? room.players

            .flatMap((x) => x.cards)

            .find(
              (c) =>
                c.id === a.attackerId &&
                c.zone === 'ataque' &&
                c.target === p.id,
            )
        : null;

    if (
      operation === 'forceBlock' &&
      (cards.length !== 1 ||
        cards[0].type !== 'Aliado' ||
        cards[0].zone !== 'defensa' ||
        !attacker)
    )
      fail('Elige un bloqueador y un atacante dirigido a este jugador');

    for (const c of cards) {
      if (
        ['move', 'destroy', 'banish', 'shuffle', 'top', 'bottom'].includes(
          operation,
        )
      )
        move(
          p,

          c,

          operation === 'destroy'
            ? 'cementerio'
            : operation === 'banish'
              ? 'destierro'
              : ['shuffle', 'top', 'bottom'].includes(operation)
                ? 'castillo'
                : a.zone,
        );

      if (operation === 'reveal') c.revealed = true;

      if (operation === 'hide') c.revealed = false;

      if (operation === 'strength') {
        c.modifiers ??= [];

        c.modifiers.push({
          ...duration(room, p, a),

          delta: Number(a.delta),

          reason,
        });
      }

      if (operation === 'status') {
        c.statuses ??= {};

        if (a.enabled === false) delete c.statuses[a.status];
        else c.statuses[a.status] = { ...duration(room, p, a), reason };
      }

      if (operation === 'transform') {
        c.originalForm ??= definition(c);

        c.type = a.cardType;

        c.strength = Number(a.strength);

        c.effect = text(a.effect) || c.effect;

        c.modifiers = [];

        c.statuses = {};
      }

      if (operation === 'attach') {
        c.attachedTo = a.hostId;

        c.zone = 'apoyo';
      }

      if (operation === 'forceBlock') {
        p.cards.forEach((x) => {
          if (x.blocks === attacker.id) x.blocks = null;
        });

        c.blocks = attacker.id;
      }

      if (operation === 'cancelAttack') {
        c.target = null;

        c.blocks = null;
      }

      if (operation === 'ready') {
        if (c.zone === 'ataque') move(p, c, 'defensa');

        if (c.zone === 'pagado') move(p, c, 'reserva');

        c.canAttack = true;
      }

      if (operation === 'give') {
        const followers = p.cards.filter((x) => x.attachedTo === c.id);

        p.cards = p.cards.filter((x) => x !== c && !followers.includes(x));

        c.zone = a.zone;

        c.target = null;

        c.blocks = null;

        c.canAttack = false;

        recipient.cards.push(c, ...followers);
      }
    }

    if (['top', 'bottom'].includes(operation)) {
      p.cards = p.cards.filter((c) => !cards.includes(c));

      if (operation === 'top') p.cards = [...cards, ...p.cards];
      else p.cards.push(...cards);
    }

    if (operation === 'shuffle') shuffle(p);

    if (['shuffle', 'top', 'bottom'].includes(operation))
      for (const [k, v] of Object.entries(room.inspections))
        if (v.owner === p.id && v.zone === 'castillo')
          delete room.inspections[k];

    message = `${operation}: ${cards.length} carta(s)${names ? ` (${names})` : ''}. ${reason}`;
  } else fail('Acción de efecto desconocida');

  return message;
}

function select(p, ids) {
  if (
    !Array.isArray(ids) ||
    !ids.length ||
    ids.length > 250 ||
    new Set(ids).size !== ids.length
  )
    fail('Selecciona cartas distintas');

  return ids.map(
    (id) => p.cards.find((c) => c.id === id) || fail('Carta no encontrada'),
  );
}
