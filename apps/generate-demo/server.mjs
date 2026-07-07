#!/usr/bin/env node
/* Local generation demo server (CP-DSL-005 / T1). Localhost-only. Reads the
 * API keys from .env SERVER-SIDE (the browser never sees a key), serves the
 * prototype renderer with a "generate from text" panel injected, and proxies a
 * single model call at POST /api/generate. The page pastes the generated atomik
 * into the prototype's source box and fires an input event, so the whole tested
 * renderer (parse → layout → present → SVG, step nav, diagnostics) runs as-is.
 * Zero deps: Node built-in http + the already-installed provider SDKs + the
 * browser-ready kernel (inlined in the prototype build).
 * Run: npm run demo   (loads .env via --env-file-if-exists; binds 127.0.0.1)
 */
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { loadPocketSpec, build } from '../eval-generability/prompt.mjs';
import { extractScene } from '../eval-generability/batch.mjs';
import * as anthropic from '../eval-generability/providers/anthropic.mjs';
import * as google from '../eval-generability/providers/google.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, '..', '..');
const A = createRequire(import.meta.url)('../../packages/dsl-core'); // server-side parse for an honest render summary
const HOST = '127.0.0.1';
const PORT = Number(process.env.PORT) || 4173;
const POCKET = loadPocketSpec();

/* Model menu — a few tiers so you can feel the difference. The lowest-tier model
 * (Flash-Lite) is often the CLEANEST here because it follows the format
 * literally; bigger models occasionally over-think. Gemini 3.x Flash are
 * reasoning models — generateOne disables thinking so they emit the scene, not
 * their reasoning. */
const MODELS = {
  'haiku': { label: 'Claude Haiku 4.5', provider: anthropic, modelId: 'claude-haiku-4-5' },
  'gemini-3.5-flash': { label: 'Gemini 3.5 Flash', provider: google, modelId: 'gemini-3.5-flash' },
  'gemini-2.5-flash': { label: 'Gemini 2.5 Flash', provider: google, modelId: 'gemini-2.5-flash' },
  'gemini-3.1-flash-lite': { label: 'Gemini 3.1 Flash-Lite', provider: google, modelId: 'gemini-3.1-flash-lite' },
  'sonnet': { label: 'Claude Sonnet 5 (bigger)', provider: anthropic, modelId: 'claude-sonnet-5' }
};
const DEFAULT_MODEL = 'haiku';

/* Best-effort fr/en hint for the SOURCE label. Output-language correctness does
 * NOT depend on this being right — the appended instruction carries it for any
 * language; this only keeps the label honest for French input. */
function detectLang(t) {
  const s = t.toLowerCase();
  const accents = (s.match(/[éèêëàâçîïôûùœ]/g) || []).length;
  const fr = (s.match(/\b(le|la|les|un|une|des|du|de|et|est|qui|que|dans|pour|avec|sur|au|aux|ce|cette|son|sa|ses|par|plus|mais|ne|pas|nous|vous|se|ou|où)\b/g) || []).length;
  const words = (s.match(/\b[\wàâäéèêëîïôûùç]+\b/g) || []).length || 1;
  return (accents > 2 || fr / words > 0.12) ? 'fr' : 'en';
}

/* Compose the model prompt: the pocket-spec R1 builder, plus demo-specific
 * clarifications learned from watching real generations — keep the source
 * language, single-token ids + exact relation shape (the errors small models
 * make most), and (teaching) keep the claim true rather than the misconception. */
function composeItem(text, teaching) {
  const task = { passage: text, vaultIndex: [], teachingSequence: teaching, lang: detectLang(text) };
  const item = build(POCKET, task, 'R1');
  item.user += '\n\nWrite the claim text, every node/evidence label, and the relation KIND words in the SAME LANGUAGE as the SOURCE above. Keep atomik keywords (scene, claim, node, relation, project, as, …) and [attribute] names in English.';
  item.user += '\n\nSTRICT SYNTAX (follow exactly): every node/evidence/relation id is a SINGLE token — letters, digits, _ or - only, NO spaces (write `oxygen_release`, not `oxygen release`). Each relation line is exactly `relation <fromId> -> <toId> <kind>` with single-token ids; the kind word(s) come AFTER the second id. `subject` takes `[[Note]]` or a "quoted string", never a bare word.';
  if (teaching) {
    item.user += '\n\nThe scene `claim` must state the CORRECT idea you are teaching (the truth) — never the misconception, and never with [status misconception]. Put the false belief in its own node with [status misconception] and refute it with a `[as refutation]` relation from the evidence.';
  }
  return item;
}

async function handleGenerate(req, res) {
  let payload;
  try { payload = JSON.parse(await readBody(req)); } catch { return json(res, 400, { error: 'bad JSON body' }); }
  const text = (payload.text || '').trim();
  const key = payload.model || DEFAULT_MODEL;
  const m = MODELS[key];
  if (!text) return json(res, 400, { error: 'empty text' });
  if (!m) return json(res, 400, { error: 'unknown model "' + key + '"' });
  if (!process.env[m.provider.envKey]) return json(res, 500, { error: 'server missing ' + m.provider.envKey + ' (run `npm run demo` with keys in .env)' });

  const t0 = Date.now();
  const r = await m.provider.generateOne(composeItem(text, !!payload.teaching), m.modelId);
  if (r.error) return json(res, 502, { error: r.error, model: m.label });
  const atomik = extractScene(r.text || '');
  if (!atomik) return json(res, 502, { error: 'model returned no atomik source', model: m.label });

  // server-side parse for an honest summary: partial validity means the scene
  // usually renders even when a line or two is skipped — say so, don't alarm.
  const ir = A.parse(atomik);
  const errCount = ir.diagnostics.filter((d) => d.severity === 'error').length;
  return json(res, 200, {
    atomik, model: m.label, took: Math.max(0, Date.now() - t0), // clamp: guards against VM clock skew
    nodes: ir.nodes.length, relations: ir.relations.length,
    errorCount: errCount, renders: ir.nodes.length > 0
  });
}

/* --- injected "generate" panel + wiring (drives the prototype's #src) --- */
const PANEL_STYLE = `
<style>
  #genbar{position:sticky;top:0;z-index:20;display:flex;gap:10px;align-items:flex-start;
    padding:10px 16px;background:var(--panel);border-bottom:1px solid var(--line);flex-wrap:wrap}
  #genbar textarea{flex:1;min-width:280px;min-height:52px;max-height:160px;resize:vertical;
    font:13px/1.4 -apple-system,system-ui,sans-serif;padding:8px 10px;border:1px solid var(--line);
    border-radius:8px;background:#fff;color:var(--ink)}
  #genbar .gencol{display:flex;flex-direction:column;gap:6px;min-width:190px}
  #genbar select,#genbar button{font:inherit;padding:6px 10px;border:1px solid var(--line);
    border-radius:8px;background:#fff;color:var(--ink);cursor:pointer}
  #genbar button{background:var(--accent);color:#fff;border-color:var(--accent);font-weight:600}
  #genbar button:disabled{opacity:.55;cursor:default}
  #genbar label{font-size:12px;color:var(--muted);display:flex;gap:6px;align-items:center}
  #genstatus{font-size:12px;color:var(--muted);flex-basis:100%;margin-top:2px}
  #genbar .hint{font-size:11px;color:var(--muted)}
</style>`;

const MODEL_OPTIONS = Object.entries(MODELS)
  .map(([k, m]) => '<option value="' + k + '"' + (k === DEFAULT_MODEL ? ' selected' : '') + '>' + m.label + '</option>').join('');

const PANEL_HTML = `
<div id="genbar">
  <textarea id="gentext" placeholder="Paste an explanation or any text to teach — a paragraph on the water cycle, a misconception to correct, a process to show. A small model turns it into an atomik scene, rendered live below (⌘/Ctrl-Enter to generate)."></textarea>
  <div class="gencol">
    <select id="genmodel" title="which model generates the scene">${MODEL_OPTIONS}</select>
    <label><input type="checkbox" id="genteach"> teaching sequence <span class="hint">(steps + gate)</span></label>
    <button id="genbtn">Generate &amp; render</button>
  </div>
  <div id="genstatus">Paste text, pick a model, and Generate. The atomik lands in the Source tab below — edit it and the scene re-renders live. Diagnostics there are usually non-fatal (the scene still renders).</div>
</div>`;

const PANEL_SCRIPT = `
<script>
(function () {
  var btn = document.getElementById('genbtn'), ta = document.getElementById('gentext'),
      sel = document.getElementById('genmodel'), teach = document.getElementById('genteach'),
      st = document.getElementById('genstatus');
  async function gen() {
    var text = ta.value.trim();
    if (!text) { st.textContent = 'Paste some text first.'; return; }
    btn.disabled = true; st.textContent = 'Generating with ' + sel.options[sel.selectedIndex].text + '…';
    try {
      var res = await fetch('/api/generate', { method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text: text, model: sel.value, teaching: teach.checked }) });
      var j = await res.json();
      if (j.error) { st.textContent = 'Generation error (' + (j.model || sel.value) + '): ' + j.error; btn.disabled = false; return; }
      var src = document.getElementById('src');
      src.value = j.atomik;
      src.dispatchEvent(new Event('input'));                       // drives the prototype's debounced compile+render
      var tab = document.getElementById('tab-source'); if (tab) tab.click();
      var summary = j.nodes + ' nodes, ' + j.relations + ' relations';
      if (j.errorCount) summary += ' — ' + j.errorCount + ' line(s) skipped (non-fatal; the scene still rendered — see Diagnostics)';
      st.textContent = 'Rendered by ' + j.model + ' in ' + j.took + ' ms — ' + summary + '. Edit the source below to tweak.';
    } catch (e) { st.textContent = 'Request failed: ' + e.message; }
    btn.disabled = false;
  }
  btn.addEventListener('click', gen);
  ta.addEventListener('keydown', function (e) { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') gen(); });
})();
</script>`;

function demoHtml() {
  let html = readFileSync(join(repo, 'apps', 'prototype-cycle', 'index.html'), 'utf8');
  html = html.replace('</head>', PANEL_STYLE + '\n</head>');
  html = html.replace('<body>', '<body>\n' + PANEL_HTML);
  html = html.replace('</body>', PANEL_SCRIPT + '\n</body>');
  return html;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let b = ''; req.on('data', (c) => { b += c; if (b.length > 1e6) req.destroy(); });
    req.on('end', () => resolve(b)); req.on('error', reject);
  });
}
function json(res, code, obj) { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(obj)); }

const server = createServer(async (req, res) => {
  try {
    if (req.method === 'POST' && req.url === '/api/generate') return void await handleGenerate(req, res);
    if (req.method === 'GET' && (req.url === '/' || req.url === '/index.html')) {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); return void res.end(demoHtml());
    }
    if (req.method === 'GET' && req.url === '/health') {
      return void json(res, 200, { ok: true, models: Object.entries(MODELS).filter(([, m]) => process.env[m.provider.envKey]).map(([k]) => k) });
    }
    res.writeHead(404, { 'content-type': 'text/plain' }); res.end('not found');
  } catch (e) { json(res, 500, { error: String(e && e.message || e) }); }
});

server.listen(PORT, HOST, () => {
  const keyed = Object.entries(MODELS).filter(([, m]) => process.env[m.provider.envKey]).map(([, m]) => m.label);
  console.log('atomik generate-demo → http://' + HOST + ':' + PORT);
  console.log('  models: ' + (keyed.length ? keyed.join(', ') : 'NONE — set keys in .env and run `npm run demo`'));
  console.log('  (localhost only; keys stay server-side)');
});
