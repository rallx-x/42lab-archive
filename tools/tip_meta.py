"""로딩 팁 분류 · 인형 바로가기 (2026-11-06, data/<언어>/loading_tips.json 고치기)

번호(id)는 게임 공식 번호 그대로 (게임 데이터에 1 · 2 · 40번 없음)
분류 group: wiki 마그라세아 백과사전(제목이 같은 팁 모두) · sector 섹터 · etc 그 외
그 외 세부 sub: corp 기업 · faction 세력 · etc 그 외
dolls: 글에 나오는 인형 [voiceKey, 다른 이름(있으면, 한국어만)]  — 짧은 이름이 낱말에 섞여 잘못 걸린 것은 손으로 뺌
사용: python tools/tip_meta.py
"""
import json, os

DATA = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'data')
# 제목이 「마그라세아 백과사전」인 팁은 모두 wiki (번호는 한국어 데이터 제목으로 정함)
with open(os.path.join(DATA, 'ko', 'loading_tips.json'), encoding='utf-8') as _f:
    WIKI = {t['id'] for t in json.load(_f)['tips'] if t['title'] == '마그라세아 백과사전'}
CORP = {17, 18, 19, 20, 21}          # 42Lab · 스바로그 · UAS · 사이버미디어 · 얼티라이프
FACTION = {22, 23, 24, 67}           # 망명자 · 정화자 · 정화자 · 비호자
DOLLS = {
    3: ['persicaria'], 4: ['anna'], 5: ['simo'], 6: ['sol'], 7: ['croque'], 8: ['evelyn'], 9: ['zion'], 10: ['gin'],
    11: ['fresnel'], 12: ['betty'], 13: ['centaureissi'], 14: ['mai'], 15: ['imhotep'], 16: ['abigail'],
    29: ['turing'], 32: ['eniac'], 49: ['clotho'], 50: ['bonee'], 51: ['kuro'], 52: ['nanaka'], 53: ['aki'],
    54: ['max', 'kuro'], 55: ['willow'], 57: ['lam'], 58: ['chelsea', 'clotho', 'florence'], 59: ['undline'],
    62: ['lind'], 63: ['horizon'], 64: ['eniac'], 65: ['taisch'],
}
ALIAS_KO = {(58, 'clotho'): '헬(클로토)'}

for lang in ['ko', 'ja', 'en', 'tw', 'zh']:
    p = os.path.join(DATA, lang, 'loading_tips.json')
    with open(p, encoding='utf-8') as f:
        d = json.load(f)
    for t in d['tips']:
        i = t['id']
        if i in WIKI:
            t['group'] = 'wiki'
        if t['group'] == 'etc':
            t['sub'] = 'corp' if i in CORP else 'faction' if i in FACTION else 'etc'
        else:
            t.pop('sub', None)
        if i in DOLLS:
            t['dolls'] = [[k, ALIAS_KO[(i, k)]] if lang == 'ko' and (i, k) in ALIAS_KO else [k] for k in DOLLS[i]]
        else:
            t.pop('dolls', None)
    d['groups'] = ['wiki', 'sector', 'etc']
    d['missing'] = [1, 2, 40]
    with open(p, 'w', encoding='utf-8') as f:
        json.dump(d, f, ensure_ascii=False, separators=(',', ':'))
    print(lang, {g: sum(1 for t in d['tips'] if t['group'] == g) for g in d['groups']})
