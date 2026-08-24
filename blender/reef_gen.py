"""Low-poly reef asset generators.

Each coral occupies a distinct geometric class so the silhouettes stay
readable at isometric diorama scale:

    table   horizontal plane   fan     vertical plane
    antler  branching lines    pipe    vertical bars
    brain   sphere
"""
import bpy
import bmesh
import math
import random
from mathutils import Vector, Matrix, noise

TAU = math.tau


def build(name, verts, faces):
    """Mesh from raw geometry, normals fixed, flat shaded."""
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    me.update()
    bm = bmesh.new()
    bm.from_mesh(me)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(me)
    bm.free()
    for p in me.polygons:
        p.use_smooth = False
    return bpy.data.objects.new(name, me)


def terrain(x, y):
    u = (x + y) / 6.0
    shelf = 2.6 * max(0.0, u - 0.30) ** 1.2
    return -1.15 + shelf + noise.fractal(Vector((x, y, 0.0)) * 0.5, 1.0, 2.0, 3) * 0.16


# ── 1. TABLE ─────────────────────────────────────────────────────
def table_coral(name, seed, radius=0.50, stem_h=0.32, thick=0.04, segs=20, lobes=8):
    """Flat canopy raised on a slim stem. The pedestal gap is the whole read,
    so the plate is built at z=stem_h and the stem runs down to z=0."""
    rng = random.Random(seed)
    ph = rng.uniform(0, TAU)
    dome = radius * 0.11          # flat: a table, not a cone
    pz = stem_h
    verts, faces = [], []

    def ring(rs, z):
        start = len(verts)
        for s in range(segs):
            a = s / segs * TAU
            r = radius * rs * (1.0 + 0.055 * math.sin(a * lobes + ph))
            verts.append((math.cos(a) * r, math.sin(a) * r, z))
        return start

    ctr_t = len(verts); verts.append((0, 0, pz + dome))
    mid_t = ring(0.60, pz + dome * 0.55)
    out_t = ring(1.00, pz - dome * 0.35)
    out_b = ring(1.00, pz - dome * 0.35 - thick)
    mid_b = ring(0.60, pz + dome * 0.55 - thick)
    ctr_b = len(verts); verts.append((0, 0, pz + dome - thick))

    for s in range(segs):
        s2 = (s + 1) % segs
        faces.append((ctr_t, mid_t + s, mid_t + s2))
        faces.append((mid_t + s, out_t + s, out_t + s2, mid_t + s2))
        faces.append((out_t + s2, out_b + s2, out_b + s, out_t + s))
        faces.append((mid_b + s2, mid_b + s, out_b + s, out_b + s2))
        faces.append((ctr_b, mid_b + s2, mid_b + s))

    sseg = 8
    top_z = pz + dome * 0.4 - thick
    top = len(verts)
    for s in range(sseg):
        a = s / sseg * TAU
        verts.append((math.cos(a) * radius * 0.13, math.sin(a) * radius * 0.13, top_z))
    bot = len(verts)
    for s in range(sseg):
        a = s / sseg * TAU
        verts.append((math.cos(a) * radius * 0.19, math.sin(a) * radius * 0.19, 0.0))
    for s in range(sseg):
        s2 = (s + 1) % sseg
        faces.append((top + s, top + s2, bot + s2, bot + s))
    return build(name, verts, faces)


# ── 2. FAN ───────────────────────────────────────────────────────
def fan_coral(name, seed, height=0.62, spread=2.1, thick=0.03, rings=4, arcs=13, lobes=6):
    rng = random.Random(seed)
    ph = rng.uniform(0, TAU)
    verts, faces = [], []
    inner = height * 0.24

    for side in (1, -1):
        base = len(verts)
        for ri in range(rings + 1):
            t = ri / rings
            for ai in range(arcs):
                u = ai / (arcs - 1)
                a = (u - 0.5) * spread
                edge = 1.0 + 0.10 * math.sin(u * math.pi * lobes + ph) if ri == rings else 1.0
                r = inner + (height - inner) * t * edge
                verts.append((math.sin(a) * r, side * thick * 0.5, math.cos(a) * r))
        for ri in range(rings):
            for ai in range(arcs - 1):
                i = base + ri * arcs + ai
                q = (i, i + 1, i + arcs + 1, i + arcs)
                faces.append(q if side == 1 else q[::-1])

    per = (rings + 1) * arcs
    for ai in range(arcs - 1):
        a0 = rings * arcs + ai
        faces.append((a0, per + a0, per + a0 + 1, a0 + 1))
    for ri in range(rings):
        for ai in (0, arcs - 1):
            i = ri * arcs + ai
            j = i + arcs
            q = (i, j, per + j, per + i)
            faces.append(q if ai == 0 else q[::-1])

    sseg = 6
    top = len(verts)
    for s in range(sseg):
        a = s / sseg * TAU
        verts.append((math.cos(a) * 0.05, math.sin(a) * 0.05, inner * 0.95))
    bot = len(verts)
    for s in range(sseg):
        a = s / sseg * TAU
        verts.append((math.cos(a) * 0.062, math.sin(a) * 0.062, -0.06))
    for s in range(sseg):
        s2 = (s + 1) % sseg
        faces.append((top + s, top + s2, bot + s2, bot + s))
    return build(name, verts, faces)


# ── 3. ANTLER ────────────────────────────────────────────────────
def antler_coral(name, seed, height=0.6, radius=0.085, trunks=3):
    rng = random.Random(seed)
    verts, radii, edges = [Vector((0, 0, 0))], [radius * 1.6], []

    def limb(pos, d, length, r, splits, parent):
        idx = parent
        steps = 2
        for s in range(steps):
            d = (d + Vector((rng.uniform(-.18, .18), rng.uniform(-.18, .18), .22))).normalized()
            pos = pos + d * (length / steps)
            verts.append(pos.copy())
            radii.append(max(0.03, r * (1 - 0.3 * (s + 1) / steps)))
            edges.append((idx, len(verts) - 1))
            idx = len(verts) - 1
        if splits > 0:
            for k in (-1, 1):
                aa = rng.uniform(0, TAU)
                axis = Vector((math.cos(aa), math.sin(aa), 0.15)).normalized()
                cd = d.copy()
                cd.rotate(Matrix.Rotation(k * rng.uniform(0.75, 1.05), 4, axis))
                limb(pos.copy(), cd, length * 0.62, r * 0.68, splits - 1, idx)

    for t in range(trunks):
        a = t / trunks * TAU + rng.uniform(-0.3, 0.3)
        limb(Vector((0, 0, 0)),
             Vector((math.cos(a) * 0.45, math.sin(a) * 0.45, 1)).normalized(),
             height, radius, 1, 0)

    me = bpy.data.meshes.new(name)
    me.from_pydata([tuple(v) for v in verts], edges, [])
    me.update()
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    sk = ob.modifiers.new("Skin", "SKIN")
    sk.use_smooth_shade = False
    for i, r in enumerate(radii):
        ob.data.skin_vertices[0].data[i].radius = (r, r)
    ob.data.skin_vertices[0].data[0].use_root = True
    dg = bpy.context.evaluated_depsgraph_get()
    baked = bpy.data.meshes.new_from_object(ob.evaluated_get(dg))
    ob.modifiers.clear()
    old = ob.data
    ob.data = baked
    bpy.data.meshes.remove(old)
    for p in ob.data.polygons:
        p.use_smooth = False
    bpy.context.scene.collection.objects.unlink(ob)
    return ob


# ── 4. PIPE ──────────────────────────────────────────────────────
def pipe_coral(name, seed, count=6, seg=8):
    rng = random.Random(seed)
    heights = sorted([rng.uniform(0.16, 0.58) for _ in range(count)], reverse=True)
    verts, faces = [], []
    for i, h in enumerate(heights):
        a = i / count * TAU + rng.uniform(-0.35, 0.35)
        d = rng.uniform(0.04, 0.19)
        cx, cy = math.cos(a) * d, math.sin(a) * d
        r0 = rng.uniform(0.048, 0.066)
        r1 = r0 * 1.28
        base = len(verts)
        for s in range(seg):
            t = s / seg * TAU
            verts.append((cx + math.cos(t) * r0, cy + math.sin(t) * r0, 0.0))
        top = len(verts)
        for s in range(seg):
            t = s / seg * TAU
            verts.append((cx + math.cos(t) * r1, cy + math.sin(t) * r1, h))
        mouth = len(verts)
        for s in range(seg):
            t = s / seg * TAU
            verts.append((cx + math.cos(t) * r1 * 0.58, cy + math.sin(t) * r1 * 0.58,
                          h - r1 * 0.42))
        ctr = len(verts)
        verts.append((cx, cy, h - r1 * 0.55))
        for s in range(seg):
            s2 = (s + 1) % seg
            faces.append((base + s, base + s2, top + s2, top + s))
            faces.append((top + s, top + s2, mouth + s2, mouth + s))
            faces.append((mouth + s2, mouth + s, ctr))
    return build(name, verts, faces)


# ── 5. BRAIN ─────────────────────────────────────────────────────
def brain_coral(name, seed, radius=0.3, subdiv=4, squash=0.68, groove=0.135, freq=6.5):
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=subdiv, radius=radius)
    bm.verts.ensure_lookup_table()
    bm.verts.index_update()
    off = Vector((seed * 5.3, seed * 9.1, seed * 2.7))
    g = {}
    for v in bm.verts:
        d = v.co.normalized()
        w = noise.fractal(v.co * 1.5 + off, 1.0, 2.0, 2)
        m = math.sin(w * freq)
        v.co = d * radius * (1.0 + math.copysign(abs(m) ** 0.6, m) * groove)
        v.co.z *= squash
        if v.co.z < 0:
            v.co.z *= 0.22
        g[v.index] = (m + 1.0) * 0.5
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    attr = me.color_attributes.new(name="Col", type="FLOAT_COLOR", domain="POINT")
    for i in range(len(me.vertices)):
        s = 0.50 + 0.50 * g.get(i, 1.0)
        attr.data[i].color = (s, s, s, 1.0)
    for p in me.polygons:
        p.use_smooth = False
    return bpy.data.objects.new(name, me)


GENERATORS = {
    "table": table_coral,
    "fan": fan_coral,
    "antler": antler_coral,
    "pipe": pipe_coral,
    "brain": brain_coral,
}


# ── FISH ─────────────────────────────────────────────────────────
def make_fish(name, length=0.34, height=0.17, width=0.085, rings=7, segs=8,
              tail=0.13, dorsal=0.07):
    """Low-poly fish: lathed body, forked caudal fin, dorsal + pectorals.
    Two material slots: 0 = body, 1 = fins."""
    verts, body_faces, fin_faces = [], [], []

    nose = len(verts)
    verts.append((-length * 0.5, 0.0, 0.0))
    ring_start = []
    for i in range(1, rings + 1):
        t = i / (rings + 1)
        prof = math.sin(math.pi * t ** 0.82) ** 0.75
        x = -length * 0.5 + length * t
        ring_start.append(len(verts))
        for s in range(segs):
            a = s / segs * TAU
            verts.append((x, width * prof * math.cos(a), height * prof * math.sin(a)))
    tail_v = len(verts)
    verts.append((length * 0.5, 0.0, 0.0))

    for s in range(segs):
        body_faces.append((nose, ring_start[0] + (s + 1) % segs, ring_start[0] + s))
    for r in range(len(ring_start) - 1):
        a0, a1 = ring_start[r], ring_start[r + 1]
        for s in range(segs):
            s2 = (s + 1) % segs
            body_faces.append((a0 + s, a0 + s2, a1 + s2, a1 + s))
    last = ring_start[-1]
    for s in range(segs):
        body_faces.append((tail_v, last + s, last + (s + 1) % segs))

    tx = length * 0.5
    f0 = len(verts)
    verts += [(tx, 0, 0), (tx + tail, 0, tail * 0.95),
              (tx + tail * 0.62, 0, 0), (tx + tail, 0, -tail * 0.95)]
    fin_faces += [(f0, f0 + 1, f0 + 2), (f0, f0 + 2, f0 + 3)]

    d0 = len(verts)
    verts += [(-length * 0.10, 0, height * 0.72), (length * 0.24, 0, height * 0.55),
              (length * 0.02, 0, height * 0.72 + dorsal)]
    fin_faces.append((d0, d0 + 1, d0 + 2))

    for side in (1, -1):
        p0 = len(verts)
        verts += [(-length * 0.06, side * width * 0.55, 0.0),
                  (length * 0.10, side * width * 0.62, -height * 0.12),
                  (length * 0.02, side * (width * 0.55 + 0.075), -height * 0.34)]
        fin_faces.append((p0, p0 + 1, p0 + 2))

    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], body_faces + fin_faces)
    me.update()
    for p in me.polygons:
        p.use_smooth = False
    for i in range(len(body_faces), len(me.polygons)):
        me.polygons[i].material_index = 1
    return bpy.data.objects.new(name, me)


# ── SEAWEED ──────────────────────────────────────────────────────
def seaweed(name, seed, blades=5, height=0.7, width=0.07, lean=0.28):
    """Tapered ribbons with a lean — reads as weed at very low poly."""
    rng = random.Random(seed)
    verts, faces = [], []
    for b in range(blades):
        a0 = rng.uniform(0, TAU)
        ln = rng.uniform(lean * 0.5, lean * 1.3)
        h = height * rng.uniform(0.6, 1.2)
        w = width * rng.uniform(0.75, 1.25)
        segs = 5
        base = len(verts)
        ox = math.cos(a0) * rng.uniform(0, 0.12)
        oy = math.sin(a0) * rng.uniform(0, 0.12)
        for s in range(segs + 1):
            t = s / segs
            sway = math.sin(t * 2.2 + b) * ln
            cw = w * (1.0 - 0.75 * t)
            px, py = ox + math.cos(a0) * sway * h, oy + math.sin(a0) * sway * h
            nx, ny = -math.sin(a0), math.cos(a0)
            verts.append((px - nx * cw, py - ny * cw, h * t))
            verts.append((px + nx * cw, py + ny * cw, h * t))
        for s in range(segs):
            i = base + s * 2
            faces.append((i, i + 1, i + 3, i + 2))
    return build(name, verts, faces)


GENERATORS["fish"] = make_fish
GENERATORS["weed"] = seaweed


# ═══════════════════════════════════════════════════════════════════
#  Remaining catalog items
# ═══════════════════════════════════════════════════════════════════

def _lathe(profile, segs=10, twist=0.0):
    """Revolve a list of (radius, height) pairs into a solid."""
    verts, faces = [], []
    for ri, (r, y) in enumerate(profile):
        for s in range(segs):
            a = s / segs * TAU + ri * twist
            verts.append((math.cos(a) * r, math.sin(a) * r, y))
    for ri in range(len(profile) - 1):
        for s in range(segs):
            s2 = (s + 1) % segs
            a0, a1 = ri * segs, (ri + 1) * segs
            faces.append((a0 + s, a0 + s2, a1 + s2, a1 + s))
    bottom = len(verts)
    verts.append((0, 0, profile[0][1]))
    top = len(verts)
    verts.append((0, 0, profile[-1][1]))
    last = (len(profile) - 1) * segs
    for s in range(segs):
        s2 = (s + 1) % segs
        faces.append((bottom, s2, s))
        faces.append((top, last + s, last + s2))
    return verts, faces


def _rock_mesh(seed, radius, subdiv=2, squash=0.72, stretch=(1.0, 1.0), lump=0.34):
    """Faceted stone: icosphere pushed around by fBm."""
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=subdiv, radius=radius)
    off = Vector((seed * 13.1, seed * 7.3, seed * 3.7))
    for v in bm.verts:
        d = v.co.normalized()
        n = noise.fractal(v.co * 1.6 + off, 1.0, 2.0, 2)
        v.co = d * radius * (1.0 + n * lump)
        v.co.x *= stretch[0]
        v.co.y *= stretch[1]
        v.co.z *= squash
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return bm


def _bm_to_obj(bm, name):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    for p in me.polygons:
        p.use_smooth = False
    return bpy.data.objects.new(name, me)


# ── ROCKS ────────────────────────────────────────────────────────
def pebbles(name, seed, count=5, spread=0.30):
    rng = random.Random(seed)
    bm = bmesh.new()
    for i in range(count):
        a = rng.uniform(0, TAU)
        d = rng.uniform(0, spread)
        r = rng.uniform(0.055, 0.115)
        sub = _rock_mesh(seed + i * 3.1, r, subdiv=1, squash=0.62)
        m = (Matrix.Translation((math.cos(a) * d, math.sin(a) * d, r * 0.55))
             @ Matrix.Rotation(rng.uniform(0, TAU), 4, "Z"))
        bmesh.ops.transform(sub, matrix=m, verts=sub.verts)
        tmp = bpy.data.meshes.new("_tmp")
        sub.to_mesh(tmp)
        sub.free()
        bm.from_mesh(tmp)
        bpy.data.meshes.remove(tmp)
    return _bm_to_obj(bm, name)


def boulder(name, seed, radius=0.34):
    bm = _rock_mesh(seed, radius, subdiv=2, squash=0.78, stretch=(1.12, 0.9))
    bmesh.ops.transform(bm, matrix=Matrix.Translation((0, 0, radius * 0.62)), verts=bm.verts)
    return _bm_to_obj(bm, name)


def slate(name, seed, slabs=4, radius=0.32):
    """Stacked flat discs — the layered skyline is the read."""
    rng = random.Random(seed)
    verts, faces = [], []
    z = 0.0
    for i in range(slabs):
        r = radius * (1.0 - i * 0.16)
        h = rng.uniform(0.05, 0.09)
        segs = 7
        off = rng.uniform(0, TAU)
        base = len(verts)
        for lvl, zz in ((0, z), (1, z + h)):
            for s in range(segs):
                a = s / segs * TAU + off
                wob = 1.0 + 0.12 * math.sin(a * 3 + i)
                verts.append((math.cos(a) * r * wob, math.sin(a) * r * wob, zz))
        for s in range(segs):
            s2 = (s + 1) % segs
            faces.append((base + s, base + s2, base + segs + s2, base + segs + s))
        cb = len(verts); verts.append((0, 0, z))
        ct = len(verts); verts.append((0, 0, z + h))
        for s in range(segs):
            s2 = (s + 1) % segs
            faces.append((cb, base + s2, base + s))
            faces.append((ct, base + segs + s, base + segs + s2))
        z += h * 0.92
    return build(name, verts, faces)


def arch(name, seed, radius=0.34, thick=0.10, segs=9, tube=6):
    """Half torus — the hole through it is the whole silhouette."""
    verts, faces = [], []
    for i in range(segs + 1):
        a = math.pi * i / segs
        cx, cz = math.cos(a) * radius, math.sin(a) * radius
        for j in range(tube):
            b = j / tube * TAU
            verts.append((cx + math.cos(a) * math.cos(b) * thick,
                          math.sin(b) * thick,
                          cz + math.sin(a) * math.cos(b) * thick))
    for i in range(segs):
        for j in range(tube):
            j2 = (j + 1) % tube
            a0, a1 = i * tube, (i + 1) * tube
            faces.append((a0 + j, a0 + j2, a1 + j2, a1 + j))
    for end, ring in ((0, 0), (1, segs * tube)):
        c = len(verts)
        verts.append((math.cos(math.pi * end) * radius, 0, math.sin(math.pi * end) * radius))
        for j in range(tube):
            j2 = (j + 1) % tube
            faces.append((c, ring + j2, ring + j) if end == 0 else (c, ring + j, ring + j2))
    return build(name, verts, faces)


# ── CORAL: bubble / grape ────────────────────────────────────────
def bubble_coral(name, seed, count=7):
    """Few large countable spheres — reads as grapes at distance."""
    rng = random.Random(seed)
    bm = bmesh.new()
    for i in range(count):
        a = rng.uniform(0, TAU)
        d = rng.uniform(0, 0.17)
        r = rng.uniform(0.085, 0.155)
        sub = bmesh.new()
        bmesh.ops.create_icosphere(sub, subdivisions=1, radius=r)
        bmesh.ops.transform(sub, verts=sub.verts, matrix=Matrix.Translation(
            (math.cos(a) * d, math.sin(a) * d, r * 0.85 + rng.uniform(0, 0.12))))
        tmp = bpy.data.meshes.new("_tmp")
        sub.to_mesh(tmp); sub.free()
        bm.from_mesh(tmp); bpy.data.meshes.remove(tmp)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return _bm_to_obj(bm, name)


# ── PLANT: anemone ───────────────────────────────────────────────
def anemone(name, seed, arms=18, radius=0.19):
    """Squat column under a crown of tentacles."""
    rng = random.Random(seed)
    verts, faces = _lathe([(radius * 0.72, 0.0), (radius, 0.10), (radius * 0.85, 0.17)], segs=10)
    for i in range(arms):
        a = i / arms * TAU
        lean = rng.uniform(0.55, 1.0)
        ln = rng.uniform(0.16, 0.30)
        r0 = rng.uniform(0.018, 0.030)
        bx, by = math.cos(a) * radius * 0.7, math.sin(a) * radius * 0.7
        tipx = bx + math.cos(a) * ln * lean
        tipy = by + math.sin(a) * ln * lean
        tipz = 0.17 + ln * (1.0 - lean * 0.55)
        nx, ny = -math.sin(a), math.cos(a)
        base = len(verts)
        verts += [(bx - nx * r0, by - ny * r0, 0.15),
                  (bx + nx * r0, by + ny * r0, 0.15),
                  (tipx + nx * r0 * 0.3, tipy + ny * r0 * 0.3, tipz),
                  (tipx - nx * r0 * 0.3, tipy - ny * r0 * 0.3, tipz)]
        faces.append((base, base + 1, base + 2, base + 3))
    return build(name, verts, faces)


# ── FISH: seahorse, jelly, ray ───────────────────────────────────
def seahorse(name, seed, height=0.34):
    """S-curve body — the curve is the silhouette."""
    rng = random.Random(seed)
    pts, radii, edges = [], [], []
    steps = 9
    for i in range(steps):
        t = i / (steps - 1)
        z = height * t
        x = math.sin(t * math.pi * 1.15 + 0.35) * height * 0.20 - height * 0.06
        pts.append(Vector((x, 0.0, z)))
        radii.append(height * (0.135 - 0.085 * abs(t - 0.42)))
        if i:
            edges.append((i - 1, i))
    me = bpy.data.meshes.new(name)
    me.from_pydata([tuple(p) for p in pts], edges, [])
    me.update()
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    sk = ob.modifiers.new("Skin", "SKIN")
    sk.use_smooth_shade = False
    for i, r in enumerate(radii):
        ob.data.skin_vertices[0].data[i].radius = (r, r)
    ob.data.skin_vertices[0].data[0].use_root = True
    dg = bpy.context.evaluated_depsgraph_get()
    baked = bpy.data.meshes.new_from_object(ob.evaluated_get(dg))
    ob.modifiers.clear()
    old = ob.data; ob.data = baked; bpy.data.meshes.remove(old)
    bpy.context.scene.collection.objects.unlink(ob)

    bm = bmesh.new()
    bm.from_mesh(ob.data)
    snout = bmesh.new()
    top = pts[-1]
    bmesh.ops.create_cone(snout, cap_ends=True, cap_tris=False, segments=6,
                          radius1=height * 0.055, radius2=height * 0.022,
                          depth=height * 0.20)
    bmesh.ops.transform(snout, verts=snout.verts,
                        matrix=Matrix.Translation((top.x + height * 0.10, 0, top.z + height * 0.02))
                        @ Matrix.Rotation(math.pi / 2, 4, "Y"))
    tmp = bpy.data.meshes.new("_tmp")
    snout.to_mesh(tmp); snout.free()
    bm.from_mesh(tmp); bpy.data.meshes.remove(tmp)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(ob.data); bm.free()
    for p in ob.data.polygons:
        p.use_smooth = False
    return ob


def jelly(name, seed, radius=0.17, tentacles=7):
    """Bell plus trailing streamers."""
    rng = random.Random(seed)
    segs, rings = 10, 3
    verts, faces = [], []
    for ri in range(rings + 1):
        t = ri / rings
        a_lat = t * math.pi * 0.5
        r = radius * math.sin(a_lat + 0.12) / math.sin(0.5 * math.pi + 0.12)
        z = math.cos(a_lat) * radius * 0.82
        for s in range(segs):
            a = s / segs * TAU
            flute = 1.0 + 0.07 * math.sin(a * segs / 2)
            verts.append((math.cos(a) * r * flute, math.sin(a) * r * flute, z))
    for ri in range(rings):
        for s in range(segs):
            s2 = (s + 1) % segs
            a0, a1 = ri * segs, (ri + 1) * segs
            faces.append((a0 + s, a0 + s2, a1 + s2, a1 + s))
    apex = len(verts); verts.append((0, 0, radius * 0.82))
    for s in range(segs):
        faces.append((apex, (s + 1) % segs, s))

    for i in range(tentacles):
        a = i / tentacles * TAU
        d = radius * 0.72
        ln = rng.uniform(0.26, 0.52)
        w = 0.016
        nx, ny = -math.sin(a), math.cos(a)
        bx, by = math.cos(a) * d, math.sin(a) * d
        base = len(verts)
        verts += [(bx - nx * w, by - ny * w, 0.0),
                  (bx + nx * w, by + ny * w, 0.0),
                  (bx + nx * w * 0.4 + math.cos(a) * 0.03, by + ny * w * 0.4 + math.sin(a) * 0.03, -ln),
                  (bx - nx * w * 0.4 + math.cos(a) * 0.03, by - ny * w * 0.4 + math.sin(a) * 0.03, -ln)]
        faces.append((base, base + 1, base + 2, base + 3))
    return build(name, verts, faces)


def ray(name, seed, span=0.52, length=0.40, thick=0.045):
    """Wide swept wings and a whip tail. Built nose along -Y so the
    export bake lands it on glTF +Z."""
    verts, faces = [], []
    outline = [
        (0.00, -length * 0.62), (span * 0.30, -length * 0.30), (span * 0.52, length * 0.02),
        (span * 0.42, length * 0.30), (span * 0.16, length * 0.36), (0.00, length * 0.30),
    ]
    ring = outline + [(-x, y) for x, y in reversed(outline[1:-1])]
    n = len(ring)
    for sign in (1, -1):
        for x, y in ring:
            taper = 1.0 - min(1.0, (abs(x) / (span * 0.52)) ** 1.3)
            verts.append((x, y, sign * thick * taper))
    cx_t = len(verts); verts.append((0.0, -length * 0.05, thick * 0.9))
    cx_b = len(verts); verts.append((0.0, -length * 0.05, -thick * 0.9))
    for i in range(n):
        j = (i + 1) % n
        faces.append((cx_t, i, j))
        faces.append((cx_b, n + j, n + i))
    for i in range(n):
        j = (i + 1) % n
        faces.append((i, n + i, n + j, j))
    seg, tl = 5, length * 1.25
    prev = None
    for s in range(seg + 1):
        t = s / seg
        w = 0.020 * (1 - t) + 0.004
        base = len(verts)
        verts += [(-w, length * 0.30 + tl * t, 0.0), (w, length * 0.30 + tl * t, 0.0)]
        if prev is not None:
            faces.append((prev, prev + 1, base + 1, base))
        prev = base
    return build(name, verts, faces)


# ── DECOR ────────────────────────────────────────────────────────
def chest(name, seed, w=0.30, d=0.20, h=0.16):
    verts, faces = [], []

    def box(x0, x1, y0, y1, z0, z1):
        b = len(verts)
        verts.extend([(x0, y0, z0), (x1, y0, z0), (x1, y1, z0), (x0, y1, z0),
                      (x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1)])
        faces.extend([(b, b + 3, b + 2, b + 1), (b + 4, b + 5, b + 6, b + 7),
                      (b, b + 1, b + 5, b + 4), (b + 1, b + 2, b + 6, b + 5),
                      (b + 2, b + 3, b + 7, b + 6), (b + 3, b, b + 4, b + 7)])

    box(-w, w, -d, d, 0.0, h)
    segs = 7
    lid = len(verts)
    for s in range(segs + 1):
        a = math.pi * s / segs
        verts.append((-w, math.cos(a) * d, h + math.sin(a) * d * 0.85))
        verts.append((w, math.cos(a) * d, h + math.sin(a) * d * 0.85))
    for s in range(segs):
        i = lid + s * 2
        faces.append((i, i + 2, i + 3, i + 1))
    box(-w * 1.06, w * 1.06, -d * 0.16, d * 0.16, h * 0.1, h * 1.02)
    return build(name, verts, faces)


def amphora(name, seed, h=0.42):
    profile = [(0.055, 0.0), (0.10, 0.03), (0.145, h * 0.30), (0.125, h * 0.52),
               (0.062, h * 0.72), (0.052, h * 0.88), (0.085, h)]
    verts, faces = _lathe(profile, segs=10)
    return build(name, verts, faces)


def wreck(name, seed, length=0.78, beam=0.26, depth=0.18):
    """Small hull with a leaning mast."""
    verts, faces = [], []
    ribs = 6
    top, bot = [], []
    for i in range(ribs + 1):
        t = i / ribs
        taper = math.sin(math.pi * (0.18 + 0.64 * t)) ** 0.7
        y = -length / 2 + length * t
        top.append(len(verts)); verts.append((-beam * taper, y, depth))
        verts.append((beam * taper, y, depth))
        bot.append(len(verts)); verts.append((-beam * taper * 0.35, y, 0.0))
        verts.append((beam * taper * 0.35, y, 0.0))
    for i in range(ribs):
        a, b = top[i], top[i + 1]
        c, d = bot[i], bot[i + 1]
        faces.append((a, b, d, c))
        faces.append((a + 1, c + 1, d + 1, b + 1))
        faces.append((c, d, d + 1, c + 1))
    faces.append((top[0], bot[0], bot[0] + 1, top[0] + 1))
    faces.append((top[ribs] + 1, bot[ribs] + 1, bot[ribs], top[ribs]))
    lean = 0.22
    mseg = 6
    mast = []
    for s in range(2):
        zz = depth + s * 0.46
        r = 0.022 * (1 - s * 0.35)
        mast.append(len(verts))
        for j in range(mseg):
            a = j / mseg * TAU
            verts.append((math.cos(a) * r, math.sin(a) * r + lean * s, zz))
    for j in range(mseg):
        j2 = (j + 1) % mseg
        faces.append((mast[0] + j, mast[0] + j2, mast[1] + j2, mast[1] + j))
    return build(name, verts, faces)


GENERATORS.update({
    "pebbles": pebbles, "boulder": boulder, "slate": slate, "arch": arch,
    "bubble": bubble_coral, "anemone": anemone,
    "seahorse": seahorse, "jelly": jelly, "ray": ray,
    "chest": chest, "amphora": amphora, "wreck": wreck,
})
