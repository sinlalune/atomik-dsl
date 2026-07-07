/* Google Gemini provider adapter (CP-DSL-003). Shape verified against
 * ai.google.dev/gemini-api/docs/batch-api (2026-07-07): inline batch requests
 * carry systemInstruction + maxOutputTokens in `config`; created via
 * ai.batches.create({model, src, config}); polled on batchJob.state; results at
 * batchJob.dest.inlinedResponses[i].response.text | .error.
 *
 * KEY DIFFERENCE from Anthropic: inline requests have NO correlation key —
 * results come back in REQUEST ORDER and must be zipped by index. This adapter
 * therefore keeps a parallel customId array and matches by position. The SDK is
 * dynamically imported so scoring/dry-run never load node_modules. */
import { MAX_TOKENS } from '../batch.mjs';

export const name = 'google';
export const subjectModel = 'gemini-3.1-flash-lite';
export const judgeModel = 'claude-sonnet-5'; // judge stays Anthropic (owner decision); routed via the anthropic provider
export const envKey = 'GEMINI_API_KEY';
export const sdkPackage = '@google/genai';

const DONE_STATES = ['JOB_STATE_SUCCEEDED', 'JOB_STATE_FAILED', 'JOB_STATE_CANCELLED', 'JOB_STATE_EXPIRED'];

/* plan item -> inline request body (model is set on the batch job, not here) */
export function toRequest(item) {
  return {
    contents: [{ parts: [{ text: item.user }], role: 'user' }],
    config: {
      systemInstruction: { parts: [{ text: item.system }] },
      maxOutputTokens: MAX_TOKENS
    }
  };
}

export function toRequests(items) { return items.map(toRequest); }

/* Zip a finished job's inlinedResponses back to custom_ids by index (order
 * matching — inline responses carry no key). Pure, so it is unit-testable
 * against a canned job object without the SDK. */
export function parseInlineResponses(job, customIds) {
  const map = {};
  const responses = (job && job.dest && job.dest.inlinedResponses) || [];
  customIds.forEach((cid, i) => {
    const ir = responses[i];
    if (ir && ir.response && typeof ir.response.text === 'string') map[cid] = { text: ir.response.text, error: null };
    else if (ir && ir.error) map[cid] = { text: null, error: String(ir.error) };
    else map[cid] = { text: null, error: 'missing' };
  });
  return map;
}

/* live submit — used only at S04. Returns { text, error } keyed by custom_id. */
export async function submit(items, model, { pollMs = 20000, log = () => {} } = {}) {
  const { GoogleGenAI } = await import('@google/genai');
  const ai = new GoogleGenAI({}); // reads GEMINI_API_KEY from env
  const src = toRequests(items);
  const customIds = items.map((it) => it.customId); // parallel array — the correlation is positional
  let job = await ai.batches.create({ model, src, config: { displayName: 'atomik-eval-' + Date.now() } });
  log('[google] batch ' + job.name + ' (' + src.length + ' requests)');
  for (;;) {
    job = await ai.batches.get({ name: job.name });
    if (DONE_STATES.indexOf(job.state) >= 0) break;
    log('  [google] state=' + job.state);
    await new Promise((r) => setTimeout(r, pollMs));
  }
  if (job.state !== 'JOB_STATE_SUCCEEDED') {
    // whole job failed/expired — mark every request errored so the scorer records it
    const map = {};
    customIds.forEach((cid) => { map[cid] = { text: null, error: job.state }; });
    return { batchId: job.name, results: map };
  }
  return { batchId: job.name, results: parseInlineResponses(job, customIds) };
}
