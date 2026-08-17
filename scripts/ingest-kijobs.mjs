#!/usr/bin/env node
/**
 * Validate and merge a Cowork extraction batch into public/data/projects.json.
 *
 *   node scripts/ingest-kijobs.mjs <batch.json>            # dry run, report only
 *   node scripts/ingest-kijobs.mjs <batch.json> --write    # merge and write
 *
 * The batch is the file described in docs/COWORK_KIJOBS_BRIEF.md: an array of
 * { project, source } objects. Every row lands in exactly one of three buckets:
 *
 *   ACCEPTED  — complete and plottable; merged into projects.json.
 *   PENDING   — valid in every respect EXCEPT coordinates. The brief forbids
 *               the extractor from geocoding, so this is the normal state for
 *               most rows, not a fault. They go to a geocoding worklist and
 *               come back through this same gate once coordinates exist.
 *   REJECTED  — would corrupt shared state (id/job-number collisions, broken
 *               enums, corrupt coordinates, placeholder text). Needs a human
 *               ruling; blocks the merge until resolved.
 *
 * Nothing is written unless --write is passed and zero REJECTS remain. Pending
 * rows never block a merge — the accepted ones go in without them.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const TARGET = resolve(ROOT, 'public/data/projects.json');
const TEAMS = resolve(ROOT, 'public/data/teams.json');

const REGIONS = new Set(['LV', 'NNV', 'AZ']);
const STATES = new Set(['NV', 'AZ']);
const CATEGORIES = new Set([
  'Retail', 'Restaurant', 'Office & TI', 'Industrial', 'Civic & Housing',
  'Medical', 'Tavern & Gaming', 'Automotive & Storage', 'Recreation & Events',
  'Civil & Sitework', 'Design-Build'
]);
const PLACEHOLDERS = new Set([
  'n/a', 'na', 'tbd', 'unknown', 'none', '-', '', 'null', 'undefined',
  '00/00/0000', 'x', '?'
]);
/** Cities already in the atlas — a new spelling forks the index rail. */
const CITY_REGION = {
  'Las Vegas': 'LV', 'North Las Vegas': 'LV', 'Henderson': 'LV',
  'Carson City': 'NNV', 'Reno': 'NNV', 'Sparks': 'NNV', 'Dayton': 'NNV',
  'Gilbert': 'AZ', 'Avondale': 'AZ'
};
const WINDOW_START = '2024-01-01';

const args = process.argv.slice(2);
const batchPath = args.find((a) => !a.startsWith('--'));
const doWrite = args.includes('--write');
if (!batchPath) {
  console.error('usage: node scripts/ingest-kijobs.mjs <batch.json> [--write]');
  process.exit(2);
}

const existing = JSON.parse(readFileSync(TARGET, 'utf8'));
const teams = new Set(JSON.parse(readFileSync(TEAMS, 'utf8')).map((t) => t.id));
const existingIds = new Set(existing.map((p) => String(p.id).toLowerCase()));
const existingNums = new Set(existing.map((p) => String(p.number).toLowerCase()));

let batch;
try {
  batch = JSON.parse(readFileSync(resolve(batchPath), 'utf8'));
} catch (e) {
  console.error(`FATAL: batch does not parse as JSON — ${e.message}`);
  console.error('Merging a partially-parsed batch is never correct. Aborting.');
  process.exit(1);
}
if (!Array.isArray(batch)) {
  console.error('FATAL: batch must be a JSON array.');
  process.exit(1);
}

const today = new Date().toISOString().slice(0, 10);
const accepted = [];
const pending = [];
const rejected = [];
const flagged = [];
const seenIds = new Set();
const seenNums = new Set();
const newEnums = { city: new Set(), category: new Set(), team: new Set() };

function isPlaceholder(v) {
  return typeof v === 'string' && PLACEHOLDERS.has(v.trim().toLowerCase());
}
function isRealDate(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

for (const [i, row] of batch.entries()) {
  const where = row?.source?.folder ?? `batch index ${i}`;
  const p = row?.project;
  const reject = (rule, reason) => rejected.push({ rule, reason, folder: where, id: p?.id });
  const flag = (reason) => flagged.push({ reason, folder: where, id: p?.id });

  if (!p || typeof p !== 'object') { reject('R-SHAPE', 'no `project` object'); continue; }

  // --- identity ---------------------------------------------------------
  if (typeof p.id !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9-]*$/.test(p.id)) {
    reject('R-ID-CHARSET', `id ${JSON.stringify(p.id)} is missing or has illegal characters`);
    continue;
  }
  const idKey = p.id.toLowerCase();
  if (existingIds.has(idKey) || seenIds.has(idKey)) {
    reject('R-ID-DUP', `id "${p.id}" already exists — never auto-rename`);
    continue;
  }
  if (typeof p.number !== 'string' || p.number === '') {
    reject('R-NUM-MISSING', 'number missing or not a quoted string (crashes the hero art)');
    continue;
  }
  const numKey = p.number.toLowerCase();
  if (existingNums.has(numKey) || seenNums.has(numKey)) {
    reject('R-DUP-JOBNUM', `job number "${p.number}" already exists — needs a human ruling`);
    continue;
  }
  if (typeof p.name !== 'string' || p.name === '') {
    reject('R-NAME-MISSING', 'name missing (crashes the index sort)');
    continue;
  }

  // --- geography --------------------------------------------------------
  // Absent coordinates are NOT a fault. The brief forbids the extractor from
  // geocoding, so this is the expected state for most rows; they are held for
  // the geocoding pass rather than rejected. Coordinates that are PRESENT but
  // corrupt are a different matter and still reject.
  const needsGeocode = !Number.isFinite(p.lat) || !Number.isFinite(p.lng);
  if (!needsGeocode) {
    if (p.lng > 0) { reject('R-GEO-SIGN', `lng ${p.lng} is positive — missing minus sign, not auto-fixed`); continue; }
    if (Math.abs(p.lat) > 90) { reject('R-GEO-SWAP', `lat ${p.lat} out of range — lat/lng likely swapped`); continue; }
    if (!(p.lat > 24 && p.lat < 50 && p.lng > -125 && p.lng < -60)) {
      reject('R-GEO-RANGE', `coordinates ${p.lat},${p.lng} fall outside the continental US`);
      continue;
    }
  }
  if (!STATES.has(p.state)) { reject('R-ENUM', `state ${JSON.stringify(p.state)} not NV/AZ`); continue; }
  if (!REGIONS.has(p.region)) { reject('R-ENUM', `region ${JSON.stringify(p.region)} not LV/NNV/AZ`); continue; }
  if ((p.region === 'AZ') !== (p.state === 'AZ')) {
    reject('R-GEO-KEY', `region ${p.region} inconsistent with state ${p.state}`);
    continue;
  }
  if (typeof p.city !== 'string' || p.city === '') { reject('R-GEO-KEY', 'city missing'); continue; }
  if (!(p.city in CITY_REGION)) {
    newEnums.city.add(p.city);
    flag(`new city "${p.city}" — confirm the spelling or it forks the index rail`);
  } else if (CITY_REGION[p.city] !== p.region) {
    reject('R-GEO-KEY', `city ${p.city} maps to ${CITY_REGION[p.city]}, not ${p.region}`);
    continue;
  }

  // --- enums and dates --------------------------------------------------
  if (p.category !== undefined && !CATEGORIES.has(p.category)) {
    reject('R-ENUM', `category ${JSON.stringify(p.category)} is not one of the 11 allowed`);
    continue;
  }
  if (p.category === undefined) flag('category omitted — will not match any Type filter');
  if (p.status !== 'Complete') { reject('R-ENUM', `status must be "Complete" for this batch, got ${JSON.stringify(p.status)}`); continue; }
  if (p.estCompletionDate !== undefined) {
    if (!isRealDate(p.estCompletionDate)) {
      reject('R-DATE', `estCompletionDate ${JSON.stringify(p.estCompletionDate)} is not a real YYYY-MM-DD date`);
      continue;
    }
    if (p.estCompletionDate > today) { reject('R-DATE-FUTURE', `completion ${p.estCompletionDate} is in the future`); continue; }
    if (p.estCompletionDate < WINDOW_START) { reject('R-DATE-WINDOW', `completion ${p.estCompletionDate} predates ${WINDOW_START}`); continue; }
  } else {
    flag('no completion date — the card will show "—"');
  }
  if (p.team !== undefined && !teams.has(p.team)) {
    newEnums.team.add(p.team);
    flag(`team "${p.team}" is not in teams.json — it will appear as a grey legend row`);
  }
  if (p.sqFt !== undefined && (!Number.isInteger(p.sqFt) || p.sqFt <= 0 || p.sqFt > 5_000_000)) {
    reject('R-SQFT', `sqFt ${p.sqFt} is not a plausible integer`);
    continue;
  }

  // Kalb (2026-08-17): the first two digits of a job number are the year the
  // job was OPENED. Purely mechanical, so derive it when absent and reject a
  // mismatch — but never treat it as the completion year, which often differs.
  const numeric = /^(\d{2})\d{3}$/.exec(p.number);
  if (numeric) {
    const expected = 2000 + Number(numeric[1]);
    if (p.year === undefined) {
      p.year = expected;
    } else if (p.year !== expected) {
      reject('R-YEAR', `year ${p.year} does not match job number ${p.number} (expected ${expected})`);
      continue;
    }
    if (p.estCompletionDate && Number(p.estCompletionDate.slice(0, 4)) < expected) {
      flag(`completed ${p.estCompletionDate} but job number says it opened in ${expected} — check the number`);
    }
  } else if (p.year !== undefined) {
    flag(`year ${p.year} set on non-numeric job number "${p.number}" — B-jobs carry no year`);
  }

  // --- hygiene ----------------------------------------------------------
  const bad = Object.entries(p).filter(([k, v]) => isPlaceholder(v) && k !== 'heroImage');
  if (bad.length) { reject('R-PLACEHOLDER', `placeholder values survived: ${bad.map(([k]) => k).join(', ')}`); continue; }
  const nulls = Object.entries(p).filter(([k, v]) => v === null && k !== 'heroImage' && k !== 'superintendent');
  if (nulls.length) { reject('R-NULL', `illegal nulls: ${nulls.map(([k]) => k).join(', ')}`); continue; }

  seenIds.add(idKey);
  seenNums.add(numKey);
  // Every row in this batch is historical by definition — stamped here rather
  // than asked of the extractor, since it is a constant for the whole run.
  p.historical = true;
  if (needsGeocode) pending.push(row);
  else accepted.push(p);
}

// --- report -------------------------------------------------------------
const line = (s) => console.log(s);
line('');
line(`Batch:    ${batchPath}`);
line(`Rows:     ${batch.length}`);
line(`Accepted: ${accepted.length}  (complete — will merge)`);
line(`Pending:  ${pending.length}  (valid, awaiting coordinates — normal)`);
line(`Rejected: ${rejected.length}  (needs a ruling — blocks the merge)`);
line(`Flagged:  ${flagged.length}  (kept, but worth a human look)`);
line('');
if (rejected.length) {
  line('--- REJECTED ------------------------------------------------------');
  for (const r of rejected) line(`  [${r.rule}] ${r.id ?? '?'} — ${r.reason}\n      ${r.folder}`);
  line('');
}
if (flagged.length) {
  line('--- FLAGGED -------------------------------------------------------');
  for (const f of flagged) line(`  ${f.id ?? '?'} — ${f.reason}`);
  line('');
}
for (const [k, set] of Object.entries(newEnums)) {
  if (set.size) line(`New ${k} values encountered: ${[...set].join(', ')}`);
}

if (!doWrite) {
  line('\nDry run — nothing written. Re-run with --write to merge.');
  process.exit(rejected.length ? 1 : 0);
}

if (rejected.length) {
  const queue = resolve(ROOT, 'kijobs-review-queue.json');
  writeFileSync(queue, JSON.stringify(rejected, null, 2) + '\n');
  console.error(`\nRefusing to merge with ${rejected.length} reject(s). Queue written to ${queue}`);
  process.exit(1);
}

// The geocoding worklist keeps the full {project, source} shape so that once
// lat/lng are filled in, the same file feeds straight back through this gate.
if (pending.length) {
  const hold = resolve(ROOT, 'kijobs-pending-geocode.json');
  writeFileSync(hold, JSON.stringify(pending, null, 2) + '\n');
  const csv = resolve(ROOT, 'kijobs-to-geocode.csv');
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  writeFileSync(
    csv,
    'id,number,name,address,city,state,lat,lng\n' +
      pending
        .map((r) =>
          [r.project.id, r.project.number, r.project.name, r.project.address,
           r.project.city, r.project.state, '', ''].map(esc).join(',')
        )
        .join('\n') + '\n'
  );
  line(`\n${pending.length} rows held for geocoding:`);
  line(`  ${hold}   (re-run this file through the gate once coordinates are in)`);
  line(`  ${csv}   (fill the lat/lng columns, or use /tools/coords.html)`);
}

writeFileSync(TARGET, JSON.stringify([...existing, ...accepted], null, 2) + '\n');
line(`\nMerged ${accepted.length} rows. ${TARGET} now holds ${existing.length + accepted.length} projects.`);
