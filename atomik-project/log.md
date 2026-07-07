---
type: Atomik Project Log
title: atomik-dsl — log
---

# Log

## 2026-07-06

- Corpus stress test, 4 batches (30 ruptures across structural/temporal/epistemic expressiveness, small-model generability, pedagogical gestures). North-star fixed: the misconception scene (predict-then-see). → `sources/`
- Language spec **v0.3** shipped: 16 keywords / 4 planes, closed status vocabulary, addressable relations, authored/generated profiles. Pocket spec holds the ≤2K-token founding constraint (~1.1K). Accessible guide (fr).
- Render-core spec **v0.1** shipped: Scene IR (decisions D1–D11), layout contracts for 11 archetypes (L1–L5), pure runtime, theme-token obligations. Golden north-star fixture created (canonical source + expected IR + runtime oracle).
- Four errata fed back to the language (C1 reveal-anywhere hides initially; C2 `set` forbidden in rules; C3 transient notes; C4 gated-step semantics — found while writing the fixture's oracle).
- `cycle` archetype **end-to-end**: parser → IR → ring layout with satellites → pure runtime → interactive SVG prototype. **41/41 tests**, including byte-exact fixture parity and oracle A1–A7. Guide updated with the rendering section; C1–C4 now author-facing.

## 2026-07-07

- Decision: standalone dual-plane library repository, same template as the main Atomik repo; vendoring target `packages/dsl-core` at main-repo M12 (**ADR-DSL-001**).
- Repository initialized from the template. Register created (D1–D4). **CP-DSL-001** (v0.3.1 consolidation + package hardening) opened, active. **CP-DSL-004** (workbench integration) drafted early at owner request; executes in the main repo; scope freezes at its S00.
- Test suite verified from the package layout: 41 passed / 0 failed.
- **CP-DSL-001 S02** — language spec consolidated to **v0.3.1**: C1 (reveal-anywhere initial hiding, reveal+hide → hidden), C2 (`set` illegal in rules both profiles; the split effect grammar also records kernel-enforced step-only `require`), C3 (transient notes), C4 (gated steps withhold their own effects + block advancing; commitment-by-default spelled out) folded into §§2–6 + changelog §14. Pocket spec updated (effects line, visibility/gate note, gate comment in the choreography example): ≈1.2K tokens, ≤2K budget holds. Surface unchanged — files still begin `atomik 0.3`; golden fixture untouched; 41/41 green.
