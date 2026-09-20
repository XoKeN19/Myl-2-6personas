import test from 'node:test';
import assert from 'node:assert/strict';
import { matchesAdvancedFilters, catalogRarities } from '../lib/catalog-filters.mjs';
import handler from '../netlify/functions/api.mjs';
test('Habilidad y rareza se combinan, ignorando tildes y mayúsculas', () => {
  const card = { effect: 'Única. Furia. Indesterrable.', rarity: 'Real' };
  assert.ok(matchesAdvancedFilters(card, new URLSearchParams({ ability: 'furia', rarity: 'Real' })));
  assert.ok(matchesAdvancedFilters(card, new URLSearchParams({ ability: 'unica' })));
  assert.equal(matchesAdvancedFilters(card, new URLSearchParams({ ability: 'Imbloqueable' })), false);
  assert.equal(matchesAdvancedFilters(card, new URLSearchParams({ ability: 'Furia', rarity: 'Vasallo' })), false);
  assert.ok(matchesAdvancedFilters({}, new URLSearchParams({ rarity: 'Sin información' })));
  assert.deepEqual(catalogRarities([card, card, {}]), ['Real', 'Sin información']);
});
test('Búsqueda desplegada filtra todo el catálogo antes de limitar resultados', async () => {
  const meta = await (await handler(new Request('https://mesa.example/api/catalog/meta'))).json();
  assert.ok(meta.rarities.includes('Real'));
  const result = await (await handler(new Request('https://mesa.example/api/catalog/search?ability=Furia&rarity=Real'))).json();
  assert.ok(result.total > 0);
  assert.ok(result.cards.length <= 160);
  assert.ok(result.cards.every((c) => c.rarity === 'Real' && /furia/i.test(c.effect)));
  const empty = await (await handler(new Request('https://mesa.example/api/catalog/search?rarity=INEXISTENTE'))).json();
  assert.equal(empty.total, 0);
});
