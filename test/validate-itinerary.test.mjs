import test from 'node:test';
import assert from 'node:assert/strict';
import { loadItinerary, validateItinerary } from '../scripts/validate-itinerary.mjs';

test('la source Japon actuelle est valide', () => {
  const result = validateItinerary(loadItinerary(), { repoRoot: process.cwd() });
  assert.deepEqual(result.errors, []);
  assert.equal(result.warnings.length, 0);
});

test('détecte un chevauchement de logements actifs', () => {
  const data = loadItinerary();
  data.accommodations.push({
    ...data.accommodations[0],
    id: 'overlap',
    check_in: '2026-10-04',
    check_out: '2026-10-06',
    nights: 2,
  });
  const result = validateItinerary(data, { repoRoot: process.cwd() });
  assert.ok(result.errors.some(({ message }) => message.includes('chevauchement')));
});

test('détecte une incohérence entre YAML et frontmatter', () => {
  const data = loadItinerary();
  data.days[0].status = 'partiel';
  const result = validateItinerary(data, { repoRoot: process.cwd() });
  assert.ok(result.errors.some(({ path }) => path === 'days[0].status'));
});
