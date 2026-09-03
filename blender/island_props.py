"""
Model the island's palm and rock outcrop, and export them for the app.

    /Applications/Blender.app/Contents/MacOS/Blender --background \
        --python blender/island_props.py

Everything else standing in the tank comes out of `reef.blend` through
`export_models.py`. These two do not: the island is built procedurally in
both clients, so the palm and the rock it wears were written as triangle
soup in Swift and there was nothing to export. That is why they are the
least convincing things in the scene — they are code output, not
modelling, and every change to them meant tuning sine waves.

This builds them as real geometry instead, with bevels and subdivision
doing the work that hand-written triangles cannot, then bakes the result
down the same PLY path the fish already use. The app loads them through
`ReefModelStore` like any other model.

Generated rather than saved in a .blend on purpose: the shapes are still
being tuned, and a script that re-runs is far easier to adjust than a
binary someone has to open. Re-run it after editing; it overwrites.
"""

import math
import os
import sys

import bmesh
import bpy
from mathutils import Matrix, Vector

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.abspath(
    os.environ.get(
        "REEF_MODELS_OUT",
        os.path.join(HERE, "..", "..", "dailyreef-ios", "Resources", "models"),
    )
)


# ── colour ────────────────────────────────────────────────────────────
#
# Authored as hex because that is how the catalog and the Swift code
# speak, but Blender's colour attributes are linear and the exporter
# converts back to sRGB on the way out. Handing it sRGB bytes directly
# would double-convert and wash everything pale.

def srgb(hexcode):
    """`#rrggbb` as linear RGB."""
    h = hexcode.lstrip("#")
    out = []
    for i in (0, 2, 4):
        c = int(h[i:i + 2], 16) / 255
        out.append(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4)
    return tuple(out)


def shade(colour, factor):
    """The same colour, lighter or darker, for turning a form."""
    return tuple(min(1.0, c * factor) for c in colour)


# ── mesh plumbing ─────────────────────────────────────────────────────

def finish(obj, face_colour):
    """Triangulate, colour per face, and shade it.

    `face_colour` is called with each polygon and returns linear RGB. Per
    *face* rather than per vertex because that is what the loader wants:
    it collapses each triangle's three corners onto one palette texel, so
    a gradient across a face would be thrown away anyway.
    """
    me = obj.data

    bm = bmesh.new()
    bm.from_mesh(me)
    bmesh.ops.triangulate(bm, faces=bm.faces[:])
    bm.to_mesh(me)
    bm.free()

    attr = me.color_attributes.new(name="baked", type="FLOAT_COLOR", domain="CORNER")
    for poly in me.polygons:
        c = face_colour(poly)
        for li in poly.loop_indices:
            attr.data[li].color = (c[0], c[1], c[2], 1.0)
    me.color_attributes.active_color = attr
    me.color_attributes.render_color_index = me.color_attributes.find("baked")


def export(obj, name):
    """Write one object, with the settings the Swift loader expects.

    Axes matter: Blender is Z-up and RealityKit is Y-up, so without the
    conversion every model arrives on its side. Same flags as
    `export_models.py` — if one of these changes, both have to.
    """
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    obj.location = (0.0, 0.0, 0.0)

    path = os.path.join(OUT, f"{name}.ply")
    bpy.ops.wm.ply_export(
        filepath=path,
        export_selected_objects=True,
        export_normals=True,
        export_colors="SRGB",
        export_uv=False,
        export_triangulated_mesh=True,
        ascii_format=False,
        forward_axis="NEGATIVE_Z",
        up_axis="Y",
    )
    tris = len(obj.data.polygons)
    print(f"[island] {name}.ply  {os.path.getsize(path) / 1024:.0f} KB  {tris} tris")


def join(objs, name):
    """Fuse separately-coloured parts into one exportable object.

    `finish` colours a whole object through one function, which is fine
    for a palm and hopeless for something made of thatch, timber and
    bark. Building each material as its own object and joining afterwards
    keeps the colour rules simple; the colour attributes merge because
    they share a name and domain.
    """
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join()
    joined = bpy.context.view_layer.objects.active
    joined.name = name
    return joined


def box(bm, centre, size):
    """An axis-aligned box, as eight verts and six faces."""
    hx, hy, hz = size[0] / 2, size[1] / 2, size[2] / 2
    c = Vector(centre)
    corners = [
        bm.verts.new(c + Vector((sx * hx, sy * hy, sz * hz)))
        for sz in (-1, 1) for sy in (-1, 1) for sx in (-1, 1)
    ]
    # indices into `corners`, wound outwards
    for quad in ((0, 1, 3, 2), (4, 6, 7, 5), (0, 4, 5, 1),
                 (2, 3, 7, 6), (0, 2, 6, 4), (1, 5, 7, 3)):
        bm.faces.new([corners[i] for i in quad])


def hash01(a, b):
    """A repeatable 0..1 from two numbers.

    A fixed list of hem depths was tried first and read as a machine-cut
    sawtooth — the eye finds the period immediately. Hashing the position
    gives an edge with no rhythm to it, which is what hand-trimmed reed
    actually looks like.
    """
    v = math.sin(a * 127.1 + b * 311.7) * 43758.5453
    return v - math.floor(v)


def new_object(name, bm):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    obj = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(obj)
    return obj


# ── the palm ──────────────────────────────────────────────────────────

TRUNK_LIT = srgb("#b08355")
TRUNK_DARK = srgb("#6b452a")
FROND_LIT = srgb("#7ac943")
FROND_DEEP = srgb("#3d8c37")
NUT = srgb("#6b4326")

TRUNK_STEPS = 26
TRUNK_SIDES = 12
TRUNK_HEIGHT = 1.05
# How far the top drifts from the base. Palms almost never grow straight,
# and a vertical one reads as a lamp post.
LEAN = Vector((0.24, 0.08))


def trunk_at(s):
    """Centre and radius of the trunk a fraction `s` up its length."""
    centre = Vector((LEAN.x * s * s, LEAN.y * s * s, TRUNK_HEIGHT * s))
    # Tapering, with the ring banding that reads as a palm rather than a
    # pole. Shallower than the Swift version — that modulated by 8.5% and
    # at this size it looked corrugated.
    # Slim. At 0.082 the trunk was half the width of the hut beside it,
    # which makes a palm look like a pillar.
    radius = 0.054 * (1 - s * 0.42) * (1 + math.sin(s * 9 * math.tau) * 0.060)
    return centre, radius


def build_trunk(bm):
    rings = []
    for i in range(TRUNK_STEPS + 1):
        s = i / TRUNK_STEPS
        centre, radius = trunk_at(s)
        ring = []
        for j in range(TRUNK_SIDES):
            a = j / TRUNK_SIDES * math.tau
            ring.append(bm.verts.new((
                centre.x + math.cos(a) * radius,
                centre.y + math.sin(a) * radius,
                centre.z,
            )))
        rings.append(ring)

    faces = []
    for i in range(TRUNK_STEPS):
        for j in range(TRUNK_SIDES):
            k = (j + 1) % TRUNK_SIDES
            faces.append(bm.faces.new(
                (rings[i][j], rings[i][k], rings[i + 1][k], rings[i + 1][j])))
    # Cap the base so the trunk is a closed solid; an open tube shows its
    # inside wherever the island slopes away under it.
    faces.append(bm.faces.new(rings[0][::-1]))
    return faces


def build_frond(bm, yaw, tilt, length, width):
    """One leaf: a blade that arcs up, droops, and folds along its midrib.

    Broad and smoothly scalloped rather than the sawtooth the Swift
    version used. That alternation was there to fake leaflets for free,
    and at tank scale it read as a torn edge; a solid blade with a folded
    spine is both cleaner and closer to the reference.
    """
    n = 26
    spine = Matrix.Rotation(yaw, 4, "Z") @ Matrix.Rotation(-tilt, 4, "Y")

    rows = []
    for i in range(n + 1):
        s = i / n
        # Up, then over: the arc peaks early and the tip hangs.
        lift = 0.34 * math.sin(s * 2.05) - 0.70 * s * s
        # Fat in the middle, pointed at both ends.
        profile = math.sin(math.pi * min(s * 1.05, 1.0) ** 0.72) ** 0.85
        # A gentle scallop, four to a side, riding on the profile.
        scallop = 1 - 0.12 * (0.5 - 0.5 * math.cos(s * 8 * math.tau))
        w = width * profile * scallop
        rise = 0.05 * (1 - s * 0.75)          # the midrib stands proud
        drop = 0.075 * profile ** 1.5         # the edges fall away
        rows.append([
            spine @ Vector((length * s, -w, lift - drop)),
            spine @ Vector((length * s, 0.0, lift + rise)),
            spine @ Vector((length * s, w, lift - drop)),
        ])

    verts = [[bm.verts.new(p) for p in row] for row in rows]
    faces = []
    for i in range(n):
        for c in (0, 1):
            faces.append(bm.faces.new((
                verts[i][c], verts[i + 1][c], verts[i + 1][c + 1], verts[i][c + 1])))
    return faces


def build_palm():
    bm = bmesh.new()

    trunk_faces = set(f.index for f in [])  # filled after indexing below
    trunk = build_trunk(bm)
    trunk_marker = set(id(f) for f in trunk)

    crown = Vector((LEAN.x, LEAN.y, TRUNK_HEIGHT))
    frond_marker = set()
    count = 9
    for i in range(count):
        yaw = i / count * math.tau + (i % 3) * 0.11
        # A spread of tilts, so the crown has depth instead of forming a
        # flat parasol.
        tilt = 0.10 + (i % 4) * 0.20
        scale = 0.88 + (i % 3) * 0.09
        made = build_frond(bm, yaw, tilt, 0.82 * scale, 0.155 * scale)
        for f in made:
            frond_marker.add(id(f))
            for v in f.verts:
                pass
        # Lift the whole leaf onto the crown.
        for v in {v for f in made for v in f.verts}:
            v.co += crown

    # Coconuts, tucked under the crown.
    nut_marker = set()
    for i in range(3):
        a = i / 3 * math.tau
        centre = crown + Vector((math.cos(a) * 0.062, math.sin(a) * 0.062, -0.055))
        made = bmesh.ops.create_icosphere(bm, subdivisions=2, radius=0.044)
        for v in made["verts"]:
            v.co += centre
        for f in {f for v in made["verts"] for f in v.link_faces}:
            nut_marker.add(id(f))

    obj = new_object("palm", bm)

    # Smooth everything except the coconuts is wrong — the trunk wants the
    # banding to catch light, so it is smoothed too and the banding comes
    # from colour rather than from facets.
    for poly in obj.data.polygons:
        poly.use_smooth = True

    # Re-derive which face is what from geometry: bmesh indices do not
    # survive `to_mesh`, and matching on position is stable where
    # matching on identity is not.
    def face_colour(poly):
        z = poly.center.z
        if z > TRUNK_HEIGHT - 0.14:
            # Crown height: leaf or nut. Nuts sit tight to the axis.
            radial = math.hypot(poly.center.x - crown.x, poly.center.y - crown.y)
            if radial < 0.11 and poly.center.z < TRUNK_HEIGHT + 0.02:
                return NUT
            reach = min(radial / 0.85, 1.0)
            return tuple(FROND_DEEP[i] + (FROND_LIT[i] - FROND_DEEP[i])
                         * (0.30 + reach * 0.55) for i in range(3))
        # Trunk: banded, lit on the ridges.
        s = max(0.0, min(1.0, z / TRUNK_HEIGHT))
        ring = 0.5 + 0.5 * math.sin(s * 9 * math.tau)
        return tuple(TRUNK_DARK[i] + (TRUNK_LIT[i] - TRUNK_DARK[i]) * ring
                     for i in range(3))

    finish(obj, face_colour)
    return obj


# ── the rock outcrop ──────────────────────────────────────────────────

# Volcanic, not granite. The reference rock is near-black basalt with the
# sun catching only its upper faces; a mid grey read as a boulder dropped
# on the lawn.
ROCK_LIT = srgb("#5b5350")
ROCK_DARK = srgb("#1f1c1c")


def build_outcrop():
    """A dark volcanic mass: three boulders fused, bevelled, flat-shaded.

    Cut from an icosphere rather than swept from rings. The Swift version
    stacked jittered polygon tiers, which gives a stepped ziggurat when
    what the reference has is a single weathered lump with hard facets —
    and hard facets are what a bevel plus flat shading produce for free.
    """
    bm = bmesh.new()
    # Upright rather than round. Squashing the main lump on x and y and
    # stretching it on z gives the crag its stance; three fused at
    # different heights give it a profile.
    lumps = [
        (Vector((0.0, 0.0, 0.36)), 0.40, (0.82, 0.76, 1.75)),
        (Vector((0.24, 0.09, 0.14)), 0.25, (0.95, 0.90, 1.00)),
        (Vector((-0.19, -0.13, 0.09)), 0.20, (1.05, 0.85, 0.80)),
    ]
    for centre, radius, scale in lumps:
        made = bmesh.ops.create_icosphere(bm, subdivisions=2, radius=radius)
        for v in made["verts"]:
            p = v.co
            # Squash, then push each vertex out along a couple of sines so
            # no two faces sit in the same plane.
            p = Vector((p.x * scale[0], p.y * scale[1], p.z * scale[2]))
            n = (math.sin(p.x * 7.3 + p.y * 5.1) * 0.5
                 + math.sin(p.z * 9.7 - p.x * 4.3) * 0.5)
            # Harder than it was. At 0.16 the lumps stayed recognisably
            # spherical; rock this size wants planes meeting at angles.
            v.co = centre + p * (1 + n * 0.30)

    # Weld the lumps where they meet, so the seams inside the mass are
    # gone before the bevel runs over them.
    bmesh.ops.remove_doubles(bm, verts=bm.verts[:], dist=0.02)
    bmesh.ops.bevel(
        bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:],
        offset=0.018, segments=1, affect="EDGES", clamp_overlap=True)

    obj = new_object("outcrop", bm)
    for poly in obj.data.polygons:
        poly.use_smooth = False       # rock is faceted; that is the point

    def face_colour(poly):
        # Up-facing rock is bleached by the sun, the undercuts stay dark.
        up = max(0.0, min(1.0, poly.normal.z * 0.5 + 0.5))
        lift = 0.16 + up * up * 0.90
        # A little mottling so the mass is not one flat tone.
        n = math.sin(poly.center.x * 6.1 + poly.center.y * 4.7) * 0.06
        return tuple(min(1.0, ROCK_DARK[i] + (ROCK_LIT[i] - ROCK_DARK[i]) * lift + n)
                     for i in range(3))

    finish(obj, face_colour)
    return obj



# ── the hut ───────────────────────────────────────────────────────────

THATCH_LIT = srgb("#f2e0ad")
THATCH_DEEP = srgb("#8d6a33")
TIMBER = srgb("#6d4a2c")
TIMBER_DARK = srgb("#241811")
BARK = srgb("#4a3628")
BARK_DARK = srgb("#2b1f16")
RING_PALE = srgb("#d9b57e")
RING_DARK = srgb("#a77f4c")

# A haystack, not an A-frame. The reference roof is a rounded dome that
# bulges out and droops — the two flat slopes this replaces could never
# read as it, however the thatch on them was cut.
HUT_R = 0.185          # radius at the eave
HUT_H = 0.245          # apex above the eave
EAVE_H = 0.020


def dome(t, a):
    """A point on the roof: `t` from eave (0) to apex (1), `a` around."""
    # Full width at the foot, closing off quickly near the top, which is
    # what gives thatch its heavy shoulders and rounded crown.
    # Flatter over the crown than the first profile, which came out a
    # beehive. The reference roof is broad and low with heavy shoulders.
    r = HUT_R * (1 - t ** 2.5) ** 0.38
    z = EAVE_H + HUT_H * t
    return Vector((r * math.cos(a), r * math.sin(a), z))


def dome_normal(t, a):
    """Outward normal, by finite difference — the profile has no tidy
    derivative and an approximate normal is plenty for pushing courses
    off the surface."""
    d = 0.004
    along = dome(min(1.0, t + d), a) - dome(max(0.0, t - d), a)
    around = dome(t, a + d) - dome(t, a - d)
    n = around.cross(along)
    return n.normalized() if n.length > 1e-6 else Vector((math.cos(a), math.sin(a), 0))


def build_roof_core(seg=30, rings=14):
    """A closed dome under the thatch, so nothing shows through."""
    bm = bmesh.new()
    grid = []
    for i in range(rings):
        t = i / rings
        grid.append([bm.verts.new(dome(t, j / seg * math.tau))
                     for j in range(seg)])
    apex = bm.verts.new((0, 0, EAVE_H + HUT_H))
    for i in range(rings - 1):
        for j in range(seg):
            k = (j + 1) % seg
            bm.faces.new((grid[i][j], grid[i][k], grid[i + 1][k], grid[i + 1][j]))
    for j in range(seg):
        bm.faces.new((grid[-1][j], grid[-1][(j + 1) % seg], apex))
    obj = new_object("hut_core", bm)
    for poly in obj.data.polygons:
        poly.use_smooth = True
    # Straw in shadow, not brown: the apex is the one place the core
    # shows, where the topmost course closes to a point and its solidify
    # has nothing left to thicken.
    finish(obj, lambda poly: shade(THATCH_DEEP, 0.95))
    return obj


def build_thatch(courses=9, seg=34):
    """Rings of straw laid round the dome, each hanging over the one below.

    Courses run *around* now rather than up two slopes. That is the whole
    difference between a haystack and a tent, and it is what the
    reference has: horizontal banding all the way round, with the hem of
    each course breaking the one under it.
    """
    objs = []
    for c in range(courses):
        bm = bmesh.new()
        t0 = c / courses
        crown = c == courses - 1
        # The topmost course closes to a point instead of being a band.
        # Solidify inverts where a ring collapses to zero radius, which
        # punched a hole clean through the roof; a fan needs no thickness
        # because nothing can see its back.
        t1 = 1.0 if crown else min(0.97, (c + 1) / courses + 0.20)
        lower, upper = [], []
        for j in range(seg + 1):
            a = (j % seg) / seg * math.tau
            # Decorrelated across both axes. A stride of 1.7 per segment
            # beat against the segment count and drew chevrons round the
            # dome instead of a random edge.
            r = hash01(j * 0.37 + c * 11.7, c * 3.1 + j * 0.013)
            # Squared, so most of the hem is shallow and only the odd
            # strand hangs long.
            # The crown fan takes a clean circular base: run the hem
            # into it and every wedge of the fan is a different length,
            # which renders as a starburst rather than a roof.
            hem = 0.0 if crown else (0.012 + r * r * 0.085) * (1 - t0 * 0.4)
            lift = dome_normal(t0, a) * (0.011 * (1 - t0) + 0.004)
            lower.append(bm.verts.new(dome(max(0.0, t0 - hem), a) + lift))
            if not crown:
                upper.append(bm.verts.new(dome(t1, a) + lift * 0.5))
        if crown:
            apex = bm.verts.new((0.0, 0.0, EAVE_H + HUT_H + 0.004))
            for j in range(seg):
                bm.faces.new((lower[j], lower[j + 1], apex))
        else:
            for j in range(seg):
                bm.faces.new((lower[j], lower[j + 1], upper[j + 1], upper[j]))
            bmesh.ops.solidify(bm, geom=bm.faces[:], thickness=-0.010)
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])

        obj = new_object(f"hut_thatch_{c}", bm)
        for poly in obj.data.polygons:
            # Facets everywhere except the cap, where they would read as
            # radial creases in what should be a rounded top.
            poly.use_smooth = crown
        rise = c / max(1, courses - 1)

        def face_colour(poly, rise=rise):
            up = max(0.0, min(1.0, poly.normal.z * 0.5 + 0.5))
            k = 0.34 + rise * 0.30 + up * up * 0.46
            return tuple(THATCH_DEEP[i] + (THATCH_LIT[i] - THATCH_DEEP[i]) * min(1.0, k)
                         for i in range(3))

        finish(obj, face_colour)
        objs.append(obj)
    return objs


def build_doorway():
    """The dark mouth under the thatch."""
    bm = bmesh.new()
    # -Y, not +Y. The exporter maps Blender (x, y, z) to (x, z, -y), so
    # the face that ends up towards the app's camera is this one; built
    # on +Y the doorway opened out of the back of the hut.
    box(bm, (0.0, -HUT_R * 0.80, 0.070), (0.105, 0.075, 0.135))
    obj = new_object("hut_door", bm)
    for poly in obj.data.polygons:
        poly.use_smooth = False
    finish(obj, lambda poly: TIMBER_DARK)
    return obj


def build_log(seg=16):
    """The beam driven through the crown, cut end showing its rings.

    The clearest thing in the reference and the hardest to fake: it is
    not a ridge pole lying along a roof, it is a whole trunk pushed
    through at an angle with one end jutting well clear. The rings on the
    sawn face are what say "log" rather than "pipe", so they are real
    geometry — concentric bands, alternating tone.
    """
    bm = bmesh.new()
    # Slimmer and shorter than the first cut, which came out a cigar
    # wider than the roof it was lying on.
    radius, length = 0.040, 0.60
    # Built along Y, then tilted and lifted onto the crown.
    rings = []
    # Weighted so one end juts well clear of the thatch and the other
    # buries itself: in the reference the beam is the first thing you
    # see, and a log centred on the roof reads as a handle.
    for i in range(2):
        y = -length * 0.67 + length * i
        rings.append([bm.verts.new((math.cos(j / seg * math.tau) * radius, y,
                                    math.sin(j / seg * math.tau) * radius))
                      for j in range(seg)])
    for j in range(seg):
        k = (j + 1) % seg
        bm.faces.new((rings[0][j], rings[0][k], rings[1][k], rings[1][j]))

    # Sawn rings on *both* ends. The app turns the hut to face the
    # camera, so which end shows is not this file's decision to make, and
    # a plain cap on the wrong one reads as a length of pipe.
    ring_faces = []
    for end, (edge, flip) in enumerate(((rings[0], False), (rings[1], True))):
        face_y = edge[0].co.y
        centre = bm.verts.new((0, face_y, 0))
        previous = [centre] * seg
        steps = 3
        for step in range(1, steps + 1):
            rr = radius * step / steps
            ring = ([bm.verts.new((math.cos(j / seg * math.tau) * rr, face_y,
                                   math.sin(j / seg * math.tau) * rr))
                     for j in range(seg)] if step < steps else edge)
            for j in range(seg):
                k = (j + 1) % seg
                quad = ((centre, ring[k], ring[j]) if step == 1
                        else (previous[j], previous[k], ring[k], ring[j]))
                ring_faces.append((bm.faces.new(quad[::-1] if flip else quad), step))
            previous = ring

    marked = {f.index: step for f, step in ring_faces}
    obj = new_object("hut_log", bm)

    tilt = Matrix.Rotation(math.radians(-26), 4, "X")
    swing = Matrix.Rotation(math.radians(26), 4, "Z")
    obj.data.transform(swing @ tilt)
    # Bedded into the crown rather than perched on it: the reference log
    # is driven *through* the thatch.
    obj.location = (0.0, 0.0, EAVE_H + HUT_H * 0.66)
    bpy.context.view_layer.update()
    obj.data.transform(Matrix.Translation(obj.location))
    obj.location = (0, 0, 0)

    for poly in obj.data.polygons:
        poly.use_smooth = poly.index not in marked

    def face_colour(poly):
        step = marked.get(poly.index)
        if step is not None:
            return RING_PALE if step % 2 else RING_DARK
        up = max(0.0, min(1.0, poly.normal.z * 0.5 + 0.5))
        return tuple(BARK_DARK[i] + (BARK[i] - BARK_DARK[i]) * (0.25 + up * 0.95)
                     for i in range(3))

    finish(obj, face_colour)
    return obj


def build_barrel(at, scale, lean, seg=12):
    """A barrel: bulged staves and two dark hoops."""
    bm = bmesh.new()
    h, r = 0.11 * scale, 0.042 * scale
    rings = []
    hoops = set()
    steps = 6
    for i in range(steps + 1):
        s = i / steps
        # Fattest at the waist, which is what makes it a barrel.
        rr = r * (0.84 + 0.16 * math.sin(s * math.pi))
        rings.append([bm.verts.new((math.cos(j / seg * math.tau) * rr, s * h,
                                    math.sin(j / seg * math.tau) * rr))
                      for j in range(seg)])
    for i in range(steps):
        for j in range(seg):
            k = (j + 1) % seg
            f = bm.faces.new((rings[i][j], rings[i][k], rings[i + 1][k], rings[i + 1][j]))
            if i in (1, 4):
                hoops.add(f)
    bm.faces.new(rings[-1][::-1])
    bm.faces.new(rings[0])
    hoop_idx = {f.index for f in hoops}

    obj = new_object("barrel", bm)
    obj.data.transform(
        Matrix.Translation(Vector(at))
        @ Matrix.Rotation(lean, 4, "Y")
        # +90, not -90: the staves are built along +Y, and turning the
        # other way stood every barrel below the sand.
        @ Matrix.Rotation(math.radians(90), 4, "X"))
    for poly in obj.data.polygons:
        poly.use_smooth = True

    def face_colour(poly):
        up = max(0.0, min(1.0, poly.normal.z * 0.4 + 0.6))
        base = BARK_DARK if poly.index in hoop_idx else TIMBER
        return shade(base, 0.55 + up * 0.75)

    finish(obj, face_colour)
    return obj


def build_hut():
    parts = [
        *build_thatch(),
        build_roof_core(),
        build_doorway(),
        build_log(),
        # Stacked against the wall on the side that faces the viewer,
        # as in the reference.
        build_barrel((-0.225, -0.105, 0.0), 1.0, 0.0),
        build_barrel((-0.288, -0.180, 0.0), 0.85, 0.0),
        build_barrel((-0.196, -0.170, 0.0), 0.78, 0.0),
    ]
    return join(parts, "hut")


def render_preview(name):
    """Render one prop against a plain ground, three-quarter view."""
    builders = {"hut": build_hut, "palm": build_palm, "outcrop": build_outcrop}
    obj = builders[name]()

    # Vertex colours only reach a render through a material that reads
    # them; the export path needs no such thing, which is why there are
    # no materials anywhere else in this file.
    mat = bpy.data.materials.new("preview")
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    attr = mat.node_tree.nodes.new("ShaderNodeVertexColor")
    attr.layer_name = "baked"
    mat.node_tree.links.new(bsdf.inputs["Base Color"], attr.outputs["Color"])
    bsdf.inputs["Roughness"].default_value = 0.85
    obj.data.materials.append(mat)

    bpy.ops.mesh.primitive_plane_add(size=4, location=(0, 0, 0))

    # Sky light, or the shadow side renders pure black and there is
    # nothing to judge the colour against.
    world = bpy.data.worlds.new("preview")
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs[0].default_value = (0.55, 0.62, 0.72, 1)
    world.node_tree.nodes["Background"].inputs[1].default_value = 1.1
    bpy.context.scene.world = world

    bpy.ops.object.camera_add(location=(0.95, -0.95, 0.72))
    cam = bpy.context.object
    cam.rotation_euler = (math.radians(64), 0, math.radians(45))
    cam.data.lens = 62
    bpy.context.scene.camera = cam

    bpy.ops.object.light_add(type="SUN", location=(1.4, -1.0, 2.2))
    bpy.context.object.data.energy = 4.0
    bpy.ops.object.light_add(type="AREA", location=(-1.6, 0.9, 1.2))
    bpy.context.object.data.energy = 60

    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 720
    scene.render.resolution_y = 720
    # Beside the script, not in the iOS repo — this is a working file,
    # not something the app ships.
    scene.render.filepath = os.path.join(HERE, f"preview_{name}.png")
    bpy.ops.render.render(write_still=True)
    print(f"[island] preview → {os.path.abspath(scene.render.filepath)}")


def main():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    os.makedirs(OUT, exist_ok=True)

    # `REEF_PREVIEW=<name> ... island_props.py` renders that prop on its
    # own to a PNG instead of exporting. Judging a 0.3-unit hut inside a
    # screenshot of the whole tank is guesswork — two separate things
    # were misread as a palm trunk that way before this existed.
    preview = os.environ.get("REEF_PREVIEW")
    if preview:
        render_preview(preview)
        return

    export(build_palm(), "palm")
    export(build_outcrop(), "outcrop")
    export(build_hut(), "hut")
    print(f"[island] written to {OUT}")


main()
