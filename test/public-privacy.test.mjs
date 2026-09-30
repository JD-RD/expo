import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { loadItinerary } from '../scripts/validate-itinerary.mjs';

const ROOT = resolve(new URL('..', import.meta.url).pathname);
const DIST = join(ROOT, 'dist');

function walk(dir) {
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walk(path));
    else if (entry.isFile()) files.push(path);
  }
  return files;
}

function build() {
  const result = spawnSync(process.execPath, ['scripts/build-expo.mjs'], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
}

test('EXPO ne publie pas les adresses ou accès des logements', () => {
  build();

  const accommodationFiles = walk(join(ROOT, 'bundles', 'japon'))
    .filter((path) => path.includes('/hebergements/') && path.endsWith('.md'));
  for (const path of accommodationFiles) {
    const source = readFileSync(path, 'utf8');
    assert.doesNotMatch(source, /^resource:\s.*(?:airbnb|booking|hotel)/im, path);
    assert.doesNotMatch(source, /Google Maps|Adresse\s*:|〒|Réservation (?:Airbnb|Booking)/i, path);
  }

  const publicFiles = walk(join(DIST)).filter((path) => path.endsWith('.html'));
  const publicText = publicFiles.map((path) => readFileSync(path, 'utf8')).join('\n');
  const data = loadItinerary();
  const privateValues = data.accommodations.flatMap((accommodation) => [
    accommodation.address_en,
    accommodation.address_ja,
    accommodation.key_instruction,
  ]).filter((value) => typeof value === 'string' && value.trim());

  for (const value of privateValues) {
    assert.equal(publicText.includes(value), false, `information privée publiée: ${value}`);
  }

  assert.doesNotMatch(publicText, /CATS-2|chambre 502|2-chōme-24-5|2073 Hirao|1-10-18 Katamachi|314-47 Renjakuchō|Motokitakōjichō 168/i);
});
