#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { homedir } from 'node:os';
import { resolve, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { loadItinerary, validateItinerary } from './validate-itinerary.mjs';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const DEFAULT_DATA_PATH = resolve(ROOT, 'data/japon.yaml');
const START_MARKER = '<!-- EXPO:SYNC:START -->';
const END_MARKER = '<!-- EXPO:SYNC:END -->';

function hermesHome() {
  return process.env.HERMES_HOME || join(homedir(), '.hermes');
}

function defaultGoogleApi() {
  return join(hermesHome(), 'skills/productivity/google-workspace/scripts/google_api.py');
}

function parseArgs(args) {
  const options = {
    dataPath: DEFAULT_DATA_PATH,
    docId: process.env.EXPO_GOOGLE_DOC_ID || '',
    dryRun: true,
    python: process.env.HERMES_PYTHON || 'python3',
    googleApi: process.env.HERMES_GOOGLE_API || defaultGoogleApi(),
  };
  let sawWrite = false;
  let sawDryRun = false;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    const next = () => {
      if (!args[index + 1]) throw new Error(`${arg} nécessite une valeur`);
      index += 1;
      return args[index];
    };
    if (arg === '--write') {
      sawWrite = true;
      options.dryRun = false;
    } else if (arg === '--dry-run') {
      sawDryRun = true;
      options.dryRun = true;
    } else if (arg === '--doc-id') {
      options.docId = next();
    } else if (arg.startsWith('--doc-id=')) {
      options.docId = arg.slice('--doc-id='.length);
    } else if (arg === '--data') {
      options.dataPath = resolve(process.cwd(), next());
    } else if (arg.startsWith('--data=')) {
      const value = arg.slice('--data='.length);
      if (!value) throw new Error('--data nécessite un chemin');
      options.dataPath = resolve(process.cwd(), value);
    } else if (arg === '--python') {
      options.python = next();
    } else if (arg === '--google-api') {
      options.googleApi = resolve(process.cwd(), next());
    } else if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else {
      throw new Error(`option inconnue: ${arg}`);
    }
  }

  if (sawWrite && sawDryRun) throw new Error('--write et --dry-run sont mutuellement exclusifs');
  return options;
}

function usage() {
  return [
    'Usage: node scripts/sync-google-doc.mjs --doc-id ID [--dry-run|--write]',
    '',
    'Le dry-run est activé par défaut. Le mode --write est la seule option qui',
    'peut modifier le Google Doc. Le document doit être fourni par --doc-id ou',
    'EXPO_GOOGLE_DOC_ID; les credentials OAuth restent gérés par Hermes.',
  ].join('\n');
}

function runHermes(options, commandArgs) {
  const result = spawnSync(options.python, [options.googleApi, ...commandArgs], {
    cwd: ROOT,
    encoding: 'utf8',
    env: { ...process.env, HERMES_GOOGLE_API: options.googleApi },
  });
  if (result.error) throw new Error(`Impossible d’exécuter Hermes: ${result.error.message}`);
  if (result.status !== 0) {
    const detail = (result.stderr || result.stdout || '').trim();
    throw new Error(`Commande Hermes échouée (${result.status ?? 1})${detail ? `: ${detail}` : ''}`);
  }
  try {
    return JSON.parse(result.stdout);
  } catch {
    throw new Error('La réponse Hermes n’est pas un JSON valide');
  }
}

function runHelper(options, commandArgs) {
  const helper = resolve(ROOT, 'scripts/hermes-google-doc.py');
  const result = spawnSync(options.python, [helper, ...commandArgs], {
    cwd: ROOT,
    encoding: 'utf8',
    env: { ...process.env, HERMES_GOOGLE_API: options.googleApi },
  });
  if (result.error) throw new Error(`Impossible d’exécuter le relais Google: ${result.error.message}`);
  if (result.status !== 0) {
    const detail = (result.stderr || result.stdout || '').trim();
    throw new Error(`Relais Google échoué (${result.status ?? 1})${detail ? `: ${detail}` : ''}`);
  }
  try {
    return JSON.parse(result.stdout);
  } catch {
    throw new Error('La réponse du relais Google n’est pas un JSON valide');
  }
}

function price(value) {
  return value === null || value === undefined ? 'à confirmer' : `${value.toFixed(2)} CAD`;
}

export function renderManagedSection(data) {
  const lines = [
    START_MARKER,
    'EXPO — synchronisation de l’itinéraire validé',
    `Voyage: ${data.trip.title} (${data.trip.start_date} → ${data.trip.end_date})`,
    '',
    'Arrivée:',
    `- ${data.arrival.date} — ${data.arrival.airport} à ${data.arrival.arrival_time}`,
    `- Trajet: ${data.arrival.route.map((segment) => `${segment.service} (${segment.from} → ${segment.to})`).join(' → ')}`,
    '',
    'Logements actifs:',
  ];

  for (const accommodation of data.accommodations.filter((item) => item.active)) {
    lines.push(
      `- ${accommodation.check_in} → ${accommodation.check_out}: ${accommodation.name} — ${price(accommodation.price_cad)}`,
    );
  }

  lines.push('', 'Journées validées:');
  for (const day of data.days) lines.push(`- ${day.date} — ${day.stage} [${day.status}]`);
  lines.push(END_MARKER);
  return lines.join('\n');
}

function markerPositions(text, marker) {
  const positions = [];
  let from = 0;
  while (true) {
    const position = text.indexOf(marker, from);
    if (position < 0) return positions;
    positions.push(position);
    from = position + marker.length;
  }
}

export function planSync(documentBody, managedSection) {
  const starts = markerPositions(documentBody, START_MARKER);
  const ends = markerPositions(documentBody, END_MARKER);
  if (starts.length !== ends.length || starts.length > 1) {
    throw new Error('marqueurs EXPO absents par paire ou présents plusieurs fois; écriture refusée');
  }

  if (starts.length === 1 && starts[0] >= ends[0]) {
    throw new Error('marqueur EXPO de fin placé avant celui de début; écriture refusée');
  }

  if (starts.length === 0) {
    const separator = documentBody.length === 0 ? '' : documentBody.endsWith('\n') ? '\n' : '\n\n';
    const nextBody = `${documentBody}${separator}${managedSection}\n`;
    return { action: 'append', currentBody: documentBody, nextBody };
  }

  const start = starts[0];
  const end = ends[0] + END_MARKER.length;
  const currentSection = documentBody.slice(start, end);
  const nextBody = currentSection === managedSection
    ? documentBody
    : `${documentBody.slice(0, start)}${managedSection}${documentBody.slice(end)}`;
  return {
    action: currentSection === managedSection ? 'noop' : 'replace',
    currentBody: documentBody,
    nextBody,
  };
}

function sha256(value) {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function loadAndValidate(dataPath) {
  const data = loadItinerary(dataPath);
  const result = validateItinerary(data, { repoRoot: ROOT });
  for (const warning of result.warnings) console.warn(`WARN ${warning.path}: ${warning.message}`);
  if (result.errors.length) {
    for (const error of result.errors) console.error(`ERROR ${error.path}: ${error.message}`);
    throw new Error('data/japon.yaml invalide; synchronisation arrêtée');
  }
  return data;
}

function assertDocument(metadata, docId) {
  if (metadata.id !== docId) throw new Error('le document retourné ne correspond pas à --doc-id');
  if (metadata.mimeType !== 'application/vnd.google-apps.document') {
    throw new Error(`le fichier ${docId} n’est pas un Google Doc`);
  }
}

export function describePlan(plan, documentTitle, managedSection) {
  const changes = plan.action === 'noop'
    ? 'aucun changement'
    : plan.action === 'append'
      ? 'ajout de la section gérée EXPO en fin de document'
      : 'remplacement de la section gérée EXPO existante';
  return [
    `Document: ${documentTitle}`,
    `Action: ${changes}`,
    `Taille actuelle: ${plan.currentBody.length} caractères; taille projetée: ${plan.nextBody.length} caractères`,
    `Empreinte avant écriture: ${sha256(plan.currentBody)}`,
    `Section gérée: ${managedSection.length} caractères`,
  ].join('\n');
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log(usage());
    return;
  }
  if (!options.docId) throw new Error('--doc-id ou EXPO_GOOGLE_DOC_ID est requis');

  const data = loadAndValidate(options.dataPath);
  const managedSection = renderManagedSection(data);
  const metadata = runHermes(options, ['drive', 'get', options.docId]);
  assertDocument(metadata, options.docId);
  const document = runHermes(options, ['docs', 'get', options.docId]);
  if (document.documentId !== options.docId) throw new Error('l’identifiant du document lu est inattendu');

  const plan = planSync(document.body || '', managedSection);
  console.log(describePlan(plan, document.title || metadata.name || options.docId, managedSection));

  if (options.dryRun) {
    console.log(`✓ Dry-run: aucune écriture Google Doc (${plan.action}).`);
    return;
  }

  if (plan.action === 'noop') {
    console.log('✓ Document déjà synchronisé; aucune écriture nécessaire.');
    return;
  }

  const capability = runHelper(options, ['capability', options.docId]);
  if (capability.canEdit !== true) throw new Error('canEdit=false; écriture refusée');
  console.log('Contrôle avant écriture: canEdit=true; hash de concurrence vérifié par le relais Google.');
  runHelper(options, [
    'sync',
    options.docId,
    '--text',
    managedSection,
    '--expected-sha256',
    sha256(plan.currentBody),
  ]);

  const after = runHermes(options, ['docs', 'get', options.docId]);
  const verification = planSync(after.body || '', managedSection);
  if (verification.action !== 'noop') throw new Error('relecture post-écriture non conforme; état distant incertain');
  console.log('✓ Écriture vérifiée par une relecture Google Doc; section EXPO synchronisée.');
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  try {
    await main();
  } catch (error) {
    console.error(`ERROR sync-google-doc: ${error.message}`);
    process.exitCode = 1;
  }
}
