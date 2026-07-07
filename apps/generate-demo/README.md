# generate-demo (T1)

Paste a text, pick a small model, watch it become a rendered atomik scene — the
whole **generation → IR → layout → render** chain, live, in one page. Built in
CP-DSL-005 to *feel* the library working before the real workbench integration
(D4, which happens in the main Atomik repo).

## Run

```bash
npm run demo          # loads .env, serves http://127.0.0.1:4173
```

Open the URL, paste an explanation into the top bar, choose a **model**,
optionally tick *teaching sequence* (adds steps + a prediction gate), and hit
**Generate & render**. The generated atomik lands in the Source tab; edit it and
the scene re-renders live (⌘/Ctrl-Enter in the text box also generates).

Models available (small → bigger): **Gemini 3.1 Flash-Lite**, **Gemini 2.5
Flash**, **Gemini 3.5 Flash**, **Claude Haiku 4.5**, **Claude Sonnet 5**. Gemini
3.x Flash are reasoning models — the server disables thinking (`thinkingBudget:
0`) so they emit the scene, not their chain of thought.

**Zoom / pan.** Scroll-wheel to zoom toward the cursor, drag to pan, and the
`− 100% + ⌂` control (top-right of the scene) zooms and resets. The view persists
while you edit the source and resets on each new generation.

**Save library.** **Save** writes the current run to `apps/generate-demo/saved/`
as one JSON file holding **model + metadata + the exact prompt (system + user) +
input text + atomik source + parsed IR + diagnostics**. The **saved runs**
dropdown lists everything in that folder and reloads any of them back into the
page (source, model, input, teaching flag). The folder is git-ignored (local
data); the demo reads it on load and after each save.

Needs the two keys in `.env` at the repo root (same file the eval uses):

```
ANTHROPIC_API_KEY=sk-ant-...
GEMINI_API_KEY=...
```

`GET /health` reports which models are available.

## How it works (and why it's a server, not a static page)

The API keys authenticate **paid** APIs, so they can never reach the browser. The
demo is a localhost-only Node server that:

1. reads the keys from `.env` **server-side**;
2. serves the prototype renderer (`apps/prototype-cycle/index.html`) with a small
   "generate" panel injected — so the entire tested painter (parse, layout,
   `present()` runtime, step navigation, diagnostics, misconception striking,
   refutation terminators, cycle arcs, flow lanes) is reused as-is;
3. exposes `POST /api/generate {text, provider, teaching}` → `{atomik, model,
   took}`, which builds the **pocket-spec-verbatim** prompt (the `R1`
   model-plane-only regime from the generability eval) and makes a single
   non-batch model call.

The browser sends text and receives atomik source; it never sees a key. The panel
drops the source into the prototype's `#src` box and fires an `input` event, which
drives the prototype's existing compile-and-render.

Zero new dependencies: Node's built-in `http`, the provider SDKs already installed
for the eval, and the browser-ready kernel inlined in the prototype build.

## What to expect

- **Renders properly** for `cycle` and `flow` scenes (the two implemented
  layouts). Any other archetype the model picks renders through the *announced
  fallback grid* — labelled, never blank.
- **Partial validity is normal, and diagnostics are usually non-fatal.** Small
  models occasionally emit an off line (a bare `subject`, a multi-word id); the
  kernel still builds everything else and the scene **renders anyway**. The
  status bar says how many lines were skipped so you don't mistake it for a
  failure; the Diagnostics tab shows each, and editing the source fixes it live.
- **The prompt is hardened for the errors small models actually make.** Watching
  real generations, the recurring slips were: unquoted `subject`, multi-word ids
  in relations, putting a misconception as the scene claim, and (French input)
  English labels. The server's prompt pins each down (single-token ids, exact
  relation shape, quoted/`[[…]]` subject, claim = the truth, keep the source
  language). This cut Haiku's errors sharply.
- **Counter-intuitive but measured:** the *lowest*-tier model (Flash-Lite) is
  often the cleanest here — it follows the format literally, while bigger models
  occasionally over-think. Tier ≠ format fidelity for this task.
- Generation fidelity is characterized in `docs/evals/generability_eval_v0_3_1.md`
  — both models ground references well and preserve marked misconceptions; the
  soft spots are confabulation and run-to-run structural variation.

## Boundaries

Localhost dev tool. No persistence, no auth, no deploy. Real vault grounding, the
` ```atomik ` fence, and the patch pipeline belong to the workbench integration
(CP-DSL-004), not here. This app consumes the kernels read-only and changes
nothing in `packages/dsl-core`.
