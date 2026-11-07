"""함수 도감 → data/<언어>/functions.json (2026-11-07)

원본 (서버별)
  - configs chip (함수 2701줄: 대상 표시 markid · 세트 fun_tag · skill_list) · chip_mark (대상 이름 · Corner_* 아이콘)
    · chip_tag (세트 이름 · ICON_tag_buff_* 아이콘) · item (함수 이름 · quality 3/4/5 = 카드 색 파랑/보라/주황 · 카드 그림 icon)
  - tables BattleSkillCfg (함수 스킬: 4 간략 설명 · 5 상세 설명 {0}… · 7~10 수치 공식) — 수치는 skills.py 와 같은 계산기, 레벨 1 값
이름 · 대상(markid) · 설명 틀(숫자를 뺀 글)이 같으면 하나로 합침 (한국어 기준) → 수치만 다른 것은 steps (카드 색 낮은 것부터)
  · 이름이 같아도 효과가 다르면 따로 (적 쪽 효과 · 모드별 다른 함수)
능력치 상승 함수(스킬 설명 없음)는 게임 chip_intro 틀로 설명을 만듦: 「아군 모든 인형의 %s」 + 「최대체력 +8%」 (attribute num_type 2 = %, 값 ÷ 10)
그림: pnc-item fn/<item.icon>.webp (궁극기 그림 *_ultimate 는 skill/)
사용: python functions.py   (skills.py 의 SERVERS 와 같은 곳에서, tables_<서버>/ 필요)
"""
import json, os, re, sys
sys.path.insert(0, '.')
import cfg
from cfg import root
import skills as S
from skills import table_rows, row_dict, packed, evaluate, num

# 모드 (1차, 함수 번호 범위로 — 검수하며 다듬기). 게임에 모드 ↔ 함수 연결 표가 따로 없어서 번호 묶음 + 이름 · 그림으로 판단
MODES = [('normal', '일반', [(7000, 15999)]), ('matrix', '매트릭스', [(90000, 93999)]), ('es', '엔트로픽 서바이버', [(17000, 17999)]),
         ('protocol', '프로토콜', [(20000, 28999), (40000, 40999)]), ('chain', '함수 연쇄', [(30000, 31999)]), ('warchess', '워체스', [(94000, 94999)]),
         ('support', '지원', [(901000, 911999)])]
MODE_NAMES = {'ko': [m[1] for m in MODES] + ['기타'], 'ja': ['通常', 'マトリックス', 'エントロピックサバイバー', 'プロトコル', '関数連鎖', 'ウォーチェス', '支援', 'その他'],
              'en': ['Standard', 'Matrix', 'Entropic Survivor', 'Protocols', 'Function Chain', 'Warchess', 'Support', 'Other'],
              'tw': ['一般', '矩陣', '熵增倖存者', '協議', '函數連鎖', '戰棋', '支援', '其他'], 'zh': ['一般', '矩阵', '熵增幸存者', '协议', '函数连锁', '战棋', '支援', '其他']}


def mode_of(i):
    for key, _, rngs in MODES:
        if any(a <= i <= b for a, b in rngs):
            return key
    return 'etc'


HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.environ.get('REPO') or os.path.join(HERE, '..', '..')


def fill(text, vals):
    def rep(m):
        i = int(m.group(1))
        if i < len(vals) and vals[i] is not None:
            v = vals[i]
            return str(int(v)) if float(v).is_integer() else ('%g' % v)
        return m.group(0)
    return re.sub(r'\{(\d+)\}', rep, text or '')


def server(lang, tag, cdir):
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
    item, _ = root(cdir + '/LuaConfigs.item.lua')
    chip, _ = root(cdir + '/LuaConfigs.chip.lua')
    mark, _ = root(cdir + '/LuaConfigs.chip_mark.lua')
    tagt, _ = root(cdir + '/LuaConfigs.chip_tag.lua')
    intro, _ = root(cdir + '/LuaConfigs.chip_intro.lua')
    attr, _ = root(cdir + '/LuaConfigs.attribute.lua')

    def attr_text(c):
        # 능력치 상승 함수: 게임 chip_intro 틀 (influence · arg) + 능력치 이름 + 값 (num_type 2 = %, 10 으로 나눔)
        ids, ini = c.get('attribute_id'), c.get('attribute_initial')
        if not isinstance(ids, dict) or not ids:
            return ''
        parts = []
        for j in sorted(ids):
            a = attr.get(ids[j]) if isinstance(attr.get(ids[j]), dict) else {}
            v = (ini or {}).get(j, 0) if isinstance(ini, dict) else 0
            pct = a.get('num_type') == 2
            val = v / 10 if pct else v
            vs = str(int(val)) if float(val).is_integer() else '%g' % val
            parts.append('%s +%s%s' % (T(a.get('name')), vs, '%' if pct else ''))
        row = intro.get(c.get('influence')) if isinstance(intro.get(c.get('influence')), dict) else {}
        sub = row.get(c.get('arg') or 0) if isinstance(row.get(c.get('arg') or 0), dict) else {}
        tpl = T(sub.get('intro') or row.get('intro')) or '%s'
        return tpl.replace('%s', ', '.join(parts), 1)

    def text(d, f):
        v = d[f][0][1] if d and f in d else None
        return v.decode('utf-8') if isinstance(v, bytes) else ''

    def vals(d):
        fx = packed(*d[7][0]) if 7 in d else []
        try:
            b1 = packed(*d[8][0]) if 8 in d else []
        except Exception:
            b1 = []
        g2 = packed(*d[9][0]) if 9 in d else []
        l3 = packed(*d[10][0]) if 10 in d else []
        out = []
        for i, fid in enumerate(fx):
            env = {'$1': b1[i] if i < len(b1) else 0, '$2': g2[i] if i < len(g2) else 0, '$3': l3[i] if i < len(l3) else 1, 'L': 1}
            try:
                out.append(num(evaluate(formulas, fid, env)))
            except Exception:
                out.append(None)
        return out

    rows = {}
    for k, c in chip.items():
        if not isinstance(c, dict) or not isinstance(k, int):
            continue
        it = item.get(k) if isinstance(item.get(k), dict) else {}
        nm = T(it.get('name'))
        sl = c.get('skill_list')
        sid = [sl[x] for x in sorted(sl)] if isinstance(sl, dict) else []
        d = sk.get(sid[0]) if sid else None
        if not nm:
            continue
        if d:
            v = vals(d)
            brief, detail = fill(text(d, 4), v), fill(text(d, 5), v)
            raw = text(d, 5) or text(d, 4)
        else:
            brief = detail = raw = ''
        if not (brief or detail):
            brief = detail = attr_text(c)
            raw = re.sub(r'[\d.]+', '#', detail)
        if not (brief or detail):
            continue
        rows[k] = {'id': k, 'name': nm, 'brief': brief, 'detail': detail, 'q': it.get('quality') or 3, 'tpl': re.sub(r'\{\d+\}|[\d.]+', '#', raw),
                   'icon': (('skill/' if (it.get('icon') or '').endswith('_ultimate') else 'fn/') + it['icon']) if it.get('icon') else '', 'mark': c.get('markid') or 0, 'tag': c.get('fun_tag') or 0}
    marks = [[k, T(v.get('name')), v.get('icon') or ''] for k, v in sorted(mark.items()) if isinstance(v, dict)]
    tags = [[k, T(v.get('tag_name')), v.get('tag_icon') or '', v.get('suit_max') or 0] for k, v in sorted(tagt.items()) if isinstance(v, dict) and T(v.get('tag_name'))]
    return rows, marks, tags


def main():
    per = {}
    for lang, tag, cdir in S.SERVERS:
        per[lang] = server(lang, tag, cdir)
    ko = per['ko'][0]
    groups = {}
    for k in sorted(ko):
        groups.setdefault((ko[k]['name'], ko[k]['mark'], ko[k]['tpl']), []).append(k)
    for lang, (rows, marks, tags) in per.items():
        out = []
        for nm, ids in groups.items():
            ids = [i for i in ids if i in rows]
            if not ids:
                continue
            # 단계(카드 색 · 수치만 다름): 카드 색 낮은 것부터, 같은 설명은 하나만
            seen, steps = set(), []
            for i in sorted(ids, key=lambda i: (rows[i]['q'], i)):
                r = rows[i]
                if r['detail'] in seen:
                    continue
                seen.add(r['detail'])
                steps.append({'id': i, 'q': r['q'], 'brief': r['brief'], 'detail': r['detail']})
            head = rows[steps[0]['id']]
            o = {k: v for k, v in head.items() if k != 'tpl'}
            if len(steps) > 1:
                o['steps'] = steps
            o['ids'] = ids
            o['tags'] = sorted({rows[i]['tag'] for i in ids if rows[i]['tag']})
            o['mode'] = mode_of(head['id'])
            out.append(o)
        used_m = {o['mark'] for o in out}
        used_t = {t for o in out for t in o['tags']}
        doc = {'schema': '42lab-functions/0.1', 'lang': lang, 'source': 'configs chip · chip_mark · chip_tag · item + tables BattleSkillCfg (레벨 1 수치)',
               'marks': [m for m in marks if m[0] in used_m], 'tags': [t for t in tags if t[0] in used_t],
               'modes': [[k, n] for k, n in zip([m[0] for m in MODES] + ['etc'], MODE_NAMES[lang]) if any(o['mode'] == k for o in out)], 'functions': out}
        with open(os.path.join(REPO, 'data', lang, 'functions.json'), 'w', encoding='utf-8') as f:
            json.dump(doc, f, ensure_ascii=False, separators=(',', ':'))
        print(lang, len(out), 'functions,', sum(1 for o in out if o.get('steps')), 'with steps,', len(doc['marks']), 'marks,', len(doc['tags']), 'tags')


if __name__ == '__main__':
    main()
