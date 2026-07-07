/* Anthropic provider adapter (CP-DSL-003). Turns vendor-neutral plan items
 * into Message Batches request bodies, parses results, and (live path only)
 * submits via the official SDK — dynamically imported so scoring/dry-run never
 * load node_modules. Batches key by custom_id; results arrive unordered. */
import { MAX_TOKENS } from '../batch.mjs';

export const name = 'anthropic';
export const subjectModel = 'claude-haiku-4-5';
export const judgeModel = 'claude-sonnet-5';
export const envKey = 'ANTHROPIC_API_KEY';
export const sdkPackage = '@anthropic-ai/sdk';

/* plan item -> Batches request body */
export function toRequest(item, model) {
  return {
    custom_id: item.customId,
    params: {
      model,
      max_tokens: MAX_TOKENS,
      system: item.system,
      messages: [{ role: 'user', content: item.user }]
    }
  };
}

export function toRequests(items, model) { return items.map((it) => toRequest(it, model)); }

/* Batches results JSONL -> { custom_id: { text|null, error } } */
export function parseResultsJsonl(jsonl) {
  const map = {};
  jsonl.split(/\r?\n/).filter((l) => l.trim()).forEach((line) => {
    const r = JSON.parse(line);
    const res = r.result;
    if (res && res.type === 'succeeded') {
      const text = (res.message.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('');
      map[r.custom_id] = { text, error: null };
    } else {
      map[r.custom_id] = { text: null, error: (res && res.type) || 'unknown' };
    }
  });
  return map;
}

/* live submit — used only at S04. Returns { text, error } keyed by custom_id. */
export async function submit(items, model, { pollMs = 20000, log = () => {} } = {}) {
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const client = new Anthropic();
  const requests = toRequests(items, model);
  const batch = await client.messages.batches.create({ requests });
  log('[anthropic] batch ' + batch.id + ' (' + requests.length + ' requests)');
  for (;;) {
    const b = await client.messages.batches.retrieve(batch.id);
    if (b.processing_status === 'ended') break;
    log('  [anthropic] status=' + b.processing_status + ' processing=' + b.request_counts.processing);
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
