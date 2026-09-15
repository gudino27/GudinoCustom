"""Render the scroll build-in as a series of stills from the same model the web
scene uses.  Objects reveal in `build_order`, exactly as KitchenBuildSection.js
plays them.

    blender --background --python scripts/render_sequence.py
"""
import bpy
import os

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
src = open(os.path.join(SCRIPT_DIR, "build_kitchen.py")).read().replace("\nmain()\n", "\n")
exec(compile(src, "build_kitchen.py", "exec"))

OUT = os.path.join(SCRIPT_DIR, "_seq")
os.makedirs(OUT, exist_ok=True)

clear_scene()
sc = bpy.context.scene
sc.render.engine = "BLENDER_EEVEE"
sc.view_settings.view_transform = "Standard"
sc.view_settings.exposure = 0.05
sc.render.film_transparent = False

M = build_materials()
build_room(M)
build_back_wall(M)
build_right_wall(M)
build_island(M)
total = order()
parts = join_parts()
mirror_y()
add_box_uvs()
setup_world()

# soften the ceiling wash so the render is not blown out
for lt in bpy.data.lights:
    if lt.name == "ceil_fill":
        lt.energy = 3200

cam = add_camera("hero", (118, 344, 64), (252, 82, 43), lens=22.0)

STAGES = [
    (0,  "01_empty_room"),
    (4,  "02_back_wall_bases"),
    (9,  "03_counters_uppers"),
    (13, "04_hood_fridge_crown"),
    (18, "05_oven_wall_bases"),
    (23, "06_oven_wall_done"),
    (29, "07_island_cabinets"),
    (total, "08_complete"),
]

for cut, name in STAGES:
    for o in parts:
        o.hide_render = o.get("build_order", 0) > cut
    render_to(cam, os.path.join(OUT, name + ".png"), res=(1280, 800))
    print("[seq] %s (through step %d)" % (name, cut))

for o in parts:
    o.hide_render = False
print("[seq] done, %d stages" % len(STAGES))
