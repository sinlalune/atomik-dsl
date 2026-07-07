/* Vendor-neutral batch planning + id scheme + scene extraction (CP-DSL-003).
 * A "plan item" is { customId, system, user } — provider adapters
 * (providers/*.mjs) turn items into vendor wire bodies and submit them. The
 * provider is a run-level tag, not part of the custom_id, so each provider's
 * batch keeps its own unique-within-batch ids. Pure, dependency-free.
 * custom_id scheme (Anthropic keys by it; Gemini keys by order — see adapters).
 * Separator is '_' because the Anthropic Batches API requires custom_id to match
 * ^[a-zA-Z0-9_-]{1,64}$ (no ':'); task ids are kebab-case and contain no '_', so
 * the split stays unambiguous:
 *   gen_<taskId>_<regime>_<run>   repair_<taskId>_<regime>_<run>   judge_<taskId>_<regime>_<run>
 */
import { build, repairPrompt, judgePrompt } from './prompt.mjs';

export const MAX_TOKENS = 1400; // a scene is small; caps cost and runaway output

export function genId(taskId, regime, run) { return 'gen_' + taskId + '_' + regime + '_' + run; }
export function repairId(taskId, regime, run) { return 'repair_' + taskId + '_' + regime + '_' + run; }
export function judgeId(taskId, regime, run) { return 'judge_' + taskId + '_' + regime + '_' + run; }
export function parseId(id) { const [kind, taskId, regime, run] = id.split('_'); return { kind, taskId, regime, run: Number(run) }; }

/* Full generation matrix: tasks × regimes × runs → plan items. */
export function planGeneration(pocketSpec, tasks, opts) {
  const { regimes, runs } = opts;
  const items = [];
  tasks.forEach((t) => regimes.forEach((rg) => {
    const { system, user } = build(pocketSpec, t, rg);
    for (let run = 1; run <= runs; run++) items.push({ customId: genId(t.id, rg, run), system, user });
  }));
  return items;
}

/* Repair items: one per generation that failed to parse (spec §8 stage 4, G6). */
export function planRepair(pocketSpec, failedGenerations) {
  return failedGenerations.map((g) => {
    const { system, user } = repairPrompt(pocketSpec, g.task, g.sceneText, g.diagnostics);
    return { customId: repairId(g.taskId, g.regime, g.run), system, user };
  });
}

/* Judge items: confabulation pass over every generation that parsed. */
export function planJudge(parsedGenerations) {
  return parsedGenerations.map((g) => {
    const { system, user } = judgePrompt(g.task, g.sceneText);
    return { customId: judgeId(g.taskId, g.regime, g.run), system, user };
  });
}

/* Strip a model's text response to the atomik source: drop code fences and any
 * chatter before the `atomik` pragma. Tolerant by design — a real small model
 * won't always obey "no fences". */
export function extractScene(text) {
  if (!text) return '';
  let s = text.replace(/```[a-zA-Z]*\n?/g, '').replace(/```/g, '');
  const i = s.indexOf('atomik ');
  return (i >= 0 ? s.slice(i) : s).trim();
}
