"""
Export reef models as USDZ for the iOS app.

SceneKit cannot read glTF, so the same models the web app loads from
reef.glb are re-exported here as USDZ. Driving both from one source keeps
the two clients showing the same fish — hand-maintaining a second set of
models would guarantee they drift apart.

    /Applications/Blender.app/Contents/MacOS/Blender --background \
        --python blender/export_usdz.py -- clownfish tang neon

With no names it exports every node in the glb.

Notes on the two conversions that matter:
  * glTF is Y-up, Blender is Z-up, USDZ is Y-up. The importer converts on
    the way in and `convert_orientation` converts back on the way out.
  * The models carry no textures at all — every marking is a vertex
    colour — so `export_mesh_colors` is what makes them anything other
    than flat grey.
"""

import os
import sys

import bpy

HERE = os.path.dirname(os.path.abspath(__file__))

# Overridable because macOS may deny Blender.app read access to folders
# like ~/Documents (TCC). When that bites, stage the glb somewhere
# readable and point these at it rather than granting Full Disk Access.
GLB = os.environ.get(
    "REEF_GLB", os.path.join(HERE, "..", "public", "models", "reef.glb")
)
OUT = os.path.abspath(
    os.environ.get(
        "REEF_USDZ_OUT",
        os.path.join(HERE, "..", "..", "dailyreef-ios", "Resources", "models"),
    )
)


def clear_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def import_glb():
    bpy.ops.import_scene.gltf(filepath=os.path.abspath(GLB))
    return [o for o in bpy.context.scene.objects if o.type == "MESH"]


def export_one(obj, path):
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj

    # Drop it to the origin so the app positions it, not the export.
    original = tuple(obj.location)
    obj.location = (0.0, 0.0, 0.0)

    bpy.ops.wm.usd_export(
        filepath=path,
        selected_objects_only=True,
        export_materials=True,
        export_mesh_colors=True,
        export_normals=True,
        export_uvmaps=True,
        export_animation=False,
        export_cameras=False,
        export_lights=False,
        generate_preview_surface=True,
        convert_orientation=True,
        export_global_up_selection="Y",
        export_global_forward_selection="-Z",
        triangulate_meshes=True,
        overwrite_textures=True,
    )

    obj.location = original


def main():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []

    clear_scene()
    meshes = import_glb()
    by_name = {o.name: o for o in meshes}
    print(f"[usdz] glb contains {len(meshes)} meshes")

    wanted = argv or sorted(by_name)
    missing = [n for n in wanted if n not in by_name]
    if missing:
        print(f"[usdz] NOT FOUND in glb: {', '.join(missing)}")
        print(f"[usdz] available: {', '.join(sorted(by_name))}")

    os.makedirs(OUT, exist_ok=True)
    done = []
    for name in wanted:
        obj = by_name.get(name)
        if obj is None:
            continue
        path = os.path.join(OUT, f"{name}.usdz")
        export_one(obj, path)
        size = os.path.getsize(path) if os.path.exists(path) else 0
        print(f"[usdz] {name}.usdz  {size / 1024:.0f} KB")
        done.append(name)

    print(f"[usdz] exported {len(done)} model(s) to {OUT}")


main()
