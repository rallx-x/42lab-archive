"""인형 육성 재화 → data/<언어>/growth.json (2026-11-07)

원본 (configs, 서버별)
  - hero_rank        성급 단계 1~10 (0.5★씩, 초기 = 등급 × 2): 그 단계에서 다음 단계로 올릴 때 마인드맵 조각(upgrade_star_frag_cost) · 디그코인(upgrade_star_extra_cost)
                     · 성급별 궁극기 레벨 상한(ultimateskill_level) · 중복 획득 시 조각(repeat_frag_trans) · 마인드맵 재료(repeat_extra_trans)
  - hero_level       레벨별 다음 레벨까지 경험치 (Lv.1~70)
  - hero_potential   인형마다 마인드 확장 단계 0~6: 그 단계의 최대 레벨(level_max) · 다음 단계로 돌파 비용(cost, 디그코인 + 돌파 위젯)
                     (단계 5 · 6 은 값이 비어 표 기본값을 씀 — 게임과 같음)
  - hero_skill_level 스킬 레벨 1~10: 다음 레벨로 올릴 때 재료(itemIdList · countList, 비면 디그코인 · 스킬 샘플) · 필요 인형 레벨(level_limit)
                     (레벨 1 줄은 값이 비어 표 기본값을 씀)
  - spec_weapon_step · spec_weapon_level 무장각인 돌파(단계) · 레벨 재료 (arma.py 와 같은 방식으로 읽음), 2502 = 인형별 무장각인 조각 25xx
  - 인형 조각 아이템 = 1000 + 인형 번호 (예 2040 드셰브니 조각)
사용: python growth.py   (skills.py 의 SERVERS 와 같은 곳에서)
"""
import json, os, sys
sys.path.insert(0, '.')
import cfg
from cfg import root
import skills as S
import arma as A
from vm import clean

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.environ.get('REPO') or os.path.join(HERE, '..', '..')


def main():
    for lang, tag, cdir in S.SERVERS:
        cfg._loc = None
        os.environ['CFG'] = cdir
        L = cfg.loc()
        T = lambda v: (L.get(v, '') if isinstance(v, int) else (v or ''))
        G = lambda t: root(cdir + '/LuaConfigs.%s.lua' % t)[0]
        item, rank, lvl, pot, skl = G('item'), G('hero_rank'), G('hero_level'), G('hero_potential'), G('hero_skill_level')
        used = set()
        ranks = []
        for k in sorted(x for x in rank if isinstance(x, int)):
            v = rank[k]
            coin = {}
            for e in (v.get('upgrade_star_extra_cost') or {}).values():
                if isinstance(e, dict) and e.get('num'):
                    coin[str(e['itemId'])] = e['num']
            used |= set(coin)
            ranks.append({'rank': k, 'frag': v.get('upgrade_star_frag_cost') or 0, 'cost': coin, 'ult': v.get('ultimateskill_level'),
                          'dupFrag': v.get('repeat_frag_trans'), 'dupMat': {str(a): b for a, b in zip((v.get('repeat_extra_trans_id') or {}).values(), (v.get('repeat_extra_trans_num') or {}).values())}})
            used |= set(ranks[-1]['dupMat'])
        levels = [{'lv': lvl[k]['level'], 'exp': lvl[k]['exp']} for k in sorted(x for x in lvl if isinstance(x, int))]
        skills = []
        for k in sorted(x for x in skl if isinstance(x, int)):
            v = skl[k]
            ids = list((v.get('itemIdList') or {1: 1003, 2: 1501}).values()) if v.get('itemIdList') != {} else []
            cnt = list((v.get('countList') or {}).values())
            cost = {str(i): n for i, n in zip(ids, cnt) if n}
            used |= set(cost)
            skills.append({'lv': k, 'cost': cost, 'need': v.get('level_limit') or 0})
        heroes = {}
        for hid, row in pot.items():
            if not isinstance(row, dict) or not isinstance(hid, int):
                continue
            stages = []
            for k in sorted(x for x in row if isinstance(x, int)):
                s = row[k] if isinstance(row[k], dict) else {}
                c = s.get('cost') if s.get('cost') is not None else row.get('cost')
                c = {str(a): b for a, b in (c or {}).items()}
                used |= set(c)
                stages.append({'stage': k, 'max': s.get('level_max') or row.get('level_max'), 'cost': c})
            if stages:
                stages[-1]['cost'] = {}  # 마지막 단계는 더 돌파하지 않음
                heroes[str(hid)] = stages  # 줄 번호 = 인형 번호 (hero_id 칸은 기본값이 섞임)
        # 무장각인: 돌파(단계 1~3) · 레벨(1~29 → 다음 레벨) 재료. 표의 2502 는 인형마다 다른 무장각인 조각(costIdDic 의 25xx)으로 바꿈
        basic, _ = root(cdir + '/LuaConfigs.spec_weapon_basic_config.lua')
        st_tables, _, st_def = A.all_tables(cdir + '/LuaConfigs.spec_weapon_step.lua')
        st_root = A.nested_root(st_tables, {'step', 'new_skills', 'max_level', 'replaceSkillDic'}, 2)
        lv_tables, _, lv_def = A.all_tables(cdir + '/LuaConfigs.spec_weapon_level.lua')
        lv_root = A.nested_root(lv_tables, {'level', 'level_attribute', 'cost_nums', 'fragTotal2Level'}, 20)
        arma = {}
        for wid, b in basic.items():
            if not isinstance(b, dict):
                continue
            frag = next((int(i) for i in (b.get('costIdDic') or {}) if 2500 <= int(i) < 2600), None)
            def cost(row, dflt):
                ids = clean(row.get('cost_ids') or dflt.get('cost_ids') or {})
                nums = clean(row.get('cost_nums') if 'cost_nums' in row else dflt.get('cost_nums') or {})
                out = {}
                for j, i in ids.items():
                    n = nums.get(j)
                    if n:
                        i = frag if i == 2502 and frag else i
                        out[str(i)] = n
                return out
            steps = [{'step': sn, 'maxLv': (row.get('max_level') or st_def.get('max_level')), 'cost': cost(row, st_def)}
                     for sn, row in sorted((st_root.get(wid) or {}).items()) if isinstance(row, dict)]
            lm = lv_root.get(wid) or {}
            alv = [{'lv': n, 'cost': cost(lm[n], lv_def) if isinstance(lm.get(n), dict) else {}} for n in range(1, 30)]
            for x in steps + alv:
                used |= set(x['cost'])
            arma[str(b.get('hero_id'))] = {'frag': frag, 'steps': steps, 'levels': alv}
        used |= {'1003', '1006'}
        items = {i: [T(item[int(i)].get('name')), item[int(i)].get('icon') or ''] for i in sorted(used) if isinstance(item.get(int(i)), dict)}
        doc = {'schema': '42lab-growth/0.1', 'lang': lang, 'source': 'configs hero_rank · hero_level · hero_potential · hero_skill_level · item',
               'ranks': ranks, 'levels': levels, 'skills': skills, 'potential': heroes, 'arma': arma, 'items': items, 'fragBase': 1000}
        with open(os.path.join(REPO, 'data', lang, 'growth.json'), 'w', encoding='utf-8') as f:
            json.dump(doc, f, ensure_ascii=False, separators=(',', ':'))
        print(lang, len(ranks), 'ranks', len(levels), 'levels', len(skills), 'skill levels', len(heroes), 'heroes', len(items), 'items')


if __name__ == '__main__':
    main()
