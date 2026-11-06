"""알고리즘 도감 추출 (2026-11-06) → data/<언어>/algorithms.json

필요: out*/configs (item · ath_suit · ath_area)  — skills.py 의 SERVERS 와 같은 곳에서 실행
알고리즘 = item type 11
  기본(1칸 · 2칸 능력치): id 2 Q A S N  (Q 1 파랑 · 2 보라 · 3 주황, A 구역, S 칸 수, N 능력치 번호)
  세트: id 24 SS P (SS 세트, P 조각 번호), 아이콘 ICON_suit_SS_2 (보라는 _4 붙음)
세트 효과 = ath_suit[세트][1] (2세트) · [2] (3세트)
결과: {areas:{번호:{name,en}}, sets:[{id,name,area,icon,pieces:[이름],two,three,purple}], basics:{구역:{칸:[능력치 이름]}}}
"""
import json, os, re, sys
sys.path.insert(0, '.')
import cfg
from cfg import root
import skills as S

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'data')


def main():
    docs = {}
    for lang, tag, cdir in S.SERVERS:
        cfg._loc = None
        os.environ['CFG'] = cdir
        L = cfg.loc()
        T = lambda v: (L.get(v, '') if isinstance(v, int) else (v or ''))
        items, idef = root(cdir + '/LuaConfigs.item.lua')
        suit, sdef = root(cdir + '/LuaConfigs.ath_suit.lua')
        area, _ = root(cdir + '/LuaConfigs.ath_area.lua')
        areas = {str(k): {'name': T(v.get('name2')), 'en': v.get('name3', '')} for k, v in area.items() if isinstance(v, dict)}
        sets, basics = {}, {}
        for k, v in sorted((k, v) for k, v in items.items() if isinstance(v, dict)):
            m = {**idef, **v}
            if m.get('type') != 11:
                continue
            ds = str(k)
            if ds.startswith('24'):
                mm = re.match(r'ICON_suit_(\d+)_(\d)(_4)?$', m.get('icon', ''))
                if not mm:
                    continue
                sid = int(mm.group(1))
                s = sets.setdefault(sid, {'id': sid, 'name': re.sub(r'\s*[-－]\s*\d+$', '', T(m['name'])), 'area': None,
                                          'icon': f'ICON_suit_{mm.group(1)}_2', 'pieces': [], 'purple': False})
                if mm.group(3):
                    s['purple'] = True
                    continue
                if T(m['name']) not in s['pieces']:
                    s['pieces'].append(T(m['name']))
                desc = T(m['describe'])
                for ak, av in areas.items():
                    if s['area'] is None and av['name'] and desc.startswith(av['name']):
                        s['area'] = int(ak)
            elif len(ds) == 5 and ds[0] == '2' and ds[1] in '123':
                q, a, size = ds[1], ds[2], ds[3]
                lst = basics.setdefault(a, {}).setdefault(size, [])
                if T(m['name']) not in lst:
                    lst.append(T(m['name']))
        for sid, s in sets.items():
            row = suit.get(sid) if isinstance(suit.get(sid), dict) else {}
            # 행 안에 설명이 없으면 표 기본값(예: 충전속도 +10%)
            s['two'] = T(row[1].get('describe', sdef.get('describe'))) if isinstance(row.get(1), dict) else ''
            s['three'] = T(row[2].get('describe', sdef.get('describe'))) if isinstance(row.get(2), dict) else ''
        docs[lang] = {'schema': '42lab-algorithms/0.1', 'lang': lang, 'areas': areas,
                      'sets': [sets[k] for k in sorted(sets)], 'basics': basics}
        print(lang, 'sets', len(sets), 'no-area', [s['id'] for s in sets.values() if s['area'] is None],
              'basics', {a: {z: len(v) for z, v in b.items()} for a, b in basics.items()})

    # 구역을 글에서 못 찾은 세트는 다른 언어 결과로 채우기 (세트 번호는 서버 공통)
    known = {}
    for d in docs.values():
        for x in d['sets']:
            if x['area']:
                known.setdefault(x['id'], x['area'])
    for lang, d in docs.items():
        for x in d['sets']:
            x['area'] = x['area'] or known.get(x['id'])
        with open(os.path.join(OUT, lang, 'algorithms.json'), 'w', encoding='utf-8') as f:
            json.dump(d, f, ensure_ascii=False, separators=(',', ':'))


if __name__ == '__main__':
    main()
