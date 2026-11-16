import bpy
import math
from math import pi, cos, sin
from mathutils import Vector, Matrix

# ---------------- settings ----------------
THICKNESS  = 0.60
HALF_WIDTH = 1.00
ARM_LENGTH = 1.20
ARC_STEPS  = 48
CAP_DEPTH  = 0.4
CAP_SCALE  = 1.0

COL_MAGNET = (1.0, 0.3, 0.2, 1.0)  # red-orange
COL_BLUE   = (0.18, 0.33, 0.77, 1.0) 
COL_PLUS    = (0.18, 0.33, 0.77, 1.0) 

# --- PLUS settings ---
PLUS_SIZE   = THICKNESS * 3.0   # length of each bar (X/Z)
PLUS_THICK  = THICKNESS         # bar thickness (X/Z)
PLUS_DEPTH  = CAP_DEPTH         # depth along Y (to match caps)
PLUS_GAP    = THICKNESS * 1.2   # space from magnet tips
PLUS_STRENGTH = 0.9  # emissive strength; lower = more matte

OUTPUT_PATH = "C:\Temp"
# ------------------------------------------

def make_emission_mat(name, rgba, strength=0.6):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    emis = nt.nodes.new('ShaderNodeEmission')
    emis.inputs['Color'].default_value = rgba
    emis.inputs['Strength'].default_value = strength
    nt.links.new(emis.outputs['Emission'], out.inputs['Surface'])
    return m

def make_plus_core(size, thick, depth, mat):
    # Build a + from two boxes and join them.
    # Centered at origin; caller positions it.
    # Horizontal bar (X)
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 0, 0))
    h = bpy.context.object
    h.scale = (size/2.0, depth/2.0, thick/2.0)

    # Vertical bar (Z)
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 0, 0))
    v = bpy.context.object
    v.scale = (thick/2.0, depth/2.0, size/2.0)

    # Join
    h.select_set(True); v.select_set(True)
    bpy.context.view_layer.objects.active = h
    bpy.ops.object.join()
    plus = bpy.context.active_object
    plus.name = "PlusSign"
    plus.data.materials.clear()
    plus.data.materials.append(mat)
    bpy.ops.object.shade_flat()
    return plus

def add_plus_inline(arm_length, gap, half_w, size, thick, depth, mat):
    """Places the plus inline with the magnet ends, centered on X/Z, above the tips along +Y."""
    plus = make_plus_core(size, thick, depth, mat)
    # Put it inline with the tips
    plus.location = (0.0, arm_length + gap + depth/2.0, 0.0)
    return plus

def _look_at_matrix(pos: Vector, target: Vector, up: Vector) -> Matrix:
  # Build a transform where +Y faces target, +Z = up (no roll), +X = right
  f = (target - pos).normalized()          # forward (+Y)
  r = up.cross(f).normalized()             # right (+X)
  u = f.cross(r).normalized()              # corrected up (+Z)
  return Matrix((
    (r.x, f.x, u.x, pos.x),
    (r.y, f.y, u.y, pos.y),
    (r.z, f.z, u.z, pos.z),
    (0.0, 0.0, 0.0, 1.0),
  ))

from mathutils import Vector, Matrix

def _camera_forward(cam):
    # Camera looks down its local -Z
    return -(cam.matrix_world.to_3x3() @ Vector((0, 0, 1))).normalized()

def add_plus_faceon(arm_length, gap, size, thick, depth, mat, cam,
                    extra_dist=0.4, z_offset=0.30):
    """
    Place a face-on '+':
      - faces camera (no roll)
      - uses clean rotation (no constraints)
      - pushes toward camera so it doesn't intersect the arm
    """
    # 1) Build core + make sure local transforms are clean
    plus = make_plus_core(size, thick, depth, mat)
    bpy.context.view_layer.objects.active = plus
    plus.select_set(True)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    plus.select_set(False)
    plus.parent = None  # ensure no parent scale leaks in

    # 2) Base position (your prior tweak kept)
    pos = Vector((0.0, arm_length + gap + depth * 0.5, z_offset))

    # 3) Build a rotation that faces the camera with +Y, keeps world Z as up
    f = _camera_forward(cam)                      # forward (where the cam looks)
    up_world = Vector((0, 0, 1))
    right = up_world.cross(f).normalized()        # world-right for our object X
    up = f.cross(right).normalized()              # corrected up for object Z

    # 4) Push toward the camera so it clears the magnet arm
    pos = pos + f * float(extra_dist)

    # 5) Compose pure rotation+translation (no scale) and apply
    M = Matrix((
        (right.x, f.x, up.x, pos.x),   # local X, Y, Z, translation
        (right.y, f.y, up.y, pos.y),
        (right.z, f.z, up.z, pos.z),
        (0.0,     0.0,  0.0,  1.0),
    ))
    plus.matrix_world = M
    plus.scale = (1.0, 1.0, 1.0)  # guard against accidental non-uniform scale

    # (Optional) bake rotation so nothing changes later
    bpy.context.view_layer.objects.active = plus
    plus.select_set(True)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
    plus.select_set(False)

    return plus

def make_flat_oriented_mat(name, base_color, emisivity=0.6):
    """Emission-like flat color with top/sides tinting."""
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    emis = nt.nodes.new('ShaderNodeEmission')
    geom = nt.nodes.new('ShaderNodeNewGeometry')
    sep = nt.nodes.new('ShaderNodeSeparateXYZ')
    colmix = nt.nodes.new('ShaderNodeMixRGB')
    
    emis.inputs['Strength'].default_value = emisivity
    # Slightly darker for vertical sides
    colmix.blend_type = 'MIX'
    colmix.inputs['Color1'].default_value = (*[c*0.85 for c in base_color[:3]], 1.0)  # darker
    colmix.inputs['Color2'].default_value = base_color
    
    nt.links.new(geom.outputs['Normal'], sep.inputs['Vector'])
    nt.links.new(sep.outputs['Z'], colmix.inputs['Fac'])
    nt.links.new(colmix.outputs['Color'], emis.inputs['Color'])
    nt.links.new(emis.outputs['Emission'], out.inputs['Surface'])
    
    return m

def make_square_profile(size):
    crv = bpy.data.curves.new("ProfileSquare", type='CURVE')
    crv.dimensions = '2D'
    s = crv.splines.new('POLY')
    s.points.add(3)
    h = size * 0.5
    pts = [(-h, -h, 0, 1), (h, -h, 0, 1), (h, h, 0, 1), (-h, h, 0, 1)]
    for i, co in enumerate(pts):
        s.points[i].co = co
    s.use_cyclic_u = True
    obj = bpy.data.objects.new("ProfileSquare", crv)
    bpy.context.collection.objects.link(obj)
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.select_set(False)
    return obj

def make_u_path(half_w, arm_len, arc_steps, bevel_obj):
    crv = bpy.data.curves.new("MagnetPath", type='CURVE')
    crv.dimensions = '3D'
    s = crv.splines.new('POLY')

    pts = []
    pts.append(( half_w, arm_len, 0, 1))
    pts.append(( half_w, 0.0,     0, 1))

    for i in range(arc_steps + 1):
        t = i / arc_steps
        ang = t * pi
        x = half_w * cos(ang)
        y = -half_w * sin(ang)   # flipped arc
        pts.append((x, y, 0, 1))

    pts.append((-half_w, arm_len, 0, 1))

    s.points.add(len(pts) - 1)
    for i, p in enumerate(pts):
        s.points[i].co = p

    obj = bpy.data.objects.new("MagnetCurve", crv)
    bpy.context.collection.objects.link(obj)

    crv.bevel_mode = 'OBJECT'
    crv.bevel_object = bevel_obj
    crv.use_fill_caps = False
    crv.bevel_resolution = 8
    crv.resolution_u = 24
    return obj

def make_cap(name, x, y, size, depth, mat):
    bpy.ops.mesh.primitive_cube_add(location=(x, y + depth / 2.0, 0))
    cap = bpy.context.object
    cap.name = name
    cap.scale = ((size * CAP_SCALE) / 2.0, depth / 2.0, (size * CAP_SCALE) / 2.0)
    if len(cap.data.materials) == 0:
        cap.data.materials.append(mat)
    else:
        cap.data.materials[0] = mat
    bpy.ops.object.shade_flat()
    return cap

def main():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)

    # Materials
    mat_magnet = make_flat_oriented_mat("MagnetRed", COL_MAGNET, 0.6)
    mat_mint   = make_flat_oriented_mat("MintGreen", COL_BLUE, PLUS_STRENGTH)
    mat_plus = make_emission_mat("PlusWhite", COL_PLUS, PLUS_STRENGTH)
    
    # Magnet body
    profile = make_square_profile(THICKNESS)
    curve = make_u_path(HALF_WIDTH, ARM_LENGTH, ARC_STEPS, profile)
    if len(curve.data.materials) == 0:
        curve.data.materials.append(mat_magnet)
    else:
        curve.data.materials[0] = mat_magnet
    bpy.context.view_layer.objects.active = curve
    curve.select_set(True)
    bpy.ops.object.convert(target='MESH', keep_original=False)
    magnet = bpy.context.active_object
    magnet.name = "Magnet"
    if len(magnet.data.materials) == 0:
        magnet.data.materials.append(mat_magnet)
    else:
        magnet.data.materials[0] = mat_magnet
    bpy.ops.object.shade_flat()

    # Caps
    make_cap("CapRight",  HALF_WIDTH,  ARM_LENGTH, THICKNESS, CAP_DEPTH, mat_mint)
    make_cap("CapLeft",  -HALF_WIDTH,  ARM_LENGTH, THICKNESS, CAP_DEPTH, mat_mint)


    # Camera aiming at center
    bpy.ops.object.camera_add(location=(15, -15, 20))
    cam = bpy.context.object
    bpy.context.scene.camera = cam
    cam.data.type = 'ORTHO'
    cam.data.ortho_scale = 3.5

    target = bpy.data.objects.new("CamTarget", None)
    target.empty_display_type = 'PLAIN_AXES'
    target.location = (0.0, 0.6, 0.0)
    bpy.context.collection.objects.link(target)

    trk = cam.constraints.new(type='TRACK_TO')
    trk.target = target
    trk.track_axis = 'TRACK_NEGATIVE_Z'
    trk.up_axis = 'UP_Y'

    # Inline version (aligned with magnet arms)
    #add_plus_inline(ARM_LENGTH, PLUS_GAP, HALF_WIDTH, PLUS_SIZE, PLUS_THICK, PLUS_DEPTH, mat_plus)

    # OR Face-on version (billboarded to the camera)
    add_plus_faceon(ARM_LENGTH, PLUS_GAP, PLUS_SIZE, PLUS_THICK, PLUS_DEPTH, mat_plus, cam)

    # Render settings
    bpy.context.scene.render.engine = 'BLENDER_EEVEE_NEXT'
    bpy.context.scene.render.film_transparent = True
    
    bpy.context.scene.use_nodes = True
    tree = bpy.context.scene.node_tree
    nodes = tree.nodes
    scene = bpy.context.scene
    scene.use_nodes = True
    tree = scene.node_tree

    # Clear existing nodes
    for node in tree.nodes:
        tree.nodes.remove(node)

    # Create the essential nodes
    render_layers = tree.nodes.new(type="CompositorNodeRLayers")
    composite = tree.nodes.new(type="CompositorNodeComposite")
    hue_node = tree.nodes.new(type="CompositorNodeHueSat")

    # Position them nicely
    render_layers.location = (0, 0)
    hue_node.location = (200, 0)
    composite.location = (400, 0)

    # Link them together
    links = tree.links
    links.new(render_layers.outputs["Image"], hue_node.inputs["Image"])
    links.new(hue_node.outputs["Image"], composite.inputs["Image"])


    # Save Files
    bpy.context.scene.render.resolution_x = 256
    bpy.context.scene.render.resolution_y = 256
    bpy.context.scene.render.resolution_percentage = 100
    bpy.context.scene.render.filepath = OUTPUT_PATH + "\magnet-256.png"
    bpy.ops.render.render(write_still=True)
    bpy.context.scene.render.resolution_x = 128
    bpy.context.scene.render.resolution_y = 128
    bpy.context.scene.render.resolution_percentage = 100
    bpy.context.scene.render.filepath = OUTPUT_PATH + "\magnet-128.png"
    bpy.ops.render.render(write_still=True)
    bpy.context.scene.render.resolution_x = 64
    bpy.context.scene.render.resolution_y = 64
    bpy.context.scene.render.resolution_percentage = 100
    bpy.context.scene.render.filepath = OUTPUT_PATH + "\magnet-64.png"
    bpy.ops.render.render(write_still=True)
    bpy.context.scene.render.resolution_x = 48
    bpy.context.scene.render.resolution_y = 48
    bpy.context.scene.render.resolution_percentage = 100
    bpy.context.scene.render.filepath = OUTPUT_PATH + "\magnet-48.png"
    bpy.ops.render.render(write_still=True)
    bpy.context.scene.render.resolution_x = 32
    bpy.context.scene.render.resolution_y = 32
    bpy.context.scene.render.resolution_percentage = 100
    bpy.context.scene.render.filepath = OUTPUT_PATH + "\magnet-32.png"
    bpy.ops.render.render(write_still=True)
    bpy.context.scene.render.resolution_x = 16
    bpy.context.scene.render.resolution_y = 16
    bpy.context.scene.render.resolution_percentage = 100
    bpy.context.scene.render.filepath = OUTPUT_PATH + "\magnet-16.png"
    bpy.ops.render.render(write_still=True)

    # Desaturate Image for Grayscales
    hue_node.inputs[2].default_value = 0.0  # Saturation
        
    bpy.context.scene.render.resolution_x = 256
    bpy.context.scene.render.resolution_y = 256
    bpy.context.scene.render.resolution_percentage = 100
    bpy.context.scene.render.filepath = OUTPUT_PATH + "\magnet-grayscale-256.png"
    bpy.ops.render.render(write_still=True)
    bpy.context.scene.render.resolution_x = 128
    bpy.context.scene.render.resolution_y = 128
    bpy.context.scene.render.resolution_percentage = 100
    bpy.context.scene.render.filepath = OUTPUT_PATH + "\magnet-grayscale-128.png"
    bpy.ops.render.render(write_still=True)
    bpy.context.scene.render.resolution_x = 64
    bpy.context.scene.render.resolution_y = 64
    bpy.context.scene.render.resolution_percentage = 100
    bpy.context.scene.render.filepath = OUTPUT_PATH + "\magnet-grayscale-64.png"
    bpy.ops.render.render(write_still=True)
    bpy.context.scene.render.resolution_x = 48
    bpy.context.scene.render.resolution_y = 48
    bpy.context.scene.render.resolution_percentage = 100
    bpy.context.scene.render.filepath = OUTPUT_PATH + "\magnet-grayscale-48.png"
    bpy.ops.render.render(write_still=True)
    bpy.context.scene.render.resolution_x = 32
    bpy.context.scene.render.resolution_y = 32
    bpy.context.scene.render.resolution_percentage = 100
    bpy.context.scene.render.filepath = OUTPUT_PATH + "\magnet-grayscale-32.png"
    bpy.ops.render.render(write_still=True)
    bpy.context.scene.render.resolution_x = 16
    bpy.context.scene.render.resolution_y = 16
    bpy.context.scene.render.resolution_percentage = 100
    bpy.context.scene.render.filepath = OUTPUT_PATH + "\magnet-grayscale-16.png"
    bpy.ops.render.render(write_still=True)    
    
    # Restore original for manual render at 1024x1024
    hue_node.inputs[2].default_value = 1.0  # Saturation
    
    bpy.context.scene.render.resolution_x = 1024
    bpy.context.scene.render.resolution_y = 1024
    bpy.context.scene.render.resolution_percentage = 100
    
    print("✅ Rendered and saved files")

try:
    main()
except Exception as e:
    print("❌ Error:", e)
