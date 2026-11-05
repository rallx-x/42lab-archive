import sys,os,json,re;sys.path.insert(0,'.')
import cfg
from cfg import root,arr
OUT=os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','..','data');S={}
for lang,d in [('ko','out/configs'),('ja','out_jp/configs'),('en','out_en/configs'),('tw','out_tw/configs'),('zh','out_cn/configs')]:
    cfg._loc=None;os.environ['CFG']=d;L=cfg.loc()
    T=lambda v:(L.get(v,'') if isinstance(v,int) and v>0 else (v if isinstance(v,str) else ''))
    fur,_=root(d+'/LuaConfigs.dorm_furniture.lua');cat,_=root(d+'/LuaConfigs.dorm_fnt_category.lua')
    th,_=root(d+'/LuaConfigs.dorm_theme.lua');it,_=root(d+'/LuaConfigs.item.lua')
    themes=[];fth={}
    for k,v in sorted(th.items(),key=lambda x:(x[1].get('sortord',0),x[0])):
        ids=[];seen=set()
        for x in map(int,re.findall(r'(72\d{4})',str(v['theme_coord']))):
            if x in fur and x not in seen:seen.add(x);ids.append(x)
        themes.append({'id':k,'name':T(v['theme_name']),'info':T(v['theme_info']),'items':ids})
        for x in ids:fth.setdefault(x,[]).append(k)
    items=[]
    for k,f in sorted(fur.items(),key=lambda x:(x[1]['category'],it.get(x[0],{}).get('order_sort',0),x[0])):
        r=it.get(k)
        if not r or not T(r['name']) or r.get('is_shielded'):continue
        sz=arr(f.get('size')) or []
        o={'id':k,'cat':f['category'],'name':T(r['name']),'desc':T(r['describe']),'icon':r.get('icon',''),'comfort':f.get('comfort',0)}
        if len(sz)==2:o['size']=sz
        if k in fth:o['themes']=fth[k]
        src=T(r.get('achieve_des'))
        if src:o['source']=src
        if r.get('quality'):o['quality']=r['quality']
        items.append(o)
    cats=[{'id':k,'name':T(v['name'])} for k,v in sorted(cat.items()) if any(o['cat']==k for o in items)]
    doc={'schema':'42lab-furniture/0.1','lang':lang,'source':'client configs.ab dorm_furniture · dorm_fnt_category · dorm_theme · item (2026-11-05)','categories':cats,'themes':themes,'items':items}
    json.dump(doc,open(f'{OUT}/{lang}/furniture.json','w'),ensure_ascii=False,separators=(',',':'))
    S[lang]=(len(items),len(cats),len(themes),sum(1 for o in items if 'themes' in o),os.path.getsize(f'{OUT}/{lang}/furniture.json')//1024)
print(S)
