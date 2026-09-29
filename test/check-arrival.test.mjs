import test from 'node:test';
import assert from 'node:assert/strict';
import { checkArrival } from '../scripts/check-arrival.mjs';
import { loadItinerary } from '../scripts/validate-itinerary.mjs';

test('contrôle le trajet d’arrivée et les instructions du premier logement', () => {
  const result = checkArrival(loadItinerary());

  assert.deepEqual(result.errors, []);
  assert.equal(result.accommodation.id, 'tokyo-initial');
  assert.equal(result.warnings.length, 1);
  assert.equal(result.warnings[0].path, 'arrival.terminal');
});

test('détecte une destination de trajet qui ne correspond pas à la station du logement', () => {
  const data = loadItinerary();
  data.arrival.route.at(-1).to = 'Ueno';

  const result = checkArrival(data);

  assert.ok(result.errors.some(({ path, message }) => path === 'arrival.route' && message.includes('station')));
});

test('refuse un itinéraire sans instruction de clé', () => {
  const data = loadItinerary();
  delete data.accommodations.find(({ id }) => id === 'tokyo-initial').key_instruction;

  const result = checkArrival(data);

  assert.ok(result.errors.some(({ path }) => path.endsWith('.key_instruction')));
});
