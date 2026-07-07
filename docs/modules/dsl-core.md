---
type: Atomik Module Note
title: "Module: dsl-core"
description: The atomik DSL kernels — lang (text → Scene IR) and render (pure runtime + layout) — incubating in one dependency-free package.
tags: [module, dsl]
timestamp: 2026-07-07T00:00:00Z
---

# Module: dsl-core

## What it owns

Tokenize/parse/ground(stub)/validate of atomik v0.3 source (spec v0.3.1); Scene IR assembly (irVersion 0.1, fully explicit, line-provenanced); both validation profiles (`authored` / `generated`); the pure runtime `present()` (visibility, gated steps per C4, reactive rules, notes, edge effective visibility); `layout()` with the `cycle` archetype (ring + satellites, deterministic; formulas in render-core §6.2) and the `flow` archetype (layered: deterministic DFS cycle-breaking, longest-path ranks, mean-field ordering, declaration-ordered lane bands, back-edges routed around the right flank through the inter-row corridors); `cycle` without a directed cycle falls back to `flow` per the §6 contract; other unimplemented archetypes announce a minimal fallback grid; label wrapping and node sizing.

Internal layout (not part of the contract): `src/lang.js` (text → IR) / `src/render.js` (pure runtime + layout) / `src/index.js` (assembles the public `Atomik` surface; package `main`). In the browser the files load in that order and expose `AtomikLang` / `AtomikRender` / `Atomik`.

## Why it exists

The IR is the expensive contract every consumer couples to (renderer, validators, Truth Lens, patch pipeline, exporters). Keeping it in a DOM-free, dependency-free kernel makes it testable in node, embeddable anywhere, and auditable under the Electron security contract (AST interpretation only — no `eval`).

## What it must not own

React, DOM, filesystem, network, AI calls, theme CSS (it emits classes/geometry; tokens live app-side), and it must never re-read source text after parse (D1).

## Public contracts

```js
const A = require('@atomik/dsl-core');
const ir   = A.parse(text, { resolver });   // resolver(wikilinkText) → Ref {kind: note|unresolved|literal, …}
                                            // omitted resolver = prototype stub: everything resolves
const pres = A.present(ir, { currentStep, inputs, committed }, { ignoreGates });  // pure, RS1
const L    = A.layout(ir);                  // { layout: geometry, notices: [], requested: archetype }
```

`ir.diagnostics` carries line-scoped errors/warnings with repair hints. State shape is the whole runtime contract: `(currentStep, inputs, committed)` — nothing else may influence presentation.

`src/index.d.ts` types the surface (package `types`): `SceneIR` mirrors render-core §2.2 verbatim (the frozen contract); presentation/geometry types describe the current emit (engine-internal, §4). In TS, the UMD global and `require` are both typed (`export as namespace Atomik`).

## Data flow

```text
source text → parse → SceneIR (+diagnostics) → layout(archetype) → geometry
                                   ↘ present(ir, state) → visibility/notes/highlights/gates
```

## Alternatives considered

Mermaid/D2-class languages (no epistemic layer, layout semantics leak into source) and raw HTML (rejected in bedrock 19). Full analysis: `atomik-project/sources/atomik-corpus-test-batch-01..04.md`.

## Common mistakes

- Re-parsing source in a renderer instead of consuming the IR (D1 violation).
- Referencing synthetic relation ids (`~rN`) from source — they are engine-internal by construction (D7).
- Forgetting C4: a step with `require` withholds **its own effects** until commitment, not just the exit.
- Mutating presentation state incrementally; always recompute via `present()` (RS1).
- Treating `initiallyHidden` as renderer logic — it is computed by lang (C1: any `reveal` target, steps *and* rules).

## Tests

`npm test` → `test/test_atomik_core.js`, 65 assertions in eight suites: golden-fixture deep-equal parity (§9.1 of the render-core spec), runtime oracle A1–A7 (§9.2), demo-scene parsing + cycle geometry (ring equidistance, satellite orbit, arc edges), diagnostics/C2/profile guards, and the flow layered-layout contract in two suites (rank order, determinism, no-overlap, lane bands, routed back-edge clearance). The fixture parity test is a merge gate.

## Example usage

See `apps/prototype-cycle/atomik_ui.js` (paint + interaction over the kernel) and the presets in `fixtures/presets/`. `apps/eval-generability/` (CP-DSL-003) is a second read-only consumer: it uses `parse` under the `generated` profile with a vault-backed `resolver` as an automated grader — the kernel scores model-generated scenes (from Haiku 4.5 and Gemini 3.1 Flash-Lite) for validity, grounding, epistemic ceiling, and structural properties. It never imports internals and adds no dependency to `packages/dsl-core`; the provider SDKs live behind that app's own dynamic imports.

## Future extension points

Canonical printer (`print`) for one-line rewrites and diff-stable formatting; remaining archetypes against the layout contracts table; real resolver semantics for `unresolved` refs.

## Agent checklist

- [ ] Ran `npm test` before and after the change; fixture parity green.
- [ ] Any IR shape change: fixture + render-core spec + tests updated in the same work unit.
- [ ] No DOM/fs/network/eval introduced; zero dependencies preserved.
- [ ] Diagnostics remain line-scoped with hints where cheap.
- [ ] Module note, log.md, and the active path ledger updated.
