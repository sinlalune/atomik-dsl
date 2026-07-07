---
type: Atomik Project Index
title: atomik-dsl — project index
timestamp: 2026-07-07T00:00:00Z
---

# atomik-dsl — project index

## What this project is

The atomik DSL (language + kernels) for the Atomik workbench, maturing in its own dual-plane repository until vendored at main-repo milestone M12 (ADR-DSL-001).

## Current state

Language **v0.3.1** (surface `atomik 0.3` unchanged) · Scene IR **0.1** · `cycle` archetype end-to-end (prototype in `apps/prototype-cycle/`) · `flow` archetype end-to-end (ranks, determinism, lane bands painted, routed back-edges, contractual `cycle`→`flow` fallback, prototype flip, typed) · **65/65 tests** green including golden-fixture byte parity and the A1–A7 runtime oracle · errata **C1–C4 folded** (language spec §14 changelog; render-core §10 marked, §6.2 cycle implementation notes) · kernel split `lang.js`/`render.js`/`index.js` with typed surface (`index.d.ts`), public API unchanged · **CP-DSL-001 and CP-DSL-002 both closed 2026-07-07** · **all three in-repo D-paths closed 2026-07-07.** D3 (CP-DSL-003) executed the generability eval — Haiku 4.5 + Gemini 3.1 Flash-Lite over the batch-03 grid (16 tasks × 2 regimes × 5 runs, kernel-as-grader + Sonnet 5 confabulation judge); findings in `docs/evals/generability_eval_v0_3_1.md` (0% fabrication both, misconception preservation 100%/95% — both pass §13.4, cross-vendor agreement on the DSL's core guarantees). **CP-DSL-005 (T1) closed 2026-07-07** — a local generation demo (`npm run demo`): paste text → Haiku/Gemini → kernel parse/layout/render, live in one page over a key-holding localhost server (`apps/generate-demo/`); the whole generation→render chain proven end-to-end. No active path. **D4** (workbench integration) still executes in the main repo after its S00 owner amendment · **D4** executes in the main repo after its S00 owner amendment.

## Canonical files

```text
docs/bedrock/atomik_dsl_spec_v0_3.md            language (normative)
docs/bedrock/atomik_pocket_spec_v0_3.md         generator-facing card (≤2K tokens)
docs/bedrock/atomik_render_core_spec_v0_1.md    Scene IR + rendering obligations (normative)
docs/bedrock/atomik_guide_accessible_v0_3.md    human on-ramp (fr, non-normative)
packages/dsl-core/fixtures/atomik_scene_ir_golden_northstar_v0_1.json
                                                executable acceptance test of both specs
docs/adr/ADR-DSL-001-…md                        why this repository exists
docs/modules/dsl-core.md                        kernel API + invariants
```

## Execution

Active path: see [coding-paths/ACTIVE.md](./coding-paths/ACTIVE.md). Register: [coding-paths/index.md](./coding-paths/index.md). History: [log.md](./log.md). Pressure-test corpus: `sources/`. Provisional thinking: `brainstorm/` (never canonical).

## Files to read first

`/AGENTS.md` → this file → `ACTIVE.md` → the active path's Required list.
