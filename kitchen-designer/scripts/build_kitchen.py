"""
build_kitchen.py — parametric build of the kitchen documented in
the client's KCD elevation drawing (kept outside the repo), exported to public/models/kitchen.glb for
the homepage scroll scene (src/components/ui/KitchenBuildSection.js).

Run headless:
    blender --background --python scripts/build_kitchen.py

--------------------------------------------------------------------------
Where the numbers come from
--------------------------------------------------------------------------
Every dimension below was read off the shop drawings, cross-checked between the
floor plan (PDF p2, whose vector coordinates calibrate at 1.29042 pt/inch) and
the wall elevations (p3-p12).  Plan coordinates used here are inches with
    X = east (along the back wall)      Y = south (toward the viewer)
measured from the inside corner of wall 1 (back, north) and wall 9 (left, west).

  Wall 1  (back)   324"  long, ceiling 120".  Door71 at x 21.9-93.2.
                   Cabinet run x 143.8-324: bases 1/3/4/5 = 35/30/44/30 then a
                   41" fridge opening.  Uppers 7/9 (35/30, d12), 44" hood bay,
                   11 (30, d12), 6 over the fridge (41, d24, 44" tall).
  Wall 5  (right)  131" long at x 401.2, y 76.6-207.6, facing west.  Oven tower
                   28 (31.5, d24) at the north end, bases 29/31/32 = 33/33/33.5,
                   glass uppers 33/35/36 over them.
  Wall 9  (left)   204" with three Win48 (48" wide) at 25.5 / 4.5 / 4.5 / 25.5.
  Island           chevron.  Cabinet faces: wall 3 = 63" (x 198.3, y 76.1-139.1),
                   wall 8 = 17" 45-degree corner, wall 4 = 107.5" (y 151.2).
                   Backs are 16" out under a 41.1"-wide granite top; the outer
                   45-degree face measures 51" (panels) / 75.5" (counter edge),
                   which is exactly what pages 9-10 and the plan's "75" call out.
  Heights          base 36 + 1.5 counter = 37.5; 21" backsplash + 1" light rail;
                   uppers 58" tall topping out at 117.5 under crown to 120.

Note on handedness: authoring with Y=south makes (east, south, up) left-handed,
which mirrors the render left-for-right.  Geometry is authored in plan space and
`mirror_y()` flips it into Blender's frame (+Y = north) at the end, so the glTF
axis conversion (x, y, z) -> (x, z, -y) leaves east on +X and north on -Z.

--------------------------------------------------------------------------
Animation contract
--------------------------------------------------------------------------
Every exported mesh carries glTF `extras` (three.js userData):
    build_static : 1 = room shell, always visible.  0 = builds in on scroll.
    build_order  : reveal step.  Meshes sharing a step appear together.
    build_group  : room | base | counter | upper | tall | appliance | island | trim
Objects are joined per (build_order, material) at the end so the browser gets
~100 single-material meshes instead of ~700 boxes.
"""

import bpy
import bmesh
import math
import os

IN = 0.0254  # inches -> metres

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT = os.path.dirname(SCRIPT_DIR)
GLB_PATH = os.path.join(PROJECT, "public", "models", "kitchen.glb")
PREVIEW_HERO = os.path.join(SCRIPT_DIR, "_preview_hero.png")
PREVIEW_TOP = os.path.join(SCRIPT_DIR, "_preview_top.png")

# ---------------------------------------------------------------------------
# dimensions (inches)
# ---------------------------------------------------------------------------
CEIL = 120.0
W1_LEN = 323.5          # PDF p3: 22 + 71 door + 50.5 + 180 of cabinets
W9_LEN = 204.0

BASE_H = 36.0
COUNTER_T = 1.5
COUNTER_TOP = BASE_H + COUNTER_T          # 37.5
TOE_H = 4.5
TOE_RECESS = 3.0
BASE_D = 24.0

UPPER_BOT = 59.5        # 37.5 counter + 21 backsplash + 1 light rail
UPPER_TOP = 117.5
UPPER_D = 12.0

REVEAL = 0.16
FRONT_T = 0.75
STILE = 2.25

W1_RUN_X = 143.5
W1_BASES = [("1", 35.0), ("3", 30.0), ("4", 44.0), ("5", 30.0)]
W1_FRIDGE_X0 = 282.5    # 143.5 + 139 -> a 41" fridge opening

W5_X = 401.2
W5_WALL_T = 13.2
W5_Y0 = 76.6
W5_LEN = 131.0
W5_TOWER_W = 31.5
W5_BASES = [("29", 33.0), ("31", 33.0), ("32", 33.5)]

# Sink, straight off the plan: an 18 x 33.4 bowl with ~1" corners, and the
# faucet body west of it on the seating side (PDF p2 vector coordinates).
SINK_CX, SINK_CY = 188.3, 120.7
SINK_W, SINK_L = 18.0, 33.4
SINK_DEPTH = 9.0
SINK_WALL = 0.5
FAUCET_X, FAUCET_Y = 175.7, 120.7

# End of the hallway. Kept shallow on purpose: the kitchen camera looks into
# this opening at a very oblique angle, so a deep corridor shows only its side
# wall. At this depth the end wall fills the opening and closes the view.
DINING_FAR_Y = -72.0

ISL_COUNTER = [
    (158.3, 75.1), (199.4, 75.1), (199.4, 138.8), (210.9, 150.3),
    (319.5, 150.3), (319.5, 191.5), (211.8, 191.5), (158.5, 138.2),
]

ALL_OBJS = []
_ORDER = [0]
# which run a part belongs to, so the page can build one zone per scroll gap
_ZONE = ["room"]


def set_zone(z):
    _ZONE[0] = z


def step():
    _ORDER[0] += 1
    return _ORDER[0]


def order():
    return _ORDER[0]


# ---------------------------------------------------------------------------
# materials
# ---------------------------------------------------------------------------
def _srgb_to_linear(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def hexcol(h):
    h = h.lstrip("#")
    return tuple(_srgb_to_linear(int(h[i:i + 2], 16) / 255.0) for i in (0, 2, 4)) + (1.0,)


def make_mat(name, hexstr, roughness=0.5, metallic=0.0, alpha=1.0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = hexcol(hexstr)
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    if alpha < 1.0:
        bsdf.inputs["Alpha"].default_value = alpha
        mat.blend_method = "BLEND"
    return mat


def build_materials():
    # names are matched by prefix in KitchenBuildSection.js
    return {
        "paint": make_mat("paint_white", "#f2f4f1", 0.42),
        "paint_panel": make_mat("paint_white_panel", "#eaece7", 0.45),
        "toe": make_mat("toe_gray", "#b9bdbd", 0.6),
        "granite": make_mat("granite_top", "#cfd0cb", 0.28),
        "oak": make_mat("oak_floor", "#e2c37e", 0.55),
        "wall": make_mat("wall_gray", "#cbd0d1", 0.85),
        "wall2": make_mat("wall_beige", "#a18c65", 0.85),
        "ceil": make_mat("ceiling_white", "#efefef", 0.9),
        "glass": make_mat("glass_frosted", "#dfe7ea", 0.08, 0.0, 0.30),
        "cabint": make_mat("cabinterior_white", "#e6e9e6", 0.7),
        "steel": make_mat("stainless_steel", "#b9bcbe", 0.30, 1.0),
        "steel_dk": make_mat("stainless_dark", "#5f6265", 0.35, 1.0),
        "black": make_mat("metal_black", "#26282a", 0.35, 0.9),
        "beam": make_mat("beam_wood", "#6f4a2b", 0.65),
        "trim": make_mat("paint_trim", "#fafbfa", 0.4),
        "can": make_mat("metal_can", "#3a3c3e", 0.5, 0.6),
        "glassdk": make_mat("glass_oven", "#2c3033", 0.12, 0.4),
        "iron": make_mat("cast_iron", "#2a2c2e", 0.78, 0.15),
        "wall_in": inside_only(make_mat("wall_gray_inside", "#cbd0d1", 0.85)),
        "lens": make_mat("can_lens", "#ffffff", 0.3),    # glows at runtime
        # clear window glass — the frosted cabinet glass hid the view outside
        "win_glass": make_mat("glass_window", "#eef4f6", 0.05, 0.0, 0.15),
    }


def inside_only(mat):
    """Back-face culled, so the glTF exports it single-sided: a wall made of it
    shows from inside the room and vanishes when the camera is behind it."""
    mat.use_backface_culling = True
    return mat


# ---------------------------------------------------------------------------
# geometry primitives (authored in plan space: x east, y south, z up)
# ---------------------------------------------------------------------------
def _finish(obj, mat):
    bpy.context.scene.collection.objects.link(obj)
    obj.data.materials.append(mat)
    ALL_OBJS.append(obj)
    return obj


def _mesh_from(name, verts, faces, mat):
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata([(v[0] * IN, v[1] * IN, v[2] * IN) for v in verts], [], faces)
    mesh.validate()
    mesh.polygons.foreach_set("use_smooth", [False] * len(mesh.polygons))
    return _finish(bpy.data.objects.new(name, mesh), mat)


def _tube(name, poly_bot, poly_top, z0, z1, mat):
    n = len(poly_bot)
    verts = [(x, y, z0) for (x, y) in poly_bot] + [(x, y, z1) for (x, y) in poly_top]
    faces = [tuple(range(n - 1, -1, -1)), tuple(range(n, 2 * n))]
    for i in range(n):
        j = (i + 1) % n
        faces.append((i, j, j + n, i + n))
    return _mesh_from(name, verts, faces, mat)


def prism(name, poly, z0, z1, mat):
    return _tube(name, poly, poly, z0, z1, mat)


def slab(name, x0, x1, y0, y1, z0, z1, mat):
    return prism(name, [(x0, y0), (x1, y0), (x1, y1), (x0, y1)], z0, z1, mat)


def frustum(name, poly_bot, poly_top, z0, z1, mat):
    return _tube(name, poly_bot, poly_top, z0, z1, mat)


def raised_panel(name, x0, x1, z0, z1, y_back, y_front, inset, mat):
    """A raised panel: the field stands proud of its surrounding cove on a
    chamfer, the way a real stile-and-rail door is made. Built as a frustum
    lying along Y so the chamfer catches light at grazing angles."""
    outer = [(x0, z0), (x1, z0), (x1, z1), (x0, z1)]
    inner = [(x0 + inset, z0 + inset), (x1 - inset, z0 + inset),
             (x1 - inset, z1 - inset), (x0 + inset, z1 - inset)]
    verts = [(x, y_back, z) for (x, z) in outer] + [(x, y_front, z) for (x, z) in inner]
    faces = [(3, 2, 1, 0), (4, 5, 6, 7)]
    for i in range(4):
        j = (i + 1) % 4
        faces.append((i, j, j + 4, i + 4))
    return _mesh_from(name, verts, faces, mat)


def panel_door_leaf(objs, name, x0, x1, z0, z1, y_back, y_front, M,
                    stile=5.0, top_rail=5.0, bot_rail=8.0):
    """One stile-and-rail leaf with a raised panel."""
    t = M["trim"]
    objs += [
        slab(name + "_ls", x0, x0 + stile, y_back, y_front, z0, z1, t),
        slab(name + "_rs", x1 - stile, x1, y_back, y_front, z0, z1, t),
        slab(name + "_br", x0 + stile, x1 - stile, y_back, y_front, z0, z0 + bot_rail, t),
        slab(name + "_tr", x0 + stile, x1 - stile, y_back, y_front, z1 - top_rail, z1, t),
    ]
    objs.append(raised_panel(name + "_panel",
                             x0 + stile - 0.4, x1 - stile + 0.4,
                             z0 + bot_rail - 0.4, z1 - top_rail + 0.4,
                             y_back + 0.35, y_front - 0.25, 1.6, M["paint_panel"]))
    return objs


def run_raised_panel(run, name, u0, u1, z0, z1, v_back, v_front, inset, mat):
    """Raised panel on a cabinet face: the field rises out of the frame on a
    chamfer instead of sitting flat in a recess."""
    outer = [(u0, z0), (u1, z0), (u1, z1), (u0, z1)]
    inner = [(u0 + inset, z0 + inset), (u1 - inset, z0 + inset),
             (u1 - inset, z1 - inset), (u0 + inset, z1 - inset)]
    verts = []
    for (u, z) in outer:
        x, y = run.pt(u, v_back)
        verts.append((x, y, z))
    for (u, z) in inner:
        x, y = run.pt(u, v_front)
        verts.append((x, y, z))
    faces = [(3, 2, 1, 0), (4, 5, 6, 7)]
    for i in range(4):
        j = (i + 1) % 4
        faces.append((i, j, j + 4, i + 4))
    return _mesh_from(name, verts, faces, mat)


def ring(name, cx, cy, z, r_in, r_out, thick, mat, seg=28):
    """Flat annulus — a burner outline etched into the cooktop glass."""
    verts, faces = [], []
    for k in range(seg):
        a = 2 * math.pi * k / seg
        ca, sa = math.cos(a), math.sin(a)
        verts += [(cx + ca * r_in, cy + sa * r_in, z),
                  (cx + ca * r_out, cy + sa * r_out, z),
                  (cx + ca * r_in, cy + sa * r_in, z + thick),
                  (cx + ca * r_out, cy + sa * r_out, z + thick)]
    for k in range(seg):
        a0, a1 = 4 * k, 4 * ((k + 1) % seg)
        faces += [(a0 + 2, a0 + 3, a1 + 3, a1 + 2),   # top
                  (a0 + 1, a0, a1, a1 + 1),           # bottom
                  (a0 + 3, a0 + 1, a1 + 1, a1 + 3),   # outer
                  (a0, a0 + 2, a1 + 2, a1)]           # inner
    return _mesh_from(name, verts, faces, mat)


def tube(name, path, radius, mat, ref=(0.0, 1.0, 0.0), seg=12):
    """One continuous swept pipe through a list of (x, y, z) points in inches.
    Rings are built perpendicular to the local tangent, so bends stay solid
    instead of reading as a row of disconnected stubs."""
    import mathutils
    pts = [mathutils.Vector(q) for q in path]
    n = len(pts)
    verts = []
    for i, q in enumerate(pts):
        if i == 0:
            t = pts[1] - pts[0]
        elif i == n - 1:
            t = pts[-1] - pts[-2]
        else:
            t = pts[i + 1] - pts[i - 1]
        t.normalize()
        n1 = t.cross(mathutils.Vector(ref))
        if n1.length < 1e-6:
            n1 = t.cross(mathutils.Vector((1.0, 0.0, 0.0)))
        n1.normalize()
        n2 = t.cross(n1)
        n2.normalize()
        for k in range(seg):
            a = 2 * math.pi * k / seg
            v = q + n1 * (math.cos(a) * radius) + n2 * (math.sin(a) * radius)
            verts.append((v.x, v.y, v.z))
    faces = []
    for i in range(n - 1):
        for k in range(seg):
            k2 = (k + 1) % seg
            faces.append((i * seg + k, (i + 1) * seg + k,
                          (i + 1) * seg + k2, i * seg + k2))
    faces.append(tuple(range(seg)))
    faces.append(tuple(range(n * seg - 1, (n - 1) * seg - 1, -1)))
    return _mesh_from(name, verts, faces, mat)


def boolean_diff(target, cutter):
    """Cut `cutter` out of `target` and dispose of the cutter."""
    bpy.context.view_layer.objects.active = target
    mod = target.modifiers.new("bool", "BOOLEAN")
    mod.operation = "DIFFERENCE"
    mod.object = cutter
    mod.solver = "EXACT"
    bpy.ops.object.modifier_apply(modifier=mod.name)
    if cutter in ALL_OBJS:
        ALL_OBJS.remove(cutter)
    bpy.data.objects.remove(cutter, do_unlink=True)
    return target


def cylinder(name, cx, cy, cz, radius, height, mat, axis="Z", seg=16):
    ring = [(math.cos(2 * math.pi * i / seg) * radius,
             math.sin(2 * math.pi * i / seg) * radius) for i in range(seg)]
    verts = []
    for sgn in (-0.5, 0.5):
        for (a, b) in ring:
            if axis == "Z":
                verts.append((cx + a, cy + b, cz + sgn * height))
            elif axis == "X":
                verts.append((cx + sgn * height, cy + a, cz + b))
            else:
                verts.append((cx + a, cy + sgn * height, cz + b))
    faces = [tuple(range(seg - 1, -1, -1)), tuple(range(seg, 2 * seg))]
    for i in range(seg):
        j = (i + 1) % seg
        faces.append((i, j, j + seg, i + seg))
    return _mesh_from(name, verts, faces, mat)


# ---------------------------------------------------------------------------
# polygon helpers
# ---------------------------------------------------------------------------
def poly_area(poly):
    a = 0.0
    for i in range(len(poly)):
        x0, y0 = poly[i]
        x1, y1 = poly[(i + 1) % len(poly)]
        a += x0 * y1 - x1 * y0
    return a / 2.0


def point_in_poly(poly, px, py):
    inside = False
    n = len(poly)
    for i in range(n):
        x0, y0 = poly[i]
        x1, y1 = poly[(i + 1) % n]
        if (y0 > py) != (y1 > py):
            xc = x0 + (py - y0) * (x1 - x0) / (y1 - y0)
            if px < xc:
                inside = not inside
    return inside


def edge_normal(poly, i):
    """Unit normal of edge i pointing out of the polygon."""
    x0, y0 = poly[i]
    x1, y1 = poly[(i + 1) % len(poly)]
    dx, dy = x1 - x0, y1 - y0
    L = math.hypot(dx, dy)
    nx, ny = dy / L, -dx / L
    mx, my = (x0 + x1) / 2 + nx * 0.05, (y0 + y1) / 2 + ny * 0.05
    return (-nx, -ny) if point_in_poly(poly, mx, my) else (nx, ny)


def offset_polygon(poly, d):
    """Miter-offset outward by d inches; handles reflex corners."""
    n = len(poly)
    lines = []
    for i in range(n):
        x0, y0 = poly[i]
        x1, y1 = poly[(i + 1) % n]
        nx, ny = edge_normal(poly, i)
        L = math.hypot(x1 - x0, y1 - y0)
        lines.append((x0 + nx * d, y0 + ny * d, (x1 - x0) / L, (y1 - y0) / L))
    out = []
    for i in range(n):
        ax, ay, adx, ady = lines[(i - 1) % n]
        bx, by, bdx, bdy = lines[i]
        den = adx * bdy - ady * bdx
        if abs(den) < 1e-9:
            out.append((bx, by))
            continue
        t = ((bx - ax) * bdy - (by - ay) * bdx) / den
        out.append((ax + adx * t, ay + ady * t))
    return out


def tag(obj, static, ordr, group):
    obj["build_static"] = 1 if static else 0
    obj["build_order"] = ordr
    obj["build_group"] = group
    obj["build_zone"] = _ZONE[0]


def tag_from(objs, static, ordr, group):
    for o in objs:
        tag(o, static, ordr, group)


# ---------------------------------------------------------------------------
# a "run": a cabinet face line with an outward normal.  Local coordinates are
# u (along the face), v (behind the face) and z (up).  voff shifts every part
# forward, which is how island fronts sit proud of the solid island body.
# ---------------------------------------------------------------------------
class Run:
    """A cabinet face line.  (ax, ay) sits on the *carcass back* — the wall for a
    wall run, the body face for the island — and `front` is how far the door face
    stands out from it along the outward normal.  Local coordinates are then
    u along the run, v measured back from the door face, and z up."""

    def __init__(self, ax, ay, dx, dy, nx, ny, voff=0.0, front=0.0):
        L = math.hypot(dx, dy)
        nl = math.hypot(nx, ny)
        self.ax, self.ay = ax, ay
        self.dx, self.dy = dx / L, dy / L
        self.nx, self.ny = nx / nl, ny / nl
        self.voff = voff
        self.front = front
        self.length = L

    def pt(self, u, v):
        w = self.front - v - self.voff
        return (self.ax + self.dx * u + self.nx * w,
                self.ay + self.dy * u + self.ny * w)

    def box(self, name, u0, u1, v0, v1, z0, z1, mat):
        return prism(name, [self.pt(u0, v0), self.pt(u1, v0),
                            self.pt(u1, v1), self.pt(u0, v1)], z0, z1, mat)


def run_between(ax, ay, bx, by, nx, ny, voff=0.0, front=0.0):
    return Run(ax, ay, bx - ax, by - ay, nx, ny, voff, front)


def run_on_edge(poly, i, voff=0.0, front=0.0):
    a, b = poly[i], poly[(i + 1) % len(poly)]
    nx, ny = edge_normal(poly, i)
    return Run(a[0], a[1], b[0] - a[0], b[1] - a[1], nx, ny, voff, front)


# ---------------------------------------------------------------------------
# fronts
# ---------------------------------------------------------------------------
def panel_front(run, name, u0, u1, z0, z1, M):
    """Frame-and-raised-panel front: four rails/stiles around a field that
    stands proud on a chamfer. (The drawings draw flat shaker fronts; raised
    panels are the client's preference.)"""
    s = min(STILE, (u1 - u0) / 3.0, (z1 - z0) / 3.0)
    inset = min(1.0, (u1 - u0) / 8.0, (z1 - z0) / 8.0)
    return [
        run.box(name + "_r0", u0, u1, 0, FRONT_T, z0, z0 + s, M["paint"]),
        run.box(name + "_r1", u0, u1, 0, FRONT_T, z1 - s, z1, M["paint"]),
        run.box(name + "_s0", u0, u0 + s, 0, FRONT_T, z0 + s, z1 - s, M["paint"]),
        run.box(name + "_s1", u1 - s, u1, 0, FRONT_T, z0 + s, z1 - s, M["paint"]),
        run_raised_panel(run, name + "_p", u0 + s - 0.35, u1 - s + 0.35,
                         z0 + s - 0.35, z1 - s + 0.35,
                         FRONT_T - 0.05, 0.12, inset, M["paint_panel"]),
    ]


def glass_front(run, name, u0, u1, z0, z1, M):
    s = STILE
    return [
        run.box(name + "_r0", u0, u1, 0, FRONT_T, z0, z0 + s, M["paint"]),
        run.box(name + "_r1", u0, u1, 0, FRONT_T, z1 - s, z1, M["paint"]),
        run.box(name + "_s0", u0, u0 + s, 0, FRONT_T, z0 + s, z1 - s, M["paint"]),
        run.box(name + "_s1", u1 - s, u1, 0, FRONT_T, z0 + s, z1 - s, M["paint"]),
        run.box(name + "_g", u0 + s - 0.3, u1 - s + 0.3, 0.30, 0.52,
                z0 + s - 0.3, z1 - s + 0.3, M["glass"]),
    ]


def pull_h(run, name, uc, z, M, length=5.0):
    out = [run.box(name, uc - length / 2, uc + length / 2, -1.05, -0.55, z - 0.3, z + 0.3, M["black"])]
    for du in (-length / 2 + 0.35, length / 2 - 0.35):
        out.append(run.box(name + "_p", uc + du - 0.2, uc + du + 0.2, -0.55, 0.05,
                           z - 0.2, z + 0.2, M["black"]))
    return out


def pull_v(run, name, u, z0, z1, M):
    out = [run.box(name, u - 0.3, u + 0.3, -1.05, -0.55, z0, z1, M["black"])]
    for dz in (z0 + 0.35, z1 - 0.35):
        out.append(run.box(name + "_p", u - 0.2, u + 0.2, -0.55, 0.05,
                           dz - 0.2, dz + 0.2, M["black"]))
    return out


def doors(run, name, u0, u1, z0, z1, M, glass=False, pull_at="top"):
    out = []
    n = 2 if (u1 - u0) > 24.5 else 1
    w = (u1 - u0) / n
    fn = glass_front if glass else panel_front
    for i in range(n):
        a = u0 + i * w + REVEAL
        b = u0 + (i + 1) * w - REVEAL
        out += fn(run, "%s_d%d" % (name, i), a, b, z0 + REVEAL, z1 - REVEAL, M)
        pu = (b - 1.4) if (n == 1 or i == 0) else (a + 1.4)
        if pull_at == "top":
            out += pull_v(run, "%s_pl%d" % (name, i), pu, z1 - 8.0, z1 - 3.0, M)
        else:
            out += pull_v(run, "%s_pl%d" % (name, i), pu, z0 + 3.0, z0 + 8.0, M)
    return out


def drawer(run, name, u0, u1, z0, z1, M, pull_len=None):
    out = panel_front(run, name, u0 + REVEAL, u1 - REVEAL, z0 + REVEAL, z1 - REVEAL, M)
    out += pull_h(run, name + "_pl", (u0 + u1) / 2, (z0 + z1) / 2, M,
                  pull_len or min(10.0, (u1 - u0) * 0.42))
    return out


# ---------------------------------------------------------------------------
# cabinet boxes
# ---------------------------------------------------------------------------
def base_carcass(run, name, u0, u1, M, depth=BASE_D):
    a, b = u0 + 0.04, u1 - 0.04
    return [
        run.box(name + "_toe", a, b, TOE_RECESS, depth, 0, TOE_H, M["toe"]),
        run.box(name + "_box", a, b, FRONT_T - 0.1, depth, TOE_H, BASE_H, M["paint"]),
    ]


def fronts_three_drawers(run, name, u0, u1, M, split_top=False):
    """Wall 1 bases 1/3/5 (PDF p3)."""
    z = [TOE_H, TOE_H + 12.5, TOE_H + 25.0, BASE_H]
    out = drawer(run, name + "_d0", u0, u1, z[0], z[1], M)
    out += drawer(run, name + "_d1", u0, u1, z[1], z[2], M)
    if split_top:
        mid = (u0 + u1) / 2
        out += drawer(run, name + "_d2a", u0, mid, z[2], z[3], M)
        out += drawer(run, name + "_d2b", mid, u1, z[2], z[3], M)
    else:
        out += drawer(run, name + "_d2", u0, u1, z[2], z[3], M)
    return out


def fronts_drawer_doors(run, name, u0, u1, M, drawer_h=6.5):
    """Top drawer over doors — wall 5 and the island (PDF p6, p8)."""
    zs = BASE_H - drawer_h
    out = doors(run, name + "_dr", u0, u1, TOE_H, zs, M, pull_at="top")
    out += drawer(run, name + "_tp", u0, u1, zs, BASE_H, M)
    return out


def base_three_drawers(run, name, u0, u1, M, split_top=False):
    return base_carcass(run, name, u0, u1, M) + \
        fronts_three_drawers(run, name, u0, u1, M, split_top)


def base_drawer_doors(run, name, u0, u1, M):
    return base_carcass(run, name, u0, u1, M) + fronts_drawer_doors(run, name, u0, u1, M)


def upper_glass(run, name, u0, u1, M, z0=UPPER_BOT, z1=UPPER_TOP, depth=UPPER_D):
    """Glass-door upper with a white interior and 1/2" glass shelves."""
    t = 0.75
    a, b = u0 + 0.04, u1 - 0.04
    out = [
        run.box(name + "_bk", a + t, b - t, depth - t, depth, z0 + t, z1 - t, M["cabint"]),
        run.box(name + "_lf", a, a + t, FRONT_T, depth, z0, z1, M["cabint"]),
        run.box(name + "_rt", b - t, b, FRONT_T, depth, z0, z1, M["cabint"]),
        run.box(name + "_bt", a + t, b - t, FRONT_T, depth, z0, z0 + t, M["cabint"]),
        run.box(name + "_tp", a + t, b - t, FRONT_T, depth, z1 - t, z1, M["cabint"]),
    ]
    for i in range(1, 5):
        zs = z0 + (z1 - z0) * i / 5.0
        out.append(run.box(name + "_sh%d" % i, a + t, b - t, FRONT_T + 0.3, depth - t,
                           zs - 0.25, zs + 0.25, M["glass"]))
    return out + doors(run, name, u0, u1, z0, z1, M, glass=True, pull_at="bottom")


def upper_solid(run, name, u0, u1, M, z0, z1, depth=UPPER_D):
    return [run.box(name + "_box", u0 + 0.04, u1 - 0.04, FRONT_T - 0.1, depth, z0, z1, M["paint"])] + \
        doors(run, name, u0, u1, z0, z1, M, pull_at="bottom")


def crown(run, name, u0, u1, M, depth=UPPER_D, ztop=CEIL, zbot=UPPER_TOP - 3.0):
    """Three-step crown plus the soffit filler that closes the cabinet tops to
    the ceiling — without the filler you see straight over the cabinet backs."""
    out = [run.box(name + "_fill", u0, u1, 0.0, depth, UPPER_TOP, ztop, M["paint"])]
    h = (ztop - zbot) / 3.0
    for i, proj in enumerate((0.7, 1.8, 3.0)):
        out.append(run.box("%s_c%d" % (name, i), u0 - proj, u1 + proj,
                           -proj, 0.3, zbot + i * h, zbot + (i + 1) * h, M["trim"]))
    return out


def light_rail(run, name, u0, u1, M, z=UPPER_BOT, depth=UPPER_D):
    return [run.box(name, u0, u1, -0.6, depth, z - 1.0, z, M["paint"])]


# ---------------------------------------------------------------------------
# appliances
# ---------------------------------------------------------------------------
def fridge(M, x0, y0):
    """Bosch B36CT80SNB counter-depth French door: 35.625 W x 72 H."""
    w, h = 35.625, 72.0
    out = [slab("fridge_body", x0, x0 + w, y0, y0 + 25.0, 0.5, h, M["steel_dk"]),
           slab("fridge_dl", x0, x0 + w / 2 - 0.2, y0 + 25.0, y0 + 28.6, 26.0, h, M["steel_dk"]),
           slab("fridge_dr", x0 + w / 2 + 0.2, x0 + w, y0 + 25.0, y0 + 28.6, 26.0, h, M["steel_dk"]),
           slab("fridge_fz", x0, x0 + w, y0 + 25.0, y0 + 28.6, 0.5, 25.4, M["steel_dk"])]
    for dx in (w / 2 - 3.0, w / 2 + 3.0):
        out.append(slab("fridge_h", x0 + dx - 0.45, x0 + dx + 0.45,
                        y0 + 28.6, y0 + 30.2, 34.0, 68.0, M["steel"]))
    out.append(slab("fridge_hz", x0 + 6, x0 + w - 6, y0 + 28.6, y0 + 30.0, 12.0, 13.2, M["steel"]))
    return out


RANGE_W = 36.0       # range width; 4" fillers close cabinet 4's 44" down to it


def range_stove(M, x0, x1):
    """36" pro-style gas range, standing in the opening wall 1 is built out
    for. An appliance, not a cabinet: stainless body, an oven door with a
    window and a bar handle, a knob panel, sealed burners under three
    cast-iron grates, and a low backguard. It stands 1" proud of the cabinet
    doors, as a freestanding range does.

    The wall-1 schedule shows a 36" cooktop on a 44" drawer base (cabinet 4).
    The client has a range there, so the base is gone and fillers take the
    opening down to 36" — centred under the 42" hood insert, as designed.
    """
    cx = (x0 + x1) / 2
    yb, yf = 1.0, BASE_D + 1.0          # back and front of the body
    zd = 36.0                           # cooking surface
    yd = yf + 1.8                       # face of the oven door
    out = [
        slab("range_kick", x0 + 0.4, x1 - 0.4, yf - 4.0, yf - 0.6, 0.3, 4.6, M["black"]),
        slab("range_body", x0, x1, yb, yf, 4.6, zd, M["steel"]),
        slab("range_door", x0 + 0.5, x1 - 0.5, yf, yd, 5.2, 28.8, M["steel"]),
        # the window's back face is buried in the door, so nothing is coplanar
        slab("range_window", cx - 11.0, cx + 11.0, yd - 0.05, yd + 0.15, 10.5, 22.5, M["glassdk"]),
        slab("range_panel", x0 + 0.5, x1 - 0.5, yf, yf + 1.2, 29.3, zd - 0.3, M["steel"]),
        slab("range_deck", x0, x1, yb, yf + 0.2, zd, zd + 0.4, M["steel"]),
        slab("range_back", x0, x1, 0.2, yb + 2.0, zd, zd + 4.5, M["steel"]),
    ]
    # bar handle on two standoffs along the top of the oven door
    hy = yd + 1.6
    out.append(cylinder("range_handle", cx, hy, 26.4, 0.55, x1 - x0 - 6.0, M["steel"], axis="X"))
    for sx in (x0 + 4.0, x1 - 4.0):
        out.append(cylinder("range_standoff", sx, (yd + hy) / 2, 26.4, 0.35, hy - yd + 0.1,
                            M["steel"], axis="Y"))
    # six knobs, one per burner
    for i in range(6):
        out.append(cylinder("range_knob", cx - 14.0 + i * 5.6, yf + 1.75, 32.4, 1.0, 1.2,
                            M["black"], axis="Y"))

    # sealed burners, two per grate section
    zt = zd + 0.4
    for gx in (cx - 11.6, cx, cx + 11.6):
        for by, r in ((yb + 8.0, 1.7), (yb + 17.5, 2.1)):
            out.append(cylinder("burner_base", gx, by, zt + 0.1, r + 0.5, 0.2, M["iron"]))
            out.append(cylinder("burner_cap", gx, by, zt + 0.38, r, 0.35, M["iron"]))
        # continuous cast-iron grate over the pair
        gx0, gx1 = gx - 5.5, gx + 5.5
        gy0, gy1 = yb + 3.2, yf - 1.2
        zb0, zb1 = zt, zt + 1.1           # grate tops level with the granite
        for i in range(4):                # bars running front to back
            bx = gx0 + (gx1 - gx0) * i / 3.0
            out.append(slab("grate_b", bx - 0.28, bx + 0.28, gy0, gy1, zb0, zb1, M["iron"]))
        for j in range(3):                # cross rails
            by = gy0 + (gy1 - gy0) * j / 2.0
            out.append(slab("grate_c", gx0, gx1, by - 0.28, by + 0.28, zb0, zb1 - 0.25, M["iron"]))
    return out


def range_hood(M, cx, y0, w=44.0):
    """Thermador 42" insert inside the custom white surround of PDF p3 item 10.

    The render's chimney is far gentler than a funnel: the width barely changes
    over its height, it is the depth that tapers back to the wall, and a
    projecting moulding band caps the apron. A steep width taper reads sharp
    and wrong.
    """
    d = 21.5
    z0 = UPPER_BOT
    zf = z0 + 7.0                 # top of the apron / underside of the band
    zb = zf + 1.6                 # top of the moulding band
    return [
        # apron: full width, full depth
        slab("hood_apron", cx - w / 2, cx + w / 2, y0, y0 + d, z0, zf, M["paint"]),
        # projecting moulding band
        slab("hood_band", cx - w / 2 - 0.7, cx + w / 2 + 0.7, y0, y0 + d + 0.7,
             zf, zb, M["trim"]),
        # chimney: 42 -> 38 in width, 21.5 -> 9 in depth
        frustum("hood_chimney",
                [(cx - 21.0, y0), (cx + 21.0, y0), (cx + 21.0, y0 + d), (cx - 21.0, y0 + d)],
                [(cx - 19.0, y0), (cx + 19.0, y0), (cx + 19.0, y0 + 9.0), (cx - 19.0, y0 + 9.0)],
                zb, UPPER_TOP, M["paint"]),
        # stainless insert peeking out under the apron
        slab("hood_insert", cx - 19.5, cx + 19.5, y0 + 1.0, y0 + d - 0.5,
             z0 - 0.7, z0, M["steel"]),
    ]


OVEN_CUT_W, OVEN_CUT_H = 28.5, 51.0      # HBL8642UC traditional cutout
OVEN_Z0 = TOE_H + 9.0                     # sits on the tower's bottom drawer


def wall_ovens(run, name, u0, u1, M):
    """30" HBL8642UC double oven, set back into the tower's cutout.

    The first version stood on the face of a solid tower block, and each oven
    window shared a plane with the oven body behind it, so the glass shimmered
    as the camera moved. Now the oven face sits ~1.9" behind the door fronts —
    the cutout reads as a recess around it — and every pane has its back face
    buried in the part behind it, so no two visible faces are coplanar.
    """
    uc = (u0 + u1) / 2
    a, b = uc - OVEN_CUT_W / 2 + 0.1, uc + OVEN_CUT_W / 2 - 0.1   # clear of the cutout
    z0, z1 = OVEN_Z0, OVEN_Z0 + OVEN_CUT_H
    vf = 1.9                              # oven face, measured back from the door fronts
    zc = z1 - 5.0                         # control strip above the upper door
    out = [run.box(name + "_body", a, b, vf, BASE_D - 0.9, z0 + 0.1, z1 - 0.1, M["steel_dk"])]
    for k, (za, zb) in enumerate(((z0 + 0.4, z0 + 23.4), (z0 + 24.0, zc - 0.3))):
        out.append(run.box(name + "_door%d" % k, a + 0.3, b - 0.3, vf - 0.5, vf, za, zb, M["steel_dk"]))
        out.append(run.box(name + "_gl%d" % k, a + 3.0, b - 3.0, vf - 0.62, vf - 0.45,
                           za + 3.5, zb - 5.0, M["glassdk"]))
        # bar handle on two standoffs across the top of each door
        out.append(run.box(name + "_hd%d" % k, a + 2.0, b - 2.0, vf - 2.3, vf - 1.4,
                           zb - 2.6, zb - 1.6, M["steel"]))
        for du in (a + 3.0, b - 3.0):
            out.append(run.box(name + "_hs%d" % k, du - 0.3, du + 0.3, vf - 1.45, vf - 0.45,
                               zb - 2.4, zb - 1.8, M["steel"]))
    out.append(run.box(name + "_ctl", a + 0.3, b - 0.3, vf - 0.35, vf, zc, z1 - 0.4, M["steel_dk"]))
    out.append(run.box(name + "_disp", uc - 4.0, uc + 4.0, vf - 0.45, vf - 0.3,
                       zc + 1.2, z1 - 1.6, M["glass"]))
    return out


def dishwasher(run, name, u0, u1, M):
    """24" SHX78CM4N with a bar handle."""
    return [
        run.box(name + "_body", u0 + REVEAL, u1 - REVEAL, 0, 1.2, TOE_H - 1.0, BASE_H, M["steel_dk"]),
        run.box(name + "_bar", u0 + 2.0, u1 - 2.0, -1.4, -0.4, BASE_H - 3.4, BASE_H - 2.2, M["steel"]),
    ]


def sink_bowl(M):
    """Undermount basin: an open box under the counter cutout, not a solid slab."""
    x0, x1 = SINK_CX - SINK_W / 2, SINK_CX + SINK_W / 2
    y0, y1 = SINK_CY - SINK_L / 2, SINK_CY + SINK_L / 2
    zb = BASE_H - SINK_DEPTH
    t = SINK_WALL
    out = [
        slab("sink_floor", x0, x1, y0, y1, zb, zb + t, M["steel"]),
        slab("sink_w_w", x0, x0 + t, y0, y1, zb, BASE_H, M["steel"]),
        slab("sink_w_e", x1 - t, x1, y0, y1, zb, BASE_H, M["steel"]),
        slab("sink_w_n", x0 + t, x1 - t, y0, y0 + t, zb, BASE_H, M["steel"]),
        slab("sink_w_s", x0 + t, x1 - t, y1 - t, y1, zb, BASE_H, M["steel"]),
        cylinder("sink_drain", SINK_CX, SINK_CY, zb + t + 0.15, 1.8, 0.3, M["steel_dk"]),
    ]
    return out


def sink_cutter(M, kind):
    """Voids for the sink: `top` opens the granite, `body` hollows the island
    carcass so the basin is not buried inside a solid prism."""
    if kind == "top":
        m = SINK_WALL           # counter overhangs onto the basin rim
        return slab("sink_cut_top",
                    SINK_CX - SINK_W / 2 + m, SINK_CX + SINK_W / 2 - m,
                    SINK_CY - SINK_L / 2 + m, SINK_CY + SINK_L / 2 - m,
                    BASE_H - 1.0, COUNTER_TOP + 1.0, M["granite"])
    m = 0.06                    # clear of the basin walls, no coplanar faces
    return slab("sink_cut_body",
                SINK_CX - SINK_W / 2 - m, SINK_CX + SINK_W / 2 + m,
                SINK_CY - SINK_L / 2 - m, SINK_CY + SINK_L / 2 + m,
                BASE_H - SINK_DEPTH - 1.5, BASE_H + 0.5, M["paint"])


def faucet(M):
    """Single-piece gooseneck: vertical riser, 180-degree bend, spout."""
    x, y = FAUCET_X, FAUCET_Y
    z0 = COUNTER_TOP
    z_top = z0 + 10.5          # where the bend springs from
    R = 5.0                    # bend radius, carries the spout over the bowl
    path = [(x, y, z0), (x, y, z_top - R * 0.25), (x, y, z_top)]
    for i in range(1, 13):     # 180 degrees, sweeping east toward the bowl
        a = math.pi * (1.0 - i / 12.0)
        path.append((x + R + R * math.cos(a), y, z_top + R * math.sin(a)))
    path.append((x + 2 * R, y, z_top - 2.2))
    path.append((x + 2 * R, y, z_top - 3.5))
    out = [
        tube("faucet_body", path, 0.55, M["steel"]),
        cylinder("faucet_flange", x, y, z0 + 0.6, 1.35, 1.2, M["steel"]),
        # side lever, springing off the riser just above the flange
        tube("faucet_lever", [(x, y - 0.45, z0 + 3.2),
                              (x + 0.35, y - 1.7, z0 + 3.6),
                              (x + 0.7, y - 3.0, z0 + 4.4)], 0.28, M["steel"]),
    ]
    return out


# ---------------------------------------------------------------------------
# room shell
# ---------------------------------------------------------------------------
def build_hallway(M, far_y):
    """The gap between wall 2 and the oven wall is an opening, not a window —
    left bare it reads as a hole to the outdoors. Closed with a plain painted
    hallway: two walls running back, a wall across the end, casing and base.
    Nothing decorative; it only has to stop the eye."""
    xw, xe = 323.5, 401.2           # the aperture, 77" wide
    t = 6.0                         # wall thickness
    objs = [
        # hallway walls running back to the end wall
        slab("hall_w", xw - t, xw, far_y, -6.0, 0, CEIL, M["wall"]),
        slab("hall_e", xe, xe + t, far_y, -6.0, 0, CEIL, M["wall"]),
        # header over the opening — without it the casing head floats and you
        # see straight over it into the hallway's upper volume
        slab("hall_header", xw - t - 1.0, xe + t + 1.0, -6.0, 0.0, 96.0, CEIL, M["wall"]),
        # cased opening at the kitchen face
        slab("hall_case_w", xw - t - 1.0, xw + 0.8, -6.6, -5.4, 0, 96.0, M["trim"]),
        slab("hall_case_e", xe - 0.8, xe + t + 1.0, -6.6, -5.4, 0, 96.0, M["trim"]),
        slab("hall_case_h", xw - t - 1.0, xe + t + 1.0, -6.6, -5.4, 94.0, 96.0, M["trim"]),
        # baseboard down both sides and across the end
        slab("hall_base_w", xw - 0.9, xw, far_y, -6.0, 0, 6.0, M["trim"]),
        slab("hall_base_e", xe, xe + 0.9, far_y, -6.0, 0, 6.0, M["trim"]),
        slab("hall_base_n", xw - t, xe + t, far_y, far_y + 0.9, 0, 6.0, M["trim"]),
    ]
    # one recessed light so the hallway is not a dark slot
    cx = (xw + xe) / 2
    objs.append(cylinder("hall_can", cx, far_y + 46, CEIL - 0.6, 3.4, 1.2, M["can"]))
    objs.append(cylinder("hall_can_in", cx, far_y + 46, CEIL - 1.5, 2.7, 1.0, M["trim"]))
    return objs


ENCLOSE_Y = 300.0   # plain wall across the south, ~9' behind the island


def build_enclosure(M):
    """The plan stops at wall 9 and the oven wall; south of them it is open.
    Every camera used to stand on that open side, so it never showed. The
    island's working face (dishwasher, sink, drawer stacks) faces the other
    way, and looking back at it from the kitchen you saw straight out into
    nothing. Close it with plain painted walls — single faces with an
    inside-only material, so a camera standing outside (the hero shot, a phone
    backing off) looks through them as though they were not there."""
    y0w, y0e, ys = W9_LEN, W5_Y0 + W5_LEN + 4.0, ENCLOSE_Y
    wall = M["wall_in"]
    return [
        # south wall, facing north into the room
        _mesh_from("enc_s", [(0.0, ys, 0.0), (W5_X, ys, 0.0), (W5_X, ys, CEIL), (0.0, ys, CEIL)],
                   [(0, 1, 2, 3)], wall),
        # wall 9 carried on south, facing east
        _mesh_from("enc_w", [(0.0, y0w, 0.0), (0.0, ys, 0.0), (0.0, ys, CEIL), (0.0, y0w, CEIL)],
                   [(0, 1, 2, 3)], wall),
        # the oven wall's plane carried on south, facing west
        _mesh_from("enc_e", [(W5_X, ys, 0.0), (W5_X, y0e, 0.0), (W5_X, y0e, CEIL), (W5_X, ys, CEIL)],
                   [(0, 1, 2, 3)], wall),
    ]


def build_room(M):
    x_far = W5_X + W5_WALL_T
    # floor and ceiling run well past the camera so no slab edge enters frame —
    # on a portrait phone the camera backs off to nearly 30 m
    y_far = 1100.0
    FAR_Y = DINING_FAR_Y  # far wall of the adjoining room, seen through the gap
    objs = [
        # floor stops at wall 9 too — through the windows it read as the
        # kitchen's oak running on outdoors
        slab("floor", -6, x_far + 400, FAR_Y - 8, y_far, -1.0, 0.0, M["oak"]),
        # the ceiling stops at wall 9's outer face: it casts shadow, and any
        # overhang out there would block the low sun before it reached the
        # windows
        slab("ceiling", -6, x_far + 400, FAR_Y - 8, y_far, CEIL, CEIL + 2, M["ceil"]),
        # wall 1 (back) with the Door71 opening at x 21.9..93.2
        slab("w1_a", -6, 22.0, -6, 0, 0, CEIL, M["wall"]),
        slab("w1_head", 22.0, 93.0, -6, 0, 82.0, CEIL, M["wall"]),
        slab("w1_b", 93.0, W1_LEN, -6, 0, 0, CEIL, M["wall"]),
        # Door71: a cased opening with a pair of raised-panel leaves. It sits
        # right at the edge of the hero shot, so a blank slab read as a cabinet.
        slab("w1_case_head", 20.5, 94.5, -6, 0.8, 80.0, 82.5, M["trim"]),
        slab("w1_case_l", 20.5, 22.0, -6, 0.8, 0, 82.5, M["trim"]),
        slab("w1_case_r", 93.0, 94.5, -6, 0.8, 0, 82.5, M["trim"]),
        # wall 2: the 24" return that finishes wall 1 at x = 323.5
        slab("w1_return", W1_LEN, W1_LEN + 5, 0, 24.0, 0, CEIL, M["wall"]),
        # between wall 2 and the oven wall the plan shows no wall — you look
        # through into the next room, whose wall reads beige below / white
        # above on PDF p1.  Set well back so the gap has depth.
        # plain painted end wall: it only has to stop the eye
        slab("w_far", 250, x_far + 170, FAR_Y - 6, FAR_Y, 0, CEIL, M["wall"]),
        # wall 9 (left)
        slab("w9", -6, 0, -6, W9_LEN, 0, CEIL, M["wall"]),
        # wall 5 (right) and the column that closes it — the grey mass on PDF p1
        # runs all the way north to meet the hallway's east wall — otherwise the
        # hallway's end wall is visible past it, outside the cased opening
        slab("w5", W5_X, W5_X + W5_WALL_T, -6.0, W5_Y0 + W5_LEN + 4.0, 0, CEIL, M["wall"]),
        # ceiling beam over the left of the room
        slab("beam", -6, 84.0, 44.0, 54.0, CEIL - 11.0, CEIL, M["beam"]),
    ]
    objs += build_hallway(M, FAR_Y)
    objs += build_enclosure(M)

    # two leaves, meeting in the middle of the 71" opening
    panel_door_leaf(objs, "w1_door_l", 22.0, 57.5, 0.5, 79.6, -4.4, -2.65, M)
    panel_door_leaf(objs, "w1_door_r", 57.5, 93.0, 0.5, 79.6, -4.4, -2.65, M)
    for hx in (56.0, 59.0):
        objs.append(cylinder("w1_door_knob", hx, -2.2, 36.0, 0.55, 1.1, M["steel"], axis="Y"))

    # Win48 x3. Real openings through wall 9 — the glass used to sit on a solid
    # slab, so once the walls cast shadow no daylight could get in.
    w9 = next(o for o in objs if o.name == "w9")
    wy = 25.5
    for i in range(3):
        y0, y1 = wy, wy + 48.0
        boolean_diff(w9, slab("w9_cut%d" % i, -7.0, 1.0, y0, y1, 36.0, 96.0, M["wall"]))
        objs += [
            slab("win_glass%d" % i, -1.2, 0.2, y0, y1, 36.0, 96.0, M["win_glass"]),
            slab("win_sill%d" % i, -1.8, 1.6, y0 - 2.2, y1 + 2.2, 34.2, 36.0, M["trim"]),
            slab("win_head%d" % i, -1.8, 1.6, y0 - 2.2, y1 + 2.2, 96.0, 98.2, M["trim"]),
            slab("win_jl%d" % i, -1.8, 1.6, y0 - 2.2, y0, 36.0, 96.0, M["trim"]),
            slab("win_jr%d" % i, -1.8, 1.6, y1, y1 + 2.2, 36.0, 96.0, M["trim"]),
        ]
        for k in (1, 2):
            ym = y0 + (y1 - y0) * k / 3.0
            zm = 36.0 + 60.0 * k / 3.0
            objs.append(slab("win_mv%d%d" % (i, k), -1.0, 0.5, ym - 0.5, ym + 0.5, 36.0, 96.0, M["trim"]))
            objs.append(slab("win_mh%d%d" % (i, k), -1.0, 0.5, y0, y1, zm - 0.5, zm + 0.5, M["trim"]))
        wy = y1 + 4.5

    for (cx, cy) in ((92, 46), (196, 46), (286, 46), (150, 128), (256, 128),
                     (196, 216), (352, 104), (352, 180)):
        objs.append(cylinder("can", cx, cy, CEIL - 0.6, 3.4, 1.2, M["can"]))
        objs.append(cylinder("can_in", cx, cy, CEIL - 1.5, 2.7, 1.0, M["lens"]))

    tag_from(objs, True, 0, "room")
    return objs


# ---------------------------------------------------------------------------
# wall 1 — back
# ---------------------------------------------------------------------------
def build_back_wall(M):
    # the wall plane is y = 0; each run's face stands out by its own depth
    def w1(front):
        return run_between(W1_RUN_X, 0.0, W1_LEN, 0.0, 0.0, 1.0, front=front)
    base_face, upper_face, deep_face = w1(BASE_D), w1(UPPER_D), w1(26.0)
    u = 0.0
    spans = []
    for name, w in W1_BASES:
        spans.append((name, u, u + w))
        u += w
    fridge_u0 = W1_FRIDGE_X0 - W1_RUN_X
    run_end = W1_LEN - W1_RUN_X
    cook_c = W1_RUN_X + (spans[2][1] + spans[2][2]) / 2

    # Cabinet 4's 44" is the range opening: a 4" filler either side and the
    # floor left bare between them, so the run is visibly built out for the
    # range before it slides in.
    fill = (spans[2][2] - spans[2][1] - RANGE_W) / 2.0
    for name, u0, u1 in spans:
        if name == "4":
            parts = []
            for i, (fa, fb) in enumerate(((u0, u0 + fill), (u1 - fill, u1))):
                parts += [base_face.box("w1_fill%d_toe" % i, fa + 0.04, fb - 0.04,
                                        TOE_RECESS, BASE_D, 0, TOE_H, M["toe"]),
                          base_face.box("w1_fill%d" % i, fa + 0.04, fb - 0.04,
                                        0.0, BASE_D, TOE_H, BASE_H, M["paint"])]
        else:
            parts = base_three_drawers(base_face, "w1b" + name, u0, u1, M,
                                       split_top=(name == "1"))
        tag_from(parts, False, step(), "base")

    # the counter stops either side of the range
    open_x0 = cook_c - RANGE_W / 2
    open_x1 = cook_c + RANGE_W / 2
    tag_from([slab("w1_counter_l", W1_RUN_X, open_x0, 0, BASE_D + 1.1, BASE_H, COUNTER_TOP, M["granite"]),
              slab("w1_counter_r", open_x1, W1_FRIDGE_X0, 0, BASE_D + 1.1, BASE_H, COUNTER_TOP, M["granite"])],
             False, step(), "counter")

    tag_from(range_stove(M, open_x0 + 0.05, open_x1 - 0.05), False, step(), "appliance")

    for name, i in (("7", 0), ("9", 1), ("11", 3)):
        tag_from(upper_glass(upper_face, "w1u" + name, spans[i][1], spans[i][2], M),
                 False, step(), "upper")

    tag_from(range_hood(M, cook_c, 0.0), False, step(), "appliance")

    fx = W1_FRIDGE_X0 + 3.0
    tag_from(fridge(M, fx, 0.0), False, step(), "appliance")

    s = step()
    tag_from([slab("w1_fp_l", W1_FRIDGE_X0, fx, 0, 26.0, 0, UPPER_TOP, M["paint"]),
              slab("w1_fp_r", fx + 35.625, W1_LEN, 0, 26.0, 0, UPPER_TOP, M["paint"])],
             False, s, "tall")
    tag_from(upper_solid(deep_face, "w1u6", fridge_u0, run_end, M,
                         UPPER_TOP - 44.0, UPPER_TOP, depth=26.0), False, s, "upper")

    # crown follows the cabinets, so it steps forward over the fridge cabinet
    trim = crown(upper_face, "w1_crown", 0.0, fridge_u0, M)
    trim += crown(deep_face, "w1_crown_fr", fridge_u0, run_end, M, depth=26.0)
    trim += light_rail(upper_face, "w1_lr0", spans[0][1], spans[1][2], M)
    trim += light_rail(upper_face, "w1_lr1", spans[3][1], spans[3][2], M)
    tag_from(trim, False, step(), "trim")


# ---------------------------------------------------------------------------
# wall 5 — oven wall
# ---------------------------------------------------------------------------
def build_right_wall(M):
    def w5(front):   # wall plane is x = W5_X, cabinets face west
        return run_between(W5_X, W5_Y0, W5_X, W5_Y0 + W5_LEN, -1.0, 0.0, front=front)
    base_face, upper_face = w5(BASE_D), w5(UPPER_D)
    u = W5_TOWER_W
    spans = []
    for name, w in W5_BASES:
        spans.append((name, u, u + w))
        u += w

    for name, u0, u1 in spans:
        tag_from(base_drawer_doors(base_face, "w5b" + name, u0, u1, M), False, step(), "base")

    tag_from([base_face.box("w5_counter", W5_TOWER_W, W5_LEN, -1.1, BASE_D,
                       BASE_H, COUNTER_TOP, M["granite"])], False, step(), "counter")

    for name, u0, u1 in spans:
        tag_from(upper_glass(upper_face, "w5u" + name, u0, u1, M), False, step(), "upper")

    s = step()
    # The tower's carcass goes round a real cutout — below, above and a stile
    # either side, with a white back — so before the ovens arrive the opening
    # reads as built out for them, and after, they sit back in a recess.
    uc = W5_TOWER_W / 2
    oa, ob = uc - OVEN_CUT_W / 2, uc + OVEN_CUT_W / 2
    z0, z1 = OVEN_Z0, OVEN_Z0 + OVEN_CUT_H
    tb, tf = FRONT_T - 0.1, BASE_D
    tower = [base_face.box("w5_tower_lo", 0, W5_TOWER_W - 0.04, tb, tf, TOE_H, z0, M["paint"]),
             base_face.box("w5_tower_hi", 0, W5_TOWER_W - 0.04, tb, tf, z1, UPPER_TOP, M["paint"]),
             base_face.box("w5_tower_sl", 0, oa, tb, tf, z0, z1, M["paint"]),
             base_face.box("w5_tower_sr", ob, W5_TOWER_W - 0.04, tb, tf, z0, z1, M["paint"]),
             # (the back laps into the stiles, so its edges are not coplanar
             # with their inner faces)
             base_face.box("w5_tower_bk", oa - 0.3, ob + 0.3, tf - 0.75, tf, z0 - 0.3, z1 + 0.3, M["cabint"]),
             base_face.box("w5_tower_toe", 0, W5_TOWER_W, TOE_RECESS, BASE_D, 0, TOE_H, M["toe"])]
    tower += doors(base_face, "w5_tower_up", 0, W5_TOWER_W, z1, UPPER_TOP, M, pull_at="bottom")
    tower += drawer(base_face, "w5_tower_dw", 0, W5_TOWER_W, TOE_H, z0, M)
    tag_from(tower, False, s, "tall")

    tag_from(wall_ovens(base_face, "w5_oven", 0, W5_TOWER_W, M), False, step(), "appliance")

    trim = crown(base_face, "w5_crown_tw", 0.0, W5_TOWER_W, M, depth=BASE_D)
    trim += crown(upper_face, "w5_crown", W5_TOWER_W, W5_LEN, M)
    trim += light_rail(upper_face, "w5_lr", W5_TOWER_W, W5_LEN, M)
    tag_from(trim, False, step(), "trim")


# ---------------------------------------------------------------------------
# island — one solid body with fronts and panels applied to its faces
# ---------------------------------------------------------------------------
def build_island(M):
    body = offset_polygon(ISL_COUNTER, -1.0)      # panel line, 1" in from the top
    plinth = offset_polygon(ISL_COUNTER, -0.2)

    s = step()
    body_solid = prism("isl_body", body, TOE_H, BASE_H, M["paint"])
    boolean_diff(body_solid, sink_cutter(M, "body"))   # hollow out for the basin
    tag_from([body_solid,
              prism("isl_plinth", plinth, 0.0, TOE_H + 0.05, M["paint"])], False, s, "island")

    # edges of `body`, in the same order as ISL_COUNTER:
    #   0 north end   1 leg A east (work)   2 45deg inner (work)   3 leg B north (work)
    #   4 east end    5 leg B south (panel) 6 45deg outer (panel)  7 leg A west (panel)
    s = step()
    panels = []
    for e in (5, 6, 7):
        r = run_on_edge(body, e, voff=-(FRONT_T - 0.12))
        n = max(1, int(round(r.length / 24.0)))
        for i in range(n):
            panels += panel_front(r, "isl_pn%d_%d" % (e, i),
                                   r.length * i / n + 0.5, r.length * (i + 1) / n - 0.5,
                                   TOE_H + 0.7, BASE_H - 0.7, M)
    for e in (0, 4):                                   # finished ends
        r = run_on_edge(body, e, voff=-(FRONT_T - 0.12))
        panels += panel_front(r, "isl_pe%d" % e, 0.5, r.length - 0.5,
                               TOE_H + 0.7, BASE_H - 0.7, M)
    tag_from(panels, False, s, "island")

    # --- working faces -----------------------------------------------------
    legA = run_on_edge(body, 1, voff=-(FRONT_T - 0.12))         # cabinets 17 / 49 / 13
    tag_from(panel_front(legA, "isl17", 0.0, 2.0, TOE_H, BASE_H, M), False, step(), "island")
    tag_from(dishwasher(legA, "isl49", 2.0, 26.0, M), False, step(), "appliance")
    s = step()
    sink_front = doors(legA, "isl13", 26.0, legA.length, TOE_H, BASE_H - 6.0, M, pull_at="top")
    sink_front += panel_front(legA, "isl13_apron", 26.0 + REVEAL, legA.length - REVEAL,
                               BASE_H - 6.0 + REVEAL, BASE_H - REVEAL, M)
    tag_from(sink_front, False, s, "island")

    corner = run_on_edge(body, 2, voff=-(FRONT_T - 0.12))       # cabinet 37 on the 45
    s = step()
    c37 = doors(corner, "isl37", 0.0, corner.length, TOE_H, BASE_H - 6.5, M, pull_at="top")
    c37 += drawer(corner, "isl37t", 0.0, corner.length, BASE_H - 6.5, BASE_H, M)
    tag_from(c37, False, s, "island")

    legB = run_on_edge(body, 3, voff=-(FRONT_T - 0.12))         # cabinets 24 / 23 / 22 / 20
    u = 0.0
    for name, w in (("24", 19.5), ("23", 28.0), ("22", 30.0), ("20", 30.0)):
        tag_from(fronts_drawer_doors(legB, "isl" + name, u, u + w, M), False, step(), "island")
        u += w

    counter = prism("isl_counter", ISL_COUNTER, BASE_H, COUNTER_TOP, M["granite"])
    boolean_diff(counter, sink_cutter(M, "top"))    # open the sink hole
    tag_from([counter], False, step(), "counter")

    s = step()
    tag_from(sink_bowl(M), False, s, "appliance")
    tag_from(faucet(M), False, s, "appliance")


# ---------------------------------------------------------------------------
# plan space (Y=south) -> Blender (Y=north), keeping normals outward
# ---------------------------------------------------------------------------
def mirror_y():
    for o in bpy.data.objects:
        if o.type != "MESH":
            continue
        bm = bmesh.new()
        bm.from_mesh(o.data)
        for v in bm.verts:
            v.co.y = -v.co.y
        bmesh.ops.reverse_faces(bm, faces=bm.faces[:])
        bm.to_mesh(o.data)
        bm.free()
        o.data.update()


def bevel_parts(parts, width=0.032, segments=1):
    """Break every sharp arris with a tiny bevel. Real cabinetry has an eased
    edge that catches a highlight; perfectly sharp corners are the single
    biggest tell that a render is CG. Room shell is skipped — big flat slabs
    gain nothing and it keeps the file small."""
    n = 0
    skip = ("oak_floor", "ceiling_white", "wall_gray", "wall_beige")
    for o in parts:
        mname = o.data.materials[0].name if o.data.materials else ""
        if mname.startswith(skip):
            continue
        bpy.context.view_layer.objects.active = o
        mod = o.modifiers.new("bevel", "BEVEL")
        mod.width = width * IN
        mod.segments = segments
        mod.limit_method = "ANGLE"
        mod.angle_limit = math.radians(35)
        mod.miter_outer = "MITER_ARC"
        mod.use_clamp_overlap = True
        bpy.ops.object.modifier_apply(modifier=mod.name)
        n += 1
    print("[kitchen] bevelled %d objects" % n)


def add_box_uvs():
    """World-space box projection: 1 UV unit = 1 metre, so every run of granite
    or oak shares one continuous texture scale.  three.js tunes it with repeat."""
    for o in bpy.data.objects:
        if o.type != "MESH":
            continue
        me = o.data
        uvl = me.uv_layers[0] if me.uv_layers else me.uv_layers.new(name="UVMap")
        for poly in me.polygons:
            n = poly.normal
            ax = max(range(3), key=lambda i: abs(n[i]))
            for li in poly.loop_indices:
                v = me.vertices[me.loops[li].vertex_index].co
                uvl.data[li].uv = ((v.y, v.z) if ax == 0 else
                                   (v.x, v.z) if ax == 1 else (v.x, v.y))


def P(x, y, z):
    """Plan inches -> Blender metres (for cameras and lights)."""
    return (x * IN, -y * IN, z * IN)


# ---------------------------------------------------------------------------
# join per (build_order, material) so the browser gets ~100 meshes, not ~700
# ---------------------------------------------------------------------------
def join_parts():
    buckets = {}
    for o in ALL_OBJS:
        key = (o.get("build_order", 0), o.get("build_static", 0),
               o.get("build_group", "room"), o.get("build_zone", "room"),
               o.data.materials[0].name)
        buckets.setdefault(key, []).append(o)

    bpy.ops.object.select_all(action="DESELECT")
    joined = []
    for key in sorted(buckets, key=str):
        ordr, static, group, zone, matname = key
        objs = buckets[key]
        if len(objs) > 1:
            for o in objs:
                o.select_set(True)
            bpy.context.view_layer.objects.active = objs[0]
            bpy.ops.object.join()
            merged = bpy.context.view_layer.objects.active
            bpy.ops.object.select_all(action="DESELECT")
        else:
            merged = objs[0]
        merged.name = "%s_%03d_%s" % (group, ordr, matname)
        merged["build_static"] = static
        merged["build_order"] = ordr
        merged["build_group"] = group
        merged["build_zone"] = zone
        joined.append(merged)
    return joined


# ---------------------------------------------------------------------------
# lighting, camera, render, export
# ---------------------------------------------------------------------------
def setup_world():
    world = bpy.data.worlds.get("World") or bpy.data.worlds.new("World")
    bpy.context.scene.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes["Background"]
    bg.inputs[0].default_value = (0.82, 0.86, 0.90, 1.0)
    bg.inputs[1].default_value = 0.9

    def area(name, loc, rot, size, energy, color=(1.0, 0.97, 0.93)):
        d = bpy.data.lights.new(name, type="AREA")
        d.size, d.energy, d.color = size, energy, color
        o = bpy.data.objects.new(name, d)
        o.location, o.rotation_euler = loc, rot
        bpy.context.scene.collection.objects.link(o)

    # daylight in through wall 9, pointing east
    area("win_light", P(-10, 102, 64), (0, math.radians(-90), 0), 4.0, 3400)
    # soft ceiling wash + a front fill so the fronts read
    area("ceil_fill", P(230, 130, 104), (math.radians(180), 0, 0), 9.0, 2000)
    area("front_fill", P(190, 330, 88), (math.radians(-70), 0, 0), 9.0, 4200)


def add_camera(name, loc, target, lens=24.0):
    cam = bpy.data.cameras.new(name)
    cam.lens = lens
    o = bpy.data.objects.new(name, cam)
    o.location = P(*loc)
    bpy.context.scene.collection.objects.link(o)
    tgt = bpy.data.objects.new(name + "_t", None)
    tgt.location = P(*target)
    bpy.context.scene.collection.objects.link(tgt)
    c = o.constraints.new("TRACK_TO")
    c.target = tgt
    c.track_axis = "TRACK_NEGATIVE_Z"
    c.up_axis = "UP_Y"
    return o


def render_to(cam, path, res=(1280, 900)):
    sc = bpy.context.scene
    sc.camera = cam
    sc.render.resolution_x, sc.render.resolution_y = res
    sc.render.filepath = path
    sc.render.image_settings.file_format = "PNG"
    bpy.ops.render.render(write_still=True)


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete()
    for coll in (bpy.data.meshes, bpy.data.materials, bpy.data.cameras, bpy.data.lights):
        for item in list(coll):
            coll.remove(item)


def main():
    clear_scene()
    sc = bpy.context.scene
    for engine in ("BLENDER_EEVEE_NEXT", "BLENDER_EEVEE"):
        try:
            sc.render.engine = engine
            break
        except TypeError:
            continue
    sc.view_settings.view_transform = "Standard"
    sc.view_settings.exposure = 0.0
    sc.render.film_transparent = False

    M = build_materials()
    set_zone("room")
    build_room(M)
    set_zone("back")
    build_back_wall(M)
    set_zone("right")
    build_right_wall(M)
    set_zone("island")
    build_island(M)

    print("[kitchen] boxes: %d   build steps: %d" % (len(ALL_OBJS), order()))
    parts = join_parts()
    bevel_parts(parts)
    mirror_y()
    add_box_uvs()
    setup_world()
    print("[kitchen] meshes after join: %d" % len(parts))

    # hero view: south-west of the island looking north-east, matching PDF p1
    hero = add_camera("hero", (115, 368, 76), (250, 78, 40), lens=21.0)
    top = add_camera("top", (215, 150, 520), (215, 130, 0), lens=35.0)

    render_to(hero, PREVIEW_HERO)
    if os.environ.get("KITCHEN_DETAIL"):
        render_to(add_camera("d1", (150, 250, 60), (240, 20, 60), lens=35.0),
                  os.path.join(SCRIPT_DIR, "_preview_backwall.png"))
        render_to(add_camera("d2", (150, 300, 58), (270, 150, 30), lens=35.0),
                  os.path.join(SCRIPT_DIR, "_preview_island.png"))
        render_to(add_camera("d3", (250, 230, 60), (401, 150, 55), lens=35.0),
                  os.path.join(SCRIPT_DIR, "_preview_ovenwall.png"))
    for n in ("room_000_ceiling_white", "room_000_beam_wood"):
        if n in bpy.data.objects:
            bpy.data.objects[n].hide_render = True
    render_to(top, PREVIEW_TOP)
    for n in ("room_000_ceiling_white", "room_000_beam_wood"):
        if n in bpy.data.objects:
            bpy.data.objects[n].hide_render = False

    bpy.ops.object.select_all(action="DESELECT")
    for p in parts:
        p.select_set(True)

    os.makedirs(os.path.dirname(GLB_PATH), exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=GLB_PATH,
        export_format="GLB",
        use_selection=True,
        export_extras=True,
        export_apply=True,
        export_yup=True,
        export_cameras=False,
        export_lights=False,
    )
    print("[kitchen] wrote %s (%.0f KB)" % (GLB_PATH, os.path.getsize(GLB_PATH) / 1024.0))


main()
