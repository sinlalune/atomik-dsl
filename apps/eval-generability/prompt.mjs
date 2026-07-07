/* Prompt construction. The system prompt is the pocket spec VERBATIM — that is
 * the artifact under test (spec §13.3); we measure what a model does with the
 * card as shipped, not a tuned variant. Two regimes (batch-03's closing
 * experiment): R1 = model-plane-only per the pipeline contract (§8/§10),
 * R2 = free (no plane restriction), to isolate how much archetype instability
 * comes from letting the model choose the projection. Pure; no I/O here. */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const POCKET = join(here, '..', '..', 'docs', 'bedrock', 'atomik_pocket_spec_v0_3.md');

export function loadPocketSpec() { return readFileSync(POCKET, 'utf8'); }

const R1_INSTRUCTION = [
  'Generate an atomik scene from the SOURCE passage below, following the pocket spec exactly.',
  'Emit the MODEL PLANE ONLY — scene, claim, subject, node/evidence, relation, group, place, data — plus at most one `project as <x> [suggested]` line. No steps, inputs, rules, marks.',
  'Output ONLY the atomik source, starting with `atomik 0.3`. No prose, no code fences, no explanation.'
].join('\n');

const R1_TEACHING = [
  'Generate an atomik scene from the SOURCE passage below, following the pocket spec exactly.',
  'The user has asked for a TEACHING SEQUENCE, so you may (and should) use steps, an input, and a prediction gate to choreograph elicit -> confront -> resolve. Mark any false belief with [status misconception] and refute it.',
  'Output ONLY the atomik source, starting with `atomik 0.3`. No prose, no code fences, no explanation.'
].join('\n');

const R2_INSTRUCTION = [
  'Generate an atomik scene from the SOURCE passage below, following the pocket spec.',
  'Choose whatever atomik constructs best express the passage.',
  'Output ONLY the atomik source, starting with `atomik 0.3`. No prose, no code fences, no explanation.'
].join('\n');

function vaultBlock(task) {
  if (!task.vaultIndex.length) return 'VAULT NOTES THAT EXIST (use [[links]] only for these; none exist, so use plain strings): (none)';
  return 'VAULT NOTES THAT EXIST (use [[links]] only for these exact titles; anything else must be a plain string):\n' +
    task.vaultIndex.map((n) => '  - ' + n).join('\n');
}

/* build(pocketSpec, task, regime) -> { system, user } */
export function build(pocketSpec, task, regime) {
  let instruction;
  if (regime === 'R1') instruction = task.teachingSequence ? R1_TEACHING : R1_INSTRUCTION;
  else if (regime === 'R2') instruction = R2_INSTRUCTION;
  else throw new Error('unknown regime ' + regime);

  const user = [
    instruction,
    '',
    vaultBlock(task),
    '',
    'SOURCE (' + task.lang + '):',
    task.passage
  ].join('\n');

  return { system: pocketSpec, user };
}

/* repairPrompt(task, sceneText, diagnostics) -> { system, user }
 * One line-scoped repair round (spec §8 stage 4 / G6): feed the failed source
 * plus the kernel's line diagnostics back and ask for a corrected scene. */
export function repairPrompt(pocketSpec, task, sceneText, diagnostics) {
  const diagLines = diagnostics.map((d) => '  L' + d.line + ' [' + d.severity + '] ' + d.code).join('\n');
  const user = [
    'The following atomik scene has validation problems. Fix ONLY what the diagnostics flag; keep everything else identical. Output the full corrected scene, starting with `atomik 0.3`, nothing else.',
    '',
    'DIAGNOSTICS:',
    diagLines,
    '',
    'SCENE:',
    sceneText
  ].join('\n');
  return { system: pocketSpec, user };
}

/* judgePrompt(task, sceneText) -> { system, user }
 * Confabulation pass (owner decision): a stronger model flags scene elements
 * not supported by the passage. Reported separately, marked judged-not-proven. */
export function judgePrompt(task, sceneText) {
  const system = [
    'You are an epistemic-fidelity judge for generated knowledge diagrams. You are given a SOURCE passage and an atomik SCENE generated from it. Your job is to flag CONFABULATION: elements of the scene (nodes, relations, claim, statuses) that are NOT supported by the source passage, or that state something MORE confidently than the source does.',
    'Do not reward or penalize style, completeness, or archetype choice. Judge only faithfulness to the source.',
    'Respond as a single JSON object, no prose around it:',
    '{"unsupportedElements": ["<short description>", ...], "overconfidentClaim": <true|false>, "flattenedHedge": <true|false>, "notes": "<one sentence>"}'
  ].join('\n');
  const user = ['SOURCE:', task.passage, '', 'SCENE:', sceneText].join('\n');
  return { system, user };
}
