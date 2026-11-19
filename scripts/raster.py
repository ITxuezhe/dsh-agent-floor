"""极简 SVG → PNG 光栅化器（Pillow），只覆盖 IsoFloor 用到的子集：
polygon / rect / circle / text / path(二次贝塞尔)，颜色支持 hex、hsl()、rgba()、color-mix()。

用法：
    python3 scripts/raster.py                      # scripts/out/iso.svg → scripts/out/iso.png
    python3 scripts/raster.py in.svg out.png
"""
import os, re, sys, math
import xml.etree.ElementTree as ET
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, 'out', 'iso.svg')
OUT = sys.argv[2] if len(sys.argv) > 2 else os.path.join(HERE, 'out', 'iso.png')
SCALE = 2.0
FONTS = [
    "/System/Library/Fonts/Hiragino Sans GB.ttc",
    "/System/Library/Fonts/PingFang.ttc",
    "/Library/Fonts/Arial Unicode.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
]
fonts = {}
def font(size):
    key = int(size)
    if key not in fonts:
        fonts[key] = None
        for path in FONTS:
            if not os.path.exists(path):
                continue
            try:
                fonts[key] = ImageFont.truetype(path, key)
                break
            except Exception:
                continue
        if fonts[key] is None:
            fonts[key] = ImageFont.load_default()
    return fonts[key]

def parse_color(c):
    if not c or c == 'none' or c == 'transparent': return None
    c = c.strip()
    m = re.match(r'rgba?\(([^)]+)\)', c)
    if m:
        parts = [p.strip() for p in re.split(r'[,\s/]+', m.group(1)) if p.strip()]
        r, g, b = (float(parts[0]), float(parts[1]), float(parts[2]))
        a = float(parts[3]) if len(parts) > 3 else 1.0
        if a < 1: return None
        return (int(r), int(g), int(b), 255)
    m = re.match(r'color-mix\(in srgb,\s*(.+?)\s+(\d+(?:\.\d+)?)%,\s*(.+)\)$', c)
    if m:
        c1, p1, c2 = m.group(1), float(m.group(2)) / 100.0, m.group(3)
        a1 = parse_color(c1); a2 = parse_color(c2)
        if a1 and a2:
            return tuple(int(a1[i] * p1 + a2[i] * (1 - p1)) for i in range(3)) + (255,)
        return a1 or a2
    m = re.match(r'hsla?\(\s*(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)%\s+(\d+(?:\.\d+)?)%', c)
    if m:
        hue, sat, lig = (float(m.group(i)) for i in (1, 2, 3))
        sat /= 100.0; lig /= 100.0
        def f(n):
            k = (n + hue / 30.0) % 12
            a = sat * min(lig, 1 - lig)
            return int(255 * (lig - a * max(-1, min(k - 3, min(9 - k, 1)))))
        return (f(0), f(8), f(4), 255)
    m = re.match(r'#([0-9a-fA-F]{3,8})$', c)
    if m:
        h = m.group(1)
        if len(h) == 3: h = ''.join(ch * 2 for ch in h)
        return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4)) + (255,)
    return (128, 128, 128, 255)

def style_of(el):
    st = {}
    raw = el.get('style')
    if raw:
        for part in raw.split(';'):
            if ':' in part:
                k, v = part.split(':', 1)
                st[k.strip()] = v.strip()
    for k, v in el.attrib.items():
        st.setdefault(k, v)
    return st

def num(v, d=0.0):
    try: return float(str(v).replace('px', ''))
    except Exception: return d

has_motion = {}
def is_motion_carrier(el):
    """只有『直接包含 animateMotion』的节点整棵跳过；不能因为某个大 g 的后代里有动画就把整屏都丢了。"""
    if id(el) in has_motion: return has_motion[id(el)]
    r = any(c.tag.split('}')[-1] in ('animateMotion', 'animate', 'animateTransform') for c in el)
    has_motion[id(el)] = r
    return r

def pts(s):
    vals = [float(x) for x in re.findall(r'-?\d+(?:\.\d+)?', s)]
    return [(vals[i], vals[i + 1]) for i in range(0, len(vals) - 1, 2)]

tree = ET.parse(SRC)
root = tree.getroot()
vb = [float(x) for x in (root.get('viewBox') or '0 0 900 500').split()]
W, H = int(vb[2] * SCALE), int(vb[3] * SCALE)
img = Image.new('RGB', (W, H), (247, 247, 249))
dr = ImageDraw.Draw(img)

def mat_identity(): return (1.0, 0.0, 0.0, 1.0, 0.0, 0.0)

def mat_mul(m, n):
    a, b, c, d, e, f = m
    A, B, C, D, E, F = n
    return (a * A + b * C, a * B + b * D, c * A + d * C, c * B + d * D,
            e * A + f * C + E, e * B + f * D + F)

def mat_apply(m, pt):
    a, b, c, d, e, f = m
    x, y = pt
    return (a * x + c * y + e, b * x + d * y + f)

def mat_scale(m):
    return math.sqrt(abs(m[0] * m[3] - m[1] * m[2])) or 1.0

def parse_transform(s):
    """支持 translate / scale / matrix / rotate（绕原点）。"""
    m = mat_identity()
    for name, args in re.findall(r'(translate|scale|matrix|rotate)\(([^)]*)\)', s or ''):
        vals = [float(v) for v in re.findall(r'-?\d+(?:\.\d+)?', args)]
        if not vals:
            continue
        if name == 'translate':
            t = (1, 0, 0, 1, vals[0], vals[1] if len(vals) > 1 else 0)
        elif name == 'scale':
            sx = vals[0]
            sy = vals[1] if len(vals) > 1 else sx
            t = (sx, 0, 0, sy, 0, 0)
        elif name == 'matrix' and len(vals) >= 6:
            t = tuple(vals[:6])
        elif name == 'rotate':
            ang = math.radians(vals[0])
            ca, sa = math.cos(ang), math.sin(ang)
            t = (ca, sa, -sa, ca, 0, 0)
        else:
            continue
        m = mat_mul(m, t)
    return m

root_tf = (SCALE, 0, 0, SCALE, 0, 0)

def draw(el, M):
    tag = el.tag.split('}')[-1]
    st = style_of(el)
    tr = st.get('transform')
    if tr:
        M = mat_mul(M, parse_transform(tr))
    if tag == 'svg':
        for c in el: draw(c, M)
        return
    if tag in ('animateMotion', 'animate', 'animateTransform', 'defs', 'title', 'desc', 'style'): return
    if is_motion_carrier(el): return
    sf = mat_scale(M)
    def P(pt): return mat_apply(M, pt)
    fill = parse_color(st.get('fill'))
    stroke = parse_color(st.get('stroke'))
    if tag == 'polygon':
        dr.polygon([P(p) for p in pts(st.get('points', ''))], fill=fill, outline=stroke)
    elif tag == 'polyline':
        pts_ = [P(p) for p in pts(st.get('points', ''))]
        if stroke and len(pts_) > 1:
            dr.line(pts_, fill=stroke, width=max(1, int(num(st.get('stroke-width'), 1) * sf)))
    elif tag == 'rect':
        x, y = num(st.get('x')), num(st.get('y'))
        w, hh = num(st.get('width')), num(st.get('height'))
        corners = [P((x, y)), P((x + w, y)), P((x + w, y + hh)), P((x, y + hh))]
        xs = [p[0] for p in corners]; ys = [p[1] for p in corners]
        box = [min(xs), min(ys), max(xs), max(ys)]
        r = num(st.get('rx'), 0) * sf
        dr.rounded_rectangle(box, radius=r, fill=fill, outline=stroke)
    elif tag == 'circle':
        c = P((num(st.get('cx')), num(st.get('cy'))))
        r = num(st.get('r')) * sf
        dr.ellipse([c[0] - r, c[1] - r, c[0] + r, c[1] + r], fill=fill, outline=stroke)
    elif tag == 'line':
        p1 = P((num(st.get('x1')), num(st.get('y1'))))
        p2 = P((num(st.get('x2')), num(st.get('y2'))))
        if stroke:
            dr.line([p1, p2], fill=stroke, width=max(1, int(num(st.get('stroke-width'), 1) * sf)))
    elif tag == 'text':
        size = num(st.get('font-size'), 11) * sf
        col = fill or (30, 30, 35, 255)
        anchor = st.get('text-anchor', 'start')
        text = ''.join(el.itertext())
        f = font(size)
        x, y = P((num(st.get('x')), num(st.get('y'))))
        if anchor == 'middle':
            w = dr.textlength(text, font=f); x -= w / 2
        elif anchor == 'end':
            w = dr.textlength(text, font=f); x -= w
        dr.text((x, y - size * 0.82), text, font=f, fill=col)
    elif tag == 'path':
        d = st.get('d', '')
        m = re.match(r'M ([-\d.]+) ([-\d.]+) Q ([-\d.]+) ([-\d.]+) ([-\d.]+) ([-\d.]+)', d)
        if m:
            p0, pc, p1 = (float(m.group(1)), float(m.group(2))), (float(m.group(3)), float(m.group(4))), (float(m.group(5)), float(m.group(6)))
            line = []
            for i in range(25):
                t = i / 24.0
                x = (1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * pc[0] + t * t * p1[0]
                y = (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * pc[1] + t * t * p1[1]
                line.append(P((x, y)))
            if stroke: dr.line(line, fill=stroke, width=max(1, int(num(st.get('stroke-width'), 1) * sf)))
    if tag != 'g':
        return
    for c in el: draw(c, M)

draw(root, root_tf)
os.makedirs(os.path.dirname(os.path.abspath(OUT)), exist_ok=True)
img.save(OUT)
print('wrote', OUT, img.size, 'from', SRC)
