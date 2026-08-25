"""Stylized character fish — built for the big-eyed, soft-bodied look."""
import bpy
import bmesh
import math
from mathutils import Vector, Matrix

TAU = math.tau


def build(name, verts, faces, smooth=True):
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    me.update()
    bm = bmesh.new()
    bm.from_mesh(me)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(me)
    bm.free()
    for p in me.polygons:
        p.use_smooth = smooth
    return bpy.data.objects.new(name, me)


def body_radius(t):
    """t: 0 at the nose, 1 at the tail root. Fat and forward-biased so the
    silhouette reads as a round character rather than a fish shape."""
    base = math.sin(math.pi * (t ** 0.70)) ** 0.55
    # pinch the caudal peduncle so the tail fin has something to attach to
    pinch = 1.0 - 0.72 * max(0.0, (t - 0.62) / 0.38) ** 1.6
    return base * pinch


def make_body(name, length=1.0, radius=0.44, width=0.84,
              rings=44, segs=36, belly=0.10):
    verts, faces = [], []
    nose = len(verts)
    verts.append((-length * 0.5, 0.0, 0.0))

    ring_start = []
    for i in range(1, rings):
        t = i / rings
        r = body_radius(t) * radius
        x = -length * 0.5 + length * t
        ring_start.append(len(verts))
        for s in range(segs):
            a = s / segs * TAU
            y = math.cos(a) * r * width
            z = math.sin(a) * r
            # drop the belly a touch so it isn't a perfect ellipse
            z -= belly * r * (1.0 - abs(math.cos(a))) * (1.0 if z < 0 else 0.35)
            verts.append((x, y, z))

    tail = len(verts)
    verts.append((length * 0.5, 0.0, 0.0))

    for s in range(segs):
        faces.append((nose, ring_start[0] + (s + 1) % segs, ring_start[0] + s))
    for r in range(len(ring_start) - 1):
        a0, a1 = ring_start[r], ring_start[r + 1]
        for s in range(segs):
            s2 = (s + 1) % segs
            faces.append((a0 + s, a0 + s2, a1 + s2, a1 + s))
    last = ring_start[-1]
    for s in range(segs):
        faces.append((tail, last + s, last + (s + 1) % segs))

    return build(name, verts, faces)


def make_eye(name, radius=0.15, segs=28):
    """A sphere; the iris/highlight are separate shells sitting on it."""
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=segs, v_segments=segs // 2, radius=radius)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    for p in me.polygons:
        p.use_smooth = True
    return bpy.data.objects.new(name, me)


def make_fin(name, span=0.5, spread=130.0, z_scale=1.0, lobes=3,
             thickness=0.016, rings=8, arcs=23, curl=0.35, taper=0.55):
    """A fan opening along +X. Radiating from the attachment point (rather
    than spanning a box) is what makes it read as a fin instead of a flat
    blade — and the scalloped outer edge gives the soft flowing silhouette."""
    verts, faces = [], []
    half = math.radians(spread) * 0.5

    for side in (1, -1):
        base = len(verts)
        for ri in range(rings + 1):
            u = ri / rings
            for ai in range(arcs):
                v = ai / (arcs - 1)
                ang = (v - 0.5) * 2.0 * half
                # scallops only bite into the outer edge
                scallop = 1.0 + 0.13 * math.sin(v * math.pi * lobes * 2.0) * (u ** 2)
                r = span * u * scallop
                x = math.cos(ang) * r
                z = math.sin(ang) * r * z_scale
                # thins toward the trailing edge, and curls out of plane
                t = thickness * 0.5 * (1.0 - u * taper)
                y = side * t + math.sin(v * math.pi) * curl * (u ** 2) * 0.12
                verts.append((x, y, z))
        for ri in range(rings):
            for ai in range(arcs - 1):
                i = base + ri * arcs + ai
                q = (i, i + 1, i + arcs + 1, i + arcs)
                faces.append(q if side == 1 else q[::-1])

    per = (rings + 1) * arcs
    # seal the outer rim so the fin has a visible edge
    for ai in range(arcs - 1):
        a0 = rings * arcs + ai
        faces.append((a0, per + a0, per + a0 + 1, a0 + 1))
    # seal the two side edges
    for ri in range(rings):
        for ai in (0, arcs - 1):
            i = ri * arcs + ai
            j = i + arcs
            q = (i, j, per + j, per + i)
            faces.append(q if ai == 0 else q[::-1])
    return build(name, verts, faces)


# ═══════════════════════════════════════════════════════════════════
#  Goldfish character — rounder body, top-set eyes, lips, swept fins
# ═══════════════════════════════════════════════════════════════════

def body_radius_round(t):
    """Fuller than the clownfish and pinched harder at the peduncle."""
    base = math.sin(math.pi * (t ** 0.60)) ** 0.40
    pinch = 1.0 - 0.86 * max(0.0, (t - 0.64) / 0.36) ** 1.35
    return max(0.02, base * pinch)


def make_round_body(name, length=1.0, radius=0.50, width=0.86,
                    rings=34, segs=30, belly=0.30, back_flat=0.12):
    """Egg body with a heavy lower belly and a slightly flattened back
    for the dorsal fin to sit on."""
    verts, faces = [], []
    verts.append((-length * 0.5, 0.0, 0.0))
    ring_start = []
    for i in range(1, rings):
        t = i / rings
        r = body_radius_round(t) * radius
        x = -length * 0.5 + length * t
        ring_start.append(len(verts))
        for s in range(segs):
            a = s / segs * TAU
            ca, sa = math.cos(a), math.sin(a)
            y = ca * r * width
            z = sa * r
            if sa < 0:                       # belly hangs lower and rounder
                z *= 1.0 + belly * (-sa)
            else:                            # back flattens toward the top
                z *= 1.0 - back_flat * sa
            verts.append((x, y, z))
    tail = len(verts)
    verts.append((length * 0.5, 0.0, 0.0))

    for s in range(segs):
        faces.append((0, ring_start[0] + (s + 1) % segs, ring_start[0] + s))
    for r in range(len(ring_start) - 1):
        a0, a1 = ring_start[r], ring_start[r + 1]
        for s in range(segs):
            s2 = (s + 1) % segs
            faces.append((a0 + s, a0 + s2, a1 + s2, a1 + s))
    last = ring_start[-1]
    for s in range(segs):
        faces.append((tail, last + s, last + (s + 1) % segs))
    return build(name, verts, faces)


def make_flat_shape(name, outline, thickness=0.022, bulge=0.35):
    """Extrude a closed XZ outline into a fin. Bulging the centre keeps it
    from reading as flat card — that was the failure on the first fish."""
    cx = sum(p[0] for p in outline) / len(outline)
    cz = sum(p[1] for p in outline) / len(outline)
    verts, faces = [], []
    n = len(outline)

    for side in (1, -1):
        base = len(verts)
        verts.append((cx, side * thickness * 0.5 * (1.0 + bulge), cz))
        for (x, z) in outline:
            verts.append((x, side * thickness * 0.5, z))
        for i in range(n):
            a = base + 1 + i
            b = base + 1 + (i + 1) % n
            faces.append((base, a, b) if side == 1 else (base, b, a))

    front = 1
    back = 1 + n + 1
    for i in range(n):
        a0, a1 = front + i, front + (i + 1) % n
        b0, b1 = back + i, back + (i + 1) % n
        faces.append((a0, a1, b1, b0))
    return build(name, verts, faces)


def make_lips(name, r_major=0.135, r_minor=0.052, major_segs=22, minor_segs=10,
              squash=0.62, pout=0.35):
    """A torus facing -X, squashed into a wide mouth and pushed forward at
    the centre so it reads as pouty lips rather than a ring."""
    verts, faces = [], []
    for i in range(major_segs):
        u = i / major_segs * TAU
        cy = math.cos(u) * r_major
        cz = math.sin(u) * r_major * squash
        # the corners of the mouth sit further back than the middle
        forward = pout * (0.5 + 0.5 * math.cos(u * 2.0)) * r_minor
        for j in range(minor_segs):
            v = j / minor_segs * TAU
            rr = r_minor * (1.0 + 0.25 * math.cos(u))
            nx = math.cos(v) * rr
            ny = math.sin(v) * rr
            dy = cy / max(1e-5, r_major)
            dz = cz / max(1e-5, r_major * squash)
            verts.append((-nx - forward, cy + ny * dy * 0.55, cz + ny * dz * 0.55))
    for i in range(major_segs):
        i2 = (i + 1) % major_segs
        for j in range(minor_segs):
            j2 = (j + 1) % minor_segs
            faces.append((i * minor_segs + j, i2 * minor_segs + j,
                          i2 * minor_segs + j2, i * minor_segs + j2))
    return build(name, verts, faces)


def smooth_outline(points, subdiv=6):
    """Catmull-Rom through a closed polygon. Straight outline segments read
    as facets on a fin; interpolating gives it a rounded silhouette."""
    n = len(points)
    out = []
    for i in range(n):
        p0 = points[(i - 1) % n]
        p1 = points[i]
        p2 = points[(i + 1) % n]
        p3 = points[(i + 2) % n]
        for s in range(subdiv):
            t = s / subdiv
            t2, t3 = t * t, t * t * t
            x = 0.5 * ((2 * p1[0]) + (-p0[0] + p2[0]) * t +
                       (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 +
                       (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3)
            z = 0.5 * ((2 * p1[1]) + (-p0[1] + p2[1]) * t +
                       (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 +
                       (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3)
            out.append((x, z))
    return out


# ═══════════════════════════════════════════════════════════════════
#  Veiltail betta — flowing fins, scale relief, length-wise gradient
# ═══════════════════════════════════════════════════════════════════

def add_scale_relief(ob, amount=0.007, along=26.0, around=11.0,
                     x0=-0.22, x1=0.34):
    """Push vertices out along a diamond grid so scales are real relief.
    Vertex colours can't hold a hard repeating pattern (it aliases on the
    quad edges), so this does it with geometry instead."""
    me = ob.data
    for v in me.vertices:
        r = math.hypot(v.co.y, v.co.z)
        if r < 1e-5:
            continue
        band = 0.0
        if x0 < v.co.x < x1:
            t = (v.co.x - x0) / (x1 - x0)
            band = math.sin(math.pi * t) ** 0.7
        ang = math.atan2(v.co.z, v.co.y)
        pat = math.sin(v.co.x * along) * math.sin(ang * around)
        k = 1.0 + (amount * band * pat) / r
        v.co.y *= k
        v.co.z *= k
    me.update()
    return ob


def make_veil(name, span=1.0, spread=150.0, z_scale=1.15, ruffles=7,
              thickness=0.014, rings=14, arcs=41, ripple=0.10, droop=0.22,
              ruffle_amp=0.10):
    """A large flowing fin: radial fan with a ruffled trailing edge and a
    standing wave across it, so it reads as cloth rather than a plate."""
    verts, faces = [], []
    half = math.radians(spread) * 0.5

    for side in (1, -1):
        base = len(verts)
        for ri in range(rings + 1):
            u = ri / rings
            for ai in range(arcs):
                v = ai / (arcs - 1)
                ang = (v - 0.5) * 2.0 * half
                edge = 1.0 + ruffle_amp * math.sin(v * math.pi * ruffles * 2.0) * (u ** 2)
                r = span * u * edge
                x = math.cos(ang) * r
                z = math.sin(ang) * r * z_scale
                # waves grow toward the trailing edge; the fin also sags
                wave = math.sin(v * math.pi * ruffles) * ripple * (u ** 1.6)
                t = thickness * 0.5 * (1.0 - u * 0.7)
                y = side * t + wave
                z -= droop * (u ** 2) * 0.35
                verts.append((x, y, z))
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
    return build(name, verts, faces)


def veil_rays(ob, root=(0.0, 0.0), dark=0.35, count=26):
    """Radiating ray lines baked to vertex colour — these are soft-edged
    by nature, so interpolation works in our favour here."""
    me = ob.data
    attr = me.color_attributes.get("Col") or me.color_attributes.new(
        name="Col", type="FLOAT_COLOR", domain="POINT")
    for i, v in enumerate(me.vertices):
        ang = math.atan2(v.co.z - root[1], v.co.x - root[0])
        s = 0.5 + 0.5 * math.sin(ang * count)
        shade = 1.0 - dark * (s ** 2)
        attr.data[i].color = (shade, shade, shade, 1.0)
    return ob


# ═══════════════════════════════════════════════════════════════════
#  Anglerfish — lure stalk, spiky crest
# ═══════════════════════════════════════════════════════════════════

def make_tube(name, points, radii, segs=10):
    """Sweep a circle along a polyline. Used for the angler's lure stalk;
    frames are built from the local tangent so the tube doesn't pinch."""
    verts, faces = [], []
    n = len(points)
    rings = []
    for i, p in enumerate(points):
        p = Vector(p)
        nxt = Vector(points[min(i + 1, n - 1)])
        prv = Vector(points[max(i - 1, 0)])
        tan = (nxt - prv)
        if tan.length < 1e-6:
            tan = Vector((0, 0, 1))
        tan.normalize()
        ref = Vector((0, 1, 0))
        if abs(tan.dot(ref)) > 0.95:
            ref = Vector((1, 0, 0))
        u = tan.cross(ref).normalized()
        w = tan.cross(u).normalized()
        rings.append(len(verts))
        for s in range(segs):
            a = s / segs * TAU
            verts.append(tuple(p + u * (math.cos(a) * radii[i]) + w * (math.sin(a) * radii[i])))
    for i in range(n - 1):
        a0, a1 = rings[i], rings[i + 1]
        for s in range(segs):
            s2 = (s + 1) % segs
            faces.append((a0 + s, a0 + s2, a1 + s2, a1 + s))
    for cap, ring, flip in ((points[0], rings[0], True), (points[-1], rings[-1], False)):
        c = len(verts)
        verts.append(tuple(cap))
        for s in range(segs):
            s2 = (s + 1) % segs
            faces.append((c, ring + s2, ring + s) if flip else (c, ring + s, ring + s2))
    return build(name, verts, faces)


def spiky_outline(x0, x1, base_z, height, spikes=6, sharpness=0.55, flip=1):
    """Zigzag ridge outline. Deliberately NOT smoothed — the whole point of
    this crest is hard points, so Catmull-Rom would destroy it."""
    lower, upper = [], []
    steps = spikes * 2
    for i in range(steps + 1):
        t = i / steps
        x = x0 + (x1 - x0) * t
        env = math.sin(math.pi * t) ** 0.5
        lower.append((x, base_z * flip))
        peak = height * env * (1.0 if i % 2 else sharpness)
        upper.append((x, (base_z + peak) * flip))
    return lower + list(reversed(upper))


# ═══════════════════════════════════════════════════════════════════
#  Seahorse — S-curve spine with a spiral tail
# ═══════════════════════════════════════════════════════════════════

def seahorse_spine(curl_pts=16, body_pts=24):
    """Tail spiral flowing into an S-curved body. Returns points ordered
    tail-tip first, so the tube radii can taper naturally along it."""
    pts, radii = [], []

    cx, cz = 0.10, -0.50
    for i in range(curl_pts):
        u = i / (curl_pts - 1)
        # spiral outward from the tip: ~1.9 turns, radius growing
        ang = math.pi * (2.6 - 2.1 * u)
        r = 0.055 + 0.155 * u
        pts.append((cx + math.cos(ang) * r, 0.0, cz + math.sin(ang) * r))
        radii.append(0.026 + 0.052 * u)

    x0, z0 = pts[-1][0], pts[-1][2]
    for i in range(1, body_pts):
        u = i / (body_pts - 1)
        # lean forward through the belly then back at the neck
        x = x0 - 0.16 * math.sin(u * math.pi * 0.92)
        z = z0 + u * 0.86
        pts.append((x, 0.0, z))
        # thickest through the belly, narrowing into the neck
        radii.append(0.078 + 0.062 * math.sin(u * math.pi * 0.86) ** 1.3
                     - 0.030 * max(0.0, u - 0.72) / 0.28)
    return pts, radii


def make_ridges(name, spine, radii, count=13, start=0.20, end=0.86,
                bump=0.018, width=0.022, segs=14):
    """Discrete raised bands around the belly.

    Each band is its own short sleeve with capped ends — connecting
    consecutive rings instead produced one continuous tube that swallowed
    the whole body.
    """
    verts, faces = [], []
    n = len(spine)

    def frame(idx):
        p = Vector(spine[idx])
        nxt = Vector(spine[min(idx + 1, n - 1)])
        prv = Vector(spine[max(idx - 1, 0)])
        tan = (nxt - prv)
        if tan.length < 1e-6:
            tan = Vector((0, 0, 1))
        tan.normalize()
        ref = Vector((0, 1, 0))
        if abs(tan.dot(ref)) > 0.95:
            ref = Vector((1, 0, 0))
        u = tan.cross(ref).normalized()
        w = tan.cross(u).normalized()
        return p, tan, u, w

    for k in range(count):
        t = start + (end - start) * (k / max(1, count - 1))
        idx = min(n - 2, max(1, int(t * (n - 1))))
        p, tan, u, w = frame(idx)
        r = radii[idx] + bump
        rings = []
        for side in (-1, 1):
            c = p + tan * (width * 0.5 * side)
            base = len(verts)
            rings.append(base)
            for s in range(segs):
                a = s / segs * TAU
                verts.append(tuple(c + u * (math.cos(a) * r) + w * (math.sin(a) * r * 0.94)))
        a0, a1 = rings
        for s in range(segs):
            s2 = (s + 1) % segs
            faces.append((a0 + s, a0 + s2, a1 + s2, a1 + s))
        # cap both ends so the band reads as a solid ridge
        for ring, flip in ((a0, True), (a1, False)):
            c_i = len(verts)
            verts.append(tuple(p + tan * (width * 0.5 * (-1 if flip else 1))))
            for s in range(segs):
                s2 = (s + 1) % segs
                faces.append((c_i, ring + s2, ring + s) if flip
                             else (c_i, ring + s, ring + s2))
    return build(name, verts, faces)


# ═══════════════════════════════════════════════════════════════════
#  Neon tetra — flank stripes as separate emissive geometry
# ═══════════════════════════════════════════════════════════════════

def make_stripe(name, length, radius, width, x0, x1, z_lo, z_hi,
                steps=48, lift=0.006, taper_ends=True):
    """A band hugging both flanks, generated from the body's own cross
    section so it sits on the surface instead of intersecting it.

    z_lo/z_hi are fractions of the local radius, so the stripe follows the
    body's taper rather than running straight.

    Built as its own mesh because glTF emission is per-material: a stripe
    painted into vertex colours could never glow on export.
    """
    verts, faces = [], []
    for side in (1, -1):
        base = len(verts)
        for i in range(steps + 1):
            u = i / steps
            x = x0 + (x1 - x0) * u
            t = min(max((x + length * 0.5) / length, 1e-4), 0.9999)
            r = body_radius_round(t) * radius
            fade = math.sin(math.pi * u) ** 0.14 if taper_ends else 1.0
            for zf in (z_lo, z_hi):
                z = zf * r * fade
                inside = max(0.0, 1.0 - (z / max(1e-5, r)) ** 2)
                y = side * (r * width * math.sqrt(inside) + lift)
                verts.append((x, y, z))
        for i in range(steps):
            a = base + i * 2
            q = (a, a + 1, a + 3, a + 2)
            faces.append(q if side == 1 else q[::-1])
    return build(name, verts, faces)


# ═══════════════════════════════════════════════════════════════════
#  Manta ray — swept delta wing
# ═══════════════════════════════════════════════════════════════════

def make_manta(name, span=1.35, length=1.05, thick=0.20,
               u_steps=30, v_steps=44, tip_rise=0.16, arch=0.05):
    """Delta wing built per-spanwise-station: each station has its own
    chord, so the leading edge sweeps back to the tip and the trailing
    edge sweeps forward to the tail root — a plain grid can't do that.

    Thickness falls off toward both the wing edge and the chord ends, so
    the tips finish thin instead of slab-sided.
    """
    def chord(av):
        # higher exponents hold the chord near the root then sweep hard at
        # the tip, which is what makes the edges read as curves rather than
        # straight lines
        front = -0.50 + 0.54 * av ** 1.85          # leading edge sweeps back
        back = 0.50 - 0.40 * av ** 1.30            # trailing edge sweeps in
        return front, back

    verts, faces = [], []
    row = u_steps + 1
    for surf in (1, -1):                            # top sheet, then bottom
        for j in range(v_steps + 1):
            v = -1.0 + 2.0 * j / v_steps
            av = abs(v)
            front, back = chord(av)
            for i in range(row):
                u = i / u_steps
                x = (front + (back - front) * u) * length
                y = v * span * 0.5
                t = thick * (1.0 - av) ** 0.75 * math.sin(math.pi * u) ** 0.85
                mid = arch * (1.0 - av) + tip_rise * av ** 2.2
                verts.append((x, y, mid + surf * t * 0.5))
        base = 0 if surf == 1 else (v_steps + 1) * row
        for j in range(v_steps):
            for i in range(u_steps):
                a = base + j * row + i
                q = (a, a + 1, a + row + 1, a + row)
                faces.append(q if surf == 1 else q[::-1])

    # seal the rim where the two sheets meet
    off = (v_steps + 1) * row
    for j in range(v_steps):
        for i in (0, u_steps):
            a0 = j * row + i
            a1 = (j + 1) * row + i
            q = (a0, a1, off + a1, off + a0)
            faces.append(q if i == 0 else q[::-1])
    for i in range(u_steps):
        for j in (0, v_steps):
            a0 = j * row + i
            a1 = j * row + i + 1
            q = (a0, a1, off + a1, off + a0)
            faces.append(q if j == v_steps else q[::-1])
    return build(name, verts, faces)


def make_lobe(name, length=0.30, r0=0.075, r1=0.035, bend=0.22, steps=9, segs=12):
    """Cephalic lobe — the paddle horns either side of a manta's mouth."""
    pts, radii = [], []
    for i in range(steps):
        t = i / (steps - 1)
        pts.append((-length * t, 0.0, bend * math.sin(t * math.pi * 0.55)))
        radii.append(r0 + (r1 - r0) * t)
    return make_tube(name, pts, radii, segs=segs)
