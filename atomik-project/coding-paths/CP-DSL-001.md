---
type: Atomik Coding Path
title: v0.3.1 consolidation + package hardening (D1)
description: Fold errata C1–C4 into the language spec, capture cycle's sub-contract decisions as implementation notes, and split the kernel into lang/render modules without changing the public API.
tags: [coding-path, dsl, d1]
timestamp: 2026-07-07T00:00:00Z
atomik:
  id: CP-DSL-001
  status: active
  current_step: S05
  base_commit: ba27ef9
---

# Goal

Close the paper↔code loop opened by the prototype: the language spec still describes v0.3 while the render-core spec and the shipped kernel already implement C1–C4. Consolidate to **v0.3.1** so the three artifacts (language spec, render spec, kernel) agree, and harden the package shape (internal lang/render split, type declarations) without changing the public API or the IR.

# Definition of done

- `atomik_dsl_spec_v0_3.md` → v0.3.1: C1 (initial-visibility rule generalized to rule-reveals, reveal+hide → hidden), C2 (`set` illegal in rules, both profiles), C3 (note lifetime: transient), C4 (gated-step semantics) folded into the normative sections (§4 grammar, §6 semantics) — not merely listed as errata — plus a short changelog section. Pocket spec updated where affected (effects line, step semantics), staying ≤2K tokens.
- Render-core spec gains **§6.2 per-archetype implementation notes** with the `cycle` entry: radius formula, deterministic ring rotation (earliest IR-order node), satellite fan spread, parked-row behavior. The contractual table stays untouched.
- `src/atomik_core.js` split into `src/lang.js` + `src/render.js` + `src/index.js` (public API unchanged); `index.d.ts` added for `SceneIR`, `parse`, `present`, `layout`.
- **All 41 tests green after every step**; golden fixture unchanged (this path must not move the IR).
- Guide cross-references verified against v0.3.1 wording (guide already teaches C1–C4 behavior).
- Module note, register, log.md, and this ledger updated at every step; each step = one meaningful diff.

# Documentation coverage

Completeness rule: every document of this repository appears below at least once.

## Required

- `docs/bedrock/00_00-orientation.md`
- `docs/bedrock/atomik_dsl_spec_v0_3.md` (§4, §6, §11 traceability)
- `docs/bedrock/atomik_pocket_spec_v0_3.md`
- `docs/bedrock/atomik_render_core_spec_v0_1.md` (§2.3 D-decisions, §5 runtime, §10 errata)
- `packages/dsl-core/fixtures/atomik_scene_ir_golden_northstar_v0_1.json`
- `docs/modules/dsl-core.md`
- `docs/adr/ADR-DSL-001-standalone-dual-plane-library-repo.md`
- `AGENTS.md`

## Conditional

- `docs/bedrock/atomik_guide_accessible_v0_3.md` — before S05 (cross-reference check); it already documents C1–C4 for authors.
- `apps/prototype-cycle/build.mjs` + `atomik_ui.js` — before S04 (the split must not break the prototype build).
- Main-repo `24_24-doc-templates.md` — if any new document type is created in this path.

## Deliberately excluded

- `atomik-project/sources/atomik-corpus-test-batch-01..04.md` — background pressure-test material; consult ad hoc, not a contract for this path.
- `atomik-project/brainstorm/open-questions.md` — provisional; nothing here resolves those questions.
- Main-repo bedrock 06/11/13/14/17/19/27/35 — integration-time contracts; they belong to CP-DSL-004.
- New archetypes, canonical printer, generability tooling — D2/D3/D4 scope; naming them here would widen a consolidation path.

# Execution

- [x] S01 Initialize the repository from the dual-plane template; record `base_commit` in the frontmatter and ledger; verify `npm test` green from the package layout.
- [x] S02 Fold C1–C4 into the language spec → v0.3.1 (normative sections + changelog); update the pocket spec accordingly; re-check its token budget.
- [x] S03 Add render-core §6.2 implementation notes (cycle entry); mark C1–C4 in §10 as "folded at v0.3.1".
- [x] S04 Split `src/atomik_core.js` → `src/lang.js` / `src/render.js` / `src/index.js`; keep the UMD/public surface identical; `npm test` and `npm run build:prototype` both green.
- [ ] S05 Add `index.d.ts`; verify guide cross-references against v0.3.1 wording.
- [ ] S06 Same-work-unit docs: module note, log.md, register, ledger; close the path.

# Current checkpoint

```text
base commit : ba27ef9 (ba27ef97060069d36d14c7da6674be29ce7d9e21, branch master — template init)
changed     : S04 — kernel split verbatim: src/lang.js (parse→IR + validation,
              exports parse+constants), src/render.js (present + layouts),
              src/index.js (assembles identical public surface: parse, present,
              layout, layoutCycle, wrapLabel, nodeBox, constants); atomik_core.js
              deleted; package main → src/index.js; test requires the package entry;
              build.mjs concatenates lang/render/index at @CORE@; index.html rebuilt.
              Verified: old-vs-new A/B equivalence (28 comparisons, byte-identical
              JSON), browser-branch VM smoke (globals assemble, fixture deep-equal,
              C4 gate, cycle ring), module note updated.
tests       : 41 passing / 0 failed via the public entry; npm run build:prototype
              green; fixture parity green, fixture file untouched
next action : S05 — add index.d.ts (SceneIR, parse, present, layout); verify guide
              (fr) cross-references against v0.3.1 wording (conditional trigger:
              read the guide first)
blockers    : none
```

# Blockers

- None recorded.
