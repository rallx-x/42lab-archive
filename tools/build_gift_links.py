#!/usr/bin/env python3
"""인형 ↔ 선물 아이템 연결 (data/<언어>/items.json 의 "gifts")

- 한국어 프로필(data/ko/profiles/*.json)의 likes · dislikes 이름을 한국어 아이템 이름과 맞춰 아이템 번호로 바꿈
- 선물 취향은 서버마다 같으므로 같은 번호를 5개 언어 items.json 에 넣음
  "gifts": {"byDoll": {"<voiceKey>": [[좋아함 번호…], [싫어함 번호…]]}}
- items.json 을 다시 만들었으면 이 스크립트도 다시 돌릴 것

사용: python3 tools/build_gift_links.py
"""
import json, glob, os
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
LANGS = ['ko', 'ja', 'en', 'tw', 'zh']

def load(p):
    with open(p, encoding='utf-8') as f:
        return json.load(f)

ko = load(os.path.join(ROOT, 'data', 'ko', 'items.json'))
byname = {}
for o in ko['items']:
    if o.get('page') == 2:
        byname.setdefault(o['name'], o['id'])
by_doll, miss = {}, set()
for f in sorted(glob.glob(os.path.join(ROOT, 'data', 'ko', 'profiles', '*.json'))):
    p = load(f)
    vk = p.get('voiceKey') or os.path.splitext(os.path.basename(f))[0]
    lk = [byname[n] for n in (p.get('likes') or []) if n in byname]
    dk = [byname[n] for n in (p.get('dislikes') or []) if n in byname]
    miss |= {n for n in (p.get('likes') or []) + (p.get('dislikes') or []) if n not in byname}
    if lk or dk:
        by_doll[vk] = [lk, dk]
for lang in LANGS:
    path = os.path.join(ROOT, 'data', lang, 'items.json')
    d = load(path)
    d['gifts'] = {'byDoll': by_doll}
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(d, f, ensure_ascii=False, separators=(',', ':'))
print(f'dolls {len(by_doll)} · unmatched {sorted(miss)}')
