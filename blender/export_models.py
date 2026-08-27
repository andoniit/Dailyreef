"""
Export reef models for the iOS app.

SceneKit cannot read glTF, so the same models the web app loads from
reef.glb are re-exported here. Driving both from one source keeps the two
clients showing the same fish.

    /Applications/Blender.app/Contents/MacOS/Blender --background \
        --python blender/export_models.py -- clownfish tang neon

With no names it exports every node in the glb.

Why PLY and not USDZ
--------------------
USDZ is Apple's format and the obvious first choice, but its importer
throws these models away. Every marking on them is a vertex colour — there
are no textures at all — and while Blender does write the colours out as
`primvars:displayColor`, ModelIO ignores that primvar completely: a loaded
USDZ exposes position and normal and nothing else, so the fish arrive flat
grey. PLY carries per-vertex colour as a first-class property, ModelIO
reads it, and the files come out roughly a third of the size.

Collapsing corner colours to per-vertex is lossless here: the colours
originate as glTF COLOR_0, which is per-vertex to begin with.
"""

import os
import sys

import bpy

HERE = os.path.dirname(os.path.abspath(__file__))

# Overridable so the export can be staged elsewhere if a sandbox or macOS
# privacy setting blocks Blender from reading the repo.
GLB = os.environ.get(
    "REEF_GLB", os.path.join(HERE, "..", "public", "models", "reef.glb")
)
OUT = os.path.abspath(
    os.environ.get(
        "REEF_MODELS_OUT",
        os.path.join(HERE, "..", "..", "dailyreef-ios", "Resources", "models"),
    )
)


def base_color(material):
    """The material's flat base colour, as linear RGB."""
    if material is None:
        return (1.0, 1.0, 1.0)
    if material.use_nodes:
        for node in material.node_tree.nodes:
            if node.type == "BSDF_PRINCIPLED":
                c = node.inputs["Base Color"].default_value
                return (c[0], c[1], c[2])
    c = material.diffuse_color
    return (c[0], c[1], c[2])


def bake_materials_into_colors(obj):
    """
    Fold each face's material colour into the mesh's vertex colours.

    PLY has no concept of materials — only per-vertex colour. The fish are
    coloured per-vertex so they survive on their own, but every coral,
    rock, plant and prop takes its colour from a glTF material, and those
    arrive in PLY as nothing at all: the whole reef renders white.

    Multiplying vertex colour by material base colour is exactly what
    glTF itself specifies (COLOR_0 * baseColorFactor), so this reproduces
    the web renderer's result rather than approximating it.
    """
    me = obj.data
    loops = len(me.loops)
    if loops == 0:
        return

    # Snapshot the source colours before adding a layer, so the read is
    # never aliased by the layer being written.
    source = me.color_attributes.active_color
    if source is not None and source.domain == "CORNER":
        existing = [tuple(source.data[i].color) for i in range(loops)]
    elif source is not None:  # POINT domain
        per_vert = [tuple(source.data[v.index].color) for v in me.vertices]
        existing = [per_vert[me.loops[i].vertex_index] for i in range(loops)]
    else:
        existing = [(1.0, 1.0, 1.0, 1.0)] * loops

    mats = [base_color(m) for m in me.materials] or [(1.0, 1.0, 1.0)]

    baked = me.color_attributes.new(
        name="baked", type="FLOAT_COLOR", domain="CORNER"
    )
    for poly in me.polygons:
        mc = mats[poly.material_index] if poly.material_index < len(mats) else mats[0]
        for li in poly.loop_indices:
            vc = existing[li]
            baked.data[li].color = (vc[0] * mc[0], vc[1] * mc[1], vc[2] * mc[2], 1.0)

    me.color_attributes.active_color = baked
    me.color_attributes.render_color_index = me.color_attributes.find("baked")


def export_one(obj, path):
    bake_materials_into_colors(obj)

    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj

    # Drop it to the origin so the app decides placement, not the export.
    original = tuple(obj.location)
    obj.location = (0.0, 0.0, 0.0)

    bpy.ops.wm.ply_export(
        filepath=path,
        export_selected_objects=True,
        export_normals=True,
        # sRGB bytes keep precision where the eye needs it; the shader
        # converts to linear before lighting
        export_colors="SRGB",
        export_uv=False,
        export_triangulated_mesh=True,
        ascii_format=False,
        # glTF is Y-up and so is SceneKit, but Blender is Z-up; without
        # this every model arrives on its side
        forward_axis="NEGATIVE_Z",
        up_axis="Y",
    )

    obj.location = original


def main():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []

    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=os.path.abspath(GLB))
    by_name = {o.name: o for o in bpy.context.scene.objects if o.type == "MESH"}
    print(f"[models] glb contains {len(by_name)} meshes")

    wanted = argv or sorted(by_name)
    missing = [n for n in wanted if n not in by_name]
    if missing:
        print(f"[models] NOT FOUND: {', '.join(missing)}")
        print(f"[models] available: {', '.join(sorted(by_name))}")

    os.makedirs(OUT, exist_ok=True)
    total = 0
    for name in wanted:
        obj = by_name.get(name)
        if obj is None:
            continue
        path = os.path.join(OUT, f"{name}.ply")
        export_one(obj, path)
        size = os.path.getsize(path)
        total += size
        print(f"[models] {name}.ply  {size / 1024:.0f} KB")

    print(f"[models] exported {len(wanted) - len(missing)} model(s), "
          f"{total / 1024 / 1024:.1f} MB total, to {OUT}")


main()
