---
type: Atomik Project Index
title: atomik-dsl — project index
timestamp: 2026-07-07T00:00:00Z
---

# atomik-dsl — project index

## What this project is

The atomik DSL (language + kernels) for the Atomik workbench, maturing in its own dual-plane repository until vendored at main-repo milestone M12 (ADR-DSL-001).

## Current state

Language **v0.3.1** (surface `atomik 0.3` unchanged) · Scene IR **0.1** · `cycle` archetype end-to-end (prototype in `apps/prototype-cycle/`) · `flow` layered core landed (ranks, determinism, back-edge detection; lanes + routing pending) · **54/54 tests** green including golden-fixture byte parity and the A1–A7 runtime oracle · errata **C1–C4 folded** (language spec §14 changelog; render-core §10 marked, §6.2 cycle implementation notes) · kernel split `lang.js`/`render.js`/`index.js` with typed surface (`index.d.ts`), public API unchanged · **CP-DSL-001 closed 2026-07-07** · active path: **CP-DSL-002** (D2 — `flow` archetype, opened 2026-07-07 at owner go-ahead).

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
