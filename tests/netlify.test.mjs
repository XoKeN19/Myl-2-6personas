import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../netlify/functions/api.mjs';

test('Netlify: health responde desde la ruta reescrita', async () => {
  const response = await handler(
    new Request('https://mesa.example/.netlify/functions/api/health'),
  );
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, hosting: 'netlify' });
});

test('Netlify: catálogo de Imperio queda disponible dentro de la función', async () => {
  const response = await handler(
    new Request('https://mesa.example/api/catalog/search?q=karna'),
  );
  const result = await response.json();
  assert.equal(response.status, 200);
  assert.ok(result.total > 0);
  assert.ok(result.cards.some((card) => /karna/i.test(card.name)));
});

