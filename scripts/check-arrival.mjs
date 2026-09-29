#!/usr/bin/env node

import { resolve } from 'node:path';
import { DEFAULT_DATA_PATH, loadItinerary, validateItinerary } from './validate-itinerary.mjs';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const TERMINAL_STATUSES = new Set(['confirme', 'a-confirmer']);

function issue(path, message) {
  return { path, message };
}

function requiredString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function normalize(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[–—]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

function findArrivalAccommodation(data) {
  const accommodations = Array.isArray(data?.accommodations) ? data.accommodations : [];
  const active = accommodations
    .filter(accommodation => accommodation?.active === true)
    .sort((a, b) => String(a.check_in).localeCompare(String(b.check_in)));
  return active.find(accommodation => accommodation.check_in === data?.trip?.start_date) ?? active[0] ?? null;
}

export function checkArrival(data) {
  const errors = [];
  const warnings = [];
  const addError = (path, message) => errors.push(issue(path, message));
  const addWarning = (path, message) => warnings.push(issue(path, message));
  const arrival = data?.arrival;
  const trip = data?.trip;

  if (!arrival || typeof arrival !== 'object') {
    return { errors: [issue('arrival', 'section requise')], warnings: [], accommodation: null };
  }

  if (!DATE_RE.test(String(arrival.date ?? ''))) addError('arrival.date', 'date ISO requise');
  if (trip?.start_date && arrival.date !== trip.start_date) {
    addError('arrival.date', `doit correspondre au début du voyage (${trip.start_date})`);
  }
  if (!requiredString(arrival.airport)) addError('arrival.airport', 'aéroport requis');
  if (!TIME_RE.test(String(arrival.arrival_time ?? ''))) addError('arrival.arrival_time', 'heure HH:MM requise');
  if (!requiredString(arrival.terminal)) addError('arrival.terminal', 'terminal requis, même à confirmer');
  if (!TERMINAL_STATUSES.has(arrival.terminal_status)) {
    addError('arrival.terminal_status', 'doit être confirme ou a-confirmer');
  } else if (arrival.terminal_status === 'a-confirmer') {
    addWarning('arrival.terminal', 'terminal à confirmer avant le départ');
  }

  const accommodation = findArrivalAccommodation(data);
  if (!accommodation) {
    addError('accommodations', 'aucun logement actif pour l’arrivée');
  } else {
    if (arrival.accommodation_id !== accommodation.id) {
      addError('arrival.accommodation_id', `doit pointer vers le premier logement actif (${accommodation.id})`);
    }
    for (const field of ['name', 'address_en', 'station', 'exit', 'key_instruction']) {
      if (!requiredString(accommodation[field])) addError(`accommodations.${accommodation.id}.${field}`, 'information requise pour l’arrivée');
    }
    if (!Number.isInteger(accommodation.walking_distance_m) || accommodation.walking_distance_m <= 0) {
      addError(`accommodations.${accommodation.id}.walking_distance_m`, 'distance de marche positive requise en mètres');
    }
  }

  const route = Array.isArray(arrival.route) ? arrival.route : [];
  if (route.length < 2) {
    addError('arrival.route', 'au moins deux segments sont requis: aéroport → station → logement');
  } else {
    const airportToken = normalize(arrival.airport).split(' ')[0];
    if (!normalize(route[0]?.from).includes(airportToken)) {
      addError('arrival.route[0].from', 'le premier segment doit partir de l’aéroport déclaré');
    }
    for (const [index, segment] of route.entries()) {
      const path = `arrival.route[${index}]`;
      for (const field of ['from', 'to', 'mode', 'service']) {
        if (!requiredString(segment?.[field])) addError(`${path}.${field}`, 'champ requis');
      }
      if (index > 0 && normalize(segment?.from) !== normalize(route[index - 1]?.to)) {
        addError(`${path}.from`, 'doit reprendre la destination du segment précédent');
      }
    }
    if (accommodation?.station && normalize(route.at(-1)?.to) !== normalize(accommodation.station)) {
      addError('arrival.route', 'le dernier segment doit arriver à la station du logement');
    }
  }

  return { errors, warnings, accommodation };
}

function parseArgs(args) {
  let dataPath = DEFAULT_DATA_PATH;
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--data') {
      if (!args[index + 1]) throw new Error('--data nécessite un chemin');
      dataPath = resolve(process.cwd(), args[++index]);
    } else if (arg.startsWith('--data=')) {
      const value = arg.slice('--data='.length);
      if (!value) throw new Error('--data nécessite un chemin');
      dataPath = resolve(process.cwd(), value);
    } else {
      throw new Error(`option inconnue: ${arg}`);
    }
  }
  return dataPath;
}

function printIssues(label, issues) {
  for (const { path, message } of issues) console.error(`${label} ${path}: ${message}`);
}

try {
  const dataPath = parseArgs(process.argv.slice(2));
  const data = loadItinerary(dataPath);
  const validation = validateItinerary(data, { repoRoot: process.cwd() });
  printIssues('ERROR', validation.errors);
  printIssues('WARN', validation.warnings);
  if (validation.errors.length) process.exit(1);

  const result = checkArrival(data);
  printIssues('ERROR', result.errors);
  printIssues('WARN', result.warnings);
  if (result.errors.length) process.exit(1);

  const accommodation = result.accommodation;
  console.log(`✓ Arrivée contrôlée: ${data.arrival.airport} → ${accommodation.name} (${accommodation.station}, ${accommodation.walking_distance_m} m)`);
  console.log(`  Route: ${data.arrival.route.map(segment => segment.service).join(' → ')}`);
  console.log(`  Clé: ${accommodation.key_instruction}`);
} catch (error) {
  console.error(`ERROR check-arrival: ${error.message}`);
  process.exitCode = 1;
}
