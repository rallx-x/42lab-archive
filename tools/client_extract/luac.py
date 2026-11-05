import struct,sys
class R:
    def __init__(s,b):s.b=b;s.p=0
    def u8(s):v=s.b[s.p];s.p+=1;return v
    def i32(s):v=struct.unpack_from('<i',s.b,s.p)[0];s.p+=4;return v
    def i64(s):v=struct.unpack_from('<q',s.b,s.p)[0];s.p+=8;return v
    def f64(s):v=struct.unpack_from('<d',s.b,s.p)[0];s.p+=8;return v
    def u32(s):v=struct.unpack_from('<I',s.b,s.p)[0];s.p+=4;return v
    def str(s):
        n=s.u8()
        if n==0xFF:n=s.u32()
        if n==0:return None
        v=s.b[s.p:s.p+n-1];s.p+=n-1;return v
def func(r):
    f={}
    f['source']=r.str();f['line']=r.i32();f['last']=r.i32();f['np']=r.u8();f['va']=r.u8();f['ms']=r.u8()
    n=r.i32();f['code']=list(struct.unpack_from('<%dI'%n,r.b,r.p));r.p+=4*n
    n=r.i32();K=[]
    for _ in range(n):
        t=r.u8()
        if t==0:K.append(None)
        elif t==1:K.append(bool(r.u8()))
        elif t==3:K.append(r.f64())
        elif t==0x13:K.append(r.i64())
        elif t in(4,0x14):K.append(r.str())
        else:raise Exception('ktype %x at %d'%(t,r.p))
    f['k']=K
    n=r.i32();f['up']=[(r.u8(),r.u8()) for _ in range(n)]
    n=r.i32();f['p']=[func(r) for _ in range(n)]
    n=r.i32();r.p+=4*n
    n=r.i32()
    for _ in range(n):r.str();r.i32();r.i32()
    n=r.i32()
    for _ in range(n):r.str()
    return f
def parse(b):
    assert b[:4]==b'\x1bLua'
    r=R(b);r.p=12+4  # sig4 ver fmt data6 = 12, sizes 4
    r.i64();r.f64();r.u8()
    return func(r)
if __name__=='__main__':
    f=parse(open(sys.argv[1],'rb').read())
    def walk(f,d=0):
        print(' '*d,'func k=',len(f['k']),'code=',len(f['code']))
        for p in f['p']:walk(p,d+1)
    walk(f)
    for k in f['k'][:int(sys.argv[2]) if len(sys.argv)>2 else 60]:
        print(repr(k.decode('utf-8','replace') if isinstance(k,bytes) else k)[:200])
