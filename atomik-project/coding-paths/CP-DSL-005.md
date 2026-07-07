---
type: Atomik Coding Path
title: Local generation demo — paste text → small model → rendered scene (T1)
description: A self-contained in-repo web demo. A tiny key-holding local server serves a page where you paste a text, pick Haiku 4.5 or Gemini 3.1 Flash-Lite, and get a generated atomik scene parsed, laid out, and rendered live by the kernel — the whole generation→IR→layout→render chain end-to-end, without touching the workbench.
tags: [coding-path, dsl, tooling, t1]
timestamp: 2026-07-07T00:00:00Z
atomik:
  id: CP-DSL-005
  status: active
  current_step: S02
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
- [ ] S02 Provider single-shot `generateOne` (Anthropic + Gemini), reusing `prompt.build` (R1); a tiny node harness proves each returns kernel-parseable atomik from a sample text.
- [ ] S03 `server.mjs`: localhost http, static serving, `POST /api/generate`; manual curl check against both providers.
- [ ] S04 `index.html` + client: textarea, provider select, Generate; render via kernel + adapted painter; editable source; diagnostics + notices; error states.
- [ ] S05 README + `npm run demo`; end-to-end check; docs (module note, log, ledger); close.

# Current checkpoint

```text
base commit : 6d777be (branch master — CP-DSL-003 closed, all D-paths done)
changed     : S01 — path opened; register T1 → active; ACTIVE.md; orientation; log
tests       : 65 + 39 + 16 green (unchanged); fixture untouched
next action : S02 — generateOne per provider + parse-check harness
blockers    : none (keys present in .env from CP-DSL-003 S04)
```

# Blockers

- None. (Keys already provisioned in `.env`; SDKs already installed.)
