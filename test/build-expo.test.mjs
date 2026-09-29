import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = resolve(new URL('..', import.meta.url).pathname);
const BUILD_EXPO = join(ROOT, 'scripts', 'build-expo.mjs');
const DIST = join(ROOT, 'dist');

function runBuild(...args) {
  return spawnSync(process.execPath, [BUILD_EXPO, ...args], {
    cwd: ROOT,
    encoding: 'utf8',
  });
}

function sourceSnapshot() {
  const bundleFiles = spawnSync('rg', ['--files', 'bundles'], { cwd: ROOT, encoding: 'utf8' }).stdout
    .trim()
    .split('\n')
    .filter(Boolean)
    .sort()
    .map(file => join(ROOT, file));
  const files = [
    join(ROOT, 'data', 'japon.yaml'),
    ...bundleFiles,
  ];
  return new Map(files.sort().map(file => [file, readFileSync(file)]));
}

test('un build bloqué par un YAML invalide ne lance pas le générateur', () => {
  const tempDir = mkdtempSync(join(tmpdir(), 'expo-build-invalid-'));
  const invalidPath = join(tempDir, 'japon.yaml');
  const sentinel = join(DIST, '.build-expo-test-sentinel');
  mkdirSync(DIST, { recursive: true });
  writeFileSync(invalidPath, 'version: 1\ntrip:\n  title: [invalide\n');
  writeFileSync(sentinel, 'preserve-me');

  try {
    const result = runBuild('--data', invalidPath);
    assert.equal(result.status, 1);
    assert.equal(existsSync(sentinel), true, 'le générateur ne doit pas nettoyer dist après validation échouée');
    assert.equal(readFileSync(sentinel, 'utf8'), 'preserve-me');
  } finally {
    rmSync(sentinel, { force: true });
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test('le build EXPO réussit avec la source actuelle', () => {
  const result = runBuild();
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.equal(existsSync(join(DIST, 'index.html')), true);
});

test('le build ne modifie pas les sources Markdown ou YAML', () => {
  const before = sourceSnapshot();
  const result = runBuild();
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  const after = sourceSnapshot();

  assert.deepEqual([...after.keys()], [...before.keys()]);
  for (const [file, contents] of before) {
    assert.deepEqual(after.get(file), contents, `source modifiée: ${file}`);
  }
});
