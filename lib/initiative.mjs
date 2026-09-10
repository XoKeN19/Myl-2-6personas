import { randomInt, randomBytes } from 'node:crypto';
// `dados.mp3` lasts 2.769 seconds. The round has a tiny buffer so every
// connected browser can restart the same sound before the next tiebreak.
export const INITIATIVE_ROUND_MS = 2800;
export const INITIATIVE_RESULT_MS = 1400;
export function rollInitiative(
  players,
  roll = () => randomInt(1, 21),
  now = Date.now(),
) {
  const rounds = [];
  let contenders = players.map((p) => p.id);
  while (contenders.length > 1) {
    const rows = contenders.map((player) => ({ player, value: roll() }));
    if (
      rows.some(
        (r) => !Number.isInteger(r.value) || r.value < 1 || r.value > 20,
      )
    )
      throw new Error('Resultado d20 inválido');
    rounds.push(rows);
    const maximum = Math.max(...rows.map((r) => r.value));
    contenders = rows.filter((r) => r.value === maximum).map((r) => r.player);
  }
  return {
    id: randomBytes(8).toString('hex'),
    startedAt: now,
    // Every 3D throw follows the supplied dice sound, followed by a short
    // winner reveal. The server owns this clock for all clients.
    endsAt: now + rounds.length * INITIATIVE_ROUND_MS + INITIATIVE_RESULT_MS,
    rounds,
    winner: contenders[0],
  };
}
