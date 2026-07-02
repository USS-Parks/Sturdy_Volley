"""Generate the GML-01 deterministic Blender core/proof smoke artifact."""

from __future__ import annotations

import json
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPT_DIR))

from sturdy_asset import (  # noqa: E402
    add_box,
    add_cylinder,
    add_icosphere,
    export_glb,
    material,
    render_preview,
    reset_scene,
    save_blend,
    setup_proof_stage,
)


def output_dir() -> Path:
    if "--" in sys.argv:
        args = sys.argv[sys.argv.index("--") + 1 :]
        if args:
            return Path(args[0]).resolve()
    return (Path.cwd() / ".tmp" / "blender-gml01-proof").resolve()


def main() -> None:
    destination = output_dir()
    destination.mkdir(parents=True, exist_ok=True)
    reset_scene()

    neutral = material("sv-gray-neutral", (0.52, 0.55, 0.58, 1.0))
    warm = material("sv-gray-warm", (0.58, 0.49, 0.40, 1.0))
    objects = [
        add_box("sv_prop_gml01-core-proof_body", (1.8, 1.4, 1.2), asset_material=neutral),
        add_cylinder("sv_prop_gml01-core-proof_post", 0.18, 1.8, 8, (-0.62, 0.0, 1.2), warm),
        add_icosphere("sv_prop_gml01-core-proof_cap", 0.34, 1, (-0.62, 0.0, 3.0), warm),
    ]
    setup_proof_stage(target=(0.0, 0.0, 1.45), extent=2.2)

    base = destination / "sv_prop_gml01-core-proof"
    render_preview(base.with_name(f"{base.name}_preview.png"))
    export_glb(base.with_suffix(".glb"), objects)
    save_blend(base.with_suffix(".blend"))
    descriptor = {
        "id": "sv_prop_gml01-core-proof",
        "purpose": "GML-01 helper and standardized 3/4 proof smoke artifact",
        "productionAsset": False,
        "sourceRefs": ["A-004", "A-005", "A-007"],
        "dimensionsMetres": [1.8, 3.34, 1.4],
        "proof": {"camera": "orthographic-three-quarter", "resolution": [768, 768]},
    }
    base.with_suffix(".asset.json").write_text(json.dumps(descriptor, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"ok": True, "output": str(destination), "files": 4}))


if __name__ == "__main__":
    main()
