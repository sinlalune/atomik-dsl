#!/usr/bin/env node
/* Mechanically validate the generability task corpus (CP-DSL-003 S02).
 * Checks each tasks/*.json against the schema in tasks/README.md: required
 * fields, closed-vocabulary status ceilings, well-formed property checks with
 * their required params, and compilable regex patterns. No network, no kernel.
 * Run: node apps/eval-generability/validate_tasks.mjs   (npm run eval:validate)
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const tasksDir = join(here, 'tasks');

const STATUSES = ['established', 'supported', 'contested', 'hypothesis',
  'speculative', 'reported', 'misconception', 'unspecified'];
const CLASSES = ['fact', 'inference', 'hypothesis', 'analogy',
  'interpretation', 'refutation', 'boundary', 'unspecified'];
const ARCHETYPES = ['graph', 'flow', 'cycle', 'tree', 'nested', 'concentric',
  'timeline', 'axis', 'matrix', 'bar', 'map'];

/* property check name -> required param keys (beyond id/check) */
const CHECK_PARAMS = {
  nodeMatching: ['pattern'],
  nodeStatusMatching: ['pattern', 'status'],
  relationClass: ['class'],
  relationToClaim: [],
  evidenceCount: ['min'],
  datedEvidence: ['min'],
  evidenceEdge: [],
  edgeClassNot: ['pattern', 'forbidden'],
  minNodes: ['n'],
  directedEdges: ['min'],
  placesValue: ['min'],
  placesRelative: ['min'],
  signedEdges: ['min'],
  hasSteps: [],
  hasGate: []
};

let errors = 0;
const seenIds = new Set();
const files = readdirSync(tasksDir).filter((f) => f.endsWith('.json')).sort();

function err(file, msg) { errors++; console.log('  ✗ ' + file + ': ' + msg); }

for (const file of files) {
  let t;
  try { t = JSON.parse(readFileSync(join(tasksDir, file), 'utf8')); }
  catch (e) { err(file, 'invalid JSON — ' + e.message); continue; }

  if (typeof t.id !== 'string' || !/^[a-z0-9-]+$/.test(t.id)) err(file, 'id must be kebab-case string');
  if (seenIds.has(t.id)) err(file, 'duplicate id "' + t.id + '"');
  seenIds.add(t.id);
  if (t.lang !== 'fr' && t.lang !== 'en') err(file, 'lang must be "fr" or "en"');
  if (typeof t.passage !== 'string' || t.passage.split(/\s+/).length < 30) err(file, 'passage missing or too short (<30 words)');
  if (!Array.isArray(t.vaultIndex) || !t.vaultIndex.every((n) => typeof n === 'string')) err(file, 'vaultIndex must be an array of strings');
  if (!Array.isArray(t.allowedClaimStatuses) || !t.allowedClaimStatuses.length) err(file, 'allowedClaimStatuses must be a non-empty array');
  else t.allowedClaimStatuses.forEach((s) => { if (STATUSES.indexOf(s) < 0) err(file, 'unknown status "' + s + '"'); });
  if (typeof t.teachingSequence !== 'boolean') err(file, 'teachingSequence must be boolean');
  if (t.expectedArchetype !== null && ARCHETYPES.indexOf(t.expectedArchetype) < 0) err(file, 'expectedArchetype must be null or a known archetype');
  if (!Array.isArray(t.properties)) { err(file, 'properties must be an array'); continue; }

  const teachingChecks = ['hasSteps', 'hasGate'];
  const propIds = new Set();
  t.properties.forEach((p) => {
    if (typeof p.id !== 'string') return err(file, 'property missing id');
    if (propIds.has(p.id)) err(file, 'duplicate property id "' + p.id + '"');
    propIds.add(p.id);
    const req = CHECK_PARAMS[p.check];
    if (!req) return err(file, 'unknown check "' + p.check + '" in ' + p.id);
    req.forEach((k) => { if (p[k] === undefined) err(file, 'check "' + p.check + '" (' + p.id + ') missing param "' + k + '"'); });
    if (p.pattern !== undefined) { try { new RegExp(p.pattern, 'i'); } catch (e) { err(file, 'bad regex in ' + p.id + ': ' + e.message); } }
    if (p.status !== undefined && STATUSES.indexOf(p.status) < 0) err(file, 'unknown status "' + p.status + '" in ' + p.id);
    if (p.class !== undefined && CLASSES.indexOf(p.class) < 0) err(file, 'unknown class "' + p.class + '" in ' + p.id);
    if (p.check === 'edgeClassNot' && (!Array.isArray(p.forbidden) || !p.forbidden.length)) err(file, 'edgeClassNot (' + p.id + ') needs a non-empty forbidden[]');
    if (teachingChecks.indexOf(p.check) >= 0 && !t.teachingSequence) err(file, p.check + ' (' + p.id + ') requires teachingSequence:true');
  });
}

const n = files.length;
if (errors === 0) console.log('  ✓ ' + n + ' tasks valid (schema, status ceilings, property checks, regexes)');
console.log('\n' + (n - 0) + ' task file(s), ' + errors + ' error(s)');
process.exit(errors ? 1 : 0);
