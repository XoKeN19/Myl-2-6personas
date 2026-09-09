import type { Room } from './page';
export const playerColors = [
  '#171717',
  '#3b82f6',
  '#22c55e',
  '#ef4444',
  '#a855f7',
  '#f59e0b',
];
export function playerColor(room: Room, id: string) {
  const ids = [
    room.host,
    ...room.players.filter((p) => p.id !== room.host).map((p) => p.id),
  ];
  return playerColors[Math.max(0, ids.indexOf(id)) % playerColors.length];
}
