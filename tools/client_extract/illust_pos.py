"""인형 큰 그림(lpic_*) 프리팹의 위치 · 크기 값 → illust_pos.json (2026-11-27)

어디에 있나 (luascripts 로 확인)
  - 인형 정보 화면 = Game.Hero.NewUI.State.UIHeroState
      bigImg 프리팹을 PathConsts.GetCharacterBigImgPrefabPath(src_id_pic) 로 불러 ui.heroHolder 밑에 붙이고
      FindComponent(CommonPicController):SetPosType(HeroList) 를 부름  (Live2D 면 CubismInterationController:SetL2DPosType(HeroList))
  - 프리팹 경로 = CharacterBigImgPrefabHead + <src_id_pic> + '/lpic_' + <src_id_pic> + '.prefab'  (configs skin.src_id_pic, 예 sueyoi_carnival)
    · src_id_pic_rectify 가 있는 스킨(22개)은 skinData:RecitifySkinRes 로 이름이 바뀔 수 있음
  - CommonPicController 는 Lua 가 아니라 C# 컴포넌트 → 화면 종류(PosType)별 위치 · 크기 값은 프리팹 안에 저장돼 있음
    → 그림 번들(.ab)을 열어서 읽어야 함

사용 (사용자 PC, python + UnityPy):
  pip install UnityPy
  python illust_pos.py <번들 폴더 또는 .ab 파일들> > illust_pos.json
출력: { "lpic_sueyoi": { "bundle": ..., "controller": {CommonPicController 값 전부}, "rects": [...], "sprites": [...] } }
"""
import sys, os, glob, json
import UnityPy


def plain(v):
    if isinstance(v, dict):
        return {k: plain(x) for k, x in v.items()}
    if isinstance(v, list):
        return [plain(x) for x in v]
    if isinstance(v, (bytes, bytearray)):
        return v.hex()
    return v


def files(args):
    for a in args:
        if os.path.isdir(a):
            yield from glob.glob(os.path.join(a, '**', '*.ab'), recursive=True)
        else:
            yield a


def main():
    out = {}
    for f in files(sys.argv[1:]):
        raw = open(f, 'rb').read()
        if raw[:8] == b'\0' * 8 and raw[8:15] == b'UnityFS':   # 뉴럴 클라우드 번들은 앞에 0 바이트 8개가 붙어 있음
            raw = raw[8:]
        try:
            env = UnityPy.load(raw)
        except Exception:
            continue
        objs = {o.path_id: o for o in env.objects}
        names = {}
        for o in env.objects:
            if o.type.name == 'GameObject':
                names[o.path_id] = o.read().m_Name
        if not any(str(n).startswith(('lpic_', 'L2D', 'l2d')) for n in names.values()):
            continue
        root = next((n for n in names.values() if str(n).startswith('lpic_')), os.path.basename(f))
        rec = out.setdefault(root, {'bundle': os.path.basename(f), 'controller': [], 'rects': [], 'sprites': []})
        for o in env.objects:
            t = o.type.name
            if t == 'MonoBehaviour':
                try:
                    tt = o.read_typetree()
                except Exception:
                    continue
                cls = ''
                try:
                    sc = o.read().m_Script.read()
                    cls = sc.m_ClassName
                except Exception:
                    pass
                if 'Pic' in cls or 'Cubism' in cls and 'Interation' in cls or 'PosType' in json.dumps(plain(tt))[:20000]:
                    rec['controller'].append({'class': cls, 'go': names.get(tt.get('m_GameObject', {}).get('m_PathID')), 'values': plain(tt)})
            elif t == 'RectTransform':
                tt = o.read_typetree()
                rec['rects'].append({'go': names.get(tt['m_GameObject']['m_PathID']), 'pos': plain(tt.get('m_AnchoredPosition')),
                                     'size': plain(tt.get('m_SizeDelta')), 'pivot': plain(tt.get('m_Pivot')),
                                     'anchorMin': plain(tt.get('m_AnchorMin')), 'anchorMax': plain(tt.get('m_AnchorMax')),
                                     'scale': plain(tt.get('m_LocalScale')), 'localPos': plain(tt.get('m_LocalPosition'))})
            elif t == 'Sprite':
                s = o.read()
                try:
                    r = s.m_Rect
                    rec['sprites'].append({'name': s.m_Name, 'rect': [r.x, r.y, r.width, r.height],
                                           'pivot': [s.m_Pivot.x, s.m_Pivot.y], 'ppu': s.m_PixelsToUnits})
                except Exception:
                    rec['sprites'].append({'name': s.m_Name})
            elif t == 'Texture2D':
                tx = o.read()
                rec.setdefault('textures', []).append({'name': tx.m_Name, 'w': tx.m_Width, 'h': tx.m_Height})
    json.dump(out, sys.stdout, ensure_ascii=False, indent=1)


if __name__ == '__main__':
    main()
