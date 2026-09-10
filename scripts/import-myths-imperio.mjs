#!/usr/bin/env node
/*
 * Importador autorizado del catálogo Myths.
 * No descarga ni duplica las imágenes: guarda sus URL públicas junto con los
 * datos de cada carta. El constructor mantiene sus filtros de Imperio, y el
 * índice completo sólo se usa para restaurar fotos de mazos antiguos.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const SOURCE = 'https://myths.cl/assets/altArts-Bzm2s5in.js';
const OUTPUT = resolve('public/catalogs/myths-imperio.json');
const IMAGE_INDEX_OUTPUT = resolve('public/catalogs/myths-image-index.json');
const IMPERIO = {
  BES: 'Bestiarium',
  ONY: 'Onyria',
  LIB: 'Libertadores',
  KVM: 'Kaijus vs Mechas',
  VIG: 'Angeles y Demonios - Vigilantes',
  SAR: 'Secretos Arcanos',
  LBX: 'LootBox 2024',
  THI: 'Toolkit Hielo Inmortal',
  TCF: 'Toolkit Cenizas de Fuego',
  TDM: 'Toolkit Dia de Muertos',
  TRV: 'Toolkit Ritual Vudu',
  CLO: 'Chile Oculto',
};
const EDITIONS = {
  RET: 'El Reto', GOT: 'Mundo Gotico', IRA: 'Ira del Nahual', RAG: 'Ragnarok',
  COF: 'Cofradia', EDR: 'Espiritu Dragon', ESP: 'Espada Sagrada', HEL: 'Helenica',
  HIJ: 'Hijos de Daana', DOM: 'Dominios de Ra', DRA: 'Dracula e Inferno',
  FUR: 'Furia', ROM: 'Roma', EXC: 'Excalibur', TRO: 'Troya',
  GUE: 'Guerreros del Sol', GUA: 'Guardianes de Daana', ASG: 'Asgard',
  SUM: 'Sumeria', PES: 'Productos Especiales', GJR: 'Guerrero Jaguar',
  BAR: 'Barbarie', RAC: 'Reino de Acero', BRO: 'Bestiario', ...IMPERIO,
};
const type = {
  aliado: 'Aliado',
  arma: 'Arma',
  oro: 'Oro',
  talisman: 'Talismán',
  totem: 'Tótem',
};

function objectAt(source, marker) {
  const start = source.indexOf(marker);
  if (start < 0) throw Error(`No se encontró ${marker} en el catálogo.`);
  const open = source.indexOf('{', start + marker.length);
  let depth = 0, quote = '', escaped = false;
  for (let i = open; i < source.length; i++) {
    const char = source[i];
    if (quote) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === quote) quote = '';
      continue;
    }
    if (char === '"' || char === "'" || char === '`') quote = char;
    else if (char === '{') depth++;
    else if (char === '}' && --depth === 0) return source.slice(open, i + 1);
  }
  throw Error('El catálogo terminó antes de cerrar sus datos.');
}

function stringMap(source, marker) {
  const object = objectAt(source, marker);
  const result = {};
  let index = 1;
  const skip = () => {
    while (/\s|,/.test(object[index] || '')) index++;
  };
  while (index < object.length - 1) {
    skip();
    if (object[index] !== '"') break;
    const keyStart = index++;
    while (object[index] !== '"' || object[index - 1] === '\\') index++;
    const key = JSON.parse(object.slice(keyStart, ++index));
    while (/\s|:/.test(object[index] || '')) index++;
    const quote = object[index++];
    let value = '', escaped = false;
    while (index < object.length) {
      const char = object[index++];
      if (escaped) {
        value += `\\${char}`;
        escaped = false;
      } else if (char === '\\') escaped = true;
      else if (char === quote) break;
      else value += char;
    }
    // Las habilidades usan cadenas con comillas o template literals. Ambas se
    // convierten a texto, no se ejecutan como JavaScript.
    result[key] = value
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '\r')
      .replace(/\\t/g, '\t')
      .replace(/\\"/g, '"')
      .replace(/\\`/g, '`')
      .replace(/\\\\/g, '\\');
  }
  return result;
}

const response = await fetch(SOURCE);
if (!response.ok) throw Error(`Myths respondió ${response.status}.`);
const source = await response.text();
// El bundle es JavaScript minificado: sus claves internas (name, cost, etc.)
// no llevan comillas. P es sólo un objeto de metadatos; se normalizan esas
// claves antes de leerlo como JSON, sin ejecutar el bundle remoto.
const cards = JSON.parse(
  objectAt(source, 'const P=').replace(
    /([,{])([A-Za-z_$][\w$]*):/g,
    '$1"$2":',
  ),
);
const effects = stringMap(
  await (await fetch('https://myths.cl/assets/gameMaintenance-BzCI7AfR.js')).text(),
  'const ze=',
);
const catalog = Object.entries(cards)
  .map(([id, card]) => {
    const [prefix, number] = id.split('-');
    const edition = IMPERIO[prefix];
    if (!edition) return null;
    return {
      id,
      name: card.name,
      edition,
      type: type[card.type] || card.type,
      race: card.race || '',
      cost: Number(card.cost) || 0,
      strength: Number(card.force) || 0,
      effect: effects[id] || '',
      image: `https://myths.cl/cards/${encodeURIComponent(edition)}/full/${prefix}-${number}.webp`,
    };
  })
  .filter(Boolean)
  .sort((a, b) => a.id.localeCompare(b.id));
const imageIndex = Object.entries(cards)
  .map(([id, card]) => {
    const [prefix, number] = id.split('-');
    const edition = EDITIONS[prefix];
    if (!edition) return null;
    return {
      id,
      name: card.name,
      edition,
      type: type[card.type] || card.type,
      image: `https://myths.cl/cards/${encodeURIComponent(edition)}/full/${prefix}-${number}.webp`,
    };
  })
  .filter(Boolean)
  .sort((a, b) => a.id.localeCompare(b.id));

await mkdir(dirname(OUTPUT), { recursive: true });
await writeFile(
  OUTPUT,
  JSON.stringify(
    {
      version: 1,
      source: 'Myths',
      format: 'Imperio',
      generatedAt: new Date().toISOString(),
      cards: catalog,
    },
    null,
    2,
  ),
);
await writeFile(
  IMAGE_INDEX_OUTPUT,
  JSON.stringify(
    {
      version: 1,
      source: 'Myths',
      scope: 'Todas las ediciones disponibles',
      generatedAt: new Date().toISOString(),
      cards: imageIndex,
    },
    null,
  ),
);
console.log(`Catálogo Imperio: ${catalog.length} cartas en ${OUTPUT}`);
console.log(`Índice de fotos: ${imageIndex.length} cartas en ${IMAGE_INDEX_OUTPUT}`);
