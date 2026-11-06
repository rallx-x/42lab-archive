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

# 알고리즘 설명 (게임 안 도움말을 바탕으로 사이트가 정리 · ko 외는 번역): [제목, 글]
INTRO = {
 'ko': [['알고리즘', '인형의 연산 효율을 높여 작전 능력을 올려 주는 연산용 플러그인이에요. 인형마다 알고리즘 슬롯이 있고, 알고리즘을 꽂으면 그 능력치가 올라가요.'],
        ['구역', '공격성 · 안정성 · 특이성 세 구역이 있고, 구역마다 맞는 알고리즘만 장착할 수 있어요.'],
        ['칸 · 등급', '알고리즘마다 차지하는 칸(1칸 · 2칸)이 달라요. 2칸은 슬롯을 두 칸 쓰는 대신 능력치가 더 높아요. 등급은 파랑 · 보라 · 주황이에요.'],
        ['세트', '일부 보라 · 주황 알고리즘은 세트예요. 같은 세트를 2개 · 3개 장착하면 2세트 · 3세트 효과를 받아요. 이름 뒤 숫자(-1 · -2 · -3)는 조각 번호라, 3세트 효과를 받으려면 서로 다른 조각 3개가 필요해요.'],
        ['주요 수치', '알고리즘이 핵심적으로 올려 주는 능력치예요. 알고리즘 효율의 영향을 받아요.'],
        ['부가 수치', '품질(회색 · 파랑 · 보라 · 주황) 차이가 있고, 알고리즘 효율의 영향을 받지 않아요. 재구성하면 부가 수치의 종류와 품질이 무작위로 바뀌어요.']],
 'ja': [['アルゴリズム', '人形の演算効率を高めて作戦能力を上げる演算用プラグインです。人形ごとにアルゴリズムスロットがあり、アルゴリズムを挿すとそのステータスが上がります。'],
        ['エリア', '攻撃性 · 安定性 · 特異性の3エリアがあり、エリアに合ったアルゴリズムのみ装備できます。'],
        ['マス · レア度', 'アルゴリズムごとに占めるマス（1マス · 2マス）が異なります。2マスはスロットを2つ使う代わりにステータスが高くなります。レア度は青 · 紫 · 橙です。'],
        ['セット', '一部の紫 · 橙アルゴリズムはセットです。同じセットを2つ · 3つ装備すると2セット · 3セット効果が得られます。名前の後の数字（-1 · -2 · -3）はパーツ番号で、3セット効果には異なるパーツが3つ必要です。'],
        ['メインステータス', 'アルゴリズムが主に上げるステータスです。アルゴリズム効率の影響を受けます。'],
        ['サブステータス', '品質（灰 · 青 · 紫 · 橙）の差があり、アルゴリズム効率の影響は受けません。再構成するとサブステータスの種類と品質がランダムに変わります。']],
 'en': [['Algorithms', 'Computing plug-ins that raise a Doll\'s computing efficiency and combat ability. Each Doll has algorithm slots, and inserting an algorithm raises its stats.'],
        ['Areas', 'There are three areas: Offense, Stability and Special. Each area only accepts its own algorithms.'],
        ['Slots · rarity', 'Algorithms take up different space (1 or 2 slots). 2-slot algorithms use two slots but give higher stats. Rarities are blue, purple and orange.'],
        ['Sets', 'Some purple and orange algorithms belong to sets. Equipping 2 or 3 of the same set grants the 2-piece or 3-piece effect. The number after the name (-1, -2, -3) is the piece number; the 3-piece effect needs three different pieces.'],
        ['Main stat', 'The stat an algorithm mainly raises. It is affected by algorithm efficiency.'],
        ['Sub stats', 'They come in grades (gray, blue, purple, orange) and are not affected by algorithm efficiency. Rebuilding re-rolls their type and grade.']],
 'tw': [['演算法', '提升人形演算效率、增強作戰能力的演算用插件。每個人形都有演算法槽，插入演算法即可提升對應屬性。'],
        ['區域', '分為攻擊性 · 穩定性 · 特異性三個區域，各區域只能裝備對應的演算法。'],
        ['格數 · 稀有度', '每種演算法佔用的格數（1格 · 2格）不同。2格佔用兩個槽位，但屬性更高。稀有度分為藍 · 紫 · 橙。'],
        ['套裝', '部分紫 · 橙演算法屬於套裝，裝備同套裝2件 · 3件可獲得2件套 · 3件套效果。名稱後的數字（-1 · -2 · -3）是部件編號，3件套效果需要3個不同部件。'],
        ['主要屬性', '演算法主要提升的屬性，受演算法效率影響。'],
        ['附加屬性', '有品質（灰 · 藍 · 紫 · 橙）差異，不受演算法效率影響。重構後附加屬性的種類與品質會隨機改變。']],
 'zh': [['算法', '提升人形演算效率、增强作战能力的演算用插件。每个人形都有算法槽，插入算法即可提升对应属性。'],
        ['区域', '分为攻击性 · 稳定性 · 特异性三个区域，各区域只能装备对应的算法。'],
        ['格数 · 稀有度', '每种算法占用的格数（1格 · 2格）不同。2格占用两个槽位，但属性更高。稀有度分为蓝 · 紫 · 橙。'],
        ['套装', '部分紫 · 橙算法属于套装，装备同套装2件 · 3件可获得2件套 · 3件套效果。名称后的数字（-1 · -2 · -3）是部件编号，3件套效果需要3个不同部件。'],
        ['主要属性', '算法主要提升的属性，受算法效率影响。'],
        ['附加属性', '有品质（灰 · 蓝 · 紫 · 橙）差异，不受算法效率影响。重构后附加属性的种类与品质会随机改变。']],
}
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
        # 능력치 표: attribute num_type 1 = 고정값, 2 = 퍼센트(값/10)
        att, adef = root(cdir + '/LuaConfigs.attribute.lua')
        aname = lambda i: T(att[i]['name']) if isinstance(att.get(i), dict) else str(i)
        isp = lambda i: isinstance(att.get(i), dict) and {**adef, **att[i]}.get('num_type') == 2
        fmt = lambda i, v: (('%g' % (v / 10)) + '%') if isp(i) else str(v)
        # 주요 수치: ath_attribute_pool 1~88 이 등급 → 구역 → 칸 순서로 놓여 있음
        pool, pdef = root(cdir + '/LuaConfigs.ath_attribute_pool.lua')
        BLOCKS = []
        for q, base in (('b', 0), ('p', 22)):
            for a, (s1, n1, s2, n2) in zip('123', ((1, 4, 5, 4), (9, 4, 13, 4), (17, 3, 20, 3))):
                BLOCKS += [(q, a, '1', base + s1, n1), (q, a, '2', base + s2, n2)]
        for a, (s1, n1) in zip('123', ((45, 8), (53, 7), (60, 7))):
            BLOCKS += [('o', a, '1', s1, n1), ('o', a, '2', s1 + 22, n1)]
        main = {}
        for q, a, size, start, n in BLOCKS:
            for pid in range(start, start + n):
                m = {**pdef, **pool.get(pid, {})}
                aid, val = list(m['attrtibute_id'].values())[0], list(m['attrtibute_num'].values())[0]
                key = aname(aid) + ('%' if isp(aid) else '')
                row = main.setdefault(a, {}).setdefault(key, {'stat': aname(aid), 'pct': isp(aid)})
                row[q + size] = fmt(aid, val)
        # 부가 수치: ath_affix_pool pool 1 · 2 · 3 = 공격성 · 안정성 · 특이성 (값 1~4 = 회색 · 파랑 · 보라 · 주황)
        afx, xdef = root(cdir + '/LuaConfigs.ath_affix_pool.lua')
        sub = {}
        for k, v in sorted((k, v) for k, v in afx.items() if isinstance(v, dict)):
            m = {**xdef, **v}
            if m['pool_id'] not in (1, 2, 3):
                continue
            aid = m['affix_para']
            sub.setdefault(str(m['pool_id']), []).append({'stat': aname(aid), 'pct': isp(aid), 'v': [fmt(aid, m['attribute_num'][g]) for g in (1, 2, 3, 4)]})
        docs[lang] = {'schema': '42lab-algorithms/0.1', 'lang': lang, 'areas': areas, 'intro': INTRO[lang],
                      'main': {a: list(r.values()) for a, r in main.items()}, 'sub': sub,
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
