#!/usr/bin/env node
/* Local generation demo server (CP-DSL-005 / T1). Localhost-only. Reads the
 * API keys from .env SERVER-SIDE (the browser never sees a key), serves the
 * prototype renderer with a "generate from text" panel injected, and proxies a
 * single model call at POST /api/generate. The page pastes the generated atomik
 * into the prototype's source box and fires an input event, so the whole tested
 * renderer (parse → layout → present → SVG, step nav, diagnostics) runs as-is.
 * Adds zoom/pan on the scene and a save library (model + metadata + prompt +
 * source + IR + diagnostics per run) that the demo lists and reloads.
 * Zero deps: Node built-in http + installed provider SDKs + the browser-ready
 * kernel (inlined in the prototype build).
 * Run: npm run demo   (loads .env via --env-file-if-exists; binds 127.0.0.1)
 */
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { loadPocketSpec, build } from '../eval-generability/prompt.mjs';
import { extractScene } from '../eval-generability/batch.mjs';
import * as anthropic from '../eval-generability/providers/anthropic.mjs';
import * as google from '../eval-generability/providers/google.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, '..', '..');
const SAVE_DIR = join(here, 'saved');
const A = createRequire(import.meta.url)('../../packages/dsl-core'); // server-side parse for IR/diagnostics + render summary
const HOST = '127.0.0.1';
const PORT = Number(process.env.PORT) || 4173;
const POCKET = loadPocketSpec();

const MODELS = {
  'haiku': { label: 'Claude Haiku 4.5', provider: anthropic, modelId: 'claude-haiku-4-5' },
  'gemini-3.5-flash': { label: 'Gemini 3.5 Flash', provider: google, modelId: 'gemini-3.5-flash' },
  'gemini-2.5-flash': { label: 'Gemini 2.5 Flash', provider: google, modelId: 'gemini-2.5-flash' },
  'gemini-3.1-flash-lite': { label: 'Gemini 3.1 Flash-Lite', provider: google, modelId: 'gemini-3.1-flash-lite' },
  'sonnet': { label: 'Claude Sonnet 5 (bigger)', provider: anthropic, modelId: 'claude-sonnet-5' }
};
const DEFAULT_MODEL = 'haiku';

function detectLang(t) {
  const s = t.toLowerCase();
  const accents = (s.match(/[éèêëàâçîïôûùœ]/g) || []).length;
  const fr = (s.match(/\b(le|la|les|un|une|des|du|de|et|est|qui|que|dans|pour|avec|sur|au|aux|ce|cette|son|sa|ses|par|plus|mais|ne|pas|nous|vous|se|ou|où)\b/g) || []).length;
  const words = (s.match(/\b[\wàâäéèêëîïôûùç]+\b/g) || []).length || 1;
  return (accents > 2 || fr / words > 0.12) ? 'fr' : 'en';
}

/* Compose the model prompt: pocket-spec R1 builder + demo-specific clarifications
 * learned from watching real generations (keep source language; single-token ids
 * + exact relation shape; quoted/[[…]] subject; teaching: claim = the truth). */
function composeItem(text, teaching) {
  const task = { passage: text, vaultIndex: [], teachingSequence: teaching, lang: detectLang(text) };
  const item = build(POCKET, task, 'R1');
  item.user += '\n\nWrite the claim text, every node/evidence label, and the relation KIND words in the SAME LANGUAGE as the SOURCE above. Keep atomik keywords (scene, claim, node, relation, project, as, …) and [attribute] names in English.';
  item.user += '\n\nSTRICT SYNTAX (follow exactly): every node/evidence/relation id is a SINGLE token — letters, digits, _ or - only, NO spaces (write `oxygen_release`, not `oxygen release`). Each relation line is exactly `relation <fromId> -> <toId> <kind>` with single-token ids; the kind word(s) come AFTER the second id. `subject` takes `[[Note]]` or a "quoted string", never a bare word.';
  if (teaching) item.user += '\n\nThe scene `claim` must state the CORRECT idea you are teaching (the truth) — never the misconception, and never with [status misconception]. Put the false belief in its own node with [status misconception] and refute it with a `[as refutation]` relation from the evidence.';
  return item;
}

function slugify(t) {
  return (t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40)) || 'scene';
}
const okId = (id) => /^[\w.\-]+$/.test(id) && !id.includes('..');

/* -------- generation -------- */
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
  const ir = A.parse(atomik);
  return json(res, 200, {
    atomik, model: m.label, took: Math.max(0, Date.now() - t0),
    nodes: ir.nodes.length, relations: ir.relations.length,
    errorCount: ir.diagnostics.filter((d) => d.severity === 'error').length, renders: ir.nodes.length > 0
  });
}

/* -------- save library (folder read back by the demo) -------- */
async function handleSave(req, res) {
  let p;
  try { p = JSON.parse(await readBody(req)); } catch { return json(res, 400, { error: 'bad JSON body' }); }
  const text = (p.text || '').trim();
  const atomik = (p.atomik || '').trim();
  const key = p.model || DEFAULT_MODEL;
  const m = MODELS[key];
  if (!text || !atomik) return json(res, 400, { error: 'need both the input text and the atomik source' });
  if (!m) return json(res, 400, { error: 'unknown model "' + key + '"' });

  const ir = A.parse(atomik);
  const diagnostics = ir.diagnostics;
  const savedAt = new Date().toISOString();
  const id = savedAt.replace(/[:.]/g, '-') + '_' + key + '_' + slugify(text);
  const record = {
    id, savedAt,
    model: { key, label: m.label, id: m.modelId },
    teaching: !!p.teaching,
    metadata: { nodes: ir.nodes.length, relations: ir.relations.length, errorCount: diagnostics.filter((d) => d.severity === 'error').length, took: p.took || null },
    prompt: composeItem(text, !!p.teaching),   // exactly what was sent (system = pocket spec, user = instruction+source)
    inputText: text,
    source: atomik,
    ir,
    diagnostics
  };
  mkdirSync(SAVE_DIR, { recursive: true });
  writeFileSync(join(SAVE_DIR, id + '.json'), JSON.stringify(record, null, 2));
  return json(res, 200, { id, savedAt });
}

function listSaved() {
  if (!existsSync(SAVE_DIR)) return [];
  return readdirSync(SAVE_DIR).filter((f) => f.endsWith('.json')).map((f) => {
    try {
      const r = JSON.parse(readFileSync(join(SAVE_DIR, f), 'utf8'));
      return { id: r.id, savedAt: r.savedAt, model: r.model.label, teaching: r.teaching, nodes: r.metadata.nodes, errorCount: r.metadata.errorCount, inputPreview: (r.inputText || '').slice(0, 60) };
    } catch { return null; }
  }).filter(Boolean).sort((a, b) => (a.savedAt < b.savedAt ? 1 : -1));
}

function handleGetSaved(res, id) {
  if (!okId(id)) return json(res, 400, { error: 'bad id' });
  const file = join(SAVE_DIR, basename(id) + '.json');
  if (!existsSync(file)) return json(res, 404, { error: 'not found' });
  res.writeHead(200, { 'content-type': 'application/json' }); res.end(readFileSync(file, 'utf8'));
}

/* -------- injected panel (generate + save + saved list + zoom) -------- */
const PANEL_STYLE = `
<style>
  #genbar{position:sticky;top:0;z-index:20;display:flex;gap:10px;align-items:flex-start;
    padding:10px 16px;background:var(--panel);border-bottom:1px solid var(--line);flex-wrap:wrap}
  #genbar textarea{flex:1;min-width:280px;min-height:52px;max-height:160px;resize:vertical;
    font:13px/1.4 -apple-system,system-ui,sans-serif;padding:8px 10px;border:1px solid var(--line);
    border-radius:8px;background:#fff;color:var(--ink)}
  #genbar .gencol{display:flex;flex-direction:column;gap:6px;min-width:210px}
  #genbar select,#genbar button{font:inherit;padding:6px 10px;border:1px solid var(--line);
    border-radius:8px;background:#fff;color:var(--ink);cursor:pointer}
  #genbar .primary{background:var(--accent);color:#fff;border-color:var(--accent);font-weight:600}
  #genbar button:disabled{opacity:.55;cursor:default}
  #genbar .genrow{display:flex;gap:6px}
  #genbar label{font-size:12px;color:var(--muted);display:flex;gap:6px;align-items:center}
  #genstatus{font-size:12px;color:var(--muted);flex-basis:100%;margin-top:2px}
  #genbar .hint{font-size:11px;color:var(--muted)}
  /* fixed to the viewport — NOT inside #stage — so the render observer never
     sees its text updates (that caused an infinite loop) and re-renders can't
     wipe it. */
  #genzoom{position:fixed;right:24px;bottom:22px;z-index:40;display:flex;gap:4px;align-items:center;
    background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:3px 5px;
    box-shadow:0 1px 6px #0002}
  #genzoom button{font:inherit;width:26px;height:26px;padding:0;border:1px solid var(--line);
    border-radius:6px;background:#fff;color:var(--ink);cursor:pointer;line-height:1}
  #genzoom span{font-size:11px;color:var(--muted);min-width:38px;text-align:center}
  svg.scene{cursor:grab}
  svg.scene.grabbing{cursor:grabbing}
</style>`;

const MODEL_OPTIONS = Object.entries(MODELS)
  .map(([k, m]) => '<option value="' + k + '"' + (k === DEFAULT_MODEL ? ' selected' : '') + '>' + m.label + '</option>').join('');

const PANEL_HTML = `
<div id="genbar">
  <textarea id="gentext" placeholder="Paste an explanation or any text to teach — a paragraph on the water cycle, a misconception to correct, a process to show. A small model turns it into an atomik scene, rendered live below (⌘/Ctrl-Enter to generate)."></textarea>
  <div class="gencol">
    <select id="genmodel" title="which model generates the scene">${MODEL_OPTIONS}</select>
    <label><input type="checkbox" id="genteach"> teaching sequence <span class="hint">(steps + gate)</span></label>
    <div class="genrow">
      <button id="genbtn" class="primary">Generate &amp; render</button>
      <button id="gensave" title="save model + prompt + source + IR + diagnostics to the saved/ folder">Save</button>
    </div>
    <select id="gensaved" title="reload a saved run"><option value="">— saved runs —</option></select>
  </div>
  <div id="genstatus">Paste text, pick a model, and Generate. The atomik lands in the Source tab below — edit it and the scene re-renders live. Diagnostics there are usually non-fatal (the scene still renders). Zoom/pan the scene with the wheel and drag.</div>
</div>`;

const PANEL_SCRIPT = `
<script>
(function () {
  var btn = document.getElementById('genbtn'), save = document.getElementById('gensave'),
      ta = document.getElementById('gentext'), sel = document.getElementById('genmodel'),
      teach = document.getElementById('genteach'), saved = document.getElementById('gensaved'),
      st = document.getElementById('genstatus');
  var last = { nodes: 0, relations: 0, errorCount: 0 };

  function applySource(atomik) { var src = document.getElementById('src'); src.value = atomik; src.dispatchEvent(new Event('input')); var t = document.getElementById('tab-source'); if (t) t.click(); }

  async function gen() {
    var text = ta.value.trim();
    if (!text) { st.textContent = 'Paste some text first.'; return; }
    btn.disabled = true; st.textContent = 'Generating with ' + sel.options[sel.selectedIndex].text + '…';
    try {
      var res = await fetch('/api/generate', { method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text: text, model: sel.value, teaching: teach.checked }) });
      var j = await res.json();
      if (j.error) { st.textContent = 'Generation error (' + (j.model || sel.value) + '): ' + j.error; btn.disabled = false; return; }
      resetZoom(); applySource(j.atomik);
      last = { nodes: j.nodes, relations: j.relations, errorCount: j.errorCount, took: j.took };
      var summary = j.nodes + ' nodes, ' + j.relations + ' relations';
      if (j.errorCount) summary += ' — ' + j.errorCount + ' line(s) skipped (non-fatal; the scene still rendered — see Diagnostics)';
      st.textContent = 'Rendered by ' + j.model + ' in ' + j.took + ' ms — ' + summary + '. Edit the source or Save it.';
    } catch (e) { st.textContent = 'Request failed: ' + e.message; }
    btn.disabled = false;
  }

  async function doSave() {
    var text = ta.value.trim(), atomik = document.getElementById('src').value.trim();
    if (!text || !atomik) { st.textContent = 'Generate something first, then Save.'; return; }
    save.disabled = true;
    try {
      var res = await fetch('/api/save', { method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text: text, model: sel.value, teaching: teach.checked, atomik: atomik, took: last.took }) });
      var j = await res.json();
      if (j.error) { st.textContent = 'Save failed: ' + j.error; }
      else { st.textContent = 'Saved → saved/' + j.id + '.json (model, prompt, source, IR, diagnostics).'; await loadList(); }
    } catch (e) { st.textContent = 'Save request failed: ' + e.message; }
    save.disabled = false;
  }

  async function loadList() {
    try {
      var res = await fetch('/api/saved'); var arr = await res.json();
      saved.innerHTML = '<option value="">— saved runs (' + arr.length + ') —</option>' +
        arr.map(function (r) {
          var when = (r.savedAt || '').replace('T', ' ').slice(0, 16);
          return '<option value="' + r.id + '">' + when + ' · ' + r.model + (r.teaching ? ' · teach' : '') +
                 ' · ' + (r.errorCount ? r.errorCount + ' diag' : 'clean') + ' · ' + esc(r.inputPreview) + '…</option>';
        }).join('');
    } catch (e) { /* saved folder may not exist yet */ }
  }
  function esc(s) { return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  saved.addEventListener('change', async function () {
    if (!saved.value) return;
    try {
      var res = await fetch('/api/saved/' + encodeURIComponent(saved.value)); var r = await res.json();
      if (r.error) { st.textContent = 'Load failed: ' + r.error; return; }
      ta.value = r.inputText || ''; teach.checked = !!r.teaching;
      if (r.model && MODELhas(r.model.key)) sel.value = r.model.key;
      resetZoom(); applySource(r.source);
      st.textContent = 'Loaded saved run · ' + r.model.label + ' · ' + r.metadata.nodes + ' nodes · ' +
        (r.metadata.errorCount ? r.metadata.errorCount + ' diagnostics' : 'clean') + ' · ' + (r.savedAt || '').slice(0, 16).replace('T', ' ');
    } catch (e) { st.textContent = 'Load request failed: ' + e.message; }
  });
  function MODELhas(k) { return Array.prototype.some.call(sel.options, function (o) { return o.value === k; }); }

  /* ---- zoom / pan on the rendered scene ---- */
  var scale = 1, tx = 0, ty = 0, stage = document.getElementById('stage');
  function curSvg() { return stage ? stage.querySelector('svg.scene') : null; }
  function applyZoom() {
    var s = curSvg(); if (s) { s.style.transformOrigin = '0 0'; s.style.transform = 'translate(' + tx + 'px,' + ty + 'px) scale(' + scale + ')'; }
    var lvl = document.getElementById('genzoomlvl'); if (lvl) lvl.textContent = Math.round(scale * 100) + '%';
  }
  function resetZoom() { scale = 1; tx = 0; ty = 0; applyZoom(); }
  function zoomBy(factor, cx, cy) {
    var s = curSvg(); if (!s) return;
    var rect = s.getBoundingClientRect();
    if (cx == null) { cx = rect.left + rect.width / 2; cy = rect.top + rect.height / 2; }
    tx += (cx - rect.left) * (1 - factor); ty += (cy - rect.top) * (1 - factor); scale *= factor;
    scale = Math.min(8, Math.max(0.2, scale)); applyZoom();
  }
  if (stage) {
    stage.addEventListener('wheel', function (e) { if (!curSvg()) return; e.preventDefault(); zoomBy(e.deltaY < 0 ? 1.12 : 1 / 1.12, e.clientX, e.clientY); }, { passive: false });
    var dragging = false, lx = 0, ly = 0;
    stage.addEventListener('mousedown', function (e) { if (!curSvg() || e.button !== 0) return; dragging = true; lx = e.clientX; ly = e.clientY; curSvg().classList.add('grabbing'); e.preventDefault(); });
    window.addEventListener('mousemove', function (e) { if (!dragging) return; tx += e.clientX - lx; ty += e.clientY - ly; lx = e.clientX; ly = e.clientY; applyZoom(); });
    window.addEventListener('mouseup', function () { dragging = false; var s = curSvg(); if (s) s.classList.remove('grabbing'); });
    // re-apply the current transform whenever the prototype replaces the SVG on
    // live edits. Safe from self-triggering: applyZoom only sets the svg's style
    // (an attribute, not observed) and the zoom-level text (which lives OUTSIDE
    // #stage, on document.body), so it never mutates the observed subtree.
    new MutationObserver(function () { applyZoom(); }).observe(stage, { childList: true, subtree: true });
    var zc = document.createElement('div'); zc.id = 'genzoom';
    zc.innerHTML = '<button id="genzoomout" title="zoom out">−</button><span id="genzoomlvl">100%</span>' +
      '<button id="genzoomin" title="zoom in">+</button><button id="genzoomreset" title="reset view">⌂</button>';
    document.body.appendChild(zc);
    document.getElementById('genzoomin').addEventListener('click', function () { zoomBy(1.2); });
    document.getElementById('genzoomout').addEventListener('click', function () { zoomBy(1 / 1.2); });
    document.getElementById('genzoomreset').addEventListener('click', resetZoom);
  }

  btn.addEventListener('click', gen);
  save.addEventListener('click', doSave);
  ta.addEventListener('keydown', function (e) { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') gen(); });
  loadList();
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
    let b = ''; req.on('data', (c) => { b += c; if (b.length > 4e6) req.destroy(); });
    req.on('end', () => resolve(b)); req.on('error', reject);
  });
}
function json(res, code, obj) { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(obj)); }

const server = createServer(async (req, res) => {
  try {
    if (req.method === 'POST' && req.url === '/api/generate') return void await handleGenerate(req, res);
    if (req.method === 'POST' && req.url === '/api/save') return void await handleSave(req, res);
    if (req.method === 'GET' && req.url === '/api/saved') return void json(res, 200, listSaved());
    if (req.method === 'GET' && req.url.startsWith('/api/saved/')) return void handleGetSaved(res, decodeURIComponent(req.url.slice('/api/saved/'.length)));
    if (req.method === 'GET' && (req.url === '/' || req.url === '/index.html')) {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); return void res.end(demoHtml());
    }
    if (req.method === 'GET' && req.url === '/health') {
      return void json(res, 200, { ok: true, models: Object.entries(MODELS).filter(([, m]) => process.env[m.provider.envKey]).map(([k]) => k), saved: listSaved().length });
    }
    res.writeHead(404, { 'content-type': 'text/plain' }); res.end('not found');
  } catch (e) { json(res, 500, { error: String(e && e.message || e) }); }
});

server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') {
    console.error('\nPort ' + PORT + ' is already in use — a demo is probably already running.');
    console.error('  → open http://' + HOST + ':' + PORT + '  ·  or stop the other process  ·  or pick another port:  PORT=4180 npm run demo\n');
    process.exit(1);
  }
  console.error(e); process.exit(1);
});

server.listen(PORT, HOST, () => {
  const keyed = Object.entries(MODELS).filter(([, m]) => process.env[m.provider.envKey]).map(([, m]) => m.label);
  console.log('atomik generate-demo → http://' + HOST + ':' + PORT);
  console.log('  models: ' + (keyed.length ? keyed.join(', ') : 'NONE — set keys in .env and run `npm run demo`'));
  console.log('  saved runs: ' + (existsSync(SAVE_DIR) ? listSaved().length : 0) + ' in ' + SAVE_DIR);
  console.log('  (localhost only; keys stay server-side)');
});
