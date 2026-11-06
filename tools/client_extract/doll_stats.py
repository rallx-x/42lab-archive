"""인형 능력치 · 친밀도 보너스 추출 (2026-11-06) → data/<언어>/stats.json

능력치 = 성급 기본값(hero_star atrBaseDic) + 성장치(atrGrowthDic) × 레벨 성장(hero_level level_growth) ÷ 1,000,000
         + 마인드 확장 보너스(hero_potential atrDic, 그 레벨에 필요한 단계까지 누적)  → 소수점 버림
  확인: 스에요이 5성 Lv70 (마인드 확장 MAX) 최대체력 14850 · 공격력 465 · 연산력 613 · 물리방어 369 · 연산방어 376 (게임 화면과 같음)
성급: hero_star 단계 1~10 = 별 0.5개씩 (초기 성급 = 등급 × 2, 5성 = 10)
친밀도 보너스: friendship_hero.foster_id → friendship_foster (단계마다 필요 친밀도 · 인형 레벨 · 능력치)
사용: python doll_stats.py   (skills.py 의 SERVERS 와 같은 곳에서)
"""
import json, os, sys
sys.path.insert(0, '.')
import cfg, vm
from cfg import root
import skills as S

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'data')
# 능력치 표에 쓰는 것: 화면 번호(attribute id) ← hero_star 의 1xx 번호
SHOW = [2, 3, 26, 4, 27, 12, 28, 5, 9, 10, 7, 15]


def merged(tab, upto):
    m = {}
    for j in sorted(k for k in tab if isinstance(k, int) and k <= upto):
        for a, b in tab[j].items():
            m[a] = b
    return m


def main():
    for lang, tag, cdir in S.SERVERS:
        cfg._loc = None
        os.environ['CFG'] = cdir
        L = cfg.loc()
        T = lambda v: (L.get(v, '') if isinstance(v, int) else (v or ''))
        star, _ = vm.run(cdir + '/LuaConfigs.hero_star.lua')
        pot, _ = vm.run(cdir + '/LuaConfigs.hero_potential.lua')
        lvl, ld = root(cdir + '/LuaConfigs.hero_level.lua')
        LG = {k: {**ld, **v}['level_growth'] for k, v in lvl.items() if isinstance(v, dict)}
        fh, fd = root(cdir + '/LuaConfigs.friendship_hero.lua')
        fo, _ = vm.run(cdir + '/LuaConfigs.friendship_foster.lua')
        att, adef = root(cdir + '/LuaConfigs.attribute.lua')
        isp = lambda i: isinstance(att.get(i), dict) and {**adef, **att[i]}.get('num_type') == 2
        hd, hdd = root(cdir + '/LuaConfigs.hero_data.lua')
        heroes = {}
        for hid, tab in star.items():
            if not isinstance(tab, dict) or not isinstance(hid, int):
                continue
            rare = {**hdd, **hd.get(hid, {})}.get('rare') if isinstance(hd.get(hid), dict) else None
            ptab = pot.get(hid) if isinstance(pot.get(hid), dict) else {}

            def stat(rank, level):
                s = merged(tab, rank)
                base, grow, extra = s.get('atrBaseDic', {}), s.get('atrGrowthDic', {}), s.get('atrExtraDic', {})
                # 마인드 확장: 그 레벨에 닿으려면 필요한 단계 (단계 k 의 level_max 가 레벨 이상인 가장 낮은 k), Lv1 은 없음
                pm = {}
                if level > 1 and ptab:
                    st = sorted(k for k in ptab if isinstance(k, int))
                    acc = {}
                    for k in st:
                        acc.update(ptab[k])
                        if acc.get('level_max', 10) >= level:
                            break
                    pm = dict(acc.get('atrDic', {}))
                    for a, b in (acc.get('extra') or {}).items():
                        pm[a + 100] = pm.get(a + 100, 0) + b
                out = {}
                for a in SHOW:
                    k = 100 + a
                    b = base.get(k, extra.get(k, 0))
                    v = b + grow.get(k, 0) * LG.get(level, 0) / 1e6 + pm.get(k, 0)
                    v = int(v)
                    if v:
                        out[str(a)] = (('%g' % (v / 10)) + '%') if isp(a) else v
                return out
            r0 = (rare or 3) * 2
            cols = [{'star': r0 / 2, 'lv': 1, 'v': stat(r0, 1)}, {'star': 5, 'lv': 60, 'v': stat(10, 60)}, {'star': 5, 'lv': 70, 'v': stat(10, 70)}]
            f = {**fd, **fh[hid]} if isinstance(fh.get(hid), dict) else {}
            bonus = []
            for fid in (f.get('foster_id') or {}).values():
                rows = fo.get(fid) or {}
                steps = []
                for k in sorted(x for x in rows if isinstance(x, int)):
                    r = rows[k]
                    vals = [(('%g' % (n / 10)) + '%') if isp(a) else n for a, n in zip(r['attributeIds'].values(), r['attributeNums'].values())]
                    steps.append({'fl': r.get('friendship_level'), 'hl': r.get('hero_level'), 'v': vals[0] if vals else ''})
                if not steps:
                    continue
                r1 = rows[min(x for x in rows if isinstance(x, int))]
                aid = list(r1['attributeIds'].values())[0]
                desc = T(r1.get('describe')).replace('{0}', '').replace('  ', ' ').strip()
                bonus.append({'name': T(r1.get('name')), 'icon': r1.get('icon', ''), 'attr': aid, 'desc': desc, 'steps': steps})
            heroes[str(hid)] = {'cols': cols, 'bonus': bonus}
        doc = {'schema': '42lab-stats/0.1', 'lang': lang, 'order': [str(a) for a in SHOW], 'heroes': heroes}
        with open(os.path.join(OUT, lang, 'stats.json'), 'w', encoding='utf-8') as fp:
            json.dump(doc, fp, ensure_ascii=False, separators=(',', ':'))
        print(lang, len(heroes), heroes.get('1045', {}).get('cols', [{}])[-1].get('v'))


if __name__ == '__main__':
    main()
