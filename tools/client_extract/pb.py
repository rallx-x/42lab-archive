import sys
def varint(b,p):
    r=s=0
    while True:
        c=b[p];p+=1;r|=(c&0x7f)<<s;s+=7
        if c<0x80:return r,p
def fields(b):
    p=0;out=[]
    while p<len(b):
        key,p=varint(b,p);fn,wt=key>>3,key&7
        if wt==0:v,p=varint(b,p)
        elif wt==2:
            n,p=varint(b,p);v=b[p:p+n];p+=n
        elif wt==5:v=b[p:p+4];p+=4
        elif wt==1:v=b[p:p+8];p+=8
        else:raise Exception('wt%d'%wt)
        out.append((fn,wt,v))
    return out
def loc(path):
    d={}
    for fn,wt,v in fields(open(path,'rb').read()):
        e=dict((f,x) for f,_,x in fields(v))
        d[e.get(1)]=e.get(2,b'').decode('utf-8','replace')
    return d
if __name__=='__main__':
    d=loc(sys.argv[1]);print(len(d));import itertools
    for k,v in itertools.islice(d.items(),8):print(k,repr(v)[:100])
    for q in sys.argv[2:]:print(q,repr(d.get(int(q))))
