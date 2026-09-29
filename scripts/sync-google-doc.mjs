#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import {
  applyChangePlan,
  loadChangePlan,
  renderDryRunSummary,
  sha256 as changePlanSha256,
} from './doc-change-plan.mjs';
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
    planPath: '',
    documentFile: '',
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
    } else if (arg === '--plan') {
      options.planPath = resolve(process.cwd(), next());
    } else if (arg.startsWith('--plan=')) {
      const value = arg.slice('--plan='.length);
      if (!value) throw new Error('--plan nécessite un chemin');
      options.planPath = resolve(process.cwd(), value);
    } else if (arg === '--document-file') {
      options.documentFile = resolve(process.cwd(), next());
    } else if (arg.startsWith('--document-file=')) {
      const value = arg.slice('--document-file='.length);
      if (!value) throw new Error('--document-file nécessite un chemin');
      options.documentFile = resolve(process.cwd(), value);
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
  if (options.documentFile && !options.planPath) {
    throw new Error('--document-file est réservé au mode --plan');
  }
  return options;
}

function usage() {
  return [
    'Usage historique: node scripts/sync-google-doc.mjs --doc-id ID [--dry-run|--write]',
    '',
    'Le dry-run est activé par défaut. Le mode --write est la seule option qui',
    'peut modifier le Google Doc. Le document doit être fourni par --doc-id ou',
    'EXPO_GOOGLE_DOC_ID; les credentials OAuth restent gérés par Hermes.',
    '',
    'Usage générique: node scripts/sync-google-doc.mjs --plan FICHIER.yaml [--doc-id ID] [--dry-run|--write]',
    'Pour un dry-run local sans réseau, ajoutez --document-file FICHIER.json.',
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
    `- ${data.arrival.date} — ${data.arrival.airport} à ${data.arrival.arrival_time}`
      + ` — terminal ${data.arrival.terminal}, porte ${data.arrival.gate}`,
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

function loadDocumentFixture(filePath, expectedDocId) {
  let fixture;
  try {
    fixture = JSON.parse(readFileSync(filePath, 'utf8'));
  } catch (error) {
    throw new Error(`fixture documentaire invalide: ${error.message}`);
  }
  if (!fixture || typeof fixture !== 'object' || Array.isArray(fixture)) {
    throw new Error('fixture documentaire: la racine doit être un objet JSON');
  }
  const documentId = fixture.documentId || fixture.id || expectedDocId;
  const body = fixture.body ?? fixture.text;
  if (typeof body !== 'string') throw new Error('fixture documentaire: body doit être une chaîne');
  if (documentId !== expectedDocId) {
    throw new Error('la fixture documentaire ne correspond pas à l’identifiant demandé');
  }
  return {
    metadata: {
      id: documentId,
      name: fixture.title || documentId,
      mimeType: fixture.mimeType || 'application/vnd.google-apps.document',
      capabilities: fixture.capabilities || { canEdit: true },
    },
    document: {
      documentId,
      title: fixture.title || documentId,
      body,
      revisionId: fixture.revisionId || 'fixture-revision',
    },
  };
}

function readDocument(options, docId) {
  if (options.documentFile) return loadDocumentFixture(options.documentFile, docId);
  const metadata = runHermes(options, ['drive', 'get', docId]);
  assertDocument(metadata, docId);
  const document = runHermes(options, ['docs', 'get', docId]);
  if (document.documentId !== docId) throw new Error('l’identifiant du document lu est inattendu');
  return { metadata, document };
}

/**
 * Produce one non-overlapping UTF-16 edit for the pure plan result.
 * JavaScript string indexes are UTF-16 code units, matching the transport
 * contract consumed by hermes-google-doc.py.
 */
export function singleTextEdit(beforeBody, afterBody) {
  if (beforeBody === afterBody) return [];
  let start = 0;
  while (start < beforeBody.length && start < afterBody.length) {
    const beforeCodePoint = beforeBody.codePointAt(start);
    const afterCodePoint = afterBody.codePointAt(start);
    if (beforeCodePoint !== afterCodePoint) break;
    start += beforeCodePoint > 0xffff ? 2 : 1;
  }

  let beforeEnd = beforeBody.length;
  let afterEnd = afterBody.length;
  while (beforeEnd > start && afterEnd > start) {
    const beforeStart = beforeEnd - (beforeBody.charCodeAt(beforeEnd - 1) >= 0xdc00 ? 2 : 1);
    const afterStart = afterEnd - (afterBody.charCodeAt(afterEnd - 1) >= 0xdc00 ? 2 : 1);
    if (beforeBody.codePointAt(beforeStart) !== afterBody.codePointAt(afterStart)) break;
    beforeEnd = beforeStart;
    afterEnd = afterStart;
  }
  return [{
    start,
    end: beforeEnd,
    text: afterBody.slice(start, afterEnd),
  }];
}

export function planChangeDocument(changePlan, documentBody, { requireBaseSha256 = false } = {}) {
  return applyChangePlan(changePlan, documentBody, { requireBaseSha256 });
}

export async function runGenericPlan(options) {
  const changePlan = loadChangePlan(options.planPath, { requireBaseSha256: !options.dryRun });
  const docId = options.docId || changePlan.document.id;
  if (changePlan.document.id !== docId) {
    throw new Error(`le plan cible ${changePlan.document.id}, mais --doc-id vaut ${docId}`);
  }
  const { metadata, document } = readDocument(options, docId);
  assertDocument(metadata, docId);
  if (changePlan.document.title && changePlan.document.title !== document.title
    && changePlan.document.title !== metadata.name) {
    throw new Error(`le titre du document ne correspond pas au contrôle du plan: ${changePlan.document.title}`);
  }

  const result = planChangeDocument(
    changePlan,
    document.body || '',
    { requireBaseSha256: !options.dryRun },
  );
  console.log(renderDryRunSummary(result));

  if (options.dryRun) {
    console.log(`✓ Dry-run: aucune écriture Google Doc (${result.changed ? 'modification projetée' : 'noop'}).`);
    return result;
  }
  if (options.documentFile) {
    throw new Error('--write est interdit avec --document-file; utilisez une fixture uniquement en dry-run');
  }
  if (!result.changed) {
    console.log('✓ Plan déjà appliqué; aucune écriture nécessaire.');
    return result;
  }
  if (metadata.capabilities?.canEdit !== true) throw new Error('canEdit=false; écriture refusée');
  if (!document.revisionId) throw new Error('revisionId absent; écriture refusée');

  const edits = singleTextEdit(result.beforeBody, result.afterBody);
  runHelper(options, [
    'patch',
    docId,
    '--edits-json',
    JSON.stringify(edits),
    '--expected-sha256',
    result.beforeSha256,
    '--expected-after-sha256',
    result.afterSha256,
    '--expected-revision-id',
    document.revisionId,
  ]);

  const after = runHermes(options, ['docs', 'get', docId]);
  if (after.documentId !== docId || after.body !== result.afterBody) {
    throw new Error('relecture post-écriture non conforme; état distant incertain');
  }
  if (changePlanSha256(after.body) !== result.afterSha256) {
    throw new Error('empreinte finale non conforme; état distant incertain');
  }
  console.log('✓ Écriture vérifiée par une relecture Google Doc; plan appliqué.');
  return result;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log(usage());
    return;
  }
  if (options.planPath) {
    await runGenericPlan(options);
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
