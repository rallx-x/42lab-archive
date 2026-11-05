import sys,json;sys.path.insert(0,'.')
from luac import parse
class T(dict):pass
def run(path):
    f=parse(open(path,'rb').read());K=f['k'];code=f['code']
    def kv(x):
        v=K[x];return v.decode('utf-8','replace') if isinstance(v,bytes) else v
    R=[None]*256;env={}
    rk=lambda x:kv(x-256) if x>=256 else R[x]
    pc=0;tables=[];step=0;guard={'calls':0}
    def touch(t):t.last=step
    while pc<len(code):
        i=code[pc];pc+=1;step+=1;op=i&63;a=(i>>6)&255;c=(i>>14)&511;b=(i>>23)&511;bx=i>>14
        if op==0:R[a]=R[b]
        elif op==1:R[a]=kv(bx)
        elif op==2:R[a]=kv(code[pc]>>6);pc+=1
        elif op==3:R[a]=bool(b);pc+=1 if c else 0
        elif op==4:
            for j in range(a,a+b+1):R[j]=None
        elif op==11:t=T();t.born=step;t.last=step;R[a]=t;tables.append(t)
        elif op==10:
            if isinstance(R[a],dict):R[a][rk(b)]=rk(c);touch(R[a])
        elif op==7:R[a]=R[b].get(rk(c)) if isinstance(R[b],dict) else None
        elif op==6:R[a]=env.get(rk(c))
        elif op==8:env[rk(b)]=rk(c)
        elif op==43:
            n=b;cc=c
            if cc==0:cc=code[pc]>>6;pc+=1
            for j in range(1,n+1):R[a][(cc-1)*50+j]=R[a+j]
            touch(R[a])
        elif op==30:pc+=bx-131071
        elif op==34:
            if (not not R[a])!=bool(c):pc+=1
        elif op==35:
            if (not not R[b])==bool(c):R[a]=R[b]
            else:pc+=1
        elif op==36:
            if guard['calls']>200000:break
            guard['calls']+=1;R[a]=None
        else: break
    root=max(tables,key=lambda t:sum(isinstance(v,dict) for v in t.values())+ (len(t) if not any(isinstance(v,dict) for v in t.values()) and len(t)>100 else 0))
    later=[t for t in tables if t.born>root.last and t and all(isinstance(k,str) for k in t)]
    return root,(later[0] if later else {})
def clean(o):
    if isinstance(o,dict):return {str(k):clean(v) for k,v in o.items()}
    if isinstance(o,list):return [clean(x) for x in o]
    return o
