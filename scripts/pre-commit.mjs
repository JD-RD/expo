#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';

const CHECKS = [
  { name: 'validation YAML', command: npmCommand, args: ['run', 'validate:japan'] },
  { name: 'build EXPO', command: npmCommand, args: ['run', 'build'] },
  { name: 'check-arrival', command: npmCommand, args: ['run', 'check-arrival'] },
  { name: 'tests', command: npmCommand, args: ['test'] },
];

function formatCommand(command, args) {
  return [command, ...args].join(' ');
}

function defaultRun(command, args) {
  const result = spawnSync(command, args, {
    cwd: ROOT,
    stdio: 'inherit',
  });

  if (result.error) throw result.error;
  return result.status ?? 1;
}

function defaultHasStagedChanges() {
  const result = spawnSync('git', ['diff', '--cached', '--quiet', '--'], {
    cwd: ROOT,
    stdio: 'ignore',
  });

  if (result.error) throw result.error;
  if (result.status === 0) return false;
  if (result.status === 1) return true;
  throw new Error(`git diff --cached --quiet a échoué (${result.status ?? 'signal'})`);
}

function printSummary(summary, log) {
  log('\nRésumé pre-commit');
  for (const item of summary) {
    log(`${item.status} ${item.name}${item.detail ? ` — ${item.detail}` : ''}`);
  }
}

export function runPreCommit({
  run = defaultRun,
  hasStagedChanges = defaultHasStagedChanges,
  log = console.log,
  error = console.error,
} = {}) {
  const summary = [];

  for (const check of CHECKS) {
    log(`\n▶ ${check.name}: ${formatCommand(check.command, check.args)}`);
    let status;
    try {
      status = run(check.command, check.args);
    } catch (exception) {
      status = 1;
      error(`ERROR ${check.name}: ${exception.message}`);
    }

    if (status !== 0) {
      summary.push({ status: '✗', name: check.name, detail: `échec (code ${status})` });
      printSummary(summary, log);
      return status || 1;
    }
    summary.push({ status: '✓', name: check.name });
  }

  log('\n▶ vérification de l’index: git diff --cached --check');
  let staged;
  try {
    staged = hasStagedChanges();
  } catch (exception) {
    summary.push({ status: '✗', name: 'git diff --cached --check', detail: exception.message });
    error(`ERROR index Git: ${exception.message}`);
    printSummary(summary, log);
    return 1;
  }

  if (!staged) {
    summary.push({
      status: '–',
      name: 'git diff --cached --check',
      detail: 'ignoré: aucun changement indexé',
    });
    printSummary(summary, log);
    return 0;
  }

  let diffStatus;
  try {
    diffStatus = run('git', ['diff', '--cached', '--check']);
  } catch (exception) {
    summary.push({ status: '✗', name: 'git diff --cached --check', detail: exception.message });
    error(`ERROR diff indexé: ${exception.message}`);
    printSummary(summary, log);
    return 1;
  }
  if (diffStatus !== 0) {
    summary.push({ status: '✗', name: 'git diff --cached --check', detail: `échec (code ${diffStatus})` });
    printSummary(summary, log);
    return diffStatus || 1;
  }

  summary.push({ status: '✓', name: 'git diff --cached --check' });
  printSummary(summary, log);
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  process.exitCode = runPreCommit();
}
