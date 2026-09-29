import test from 'node:test';
import assert from 'node:assert/strict';

import { loadItinerary } from '../scripts/validate-itinerary.mjs';
import {
  planSync,
  renderManagedSection,
} from '../scripts/sync-google-doc.mjs';

const data = loadItinerary('data/japon.yaml');
const managedSection = renderManagedSection(data);

test('dry-run plan appends one managed section when none exists', () => {
  const plan = planSync('Existing editorial content\n', managedSection);
  assert.equal(plan.action, 'append');
  assert.match(plan.nextBody, /<!-- EXPO:SYNC:START -->/);
  assert.equal(planSync(plan.nextBody, managedSection).action, 'noop');
});

test('existing managed section is replaced without duplicating it', () => {
  const initial = planSync('Before\n', managedSection).nextBody;
  const changed = managedSection.replace('Voyage Japon 2026', 'Voyage Japon 2026 révisé');
  const plan = planSync(initial, changed);
  assert.equal(plan.action, 'replace');
  assert.equal((plan.nextBody.match(/<!-- EXPO:SYNC:START -->/g) || []).length, 1);
  assert.equal(planSync(plan.nextBody, changed).action, 'noop');
});

test('ambiguous markers refuse to produce a write plan', () => {
  assert.throws(
    () => planSync(`${managedSection}\n${managedSection}`, managedSection),
    /marqueurs EXPO/,
  );
});

test('markers in the wrong order refuse to produce a write plan', () => {
  assert.throws(
    () => planSync('<!-- EXPO:SYNC:END -->\n<!-- EXPO:SYNC:START -->', managedSection),
    /fin placé avant/,
  );
});
