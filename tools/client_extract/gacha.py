"""픽업(지정검색) 로테이션 → data/gacha.json (2026-11-06)

원본: tools/gacha_rotation.tsv (사용자 정리 엑셀: 이벤트명 · 기간 · 메인픽업 · 서브픽업 7)
  - 2주(14일)마다 픽업 2개가 같이 열리고, 13칸(182일)마다 같은 순서로 돈다. 기준: 2026-01-07 05:00 (KST)
  - 픽업 이름은 게임 lottery_para.name (서버별 같은 번호) 에서 5개 언어로, 메인 픽업은 heroUpAllDic 과 맞는지 확인
  - 인형은 data/ko/dolls.json 의 이름으로 heroId 를 찾는다
사용: python gacha.py   (skills.py 의 SERVERS 와 같은 곳에서)
"""
import json, os, re, sys
sys.path.insert(0, '.')
import cfg
from cfg import root
import skills as S

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.join(HERE, '..', '..')
ALIAS = {'드레이시': '드 레이시', '센타우레이시 강익': '센타우레이시 · 강익'}
ANCHOR, DAYS = '2026-01-07', 14


def main():
    dolls = json.load(open(os.path.join(REPO, 'data', 'ko', 'dolls.json'), encoding='utf-8'))['dolls']
    hid = {d['name'].replace(' ', ''): int(d['heroId']) for d in dolls}
    def hero(n):
        n = ALIAS.get(n.strip(), n.strip())
        k = n.replace(' ', '')
        if k not in hid:
            raise SystemExit('인형 이름을 못 찾음: ' + n)
        return hid[k]
    rows = []
    for line in open(os.path.join(REPO, 'tools', 'gacha_rotation.tsv'), encoding='utf-8'):
        if line.startswith('#') or line.startswith('이벤트명'):
            continue
        c = line.rstrip('\n').split('\t')
        if len(c) < 4:
            continue
        rows.append({'name': c[0], 'period': c[1], 'main': hero(c[2]), 'subs': [hero(x) for x in c[3:] if x.strip()]})
    # 한 바퀴 = 처음 이름이 다시 나오기 전까지
    first = rows[0]['name']
    cut = next(i for i, r in enumerate(rows) if i and r['name'] == first)
    rows = rows[:cut]
    # 게임 픽업 번호: 한국 서버 lottery_para 에서 이름 + 메인 픽업이 같은 것 (여럿이면 큰 번호)
    paras = {}
    for lang, tag, cdir in S.SERVERS:
        cfg._loc = None
        os.environ['CFG'] = cdir
        L = cfg.loc()
        r, _ = root(cdir + '/LuaConfigs.lottery_para.lua')
        paras[lang] = {k: (L.get(v.get('name'), '') if isinstance(v.get('name'), int) else (v.get('name') or ''), v) for k, v in r.items() if isinstance(v, dict)}
    out = []
    for r in rows:
        hits = [k for k, (nm, v) in paras['ko'].items() if re.sub(r'\s+', '', nm) == re.sub(r'\s+', '', r['name'])
                and r['main'] in {int(x) for x in (v.get('heroUpAllDic') or {})}]
        if not hits:
            raise SystemExit('게임 픽업을 못 찾음: ' + r['name'])
        lid = max(hits)
        title = {lang: (p.get(lid, ('',))[0] or r['name']) for lang, p in paras.items()}
        bg = paras['ko'][lid][1].get('bg_path') or ''
        out.append({'id': lid, 'title': title, 'main': r['main'], 'subs': r['subs'], 'bg': bg})
    slots = [out[i:i + 2] for i in range(0, len(out), 2)]
    data = {'schema': '42lab-gacha/0.1', 'note': '픽업 로테이션 (사용자 정리 엑셀 + 게임 lottery_para). 기준일부터 days 일마다 다음 칸, 끝나면 처음으로.',
            'anchor': ANCHOR, 'resetHourKst': 5, 'days': DAYS, 'slots': slots}
    with open(os.path.join(REPO, 'data', 'gacha.json'), 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, separators=(',', ':'))
    print(len(slots), 'slots,', len(out), 'pickups')
    for s in slots:
        print(' | '.join('%d %s (%s)' % (p['id'], p['title']['ko'], p['title']['en']) for p in s))


if __name__ == '__main__':
    main()
