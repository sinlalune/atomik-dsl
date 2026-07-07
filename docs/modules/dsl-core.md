---
type: Atomik Module Note
title: "Module: dsl-core"
description: The atomik DSL kernels — lang (text → Scene IR) and render (pure runtime + layout) — incubating in one dependency-free package.
tags: [module, dsl]
timestamp: 2026-07-07T00:00:00Z
---

# Module: dsl-core

## What it owns

Tokenize/parse/ground(stub)/validate of atomik v0.3 source; Scene IR assembly (irVersion 0.1, fully explicit, line-provenanced); both validation profiles (`authored` / `generated`); the pure runtime `present()` (visibility, gated steps per C4, reactive rules, notes, edge effective visibility); `layout()` with the `cycle` archetype (ring + satellites, deterministic) and an announced fallback grid; label wrapping and node sizing.

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

`npm test` → `test/test_atomik_core.js`, 41 assertions in four suites: golden-fixture deep-equal parity (§9.1 of the render-core spec), runtime oracle A1–A7 (§9.2), demo-scene parsing + cycle geometry (ring equidistance, satellite orbit, arc edges), diagnostics/C2/profile guards. The fixture parity test is a merge gate.

## Example usage

See `apps/prototype-cycle/atomik_ui.js` (paint + interaction over the kernel) and the presets in `fixtures/presets/`.

## Future extension points

Canonical printer (`print`) for one-line rewrites and diff-stable formatting; internal `src/lang` / `src/render` split (CP-DSL-001); remaining archetypes against the layout contracts table; real resolver semantics for `unresolved` refs; `.d.ts` types.

## Agent checklist

- [ ] Ran `npm test` before and after the change; fixture parity green.
- [ ] Any IR shape change: fixture + render-core spec + tests updated in the same work unit.
- [ ] No DOM/fs/network/eval introduced; zero dependencies preserved.
- [ ] Diagnostics remain line-scoped with hints where cheap.
- [ ] Module note, log.md, and the active path ledger updated.
