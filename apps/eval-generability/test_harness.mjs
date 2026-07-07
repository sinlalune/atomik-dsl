/* Harness self-test (CP-DSL-003 S03): proves the pure pipeline — scorer,
 * stability, prompt regimes, batch bodies, results parsing — with no API and
 * no dependencies. Run: node apps/eval-generability/test_harness.mjs
 * (npm run eval:test). */
import { score } from './scorer.mjs';
import { aggregate, jaccard } from './stability.mjs';
import { build, loadPocketSpec } from './prompt.mjs';
import { planGeneration, extractScene, parseId, genId } from './batch.mjs';
import * as anthropic from './providers/anthropic.mjs';
import * as google from './providers/google.mjs';
import { get as getProvider, SUBJECT_PROVIDERS } from './providers/index.mjs';

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

console.log('\n== planning + scene extraction ==');
const items = planGeneration(pocket, [taskTeach], { regimes: ['R1', 'R2'], runs: 5 });
ok(items.length === 10, '1 task × 2 regimes × 5 runs = 10 plan items');
ok(new Set(items.map((i) => i.customId)).size === 10, 'custom_ids are unique');
ok(items.every((i) => i.system && i.user), 'each item carries system + user');
ok(parseId(genId('foo', 'R1', 3)).run === 3 && parseId(genId('foo', 'R1', 3)).taskId === 'foo', 'custom_id round-trips');
ok(extractScene('```atomik\natomik 0.3\nscene s\n```') === 'atomik 0.3\nscene s', 'extractScene strips fences');
ok(extractScene('Sure!\n\natomik 0.3\nscene s').startsWith('atomik 0.3'), 'extractScene drops preamble chatter');

console.log('\n== provider: anthropic ==');
const aReqs = anthropic.toRequests(items, 'claude-haiku-4-5');
ok(aReqs.length === 10 && aReqs.every((r) => r.params.model === 'claude-haiku-4-5' && r.params.max_tokens > 0), 'anthropic bodies carry model + max_tokens');
ok(aReqs[0].custom_id === items[0].customId && aReqs[0].params.messages[0].content === items[0].user, 'anthropic keys by custom_id, user as message content');
const aParsed = anthropic.parseResultsJsonl(JSON.stringify({ custom_id: 'gen:t:R1:1', result: { type: 'succeeded', message: { content: [{ type: 'text', text: 'atomik 0.3' }] } } }) + '\n' + JSON.stringify({ custom_id: 'gen:t:R1:2', result: { type: 'errored' } }));
ok(aParsed['gen:t:R1:1'].text === 'atomik 0.3' && aParsed['gen:t:R1:2'].error === 'errored', 'anthropic results JSONL parses success + error');

console.log('\n== provider: google (offline shape + order-zipping) ==');
const gReqs = google.toRequests(items);
ok(gReqs.length === 10, 'google builds one inline request per item');
ok(gReqs[0].contents[0].parts[0].text === items[0].user && gReqs[0].contents[0].role === 'user', 'google inline request: user text under contents.parts');
ok(gReqs[0].config.systemInstruction.parts[0].text === items[0].system && gReqs[0].config.maxOutputTokens > 0, 'google inline request: systemInstruction + maxOutputTokens in config');
ok(gReqs[0].model === undefined, 'google inline request omits model (set on the batch job)');
// order-zipping: inline responses have no key — must match by index
const cids = ['gen:a:R1:1', 'gen:b:R1:1', 'gen:c:R1:1'];
const fakeJob = { dest: { inlinedResponses: [
  { response: { text: 'atomik 0.3\nscene a' } },
  { error: 'quota' },
  { response: { text: 'atomik 0.3\nscene c' } }
] } };
const gMap = google.parseInlineResponses(fakeJob, cids);
ok(gMap['gen:a:R1:1'].text === 'atomik 0.3\nscene a' && gMap['gen:c:R1:1'].text === 'atomik 0.3\nscene c', 'google zips responses to custom_ids by position');
ok(gMap['gen:b:R1:1'].text === null && gMap['gen:b:R1:1'].error === 'quota', 'google surfaces a per-request error by position');
ok(google.parseInlineResponses({ dest: {} }, ['gen:x:R1:1'])['gen:x:R1:1'].error === 'missing', 'google marks a missing response');

console.log('\n== provider registry ==');
ok(SUBJECT_PROVIDERS.length === 2 && getProvider('anthropic').name === 'anthropic' && getProvider('google').name === 'google', 'registry resolves both subject providers');
ok(getProvider('google').judgeModel === 'claude-sonnet-5', 'judge stays Sonnet 5 even for the google subject');
let threw = false; try { getProvider('nope'); } catch { threw = true; }
ok(threw, 'unknown provider throws');

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
