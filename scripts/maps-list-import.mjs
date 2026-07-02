// maps-list-import.mjs — Convertit les fichiers google-maps-list en concepts OKF
// Usage: node scripts/maps-list-import.mjs [--bundle japon] [--city tokyo,kyoto]

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';

const ROOT = new URL('..', import.meta.url).pathname;
const MAPS_DIR = join(process.env.HOME, 'japon', 'google-maps-list');
const BUNDLES = join(ROOT, 'bundles');

// Mapping: display_name → bundle subdirectory
const CITY_MAP = {
  'Tokyo & Yokohama':         { dir: 'tokyo',         type: 'Lieu' },
  'Kyoto & Uji':              { dir: 'kyoto',         type: 'Lieu' },
  'Kanazawa & Ishikawa':      { dir: 'kanazawa',      type: 'Lieu' },
  'Kiso Valley & Nagano':     { dir: 'kiso-matsumoto', type: 'Lieu' },
  'Kusatsu & Gunma (Onsens)': { dir: 'kusatsu',       type: 'Lieu' },
  'Osaka':                    { dir: 'osaka',          type: 'Lieu' },
  'Nara':                     { dir: 'nara',           type: 'Lieu' },
  'Kamakura & Enoshima':      { dir: 'kamakura',       type: 'Lieu' },
  'Kōyasan & Wakayama':       { dir: 'koyasan',        type: 'Lieu' },
  'Hiroshima':                { dir: 'hiroshima',      type: 'Lieu' },
  'Fukuoka':                  { dir: 'fukuoka',        type: 'Lieu' },
  'Okinawa':                  { dir: 'okinawa',        type: 'Lieu' },
  'Naoshima & Teshima':       { dir: 'naoshima',       type: 'Lieu' },
  'Shikoku':                  { dir: 'shikoku',        type: 'Lieu' },
  'Hokkaidō & Tōhoku':        { dir: 'hokkaido',       type: 'Lieu' },
  'Shizuoka & Izu':           { dir: 'shizuoka',       type: 'Lieu' },
  'Gifu & Takayama':          { dir: 'gifu-takayama',  type: 'Lieu' },
  'Kobe & Hyōgo':             { dir: 'kobe',           type: 'Lieu' },
  'Fukui, Toyama & Hokuriku': { dir: 'fukui-toyama',   type: 'Lieu' },
  'Ibaraki & Tochigi':        { dir: 'ibaraki',        type: 'Lieu' },
  'Kagoshima & Amami':        { dir: 'kagoshima',      type: 'Lieu' },
  'Shiga (Ōmi-Hachiman)':     { dir: 'shiga',          type: 'Lieu' },
  'Yamanashi (Fuji Five Lakes)': { dir: 'yamanashi',   type: 'Lieu' },
  'Taipei (Taïwan)':          { dir: 'taipei',         type: 'Lieu' },
};

// Type icon → OKF type + directory mapping
const TYPE_MAP = {
  '🍜 Bouffe':                          { type: 'Restaurant',   dir: 'restaurants' },
  '🍺 Bars':                            { type: 'Bar',          dir: 'bars' },
  '♨️ Onsen / Bains':                   { type: 'Onsen',        dir: 'onsens' },
  '🏛️ Culture / Temples / Musées':      { type: 'Attraction',   dir: 'attractions' },
  '🌳 Nature / Plein air':              { type: 'Lieu',         dir: 'lieux' },
  '🛍️ Shopping':                        { type: 'Shopping',     dir: 'shoppings' },
  '🎮 Gaming / Loisirs':                { type: 'Activite',     dir: 'activites' },
  '🏨 Hébergement':                     { type: 'Hebergement',  dir: 'hebergements' },
};

function slugify(name) {
  let slug = name
    .toLowerCase()
    .replace(/[\[\](){}«»"'']/g, '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .replace(/-+/g, '-');

  // Fallback for CJK/non-Latin names: use a short hash
  if (!slug || slug.length < 2) {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = ((hash << 5) - hash) + name.charCodeAt(i);
      hash = hash & hash; // Convert to 32-bit int
    }
    slug = 'place-' + Math.abs(hash).toString(36).slice(0, 8);
  }
  return slug;
}

function parseGoogleMapsFile(filePath) {
  const content = readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  // Extract display name from H1 heading (or title with prefix stripped)
  let displayName = '';
  const h1Match = content.match(/^# (.+)/m);
  if (h1Match) displayName = h1Match[1].trim();
  if (!displayName) {
    const titleMatch = content.match(/title: "(.+?)"/);
    if (titleMatch) displayName = titleMatch[1].replace(/^Liste Google Maps — /, '');
  }

  // Parse tables: each ## section has a table with | Nom | Description | Google Maps |
  const items = [];
  let currentType = '';
  let inTable = false;
  let headers = [];

  for (const line of lines) {
    const typeMatch = line.match(/^## (.+)/);
    if (typeMatch) {
      currentType = typeMatch[1].trim();
      inTable = false;
      continue;
    }

    if (line.startsWith('|') && line.includes('Nom') && line.includes('Description') && line.includes('Google Maps')) {
      inTable = true;
      continue;
    }

    if (line.startsWith('|---')) {
      continue;
    }

    if (inTable && line.startsWith('|')) {
      const cells = line.split('|').map(c => c.trim()).filter(c => c);
      if (cells.length >= 3) {
        const name = cells[0].replace(/^\*\*/, '').replace(/\*\*$/, '');
        const desc = cells[1] || '';
        const urlMatch = cells[2]?.match(/\[📍 Maps\]\((.+?)\)/);
        const url = urlMatch ? urlMatch[1] : '';

        // Extract location from description: "📍 City" or "note — 📍 City"
        let location = '';
        const locMatch = desc.match(/📍 (.+?)$/) || desc.match(/📍 (.+)/);
        if (locMatch) location = locMatch[1];

        // Extract note from description (before the —)
        let note = '';
        const noteMatch = desc.match(/^(.+?) — /);
        if (noteMatch) note = noteMatch[1];
        else note = desc;

        if (name) {
          items.push({
            name,
            note: note.replace(/[|📍].*$/, '').trim(),
            url,
            location,
            type: currentType,
          });
        }
      }
    }
  }

  return { displayName, items };
}

function createConceptMarkdown(item, cityDir, okfType) {
  const slug = slugify(item.name);
  const tags = [cityDir, okfType.toLowerCase()];
  if (item.location && !item.location.includes(',') && item.location !== cityDir) {
    const locTag = slugify(item.location);
    tags.push(locTag);
  }

  const body = ['---'];
  body.push(`type: ${okfType}`);
  body.push(`title: "${item.name}"`);
  body.push(`description: "${(item.note || '').replace(/"/g, "'").slice(0, 120)}"`);
  if (item.url) body.push(`resource: ${item.url}`);
  body.push(`tags: [${tags.join(', ')}]`);
  body.push(`timestamp: ${new Date().toISOString().split('T')[0]}`);
  if (item.location) body.push(`lieu: "${item.location}"`);
  body.push('---');
  body.push('');
  body.push(`# ${item.name}`);
  body.push('');
  if (item.note) body.push(item.note);
  body.push('');
  if (item.url) body.push(`[📍 Google Maps](${item.url})`);

  return { slug, content: body.join('\n') };
}

// ─── Main ────────────────────────────────────────────────

const args = process.argv.slice(2);
const bundleName = args.find(a => a.startsWith('--bundle='))?.split('=')[1] || 'japon';
const cityFilter = args.find(a => a.startsWith('--city='))?.split('=')[1] || '';

console.log(`🗺️  Importing Google Maps List → OKF bundle "${bundleName}"\n`);

let totalImported = 0;
const files = ['tokyo', 'kyoto', 'kanazawa-ishikawa', 'kiso-valley-nagano', 'kusatsu-gunma',
               'osaka', 'nara', 'kamakura-enoshima', 'koyasan-wakayama', 'hiroshima',
               'fukuoka', 'okinawa', 'naoshima-teshima', 'shikoku', 'hokkaido-tohoku',
               'shizuoka-izu', 'gifu-takayama', 'kobe-hyogo', 'fukui-toyama',
               'ibaraki-tochigi', 'kagoshima-amami', 'shiga', 'yamanashi', 'shimabara-nagasaki',
               'taipei'];

// Build city filter set
const filterSet = cityFilter ? new Set(cityFilter.split(',').map(s => s.trim().toLowerCase())) : null;

for (const fileKey of files) {
  const filePath = join(MAPS_DIR, `${fileKey}.md`);
  if (!existsSync(filePath)) continue;

  const { displayName, items } = parseGoogleMapsFile(filePath);

  // Find city mapping
  const cityInfo = CITY_MAP[displayName];
  if (!cityInfo) {
    console.log(`  ⏭️  ${displayName}: pas de mapping de ville`);
    continue;
  }

  // Apply city filter
  if (filterSet && !filterSet.has(cityInfo.dir)) {
    console.log(`  ⏭️  ${displayName}: filtré (--city ne match pas)`);
    continue;
  }

  console.log(`  📍 ${displayName} (${items.length} lieux)`);

  for (const item of items) {
    const { type: okfType, dir: typeDir } = TYPE_MAP[item.type] || { type: 'Lieu', dir: 'lieux' };
    const { slug, content } = createConceptMarkdown(item, cityInfo.dir, okfType);

    // Write to bundles/<bundle>/<city-dir>/<type-dir>/<slug>.md
    const outDir = join(BUNDLES, bundleName, cityInfo.dir, typeDir);
    const outPath = join(outDir, `${slug}.md`);

    mkdirSync(outDir, { recursive: true });
    writeFileSync(outPath, content);
    totalImported++;
  }
}

// Filter summary
const filterNote = filterSet ? ` (filtré: ${cityFilter})` : '';
console.log(`\n✅ ${totalImported} concepts créés dans bundles/${bundleName}/${filterNote}`);
console.log(`\n   Puis : node src/build.js  →  rebuild le site`);
