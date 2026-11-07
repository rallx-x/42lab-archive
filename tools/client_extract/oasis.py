"""오아시스 건축 · 가공소 → data/<언어>/oasis.json (2026-11-07)

원본 (configs, 서버별)
  - oasis_building        건물 106개: 이름 · 영문 · 짧은/긴 설명 · 기업 · 그림 (OasisBuliding_* = 오아시스 14 · SectorBuilding_* = 섹터 92)
  - oasis_building_level  건물마다 레벨 줄 (arma.py 의 nested_root 로 읽음): 강화 재료 consumeIds/Nums · 효과 custom_logic → tip_language 글
                          · 조건 pre_condition (3 = 메인 스토리 클리어, para1 = story_avg 번호 · 4 = 다른 건물 레벨, para1 = 건물 · para2 = 레벨 · 1 = 의식 레벨)
  - story_condition_text  조건 글 틀 (예 「메인 스토리 %s 클리어」)
  - factory · factory_order  가공소 · 가공 목록: 만드는 물건 · 개수 · 시간 · 재료(raw_material) · 조건
사용: python oasis.py   (skills.py 의 SERVERS 와 같은 곳에서)
"""
import json, os, sys
sys.path.insert(0, '.')
import cfg
from cfg import root
from vm import run, clean
import skills as S
import arma as A

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.environ.get('REPO') or os.path.join(HERE, '..', '..')


def main():
    for lang, tag, cdir in S.SERVERS:
        cfg._loc = None
        os.environ['CFG'] = cdir
        L = cfg.loc()
        T = lambda v: (L.get(v, '') if isinstance(v, int) else (v or ''))
        G = lambda t: root(cdir + '/LuaConfigs.%s.lua' % t)[0]
        item, bld, story, tip, sct = G('item'), G('oasis_building'), G('story_avg'), G('tip_language'), G('story_condition_text')
        used = set()
        ctext = {k: T(v.get('condition_text')) for k, v in sct.items() if isinstance(v, dict)}

        def cond(pc, p1, p2):
            out = []
            for j in sorted(pc):
                t, a, b = pc[j], p1.get(j), p2.get(j)
                if t == 3:
                    s = story.get(a) if isinstance(story.get(a), dict) else {}
                    nm = T(s.get('name'))
                    lab = ('%d-%d 「%s」' % (a // 1000, a % 100, nm) if a < 100000 else '「%s」' % nm) if nm else ('%d-%d' % (a // 1000, a % 100) if a and a < 100000 else '#%s' % a)
                    out.append((ctext.get(3) or '%s').replace('%s', lab))
                elif t == 4:
                    bb = bld.get(a) if isinstance(bld.get(a), dict) else {}
                    out.append('「%s」 Lv.%s' % (T(bb.get('name')), b))
                elif t == 1:
                    out.append((ctext.get(1) or '%s').replace('%s', str(a)))
                elif t in ctext:
                    out.append(ctext[t].replace('%s', str(a)))
            return out

        tabs, _, dflt = A.all_tables(cdir + '/LuaConfigs.oasis_building_level.lua')
        lv_root = A.nested_root(tabs, {'consumeIds', 'consumeNums', 'logic', 'modol'}, 5)
        buildings = []
        for bid in sorted(x for x in bld if isinstance(x, int)):
            b = bld[bid]
            levels = []
            for lv, row in sorted((lv_root.get(bid) or {}).items()):
                if not isinstance(row, dict):
                    continue
                g = lambda f: clean(row[f]) if f in row else clean(dflt.get(f))
                ids, nums = g('consumeIds') or {}, g('consumeNums') or {}
                cost = {str(i): nums.get(j) for j, i in ids.items() if nums.get(j)}
                used.update(cost)
                # 효과 글: 그 줄에 직접 적힌 custom_logic 만 (기본값으로 물려받은 글은 레벨마다 같아서 뺌)
                eff = [T(tip[c].get('content')) for c in (clean(row['custom_logic']) if 'custom_logic' in row else {}).values() if isinstance(tip.get(c), dict)]
                # 레벨 수치: logic(4 생산 · 28 보관 상한 · 3 그 밖, 추정) · para1 아이템 · para2 값
                lg, pa, pb = g('logic') or {}, g('para1') or {}, g('para2') or {}
                vals = [{'logic': lg[j], 'item': str(pa.get(j)), 'val': pb.get(j)} for j in sorted(lg) if pa.get(j) is not None]
                used.update(v['item'] for v in vals)
                need = cond(g('pre_condition') or {}, g('pre_para1') or {}, g('pre_para2') or {})
                levels.append({'lv': lv, 'cost': cost, 'effect': [e for e in eff if e], 'vals': vals, 'need': need})
            icon = b.get('icon_res') or ''
            buildings.append({'id': bid, 'name': T(b.get('name')), 'en': b.get('name_en') or '', 'intro': T(b.get('intro')), 'long': T(b.get('intro_long')),
                              'company': b.get('enterprise') or '', 'kind': 'oasis' if icon.startswith('OasisBul') else 'sector',
                              'icon': icon, 'small': b.get('small_icon') or '', 'levels': levels})
        fac, fdef = run(cdir + '/LuaConfigs.factory.lua')
        fo, odef = run(cdir + '/LuaConfigs.factory_order.lua')
        mg = lambda row, d, f: clean(row[f]) if f in row else clean(d.get(f))
        factories = []
        for k in sorted(x for x in fac if isinstance(x, int)):
            r = fac[k]
            intro = T(mg(r, fdef, 'intro'))
            factories.append({'id': k, 'name': T(mg(r, fdef, 'name')), 'intro': '' if '描述' in intro else intro, 'model': mg(r, fdef, 'model'),
                              'need': cond(mg(r, fdef, 'pre_condition') or {}, mg(r, fdef, 'pre_para1') or {}, mg(r, fdef, 'pre_para2') or {})})
        orders = []
        for k in sorted(x for x in fo if isinstance(x, int)):
            r = fo[k]
            out_id, out_n = mg(r, odef, 'outPutItemId'), mg(r, odef, 'outPutItemNum')
            mats = mg(r, odef, 'raw_material') or {}
            mats = {str(a): b for a, b in mats.items()} if isinstance(mats, dict) else {}
            used.update(mats)
            used.add(str(out_id))
            orders.append({'id': k, 'name': T(mg(r, odef, 'name')), 'type': mg(r, odef, 'type'), 'out': str(out_id), 'num': out_n,
                           'time': mg(r, odef, 'time_cost'), 'mats': mats,
                           'need': cond(mg(r, odef, 'pre_condition') or {}, mg(r, odef, 'pre_para1') or {}, mg(r, odef, 'pre_para2') or {})})
        items = {i: [T(item[int(i)].get('name')), item[int(i)].get('icon') or ''] for i in sorted(used) if i.isdigit() and isinstance(item.get(int(i)), dict)}
        doc = {'schema': '42lab-oasis/0.1', 'lang': lang, 'source': 'configs oasis_building · oasis_building_level · tip_language · story_condition_text · factory · factory_order · item',
               'buildings': buildings, 'factories': factories, 'orders': orders, 'items': items}
        with open(os.path.join(REPO, 'data', lang, 'oasis.json'), 'w', encoding='utf-8') as f:
            json.dump(doc, f, ensure_ascii=False, separators=(',', ':'))
        print(lang, len(buildings), 'buildings', sum(len(b['levels']) for b in buildings), 'levels', len(factories), 'factories', len(orders), 'orders')


if __name__ == '__main__':
    main()
