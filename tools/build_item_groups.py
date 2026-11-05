#!/usr/bin/env python3
"""아이템 탭 · 묶음 (data/<언어>/items.json 에 "tab" · "grp", 그리고 "groups")

한국어 아이템 이름을 기준으로 정하고, 같은 아이템 번호에 5개 언어 모두 똑같이 넣음.

탭 (tab)
  2 기본 아이템 · 3 소모 아이템 · 8 알고리즘 · 9 돌파 위젯 · 5 육성재료 · 6 공장재료 · 7 기념품 · 10 이벤트 보상
  - 알고리즘: 이름에 「알고리즘」, 또는 구성품이 모두 「○○-1」 꼴(세트 알고리즘 상자)
  - 돌파 위젯: 이름에 「돌파 위젯」
  - 이벤트 보상: 획득처에 「○○」 이벤트 (위 둘이 아닐 때)
묶음 (grp) — 같은 탭 안에서 폴더 하나로
  - wbox:<등급>  돌파 위젯 선택박스 (기본 · (중) · (소))
  - widget:<등급> 돌파 위젯 (클래스 5종)
  - key / search / retrain  인증키 · 검색 지령 · 재훈련 허가증
  - same:<번호>  이름 · 아이콘이 같은 아이템 (카드 하나로 합침)
  - ev:<번호>   이벤트 보상 탭의 이벤트별 폴더 (제목 = 그 언어 획득처의 첫 「」/[] 안)

사용: python3 tools/build_item_groups.py   (items.py · build_gift_links.py 다음에)
"""
import json, os, re
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
LANGS = ['ko', 'ja', 'en', 'tw', 'zh']
TITLES = {  # 직접 정한 묶음 제목 (게임 표기 기준으로 짧게)
    'key':     ['인증키', '認証キー', 'Keycards', '認證金鑰', '认证密钥'],
    'search':  ['검색 지령', '検索指令', 'Search Commands', '檢索指令', '检索指令'],
    'retrain': ['재훈련 허가증', '再訓練許可証', 'Retraining Permits', '重訓許可證', '重训许可证'],
}
GRADES = ['간이', '표준', '고급', '특급', '첨단', '극한']


def load(p):
    with open(p, encoding='utf-8') as f:
        return json.load(f)


def ev_name(src):
    m = re.search(r'「([^」]+)」|\[([^\]]+)\]|“([^”]+)”|"([^"]+)"', src or '')
    return next((g for g in (m.groups() if m else ()) if g), None)


def main():
    ko = load(os.path.join(ROOT, 'data', 'ko', 'items.json'))
    refs = {int(k): v for k, v in ko['refs'].items()}
    byid = {o['id']: o for o in ko['items']}
    nm = lambda i: (byid.get(i) or refs.get(i) or {}).get('name', '')
    tab, grp, evkey = {}, {}, {}
    for o in ko['items']:
        n, src = o['name'], o.get('source') or ''
        cont = o.get('contents') or []
        if '알고리즘' in n or (cont and all(re.search(r'-\d+$', nm(i)) for i, _ in cont)):
            t = 8
        elif '돌파 위젯' in n:
            t = 9
        elif re.search(r'「[^」]+」\s*이벤트', src):
            t = 10
        else:
            t = o['page']
        tab[o['id']] = t
        g = None
        m = re.match(r'(\S+) 돌파 위젯 선택 ?박스', n)
        if m and m.group(1) in GRADES:
            g = 'wbox:' + m.group(1)
        elif re.match(r'(\S+) 돌파 위젯·', n) and n.split(' ')[0] in GRADES:
            g = 'widget:' + n.split(' ')[0]
        elif '인증키' in n:
            g = 'key'
        elif n.endswith('검색 지령'):
            g = 'search'
        elif n.endswith('재훈련 허가증'):
            g = 'retrain'
        if g:
            grp[o['id']] = g
    # 이름 · 아이콘이 같은 아이템 (같은 탭 · 아직 묶음 없음)
    same = {}
    for o in ko['items']:
        if o['id'] in grp:
            continue
        same.setdefault((tab[o['id']], o['name'], o['icon']), []).append(o['id'])
    for (t, _, _), ids in same.items():
        if len(ids) > 1:
            for i in ids:
                grp[i] = 'same:' + str(min(ids))
    # 이벤트 보상: 이벤트별 폴더 (한국어 이벤트 이름이 같으면 같은 폴더)
    evs = {}
    for o in ko['items']:
        if tab[o['id']] == 10 and o['id'] not in grp:
            e = ev_name(o.get('source'))
            evs.setdefault(e, []).append(o['id'])
    for e, ids in evs.items():
        for i in ids:
            grp[i] = 'ev:' + str(min(ids))
            evkey[i] = True
    stats = {}
    for li, lang in enumerate(LANGS):
        path = os.path.join(ROOT, 'data', lang, 'items.json')
        d = load(path)
        items = {o['id']: o for o in d['items']}
        groups = {}
        for o in d['items']:
            o['tab'] = tab.get(o['id'], o['page'])
            g = grp.get(o['id'])
            if g:
                o['grp'] = g
            else:
                o.pop('grp', None)
        members = {}
        for o in d['items']:
            if o.get('grp'):
                members.setdefault(o['grp'], []).append(o)
        for g, ms in members.items():
            kind = g.split(':')[0]
            if kind in TITLES:
                title = TITLES[kind][li]
            elif kind == 'wbox':
                title = min((m['name'] for m in ms), key=len)
            elif kind == 'widget':
                a = [m['name'] for m in ms]
                p = os.path.commonprefix(a).rstrip(' ·-–—・')
                title = p or a[0]
            elif kind == 'same':
                title = ms[0]['name']
            else:  # ev
                title = ev_name(ms[0].get('source')) or ms[0].get('source') or ''
            groups[g] = {'title': title, 'kind': 'merge' if kind == 'same' else 'event' if kind == 'ev' else 'folder'}
        d['groups'] = groups
        d['tabs'] = [2, 3, 8, 9, 5, 6, 7, 10]
        with open(path, 'w', encoding='utf-8') as f:
            json.dump(d, f, ensure_ascii=False, separators=(',', ':'))
        stats[lang] = (len(groups), sum(1 for o in d['items'] if o['tab'] == 10))
    print(stats)


if __name__ == '__main__':
    main()
