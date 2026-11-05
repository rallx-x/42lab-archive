"""인형 스킬 · 용어 사전 추출 (2026-11-05)

필요: 서버별 tables.ab 를 푼 폴더(tables_<ko|jp|en|tw|cn>/BattleSkillCfg · BattleFormulaCfg)
      + 서버별 configs (out*/configs: hero_data · skill_label_info · locale_text)
결과: data/<언어>/skills.json  {"heroes":{"<heroId>":[스킬…]}, "terms":[용어…]}

스킬 한 줄
  type 1 자동 · 2 패시브 · 3 궁극기, name, brief(간략), detail(상세, {0}… 자리),
  vals: 자리마다 레벨별 값 목록 (Lv1…MAX, 게임 화면에 나오는 숫자), maxLv,
  cd(쿨타임 초) · pre(예충전 초, 레벨별) · icon · cut(궁극기 컷씬 이름)
레벨별 값은 BattleFormulaCfg 의 공식(7번 칸 = 공식 번호, 8 = $1 처음 값, 9 = $2 증가량, 10 = $3 시작 레벨)을 그대로 계산.
"""
import sys, os, re, json, math
sys.path.insert(0, '.')
import cfg
from cfg import root, arr
from pb import fields, varint

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'data')
SERVERS = [('ko', 'kr', 'out/configs'), ('ja', 'jp', 'out_jp/configs'), ('en', 'en', 'out_en/configs'),
           ('tw', 'tw', 'out_tw/configs'), ('zh', 'cn', 'out_cn/configs')]
MAXLV = {1: 10, 2: 10, 3: 5}
FPS = 15


def packed(w, v):
    if w == 0:
        return [v]
    out, p = [], 0
    while p < len(v):
        x, p = varint(v, p)
        out.append(x)
    return out


def table_rows(path):
    return [v for f, w, v in fields(open(path, 'rb').read()) if f == 1 and w == 2]


def row_dict(r):
    d = {}
    for f, w, v in fields(r):
        d.setdefault(f, []).append((w, v))
    return d


# ---------- 공식 계산기: SkillLevel() · $1 $2 $3 · GetFVal(n) · SkillValueScale · FrameToTime · round · max · min · floor · ?: ----------
TOK = re.compile(r'\s*(\d+\.\d+|\d+|\$\d|SkillLevel\(\)|[A-Za-z_]\w*|==|!=|>=|<=|&&|\|\||[-+*/^()?:,<>])')


class Expr:
    def __init__(self, s, formulas):
        self.t = [m.group(1) for m in TOK.finditer(s)]
        self.i = 0
        self.f = formulas

    def peek(self):
        return self.t[self.i] if self.i < len(self.t) else None

    def eat(self, x=None):
        tok = self.peek()
        if x == ')' and tok is None:  # 게임 공식에 닫는 괄호가 빠진 곳이 있음 (605번)
            return ')'
        if x is not None and tok != x:
            raise ValueError('expected %s got %s' % (x, tok))
        self.i += 1
        return tok

    def parse(self, env):
        self.env = env
        v = self.ternary()
        return v

    def ternary(self):
        c = self.cmp()
        if self.peek() == '?':
            self.eat('?')
            a = self.ternary()
            self.eat(':')
            b = self.ternary()
            return a if c else b
        return c

    def cmp(self):
        a = self.add()
        while self.peek() in ('>', '<', '>=', '<=', '==', '!='):
            op = self.eat()
            b = self.add()
            a = {'>': a > b, '<': a < b, '>=': a >= b, '<=': a <= b, '==': a == b, '!=': a != b}[op]
        return a

    def add(self):
        a = self.mul()
        while self.peek() in ('+', '-'):
            op = self.eat()
            b = self.mul()
            a = a + b if op == '+' else a - b
        return a

    def mul(self):
        a = self.pow()
        while self.peek() in ('*', '/'):
            op = self.eat()
            b = self.pow()
            a = a * b if op == '*' else a / b
        return a

    def pow(self):
        a = self.unary()
        if self.peek() == '^':
            self.eat()
            a = a ** self.pow()
        return a

    def unary(self):
        if self.peek() == '-':
            self.eat()
            return -self.unary()
        return self.atom()

    def args(self):
        out = []
        self.eat('(')
        if self.peek() != ')':
            out.append(self.ternary())
            while self.peek() == ',':
                self.eat(',')
                out.append(self.ternary())
        self.eat(')')
        return out

    def atom(self):
        tok = self.eat()
        if tok == '(':
            v = self.ternary()
            self.eat(')')
            return v
        if tok[0].isdigit():
            return float(tok)
        if tok.startswith('$'):
            return self.env['$' + tok[1]]
        if tok == 'SkillLevel()':
            return self.env['L']
        if tok == 'UnlockAdvance' and self.peek() == '(':  # 확장 해금 여부 → 기본 상태(0)
            self.args()
            return 0
        name = tok
        a = self.args()
        if name == 'GetFVal':
            return evaluate(self.f, int(a[0]), self.env)
        if name == 'SkillValueScale':
            return a[0] / a[1]
        if name == 'FrameToTime':
            return a[0] / FPS
        if name == 'round':
            return math.floor(a[0] + 0.5)
        if name == 'floor':
            return math.floor(a[0])
        if name == 'max':
            return max(a)
        if name == 'min':
            return min(a)
        raise ValueError('unknown function ' + name)


def evaluate(formulas, fid, env):
    return Expr(formulas[fid], formulas).parse(env)


def num(x):
    x = round(x, 3)
    return int(x) if abs(x - round(x)) < 1e-9 else x


def main():
    for lang, tag, cdir in SERVERS:
        cfg._loc = None
        os.environ['CFG'] = cdir
        L = cfg.loc()
        T = lambda v: (L.get(v, '') if isinstance(v, int) and v > 0 else (v if isinstance(v, str) else ''))
        formulas = {}
        for r in table_rows(f'tables_{tag}/BattleFormulaCfg'):
            d = row_dict(r)
            if 2 in d:
                formulas[d[1][0][1]] = d[2][0][1].decode('utf-8')
        skills = {}
        for r in table_rows(f'tables_{tag}/BattleSkillCfg'):
            d = row_dict(r)
            skills[d[1][0][1]] = d
        hd, _ = root(cdir + '/LuaConfigs.hero_data.lua')
        heroes, bad = {}, 0
        for hid, h in hd.items():
            if not isinstance(h, dict):
                continue
            out = []
            for sid in (arr(h.get('skill_list')) or [])[1:]:
                d = skills.get(sid)
                if not d:
                    continue
                s = lambda f: d[f][0][1] if f in d else None
                st = s(15)
                if st not in MAXLV:
                    continue
                txt = lambda f: s(f).decode('utf-8') if isinstance(s(f), bytes) else ''
                fx = packed(*d[7][0]) if 7 in d else []
                b1 = packed(*d[8][0]) if 8 in d else []
                g2 = packed(*d[9][0]) if 9 in d else []
                l3 = packed(*d[10][0]) if 10 in d else []
                mx = MAXLV[st]
                vals = []
                for i, fid in enumerate(fx):
                    env = {'$1': b1[i] if i < len(b1) else 0, '$2': g2[i] if i < len(g2) else 0, '$3': l3[i] if i < len(l3) else 1}
                    row = []
                    for lv in range(1, mx + 1):
                        env['L'] = lv
                        try:
                            row.append(num(evaluate(formulas, fid, env)))
                        except Exception:
                            row = None
                            bad += 1
                            break
                    vals.append(row)
                o = {'id': sid, 'type': st, 'name': txt(2), 'brief': txt(4), 'detail': txt(5), 'vals': vals, 'maxLv': mx}
                if isinstance(s(11), bytes):
                    o['icon'] = s(11).decode()
                if st in (1, 3) and isinstance(s(17), int):
                    o['cd'] = num(s(17) / FPS)
                if st == 1 and 21 in d and d[21][0][0] == 2:  # 예충전: 레벨 구간(20) · 값(21)
                    lv = packed(*d[20][0]) if 20 in d else []
                    pv = packed(*d[21][0])
                    o['pre'] = [num(x / FPS) for x in pv]
                    o['preLv'] = lv if len(lv) == len(pv) else [1] + lv
                if st == 3 and isinstance(s(13), bytes):
                    o['cut'] = s(13).decode()
                out.append(o)
            if out:
                heroes[str(hid)] = out
        lab, _ = root(cdir + '/LuaConfigs.skill_label_info.lua')
        terms = [{'id': k, 'name': T(v['name']), 'desc': T(v['describe']), 'color': v.get('icon_color', 0)}
                 for k, v in sorted(lab.items()) if isinstance(v, dict) and T(v['name'])]
        doc = {'schema': '42lab-skills/0.1', 'lang': lang, 'source': 'client tables.ab BattleSkillCfg · BattleFormulaCfg, configs.ab hero_data · skill_label_info',
               'heroes': heroes, 'terms': terms}
        with open(os.path.join(OUT, lang, 'skills.json'), 'w', encoding='utf-8') as f:
            json.dump(doc, f, ensure_ascii=False, separators=(',', ':'))
        print(lang, 'heroes', len(heroes), 'skills', sum(len(v) for v in heroes.values()), 'terms', len(terms), 'formula errors', bad)


if __name__ == '__main__':
    main()
