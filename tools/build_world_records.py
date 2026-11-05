#!/usr/bin/env python3
"""세계기록 목록 파일(data/<언어>/world_records.json) 다시 만들기

- 클라이언트 추출본이 최우선 (2026-11-05: 5개 서버 configs.ab 의 noun_des · noun_des_type · locale_text)
  추출본 형식: <폴더>/world_records_<언어>.json = {"types":[{"id","name"}], "records":{"<id>":{"name","type","description"}}}
- 추출본이 없으면: 한국어 world_records.json 을 기준으로, 각 언어 에피소드 속 worldRecords 원문을 쓰고
  그래도 없는 번호는 한국어로 채워 "src":"ko" 표시 (화면에 「한국어 원문」 꼬리표)

사용: python3 tools/build_world_records.py [클라이언트 추출본 폴더]
"""
import json, glob, os, sys

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
LANGS = ['ko', 'ja', 'en', 'tw', 'zh']


def load(p):
    with open(p, encoding='utf-8') as f:
        return json.load(f)


def main():
    client_dir = sys.argv[1] if len(sys.argv) > 1 else None
    base = load(os.path.join(ROOT, 'data', 'ko', 'world_records.json'))
    ko = {r['id']: r for r in base['records']}
    for lang in LANGS:
        path = os.path.join(ROOT, 'data', lang, 'world_records.json')
        old = load(path)
        cp = client_dir and os.path.join(client_dir, f'world_records_{lang}.json')
        client = load(cp) if cp and os.path.exists(cp) else {}
        crec = {int(k): v for k, v in (client.get('records') or {}).items()}
        found = {}
        for f in sorted(glob.glob(os.path.join(ROOT, 'data', lang, 'episodes', '*.json'))):
            for k, v in (load(f).get('worldRecords') or {}).items():
                if v.get('name'):
                    found[int(k)] = v
        out, fb = [], 0
        for i in sorted(set(ko) | set(crec)):
            src = crec.get(i) or found.get(i) or (ko[i] if lang == 'ko' else None)
            rec = {'id': i, 'name': '', 'type': (crec.get(i) or ko.get(i) or {}).get('type', 0), 'description': ''}
            if src:
                rec['name'], rec['description'] = src['name'], src.get('description', '')
            else:
                rec['name'], rec['description'], rec['src'] = ko[i]['name'], ko[i]['description'], 'ko'
                fb += 1
            out.append(rec)
        doc = {
            'schema': '42lab-worldrecords/0.2',
            'lang': lang,
            'types': client.get('types') or old['types'],
            'records': out,
        }
        with open(path, 'w', encoding='utf-8') as f:
            json.dump(doc, f, ensure_ascii=False, separators=(',', ':'))
        print(f'{lang}: {len(out)}개 (클라이언트 {len(crec)} · 한국어로 채움 {fb})')


if __name__ == '__main__':
    sys.exit(main())
