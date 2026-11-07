"""지휘 스킬 → data/<언어>/commander.json (2026-11-07)

원본: tables BattleSkillCfg — 지휘 스킬은 그림 이름이 CommanderSkill_1_* (기본 · 변형) · CommanderElfSkill_* (성령 변형) 인 스킬
  - 5011~5199 (기본 · 변형), 8201~8299 (성령 변형). 이름에 buff 가 붙은 내부 스킬 · 같은 이름(번호만 다름)은 뺌
  - 계열 = 이름의 「-」 앞 (일점타격 · 일점타격-처단 · 일점타격-심판 …)
  - 2 이름 · 5 상세 설명 {0}… · 7~10 수치 공식 (skills.py 계산기, 레벨 1~10 · 성령 변형은 1~3) · 17 쿨타임(프레임 ÷ 15)
그림: pnc-item commander/<그림 이름>.webp
사용: python commander.py   (skills.py 의 SERVERS 와 같은 곳에서, tables_<서버>/ 필요)
"""
import json, os, re, sys
sys.path.insert(0, '.')
import skills as S
from skills import table_rows, row_dict, packed, evaluate, num, FPS

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.environ.get('REPO') or os.path.join(HERE, '..', '..')
MAXLV = 10


def main():
    for lang, tag, cdir in S.SERVERS:
        formulas = {}
        for r in table_rows(f'tables_{tag}/BattleFormulaCfg'):
            d = row_dict(r)
            if 2 in d:
                formulas[d[1][0][1]] = d[2][0][1].decode('utf-8')
        sk = {}
        for r in table_rows(f'tables_{tag}/BattleSkillCfg'):
            d = row_dict(r)
            sk[d[1][0][1]] = d
        txt = lambda d, f: d[f][0][1].decode('utf-8') if f in d and isinstance(d[f][0][1], bytes) else ''
        # 한국어 이름으로 고르기 (계열 · 중복) — 번호는 서버 공통
        if lang == 'ko':
            pick, seen = [], set()
            for i in sorted(sk):
                if not (5011 <= i <= 5199 or 8201 <= i <= 8299):
                    continue
                d = sk[i]
                nm, icon = txt(d, 2), txt(d, 11)
                if not nm or 'buff' in nm.lower() or not icon.startswith(('CommanderSkill_1_', 'CommanderElfSkill_')) or nm in seen:
                    continue
                seen.add(nm)
                pick.append((i, nm.split('-')[0].strip()))
        fams = {}
        for i, fam in pick:
            d = sk.get(i)
            if not d:
                continue
            fx = packed(*d[7][0]) if 7 in d else []
            b1 = packed(*d[8][0]) if 8 in d else []
            g2 = packed(*d[9][0]) if 9 in d else []
            l3 = packed(*d[10][0]) if 10 in d else []
            mx = 3 if i >= 8200 else MAXLV  # 성령 변형은 성령 등급 3단계 (게임 간략 설명의 30%/40%/… 세 값)
            vals = []
            for k, fid in enumerate(fx):
                env = {'$1': b1[k] if k < len(b1) else 0, '$2': g2[k] if k < len(g2) else 0, '$3': l3[k] if k < len(l3) else 1}
                row = []
                for lv in range(1, mx + 1):
                    env['L'] = lv
                    try:
                        row.append(num(evaluate(formulas, fid, env)))
                    except Exception:
                        row = None
                        break
                vals.append(row)
            o = {'id': i, 'name': txt(d, 2), 'detail': txt(d, 5) or txt(d, 4), 'vals': vals, 'maxLv': mx,
                 'icon': 'commander/' + txt(d, 11), 'fairy': i >= 8200}
            if isinstance(d.get(17, [[0, None]])[0][1], int):
                o['cd'] = num(d[17][0][1] / FPS)
            fams.setdefault(fam, []).append(o)
        out = [{'key': k, 'name': v[0]['name'].split('-')[0].strip(), 'skills': v} for k, v in fams.items()]
        doc = {'schema': '42lab-commander/0.1', 'lang': lang, 'source': 'tables BattleSkillCfg (CommanderSkill_1_* · CommanderElfSkill_*)', 'families': out}
        with open(os.path.join(REPO, 'data', lang, 'commander.json'), 'w', encoding='utf-8') as f:
            json.dump(doc, f, ensure_ascii=False, separators=(',', ':'))
        print(lang, len(out), 'families', sum(len(x['skills']) for x in out), 'skills')


if __name__ == '__main__':
    main()
