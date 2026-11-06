# 알고리즘 세트 기호(suit_NN) · 아이템 그림(ICON_suit_NN_2)을 여백 맞춰 128 · 96px 로 (Sprite/Algorithms png 에서, 2026-11-06)
from PIL import Image
import os,re
OUT='/home/user/42lab-archive/assets/img/algo'
def norm(src,dst,size=128,pad=0.06):
    im=Image.open(src).convert('RGBA')
    bb=im.getchannel('A').point(lambda v:255 if v>16 else 0).getbbox()
    im=im.crop(bb);w,h=im.size;s=max(w,h)
    sq=Image.new('RGBA',(s,s),(0,0,0,0));sq.alpha_composite(im,((s-w)//2,(s-h)//2))
    inner=round(size*(1-2*pad));sq=sq.resize((inner,inner),Image.LANCZOS)
    c=Image.new('RGBA',(size,size),(0,0,0,0));c.alpha_composite(sq,((size-inner)//2,(size-inner)//2))
    c.save(dst,'WEBP',quality=92,method=6)
n=m=0
for f in os.listdir('alg_in'):
    if re.match(r'suit_\d+\.png$',f):norm('alg_in/'+f,OUT+'/'+f[:-4]+'.webp');n+=1
    mm=re.match(r'ICON_suit_(\d+)_2\.png$',f)
    if mm:norm('alg_in/'+f,OUT+'/item_'+mm.group(1)+'.webp',size=96,pad=0.02);m+=1
print('emblems',n,'items',m)
