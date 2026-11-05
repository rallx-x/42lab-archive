"""무장각인 화면 그림 만들기: KR spriteatlas/ui_armainscripta.ab → assets/img/arma/*.webp
- 색이 들어가는 조각은 직군 5색으로 미리 칠함 (게임 기본 = 사수 빨강 (1, .31, .27))
- 9칸 늘이기(sliced) 조각은 게임 크기대로 미리 늘여 둠
"""
from PIL import Image
import os
SRC = 'arma_atlas/out'  # KR raw/bundles/res/spriteatlas/ui_armainscripta.ab (앞 8바이트 떼고) 에서 뽑은 Sprite png
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'assets', 'img', 'arma')
os.makedirs(OUT, exist_ok=True)
ROLES = {'r0': (0.24, 0.55, 1.0), 'r1': (1.0, 0.54, 0.16), 'r2': (1.0, 0.31, 0.27), 'r3': (0.65, 0.42, 1.0), 'r4': (0.32, 1.0, 0.55)}
TINT = {'center': 'UI_专武中心节点', 'cpu': 'UI_专武中心Cpu装饰', 'cpuline': 'UI_专武中心装饰线条', 'node': 'UI_专武突破节点',
        'pt_on': 'UI_专武等级已解锁节点', 'pt_off': 'UI_专武等级节点'}
PLAIN = {'n1': 'UI_专武Ⅰ', 'n2': 'UI_专武Ⅱ', 'n3': 'UI_专武Ⅲ', 'arrow': 'UI_专武中心节点箭头', 'word': 'UI_专武中心装饰字',
         'node_deco': 'UI_专武突破节点装饰', 'lockfog': 'UI_专武等级未解锁', 'lt': 'UI_专武左上装饰1', 'lb': 'UI_专武左下装饰1',
         'rt': 'UI_专武右上装饰1', 'rb': 'UI_专武右下装饰1'}


def load(n):
    return Image.open(f'{SRC}/{n}.png').convert('RGBA')


def tint(im, c):
    r, g, b, a = im.split()
    return Image.merge('RGBA', (r.point(lambda v: int(v * c[0])), g.point(lambda v: int(v * c[1])), b.point(lambda v: int(v * c[2])), a))


def slice9(im, w, h, L, B, R, T):
    """Unity border x=left y=bottom z=right w=top"""
    W, H = im.size
    out = Image.new('RGBA', (w, h))
    xs = [(0, L, 0, L), (L, W - R, L, w - R), (W - R, W, w - R, w)]
    ys = [(0, T, 0, T), (T, H - B, T, h - B), (H - B, H, h - B, h)]
    for sx0, sx1, dx0, dx1 in xs:
        for sy0, sy1, dy0, dy1 in ys:
            if sx1 > sx0 and sy1 > sy0 and dx1 > dx0 and dy1 > dy0:
                out.alpha_composite(im.crop((sx0, sy0, sx1, sy1)).resize((dx1 - dx0, dy1 - dy0)), (dx0, dy0))
    return out


def save(im, name):
    im.save(f'{OUT}/{name}.webp', 'WEBP', quality=90, method=6)


# 가운데 장식(9칸): 360×360, 돌리기는 CSS
cdeco = slice9(load('UI_专武中心装饰'), 360, 360, 14, 16, 15, 15)
# 현재 레벨 · 선택 표시(9칸)
save(slice9(load('UI_专武选中态'), 126, 128, 58, 50, 50, 60), 'sel')
save(slice9(load('UI_专武选中态'), 102, 102, 58, 50, 50, 60).resize((102, 102)), 'sel_pt')
for k, n in PLAIN.items():
    save(load(n), k)
for role, c in ROLES.items():
    for k, n in TINT.items():
        save(tint(load(n), c), f'{k}_{role}')
    save(tint(cdeco, c), f'cdeco_{role}')
print(sorted(os.listdir(OUT)), sum(os.path.getsize(f'{OUT}/{f}') for f in os.listdir(OUT)) // 1024, 'KB')
