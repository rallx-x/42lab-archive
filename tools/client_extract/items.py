import sys,os,json;sys.path.insert(0,'.')
import cfg
from cfg import root,arr
OUT=os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','..','data')
base=None;summary={}
# 선택형(803) 상자의 선택지: 한국어 설명 글 기준으로 아이템 번호를 정해 두고 5개 언어에 같이 씀
def build_options():
    cfg._loc=None;os.environ['CFG']='out/configs';L=cfg.loc()
    T=lambda v:(L.get(v,'') if isinstance(v,int) and v>0 else (v if isinstance(v,str) else ''))
    it,_=root('out/configs/LuaConfigs.item.lua');R={k:r for k,r in it.items() if isinstance(r,dict)}
    name=lambda k:T(R[k]['name'])
    def frag(n):
        c=[k for k in R if 2000<=k<3000 and name(k)==n];assert c,n;return min(c)
    def by(n):
        c=[k for k in R if name(k)==n];assert c,n
        w=[k for k in c if R[k].get('warehouse_page',0)>0];return min(w or c)
    O={8251:[frag('페르시카·집도'),by('각인 코어 파편'),by('각인 강화 경험치')],
       8255:[frag('시이나 마유리'),frag('마키세 크리스')],
       8256:[frag('대연'),by('각인 코어 파편'),by('각인 강화 경험치'),by('알고리즘 리빌더')],
       8257:[frag(n) for n in ('튜링','한나','플로렌스')],
       8260:[by(n) for n in ('팬더 연하장','매듭 연하장','간식 연하장','기린 연하장','찜통 연하장')],
       8277:[frag(n) for n in ('페넘브라','타이시','본네빌','옐레나','강우')],
       8231:[8206,8129,8168],
       8237:[frag(n) for n in ('펜','수춘','아비게일','초코','시모')],
       8276:[6104,6103,6102,6101],8286:[6104,6103,6102,6101,6113]}
    for k,r in R.items():
        n=name(k)
        if r.get('action_type')==803 and '돌파 위젯' in n:
            g=n.split(' ')[0]
            O[k]=[by(f'{g} 돌파 위젯·{c}') for c in ('치료사','해결사','사수','수위','전사')]
    return O
OPT=build_options()

for lang,d in [('ko','out/configs'),('ja','out_jp/configs'),('en','out_en/configs'),('tw','out_tw/configs'),('zh','out_cn/configs')]:
    cfg._loc=None;os.environ['CFG']=d;L=cfg.loc()
    T=lambda v:(L.get(v,'') if isinstance(v,int) and v>0 else (v if isinstance(v,str) else ''))
    it,_=root(d+'/LuaConfigs.item.lua')
    R={k:r for k,r in it.items() if isinstance(r,dict)}
    W=sorted([r for r in R.values() if r.get('warehouse_page',0)>0 and r.get('warehouse_page')!=4 and not r.get('is_shielded')],key=lambda r:(r['warehouse_page'],r.get('warehouse_order',0),r['id']))
    items=[];refs={}
    for r in W:
        o={'id':r['id'],'page':r['warehouse_page'],'name':T(r['name']),'desc':T(r['describe']),'source':T(r.get('achieve_des')),'icon':r.get('icon','')}
        g=arr(r.get('giftIdList')) or [];cn=arr(r.get('giftCountList')) or []
        if g:
            o['contents']=[[x,(cn[i] if i<len(cn) else 0)] for i,x in enumerate(g) if x in R]
            for x,_ in o['contents']:refs[x]=1
        if r.get('action_type') in (804,805,806) and o.get('contents'):
            o['select']=True;o['options']=[x for x,_ in o.pop('contents')]
        if r.get('action_type')==803:
            o['select']=True
            if r['id'] in OPT:
                o['options']=[x for x in OPT[r['id']] if x in R]
                for x in o['options']:refs[x]=1
        if r['quality']:o['quality']=r['quality']
        items.append(o)
    ids={o['id'] for o in items}
    # 스킨(투영체)은 「인형 - 스킨 이름」
    sk,_=root(d+'/LuaConfigs.skin.lua');hd,_=root(d+'/LuaConfigs.hero_data.lua')
    def rname(x):
        n=T(R[x]['name'])
        s_=sk.get(x)
        if isinstance(s_,dict):
            h=hd.get(s_.get('heroId'))
            hn=T(h['name']) if isinstance(h,dict) else ''
            if hn and hn not in n:return hn+' - '+n
        return n
    ref={str(x):{'name':rname(x),'icon':R[x].get('icon',''),'quality':R[x].get('quality',0)} for x in refs if x not in ids}
    doc={'schema':'42lab-items/0.1','lang':lang,'source':'client configs.ab item (2026-11-05)','pages':[2,3,5,6,7],'items':items,'refs':ref}
    json.dump(doc,open(f'{OUT}/{lang}/items.json','w'),ensure_ascii=False,separators=(',',':'))
    summary[lang]=(len(items),len(ref),sum(1 for o in items if not o['name']),os.path.getsize(f'{OUT}/{lang}/items.json'))
print(summary)
