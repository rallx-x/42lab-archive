"""효과 사전 (초록 · 빨간 · 주황 효과 · 인형 고유 효과) → data/<언어>/effects.json (2026-11-07)

원본: 게임 skill_label_info (스킬 설명의 효과 이름을 누르면 나오는 설명, 265개)
  - name · describe · icon(일부만) · icon_color (1 초록 · 2 빨강 · 3 주황 · 0 없음) — 게임 색은 그대로 color 로 둔다
분류 (cats, 한 효과가 여러 탭에 들어갈 수 있음)
  - 모든 효과는 게임 색 탭: 초록 → green · 빨강 → red · 주황 · 없음 → orange
  - unique 인형 고유 효과 탭에도: 인형 1명의 스킬 · 무장각인 글에 「이름」 (낫표로 감싼 고유명사) 으로 나오는 효과 (알고리즘에 나오면 제외)
    (기절 · 밀어냄 같은 일반 효과는 글에 색 글씨로만 나와서 여기 안 들어감, 트로이처럼 발판에서도 생기는 효과는 색 탭 · 고유 탭 둘 다)
  - 손 분류 tools/effects_override.json {"<id>": "field" | ["unique","field"] | "-unique"}: 색 이름이면 색 탭을 바꾸고, 그 밖은 탭을 더함, "-탭" 은 뺌
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
CATS = [['green', '초록 효과'], ['red', '빨간 효과'], ['orange', '주황 효과'], ['unique', '인형 고유 효과'], ['field', '필드 · 발판 효과']]
CAT_NAMES = {'ko': ['초록 효과', '빨간 효과', '주황 효과', '인형 고유 효과', '필드 · 발판 효과'],
             'ja': ['緑の効果', '赤の効果', 'オレンジの効果', '人形固有効果', 'フィールド · 足場効果'],
             'en': ['Green Effects', 'Red Effects', 'Orange Effects', 'Doll-Unique Effects', 'Field · Tile Effects'],
             'tw': ['綠色效果', '紅色效果', '橙色效果', '人形固有效果', '場地 · 地塊效果'], 'zh': ['绿色效果', '红色效果', '橙色效果', '人形固有效果', '场地 · 地块效果']}


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
            cats = ['green' if c == 1 else 'red' if c == 2 else 'orange']
            if len(quoted) == 1 and not algo:
                cats.append('unique')
            ov = over.get(str(i))
            for o in ([ov] if isinstance(ov, str) else ov or []):
                if o.startswith('-'):
                    cats = [x for x in cats if x != o[1:]]
                elif o in ('green', 'red', 'orange'):
                    cats[0] = o
                elif o not in cats:
                    cats.append(o)
            out.append({'id': i, 'name': t['name'], 'desc': t['desc'], 'color': c, 'cats': cats,
                        'icon': icons.get(i, ''), 'dolls': dolls, 'algo': algo})
        doc = {'schema': '42lab-effects/0.2', 'lang': lang, 'source': 'configs skill_label_info + 사이트 데이터에서 쓰이는 곳',
               'cats': [[k, n] for (k, _), n in zip(CATS, CAT_NAMES[lang])], 'effects': out}
        with open(os.path.join(REPO, 'data', lang, 'effects.json'), 'w', encoding='utf-8') as f:
            json.dump(doc, f, ensure_ascii=False, separators=(',', ':'))
        stat[lang] = {k: sum(1 for e in out if k in e['cats']) for k, _ in CATS}
    print(stat)


if __name__ == '__main__':
    main()
