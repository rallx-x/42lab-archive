# 알고리즘 세트 기호(suit_NN) · 아이템 그림(ICON_suit_NN_2): 진한 부분(그림자 제외) 기준으로 정중앙 · 같은 크기 (2026-11-06)
from PIL import Image
import os,re
OUT='/home/user/42lab-archive/assets/img/algo'
def norm(src,dst,size,pad):
    im=Image.open(src).convert('RGBA')
    a=im.getchannel('A')
    core=a.point(lambda v:255 if v>150 else 0).getbbox() or a.getbbox()   # 그림자 · 빛 번짐 빼고 본체만
    full=a.point(lambda v:255 if v>8 else 0).getbbox()
    cx,cy=(core[0]+core[2])/2,(core[1]+core[3])/2
    half=max(core[2]-core[0],core[3]-core[1])/2
    # 본체 기준 정사각형 (그림자는 칸 안에 남으면 그대로, 밖이면 잘림)
    box=(round(cx-half),round(cy-half),round(cx+half),round(cy+half))
    sq=Image.new('RGBA',(box[2]-box[0],box[3]-box[1]),(0,0,0,0))
    sq.alpha_composite(im.crop((max(box[0],0),max(box[1],0),min(box[2],im.width),min(box[3],im.height))),(max(-box[0],0),max(-box[1],0)))
    inner=round(size*(1-2*pad));sq=sq.resize((inner,inner),Image.LANCZOS)
    c=Image.new('RGBA',(size,size),(0,0,0,0));c.alpha_composite(sq,((size-inner)//2,(size-inner)//2))
    c.save(dst,'WEBP',quality=92,method=6)
n=0
for f in os.listdir('alg_in'):
    if re.match(r'suit_\d+\.png$',f):norm('alg_in/'+f,OUT+'/'+f[:-4]+'.webp',128,.06);n+=1
    m=re.match(r'ICON_suit_(\d+)_2\.png$',f)
    if m:norm('alg_in/'+f,OUT+'/item_'+m.group(1)+'.webp',96,.06);n+=1
print(n)
