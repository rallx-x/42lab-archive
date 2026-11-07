"""성령 도감 · 강화 시뮬레이터 → data/<언어>/fairy.json (2026-11-07)

원본 (configs, 서버별)
  - fairy_data       성령 5종: 이름 · 적성(fairy_suitability) · 스킬 묶음(skill_list = fairy_skill.pool_id) · 아이템(그림 ICON_Item_*) · 그림 묶음(src_id → fairy_res)
  - fairy_level      레벨별 필요 경험치 (Lv.1~50, 마지막 999999 = 만렙)
  - fairy_level_attr 레벨별 능력치 (누적, 5종 공통): 공격력 · 연산력 · 치명률 · 물리관통 · 연산관통 (attribute num_type 2 = %, ÷10)
  - fairy_star_new   랭크 1~5: 최대 레벨 · 스킬 칸 · 랭크업 재료(starUpItemIds/Nums) · 분해 보상(recycle_reward) · 재구성(tran_cost)
  - fairy_skill      성령마다 20개 (special 4 = 고유, 지휘 스킬 변형 sSkillId → tSkillId 포함) · function_id = BattleSkillCfg 스킬
  - fairy_skill_weight 스킬 등급 S · A · B · C (rate_show ÷ 100 = %, skill_level 4 · 3 · 2 · 1)
스킬 수치: BattleSkillCfg 공식 (skills.py 계산기), 레벨 1~4 = 등급 C · B · A · S
사용: python fairy.py   (skills.py 의 SERVERS 와 같은 곳에서, tables_<서버>/ 필요)
"""
import json, os, sys
sys.path.insert(0, '.')
import cfg
from cfg import root
import skills as S
from skills import table_rows, row_dict, packed, evaluate, num

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.environ.get('REPO') or os.path.join(HERE, '..', '..')


def main():
    for lang, tag, cdir in S.SERVERS:
        cfg._loc = None
        os.environ['CFG'] = cdir
        L = cfg.loc()
        T = lambda v: (L.get(v, '') if isinstance(v, int) else (v or ''))
        formulas = {}
        for r in table_rows(f'tables_{tag}/BattleFormulaCfg'):
            d = row_dict(r)
            if 2 in d:
                formulas[d[1][0][1]] = d[2][0][1].decode('utf-8')
        sk = {}
        for r in table_rows(f'tables_{tag}/BattleSkillCfg'):
            d = row_dict(r)
            sk[d[1][0][1]] = d
        txt = lambda d, f: d[f][0][1].decode('utf-8') if d and f in d and isinstance(d[f][0][1], bytes) else ''
        G = lambda t: root(cdir + '/LuaConfigs.%s.lua' % t)[0]
        fd, su, item, attr = G('fairy_data'), G('fairy_suitability'), G('item'), G('attribute')
        lv, la, st, fs, sw, res = G('fairy_level'), G('fairy_level_attr'), G('fairy_star_new'), G('fairy_skill'), G('fairy_skill_weight'), G('fairy_res')

        def vals(d):
            fx = packed(*d[7][0]) if 7 in d else []
            b1 = packed(*d[8][0]) if 8 in d else []
            g2 = packed(*d[9][0]) if 9 in d else []
            l3 = packed(*d[10][0]) if 10 in d else []
            out = []
            for k, fid in enumerate(fx):
                env = {'$1': b1[k] if k < len(b1) else 0, '$2': g2[k] if k < len(g2) else 0, '$3': l3[k] if k < len(l3) else 1}
                row = []
                for l in range(1, 5):
                    env['L'] = l
                    try:
                        row.append(num(evaluate(formulas, fid, env)))
                    except Exception:
                        row = None
                        break
                out.append(row)
            return out

        pools = {}
        for k in sorted(x for x in fs if isinstance(x, int)):
            v = fs[k]
            sid = v.get('function_id') or v.get('tSkillId')
            d = sk.get(sid)
            if not d:
                continue
            o = {'id': k, 'name': txt(d, 2), 'brief': txt(d, 4), 'detail': txt(d, 5) or txt(d, 4), 'vals': vals(d), 'special': bool(v.get('special'))}
            if v.get('sSkillId'):
                o['from'] = v['sSkillId']  # 이 지휘 스킬을 성령 변형(tSkillId)으로 바꿈
                o['to'] = v['tSkillId']
            pools.setdefault(v.get('pool_id'), []).append(o)
        sprites = []
        for k in sorted(x for x in fd if isinstance(x, int)):
            v = fd[k]
            rs = res.get(v.get('src_id')) if isinstance(res.get(v.get('src_id')), dict) else {}
            ph = rs.get(1) if isinstance(rs.get(1), dict) else {}
            it = item.get(v.get('item_id')) if isinstance(item.get(v.get('item_id')), dict) else {}
            sprites.append({'id': k, 'name': T(v.get('name')), 'suit': T((su.get(v.get('suitability')) or {}).get('name')),
                            'icon': it.get('icon') or '', 'head': ph.get('src_id_head') or '', 'pic': ph.get('src_id_pic') or '',
                            'locked': bool(v.get('is_locked')), 'skills': pools.get(v.get('skill_list'), [])})
        levels = []
        for k in sorted(x for x in lv if isinstance(x, int)):
            e = lv[k].get('exp')
            row = next((a for a in la.values() if isinstance(a, dict) and a.get('level') == lv[k].get('level')), {})
            levels.append({'lv': lv[k].get('level'), 'exp': e if e and e < 999999 else 0,
                           'attrs': {str(a): b for a, b in (row.get('level_attribute') or {}).items()}})
        aids = sorted({int(a) for l in levels for a in l['attrs']})
        attrs = {str(a): [T(attr[a].get('name')), attr[a].get('num_type') or 1] for a in aids if isinstance(attr.get(a), dict)}
        ranks = []
        for k in sorted(x for x in st if isinstance(x, int)):
            v = st[k]
            ids, nums = v.get('starUpItemIds') or {}, v.get('starUpItemNums') or {}
            ranks.append({'rank': v.get('rank'), 'levelMax': v.get('level_max'), 'slots': v.get('skill_slot'), 'phase': v.get('res_level'),
                          'cost': {str(ids[j]): nums.get(j, 0) for j in sorted(ids)},
                          'recycle': {str(a): b for a, b in (v.get('recycle_reward') or {}).items()},
                          'reroll': {str(a): b for a, b in (v.get('tran_cost') or {}).items()}})
        rarity = [{'name': v.get('name'), 'rate': (v.get('rate_show') or 0) / 100, 'level': v.get('skill_level')}
                  for k, v in sorted(sw.items()) if isinstance(v, dict)]
        used = {i for r in ranks for part in ('cost', 'recycle', 'reroll') for i in r[part]} | {'1920', '1923'}
        items = {i: [T(item[int(i)].get('name')), item[int(i)].get('icon') or ''] for i in sorted(used) if isinstance(item.get(int(i)), dict)}
        doc = {'schema': '42lab-fairy/0.1', 'lang': lang, 'source': 'configs fairy_* · item · attribute + tables BattleSkillCfg',
               'sprites': sprites, 'levels': levels, 'attrs': attrs, 'ranks': ranks, 'rarity': rarity, 'items': items, 'expItem': '1920'}
        with open(os.path.join(REPO, 'data', lang, 'fairy.json'), 'w', encoding='utf-8') as f:
            json.dump(doc, f, ensure_ascii=False, separators=(',', ':'))
        print(lang, [s['name'] for s in sprites], len(levels), 'levels', len(ranks), 'ranks', sum(len(s['skills']) for s in sprites), 'skills')


if __name__ == '__main__':
    main()
