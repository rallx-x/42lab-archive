"""본섭 전용 인형 스킬을 ko · ja · en · tw skills.json 에 넣기 (skills.py 다음에 실행)

- 수치 · 아이콘 · 쿨타임 · 컷씬은 data/zh/skills.json 그대로
- ko · ja · en: fan_skills.json 의 팬 번역 (Claude AI)
- tw: 간체 원문 → 번체 글자 변환 (opencc 's2tw', 게임 표기 맞춤 몇 개)
- 이 인형들의 스킬에는 "fan": true 표시
사용: python fan_skills.py   (pip install opencc-python-reimplemented)
"""
import json, os
from opencc import OpenCC

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, '..', '..', 'data')
TW_FIX = {'眩暈': '暈眩'}  # 대만 서버 용어 사전 표기


def load(p):
    with open(p, encoding='utf-8') as f:
        return json.load(f)


def save(p, d):
    with open(p, 'w', encoding='utf-8') as f:
        json.dump(d, f, ensure_ascii=False, separators=(',', ':'))


def main():
    fan = load(os.path.join(HERE, 'fan_skills.json'))
    zh = load(os.path.join(DATA, 'zh', 'skills.json'))['heroes']
    cc = OpenCC('s2tw')
    tw = lambda t: (lambda x: [x := x.replace(a, b) for a, b in TW_FIX.items()][-1] if TW_FIX else x)(cc.convert(t)) if t else t
    for lang in ['ko', 'ja', 'en', 'tw']:
        path = os.path.join(DATA, lang, 'skills.json')
        d = load(path)
        for hid, per in fan.items():
            if hid.startswith('_') or hid in d['heroes'] and not d['heroes'][hid][0].get('fan'):
                if not hid.startswith('_'):
                    print(lang, hid, 'already has official text — skip')
                continue
            out = []
            for s in zh.get(hid, []):
                o = dict(s)
                if lang == 'tw':
                    for k in ('name', 'brief', 'detail'):
                        o[k] = tw(o[k])
                else:
                    t = per.get(str(s['id']), {}).get(lang)
                    if not t:
                        continue
                    o.update(t)
                o['fan'] = True
                out.append(o)
            if out:
                d['heroes'][hid] = out
                print(lang, hid, len(out), 'skills (fan)')
        save(path, d)


if __name__ == '__main__':
    main()
