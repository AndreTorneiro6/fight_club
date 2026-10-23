"""Generate code-drawn notification glyphs; no player photos or external artwork."""
from pathlib import Path
from PIL import Image, ImageDraw

EVENTS = ('season', 'challenge', 'accepted', 'schedule', 'result', 'roles', 'reminder', 'update', 'general')
OUTPUT = Path(__file__).resolve().parents[1] / 'public/icons/notifications'
OUTPUT.mkdir(parents=True, exist_ok=True)

def render(kind, badge=False):
    scale = 2 if badge else 4
    size = 48 * scale
    picture = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(picture)
    ink = (255, 255, 255, 255) if badge else (231, 194, 91, 255)
    width = 2 * scale
    box = lambda values: tuple(round(v * scale) for v in values)
    line = lambda points: draw.line([box(p) for p in points], fill=ink, width=width, joint='curve')
    outline = lambda bounds: draw.ellipse(box(bounds), outline=ink, width=width)
    polygon = lambda points: line(points + [points[0]])
    if not badge:
        draw.rounded_rectangle((0, 0, size-1, size-1), radius=10*scale, fill=(10, 20, 37, 255))
    if kind == 'season':
        line([(14, 39), (14, 10)])
        polygon([(14, 11), (36, 11), (31, 20), (36, 28), (14, 28)])
    elif kind == 'challenge':
        line([(11, 10), (35, 35)]); line([(37, 10), (13, 35)])
        line([(9, 29), (20, 40)]); line([(28, 40), (39, 29)])
        polygon([(11, 10), (12, 18), (18, 12)])
        polygon([(37, 10), (30, 12), (36, 18)])
    elif kind == 'accepted':
        outline((8, 8, 40, 40)); line([(15, 24), (22, 31), (34, 17)])
    elif kind == 'schedule':
        draw.rounded_rectangle(box((8, 11, 40, 40)), radius=3*scale, outline=ink, width=width)
        line([(8, 20), (40, 20)]); line([(16, 7), (16, 15)]); line([(32, 7), (32, 15)])
        for x in (16, 24, 32):
            for y in (27, 34): draw.ellipse(box((x-1, y-1, x+1, y+1)), fill=ink)
    elif kind == 'result':
        line([(15, 10), (15, 22), (19, 28), (29, 28), (33, 22), (33, 10), (15, 10)])
        line([(15, 13), (8, 13), (9, 21), (15, 23)]); line([(33, 13), (40, 13), (39, 21), (33, 23)])
        line([(24, 28), (24, 37)]); line([(16, 39), (32, 39)])
    elif kind == 'roles':
        polygon([(24, 7), (39, 13), (37, 28), (32, 35), (24, 41), (16, 35), (11, 28), (9, 13)])
        line([(17, 24), (22, 29), (32, 18)])
    elif kind == 'reminder':
        outline((8, 8, 40, 40)); line([(24, 14), (24, 24), (32, 29)])
    elif kind == 'update':
        outline((8, 8, 40, 40)); line([(24, 22), (24, 34)]); draw.ellipse(box((23, 14, 25, 16)), fill=ink)
    else:
        draw.arc(box((12, 9, 36, 34)), 180, 360, fill=ink, width=width)
        line([(12, 21), (12, 31), (8, 35), (40, 35), (36, 31), (36, 21)])
        draw.arc(box((20, 34, 28, 42)), 0, 180, fill=ink, width=width)
    picture.save(OUTPUT / f'{kind}{"-badge" if badge else ""}.png', optimize=True)

for event in EVENTS:
    render(event)
    render(event, True)
