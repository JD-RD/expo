import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { loadItinerary } from '../scripts/validate-itinerary.mjs';
import {
  planSync,
  planChangeDocument,
  renderManagedSection,
  runGenericPlan,
  singleTextEdit,
} from '../scripts/sync-google-doc.mjs';

const data = loadItinerary('data/japon.yaml');
const managedSection = renderManagedSection(data);

test('la section historique conserve le terminal et la porte de l’arrivée', () => {
  assert.match(managedSection, /terminal 1, porte 43/);
});

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

test('le mode --plan effectue un dry-run local sur une fixture documentaire', async () => {
  const tempDir = mkdtempSync(join(tmpdir(), 'expo-sync-cli-'));
  const planPath = join(tempDir, 'change.yaml');
  const fixturePath = join(tempDir, 'document.json');
  writeFileSync(planPath, `
version: 1
document:
  id: fixture-doc
  title: Fixture documentaire
operations:
  - id: unicode
    type: replace_exact
    old: "Tokyo 😀"
    new: "Kyoto 😀"
`);
  writeFileSync(fixturePath, JSON.stringify({
    id: 'fixture-doc',
    title: 'Fixture documentaire',
    body: 'Départ: Tokyo 😀\n',
    revisionId: 'fixture-rev-1',
  }));
  try {
    const result = await runGenericPlan({
      planPath,
      documentFile: fixturePath,
      docId: '',
      dryRun: true,
    });
    assert.equal(result.afterBody, 'Départ: Kyoto 😀\n');
    assert.equal(result.operations[0].action, 'replace');
    const second = planChangeDocument(result.plan, result.afterBody);
    assert.equal(second.changed, false);
    assert.equal(second.operations[0].action, 'noop');
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test('le calcul d’édition générique reste idempotent et en unités UTF-16', () => {
  const before = 'A😀B';
  const after = 'A🗾B';
  assert.deepEqual(singleTextEdit(before, after), [{ start: 1, end: 3, text: '🗾' }]);
  assert.deepEqual(singleTextEdit(after, after), []);
});

test('l’exemple désensibilisé se valide et produit un dry-run local', async () => {
  const result = await runGenericPlan({
    planPath: 'examples/google-doc-change-plan.example.yaml',
    documentFile: 'examples/google-doc-fixture.example.json',
    docId: '',
    dryRun: true,
  });
  assert.equal(result.document.id, 'example-google-doc-id');
  assert.equal(result.changed, true);
  assert.deepEqual(result.operations.map(({ action }) => action), ['replace', 'insert_after']);
  assert.match(result.afterBody, /Arrivée: 15 h 07\nNote: confirmer/);
});

test('un dry-run local refuse une cible absente avec l’identifiant de l’opération', async () => {
  const tempDir = mkdtempSync(join(tmpdir(), 'expo-sync-errors-'));
  const planPath = join(tempDir, 'missing.yaml');
  const fixturePath = join(tempDir, 'document.json');
  writeFileSync(planPath, `
version: 1
document:
  id: fixture-doc
operations:
  - id: missing-anchor
    type: replace_exact
    old: "Texte introuvable"
    new: "Nouvelle valeur"
`);
  writeFileSync(fixturePath, JSON.stringify({
    id: 'fixture-doc',
    title: 'Fixture documentaire',
    body: 'Contenu stable.\n',
  }));
  try {
    await assert.rejects(
      runGenericPlan({ planPath, documentFile: fixturePath, docId: '', dryRun: true }),
      /opération missing-anchor: cible absente/,
    );
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test('un dry-run local refuse un titre de document inattendu', async () => {
  const tempDir = mkdtempSync(join(tmpdir(), 'expo-sync-title-'));
  const planPath = join(tempDir, 'title.yaml');
  const fixturePath = join(tempDir, 'document.json');
  writeFileSync(planPath, `
version: 1
document:
  id: fixture-doc
  title: Document attendu
operations:
  - id: append-note
    type: append
    text: "\\nNote exemple"
`);
  writeFileSync(fixturePath, JSON.stringify({
    id: 'fixture-doc',
    title: 'Autre document',
    body: 'Contenu stable.\n',
  }));
  try {
    await assert.rejects(
      runGenericPlan({ planPath, documentFile: fixturePath, docId: '', dryRun: true }),
      /titre du document ne correspond pas/,
    );
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});
