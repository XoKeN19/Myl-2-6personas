import test from 'node:test';
import assert from 'node:assert/strict';
import { officialCardImageUrl } from '../lib/card-image.mjs';

test('El proxy acepta sólo las dos fuentes oficiales de cartas', () => {
  assert.equal(
    officialCardImageUrl('https://myths.cl/cards/Onyria/full/ONY-377.webp')?.hostname,
    'myths.cl',
  );
  assert.equal(
    officialCardImageUrl('https://api.myl.cl/static/cards/161/206.png')?.pathname,
    '/static/cards/161/206.png',
  );
  assert.equal(officialCardImageUrl('https://example.com/cards/test.png'), null);
  assert.equal(officialCardImageUrl('http://myths.cl/cards/test.webp'), null);
  assert.equal(officialCardImageUrl('https://myths.cl/otra-cosa/test.webp'), null);
});
