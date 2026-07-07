/* Message Batches request bodies + response parsing (CP-DSL-003). Body-building
 * and parsing are pure and dependency-free; the live submit path dynamically
 * imports the official SDK so dry-run and scoring never require node_modules.
 * custom_id scheme (results arrive unordered — always key by it):
 *   gen:<taskId>:<regime>:<run>   repair:<taskId>:<regime>:<run>   judge:<taskId>:<regime>:<run>
 */
import { build, repairPrompt, judgePrompt } from './prompt.mjs';

const MAX_TOKENS = 1400; // a scene is small; caps cost and runaway output

function req(customId, system, user, model) {
  return {
    custom_id: customId,
    params: {
      model,
      max_tokens: MAX_TOKENS,
      system,
      messages: [{ role: 'user', content: user }]
    }
  };
}

export function genId(taskId, regime, run) { return 'gen:' + taskId + ':' + regime + ':' + run; }
export function repairId(taskId, regime, run) { return 'repair:' + taskId + ':' + regime + ':' + run; }
export function judgeId(taskId, regime, run) { return 'judge:' + taskId + ':' + regime + ':' + run; }
export function parseId(id) { const [kind, taskId, regime, run] = id.split(':'); return { kind, taskId, regime, run: Number(run) }; }

/* Full generation matrix: tasks × regimes × runs. */
export function buildGenerationBatch(pocketSpec, tasks, opts) {
  const { regimes, runs, model } = opts;
  const out = [];
  tasks.forEach((t) => regimes.forEach((rg) => {
    const { system, user } = build(pocketSpec, t, rg);
    for (let run = 1; run <= runs; run++) out.push(req(genId(t.id, rg, run), system, user, model));
  }));
  return out;
}

/* Repair batch: one request per generation that failed to parse cleanly. */
export function buildRepairBatch(pocketSpec, failedGenerations, model) {
  // failedGenerations: [{ taskId, regime, run, task, sceneText, diagnostics }]
  return failedGenerations.map((g) => {
    const { system, user } = repairPrompt(pocketSpec, g.task, g.sceneText, g.diagnostics);
    return req(repairId(g.taskId, g.regime, g.run), system, user, model);
  });
}

/* Judge batch: confabulation pass over every generation that parsed. */
export function buildJudgeBatch(parsedGenerations, judgeModel) {
  // parsedGenerations: [{ taskId, regime, run, task, sceneText }]
  return parsedGenerations.map((g) => {
    const { system, user } = judgePrompt(g.task, g.sceneText);
    return req(judgeId(g.taskId, g.regime, g.run), system, user, judgeModel);
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

/* Parse Batches results JSONL into custom_id -> { text|null, error }. */
export function parseResultsJsonl(jsonl) {
  const map = {};
  jsonl.split(/\r?\n/).filter((l) => l.trim()).forEach((line) => {
    const r = JSON.parse(line);
    const res = r.result;
    if (res && res.type === 'succeeded') {
      const blocks = res.message.content || [];
      const text = blocks.filter((b) => b.type === 'text').map((b) => b.text).join('');
      map[r.custom_id] = { text, error: null };
    } else {
      map[r.custom_id] = { text: null, error: (res && res.type) || 'unknown' };
    }
  });
  return map;
}

/* Live submit — used only at S04. Dynamically imports the SDK so the rest of
 * the harness stays dependency-free. Returns the results as a custom_id map. */
export async function submitBatch(requests, { pollMs = 20000, log = () => {} } = {}) {
  const { default: Anthropic } = await import('@anthropic-ai/sdk'); // root devDependency, installed at S04
  const client = new Anthropic();
  const batch = await client.messages.batches.create({ requests });
  log('batch created: ' + batch.id + ' (' + requests.length + ' requests)');
  for (;;) {
    const b = await client.messages.batches.retrieve(batch.id);
    if (b.processing_status === 'ended') break;
    log('  status=' + b.processing_status + ' processing=' + b.request_counts.processing);
    await new Promise((r) => setTimeout(r, pollMs));
  }
  const map = {};
  for await (const result of await client.messages.batches.results(batch.id)) {
    if (result.result.type === 'succeeded') {
      const text = (result.result.message.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('');
      map[result.custom_id] = { text, error: null };
    } else {
      map[result.custom_id] = { text: null, error: result.result.type };
    }
  }
  return { batchId: batch.id, results: map };
}
