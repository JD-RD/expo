import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  ChangePlanConflictError,
  ChangePlanError,
  applyChangePlan,
  dryRunChangePlan,
  loadChangePlan,
  parseChangePlanYaml,
  sha256,
  validateChangePlan,
} from '../scripts/doc-change-plan.mjs';

function plan(operations, document = { id: 'doc-test', title: 'Fixture' }) {
  return { version: 1, document, operations };
}

test('valide et charge le contrat YAML avec des identifiants uniques', () => {
  const source = `
version: 1
document:
  id: doc-123
  title: Fixture
operations:
  - id: correction
    type: replace_exact
    old: "15 h 25"
    new: "15 h 07"
    expected_matches: 1
    source: "note de revue"
`;
  const parsed = parseChangePlanYaml(source);
  assert.equal(parsed.operations[0].type, 'replace_exact');
  assert.equal(parsed.operations[0].old, '15 h 25');

  const tempDir = mkdtempSync(join(tmpdir(), 'expo-change-plan-'));
  const filePath = join(tempDir, 'plan.yaml');
  writeFileSync(filePath, source);
  try {
    assert.deepEqual(loadChangePlan(filePath), parsed);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test('refuse la version, le document, les opérations invalides et les doublons', () => {
  const result = validateChangePlan({
    version: 2,
    document: { id: '' },
    operations: [
      { id: 'same', type: 'replace_exact', old: 'a', new: 'b' },
      { id: 'same', type: 'insert_after', anchor: 'a', text: '' },
      { id: 'bad', type: 'unknown', old: 'a' },
    ],
  });
  assert.ok(result.errors.some(({ path }) => path === 'version'));
  assert.ok(result.errors.some(({ path }) => path === 'document.id'));
  assert.ok(result.errors.some(({ path }) => path === 'operations[1].id'));
  assert.ok(result.errors.some(({ path }) => path === 'operations[1].text'));
  assert.ok(result.errors.some(({ path }) => path === 'operations[2].type'));
  assert.throws(() => parseChangePlanYaml('version: ['), ChangePlanError);
});

test('exige une empreinte de base uniquement quand le mode le demande', () => {
  const withoutHash = plan([{ id: 'add', type: 'append', text: '!' }]);
  assert.doesNotThrow(() => validateChangePlan(withoutHash).value);
  assert.throws(
    () => applyChangePlan(withoutHash, 'ok', { requireBaseSha256: true }),
    /obligatoire avant une écriture/,
  );

  const withHash = plan(
    [{ id: 'add', type: 'append', text: '!' }],
    { id: 'doc-test', base_sha256: sha256('ok') },
  );
  assert.equal(applyChangePlan(withHash, 'ok').afterBody, 'ok!');
  assert.throws(() => applyChangePlan(withHash, 'changed'), ChangePlanConflictError);
});

test('applique séquentiellement les remplacements, insertions, suppression et ajout', () => {
  const changes = plan([
    { id: 'replace', type: 'replace_exact', old: 'A', new: 'B' },
    { id: 'after', type: 'insert_after', anchor: 'B', text: ' + après' },
    { id: 'before', type: 'insert_before', anchor: 'C', text: 'avant + ' },
    { id: 'delete', type: 'delete_exact', old: ' à supprimer' },
    { id: 'append', type: 'append', text: '\nfin' },
  ]);
  const result = applyChangePlan(plan(changes.operations), 'A à supprimer C');
  assert.equal(result.afterBody, 'B + après avant + C\nfin');
  assert.deepEqual(result.operations.map(({ action }) => action), [
    'replace', 'insert_after', 'insert_before', 'delete', 'append',
  ]);
});

test('refuse une cible absente ou ambiguë et accepte une cardinalité déclarée', () => {
  assert.throws(
    () => applyChangePlan(plan([{ id: 'missing', type: 'replace_exact', old: 'x', new: 'y' }]), 'abc'),
    /cible absente/,
  );
  assert.throws(
    () => applyChangePlan(plan([{ id: 'ambiguous', type: 'delete_exact', old: 'a' }]), 'a-a'),
    /cardinalité inattendue/,
  );
  const result = applyChangePlan(
    plan([{ id: 'both', type: 'replace_exact', old: 'a', new: 'b', expected_matches: 2 }]),
    'a-a',
  );
  assert.equal(result.afterBody, 'b-b');
});

test('reconnaît les états déjà appliqués sans dupliquer une insertion ou un ajout', () => {
  const changes = [
    { id: 'replace', type: 'replace_exact', old: 'A', new: 'B' },
    { id: 'after', type: 'insert_after', anchor: 'B', text: '!' },
    { id: 'append', type: 'append', text: '\nfin' },
  ];
  const first = applyChangePlan(plan(changes), 'A');
  const second = applyChangePlan(plan(changes), first.afterBody);
  assert.equal(first.afterBody, 'B!\nfin');
  assert.equal(second.afterBody, first.afterBody);
  assert.deepEqual(second.operations.map(({ action }) => action), ['noop', 'noop', 'noop']);

  const deletePlan = plan([{ id: 'delete', type: 'delete_exact', old: 'à retirer', expected_matches: 0 }]);
  assert.equal(applyChangePlan(deletePlan, 'déjà propre').operations[0].action, 'noop');
});

test('ajoute ou remplace un bloc marqué et refuse les marqueurs ambigus', () => {
  const operation = {
    id: 'managed',
    type: 'replace_block',
    start_marker: '<!-- START -->',
    end_marker: '<!-- END -->',
    text: 'contenu géré',
  };
  const first = applyChangePlan(plan([operation]), 'Avant');
  assert.equal(first.afterBody, 'Avant\n<!-- START -->contenu géré<!-- END -->');
  assert.equal(applyChangePlan(plan([operation]), first.afterBody).operations[0].action, 'noop');

  const changed = applyChangePlan(
    plan([{ ...operation, text: 'nouveau' }]),
    first.afterBody,
  );
  assert.equal(changed.afterBody, 'Avant\n<!-- START -->nouveau<!-- END -->');
  assert.throws(
    () => applyChangePlan(plan([operation]), `${first.afterBody}\n${first.afterBody}`),
    /marqueurs ambigus/,
  );
  assert.throws(
    () => applyChangePlan(plan([operation]), '<!-- END --><!-- START -->'),
    /marqueur de fin placé avant/,
  );
});

test('préserve Unicode et produit un résumé dry-run lisible', () => {
  const input = 'Départ — 東京\n';
  const result = dryRunChangePlan(
    plan([{ id: 'unicode', type: 'replace_exact', old: '東京', new: '京都' }]),
    input,
  );
  assert.equal(result.afterBody, 'Départ — 京都\n');
  assert.match(result.summary, /Document: Fixture/);
  assert.match(result.summary, /unicode \[replace_exact\]: replace/);
  assert.match(result.summary, /Dry-run: aucune écriture distante/);
  assert.equal(result.beforeBody.length, input.length);
  assert.equal(result.afterBody.length, input.length);
});
