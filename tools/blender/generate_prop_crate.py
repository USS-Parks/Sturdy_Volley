"""Build the first production Sturdy Volley asset: a faceted produce crate."""

from __future__ import annotations

import json
import math
import sys
from pathlib import Path

import bpy

SCRIPT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPT_DIR))

from sturdy_asset import export_glb, render_preview, reset_scene, save_blend, setup_proof_stage  # noqa: E402


ASSET_ID = "sv_prop_crate"
SOURCE_REFS = [
    "J-140 item/prop master sheet",
    "N-203–212 props, decor, and interiors",
    "P-230 world poster farm foreground",
    "A-004 shape language",
    "A-005 materials board",
]

WOOD_COLORS = [
    (0.34, 0.16, 0.075, 1.0),
    (0.43, 0.22, 0.095, 1.0),
    (0.52, 0.29, 0.13, 1.0),
    (0.27, 0.12, 0.055, 1.0),
]


def vertex_wood_material() -> bpy.types.Material:
    result = bpy.data.materials.new("sv-mat-wood-vertex")
    result.use_nodes = True
    result.roughness = 1.0
    nodes = result.node_tree.nodes
    links = result.node_tree.links
    for node in list(nodes):
        nodes.remove(node)
    output = nodes.new("ShaderNodeOutputMaterial")
    shader = nodes.new("ShaderNodeBsdfPrincipled")
    color = nodes.new("ShaderNodeVertexColor")
    color.layer_name = "Color"
    shader.inputs["Roughness"].default_value = 0.88
    shader.inputs["Metallic"].default_value = 0.0
    links.new(color.outputs["Color"], shader.inputs["Base Color"])
    links.new(shader.outputs["BSDF"], output.inputs["Surface"])
    return result


def add_board(
    name: str,
    dimensions: tuple[float, float, float],
    location: tuple[float, float, float],
    rotation_y: float,
    color: tuple[float, float, float, float],
    asset_material: bpy.types.Material,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cube_add(location=location, rotation=(0.0, rotation_y, 0.0))
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = dimensions
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(asset_material)
    attribute = obj.data.color_attributes.new(name="Color", type="BYTE_COLOR", domain="CORNER")
    for datum in attribute.data:
        datum.color = color
    for polygon in obj.data.polygons:
        polygon.use_smooth = False
    return obj


def build_crate() -> bpy.types.Object:
    wood = vertex_wood_material()
    parts: list[bpy.types.Object] = []
    color_index = 0

    def board(
        label: str,
        dimensions: tuple[float, float, float],
        location: tuple[float, float, float],
        rotation_y: float = 0.0,
    ) -> None:
        nonlocal color_index
        parts.append(add_board(
            f"{ASSET_ID}_{label}",
            dimensions,
            location,
            rotation_y,
            WOOD_COLORS[color_index % len(WOOD_COLORS)],
            wood,
        ))
        color_index += 1

    # Four sturdy corner posts establish the silhouette and bottom-contact bounds.
    for x in (-0.35, 0.35):
        for y in (-0.35, 0.35):
            board(f"corner-{len(parts):02d}", (0.10, 0.10, 0.68), (x, y, 0.34))

    # Three separated slats on every side keep the crate readable at the game camera.
    for z in (0.14, 0.33, 0.52):
        board(f"front-slat-{len(parts):02d}", (0.64, 0.065, 0.14), (0.0, -0.37, z))
        board(f"back-slat-{len(parts):02d}", (0.64, 0.065, 0.14), (0.0, 0.37, z))
        board(f"left-slat-{len(parts):02d}", (0.065, 0.64, 0.14), (-0.37, 0.0, z))
        board(f"right-slat-{len(parts):02d}", (0.065, 0.64, 0.14), (0.37, 0.0, z))

    # Bottom slats leave honest gaps instead of hiding a solid cube inside.
    for y in (-0.24, -0.08, 0.08, 0.24):
        board(f"bottom-slat-{len(parts):02d}", (0.64, 0.13, 0.06), (0.0, y, 0.03))

    # A pronounced top rim gives the prop a clean gameplay silhouette.
    board("rim-front", (0.80, 0.09, 0.09), (0.0, -0.355, 0.655))
    board("rim-back", (0.80, 0.09, 0.09), (0.0, 0.355, 0.655))
    board("rim-left", (0.09, 0.62, 0.09), (-0.355, 0.0, 0.655))
    board("rim-right", (0.09, 0.62, 0.09), (0.355, 0.0, 0.655))

    # Opposed braces provide an original handmade, repaired-farm character.
    brace_angle = math.atan2(0.40, 0.54)
    brace_length = math.hypot(0.40, 0.54)
    board("front-brace", (brace_length, 0.045, 0.065), (0.0, -0.407, 0.34), -brace_angle)
    board("back-brace", (brace_length, 0.045, 0.065), (0.0, 0.407, 0.34), brace_angle)

    bpy.ops.object.select_all(action="DESELECT")
    for part in parts:
        part.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.join()
    crate = bpy.context.object
    crate.name = ASSET_ID
    bpy.context.scene.cursor.location = (0.0, 0.0, 0.0)
    bpy.ops.object.origin_set(type="ORIGIN_CURSOR", center="MEDIAN")
    crate["asset_id"] = ASSET_ID
    crate["source_refs"] = json.dumps(SOURCE_REFS)
    crate["units"] = "metres"
    crate["forward_axis"] = "+Y source / +Z glTF runtime"
    return crate


def triangle_count(obj: bpy.types.Object) -> int:
    return sum(max(0, len(polygon.vertices) - 2) for polygon in obj.data.polygons)


def export_obj(path: Path, obj: bpy.types.Object) -> None:
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.wm.obj_export(filepath=str(path), export_selected_objects=True, export_materials=False)


def main() -> None:
    root = Path.cwd() / "art-production" / "3d-assets" / "props" / ASSET_ID
    root.mkdir(parents=True, exist_ok=True)
    reset_scene()
    crate = build_crate()

    setup_proof_stage(target=(0.0, 0.0, 0.34), extent=0.72)
    bpy.data.lights['proof-key'].energy = 180.0
    bpy.data.lights['proof-fill'].energy = 90.0
    bpy.context.scene.world.color = (0.025, 0.028, 0.032)
    preview_path = root / f"{ASSET_ID}_preview.png"
    render_preview(preview_path)

    glb_path = root / f"{ASSET_ID}.glb"
    obj_path = root / f"{ASSET_ID}.obj"
    blend_path = root / f"{ASSET_ID}.blend"
    export_glb(glb_path, [crate])
    export_obj(obj_path, crate)
    save_blend(blend_path)

    triangles = triangle_count(crate)
    descriptor = {
        "id": ASSET_ID,
        "status": "production-candidate",
        "family": "prop",
        "sourceRefs": SOURCE_REFS,
        "dimensionsMetres": [0.80, 0.68, 0.814],
        "origin": "bottom-center",
        "triangles": triangles,
        "materials": 1,
        "runtimeFormat": "glb",
        "editableSource": f"{ASSET_ID}.blend",
        "interchange": f"{ASSET_ID}.obj",
        "proof": {
            "file": f"{ASSET_ID}_preview.png",
            "camera": "orthographic-three-quarter",
            "resolution": [768, 768],
            "neutralStudio": True,
        },
        "collisionPolicy": "separate primitive proxy; render mesh is not collision",
        "notes": "Original open produce crate with slatted sides, top rim, and opposed repair braces.",
    }
    (root / f"{ASSET_ID}.asset.json").write_text(
        json.dumps(descriptor, indent=2) + "\n",
        encoding="utf-8",
    )
    print(json.dumps({
        "ok": True,
        "asset": ASSET_ID,
        "directory": str(root),
        "triangles": triangles,
        "materials": 1,
        "files": 5,
    }))


if __name__ == "__main__":
    main()
