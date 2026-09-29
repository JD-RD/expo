#!/usr/bin/env node

import { spawnSync } from 'node:child_process';

const args = process.argv.slice(2);
const dryRun = !args.includes('--write');

console.log(`🇯🇵 sync:japan — ${dryRun ? 'dry-run' : 'mode écriture locale'}`);

if (dryRun) {
  console.log('1. Build EXPO (validation intégrée)');
  const build = spawnSync(process.execPath, ['scripts/build-expo.mjs'], { stdio: 'inherit' });
  if (build.status !== 0) process.exit(build.status ?? 1);
  console.log('✓ Dry-run terminé: aucune écriture Google Doc ni modification de source.');
} else {
  console.log('1. Validation de data/japon.yaml');
  const validation = spawnSync(process.execPath, ['scripts/validate-itinerary.mjs'], { stdio: 'inherit' });
  if (validation.status !== 0) process.exit(validation.status ?? 1);
  console.error('ERROR --write n’est pas encore disponible: aucun connecteur Google Doc n’est configuré.');
  process.exitCode = 2;
}
