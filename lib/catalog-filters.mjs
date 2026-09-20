export const ABILITIES = ['Furia', 'Imbloqueable', 'Indesterrable', 'Indestructible', 'Exhumar', 'Retador', 'Errante', 'Luz', 'Oscuridad', 'Única'];
const normalize = (value) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es');
export function matchesAdvancedFilters(card, params) {
  const ability = params.get('ability') || '';
  const rarity = params.get('rarity') || '';
  const words = normalize(card.effect).split(/[^a-z0-9]+/);
  return (!ability || words.includes(normalize(ability))) &&
    (!rarity || (card.rarity || 'Sin información') === rarity);
}
export function catalogRarities(cards) {
  return [...new Set(cards.map((card) => card.rarity || 'Sin información'))].sort((a, b) => a.localeCompare(b, 'es'));
}
