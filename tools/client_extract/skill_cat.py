"""스킬 아이콘 색 분류(BattleSkillCfg 12번 칸)를 skills.json · arma.json 에 넣기 (2026-11-05)

12번 칸 = 아이콘 육각 바탕 색: 1 공격(빨강) · 2 치료(초록) · 3 보호(파랑) · 4 보조(노랑)
  확인: 수에요이 1·1·1 (게임 화면 빨강), 크로크 2·3·1 (치료 · 보호막 · 공격), 초코 2·2·2
사용: python skill_cat.py   (tables_cn/BattleSkillCfg 가 있는 곳에서, skills.py 와 같이)
"""
import json, os, sys
sys.path.insert(0, '.')
import skills as S

DATA = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'data')


def main():
    cat = {}
    for r in S.table_rows('tables_cn/BattleSkillCfg'):
        d = S.row_dict(r)
        v = d.get(12, [[0, None]])[0][1]
        if isinstance(v, int):
            cat[d[1][0][1]] = v
    for lang in ['ko', 'ja', 'en', 'tw', 'zh']:
        for name in ('skills.json', 'arma.json'):
            p = os.path.join(DATA, lang, name)
            with open(p, encoding='utf-8') as f:
                doc = json.load(f)
            n = 0
            for h in doc['heroes'].values():
                lst = h if name == 'skills.json' else [st['skill'] for st in h.get('steps', [])]
                for s in lst:
                    c = cat.get(s.get('id'))
                    if c:
                        s['cat'] = c
                        n += 1
            with open(p, 'w', encoding='utf-8') as f:
                json.dump(doc, f, ensure_ascii=False, separators=(',', ':'))
            print(lang, name, n)


if __name__ == '__main__':
    main()
