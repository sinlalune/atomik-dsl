---
type: Atomik Coding Path
title: Workbench integration — fenced atomik blocks rendered in Atomik (D4 = main-repo M12)
description: Vendor dsl-core into the main repository, register the atomik fence in markdown-core, mount a thin scene renderer with real grounding, and route the projection flip through the patch pipeline.
tags: [coding-path, dsl, d4, m12, integration]
timestamp: 2026-07-07T00:00:00Z
atomik:
  id: CP-DSL-004
  status: draft
  current_step: S00
  base_commit: null
---

# Goal

Make ` ```atomik ` a first-class fenced block in Atomik pages: recognized by `markdown-core`, rendered by a thin renderer component over the vendored `dsl-core` kernels, grounded against the real vault, editable only through the file (flip = one-line patch). **This path executes in the main Atomik repository**; it is milestone M12 seen from the DSL side. Scope freezes at S00.

# Definition of done

- Golden-fixture parity runs green in the main repo's CI (vitest) as a merge gate.
- The north-star scene, pasted as a fenced block in a real page, renders in the preview with the C4 gate working (evidence withheld until the learner commits a prediction).
- A wikilink in a scene resolves against the vault: resolved refs open the note; unresolved refs render the broken-link affordance and can create the note.
- Flipping the projection rewrites exactly one line inside the fence **through the patch/file-write mechanics**; acceptance: one flip = a one-line git diff.
- Any render failure degrades to the source text inline (never a blank block); diagnostics are line-scoped and clicking one moves the editor cursor to `blockStart + irLine − 1`.
- No new IPC channel; no `eval`/`new Function`; scene runtime is AST interpretation only (Electron security contract holds unchanged).
- Main-repo `19_19-dsl-future.md` and `atomik_dsl_reserved_spec_v0_1.json` updated to v0.3.1 vocabulary (`state`→`input`, `layout`→`project`, full keyword set) in the same work unit — both are stale today.
- Cache deletion (`.atomik/`) loses nothing: the scene lives in the page.
- Module notes, register, log, and this ledger updated at every step; each step = one meaningful diff.

# Documentation coverage

## Required — main Atomik repository

- `docs/bedrock/06_06-ai-patch-pipeline.md` — the flip and all artifact-side edits are patches.
- `docs/bedrock/11_11-markdown-page-model.md` — block model, page conventions.
- `docs/bedrock/13_13-electron-security.md` — no new surface expected; confirm.
- `docs/bedrock/14_14-app-kernels.md` — kernel boundaries, incubation rule, dependency direction.
- `docs/bedrock/17_17-self-evolving-docs.md` — same-work-unit rule (19 + reserved JSON updates).
- `docs/bedrock/19_19-dsl-future.md` — the reserved contract this path fulfills and must update.
- `docs/bedrock/24_24-doc-templates.md` — module note for the vendored package.
- `docs/bedrock/27_27-git-compatibility.md` — one-line-diff discipline for the flip.
- `docs/bedrock/35_35-coding-path-execution-state.md` + `22_22-agent-handoff.md` — execution discipline.

## Required — this repository

- `docs/bedrock/atomik_dsl_spec_v0_3.md` (v0.3.1 after CP-DSL-001)
- `docs/bedrock/atomik_render_core_spec_v0_1.md` — especially §6 embedding, D6 line provenance, §8 fallbacks.
- `packages/dsl-core/fixtures/atomik_scene_ir_golden_northstar_v0_1.json`
- `docs/modules/dsl-core.md`

## Conditional

- Main `03_03-workspace-tabs.md` — only if scene rendering needs pane integration beyond the existing preview.
- Main `15_15-maintainability.md` — before closing (definition-of-done and diff hygiene).
- Main `31_31-truth-lens-ux.md` — before wiring anything beyond the claim status chip.
- Main `13_13-electron-security.md` §IPC — re-read before adding ANY new IPC channel or preload method (none expected).

## Deliberately excluded

- Scene **generation** (highlight-passage → scene, repair loop) — its own future path in `ai-core`; this path renders authored blocks only.
- Additional archetypes — `cycle` + the announced fallback suffice; embedding frictions teach more than an nth layout.
- Main 05/07/08/09/10 (sources), 28/29/30/32 (truth/verification beyond the chip), 33/34 (execution economics), 20/21 (relations/canvas) — other milestones; extension points only.
- `atomik-project/sources/` corpus batches — background material.

# Execution

- [ ] S00 Owner register amendment in the **main repo**: slot M12 (pull forward or sequence after the active path), point its register at this path, freeze scope. No code before this step.
- [ ] S01 Vendor `packages/dsl-core` (copy or subtree) into the main repo; port the 41-test harness to vitest; wire golden-fixture parity as a CI merge gate.
- [ ] S02 `markdown-core`: register the ` ```atomik ` fence as an artifact kind; expose block source + document offset (blockStart) to the preview pipeline.
- [ ] S03 Renderer `<AtomikScene source blockStart ctx>`: memoized parse/layout per source, `present()` per interaction state; first version mounts the tested vanilla painter via a ref (JSX rewrite only if a real need appears). Fallback = source text; diagnostics inline; click → editor cursor at `blockStart + irLine − 1`.
- [ ] S04 Grounding: inject `resolver(wikilink)` backed by the vault index; resolved → open note; unresolved → dotted affordance + create-note action. Retires the prototype's simulated grounding.
- [ ] S05 Flip-as-patch: projection change rewrites one line inside the fence via patch mechanics; acceptance test asserts the one-line git diff.
- [ ] S06 Same-work-unit docs: update main 19 + reserved spec JSON to v0.3.1 vocabulary; module note for the vendored package; acceptance run (all Definition-of-done lines); close.

# Current checkpoint

```text
base commit : —
changed     : —
tests       : not started (drafted 2026-07-07 at owner request; opens at S00)
next action : S00 — owner register amendment in the main repository
blockers    : CP-DSL-001 (v0.3.1) should close first so 19/reserved-JSON update
              targets the consolidated vocabulary
```

# Blockers

- Sequencing: depends on CP-DSL-001 closing (v0.3.1 vocabulary) and on the main repo's active-path availability (one active parent path rule).
