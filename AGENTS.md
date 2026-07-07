# AGENTS.md — atomik-dsl bootstrap

This repository follows the Atomik dual-plane template (main-repo bedrock 35 / ADR-009): the **code plane** (`packages/`, `apps/`, `docs/`) and the **knowledge + execution plane** (`atomik-project/`). Execution state lives in files, never in a conversation thread.

```text
docs/bedrock        = what the DSL should be (specs, guide)
code + tests        = what currently exists
atomik-project/coding-paths = what this task will change, in what order, and where it stands
```

## Protocol (every session)

```text
1. Read this file.
2. Read atomik-project/index.md.
3. Open atomik-project/coding-paths/ACTIVE.md and follow it to the active path.
4. Verify reality against the Work Ledger:
   git status, base commit, dirty files, `npm test` state.
   If they disagree, reconcile and record the correction before anything else.
5. Read the documents listed under Required in the path's documentation coverage.
6. Note the Conditional triggers; read those documents when a trigger fires.
7. Confirm the Deliberately excluded list; do not silently widen scope.
8. Execute ONE path step at a time.
9. After each step, in the same work unit:
   update tests, update the Work Ledger checkpoint,
   update module notes / affected docs, append to atomik-project/log.md.
10. Generate a brief into atomik-project/briefs/ ONLY when handing work
    to another session, agent, or person.
```

If no active path exists: do not start coding. Propose one from the register (`atomik-project/coding-paths/index.md`) using the coding-path template, then execute.

## Standing prohibitions

```text
no work outside an accepted coding path
no change to the SceneIR shape without updating the golden fixture,
  the render-core spec, and the tests in the same work unit
the golden-fixture parity test is a merge gate; any diff there is a reviewed event
no eval / new Function / arbitrary JS anywhere in the runtime — AST interpretation only
lang/render kernels stay DOM-free, Electron-free, dependency-free
renderers depend on core, never the reverse; the renderer never re-parses source text
runtime purity: presentation is a pure function of (currentStep, inputs, committed)
no hidden canonical state: specs + fixtures + tests carry the truth
docs updated in the same work unit as code (self-evolving docs rule)
generated scenes: claim status required, never stronger than the source,
  no fabricated wikilinks (validator profile `generated`)
```

## Where things are

```text
packages/dsl-core/src/        the kernels (parse/validate/IR + present/layout)
packages/dsl-core/test/       65-test harness (node, zero deps): `npm test`
packages/dsl-core/fixtures/   golden north-star IR fixture + demo presets
apps/prototype-cycle/         end-to-end browser prototype; `npm run build:prototype`
docs/bedrock/                 language spec v0.3, pocket spec, render-core spec v0.1, guide (fr)
docs/adr/                     decision records (ADR-DSL-001: this repo's existence)
docs/modules/dsl-core.md      module note: API, invariants, common mistakes
atomik-project/               index, log, register, coding paths, sources (test corpus)
```

## Relationship to the main Atomik repository

This library is the reserved main-repo milestone **M12**. It matures here without touching the workbench roadmap, then is vendored as `packages/dsl-core` via `CP-DSL-004` (drafted, executes in the main repo). Main-repo docs 14 (kernels), 19 (DSL future — currently stale vs v0.3) and the reserved spec JSON are updated in that path, in the same work unit.
