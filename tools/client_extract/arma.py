"""무장각인(ARMA INSCRIPTA) 추출 (2026-11-05)

필요: out*/configs (spec_weapon_basic_config · spec_weapon_step · spec_weapon_level · spec_weapon_skill_des · attribute · hero_data)
      + tables_<서버>/BattleSkillCfg (강화 스킬 이름 · 아이콘)
결과: data/<언어>/arma.json
  {"attrs":{"<능력치 번호>":"이름"}, "heroes":{"<heroId>":{id,name,desc,steps:[{step,maxLv,skill:{id,name,icon,desc,base}}],levels:[{능력치:값}…Lv1~30]}}}
spec_weapon_step · spec_weapon_level 은 행 안에 작은 표가 겹친 구조라, 만들어진 표를 모두 모아서 직접 찾는다.
"""
import sys, os, json
sys.path.insert(0, '.')
import cfg, vm
from cfg import root, arr
from vm import clean
import skills as S

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'data')


def all_tables(path):
    got = []
    base = vm.T

    class Cap(dict):
        def __init__(s, *a, **k):
            super().__init__(*a, **k)
            got.append(s)
    vm.T = Cap
    try:
        rootT, defaults = vm.run(path)
    finally:
        vm.T = base
    return got, rootT, defaults


def nested_root(tables, rowkeys, min_rows=5):
    isrow = lambda t: isinstance(t, dict) and bool(rowkeys & set(t.keys()))
    maps = [t for t in tables if sum(1 for v in t.values() if isrow(v)) >= min_rows]
    ids = {id(m) for m in maps}
    roots = [t for t in tables if sum(1 for v in t.values() if id(v) in ids) >= 5]
    return max(roots, key=len) if roots else {}


def main():
    for lang, tag, cdir in S.SERVERS:
        cfg._loc = None
        os.environ['CFG'] = cdir
        L = cfg.loc()
        T = lambda v: (L.get(v, '') if isinstance(v, int) and v > 0 else (v if isinstance(v, str) else ''))
        basic, _ = root(cdir + '/LuaConfigs.spec_weapon_basic_config.lua')
        des, _ = root(cdir + '/LuaConfigs.spec_weapon_skill_des.lua')
        hd, _ = root(cdir + '/LuaConfigs.hero_data.lua')
        at, _ = root(cdir + '/LuaConfigs.attribute.lua')
        attrs = {str(k): T(v['name']) for k, v in at.items() if isinstance(v, dict)}
        # 단계: root[무장번호] = {1:{…},2:{…},3:{…}} (빠진 칸은 기본값)
        st_tables, st_root, st_def = all_tables(cdir + '/LuaConfigs.spec_weapon_step.lua')
        st_root = nested_root(st_tables, {'step', 'new_skills', 'max_level', 'replaceSkillDic'}, 2)
        # 레벨: root[무장번호] = {0..30: {level_attribute:{…}}}
        lv_tables, _, lv_def = all_tables(cdir + '/LuaConfigs.spec_weapon_level.lua')
        lv_root = nested_root(lv_tables, {'level', 'level_attribute', 'cost_nums', 'fragTotal2Level'}, 20)
        sk = {}
        for r in S.table_rows(f'tables_{tag}/BattleSkillCfg'):
            d = S.row_dict(r)
            sk[d[1][0][1]] = d
        heroes = {}
        for wid, b in basic.items():
            if not isinstance(b, dict):
                continue
            hid = b.get('hero_id')
            h = hd.get(hid) if isinstance(hd.get(hid), dict) else {}
            steps = []
            for sn, srow in sorted((st_root.get(wid) or {}).items()):
                if not isinstance(srow, dict):
                    continue
                s = dict(st_def)
                s.update(srow)
                new = (arr(s.get('new_skills')) or [None])[0]
                ori = (arr(s.get('ori_skills')) or [None])[0]
                d = sk.get(new) or {}
                g = lambda f: d[f][0][1] if f in d else None
                dd = des.get(new) if isinstance(des.get(new), dict) else {}
                steps.append({'step': s.get('step', sn), 'maxLv': s.get('max_level'),
                              'skill': {'id': new, 'base': ori, 'name': g(2).decode() if isinstance(g(2), bytes) else '',
                                        'icon': g(11).decode() if isinstance(g(11), bytes) else '',
                                        'desc': T(dd.get('new_skill_describe'))}})
            levels = []
            lm = lv_root.get(wid) or {}
            for lvn in range(1, 31):
                row = lm.get(lvn)
                a = (row or {}).get('level_attribute') if isinstance(row, dict) else None
                if a is None:
                    a = lv_def.get('level_attribute') or {}
                levels.append({str(k): v for k, v in clean(a).items()})
            heroes[str(hid)] = {'id': wid, 'name': T(b.get('name')), 'hero': T(h.get('name')) if h else '',
                                'desc': T(b.get('describe')), 'steps': steps, 'levels': levels}
        pts, _ = root(cdir + '/LuaConfigs.spec_weapon_points.lua')  # 배경 마름모 30개 (레벨만큼 켜짐), 1920×1080 가운데 기준
        points = [[round(v['pos_x'], 1), round(v['pos_y'], 1)] for k, v in sorted(pts.items()) if isinstance(v, dict)]
        doc = {'schema': '42lab-arma/0.1', 'lang': lang, 'attrs': attrs, 'points': points, 'heroes': heroes}
        with open(os.path.join(OUT, lang, 'arma.json'), 'w', encoding='utf-8') as f:
            json.dump(doc, f, ensure_ascii=False, separators=(',', ':'))
        print(lang, 'arma', len(heroes), 'steps', sum(len(v['steps']) for v in heroes.values()),
              'no-level', [k for k, v in heroes.items() if not any(v['levels'][-1].values())][:5])


if __name__ == '__main__':
    main()
