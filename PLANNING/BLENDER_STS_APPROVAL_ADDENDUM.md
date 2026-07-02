# Blender STS Approval Addendum

Approved by the user: 2026-07-02.

This file records direct authorization that supersedes the stale `DRAFT` status lines in:

- `GRAY_MODEL_ART_LIBRARY_PSPR.md` — run GML-00 through GML-12 STS;
- `STURDY_VOLLEY_ASSET_LIBRARY_PSPR.md` — then run AL-0 through AL-17 STS.

The rosters execute sequentially. The inherited `MASTER_ROSTER.md` §0 gate, per-prompt
DEVLOG/commit discipline, and STS push-per-prompt authorization remain binding.

## Direct execution refinements

1. Blender 5.1 is the full-time source-art environment for production geometry. Final assets
   keep editable `.blend` source and export `.glb` for Babylon. `.obj` is optional interchange.
2. Every file under `art-production/current-direction/` contributes canonical reference.
   Every identifiable element receives an explicit item-level manifest disposition: unique
   3D asset, modular/variant asset, scene/material/effect reference, or non-mesh reference.
3. The five existing Q-demo `.glb` files are rejected non-production prototypes. Do not
   integrate, clean up, or use them as quality targets. Rebuild their subjects from scratch.
4. Every production model ships with a simple standardized 3/4 proof PNG. Geometry-changing
   state, upgrade, growth, and body variants receive their own proof. No proof means no pass.
5. The canonical per-model bundle is `.blend`, `.glb`, `_preview.png`, and `.asset.json`.

These refinements change authoring and evidence requirements without weakening either
roster's scope, acceptance criteria, asset contract, performance budgets, or game integration
gates.
