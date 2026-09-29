import test from 'node:test';
import assert from 'node:assert/strict';

import { runPreCommit } from '../scripts/pre-commit.mjs';

function harness({ statuses = [], staged = false } = {}) {
  const commands = [];
  const output = [];
  let index = 0;
  const statusFor = () => statuses[index++] ?? 0;

  const result = runPreCommit({
    run(command, args) {
      commands.push([command, ...args]);
      return statusFor();
    },
    hasStagedChanges() {
      return staged;
    },
    log(message) {
      output.push(message);
    },
    error(message) {
      output.push(message);
    },
  });

  return { result, commands, output };
}

test('pre-commit exécute tous les contrôles et saute clairement l’index vide', () => {
  const { result, commands, output } = harness();

  assert.equal(result, 0);
  assert.deepEqual(commands, [
    ['npm', 'run', 'validate:japan'],
    ['npm', 'run', 'build'],
    ['npm', 'run', 'check-arrival'],
    ['npm', 'test'],
  ]);
  assert.ok(output.some(line => line.includes('aucun changement indexé')));
  assert.ok(output.some(line => line.includes('✓ tests')));
});

test('pre-commit s’arrête au premier contrôle en échec', () => {
  const { result, commands, output } = harness({ statuses: [1] });

  assert.equal(result, 1);
  assert.deepEqual(commands, [['npm', 'run', 'validate:japan']]);
  assert.ok(output.some(line => line.includes('✗ validation YAML')));
  assert.ok(!output.some(line => line.includes('build EXPO')));
});

test('pre-commit contrôle le diff indexé quand l’index contient des changements', () => {
  const { result, commands, output } = harness({ staged: true });

  assert.equal(result, 0);
  assert.deepEqual(commands, [
    ['npm', 'run', 'validate:japan'],
    ['npm', 'run', 'build'],
    ['npm', 'run', 'check-arrival'],
    ['npm', 'test'],
    ['git', 'diff', '--cached', '--check'],
  ]);
  assert.ok(output.some(line => line.includes('✓ git diff --cached --check')));
});
