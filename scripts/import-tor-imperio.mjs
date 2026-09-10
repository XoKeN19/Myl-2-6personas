#!/usr/bin/env node
/*
 * Índice autorizado de imágenes para todas las ediciones del formato Imperio
 * expuestas por el catálogo público de TOR. Guarda referencias remotas, sin
 * descargar los PNGs de las cartas al proyecto.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const API = 'https://api.myl.cl/cards/edition/todas';
const EDITIONS = 'https://tor.myl.cl/views/cards.html?v0.99.89b2';
const OUTPUT = resolve('public/catalogs/tor-imperio-image-index.json');

const [catalogResponse, editionsResponse] = await Promise.all([fetch(API), fetch(EDITIONS)]);
if (!catalogResponse.ok) throw Error(`TOR respondió ${catalogResponse.status} al consultar cartas.`);
if (!editionsResponse.ok) throw Error(`TOR respondió ${editionsResponse.status} al consultar ediciones.`);
const catalog = await catalogResponse.json();
if (catalog.status !== 'OK' || !Array.isArray(catalog.cards)) throw Error('TOR no entregó un catálogo de Imperio válido.');

const editionTitles = new Map(
  [...(await editionsResponse.text()).matchAll(/<option value="([^"]+)">([^<]+)<\/option>/g)]
    .map(([, slug, title]) => [slug, title.replace(/^\d+\s*-\s*/, '').trim()]),
);
const typeNames = new Map((catalog.types || []).map((item) => [String(item.id), item.name]));
const raceNames = new Map((catalog.races || []).map((item) => [String(item.id), item.name]));
const cards = catalog.cards.map((card) => ({
  id: `TOR-${card.id}`,
  name: card.name,
  edition: editionTitles.get(card.ed_slug) || card.ed_slug,
  type: typeNames.get(String(card.type)) || '',
  race: raceNames.get(String(card.race)) || '',
  cost: Number(card.cost) || 0,
  strength: Number(card.damage) || 0,
  effect: card.ability || '',
  image: `https://api.myl.cl/static/cards/${encodeURIComponent(card.ed_edid)}/${encodeURIComponent(card.edid)}.png`,
})).sort((a, b) => a.id.localeCompare(b.id));

await mkdir(dirname(OUTPUT), { recursive: true });
await writeFile(OUTPUT, JSON.stringify({
  version: 1,
  source: 'TOR MyL',
  scope: 'Todas las ediciones del formato Imperio',
  generatedAt: new Date().toISOString(),
  cards,
}, null, 2));
console.log(`Índice TOR Imperio: ${cards.length} cartas en ${OUTPUT}`);
