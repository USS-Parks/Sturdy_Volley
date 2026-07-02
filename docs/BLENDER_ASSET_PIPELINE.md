# Blender Asset Pipeline

Blender 5.1 is the editable source-art environment for Sturdy Volley. Babylon consumes
validated `.glb`; `.obj` is optional interchange only.

## Canonical per-model bundle

Each production model shares one basename and directory:

- `<asset>.blend`
- `<asset>.glb`
- `<asset>_preview.png`
- `<asset>.asset.json`

Geometry-changing state, growth, body, restoration, and upgrade variants receive separate
preview PNGs. All proof renders use the shared helper in `tools/blender/sturdy_asset.py`:
768 × 768, orthographic three-quarter camera, neutral studio lights, dark neutral background,
and a readable ground shadow. Atmosphere, fog, bloom, depth of field, and painterly post are
excluded so the proof cannot flatter weak geometry.

## Coordinate and origin policy

- Blender source is Z-up; glTF export converts to Y-up with +Z forward for Babylon.
- One Blender metre is one Babylon unit.
- Static model origins sit at the center of the bottom contact plane.
- Visible render geometry and collision/navigation foundations remain separate.
- Names follow the asset contract (`sv_<family>_<kebab-id>`).

## GML-01 smoke proof

The non-production core smoke artifact exercises primitive creation, material reuse,
base-contact origins, orthographic proof rendering, selected-object GLB export, editable
`.blend` save, and descriptor output. Run it with Blender in background mode:

```powershell
& 'C:\Program Files\Blender Foundation\Blender 5.1\blender.exe' --background --python-exit-code 1 --python tools/blender/gml01_core_proof.py -- .tmp/blender-gml01-proof
```

The output is deliberately ignored and is not a game model. Production families begin in
the following GML prompts, and every one inherits the same proof contract.
