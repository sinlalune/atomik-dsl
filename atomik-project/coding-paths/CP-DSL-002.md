---
type: Atomik Coding Path
title: Second archetype — flow (layered layout against the L-contracts) (D2)
description: Implement the flow archetype as a real layered engine (ranks, lanes, routed back-edges) meeting render-core §6, wire the cycle→flow contractual fallback, and surface it in the prototype — without moving the IR.
tags: [coding-path, dsl, d2]
timestamp: 2026-07-07T00:00:00Z
atomik:
  id: CP-DSL-002
  status: active
  current_step: S06
  base_commit: 5064ff7
---

# Goal

Give atomik its second real archetype. `flow` is the general-purpose directed explanation (processes, arguments, causal chains) and the contractual fallback target of `cycle` (non-cyclic model) and `tree` (non-forest). Implementing it against the §6 layout contracts proves the contracts table is executable beyond the first archetype, and turns the prototype's projection flip into a real choice between two tuned layouts. The IR does not move: this path is render-side only.

# Definition of done

- `layout()` dispatches `flow` to a layered engine meeting its §6 row: **rank order follows edge direction** (property: for every directed node→node relation not classified as a back-edge, `rank(from) < rank(to)`); **lanes honored** (`group [kind lane]` members stay inside their lane's band, lanes ordered by declaration); **back-edges routed around** the diagram, never through the rows; cyclic models are legal input.
- Global contracts hold: L1 two fresh layouts of the same IR are identical; L2 no node overlap on any preset or test scene; L3 labels via the shared `nodeBox` (never dropped); L4 layout computed on the full all-revealed graph; L5 degradations announce themselves in `notices`.
- `cycle` with no directed cycle now falls back to **`flow` + warning** per the contract table (replaces the prototype grid for that case).
- Render-core **§6.2 gains the flow entry** (ranking, ordering, lane and back-edge decisions); the cycle entry's "until `flow` exists" sentence is updated. The contractual table stays untouched.
- **IR untouched**: golden fixture byte-identical to base across the path; `present()` unchanged; language spec, pocket spec unchanged.
- Prototype renders `flow` end-to-end (flip on `preset_simple` shows ranks + one routed back-edge); UI prefers a pre-routed `path` on any edge that carries one; guide's prototype-limits sentence updated; `index.d.ts` covers the routed-edge variant.
- Tests grow to cover all of the above (target ≥ 55 total), green after every step; module note, register, log.md, and this ledger updated at every step; each step = one meaningful diff.

# Documentation coverage

Completeness rule: every document of this repository appears below at least once.

## Required

- `AGENTS.md`
- `docs/bedrock/00_00-orientation.md`
- `docs/bedrock/atomik_render_core_spec_v0_1.md` (§3 pipeline, §6 L1–L5 + table row, §6.2)
- `docs/bedrock/atomik_dsl_spec_v0_3.md` (v0.3.1 — §5.6 projections, §7 invariants)
- `docs/modules/dsl-core.md`
- `packages/dsl-core/fixtures/atomik_scene_ir_golden_northstar_v0_1.json` (gate: must not move)

## Conditional

- `apps/prototype-cycle/build.mjs` + `apps/prototype-cycle/atomik_ui.js` — before S05 (edge painting gains routed paths).
- `docs/bedrock/atomik_guide_accessible_v0_3.md` — before S05 (prototype-limits paragraph says cycle-only).
- `docs/bedrock/atomik_pocket_spec_v0_3.md` — only if author-facing flow semantics change (none expected: `flow` is already in the archetype list).
- `docs/adr/ADR-DSL-001-standalone-dual-plane-library-repo.md` — only if the package shape or vendoring story is affected (not expected).
- Main-repo `24_24-doc-templates.md` — if any new document type is created in this path.

## Deliberately excluded

- `atomik-project/sources/atomik-corpus-test-batch-01..04.md` — background pressure-test material; consult ad hoc.
- `atomik-project/brainstorm/open-questions.md` — provisional; nothing here resolves those questions.
- `README.md` and `atomik-project/sessions/` — human landing page and historical record; no contract touched.
- `CP-DSL-004` — integration path; flow changes nothing in its scope.
- Other archetypes (`tree`, `nested`, `timeline`, …), canonical printer, generability evaluation — D3+ scope; naming them here would widen the path.
- Main-repo bedrock beyond the doc-templates trigger — CP-DSL-004 territory.

# Execution

- [x] S01 Open the path: ledger with base commit, register D2 → active, ACTIVE.md pointer, orientation roadmap row, log entry. No code.
- [x] S02 `layoutFlow` core in `src/render.js`: deterministic cycle-breaking (DFS in IR order → back-edge set), longest-path ranking of the acyclic remainder, deterministic within-rank ordering (barycenter pass over an IR-order seed, stable ties), coordinates from `nodeBox` with row/column gaps (L2 by construction); `layout()` dispatches `flow`; straight edges via `rectExit`; back-edges flagged. Tests: dispatch, rank-order property, single back-edge on a cycle-as-flow, determinism, no-overlap, L4 full-graph.
- [x] S03 Lanes + back-edge routing: `[kind lane]` groups partition x into declaration-ordered bands (members constrained inside, ranks shared); back-edges routed around the diagram flank as paths with labels. Tests: lane bands, routed path clears node bounds.
- [x] S04 Contract fallback rewire: `layoutCycle` no-ring → `flow` + loud warning (replaces grid); `layout()` notices updated for two real archetypes; render-core §6.2 flow entry + cycle-entry update. Tests: `project as cycle` on an acyclic model lands in flow with a warning.
- [x] S05 Prototype + types: UI prefers `e.path` when present; rebuild; guide prototype-limits sentence; `index.d.ts` routed-edge variant; browser-branch smoke.
- [ ] S06 Same-work-unit docs audit and close: register, ACTIVE.md, orientation, log, ledger; fixture-diff gate re-check.

# Current checkpoint

```text
base commit : 5064ff7 (branch master — CP-DSL-001 closed, 41/41 green)
changed     : S05 — painter prefers e.path over the straight segment (routed
              back-edges render); lane regions painted from layout.lanes with
              .lane/.lanelabel styles in the template; boundary glyph anchors on
              labelAt; guide limits sentence now names cycle AND flow; d.ts:
              Geometry gains flow fields (rows/backEdges/lanes optional,
              ring/parked now optional), LayoutEdge gains the back+path variant,
              CycleAttempt renamed ArchetypeAttempt, layoutFlow declared.
              Verified: tsc --strict exit 0, browser-branch VM smoke (lanes +
              routed back-edge + built html carries engine/styles/painter).
tests       : 65 passing / 0 failed; build green; fixture untouched
next action : S06 — closing audit (DoD line-by-line, fixture diff vs base),
              register done, ACTIVE.md, orientation, log
blockers    : none
```

# Blockers

- None recorded.
