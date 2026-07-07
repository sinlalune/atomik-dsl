---
type: Atomik Coding Path
title: Local generation demo — paste text → small model → rendered scene (T1)
description: A self-contained in-repo web demo. A tiny key-holding local server serves a page where you paste a text, pick Haiku 4.5 or Gemini 3.1 Flash-Lite, and get a generated atomik scene parsed, laid out, and rendered live by the kernel — the whole generation→IR→layout→render chain end-to-end, without touching the workbench.
tags: [coding-path, dsl, tooling, t1]
timestamp: 2026-07-07T00:00:00Z
atomik:
  id: CP-DSL-005
  status: done
  closed: 2026-07-07
  current_step: none
  base_commit: 6d777be
---

# Goal

Turn the two pieces we now have — a generation pipeline (CP-DSL-003) and a renderer (the cycle/flow prototype) — into one interactive demo that a person can open and use: paste an explanation, watch a cheap small model turn it into atomik, and see the kernel render it. This is the fastest way to *feel* the library working before the real workbench integration (D4, which executes in the main repo). It is a developer tool, not a language change.

# Non-negotiable: keys never reach the browser

The Anthropic/Gemini keys authenticate paid APIs; a browser page cannot hold them. The demo is therefore a **local Node server** that reads `.env` server-side, serves the static page, and exposes one endpoint (`POST /api/generate`) that proxies the single model call. The browser sends text, receives atomik source — never a key. Bind to localhost only. Zero new dependencies: Node's built-in `http`, the already-installed SDKs, the browser-ready kernel.

# Definition of done

- `apps/generate-demo/`: `server.mjs` (localhost http server; static file serving + `POST /api/generate {text, provider} → {atomik, model, error}`; loads `.env` via `--env-file-if-exists`), an `index.html` + client JS, and a README.
- **Generation**: reuses `apps/eval-generability/prompt.mjs` (the pocket-spec-verbatim R1 builder) and a new single-shot `generateOne(text, model)` per provider (non-batch: Anthropic `messages.create`, Gemini `models.generateContent`), added alongside the batch `submit` in `providers/{anthropic,google}.mjs`.
- **Render**: the page parses the returned source with the kernel (`Atomik.parse`), lays it out (`Atomik.layout` — real `cycle`/`flow`, announced fallback for the rest), and paints an interactive SVG reusing the prototype's painter approach (present() runtime, step nav, diagnostics, status chip). The generated atomik source is shown and **editable** — edits re-render live, so the page doubles as a scratchpad.
- **Honest UX**: shows which model produced the scene; surfaces kernel diagnostics (line-scoped) and layout notices (e.g. "archetype X not implemented — fallback grid"); a generation error renders as a message, never a blank page.
- **Verified end-to-end**: the `/api/generate` endpoint is exercised against both real providers (keys in `.env`), and the returned atomik is confirmed to parse under the kernel. Runbook in the README (`npm run demo`).
- Kernels unchanged (read-only consumer); `packages/dsl-core` gains no dependency; golden fixture untouched; existing suites stay green.
- Module note, register, log.md, and this ledger updated; each step one meaningful diff.

# Documentation coverage

## Required

- `AGENTS.md`
- `docs/bedrock/00_00-orientation.md`
- `docs/bedrock/atomik_pocket_spec_v0_3.md` — the generation prompt (reused verbatim)
- `docs/bedrock/atomik_render_core_spec_v0_1.md` (§3 pipeline, §5 runtime, §6 layout, §8 fallbacks/a11y) — the render contract the page honors
- `docs/modules/dsl-core.md`
- `apps/prototype-cycle/atomik_ui.js` — the painter being reused/adapted
- `apps/eval-generability/prompt.mjs` + `providers/*.mjs` — the generation code being reused

## Conditional

- `docs/bedrock/atomik_dsl_spec_v0_3.md` — only if a language question surfaces (none expected; read-only).
- `docs/evals/generability_eval_v0_3_1.md` — background on how well the models generate (informs demo expectations).
- Main-repo `24_24-doc-templates.md` — if a new document type is created (none expected).

## Deliberately excluded

- `packages/dsl-core/**` source — read-only consumer; no kernel edits.
- Workbench integration (fences, patch pipeline, real vault grounding) — that is CP-DSL-004 in the main repo; this demo uses the prototype's simulated grounding.
- Persisting scenes, auth, multi-user, deploy — a localhost dev demo, not a product.
- New archetype layouts — out of scope; unimplemented archetypes use the announced fallback.

# Execution

- [x] S01 Open the path: ledger, register (T1 → active), ACTIVE.md, orientation, log.
- [x] S02 Provider single-shot `generateOne` (Anthropic + Gemini), reusing `prompt.build` (R1); a tiny node harness proves each returns kernel-parseable atomik from a sample text.
- [x] S03 `server.mjs`: localhost http, `POST /api/generate`, `/health`; verified via curl against both providers.
- [x] S04 Page + client — **design improvement vs the ledger's original "new index.html":** instead of duplicating the painter, the server injects a generate panel + wiring into the prototype's own `index.html`, reusing the entire tested renderer (parse/layout/present/paint, step nav, diagnostics, misconception strike, refutation ⊣, cycle arcs, flow lanes). The panel fills the prototype's `#src` and fires `input` to drive its compile. Editable source, model label, error states, ⌘/Ctrl-Enter.
- [x] S05 README + `npm run demo`; end-to-end verified (generate → parse → layout → present, incl. a live-generated teaching scene whose prediction gate withholds evidence at step 2); module note, log, register, ledger; close.
- [x] S08 (owner request) **Cost-per-generation metadata.** `generateOne` (both providers) now returns token usage (Anthropic `usage`, Gemini `usageMetadata`); the server holds a verified list-price table (Haiku $1/$5, Sonnet $3/$15; Gemini 3.5 Flash $1.50/$9, 2.5 Flash $0.30/$2.50, 3.1 Flash-Lite $0.25/$1.50 — ai.google.dev 2026-07) and computes est. cost = tokens × price. Shown in the status bar (`est. cost $… (N in / M out tokens)`), carried into the saved metadata (cost + tokens + price snapshot), and displayed on reload + in the saved-runs list. Verified across Haiku/Gemini/Sonnet — arithmetic checks out; input tokens dominate (pocket spec as system prompt), so Sonnet ≈17× Flash-Lite per scene. Demo-local; kernels untouched.
- [x] S07 (owner request) **Zoom/pan on the scene + a save library.** Zoom: wheel-toward-cursor + drag-pan + `−/+/⌂` control, re-applied across live-edit re-renders via a MutationObserver on `#stage`, reset on each new generation/load. Save: `POST /api/save` writes `saved/<id>.json` with model + metadata + the exact prompt (system+user) + input text + atomik source + parsed IR + diagnostics; `GET /api/saved` lists, `GET /api/saved/:id` loads; the injected panel gets a Save button + a "saved runs" dropdown that reloads any run (source, model, input, teaching). `saved/` git-ignored (local data). Verified end-to-end: generate → save → list → the file carries all six requested parts → reload. Path-id sanitized against traversal; server-side parse reused for IR/diag. Kernels untouched.
- [x] S06 (reopened at owner feedback) **Models + prompt hardening from a real error investigation.** Owner observed Haiku "always errors" and asked for more Gemini tiers. Investigated live across models: Haiku's errors were 2 recurring, *non-fatal*, prompt-fixable patterns (unquoted `subject`, multi-word ids in relations — the scene rendered anyway via partial validity); Gemini 3.5 Flash is a *reasoning* model that leaked its chain-of-thought into the output and truncated the scene; Flash-Lite (lowest tier) was the cleanest. Fixes: (a) `generateOne` disables Gemini thinking (`thinkingBudget: 0`); (b) demo prompt hardened — keep source language, single-token ids + exact relation shape, quoted/`[[…]]` subject, and (teaching) claim = the truth not the misconception; (c) model menu now Haiku 4.5 / Sonnet 5 / Gemini 3.5·2.5 Flash / 3.1 Flash-Lite; (d) honest render summary (server-side parse → "N nodes, M lines skipped, non-fatal"). Verified: all 5 models render 0–1 errors, teaching claim never inverted, `took` clamped against VM clock skew.

# Current checkpoint

path closed 2026-07-07 — definition-of-done audit:
  ✓ apps/generate-demo/{server.mjs, README.md}; `npm run demo` serves
    http://127.0.0.1:4173 (localhost only)
  ✓ POST /api/generate proxies a single model call (Haiku / Gemini), pocket
    spec verbatim (R1), keys read server-side from .env — browser never sees one
  ✓ renderer reused whole via injection into the prototype's index.html (no
    painter duplication); generated source is editable and re-renders live
  ✓ end-to-end verified against both real providers: generation (~0.6–1.5s),
    kernel parse, layout, and present() runtime — incl. a live teaching scene
    with a working prediction gate; error + partial-validity paths handled
  ✓ kernels untouched (read-only consumer); dsl-core gains no dependency; zero
    new deps (built-in http + installed SDKs + inlined kernel); fixture unmoved
  ✓ module note, register (T1 → done), ACTIVE.md, orientation, log, ledger
post-close iteration (S06, 2026-07-07): 5-model menu + prompt hardening from a
              live error investigation (see S06). Findings also useful upstream:
              the demo prompt's clarifications (single-token ids, exact relation
              shape, quoted subject, claim-is-truth) are candidates for the
              pocket spec itself, and "misconception valid on nodes not claim"
              is a spec rule the kernel does NOT currently enforce (a validation
              gap worth its own path). Kept demo-local so the eval's measured
              prompt stays frozen.
next        : the natural sequel is D4 (workbench integration) in the main repo;
              this demo is the local proof that the generation→render chain works
blockers    : none.

# Blockers

- None. (Keys already provisioned in `.env`; SDKs already installed.)
