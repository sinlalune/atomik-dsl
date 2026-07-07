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

/* plan item -> inline request body (model is set on the batch job, not here).
 * metadata.key carries our custom_id: InlinedResponse echoes metadata back, and
 * — critically — Gemini's inline batch does NOT guarantee response order, so we
 * correlate by this key, never by index (learned the hard way, 2026-07-07). */
export function toRequest(item) {
  return {
    contents: [{ parts: [{ text: item.user }], role: 'user' }],
    metadata: { key: item.customId },
    config: {
      systemInstruction: { parts: [{ text: item.system }] },
      maxOutputTokens: MAX_TOKENS
    }
  };
}

export function toRequests(items) { return items.map(toRequest); }

/* Extract generated text from a batch inline response. NOTE: the SDK's
 * `.text` convenience getter is only populated on live generateContent objects;
 * a BATCH-retrieved response is a plain deserialized object, so the text lives
 * at response.candidates[0].content.parts[].text (verified against a real
 * SUCCEEDED job, 2026-07-07). Fall back to `.text` if a future shape provides it. */
function textFromResponse(resp) {
  if (!resp) return null;
  const cand = resp.candidates && resp.candidates[0];
  const parts = cand && cand.content && cand.content.parts;
  if (parts && parts.length) { const t = parts.map((p) => p.text || '').join(''); if (t) return t; }
  if (typeof resp.text === 'string' && resp.text) return resp.text;
  return null;
}

function recordFor(ir) {
  const txt = ir ? textFromResponse(ir.response) : null;
  if (txt) return { text: txt, error: null };
  if (ir && ir.error) return { text: null, error: String(ir.error) };
  if (ir && ir.response) {
    const fr = ir.response.candidates && ir.response.candidates[0] && ir.response.candidates[0].finishReason;
    return { text: null, error: 'no-text' + (fr ? ':' + fr : '') }; // e.g. MAX_TOKENS / SAFETY
  }
  return { text: null, error: 'missing' };
}

/* Correlate a finished job's inlinedResponses to custom_ids by the echoed
 * metadata.key (order-independent — Gemini does not guarantee inline output
 * order). Falls back to positional matching only if no key was echoed (older
 * requests). Pure, so it is unit-testable against a canned job object. */
export function parseInlineResponses(job, customIds) {
  const responses = (job && job.dest && job.dest.inlinedResponses) || [];
  const byKey = {};
  let keyed = 0;
  responses.forEach((ir, i) => {
    const key = ir && ir.metadata && ir.metadata.key;
    if (key) { byKey[key] = recordFor(ir); keyed++; }
    else byKey['__idx_' + i] = recordFor(ir);
  });
  const useKeys = keyed > 0;
  const map = {};
  customIds.forEach((cid, i) => {
    map[cid] = (useKeys ? byKey[cid] : byKey['__idx_' + i]) || { text: null, error: 'missing' };
  });
  return map;
}

export { textFromResponse };

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
