"""스킬 아이콘을 게임 원래 칸(m_Rect, 보통 128×128)에 원래 위치(textureRectOffset)로 다시 놓기 (2026-11-06)
아틀라스의 스킬 그림은 빈 여백이 잘려 있어서, 그대로 쓰면 아이콘마다 크기 · 위치가 달라짐
사용: atlas2/skillicon.ab 가 있는 곳에서 python skill_icons_pad.py → pnc-item-skill2/skill/*.webp (pnc-item 의 skill/ 에 덮어쓰기)
import UnityPy, os
from PIL import Image
OUT = 'pnc-item-skill2/skill'
os.makedirs(OUT, exist_ok=True)
need = {f[:-5] for f in os.listdir('pnc-item-skill/skill') if not f.startswith('_')}
env = UnityPy.load('atlas2/skillicon.ab')
n = 0
for o in env.objects:
    if o.type.name != 'Sprite':
        continue
    t = o.read_typetree()
    name = t['m_Name']
    if name not in need:
        continue
    s = o.read()
    im = s.image.convert('RGBA')
    W, H = round(t['m_Rect']['width']), round(t['m_Rect']['height'])
    off = t['m_RD']['textureRectOffset']
    ox, oy = round(off['x']), round(off['y'])
    canvas = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    canvas.alpha_composite(im, (ox, H - oy - im.height))  # Unity 좌표는 아래에서 위로
    canvas.save(f'{OUT}/{name}.webp', 'WEBP', quality=90, method=4)
    n += 1
print(n, 'of', len(need))
