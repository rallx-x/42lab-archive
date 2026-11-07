"""효과 사전 (버프 · 디버프 · 고유 효과) → data/<언어>/effects.json (2026-11-07)

원본: 게임 skill_label_info (스킬 설명의 효과 이름을 누르면 나오는 설명, 265개)
  - name · describe · icon(일부만) · icon_color (1 초록 · 2 빨강 · 3 주황 · 0 없음) — 게임 색은 그대로 color 로 둔다
1차 분류 (cat)
  - unique 고유 효과 : 인형 1명의 스킬 · 무장각인 글에만 「이름」 (낫표로 감싼 고유명사) 으로 나오는 효과 (알고리즘에 나오면 제외)
    (기절 · 밀어냄 같은 일반 효과는 글에 색 글씨로만 나와서 여기 안 들어감)
  - 그 밖은 게임 색대로: 초록 → buff · 빨강 → debuff · 주황 · 없음 → unique
  - 손으로 옮긴 것은 tools/effects_override.json {"<id>": "buff|debuff|unique"} 이 이김
쓰이는 곳: 한국어 사이트 데이터(skills · arma · algorithms)에서 효과 이름이 글에 들어 있는지로 찾음 (게임도 글 속 단어로 찾음)
사용: python effects.py   (skills.py 의 SERVERS 와 같은 곳에서)
"""
import json, os, re, sys
sys.path.insert(0, '.')
import cfg
from cfg import root
import skills as S

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.environ.get('REPO') or os.path.join(HERE, '..', '..')
CATS = [['buff', '버프'], ['debuff', '디버프'], ['unique', '고유 효과']]
CAT_NAMES = {'ko': ['버프', '디버프', '고유 효과'], 'ja': ['バフ', 'デバフ', '固有効果'], 'en': ['Buffs', 'Debuffs', 'Unique Effects'],
             'tw': ['增益', '減益', '固有效果'], 'zh': ['增益', '减益', '固有效果']}


def load(p):
    with open(p, encoding='utf-8') as f:
        return json.load(f)


def main():
    strip = lambda s: re.sub(r'<[^>]+>', '', s or '')
    sk = load(os.path.join(REPO, 'data', 'ko', 'skills.json'))
    heroes = sk.get('heroes') or {}
    texts = []
    for hid, arr in heroes.items():
        for s in arr:
            texts.append(('doll', int(hid), strip(s.get('brief')) + ' ' + strip(s.get('detail'))))
    for hid, a in load(os.path.join(REPO, 'data', 'ko', 'arma.json')).get('heroes', {}).items():
        texts.append(('doll', int(hid), strip(json.dumps(a, ensure_ascii=False))))
    for s in load(os.path.join(REPO, 'data', 'ko', 'algorithms.json')).get('sets', []):
        texts.append(('algo', 0, strip(json.dumps(s, ensure_ascii=False))))
    over_p = os.path.join(REPO, 'tools', 'effects_override.json')
    over = load(over_p) if os.path.exists(over_p) else {}
    over = {str(k): v for k, v in over.items() if not str(k).startswith('_')}
    ko_terms = {t['id']: t for t in sk.get('terms', [])}
    use = {}
    for i, t in ko_terms.items():
        n = t['name']
        hits = [(k, h) for k, h, tx in texts if n and n in tx]
        quoted = {h for k, h, tx in texts if k == 'doll' and n and '「' + n + '」' in tx}
        use[i] = (sorted({h for k, h in hits if k == 'doll'}), any(k == 'algo' for k, _ in hits), sorted(quoted))
    # 아이콘은 configs 에만 (한국 서버)
    lab, _ = root('out/configs/LuaConfigs.skill_label_info.lua')
    icons = {k: v.get('icon') or '' for k, v in lab.items() if isinstance(v, dict)}
    stat = {}
    for lang, tag, cdir in S.SERVERS:
        d = load(os.path.join(REPO, 'data', lang, 'skills.json'))
        out = []
        for t in d.get('terms', []):
            i = t['id']
            dolls, algo, quoted = use.get(i, ([], False, []))
            c = t.get('color', 0)
            if str(i) in over:
                cat = over[str(i)]
            elif len(quoted) == 1 and not algo:
                cat = 'unique'
            else:
                cat = 'buff' if c == 1 else 'debuff' if c == 2 else 'unique'
            out.append({'id': i, 'name': t['name'], 'desc': t['desc'], 'color': c, 'cat': cat,
                        'icon': icons.get(i, ''), 'dolls': dolls, 'algo': algo})
        doc = {'schema': '42lab-effects/0.1', 'lang': lang, 'source': 'configs skill_label_info + 사이트 데이터에서 쓰이는 곳',
               'cats': [[k, n] for (k, _), n in zip(CATS, CAT_NAMES[lang])], 'effects': out}
        with open(os.path.join(REPO, 'data', lang, 'effects.json'), 'w', encoding='utf-8') as f:
            json.dump(doc, f, ensure_ascii=False, separators=(',', ':'))
        stat[lang] = {k: sum(1 for e in out if e['cat'] == k) for k, _ in CATS}
    print(stat)


if __name__ == '__main__':
    main()
