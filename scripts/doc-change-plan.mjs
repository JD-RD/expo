import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

import yaml from 'js-yaml';

export const CHANGE_PLAN_VERSION = 1;
export const OPERATION_TYPES = Object.freeze([
  'replace_exact',
  'insert_after',
  'insert_before',
  'delete_exact',
  'append',
  'replace_block',
]);

const OPERATION_TYPE_ALIASES = new Map([
  ['replace_marked_block', 'replace_block'],
]);

export class ChangePlanError extends Error {
  constructor(message, { code = 'CHANGE_PLAN_INVALID', path = '', operationId = '' } = {}) {
    super(message);
    this.name = 'ChangePlanError';
    this.code = code;
    this.path = path;
    this.operationId = operationId;
  }
}

export class ChangePlanConflictError extends ChangePlanError {
  constructor(message, options = {}) {
    super(message, { ...options, code: 'CHANGE_PLAN_CONFLICT' });
    this.name = 'ChangePlanConflictError';
  }
}

function issue(path, message) {
  return { path, message };
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.length > 0;
}

function operationType(value) {
  return OPERATION_TYPE_ALIASES.get(value) || value;
}

function operationValue(operation, primary, alias) {
  if (Object.prototype.hasOwnProperty.call(operation, primary)) return operation[primary];
  if (alias && Object.prototype.hasOwnProperty.call(operation, alias)) return operation[alias];
  return undefined;
}

function normalizeOperation(operation, index) {
  const type = operationType(operation.type);
  const normalized = {
    id: operation.id,
    type,
  };

  if (type === 'replace_exact') {
    normalized.old = operation.old;
    normalized.new = operation.new;
  } else if (type === 'delete_exact') {
    normalized.old = operation.old;
  } else if (type === 'insert_after' || type === 'insert_before') {
    normalized.anchor = operationValue(operation, 'anchor', 'old');
    normalized.text = operationValue(operation, 'text', 'new');
  } else if (type === 'append') {
    normalized.text = operationValue(operation, 'text', 'new');
  } else if (type === 'replace_block') {
    normalized.start_marker = operationValue(operation, 'start_marker', 'start');
    normalized.end_marker = operationValue(operation, 'end_marker', 'end');
    normalized.text = operationValue(operation, 'text', 'new');
  }

  if (Object.prototype.hasOwnProperty.call(operation, 'expected_matches')) {
    normalized.expected_matches = operation.expected_matches;
  }
  if (Object.prototype.hasOwnProperty.call(operation, 'source')) normalized.source = operation.source;
  normalized._index = index;
  return normalized;
}

function validateOperation(operation, index, errors, ids) {
  const path = `operations[${index}]`;
  if (!isPlainObject(operation)) {
    errors.push(issue(path, 'doit être un objet'));
    return null;
  }

  if (!isNonEmptyString(operation.id)) {
    errors.push(issue(`${path}.id`, 'est obligatoire et doit être une chaîne non vide'));
  } else if (ids.has(operation.id)) {
    errors.push(issue(`${path}.id`, `identifiant dupliqué: ${operation.id}`));
  } else {
    ids.add(operation.id);
  }

  const type = operationType(operation.type);
  if (!OPERATION_TYPES.includes(type)) {
    errors.push(issue(`${path}.type`, `doit être l’un de: ${OPERATION_TYPES.join(', ')}`));
    return null;
  }

  const expected = operation.expected_matches;
  if (expected !== undefined && (!Number.isInteger(expected) || expected < 0)) {
    errors.push(issue(`${path}.expected_matches`, 'doit être un entier supérieur ou égal à zéro'));
  }

  const normalized = normalizeOperation(operation, index);
  const expectedText = (field, message = 'est obligatoire et doit être une chaîne') => {
    if (typeof normalized[field] !== 'string') errors.push(issue(`${path}.${field}`, message));
  };
  const nonEmptyText = (field, message = 'est obligatoire et ne peut pas être vide') => {
    if (!isNonEmptyString(normalized[field])) errors.push(issue(`${path}.${field}`, message));
  };

  if (type === 'replace_exact') {
    nonEmptyText('old');
    expectedText('new');
  } else if (type === 'delete_exact') {
    nonEmptyText('old');
  } else if (type === 'insert_after' || type === 'insert_before') {
    nonEmptyText('anchor', 'est obligatoire (ou utilisez old) et ne peut pas être vide');
    nonEmptyText('text', 'est obligatoire (ou utilisez new) et ne peut pas être vide');
  } else if (type === 'append') {
    nonEmptyText('text', 'est obligatoire (ou utilisez new) et ne peut pas être vide');
    if (Object.prototype.hasOwnProperty.call(operation, 'expected_matches')) {
      errors.push(issue(`${path}.expected_matches`, 'n’est pas applicable à append'));
    }
  } else if (type === 'replace_block') {
    nonEmptyText('start_marker', 'est obligatoire (ou utilisez start) et ne peut pas être vide');
    nonEmptyText('end_marker', 'est obligatoire (ou utilisez end) et ne peut pas être vide');
    expectedText('text', 'est obligatoire (ou utilisez new) et doit être une chaîne');
    if (typeof normalized.start_marker === 'string'
      && typeof normalized.end_marker === 'string'
      && normalized.start_marker === normalized.end_marker) {
      errors.push(issue(`${path}.end_marker`, 'doit être différent de start_marker'));
    }
    if (typeof normalized.text === 'string'
      && typeof normalized.start_marker === 'string'
      && normalized.text.includes(normalized.start_marker)) {
      errors.push(issue(`${path}.text`, 'ne doit pas contenir start_marker'));
    }
    if (typeof normalized.text === 'string'
      && typeof normalized.end_marker === 'string'
      && normalized.text.includes(normalized.end_marker)) {
      errors.push(issue(`${path}.text`, 'ne doit pas contenir end_marker'));
    }
    if (Object.prototype.hasOwnProperty.call(operation, 'expected_matches')) {
      errors.push(issue(`${path}.expected_matches`, 'n’est pas applicable à replace_block'));
    }
  }

  if (operation.source !== undefined && typeof operation.source !== 'string') {
    errors.push(issue(`${path}.source`, 'doit être une chaîne si présent'));
  }

  return normalized;
}

/**
 * Valide le contrat YAML sans lire ni modifier un document.
 * `requireBaseSha256` est réservé au chemin d’écriture futur (lot B/C).
 */
export function validateChangePlan(value, { requireBaseSha256 = false } = {}) {
  const errors = [];
  const warnings = [];

  if (!isPlainObject(value)) {
    return { errors: [issue('root', 'le plan doit être un objet')], warnings, value: null };
  }
  if (value.version !== CHANGE_PLAN_VERSION) {
    errors.push(issue('version', `doit valoir ${CHANGE_PLAN_VERSION}`));
  }

  if (!isPlainObject(value.document)) {
    errors.push(issue('document', 'est obligatoire et doit être un objet'));
  } else {
    if (!isNonEmptyString(value.document.id)) {
      errors.push(issue('document.id', 'est obligatoire et doit être une chaîne non vide'));
    }
    if (value.document.title !== undefined && typeof value.document.title !== 'string') {
      errors.push(issue('document.title', 'doit être une chaîne si présent'));
    }
    if (value.document.base_sha256 !== undefined) {
      if (typeof value.document.base_sha256 !== 'string' || !/^[a-f0-9]{64}$/i.test(value.document.base_sha256)) {
        errors.push(issue('document.base_sha256', 'doit être une empreinte SHA-256 hexadécimale de 64 caractères'));
      }
    } else if (requireBaseSha256) {
      errors.push(issue('document.base_sha256', 'est obligatoire avant une écriture'));
    }
  }

  if (!Array.isArray(value.operations) || value.operations.length === 0) {
    errors.push(issue('operations', 'est obligatoire et doit contenir au moins une opération'));
  }

  const ids = new Set();
  const operations = Array.isArray(value.operations)
    ? value.operations.map((operation, index) => validateOperation(operation, index, errors, ids)).filter(Boolean)
    : [];

  if (errors.length > 0) return { errors, warnings, value: null };
  const plan = {
    version: CHANGE_PLAN_VERSION,
    document: {
      id: value.document.id,
      ...(value.document.title === undefined ? {} : { title: value.document.title }),
      ...(value.document.base_sha256 === undefined ? {} : { base_sha256: value.document.base_sha256.toLowerCase() }),
    },
    operations: operations.map(({ _index, ...operation }) => operation),
  };
  return { errors, warnings, value: plan };
}

export function assertValidChangePlan(value, options = {}) {
  const result = validateChangePlan(value, options);
  if (result.errors.length) {
    const detail = result.errors.map(({ path, message }) => `${path}: ${message}`).join('; ');
    throw new ChangePlanError(`plan de changements invalide: ${detail}`);
  }
  return result.value;
}

export function parseChangePlanYaml(source, options = {}) {
  let value;
  try {
    value = yaml.load(source, { schema: yaml.JSON_SCHEMA });
  } catch (error) {
    throw new ChangePlanError(`YAML de plan invalide: ${error.message}`, { code: 'CHANGE_PLAN_YAML' });
  }
  return assertValidChangePlan(value, options);
}

export function loadChangePlan(filePath, options = {}) {
  let source;
  try {
    source = readFileSync(filePath, 'utf8');
  } catch (error) {
    throw new ChangePlanError(`impossible de lire le plan ${filePath}: ${error.message}`, { code: 'CHANGE_PLAN_IO' });
  }
  return parseChangePlanYaml(source, options);
}

export function sha256(text) {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

function occurrences(text, needle) {
  const result = [];
  let from = 0;
  while (from <= text.length - needle.length) {
    const index = text.indexOf(needle, from);
    if (index < 0) break;
    result.push(index);
    from = index + needle.length;
  }
  return result;
}

function replaceLiteral(text, needle, replacement) {
  let output = '';
  let from = 0;
  while (true) {
    const index = text.indexOf(needle, from);
    if (index < 0) return output + text.slice(from);
    output += text.slice(from, index) + replacement;
    from = index + needle.length;
  }
}

function conflict(operation, message) {
  throw new ChangePlanConflictError(`opération ${operation.id}: ${message}`, {
    operationId: operation.id,
  });
}

function checkBaseHash(plan, documentText, requireBaseSha256) {
  const expected = plan.document.base_sha256;
  if (requireBaseSha256 && !expected) {
    throw new ChangePlanConflictError('document.base_sha256 est obligatoire pour ce mode', {
      path: 'document.base_sha256',
    });
  }
  if (expected && sha256(documentText) !== expected) {
    throw new ChangePlanConflictError(
      `empreinte de base périmée: attendu ${expected}, obtenu ${sha256(documentText)}`,
      { path: 'document.base_sha256' },
    );
  }
}

function operationResult(operation, action, before, after, actualMatches, detail) {
  return {
    id: operation.id,
    type: operation.type,
    action,
    changed: before !== after,
    expectedMatches: operation.expected_matches ?? 1,
    actualMatches,
    beforeLength: before.length,
    afterLength: after.length,
    nextBody: after,
    detail,
    ...(operation.source === undefined ? {} : { source: operation.source }),
  };
}

function applyTextOperation(operation, body) {
  if (operation.type === 'replace_exact') {
    const matches = occurrences(body, operation.old);
    const expected = operation.expected_matches ?? 1;
    if (matches.length === 0) {
      const newMatches = occurrences(body, operation.new);
      if (newMatches.length === 1) return operationResult(operation, 'noop', body, body, 0, 'texte nouveau déjà présent');
      if (expected === 0) return operationResult(operation, 'noop', body, body, 0, 'zéro correspondance attendu');
      conflict(operation, `cible absente; ${newMatches.length} occurrence(s) du texte nouveau, état non déterminable`);
    }
    if (matches.length !== expected) {
      conflict(operation, `cardinalité inattendue: ${matches.length}, attendu ${expected}`);
    }
    const next = replaceLiteral(body, operation.old, operation.new);
    return operationResult(operation, next === body ? 'noop' : 'replace', body, next, matches.length, 'remplacement littéral');
  }

  if (operation.type === 'delete_exact') {
    const matches = occurrences(body, operation.old);
    const expected = operation.expected_matches ?? 1;
    if (matches.length === 0) {
      if (expected === 0) return operationResult(operation, 'noop', body, body, 0, 'absence explicitement attendue');
      conflict(operation, 'cible absente; une suppression ne peut pas être reconnue implicitement comme déjà appliquée');
    }
    if (matches.length !== expected) {
      conflict(operation, `cardinalité inattendue: ${matches.length}, attendu ${expected}`);
    }
    const next = replaceLiteral(body, operation.old, '');
    return operationResult(operation, 'delete', body, next, matches.length, 'suppression littérale');
  }

  if (operation.type === 'insert_after' || operation.type === 'insert_before') {
    const anchors = occurrences(body, operation.anchor);
    const expected = operation.expected_matches ?? 1;
    const relation = operation.type === 'insert_after'
      ? `${operation.anchor}${operation.text}`
      : `${operation.text}${operation.anchor}`;
    const applied = occurrences(body, relation);
    if (anchors.length === expected && applied.length === expected) {
      return operationResult(operation, 'noop', body, body, anchors.length, 'insertion déjà présente');
    }
    if (anchors.length !== expected) {
      conflict(operation, `cardinalité de l’ancre inattendue: ${anchors.length}, attendu ${expected}`);
    }
    const insertion = operation.type === 'insert_after'
      ? `${operation.anchor}${operation.text}`
      : `${operation.text}${operation.anchor}`;
    const next = replaceLiteral(body, operation.anchor, insertion);
    return operationResult(operation, operation.type, body, next, anchors.length, 'insertion littérale');
  }

  if (operation.type === 'append') {
    if (body.endsWith(operation.text)) {
      return operationResult(operation, 'noop', body, body, 1, 'texte déjà en fin de document');
    }
    const next = `${body}${operation.text}`;
    return operationResult(operation, 'append', body, next, 0, 'ajout en fin de document');
  }

  if (operation.type === 'replace_block') {
    const starts = occurrences(body, operation.start_marker);
    const ends = occurrences(body, operation.end_marker);
    if (starts.length === 0 && ends.length === 0) {
      const block = `${operation.start_marker}${operation.text}${operation.end_marker}`;
      const next = body.length === 0 ? block : `${body}\n${block}`;
      return operationResult(operation, 'append_block', body, next, 0, 'bloc marqué ajouté');
    }
    if (starts.length !== 1 || ends.length !== 1) {
      conflict(operation, `marqueurs ambigus: ${starts.length} début(s), ${ends.length} fin(s)`);
    }
    if (starts[0] >= ends[0]) conflict(operation, 'marqueur de fin placé avant le marqueur de début');
    const end = ends[0] + operation.end_marker.length;
    const currentBlock = body.slice(starts[0], end);
    const desiredBlock = `${operation.start_marker}${operation.text}${operation.end_marker}`;
    if (currentBlock === desiredBlock) {
      return operationResult(operation, 'noop', body, body, 1, 'bloc déjà conforme');
    }
    const next = `${body.slice(0, starts[0])}${desiredBlock}${body.slice(end)}`;
    return operationResult(operation, 'replace_block', body, next, 1, 'bloc marqué remplacé');
  }

  throw new ChangePlanError(`type d’opération non pris en charge: ${operation.type}`);
}

/**
 * Applique séquentiellement un plan sur une copie logique du texte.
 * Les chaînes JavaScript sont indexées en unités UTF-16, comme Google Docs;
 * la conversion des requêtes API appartient au lot B.
 */
export function applyChangePlan(inputPlan, documentText, {
  requireBaseSha256 = false,
} = {}) {
  if (typeof documentText !== 'string') {
    throw new ChangePlanError('le document en mémoire doit être une chaîne', { path: 'documentText' });
  }
  const plan = assertValidChangePlan(inputPlan, { requireBaseSha256 });
  checkBaseHash(plan, documentText, requireBaseSha256);

  const beforeBody = documentText;
  let body = documentText;
  const operations = [];
  for (const operation of plan.operations) {
    const before = body;
    const result = applyTextOperation(operation, body);
    body = result.nextBody;
    const { nextBody, ...publicResult } = result;
    operations.push({ ...publicResult, beforeSha256: sha256(before), afterSha256: sha256(body) });
  }

  return {
    plan,
    document: plan.document,
    beforeBody,
    afterBody: body,
    changed: beforeBody !== body,
    beforeSha256: sha256(beforeBody),
    afterSha256: sha256(body),
    operations,
  };
}

export function renderDryRunSummary(result) {
  const operationLines = result.operations.map((operation) => (
    `- ${operation.id} [${operation.type}]: ${operation.action}; `
    + `${operation.actualMatches} correspondance(s); ${operation.detail}`
  ));
  return [
    `Document: ${result.document.title || result.document.id}`,
    `ID: ${result.document.id}`,
    `Action: ${result.changed ? 'modification projetée' : 'noop (aucun changement)'}`,
    `Taille: ${result.beforeBody.length} → ${result.afterBody.length} caractères`,
    `SHA-256: ${result.beforeSha256} → ${result.afterSha256}`,
    'Opérations:',
    ...operationLines,
    'Dry-run: aucune écriture distante.',
  ].join('\n');
}

export function dryRunChangePlan(inputPlan, documentText, options = {}) {
  const result = applyChangePlan(inputPlan, documentText, options);
  return { ...result, summary: renderDryRunSummary(result) };
}

export function summarizeDryRun(planOrResult, documentText, options = {}) {
  if (documentText === undefined && planOrResult && Array.isArray(planOrResult.operations)
    && typeof planOrResult.beforeBody === 'string') {
    return renderDryRunSummary(planOrResult);
  }
  return dryRunChangePlan(planOrResult, documentText, options).summary;
}
