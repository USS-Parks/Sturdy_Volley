"""Shared Blender 5.1 helpers for deterministic Sturdy Volley asset proofs."""

from __future__ import annotations

from pathlib import Path

import bpy
from mathutils import Vector


def reset_scene() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for datablocks in (bpy.data.meshes, bpy.data.curves, bpy.data.materials, bpy.data.cameras, bpy.data.lights):
        for datablock in list(datablocks):
            if datablock.users == 0:
                datablocks.remove(datablock)


def material(name: str, color: tuple[float, float, float, float]) -> bpy.types.Material:
    existing = bpy.data.materials.get(name)
    if existing is not None:
        return existing
    result = bpy.data.materials.new(name)
    result.diffuse_color = color
    result.roughness = 1.0
    result.metallic = 0.0
    return result


def add_box(
    name: str,
    dimensions: tuple[float, float, float],
    location: tuple[float, float, float] = (0.0, 0.0, 0.0),
    asset_material: bpy.types.Material | None = None,
) -> bpy.types.Object:
    """Create a Z-up box whose origin is centered on its bottom contact plane."""
    width, depth, height = dimensions
    x, y, z = location
    bpy.ops.mesh.primitive_cube_add(location=(x, y, z + height / 2.0))
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = (width, depth, height)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    bpy.context.scene.cursor.location = (x, y, z)
    bpy.ops.object.origin_set(type="ORIGIN_CURSOR", center="MEDIAN")
    if asset_material is not None:
        obj.data.materials.append(asset_material)
    return obj


def add_cylinder(
    name: str,
    radius: float,
    height: float,
    vertices: int = 8,
    location: tuple[float, float, float] = (0.0, 0.0, 0.0),
    asset_material: bpy.types.Material | None = None,
) -> bpy.types.Object:
    x, y, z = location
    bpy.ops.mesh.primitive_cylinder_add(vertices=max(3, vertices), radius=radius, depth=height, location=(x, y, z + height / 2.0))
    obj = bpy.context.object
    obj.name = name
    bpy.context.scene.cursor.location = (x, y, z)
    bpy.ops.object.origin_set(type="ORIGIN_CURSOR", center="MEDIAN")
    if asset_material is not None:
        obj.data.materials.append(asset_material)
    return obj


def add_icosphere(
    name: str,
    radius: float,
    subdivisions: int = 1,
    location: tuple[float, float, float] = (0.0, 0.0, 0.0),
    asset_material: bpy.types.Material | None = None,
) -> bpy.types.Object:
    x, y, z = location
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=max(1, subdivisions), radius=radius, location=(x, y, z + radius))
    obj = bpy.context.object
    obj.name = name
    bpy.context.scene.cursor.location = (x, y, z)
    bpy.ops.object.origin_set(type="ORIGIN_CURSOR", center="MEDIAN")
    if asset_material is not None:
        obj.data.materials.append(asset_material)
    return obj


def _point_at(obj: bpy.types.Object, target: tuple[float, float, float]) -> None:
    direction = Vector(target) - obj.location
    obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


def setup_proof_stage(target: tuple[float, float, float], extent: float) -> bpy.types.Camera:
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 768
    scene.render.resolution_y = 768
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.film_transparent = False
    scene.world.color = (0.055, 0.06, 0.07)

    bpy.ops.mesh.primitive_plane_add(size=max(20.0, extent * 5.0), location=(target[0], target[1], 0.0))
    ground = bpy.context.object
    ground.name = "proof-ground"
    ground.data.materials.append(material("proof-ground-material", (0.16, 0.17, 0.18, 1.0)))
    ground["proof_only"] = True

    camera_data = bpy.data.cameras.new("proof-camera")
    camera = bpy.data.objects.new("proof-camera", camera_data)
    bpy.context.collection.objects.link(camera)
    camera.location = (target[0] + extent * 2.2, target[1] - extent * 2.2, target[2] + extent * 1.75)
    camera_data.type = "ORTHO"
    camera_data.ortho_scale = extent * 2.7
    _point_at(camera, target)
    scene.camera = camera

    for name, location, energy, size in (
        ("proof-key", (target[0] - extent * 1.5, target[1] - extent * 1.5, target[2] + extent * 2.4), 1100.0, extent * 2.0),
        ("proof-fill", (target[0] + extent * 1.8, target[1] + extent * 0.5, target[2] + extent * 1.2), 650.0, extent * 2.5),
    ):
        light_data = bpy.data.lights.new(name, "AREA")
        light_data.energy = energy
        light_data.shape = "DISK"
        light_data.size = size
        light = bpy.data.objects.new(name, light_data)
        bpy.context.collection.objects.link(light)
        light.location = location
        _point_at(light, target)

    return camera_data


def render_preview(path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    bpy.context.scene.render.filepath = str(path)
    bpy.ops.render.render(write_still=True)


def save_blend(path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(path))


def export_glb(path: Path, export_objects: list[bpy.types.Object]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.object.select_all(action="DESELECT")
    for obj in export_objects:
        obj.select_set(True)
    if export_objects:
        bpy.context.view_layer.objects.active = export_objects[0]
    bpy.ops.export_scene.gltf(
        filepath=str(path),
        export_format="GLB",
        use_selection=True,
        export_yup=True,
        export_apply=True,
    )
