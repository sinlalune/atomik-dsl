---
{
  "id": "dsl-00-orientation",
  "title": "atomik-dsl orientation",
  "status": "foundational",
  "tags": ["dsl", "orientation", "map"],
  "relations": [
    { "to": "atomik_dsl_spec_v0_3.md", "kind": "indexes" },
    { "to": "atomik_render_core_spec_v0_1.md", "kind": "indexes" },
    { "to": "../adr/ADR-DSL-001-standalone-dual-plane-library-repo.md", "kind": "created-by" }
  ],
  "agent": {
    "purpose": "Give any agent or human the map and reading order for the atomik DSL repository.",
    "invariants": [
      "The language spec defines meaning; the render-core spec defines the IR and rendering obligations; the guide is non-normative.",
      "The golden fixture is the executable acceptance test of both specs.",
      "This repository is main-repo milestone M12 maturing out-of-line; integration happens through CP-DSL-004."
    ]
  }
}
---

# atomik-dsl orientation

## What this repository is

The **atomik** DSL: a line-oriented, human-readable, cheap-LLM-generatable visualization language for learning, with an epistemic layer (claims, statuses, refutations, misconceptions) that Mermaid-class languages do not have. It ships as two kernels — lang (text → Scene IR) and render (IR → pure runtime + layout) — currently incubating in one package, `packages/dsl-core`, per the main repo's incubation rule (bedrock 14).

Naming note: the app is **Atomik**; the language is **atomik** (lowercase); the fence tag in Markdown pages is ` ```atomik `.

## Reading order

```text
1. atomik_dsl_spec_v0_3.md          the language: 16 keywords / 4 planes, vocab, semantics,
                                    rendering invariants (§7), generation profiles (§8)
2. atomik_pocket_spec_v0_3.md       the same, ≤2K tokens — what a generator model sees
3. atomik_render_core_spec_v0_1.md  the Scene IR (decisions D1–D11), layout contracts for
                                    11 archetypes (L1–L5), pure runtime, theme tokens,
                                    errata C1–C4 fed back to the language
4. atomik_guide_accessible_v0_3.md  the human on-ramp (French, non-normative)
```

The executable heart is `packages/dsl-core/fixtures/atomik_scene_ir_golden_northstar_v0_1.json`: canonical source + expected IR + runtime oracle for the north-star misconception scene. `npm test` enforces byte parity.

## Where decisions live

Locked design decisions are numbered inside the specs (D1–D11 in render-core §2.3; errata C1–C4 in §10 and folded into the language at v0.3.1). ADRs are extracted to `docs/adr/` only when a decision needs its own lifecycle; the first is ADR-DSL-001 (this repository's existence and vendoring target).

## Roadmap (register: `atomik-project/coding-paths/index.md`)

```text
D1  v0.3.1 consolidation + package hardening      CP-DSL-001 (done 2026-07-07)
D2  second archetype: flow                        next — not opened
D3  generability evaluation (small models ×
    adversarial corpus from batch-03)             not opened
D4  workbench integration = main-repo M12         CP-DSL-004 (draft; executes in main repo)
```

## Deviations from the main-repo template, assumed

- Bedrock files keep their original (unnumbered) filenames to preserve cross-references between specs, guide, and fixture; this orientation page plays the numbered-index role.
- A `README.md` exists for humans landing on the zip; `AGENTS.md` remains the canonical bootloader.
- `CP-DSL-004` was drafted before its milestone became next, at explicit owner request (2026-07-07); its scope freezes only at opening (S00).
