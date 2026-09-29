#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const VALIDATOR = resolve(ROOT, 'scripts/validate-itinerary.mjs');
const BUILD = resolve(ROOT, 'src/build.js');
const DEFAULT_DATA = resolve(ROOT, 'data/japon.yaml');

function parseArgs(args) {
  let dataPath = DEFAULT_DATA;
  const buildArgs = [];

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--data') {
      if (!args[index + 1]) throw new Error('--data nécessite un chemin');
      dataPath = resolve(process.cwd(), args[index + 1]);
      index += 1;
    } else if (arg.startsWith('--data=')) {
      const value = arg.slice('--data='.length);
      if (!value) throw new Error('--data nécessite un chemin');
      dataPath = resolve(process.cwd(), value);
    } else {
      buildArgs.push(arg);
    }
  }

  return { dataPath, buildArgs };
}

function run(command, args) {
  const result = spawnSync(process.execPath, [command, ...args], {
    cwd: ROOT,
    stdio: 'inherit',
  });
  if (result.error) throw result.error;
  return result.status ?? 1;
}

try {
  const { dataPath, buildArgs } = parseArgs(process.argv.slice(2));
  console.log(`🔎 build-expo — validation de ${dataPath}`);
  const validationStatus = run(VALIDATOR, [dataPath]);
  if (validationStatus !== 0) process.exit(validationStatus);

  console.log('🏗️ build-expo — génération EXPO');
  process.exit(run(BUILD, buildArgs));
} catch (error) {
  console.error(`ERROR build-expo: ${error.message}`);
  process.exitCode = 1;
}
