"""스킬 육각 프레임 안쪽 구멍 마스크 (2026-11-07) → assets/img/skill/hole_N.png · arma_N.png

프레임 그림(fr_1 · fr_2 · fr_3)은 그대로 두고, 그 안쪽 구멍 모양을 프레임 그림에서 직접 따낸다.
  - hole_N.png : 구멍(가운데에서 투명한 곳을 채워 나감) + 1px 넓힘 → 회색 육각이 흰 프레임 선 밑까지만, 밖으로는 절대 안 나감
  - arma_N.png : 무장각인 주황 테두리(fr_arma)를 구멍 + 2px 크기로 늘린 뒤 (구멍 + 2px) 모양으로 잘라냄 → 흰 프레임 바로 안쪽에 착 붙음 (넘친 2px 는 흰 선 밑에 숨음)
  - 둘 다 프레임과 같은 캔버스 크기라서 CSS 에서 프레임과 똑같이 (inset:0 · center/contain) 그리면 위치가 딱 맞는다
  - 빨간 밑그림 · 흰 그림 위치용 구멍 범위(%)를 출력 (60×66 칸 기준)
사용: python skill_frame_masks.py
"""
import os
from collections import deque
from PIL import Image, ImageChops, ImageFilter

D = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'assets', 'img', 'skill')
W, H = 60, 66


def hole(fr, th=100):
    a = fr.split()[3]
    w, h = fr.size
    px = a.load()
    m = Image.new('L', (w, h), 0)
    mp = m.load()
    q = deque([(w // 2, h // 2)])
    mp[w // 2, h // 2] = 255
    while q:
        x, y = q.popleft()
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if 0 <= nx < w and 0 <= ny < h and not mp[nx, ny] and px[nx, ny] < th:
                mp[nx, ny] = 255
                q.append((nx, ny))
    return m


def main():
    arma = Image.open(os.path.join(D, 'fr_arma.png')).convert('RGBA')
    for n in (1, 2, 3):
        fr = Image.open(os.path.join(D, 'fr_%d.png' % n)).convert('RGBA')
        w, h = fr.size
        m = hole(fr)
        grow = m.filter(ImageFilter.MaxFilter(3))  # 1px 넓힘 (흰 선 밑으로만)
        out = Image.new('RGBA', (w, h), (255, 255, 255, 0))
        out.putalpha(grow)
        out.save(os.path.join(D, 'hole_%d.png' % n))
        x0, y0, x1, y1 = m.getbbox()
        # 주황은 흰 선 밑으로 2px 들어가게 (흰 선 안쪽 흐린 가장자리 사이로 회색이 안 보이게, 흰 프레임이 위에 덮음)
        E = 2
        a = arma.resize((x1 - x0 + 2 * E, y1 - y0 + 2 * E), Image.LANCZOS)
        layer = Image.new('RGBA', (w, h), (0, 0, 0, 0))
        layer.paste(a, (x0 - E, y0 - E))
        al = ImageChops.multiply(layer.split()[3], m.filter(ImageFilter.MaxFilter(2 * E + 1)))
        res = Image.new('RGBA', (w, h), (255, 255, 255, 0))
        res.putalpha(al)
        res.save(os.path.join(D, 'arma_%d.png' % n))
        s = min(W / w, H / h)
        ox, oy = (W - w * s) / 2, (H - h * s) / 2
        L, T = (ox + x0 * s) / W * 100, (oy + y0 * s) / H * 100
        R, B = (ox + x1 * s) / W * 100, (oy + y1 * s) / H * 100
        print('t%d hole %%: left %.2f top %.2f width %.2f height %.2f' % (n, L, T, R - L, B - T))


if __name__ == '__main__':
    main()
