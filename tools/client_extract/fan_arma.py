"""본섭 전용 무장각인을 ko · ja · en · tw arma.json 에 넣기 (arma.py 다음에 실행)

- 수치(levels) · 단계 · 아이콘은 data/zh/arma.json 그대로
- ko · ja · en: fan_arma.json 의 팬 번역 (Claude AI)
- tw: 간체 원문 → 번체 글자 변환 (opencc 's2tw')
- 이 인형들의 무장각인에는 "fan": true 표시
사용: python fan_arma.py
"""
import copy, json, os
from opencc import OpenCC

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, '..', '..', 'data')


def load(p):
    with open(p, encoding='utf-8') as f:
        return json.load(f)


def main():
    fan = load(os.path.join(HERE, 'fan_arma.json'))
    zh = load(os.path.join(DATA, 'zh', 'arma.json'))['heroes']
    cc = OpenCC('s2tw')
    for lang in ['ko', 'ja', 'en', 'tw']:
        path = os.path.join(DATA, lang, 'arma.json')
        d = load(path)
        for hid, per in fan.items():
            if hid.startswith('_') or hid not in zh:
                continue
            if hid in d['heroes'] and not d['heroes'][hid].get('fan'):
                print(lang, hid, 'already has official text — skip')
                continue
            h = copy.deepcopy(zh[hid])
            if lang == 'tw':
                for k in ('name', 'desc', 'hero'):
                    h[k] = cc.convert(h[k])
                for s in h['steps']:
                    s['skill']['name'] = cc.convert(s['skill']['name'])
                    s['skill']['desc'] = cc.convert(s['skill']['desc'])
            else:
                t = per[lang]
                h['name'], h['desc'] = t['name'], t['desc']
                for s in h['steps']:
                    s['skill'].update(t['skills'].get(str(s['skill']['id']), {}))
            # 인형 이름은 그 언어 프로필 이름 (skills.json 쪽엔 없어서 profiles 에서)
            prof = os.path.join(DATA, lang, 'doll_index.json')
            if os.path.exists(prof):
                for x in load(prof).get('dolls', []):
                    if str(x.get('heroId')) == hid:
                        h['hero'] = x.get('name') or h['hero']
            h['fan'] = True
            d['heroes'][hid] = h
            print(lang, hid, h['name'], '(fan)')
        with open(path, 'w', encoding='utf-8') as f:
            json.dump(d, f, ensure_ascii=False, separators=(',', ':'))


if __name__ == '__main__':
    main()
