import UnityPy,sys,os,collections
src,dst=sys.argv[1],sys.argv[2]
for f in sorted(os.listdir(src)):
    env=UnityPy.load(os.path.join(src,f));tag=f.split('-',1)[1].replace('.ab','')
    od=os.path.join(dst,tag);os.makedirs(od,exist_ok=True)
    names=[]
    for o in env.objects:
        t=o.type.name
        if t=='TextAsset':
            d=o.read();b=d.m_Script.encode('utf-8','surrogateescape') if isinstance(d.m_Script,str) else bytes(d.m_Script)
            open(os.path.join(od,d.m_Name.replace('/','_')),'wb').write(b);names.append((d.m_Name,len(b)))
        elif t=='MonoBehaviour':
            try:
                tr=o.read_typetree()
            except Exception as e:
                tr={'_err':str(e)}
            import json
            n=(tr.get('m_Name') if isinstance(tr,dict) else '') or 'mb_%d'%o.path_id
            open(os.path.join(od,n+'.json'),'w').write(json.dumps(tr,ensure_ascii=False,default=str)[:5000000]);names.append((n,'MB'))
    print(tag,len(names))
