#!/usr/bin/env node

import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import yaml from 'js-yaml';
import matter from 'gray-matter';

export const DEFAULT_DATA_PATH = resolve('data/japon.yaml');
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_STATUSES = new Set(['planifie', 'partiel', 'a-confirmer']);
const ACCOMMODATION_STATUSES = new Set(['confirmed', 'planned', 'proposed', 'archived']);

function issue(path, message) {
  return { path, message };
}

function isDate(value) {
  if (typeof value !== 'string' || !DATE_RE.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function daysBetween(start, end) {
  const a = new Date(`${start}T00:00:00Z`);
  const b = new Date(`${end}T00:00:00Z`);
  return Math.round((b - a) / 86400000);
}

function requiredString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function readSourceFrontmatter(repoRoot, sourcePath) {
  const fullPath = resolve(repoRoot, sourcePath);
  if (!existsSync(fullPath)) return null;
  try {
    return matter(readFileSync(fullPath, 'utf8')).data;
  } catch {
    return null;
  }
}

export function validateItinerary(data, { repoRoot = process.cwd() } = {}) {
  const errors = [];
  const warnings = [];
  const addError = (path, message) => errors.push(issue(path, message));
  const addWarning = (path, message) => warnings.push(issue(path, message));

  if (!data || typeof data !== 'object') {
    return { errors: [issue('root', 'le document YAML doit être un objet')], warnings: [] };
  }
  if (data.version !== 1) addError('version', 'doit être égal à 1');

  const trip = data.trip;
  if (!trip || typeof trip !== 'object') {
    addError('trip', 'section requise');
  } else {
    for (const field of ['id', 'title', 'currency']) {
      if (!requiredString(trip[field])) addError(`trip.${field}`, 'champ texte requis');
    }
    for (const field of ['start_date', 'end_date']) {
      if (!isDate(trip[field])) addError(`trip.${field}`, 'date ISO valide requise');
    }
    if (isDate(trip.start_date) && isDate(trip.end_date) && trip.start_date >= trip.end_date) {
      addError('trip', 'start_date doit précéder end_date');
    }
  }

  const days = Array.isArray(data.days) ? data.days : [];
  if (!Array.isArray(data.days)) addError('days', 'liste requise');
  const seenDates = new Set();
  for (const [index, day] of days.entries()) {
    const path = `days[${index}]`;
    if (!day || typeof day !== 'object') {
      addError(path, 'entrée objet requise');
      continue;
    }
    if (!isDate(day.date)) addError(`${path}.date`, 'date ISO valide requise');
    else if (seenDates.has(day.date)) addError(`${path}.date`, `date dupliquée: ${day.date}`);
    else seenDates.add(day.date);
    if (!requiredString(day.stage)) addError(`${path}.stage`, 'étape requise');
    if (!DAY_STATUSES.has(day.status)) addError(`${path}.status`, 'doit être planifie, partiel ou a-confirmer');
    if (!requiredString(day.source_path)) addError(`${path}.source_path`, 'chemin source requis');

    const frontmatter = requiredString(day.source_path) ? readSourceFrontmatter(repoRoot, day.source_path) : null;
    if (requiredString(day.source_path) && !frontmatter) addError(`${path}.source_path`, 'fichier source absent ou illisible');
    if (frontmatter) {
      const fields = [
        ['date', day.date],
        ['etape', day.stage],
        ['statut', day.status],
      ];
      for (const [frontmatterField, expected] of fields) {
        const yamlField = frontmatterField === 'etape' ? 'stage' : frontmatterField === 'statut' ? 'status' : 'date';
        if (frontmatter[frontmatterField] !== expected) addError(`${path}.${yamlField}`, `ne correspond pas au frontmatter de ${day.source_path}`);
      }
    }
  }

  if (trip && isDate(trip.start_date) && isDate(trip.end_date)) {
    const expected = daysBetween(trip.start_date, trip.end_date) + 1;
    const missing = [];
    for (let offset = 0; offset < expected; offset += 1) {
      const date = new Date(`${trip.start_date}T00:00:00Z`);
      date.setUTCDate(date.getUTCDate() + offset);
      const iso = date.toISOString().slice(0, 10);
      if (!seenDates.has(iso)) missing.push(iso);
    }
    if (days.length !== expected || missing.length) {
      addError('days', `la série doit contenir ${expected} dates consécutives; manquantes: ${missing.join(', ') || 'aucune'}`);
    }
  }

  const accommodations = Array.isArray(data.accommodations) ? data.accommodations : [];
  if (!Array.isArray(data.accommodations)) addError('accommodations', 'liste requise');
  const ids = new Set();
  const active = [];
  for (const [index, accommodation] of accommodations.entries()) {
    const path = `accommodations[${index}]`;
    if (!accommodation || typeof accommodation !== 'object') {
      addError(path, 'entrée objet requise');
      continue;
    }
    if (!requiredString(accommodation.id)) addError(`${path}.id`, 'identifiant requis');
    else if (ids.has(accommodation.id)) addError(`${path}.id`, `identifiant dupliqué: ${accommodation.id}`);
    else ids.add(accommodation.id);
    for (const field of ['stage', 'name', 'source_path']) {
      if (!requiredString(accommodation[field])) addError(`${path}.${field}`, 'champ texte requis');
    }
    if (!ACCOMMODATION_STATUSES.has(accommodation.status)) addError(`${path}.status`, 'statut de logement inconnu');
    for (const field of ['check_in', 'check_out']) {
      if (!isDate(accommodation[field])) addError(`${path}.${field}`, 'date ISO valide requise');
    }
    if (isDate(accommodation.check_in) && isDate(accommodation.check_out)) {
      const expectedNights = daysBetween(accommodation.check_in, accommodation.check_out);
      if (expectedNights <= 0) addError(path, 'check_out doit suivre check_in');
      if (accommodation.nights !== expectedNights) addError(`${path}.nights`, `doit être ${expectedNights}`);
    }
    if (accommodation.price_cad !== null && (typeof accommodation.price_cad !== 'number' || accommodation.price_cad < 0)) {
      addError(`${path}.price_cad`, 'doit être un nombre positif ou null');
    }
    if (accommodation.active === true) {
      active.push(accommodation);
      if (accommodation.status === 'archived' || accommodation.status === 'proposed') {
        addError(`${path}.active`, 'un logement actif ne peut pas être archived ou proposed');
      }
      if (accommodation.status === 'confirmed' && !requiredString(accommodation.address_en)) {
        addWarning(`${path}.address_en`, 'adresse absente d’un logement confirmé');
      }
    }
    if (requiredString(accommodation.source_path) && !existsSync(resolve(repoRoot, accommodation.source_path))) {
      addError(`${path}.source_path`, 'fichier source absent');
    }
  }

  for (let i = 0; i < active.length; i += 1) {
    for (let j = i + 1; j < active.length; j += 1) {
      const a = active[i];
      const b = active[j];
      if (a.check_in < b.check_out && b.check_in < a.check_out) {
        addError('accommodations', `séjours actifs en chevauchement: ${a.id} et ${b.id}`);
      }
    }
  }

  return { errors, warnings };
}

export function loadItinerary(filePath = DEFAULT_DATA_PATH) {
  return yaml.load(readFileSync(filePath, 'utf8'), {
    filename: filePath,
    schema: yaml.CORE_SCHEMA,
  });
}

function printIssues(label, issues) {
  for (const { path, message } of issues) console.error(`${label} ${path}: ${message}`);
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname)) {
  const filePath = process.argv[2] ? resolve(process.argv[2]) : DEFAULT_DATA_PATH;
  try {
    const result = validateItinerary(loadItinerary(filePath), { repoRoot: process.cwd() });
    printIssues('ERROR', result.errors);
    printIssues('WARN', result.warnings);
    if (result.errors.length) process.exitCode = 1;
    else console.log(`✓ Itinéraire valide: ${filePath}${result.warnings.length ? ` (${result.warnings.length} avertissement(s))` : ''}`);
  } catch (error) {
    console.error(`ERROR ${filePath}: ${error.message}`);
    process.exitCode = 1;
  }
}
