import { action, createRoom, player, view } from './game.mjs';

export const TUTORIAL_LESSONS = [
  { title: 'Tu mazo ya está cargado', text: 'Esta es la misma preparación de una partida real. Abre Preparación y pulsa Repartir 8.', expect: 'setup' },
  { title: 'Revisa tu mano inicial', text: 'Puedes hacer Mulligan, Volver a 8 o conservarla. Abre Mi mano para verla y elige una opción.', expect: 'mulligan' },
  { title: 'Comienza la partida', text: 'El mazo del Maestro también está listo. Pulsa Comenzar para lanzar los dados e iniciar el primer turno.', expect: 'start' },
  { title: 'Tu Oro inicial', text: 'Patria Vieja comenzó automáticamente en Reserva. Púlsala para leer su habilidad: algunos Oros iniciales tienen texto y otros no.', expect: 'continue' },
  { title: 'Pon un Oro en juego', text: 'Abre tu mano y lleva un Oro a Reserva. Esta acción representa bajar el Oro disponible del turno.', expect: 'gold' },
  { title: 'Paga el coste', text: 'Mueve dos Oros desde Reserva a Oro pagado. Así pagas el coste 2 de tu Aliado.', expect: 'pay' },
  { title: 'Juega un Aliado', text: 'Mueve Akari Musashi desde tu mano a la Línea de defensa.', expect: 'ally' },
  { title: 'Resuelve su habilidad', text: 'Pulsa Akari y lee “cuando entra en juego”. Las acciones de la carta permiten buscar, desterrar, robar o marcar efectos.', expect: 'continue' },
  { title: 'Ventana de respuesta', text: 'Antes de resolver, ambos jugadores pueden usar Talismanes o cancelar habilidades. Tempilcahue es el ejemplo de tu mano.', expect: 'continue' },
  { title: 'Declara el ataque', text: 'Mueve Akari desde Defensa hasta Ataque. Los Aliados con Furia pueden hacerlo el turno en que entran.', expect: 'attackMove' },
  { title: 'Elige el rival', text: 'Pulsa Atacar, selecciona Akari y elige al Maestro como objetivo. El defensor recibirá la oportunidad de bloquear.', expect: 'strike' },
  { title: 'Bloqueo y habilidades', text: 'El Maestro bloqueó el ataque. Retador interviene en bloqueadores; Imbloqueable evita el bloqueo; Indestructible e Indesterrable cambian la resolución.', expect: 'continue' },
  { title: 'Daño y Fase Final', text: 'El defensor decide cuánto daño entra desde cada atacante. Luego se permiten respuestas, se resuelve el daño y se pasa a Final.', expect: 'finish' },
];

function loadDeck(room, participant, deck) {
  action(room, participant.token, { type: 'import', cards: deck });
}

function fixOpeningHand(participant) {
  const wanted = ['Akari Musashi', 'Tempilcahue'];
  const hand = () => participant.cards.filter((card) => card.zone === 'mano');
  for (const name of wanted) {
    const target = participant.cards.find((card) => card.name === name && card.zone === 'castillo');
    const replace = hand().find((card) => !wanted.includes(card.name) && card.type !== 'Oro');
    if (target && replace) {
      target.zone = 'mano';
      replace.zone = 'castillo';
    }
  }
  const gold = participant.cards.find((card) => card.type === 'Oro' && card.zone === 'castillo');
  const replace = hand().find((card) => !wanted.includes(card.name) && card.type !== 'Oro');
  if (gold && replace) {
    gold.zone = 'mano';
    replace.zone = 'castillo';
  }
}

export function createTutorialRoom(name, heroDeck, dragonDeck) {
  const room = createRoom(name, 2);
  const human = room.players[0];
  const guide = player('Maestro de la taberna');
  room.players.push(guide);
  loadDeck(room, human, heroDeck);
  loadDeck(room, guide, dragonDeck);
  action(room, guide.token, { type: 'setup' });
  const blocker = guide.cards.find((card) => card.type === 'Aliado' && card.zone !== 'reserva');
  if (blocker) blocker.zone = 'defensa';
  room.tutorial = { step: 0, human: human.id, guide: guide.id, complete: false, private: true };
  room.log = [];
  room.revision++;
  return room;
}

function advance(room) {
  room.tutorial.step = Math.min(room.tutorial.step + 1, TUTORIAL_LESSONS.length - 1);
  room.revision++;
}

export function tutorialAction(room, token, payload) {
  const tutorial = room.tutorial;
  const human = room.players.find((participant) => participant.id === tutorial?.human);
  if (!tutorial || !human || human.token !== token) return action(room, token, payload);
  const step = tutorial.step;
  if (payload.type === 'tutorialContinue') {
    if (step === 12) tutorial.complete = true;
    else advance(room);
    return view(room, token);
  }
  if (payload.type === 'tutorialInspect') {
    const inspected = human.cards.find((card) => card.id === payload.cardId);
    if (
      (step === 3 && inspected?.type === 'Oro' && inspected.zone === 'reserva') ||
      (step === 7 && inspected?.name === 'Akari Musashi')
    ) advance(room);
    return view(room, token);
  }
  const movedCard = human.cards.find((card) => card.id === payload.cardId);
  const movedFrom = movedCard?.zone;
  const beforePaid = human.cards.filter((card) => card.zone === 'pagado').length;
  action(room, token, payload);
  if (step === 0 && payload.type === 'setup') {
    fixOpeningHand(human);
    advance(room);
  } else if (step === 1 && ['mulligan', 'freeMulligan', 'houseMulligan'].includes(payload.type)) {
    fixOpeningHand(human);
    advance(room);
  } else if (step === 2 && payload.type === 'start') {
    room.initiative.winner = human.id;
    room.initiative.rounds = [[{ player: human.id, value: 20 }, { player: tutorial.guide, value: 8 }]];
    room.initiative.endsAt = Date.now() + 2800;
    room.active = human.id;
    advance(room);
  } else if (step === 4 && payload.type === 'freeMove' && payload.zone === 'reserva' && movedCard?.type === 'Oro' && movedFrom === 'mano') {
    advance(room);
  } else if (step === 5 && payload.type === 'freeMove' && payload.zone === 'pagado') {
    const paid = human.cards.filter((card) => card.zone === 'pagado').length;
    if (paid >= 2 || (beforePaid >= 1 && paid > beforePaid)) advance(room);
  } else if (step === 6 && payload.type === 'freeMove' && payload.zone === 'defensa' && movedCard?.name === 'Akari Musashi') {
    advance(room);
  } else if (step === 8 && payload.type === 'freeMove' && payload.zone === 'destierro' && movedCard?.name === 'Tempilcahue') {
    advance(room);
  } else if (step === 9 && payload.type === 'freeMove' && payload.zone === 'ataque' && movedCard?.name === 'Akari Musashi') {
    advance(room);
  } else if (step === 10 && payload.type === 'strike') {
    const battle = room.pendingBattles?.find((item) => item.target === tutorial.guide);
    const guide = room.players.find((participant) => participant.id === tutorial.guide);
    const blocker = guide?.cards.find((card) => card.type === 'Aliado' && card.zone === 'defensa');
    if (battle && guide) {
      action(room, guide.token, {
        type: 'defend',
        battleId: battle.id,
        rows: battle.rows.map((row, index) => ({ cardId: row.cardId, blocker: index === 0 ? blocker?.id : undefined, damage: index === 0 && blocker ? 0 : row.strength })),
      });
    }
    advance(room);
  } else if (step === 12 && (payload.type === 'next' || (payload.type === 'phase' && payload.phase === 'Final'))) {
    tutorial.complete = true;
    room.revision++;
  }
  return view(room, token);
}
