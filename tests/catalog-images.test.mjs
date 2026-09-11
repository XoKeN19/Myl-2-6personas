import test from 'node:test';
import assert from 'node:assert/strict';
import { action, createRoom, definition } from '../lib/game.mjs';
import {
  buildCardImageIndex,
  catalogImageFor,
} from '../lib/card-catalog-images.mjs';

test('La imagen se resuelve por código y edición sin mezclar reimpresiones', () => {
  const firstEra = {
    id: 'ERA-001',
    name: 'Carta repetida',
    edition: 'Primera Era',
    image: 'https://myths.cl/cards/era.webp',
  };
  const imperio = {
    id: 'IMP-220',
    name: 'Carta repetida',
    edition: 'Imperio',
    image: 'https://myths.cl/cards/imperio.webp',
  };
  const index = buildCardImageIndex([[imperio], [firstEra]]);
  assert.equal(catalogImageFor({ catalogId: 'ERA-001' }, index), firstEra.image);
  assert.equal(
    catalogImageFor({ name: 'Carta repetida', edition: 'Imperio' }, index),
    imperio.image,
  );
  assert.equal(catalogImageFor({ name: 'Carta repetida' }, index), imperio.image);

  const ambiguousImperio = buildCardImageIndex([[firstEra, imperio]]);
  assert.equal(catalogImageFor({ name: 'Carta repetida' }, ambiguousImperio), '');
});

test('Importar conserva el código y edición originales', () => {
  const room = createRoom('Carta correcta', 2);
  const participant = room.players[0];
  const cards = Array.from({ length: 50 }, (_, index) => ({
    id: `IMP-${String(index).padStart(3, '0')}`,
    edition: 'Imperio',
    name: index === 0 ? 'Oro inicial' : `Carta ${index}`,
    type: index === 0 ? 'Oro' : 'Aliado',
    effect: index === 0 ? 'Oro inicial' : '',
    race: index === 0 ? '' : 'Héroe',
    cost: index === 0 ? 0 : 1,
    strength: index === 0 ? 0 : 2,
    image: '',
  }));
  action(room, participant.token, { type: 'import', cards });
  assert.equal(participant.cards[12].catalogId, 'IMP-012');
  assert.equal(participant.cards[12].edition, 'Imperio');
  assert.equal(definition(participant.cards[12]).catalogId, 'IMP-012');
});
