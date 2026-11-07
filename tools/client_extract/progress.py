"""업적 · 클라우드 이정표 → data/<언어>/progress.json (2026-11-07)

원본 (configs, 서버별)
  업적
  - achievement        분류 5개 (커리어 · 인형 · 탐색 · 알고리즘 · 건설), task_type 601~605
  - task (type 601~605) 할 일: name · task_intro(설명) · rewardIds/Nums (6 = 업적 경험치) · isShow(false = 숨은 업적) · order
  - achievement_level  업적 레벨 1~30: 다음 레벨까지 경험치 · 아이콘 · 보상
  클라우드 이정표
  - milestone_module   모듈 6개 (마인드맵 · 무장 · 명예 · 여정 · 기사 · 성령), 점수 아이템 item_id 16~21
  - milestones_mile_task  모듈별 세부 분류 (type_id 1~6 → 이름)
  - task (type 13MN)   할 일: M = 모듈, N = 세부 분류 (예 1321 = 무장 모듈 · 1번 분류), 보상의 16~21 = 모듈 점수
  - milestones_module_reward  모듈 단계별 필요 점수 · 보상
사용: python progress.py   (skills.py 의 SERVERS 와 같은 곳에서)
"""
import json, os, sys
sys.path.insert(0, '.')
import cfg
from cfg import root
from vm import run, clean
import skills as S

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.environ.get('REPO') or os.path.join(HERE, '..', '..')


def main():
    for lang, tag, cdir in S.SERVERS:
        cfg._loc = None
        os.environ['CFG'] = cdir
        L = cfg.loc()
        T = lambda v: (L.get(v, '') if isinstance(v, int) else (v or ''))
        G = lambda t: root(cdir + '/LuaConfigs.%s.lua' % t)[0]
        item, task, ach, alv, mod = G('item'), G('task'), G('achievement'), G('achievement_level'), G('milestone_module')
        used = set()
        rew = lambda ids, nums: {str(i): n for i, n in zip((ids or {}).values(), (nums or {}).values()) if n}

        def tk(k, v):
            r = rew(v.get('rewardIds'), v.get('rewardNums'))
            used.update(r)
            return {'id': k, 'name': T(v.get('name')), 'desc': T(v.get('task_intro')), 'reward': r, 'hidden': not v.get('isShow', True), 'order': v.get('order') or 0}

        cats = []
        for k in sorted(x for x in ach if isinstance(x, int)):
            a = ach[k]
            tt = a.get('task_type')
            tasks = [tk(i, v) for i, v in sorted(task.items()) if isinstance(v, dict) and v.get('type') == tt and T(v.get('name'))]
            cats.append({'id': k, 'name': T(a.get('name')), 'en': a.get('english_name') or '', 'tasks': tasks})
        levels = []
        for k in sorted(x for x in alv if isinstance(x, int)):
            v = alv[k]
            r = rew(v.get('rewardIds'), v.get('rewardNums'))
            used.update(r)
            levels.append({'lv': k, 'exp': v.get('exp') or 0, 'icon': v.get('icon') or '', 'reward': r})
        mt, _ = run(cdir + '/LuaConfigs.milestones_mile_task.lua')
        mr, _ = run(cdir + '/LuaConfigs.milestones_module_reward.lua')
        mods = []
        for k in sorted(x for x in mod if isinstance(x, int)):
            m = mod[k]
            groups = []
            for gk, g in sorted((mt.get(k) or {}).items()):
                if not isinstance(g, dict):
                    continue
                n = g.get('type_id') or 1
                tt = 1300 + k * 10 + n
                tasks = [tk(i, v) for i, v in sorted(task.items()) if isinstance(v, dict) and v.get('type') == tt and T(v.get('name'))]
                groups.append({'type': n, 'name': T(g.get('name')), 'tasks': tasks})
            rewards, last = [], {}
            for rk, rv in sorted((mr.get(k) or {}).items()):
                if not isinstance(rv, dict):
                    continue
                rw = clean(rv.get('reward')) if 'reward' in rv else {}
                r = {str(a): b for a, b in (rw or {}).items()}
                used.update(r)
                rewards.append({'level': rv.get('reward_level') or rk, 'score': rv.get('score') or 1000 * rk, 'reward': r})
            mods.append({'id': k, 'name': T(m.get('name')), 'en': m.get('name_eng') or '', 'icon': m.get('icon') or '', 'point': str(m.get('item_id')),
                         'groups': groups, 'rewards': rewards})
            used.add(str(m.get('item_id')))
        items = {i: [T(item[int(i)].get('name')), item[int(i)].get('icon') or ''] for i in sorted(used) if isinstance(item.get(int(i)), dict)}
        doc = {'schema': '42lab-progress/0.1', 'lang': lang, 'source': 'configs achievement · achievement_level · task · milestone_* · item',
               'achievements': cats, 'achLevels': levels, 'milestones': mods, 'items': items}
        with open(os.path.join(REPO, 'data', lang, 'progress.json'), 'w', encoding='utf-8') as f:
            json.dump(doc, f, ensure_ascii=False, separators=(',', ':'))
        print(lang, [(c['name'], len(c['tasks'])) for c in cats], len(levels), 'levels', [(m['name'], sum(len(g['tasks']) for g in m['groups']), len(m['rewards'])) for m in mods])


if __name__ == '__main__':
    main()
