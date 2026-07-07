/* Harness self-test (CP-DSL-003 S03): proves the pure pipeline — scorer,
 * stability, prompt regimes, batch bodies, results parsing — with no API and
 * no dependencies. Run: node apps/eval-generability/test_harness.mjs
 * (npm run eval:test). */
import { score } from './scorer.mjs';
import { aggregate, jaccard } from './stability.mjs';
import { build, loadPocketSpec } from './prompt.mjs';
import { buildGenerationBatch, extractScene, parseResultsJsonl, parseId, genId } from './batch.mjs';

let pass = 0, fail = 0;
const ok = (c, l) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l); } };

const taskTeach = {
  id: 't', lang: 'en', passage: 'x '.repeat(40), vaultIndex: ['Free fall'],
  allowedClaimStatuses: ['established'], teachingSequence: true, expectedArchetype: 'flow',
  properties: [
    { id: 'belief', check: 'nodeStatusMatching', pattern: 'heav', status: 'misconception' },
    { id: 'ref', check: 'relationClass', class: 'refutation', min: 1 },
    { id: 'steps', check: 'hasSteps' }
  ]
};
const goodScene = 'atomik 0.3\nscene s [origin generated]\nclaim "In vacuum all fall alike." [status established]\nsubject [[Free fall]]\nnode belief "Heavy objects fall faster" [status misconception]\nnode vac "Vacuum drop" [role evidence]\nrelation vac -> belief refutes [as refutation]\nstep 1 reveal belief\nstep 2 require guess\ninput guess = choice "a" | "b"';

console.log('\n== scorer ==');
let s = score(taskTeach, goodScene);
ok(s.parses && s.pass, 'ideal teaching scene passes all gates');
ok(s.fabricatedCount === 0, 'no fabricated links when subject is in-vault');
ok(s.properties.every((p) => p.pass), 'all property checks pass');

// G2: a link not in the vault is a fabrication
s = score({ ...taskTeach, teachingSequence: false, properties: [] }, 'atomik 0.3\nscene s [origin generated]\nclaim "x." [status established]\nnode a [[Nonexistent Note]]');
ok(s.fabricatedCount === 1 && s.fabricatedLinks[0] === 'Nonexistent Note', 'G2: out-of-vault wikilink flagged');

// G4: claim status above the ceiling fails
s = score({ ...taskTeach, allowedClaimStatuses: ['hypothesis'], teachingSequence: false, properties: [] }, 'atomik 0.3\nscene s [origin generated]\nclaim "x." [status established]\nnode a "A"');
ok(s.parses && !s.statusWithinCeiling && !s.pass, 'G4: status above ceiling breaches and fails overall');

// pocket-spec rule 1: choreography without a teaching request is a violation
s = score({ ...taskTeach, teachingSequence: false, properties: [] }, 'atomik 0.3\nscene s [origin generated]\nclaim "x." [status established]\nnode a "A"\nstep 1 reveal a');
ok(s.choreographyViolation && !s.pass, 'illicit choreography (non-teaching task) flagged and fails');

// parse failure surfaces
s = score({ ...taskTeach, properties: [] }, 'not atomik at all');
ok(!s.parses, 'garbage input does not parse');

console.log('\n== stability ==');
ok(jaccard(['a', 'b', 'c'], ['a', 'b', 'c']) === 1, 'identical id sets → Jaccard 1');
ok(Math.abs(jaccard(['a', 'b'], ['b', 'c']) - 1 / 3) < 1e-9, 'half-overlap Jaccard = 1/3');
const agg = aggregate([
  { archetype: 'cycle', nodeIds: ['a', 'b'], relationSignature: ['a->b#fact'], pass: true, fabricatedCount: 0, statusWithinCeiling: true },
  { archetype: 'cycle', nodeIds: ['a', 'b'], relationSignature: ['a->b#fact'], pass: true, fabricatedCount: 0, statusWithinCeiling: true },
  { archetype: 'graph', nodeIds: ['a', 'c'], relationSignature: ['a->c#fact'], pass: false, fabricatedCount: 1, statusWithinCeiling: true }
]);
ok(Math.abs(agg.archetypeModeShare - 2 / 3) < 1e-9, 'archetype mode share = 2/3 (cycle beats graph)');
ok(agg.archetypeMode === 'cycle', 'mode archetype is cycle');
ok(Math.abs(agg.passRate - 2 / 3) < 1e-9 && Math.abs(agg.fabricationRate - 1 / 3) < 1e-9, 'pass and fabrication rates computed');

console.log('\n== prompt regimes ==');
const pocket = loadPocketSpec();
const p1 = build(pocket, taskTeach, 'R1');
const p2 = build(pocket, taskTeach, 'R2');
ok(p1.system === pocket, 'system prompt is the pocket spec verbatim (the artifact under test)');
ok(/TEACHING SEQUENCE/.test(p1.user), 'R1 teaching task invites steps/gate');
ok(/MODEL PLANE ONLY/.test(build(pocket, { ...taskTeach, teachingSequence: false }, 'R1').user), 'R1 non-teaching restricts to model plane');
ok(!/MODEL PLANE ONLY/.test(p2.user), 'R2 is unrestricted');
ok(/Free fall/.test(p1.user), 'vault index is surfaced in the prompt');

console.log('\n== batch bodies + parsing ==');
const reqs = buildGenerationBatch(pocket, [taskTeach], { regimes: ['R1', 'R2'], runs: 5, model: 'claude-haiku-4-5' });
ok(reqs.length === 10, '1 task × 2 regimes × 5 runs = 10 requests');
ok(new Set(reqs.map((r) => r.custom_id)).size === 10, 'custom_ids are unique');
ok(reqs.every((r) => r.params.model === 'claude-haiku-4-5' && r.params.max_tokens > 0), 'each request carries model + max_tokens');
ok(parseId(genId('foo', 'R1', 3)).run === 3 && parseId(genId('foo', 'R1', 3)).taskId === 'foo', 'custom_id round-trips');
ok(extractScene('```atomik\natomik 0.3\nscene s\n```') === 'atomik 0.3\nscene s', 'extractScene strips fences');
ok(extractScene('Sure!\n\natomik 0.3\nscene s').startsWith('atomik 0.3'), 'extractScene drops preamble chatter');
const parsed = parseResultsJsonl(JSON.stringify({ custom_id: 'gen:t:R1:1', result: { type: 'succeeded', message: { content: [{ type: 'text', text: 'atomik 0.3' }] } } }) + '\n' + JSON.stringify({ custom_id: 'gen:t:R1:2', result: { type: 'errored' } }));
ok(parsed['gen:t:R1:1'].text === 'atomik 0.3' && parsed['gen:t:R1:2'].error === 'errored', 'results JSONL parses success + error');

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
