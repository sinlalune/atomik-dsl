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
import { loadPocketSpec, build } from '../eval-generability/prompt.mjs';
import { extractScene } from '../eval-generability/batch.mjs';
import * as anthropic from '../eval-generability/providers/anthropic.mjs';
import * as google from '../eval-generability/providers/google.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, '..', '..');
const HOST = '127.0.0.1';
const PORT = Number(process.env.PORT) || 4173;
const POCKET = loadPocketSpec();
const PROVIDERS = { haiku: anthropic, gemini: google };

/* --- the injected "generate" panel + wiring (drives the prototype's #src) --- */
const PANEL_STYLE = `
<style>
  #genbar{position:sticky;top:0;z-index:20;display:flex;gap:10px;align-items:flex-start;
    padding:10px 16px;background:var(--panel);border-bottom:1px solid var(--line);flex-wrap:wrap}
  #genbar textarea{flex:1;min-width:280px;min-height:52px;max-height:160px;resize:vertical;
    font:13px/1.4 -apple-system,system-ui,sans-serif;padding:8px 10px;border:1px solid var(--line);
    border-radius:8px;background:#fff;color:var(--ink)}
  #genbar .gencol{display:flex;flex-direction:column;gap:6px;min-width:150px}
  #genbar select,#genbar button{font:inherit;padding:6px 10px;border:1px solid var(--line);
    border-radius:8px;background:#fff;color:var(--ink);cursor:pointer}
  #genbar button{background:var(--accent);color:#fff;border-color:var(--accent);font-weight:600}
  #genbar button:disabled{opacity:.55;cursor:default}
  #genbar label{font-size:12px;color:var(--muted);display:flex;gap:6px;align-items:center}
  #genstatus{font-size:12px;color:var(--muted);flex-basis:100%;margin-top:2px}
  #genbar .hint{font-size:11px;color:var(--muted)}
</style>`;

const PANEL_HTML = `
<div id="genbar">
  <textarea id="gentext" placeholder="Paste an explanation or any text to teach — e.g. a paragraph about the water cycle, a misconception to correct, a process to show. A small model turns it into an atomik scene, rendered live below."></textarea>
  <div class="gencol">
    <select id="genprovider" title="which small model generates the scene">
      <option value="haiku">Haiku 4.5</option>
      <option value="gemini">Gemini 3.1 Flash-Lite</option>
    </select>
    <label><input type="checkbox" id="genteach"> teaching sequence <span class="hint">(steps + gate)</span></label>
    <button id="genbtn">Generate &amp; render</button>
  </div>
  <div id="genstatus">Paste text, pick a model, and Generate. The generated atomik appears in the Source tab below — edit it and the scene re-renders live.</div>
</div>`;

const PANEL_SCRIPT = `
<script>
(function () {
  var btn = document.getElementById('genbtn'), ta = document.getElementById('gentext'),
      sel = document.getElementById('genprovider'), teach = document.getElementById('genteach'),
      st = document.getElementById('genstatus');
  async function gen() {
    var text = ta.value.trim();
    if (!text) { st.textContent = 'Paste some text first.'; return; }
    btn.disabled = true; st.textContent = 'Generating with ' + sel.options[sel.selectedIndex].text + '…';
    try {
      var res = await fetch('/api/generate', { method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text: text, provider: sel.value, teaching: teach.checked }) });
      var j = await res.json();
      if (j.error) { st.textContent = 'Generation error: ' + j.error; btn.disabled = false; return; }
      var src = document.getElementById('src');
      src.value = j.atomik;
      src.dispatchEvent(new Event('input'));            // drives the prototype's debounced compile+render
      var tab = document.getElementById('tab-source'); if (tab) tab.click();
      st.textContent = 'Rendered — ' + j.model + ' in ' + j.took + ' ms. Edit the source below to tweak; the scene re-renders live.';
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

async function handleGenerate(req, res) {
  let payload;
  try { payload = JSON.parse(await readBody(req)); } catch { return json(res, 400, { error: 'bad JSON body' }); }
  const text = (payload.text || '').trim();
  const p = PROVIDERS[payload.provider];
  if (!text) return json(res, 400, { error: 'empty text' });
  if (!p) return json(res, 400, { error: 'unknown provider "' + payload.provider + '"' });
  if (!process.env[p.envKey]) return json(res, 500, { error: 'server missing ' + p.envKey + ' (run via `npm run demo`, with keys in .env)' });

  const task = { passage: text, vaultIndex: [], teachingSequence: !!payload.teaching, lang: 'en' };
  const item = build(POCKET, task, 'R1');
  const t0 = Date.now();
  const r = await p.generateOne(item, p.subjectModel);
  if (r.error) return json(res, 502, { error: r.error, model: r.model });
  const atomik = extractScene(r.text || '');
  if (!atomik) return json(res, 502, { error: 'model returned no atomik source', model: r.model });
  return json(res, 200, { atomik, model: r.model, took: Date.now() - t0 });
}

function json(res, code, obj) { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(obj)); }

const server = createServer(async (req, res) => {
  try {
    if (req.method === 'POST' && req.url === '/api/generate') return void await handleGenerate(req, res);
    if (req.method === 'GET' && (req.url === '/' || req.url === '/index.html')) {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); return void res.end(demoHtml());
    }
    if (req.method === 'GET' && req.url === '/health') return void json(res, 200, { ok: true, providers: Object.keys(PROVIDERS).filter((k) => process.env[PROVIDERS[k].envKey]) });
    res.writeHead(404, { 'content-type': 'text/plain' }); res.end('not found');
  } catch (e) { json(res, 500, { error: String(e && e.message || e) }); }
});

server.listen(PORT, HOST, () => {
  const keyed = Object.entries(PROVIDERS).filter(([, p]) => process.env[p.envKey]).map(([k]) => k);
  console.log('atomik generate-demo → http://' + HOST + ':' + PORT);
  console.log('  models available: ' + (keyed.length ? keyed.join(', ') : 'NONE — set keys in .env and run `npm run demo`'));
  console.log('  (localhost only; keys stay server-side)');
});
