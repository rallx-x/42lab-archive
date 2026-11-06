"""능력치 아이콘 이름(attribute icon → assets/img/attri/<이름>.webp)을 arma.json 에 넣기 (2026-11-06)
사용: python attr_icons.py   (out/configs 가 있는 곳에서)
"""
import json, os, sys
sys.path.insert(0, '.')
from cfg import root

DATA = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'data')
at, ad = root('out/configs/LuaConfigs.attribute.lua')
icons = {str(k): {**ad, **v}.get('icon') for k, v in at.items() if isinstance(v, dict) and {**ad, **v}.get('icon')}
for lang in ['ko', 'ja', 'en', 'tw', 'zh']:
    p = os.path.join(DATA, lang, 'arma.json')
    d = json.load(open(p, encoding='utf-8'))
    d['attrIcons'] = icons
    json.dump(d, open(p, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
print(len(icons), 'icons')
