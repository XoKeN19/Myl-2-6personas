#!/usr/bin/env node
/*
 * Índice autorizado de imágenes para todas las ediciones del formato Imperio
 * expuestas por el catálogo público de TOR. Guarda referencias remotas, sin
 * descargar los PNGs de las cartas al proyecto.
 */
import { mkdir, writeFile, readFile } from 'node:fs/promises';
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
// The "todas" endpoint omits whole editions. Fetch their individual catalogues
// before generating the search index instead of assuming "todas" is complete.
const included = new Set(catalog.cards.map((card) => card.ed_slug));
const missing = [...editionTitles.keys()].filter((slug) => slug !== 'todas' && !included.has(slug));
const unavailableEditions = [];
for (let offset = 0; offset < missing.length; offset += 3) {
  const additions = await Promise.allSettled(missing.slice(offset, offset + 3).map(async (slug) => {
    const response = await fetch('https://api.myl.cl/cards/edition/' + encodeURIComponent(slug), { signal: AbortSignal.timeout(30000) });
    if (!response.ok) throw Error(`No se pudo consultar ${slug}: ${response.status}`);
    const data = await response.json();
    if (data.status !== 'OK' || !Array.isArray(data.cards)) throw Error(`Catálogo inválido: ${slug}`);
    console.log(`${editionTitles.get(slug)}: ${data.cards.length} cartas`);
    return data;
  }));
  for (const [index, result] of additions.entries()) {
    if (result.status === 'rejected') {
      unavailableEditions.push(missing[offset + index]);
      console.warn(String(result.reason));
      continue;
    }
    const data = result.value;
    catalog.cards.push(...data.cards);
    for (const key of ['types', 'races', 'rarities']) {
      catalog[key] = [...new Map([...(catalog[key] || []), ...(data[key] || [])].map((item) => [String(item.id), item])).values()];
    }
  }
}
catalog.cards = [...new Map(catalog.cards.map((card) => [String(card.id), card])).values()];
const typeNames = new Map((catalog.types || []).map((item) => [String(item.id), item.name]));
const raceNames = new Map((catalog.races || []).map((item) => [String(item.id), item.name]));
const rarityNames = new Map((catalog.rarities || []).map((item) => [String(item.id), item.name]));
let cards = catalog.cards.map((card) => ({
  id: `TOR-${card.id}`,
  name: card.name,
  edition: editionTitles.get(card.ed_slug) || card.ed_slug,
  type: typeNames.get(String(card.type)) || '',
  race: raceNames.get(String(card.race)) || '',
  rarity: rarityNames.get(String(card.rarity)) || '',
  cost: Number(card.cost) || 0,
  strength: Number(card.damage) || 0,
  effect: card.ability || '',
  image: `https://api.myl.cl/static/cards/${encodeURIComponent(card.ed_edid)}/${encodeURIComponent(card.edid)}.png`,
})).sort((a, b) => a.id.localeCompare(b.id));
// Keep prior records if an edition is temporarily unavailable.
let previous = [];
try { previous = JSON.parse(await readFile(OUTPUT, 'utf8')).cards || []; }
catch (error) { if (error.code !== 'ENOENT') throw error; }
cards = [...new Map([...previous, ...cards].map((card) => [card.id, card])).values()].sort((a, b) => a.id.localeCompare(b.id));

await mkdir(dirname(OUTPUT), { recursive: true });
await writeFile(OUTPUT, JSON.stringify({
  version: 1,
  source: 'TOR MyL',
  scope: 'Catálogo general TOR y ediciones individuales omitidas por la consulta general',
  generatedAt: new Date().toISOString(),
  unavailableEditions,
  cards,
}, null, 2));
console.log(`Índice TOR Imperio: ${cards.length} cartas en ${OUTPUT}`);
