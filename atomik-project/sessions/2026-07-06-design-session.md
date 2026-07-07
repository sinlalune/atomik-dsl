---
type: Atomik Session Note
title: Session de conception — du corpus au prototype cycle (2026-07-06)
tags: [session, dsl]
timestamp: 2026-07-06T23:59:00Z
---

# Session de conception du DSL (résumé)

Journée unique, quatre mouvements, tous livrés dans ce dépôt :

1. **Corpus de stress** (sources/atomik-corpus-test-batch-01..04) : 30 ruptures identifiées sur 4 axes — expressivité structurelle/temporelle/épistémique, générabilité petit-modèle, gestes pédagogiques. Étoile polaire retenue : le cas-méprise (predict-then-see).
2. **Langage v0.3** (docs/bedrock/atomik_dsl_spec_v0_3.md) : 16 mots-clés / 4 plans, statuts épistémiques fermés, relations adressables, profils authored/generated. Pocket spec ≤ 2K tokens tenue. Guide accessible en français.
3. **Render-core v0.1** (docs/bedrock/atomik_render_core_spec_v0_1.md) : Scene IR (décisions D1–D11), contrats de layout des 11 archétypes (L1–L5), runtime pur, jetons de thème. Quatre errata renvoyés vers le langage (C1–C4), dont C4 (step à porte) découvert en écrivant l'oracle du fixture doré.
4. **Prototype bout-en-bout** (apps/prototype-cycle) : parseur → IR → layout cycle → runtime → SVG interactif. 41/41 tests, dont parité octet-pour-octet avec le fixture doré et oracle A1–A7.

Décision du 2026-07-07 : dépôt autonome dual-plane (ADR-DSL-001), consolidation v0.3.1 comme premier chemin actif (CP-DSL-001), intégration workbench rédigée en avance à la demande du propriétaire (CP-DSL-004, s'exécute dans le dépôt principal).
