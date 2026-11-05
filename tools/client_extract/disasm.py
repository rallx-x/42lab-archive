import sys;sys.path.insert(0,'.')
from luac import parse
OPS="MOVE LOADK LOADKX LOADBOOL LOADNIL GETUPVAL GETTABUP GETTABLE SETTABUP SETUPVAL SETTABLE NEWTABLE SELF ADD SUB MUL MOD POW DIV IDIV BAND BOR BXOR SHL SHR UNM BNOT NOT LEN CONCAT JMP EQ LT LE TEST TESTSET CALL TAILCALL RETURN FORLOOP FORPREP TFORCALL TFORLOOP SETLIST CLOSURE VARARG EXTRAARG".split()
f=parse(open(sys.argv[1],'rb').read())
for i in f['code'][:int(sys.argv[2])]:
    op=i&63;a=(i>>6)&255;c=(i>>14)&511;b=(i>>23)&511;bx=i>>14
    print(OPS[op] if op<len(OPS) else op,a,b,c,bx)
