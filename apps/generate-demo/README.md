# generate-demo (T1)

Paste a text, pick a small model, watch it become a rendered atomik scene — the
whole **generation → IR → layout → render** chain, live, in one page. Built in
CP-DSL-005 to *feel* the library working before the real workbench integration
(D4, which happens in the main Atomik repo).

## Run

```bash
npm run demo          # loads .env, serves http://127.0.0.1:4173
```

Open the URL, paste an explanation into the top bar, choose **Haiku 4.5** or
**Gemini 3.1 Flash-Lite**, optionally tick *teaching sequence* (adds steps + a
prediction gate), and hit **Generate & render**. The generated atomik lands in
the Source tab; edit it and the scene re-renders live (⌘/Ctrl-Enter in the text
box also generates).

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
- **Partial validity is normal.** Small models occasionally emit an off line
  (e.g. a bare `subject` without brackets); the kernel still builds everything
  else and shows the line-scoped diagnostic in the Diagnostics tab. Edit the
  source to fix it and it re-renders.
- Generation fidelity is characterized in `docs/evals/generability_eval_v0_3_1.md`
  — both models ground references well and preserve marked misconceptions; the
  soft spots are confabulation and run-to-run structural variation.

## Boundaries

Localhost dev tool. No persistence, no auth, no deploy. Real vault grounding, the
` ```atomik ` fence, and the patch pipeline belong to the workbench integration
(CP-DSL-004), not here. This app consumes the kernels read-only and changes
nothing in `packages/dsl-core`.
