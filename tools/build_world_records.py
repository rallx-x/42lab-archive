#!/usr/bin/env python3
"""세계기록 목록 파일(data/<언어>/world_records.json) 다시 만들기 (2026-11-05)

- 한국어 world_records.json 을 번호 · 분류의 기준으로 씀
- 각 언어 에피소드 파일(data/<언어>/episodes/*.json)의 worldRecords = 그 서버 원문 → 우선
- 원문이 없는 번호는 한국어로 채우고 "src":"ko" 표시 (화면에 「한국어 원문」 꼬리표)
- 클라이언트에서 세계기록 표를 받으면 CLIENT 칸에 넣어 다시 돌리면 됨 (클라이언트 값이 최우선)

사용: python3 tools/build_world_records.py
"""
import json, glob, os, sys

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
LANGS = ['ko', 'ja', 'en', 'tw', 'zh']
# 분류 이름 〔미확정: 서버별 공식 표기는 클라이언트에서 확인 후 교체〕
TYPE_NAMES = {
    'ko': ['전체', '세계관', '개념', '인물', '사건', '지점', '세력', '시계기록'],
    'ja': ['すべて', '世界観', '概念', '人物', '事件', '地点', '勢力', '時計記録'],
    'en': ['All', 'Worldview', 'Concept', 'Character', 'Event', 'Location', 'Faction', 'Clock Records'],
    'tw': ['全部', '世界觀', '概念', '人物', '事件', '地點', '勢力', '時計記錄'],
    'zh': ['全部', '世界观', '概念', '人物', '事件', '地点', '势力', '时计记录'],
}
# 클라이언트 추출본 (있으면): tools/client/world_records_<언어>.json = {"<id>": {"name","description","type"}}
CLIENT = os.path.join(ROOT, 'tools', 'client')

def load(p):
    with open(p, encoding='utf-8') as f:
        return json.load(f)

def main():
    base = load(os.path.join(ROOT, 'data', 'ko', 'world_records.json'))
    ko = {r['id']: r for r in base['records']}
    for lang in LANGS:
        found = {}
        for f in sorted(glob.glob(os.path.join(ROOT, 'data', lang, 'episodes', '*.json'))):
            for k, v in (load(f).get('worldRecords') or {}).items():
                if v.get('name'):
                    found[int(k)] = v
        cp = os.path.join(CLIENT, f'world_records_{lang}.json')
        client = {int(k): v for k, v in load(cp).items()} if os.path.exists(cp) else {}
        ids = sorted(set(ko) | set(client))
        out, fb = [], 0
        for i in ids:
            src = client.get(i) or found.get(i) or (ko[i] if lang == 'ko' else None)
            rec = {'id': i, 'name': '', 'type': (client.get(i) or {}).get('type') or ko.get(i, {}).get('type', 0), 'description': ''}
            if src:
                rec['name'], rec['description'] = src['name'], src.get('description', '')
            else:
                rec['name'], rec['description'], rec['src'] = ko[i]['name'], ko[i]['description'], 'ko'
                fb += 1
            out.append(rec)
        doc = {
            'schema': '42lab-worldrecords/0.2',
            'lang': lang,
            'types': [{'id': n, 'name': s} for n, s in enumerate(TYPE_NAMES[lang])],
            'records': out,
        }
        with open(os.path.join(ROOT, 'data', lang, 'world_records.json'), 'w', encoding='utf-8') as f:
            json.dump(doc, f, ensure_ascii=False, separators=(',', ':'))
        print(f'{lang}: {len(out)}개 (원문 {len(out) - fb} · 한국어로 채움 {fb}) · 클라이언트 {len(client)}')

if __name__ == '__main__':
    sys.exit(main())
