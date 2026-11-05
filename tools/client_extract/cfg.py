import sys,json;sys.path.insert(0,'.')
from vm import run,clean
def root(path):
    r,d=run(path);out={}
    for k,v in r.items():
        if isinstance(v,dict):
            row=dict(d);row.update(v);out[k]=row
        else: out[k]=v
    return out,d
_loc=None
def loc():
    global _loc
    if _loc is None:
        import os;_loc=root(os.environ.get('CFG','out/configs')+'/LuaConfigs.locale_text.lua')[0]
    return _loc
def arr(v):
    return [v[k] for k in sorted(v)] if isinstance(v,dict) and v and all(isinstance(k,int) for k in v) else v
if __name__=='__main__':
    r,d=root(sys.argv[1])
    print(len(r),'rows; defaults:',json.dumps(clean(d),ensure_ascii=False)[:400])
    for k in list(r)[:int(sys.argv[2])]:print(k,json.dumps(clean(r[k]),ensure_ascii=False)[:400])
