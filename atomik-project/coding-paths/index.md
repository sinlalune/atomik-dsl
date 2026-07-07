---
type: Atomik Coding Path Register
title: Coding path register — DSL roadmap to execution mapping
timestamp: 2026-07-07T00:00:00Z
---

# Coding path register

The bedrock (specs) carries the whole DSL vision; this register sequences it; a coding path executes one bounded slice. Every milestone is accounted for below — active, drafted, reserved, or not yet opened. No milestone is silently unassigned.

## Opening rule

Paths open just-in-time, when their milestone becomes next: seed from the milestone row and the coding-path template (main-repo bedrock 24), pass the coverage audit (every bedrock document of this repo accounted for at least once), one active parent path at a time (`ACTIVE.md` points to it), never widen a closing path to absorb the next milestone.

Exception on record: `CP-DSL-004` was drafted before its turn, at explicit owner request (2026-07-07). Drafting ≠ opening; its scope freezes only at S00, and it executes in the **main Atomik repository** (it is main-repo milestone M12 seen from here).

## Register

| milestone | scope | path | status |
|---|---|---|---|
| D1 | v0.3.1 consolidation (fold errata C1–C4) + package hardening (lang/render split, types) | [CP-DSL-001](./CP-DSL-001.md) | active |
| D2 | second archetype: `flow` (layered layout against the L-contracts) | — | not opened |
| D3 | generability evaluation: pocket spec × small models × adversarial corpus (batch-03) | — | not opened |
| D4 | workbench integration — fenced ` ```atomik ` blocks rendered in Atomik (= main-repo M12) | [CP-DSL-004](./CP-DSL-004.md) | draft (executes in main repo) |
