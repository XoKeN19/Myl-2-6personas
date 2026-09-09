import { randomInt, randomBytes } from 'node:crypto';
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
    endsAt: now + rounds.length * 3200 + 3200,
    rounds,
    winner: contenders[0],
  };
}
