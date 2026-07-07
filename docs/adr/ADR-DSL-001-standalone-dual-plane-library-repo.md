# ADR-DSL-001: Standalone dual-plane library repository, vendored later as `packages/dsl-core`

Status: accepted
Date: 2026-07-07

## Context

The atomik DSL reached a tested state outside any repository: language spec v0.3, pocket spec (≤2K tokens), render-core spec v0.1 with the Scene IR (decisions D1–D11, errata C1–C4), a golden fixture, and an end-to-end `cycle` prototype whose kernel passes 41 node tests including byte-exact IR parity with the fixture.

In the main Atomik repository, the DSL is milestone **M12**; `CP-MVP-002` (M3) is active; the constitution imposes one active parent path, just-in-time path opening, and no work outside an accepted path. The main-repo bedrock already fixes the target architecture: `lang-core` / `render-core` as DOM-free, Electron-free kernel packages, renderers depending on core and never the reverse (bedrock 14), with fenced-block support reserved (bedrock 19).

Implementing the DSL directly inside the app renderer would violate those dependency invariants, lose the golden-fixture CI gate, and force a premature register amendment.

## Decision

1. The DSL matures in **its own repository**, `atomik-dsl`, using the **same dual-plane template** as the main repo (ADR-009 there): code plane (`packages/`, `apps/`, `docs/`) + knowledge/execution plane (`atomik-project/` with index, log, register, coding paths).
2. The kernels incubate as **one package**, `packages/dsl-core` (internal lang/render split deferred to CP-DSL-001), per the main repo's incubation rule: split only when a second real consumer exists.
3. The **golden-fixture parity test is a permanent merge gate**; any expected-IR diff is a reviewed event.
4. Integration into the workbench happens through **CP-DSL-004** (drafted here, executed in the main repo): vendor the package, register the ` ```atomik ` fence in `markdown-core`, mount a thin `<AtomikScene>` renderer, inject real grounding, route the projection flip through the patch pipeline, and update main-repo doc 19 + the reserved spec JSON (both stale vs v0.3) in the same work unit.

## Consequences

- The DSL advances without touching the workbench roadmap or the one-active-path rule; the main repo pulls M12 forward only by explicit owner amendment (CP-DSL-004 S00).
- All DSL execution state is file-durable here (paths, ledger, log), so any session can resume from the zip alone.
- Two repositories can drift; mitigation: the fixture + specs are the single source of truth, and CP-DSL-004 forbids re-implementing kernels app-side.

## Alternatives considered

- **Implement directly in the app renderer** — rejected: violates bedrock-14 invariants (core testable without Electron; renderers depend on core), and buries the fixture gate.
- **Vendor into the main monorepo now** — rejected: requires opening a second parent path or widening CP-MVP-002; nothing in the DSL blocks on the app.
- **Publish to npm** — rejected: ceremony without a consumer; vendoring by copy/subtree suffices.

## Migration / rollback

Vendoring = copy (or `git subtree`) of `packages/dsl-core` into the main repo; history import optional. Rollback = delete the vendored package; this repository remains the source of truth until CP-DSL-004 closes.

## Links

- Main repo: bedrock 14 (kernels/incubation), 19 (DSL future — to be updated at integration), 35 / ADR-009 (dual-plane template), register M12.
- Here: `docs/bedrock/00_00-orientation.md`, `atomik-project/coding-paths/CP-DSL-004.md`.
