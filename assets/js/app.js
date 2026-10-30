(() => {
const $=s=>document.querySelector(s), el=(tag,cls,text)=>{let n=document.createElement(tag);if(cls)n.className=cls;if(text!=null)n.textContent=text;return n};
// v0.9.5 아이콘: 모양 이미지를 글자색으로 칠함 (assets/icons)
const ic=(name,cls)=>{const i=el('i','ic ic-'+name+(cls?' '+cls:''));i.setAttribute('aria-hidden','true');return i};
const withIc=(name,text,cls)=>{const s=el('span',cls||'');s.append(ic(name),document.createTextNode(' '+text));return s};
const key='42lab.', get=(k,f)=>{try{let v=localStorage.getItem(key+k);return v===null?f:JSON.parse(v)}catch{return f}},set=(k,v)=>{try{localStorage.setItem(key+k,JSON.stringify(v));return true}catch{return false}};
let index=null,data=null,current='',positions=[],observer=null,active=0,category=null,flowNodes=[],cursor=0,choiceStates={},suspendObserve=false;
const nick=()=>{const v=get('nickname','');return v&&!(v==='교수'&&window.UI_LANG&&window.UI_LANG!=='ko')?v:window.L('교수')};
// ---------- v0.9.0 언어 기반 ----------
// 사이트가 실제로 가진 언어(data/<lang>/)만 사용한다. 준비 안 된 언어를 골라도 데이터는 ko로 읽는다.
// v0.11.3 tw = 대만섭(번체), zh = 본섭(간체, 나중)
const LANGS=[['ko','한국어'],['ja','日本語'],['en','English'],['tw','繁體中文'],['zh','简体中文']];
// v0.11.0 데이터가 있는 언어 (site_info 를 기다리지 않음 — 목록이 한국어로 먼저 읽히던 문제)
let readyLangs=['ko','ja','en','tw','zh'],siteInfo=null;
const uiLang=()=>{const v=get('lang','ko');return LANGS.some(([id])=>id===v)?v:'ko'};
const dataLang=()=>readyLangs.includes(uiLang())?uiLang():'ko';
const dataPath=p=>'./data/'+dataLang()+'/'+p;
document.documentElement.lang=dataLang();
// v0.9.1 밝기: 시스템(기본) · 라이트 · 딤 · 다크. 시스템이면 기기 설정을 계속 따라간다.
const BRIGHT=['light','dim','dark'];
const osDark=()=>matchMedia('(prefers-color-scheme: dark)').matches;
function brightnessMode(){const b=get('brightness',null);if(b)return b;const t=get('theme',null);return t?(BRIGHT.includes(t)?t:'custom'):'system'}
const currentTheme=()=>brightnessMode()==='system'?(osDark()?'dark':'light'):get('theme','dim');
// 글꼴 (2026-10-30, 기록 175): 고딕 · 명조는 화면 언어에 맞는 Noto 글꼴을 구글 폰트에서 불러오고, 기본은 기기에 있는 글꼴
const FONT_FAMS={sans:{ko:'Noto Sans KR',en:'Noto Sans KR',ja:'Noto Sans JP',tw:'Noto Sans TC',zh:'Noto Sans SC'},serif:{ko:'Noto Serif KR',en:'Noto Serif KR',ja:'Noto Serif JP',tw:'Noto Serif TC',zh:'Noto Serif SC'}};
const SYS_FONT='system-ui,-apple-system,"Apple SD Gothic Neo","Malgun Gothic","Hiragino Sans","Yu Gothic","Microsoft JhengHei","Microsoft YaHei",sans-serif';
function applyFontFamily(){const ch=get('fontFamily','sans');const root=document.documentElement;
 if(ch==='system'||!FONT_FAMS[ch]){root.style.setProperty('--font',SYS_FONT);return}
 const fam=FONT_FAMS[ch][dataLang()]||FONT_FAMS[ch].ko,id='gf-'+fam.replace(/\s+/g,'-');
 if(!document.getElementById(id)){const l=document.createElement('link');l.id=id;l.rel='stylesheet';l.href='https://fonts.googleapis.com/css2?family='+fam.replace(/\s+/g,'+')+':wght@400;700;800&display=swap';document.head.append(l)}
 root.style.setProperty('--font','"'+fam+'",'+(ch==='serif'?'serif':SYS_FONT))}
const applySettings=()=>{const t=currentTheme();document.body.className=t;document.documentElement.style.setProperty('--fs',get('fontSize',16)+'px');document.documentElement.style.setProperty('--lh',get('lineHeight',160)/100);document.documentElement.style.setProperty('--letter-space',get('letterSpacing',0)+'px');document.documentElement.style.setProperty('--paragraph-gap',get('readingMode','accessible')==='accessible'?'12px':'0px');applyFontFamily();};

// 네트워크가 잠깐 끊겨도 실패하지 않게 최대 3번 시도 (모바일 "Failed to fetch" 대응)
async function fetchJSON(path,tries=3){
 let last;
 for(let i=0;i<tries;i++){
  try{const r=await fetch(path,{cache:'no-cache'});if(!r.ok){const e=Error('HTTP '+r.status);e.status=r.status;throw e}return await r.json()}
  catch(e){last=e;if(e.status&&e.status<500)break;await new Promise(res=>setTimeout(res,500*(i+1)))}
 }
 throw last;
}
function error(msg){let box=el('div','group');box.style.padding='24px';box.textContent=msg;return box}
function sortedEpisodes(g){return [...(g.episodes||[])].sort((a,b)=>(a.order??999999)-(b.order??999999))}
// Display numbering is provided by Cherry's v0.3.8 index.json. Never renumber from UI position.
function episodeNumber(ep){
 if(!Number.isInteger(ep.no))return '';
 return String(ep.no).padStart(2,'0')+(Number.isInteger(ep.sub)?'.'+ep.sub:'');
}
function episodeLabel(ep){const n=episodeNumber(ep);if(!n)return '';return ep.kind==='battleDialog'?window.L('전투 '+n):ep.kind==='tutorial'?window.L('튜토리얼 '+n):n}
function episodeTitle(ep){
 const title=(ep.title||'').trim()||(ep.kind==='battleDialog'?'전투 중 대사':'(제목 없음)');
 return (ep.kind==='battleDialog'&&title!=='전투 중 대사'&&!title.startsWith('전투 중 대사 · ')?'전투 중 대사 · ':'')+title;
}
function addEpisodeButton(parent,ep){let b=el('button','episode');if(ep.kind==='battleDialog'){b.classList.add('battle-episode');b.append(el('span','episode-tag','전투 중 대사'))}let heading=el('div','episode-heading');heading.append(el('strong','',(episodeNumber(ep)?episodeNumber(ep)+' ':'')+episodeTitle(ep)));if(ep.part?.number&&ep.part?.total)heading.append(el('span','part-badge',ep.part.number+'/'+ep.part.total));b.append(heading);if(ep.description)b.append(el('small','',ep.description));if(get('completed.'+ep.id,false))b.append(withIc('check','열람 완료','completed-mark'));b.onclick=()=>openEpisode(ep.id);parent.append(b)}

// v0.7.0: Cherry's index (schema 42lab-index/0.4) is already classified. Render it as-is.
let displayGroups=[];
function makeDisplayGroups(groups){
 const rank=new Map((index?.categories||[]).map((c,i)=>[c.id,i]));
 return [...groups].filter(g=>g.category!=='dorm').sort((x,y)=>(rank.get(x.category)??99)-(rank.get(y.category)??99)||(x.order??9999)-(y.order??9999));
}
const sectionDefs=g=>new Map((g.sections||[]).map(s=>[String(s.id),s]));
let openFolderId=null,openShelf=null;
let viewMode=get('viewMode','file');
let routeToken=0;
const groupKey=g=>String(g.id||g.key);
function routeHash(route){
 if(route.type==='episode')return '#ep/'+encodeURIComponent(route.id);
 if(route.type==='dolls')return '#dolls';
 if(route.type==='doll')return '#doll/'+encodeURIComponent(route.id);
 if(route.type==='chapter')return '#chapter/'+encodeURIComponent(route.category)+':'+encodeURIComponent(route.id);
 // v0.9.0: #home = 첫 화면(공지·일러스트·피드백), #home/<분류> = 그 분류의 스토리 목록 (#home/all = 전체 기록)
 return route.category?'#home/'+encodeURIComponent(route.category)+(route.shelf?'/'+encodeURIComponent(route.shelf):''):'#home';
}
function parseRoute(){
 let raw=location.hash.slice(1);
 try{
  if(raw.startsWith('ep/'))return {type:'episode',id:decodeURIComponent(raw.slice(3))};
  if(raw==='dolls')return {type:'dolls'};
  if(raw.startsWith('doll/'))return {type:'doll',id:decodeURIComponent(raw.slice(5))};
  if(raw.startsWith('chapter/')){
   let part=raw.slice(8),colon=part.indexOf(':');
   if(colon!==-1)return {type:'chapter',category:decodeURIComponent(part.slice(0,colon)),id:decodeURIComponent(part.slice(colon+1))};
  }
  if(raw.startsWith('home/')){const [c,sh]=raw.slice(5).split('/');return {type:'home',category:decodeURIComponent(c),shelf:sh?decodeURIComponent(sh):null}}
  if(raw==='home'||raw==='')return {type:'home',category:null};
  // Compatibility with old links: #episode_id
  let id=decodeURIComponent(raw);
  if(index?.groups?.some(g=>(g.episodes||[]).some(e=>e.id===id)))return {type:'episode',id};
 }catch(e){}
 return {type:'home',category:null};
}
// null = 첫 화면. 분류 탭(퀵바)은 v0.9.0에서 없앴고, 왼쪽 메뉴·검색으로 들어간다.
function selectCategory(id){
 category=id==null?null:storyCategories.some(([value])=>value===id)?id:'all';
}
function saveRoute(route){history.pushState({route},'',location.pathname+location.search+routeHash(route))}
function showChapter(id,cat=category,{push=true}={}){
 let group=displayGroups.find(g=>groupKey(g)===String(id));
 if(!group)return false;
 // 검색 결과에서 챕터로 이동할 때는 검색어를 비워야 챕터 화면이 그려진다
 if($('#search').value){$('#search').value=''}
 routeToken++;
 selectCategory(cat==='all'||categoryMatches(group,cat)?cat:displayCategory(group.category));
 openFolderId=groupKey(group);openShelf=null;
 if(push)saveRoute({type:'chapter',category,id:openFolderId});
 drawLibrary();
 document.querySelector('#groups')?.scrollIntoView({block:'start'});
 return true;
}
function showHome(cat=null,{push=true,shelf=null}={}){
 routeToken++;
 selectCategory(cat);
 openFolderId=null;openShelf=shelf||null;
 $('#reader').classList.add('hidden');bgmLeave();
 $('#library').classList.remove('hidden');
 if(push)saveRoute({type:'home',category,shelf:openShelf});
 drawLibrary();
 window.scrollTo(0,0);
}
async function restoreRoute(){
 const route=parseRoute();
 if(route.type==='episode'){
  let exists=index.groups.some(g=>(g.episodes||[]).some(e=>e.id===route.id));
  if(exists){
   await openEpisode(route.id,{push:false});
   return;
  }
 }
 if(route.type==='dolls'){showDolls({push:false});return}
 if(route.type==='doll'){showDoll(route.id,{push:false});return}
 if(route.type==='chapter'&&showChapter(route.id,route.category,{push:false}))return;
 showHome(route.category||null,{push:false,shelf:route.shelf||null});
}
// A presentation-only shelf layout: no edits to Cherry's episode data or ordering.
// Explicit group metadata from a future index takes precedence over legacy title/key hints.
function shelfFor(g){const v=g.shelf;return typeof v==='string'&&v.trim()?v.trim():null}
// v0.9.15 전체 기록: 메인 · 전속 · 이벤트 · 그 외 4칸 (제목 옆 ▶ 로 접고 펼침, 이 창에서만 기억)
const allFold=new Set();
function renderCategorySections(items,makeCard){
 const frag=el('div','allcat-wrap');
 for(const [id,name] of storyCategories.filter(([id])=>id!=='all')){
  const list=items.filter(x=>effectiveCategory(x.g)===id);if(!list.length)continue;
  const sec=el('section','allcat'+(allFold.has(id)?'':' expanded'));
  const head=el('button','allcat-head');head.type='button';head.setAttribute('aria-expanded',String(!allFold.has(id)));
  head.append(el('h3','',name),el('span','allcat-count',list.length+'개'),ic('right','tri'));
  const body=el('div','allcat-body');const inner=el('div','allcat-inner');
  const grid=el('div',viewMode==='folder'?'drive-grid':viewMode==='list'?'chapter-list':'folder-grid');
  list.forEach((item,i)=>grid.append(makeCard(item,i)));inner.append(grid);body.append(inner);
  head.onclick=()=>{const ex=sec.classList.toggle('expanded');head.setAttribute('aria-expanded',String(ex));if(ex)allFold.delete(id);else allFold.add(id)};
  sec.append(head,body);frag.append(sec);
 }
 return frag;
}
function renderShelfSections(visible,makeCard){
 const shelves=new Map();
 for(const item of visible){
  const label=shelfFor(item.g)||item.g.title;
  if(!shelves.has(label))shelves.set(label,[]);
  shelves.get(label).push(item);
 }
 const labels=[...shelves.keys()];
 const frag=el('div','shelf-wrap');
 for(const label of labels){
  const section=el('section','story-shelf'+(shelves.get(label).length<=2?' shelf-half':''));
  const heading=el('div','story-shelf-heading');
  const left=el('div','story-shelf-label');
  {const si=el('span','story-shelf-icon');si.append(ic('folders'));left.append(si,el('h3','',label))}
  heading.append(left,el('span','story-shelf-count',shelves.get(label).length+'개 폴더'));
  const grid=el('div',viewMode==='folder'?'drive-grid':viewMode==='list'?'chapter-list':'folder-grid');
  shelves.get(label).forEach((item,i)=>grid.append(makeCard(item,i)));
  section.append(heading,grid);frag.append(section);
 }
 return frag;
}
// Section starts are positions in the currently visible episode sequence.
// Preserve the index order and existing section metadata when available.
function buildChapterSections(group,episodes){
 const defs=sectionDefs(group);if(!defs.size||!episodes.length)return [];
 const out=[];let previous=null;
 episodes.forEach((ep,i)=>{
  const id=String(ep.section??'');if(id===previous)return;previous=id;
  const def=defs.get(id)||{};
  out.push({id:'section:'+id+':'+i,key:id,title:def.title||id||'본편',start:i,hub:def.hub===true,hubLabel:def.hubLabel||def.title,count:def.count,style:def.style||id});
 });
 return out;
}
// v0.9.1 챕터 안 묶음: 본편 구역별 → 종류별(전투 중 대사 · 노드 대사 · 튜토리얼)
const chapterTabMemory=new Map();
const kindOf=ep=>ep.kind||'story';
function chapterTabs(g,eps){
 const defs=sectionDefs(g),out=[],byKey=new Map();
 const add=(id,title,style,ep)=>{let t=byKey.get(id);if(!t){t={id,title,style,eps:[]};byKey.set(id,t);out.push(t)}t.eps.push(ep)};
 for(const ep of eps){
  const k=kindOf(ep);
  if(k==='story'){const s=String(ep.section??'');const def=defs.get(s)||{};add('s:'+s,def.title||'본편',def.style||s||'standard',ep)}
  else add('k:'+k,(index?.kinds||{})[k]||k,'kind-'+k,ep);
 }
 return [...out.filter(t=>t.id.startsWith('s:')),...out.filter(t=>t.id.startsWith('k:'))];
}
function tabIdFor(g,ep){const k=kindOf(ep);return k==='story'?'s:'+String(ep.section??''):'k:'+k}
// ---------- v0.8.0 북마크 ----------
function bookmarks(){const v=get('bookmarks',[]);return Array.isArray(v)?v.filter(x=>x&&typeof x.id==='string'):[]}
function isBookmarked(id){return bookmarks().some(x=>x.id===id)}
function findEpisode(id){for(const g of displayGroups){const e=(g.episodes||[]).find(x=>x.id===id);if(e)return {g,e}}return null}
function updateBookmarkToggle(){const b=$('#bmToggle');if(!b)return;const on=!!current&&isBookmarked(current);b.replaceChildren(ic(on?'star':'star-line'),document.createTextNode(on?' 북마크됨':' 북마크'));b.setAttribute('aria-pressed',String(on));b.classList.toggle('selected',on)}
function toggleBookmark(id){
 let list=bookmarks();
 if(list.some(x=>x.id===id))list=list.filter(x=>x.id!==id);else list.unshift({id,at:Date.now()});
 if(!set('bookmarks',list))alert(({ja:'ブラウザの保存領域が使えないため、ブックマークを保存できませんでした。（シークレットモードや保存ブロック設定を確認してください）',en:'Could not save the bookmark because browser storage is unavailable. (Check private mode or storage blocking.)',tw:'無法使用瀏覽器儲存空間，書籤未能儲存。（請確認無痕模式或儲存封鎖設定）',zh:'无法使用浏览器存储空间，书签未能保存。（请确认无痕模式或存储拦截设置）'})[window.UI_LANG]||'브라우저 저장소를 사용할 수 없어 북마크를 저장하지 못했습니다. (시크릿 모드나 저장 차단 설정을 확인해 주세요)');
 updateBookmarkToggle();
}
function bookmarkRow(id,{at,last}={}){
 const found=findEpisode(id),row=el('div','bm-row'+(found?'':' missing'));
 const info=el('div','bm-info');
 if(found){
  const ctx=chapterDisplayTitle(found.g)+(episodeLabel(found.e)?' · '+episodeLabel(found.e):'');
  info.append(el('small','',ctx),el('strong','',episodeTitle(found.e)));
 }else info.append(el('small','','기록을 찾을 수 없음'),el('strong','','데이터에서 사라진 기록입니다'));
 if(at)info.append(el('span','bm-date',new Date(at).toLocaleDateString(window.UI_LOCALE||'ko-KR')+' 저장'));
 row.append(info);
 const tools=el('div','bm-tools');
 if(found){const open=el('button','bm-open',last?'이어 읽기':'열기');open.type='button';open.onclick=async()=>{$('#userDialog').close();await openEpisode(id);if(last)setTimeout(resume,250)};tools.append(open)}
 if(!last){const del=el('button','bm-del','삭제');del.type='button';del.setAttribute('aria-label','북마크 삭제');del.onclick=()=>{set('bookmarks',bookmarks().filter(x=>x.id!==id));renderUserPanel();updateBookmarkToggle()};tools.append(del)}
 row.append(tools);return row;
}
// v0.9.0 사용자 창: 교수 이름 · 마지막으로 읽은 기록 · 북마크 · 진척도 코드(자리만)
function renderUserPanel(){
 const lastHost=$('#userLast');lastHost.replaceChildren();
 const last=get('lastEpisode',null);
 if(last&&findEpisode(last))lastHost.append(bookmarkRow(last,{last:true}));
 else lastHost.append(el('p','bm-empty','아직 읽은 기록이 없습니다.'));
 const host=$('#userBookmarks');host.replaceChildren();
 const list=bookmarks();
 host.append(el('h3','bm-head','북마크 '+list.length+'개'));
 if(!list.length){const p=el('p','bm-empty','아직 북마크한 기록이 없습니다. 읽기 화면의 ');p.append(ic('star-line'),document.createTextNode(' 북마크 버튼으로 저장할 수 있어요.'));host.append(p)};
 for(const b of list)host.append(bookmarkRow(b.id,{at:b.at}));
}
function selectUserPage(page){$('#userRoot').hidden=page!=='root';$('#userProgress').hidden=page!=='progress';$('#userBack').hidden=page==='root';$('#userTitle').textContent=page==='progress'?'진척도 코드':'사용자'}
// 진척도 코드 (2026-10-30, 기록 176): 이 브라우저에 저장된 읽기 기록·설정을 코드 하나로 → 다른 기기에서 불러오기
// 코드 = 「42L1.」 + (내용 JSON 을 압축한 것, 압축을 못 쓰는 브라우저는 「42L0.」 + 그대로) 을 URL에 써도 되는 글자로
const PROG_KEYS=['lastEpisode','bookmarks','nickname','profGender','theme','brightness','fontFamily','fontSize','letterSpacing','lineHeight','readingMode','viewMode','cgMode','showCG','voiceRepeat','bgmVolume','dollSort','lang'];
const PROG_PREFIX=['position.','completed.','farthest.','choices.','unlocked.'];
const b64u={enc:u8=>{let s='';for(let i=0;i<u8.length;i+=0x8000)s+=String.fromCharCode(...u8.subarray(i,i+0x8000));return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')},
 dec:t=>{t=t.replace(/-/g,'+').replace(/_/g,'/');while(t.length%4)t+='=';const s=atob(t),u=new Uint8Array(s.length);for(let i=0;i<s.length;i++)u[i]=s.charCodeAt(i);return u}};
const zipOK=typeof CompressionStream==='function'&&typeof DecompressionStream==='function';
async function streamBytes(u8,S){return new Uint8Array(await new Response(new Blob([u8]).stream().pipeThrough(S)).arrayBuffer())}
function progressSnapshot(){const d={};try{for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(!k||!k.startsWith(key))continue;const n=k.slice(key.length);if(PROG_KEYS.includes(n)||PROG_PREFIX.some(x=>n.startsWith(x)))d[n]=JSON.parse(localStorage.getItem(k))}}catch{}return d}
async function makeProgressCode(){const raw=new TextEncoder().encode(JSON.stringify({v:1,t:new Date().toISOString().slice(0,10),d:progressSnapshot()}));
 if(zipOK){try{return '42L1.'+b64u.enc(await streamBytes(raw,new CompressionStream('deflate-raw')))}catch{}}return '42L0.'+b64u.enc(raw)}
async function readProgressCode(code){code=String(code||'').replace(/\s+/g,'');const m=code.match(/^42L([01])\.([A-Za-z0-9_-]+)$/);if(!m)throw Error('form');
 let u=b64u.dec(m[2]);if(m[1]==='1'){if(!zipOK)throw Error('zip');u=await streamBytes(u,new DecompressionStream('deflate-raw'))}
 const o=JSON.parse(new TextDecoder().decode(u));if(!o||o.v!==1||typeof o.d!=='object')throw Error('form');return o}
function progressMsg(t,cls){const m=$('#progressMsg');if(!m)return;m.textContent=t;m.className='setting-hint '+(cls||'')}
function wireProgress(){const out=$('#progressOut'),inp=$('#progressIn');if(!out||out.dataset.wired)return;out.dataset.wired='1';
 $('#progressIssue').onclick=async()=>{out.value=await makeProgressCode();$('#progressCopy').disabled=false;out.focus();out.select()};
 $('#progressCopy').onclick=async()=>{try{await navigator.clipboard.writeText(out.value);$('#progressCopy').textContent=L('복사됨')}catch{out.focus();out.select()}setTimeout(()=>$('#progressCopy').textContent=L('복사'),1500)};
 $('#progressApply').onclick=async()=>{let o;try{o=await readProgressCode(inp.value)}catch(e){progressMsg(L(e.message==='zip'?'이 브라우저에서는 이 코드를 풀 수 없어요. 브라우저를 최신으로 바꿔 주세요.':'코드가 올바르지 않아요. 빠진 글자 없이 전부 붙여 넣었는지 확인해 주세요.'),'bad');return}
  const n=Object.keys(o.d).length;if(!confirm(L('이 기기의 읽기 기록과 설정을 코드 내용으로 바꿀까요?')+' ('+n+')'))return;
  try{for(let i=localStorage.length-1;i>=0;i--){const k=localStorage.key(i);const nm=k&&k.startsWith(key)?k.slice(key.length):null;if(nm&&PROG_PREFIX.some(x=>nm.startsWith(x)))localStorage.removeItem(k)}
   for(const [k,v] of Object.entries(o.d)){if(PROG_KEYS.includes(k)||PROG_PREFIX.some(x=>k.startsWith(x)))set(k,v)}set('welcomed',true)}catch{progressMsg(L('저장 공간이 부족해서 불러오지 못했어요.'),'bad');return}
  progressMsg(L('불러왔어요. 잠시 뒤 새로 고칩니다.'),'ok');setTimeout(()=>location.reload(),900)}}
const L=s=>window.L?window.L(s):s;
function openUser(){wireProgress();renderQuick();$('#nickname').value=nick();selectUserPage('root');renderUserPanel();$('#userDialog').showModal()}

// ---------- v0.8.0 검색·필터 ----------
let cast=null,castLoading=false;
function ensureCast(){if(cast||castLoading)return;castLoading=true;fetchJSON(dataPath('cast.json')).then(c=>{cast=c;castLoading=false;if($('#search').value.trim())drawLibrary()}).catch(()=>{castLoading=false;cast={characters:{},byCharacter:{},chapterTotals:{}}})}
const norm=t=>String(t||'').toLowerCase().replace(/\s+/g,'');
function roleOf(lines,total,status){
 if(status!=='speaks')return '화면에만 등장';
 const r=total?lines/total:0;return r>=.15?'주연급':r>=.05?'주요 조연':r>=.01?'조연':'잠깐 등장';
}
function renderTagChips(q){
 const host=$('#tagChips');if(!host||!index)return;host.replaceChildren();
 for(const t of index.tagList||[]){const b=el('button','tag-chip'+(norm(q)===norm(t.name)?' selected':''),'#'+t.name);b.type='button';b.onclick=()=>{const s=$('#search');s.value=norm(s.value)===norm(t.name)?'':t.name;openFolderId=null;drawLibrary()};host.append(b)}
}
function searchCard(g,badges=[]){
 const b=el('button','search-card');b.type='button';
 const cat=(index.categories||[]).find(c=>c.id===g.category);
 b.append(el('span','search-card-cat',cat?.name||''),el('strong','',chapterDisplayTitle(g)));
 if(g.subtitle)b.append(el('span','search-card-sub',g.subtitle));
 if(badges.length){const row=el('span','search-badges');badges.forEach(x=>row.append(el('span','search-badge'+(x.cls?' '+x.cls:''),x.text)));b.append(row)}
 b.onclick=()=>{showChapter(groupKey(g),g.category)};return b;
}
function searchSection(host,title,count){const sec=el('section','search-section');const h=el('div','search-head');h.append(el('h3','',title));if(count!=null)h.append(el('span','search-count',count+'건'));sec.append(h);host.append(sec);return sec}
function renderSearch(q,host){
 const nq=norm(q);let any=false;const byId=new Map(displayGroups.map(g=>[g.id,g]));
 // 0. 분류 바로가기 (v0.9.0): 「메인」 → 메인 스토리 목록, 「전체」 → 전체 기록
 const cats=storyCategories.filter(([id,name])=>{const full=norm(name),base=norm(name.replace(/\s*(스토리|기록)$/,''));return base===nq||full===nq||(nq.length>=2&&(base.includes(nq)||full.includes(nq)))||norm(id)===nq});
 if(cats.length){any=true;const sec=searchSection(host,'스토리 분류');const grid=el('div','search-grid');
  for(const [id,name] of cats){const n=displayGroups.filter(g=>categoryMatches(g,id)).length;const b=el('button','search-card search-cat-card');b.type='button';b.append(el('span','search-card-cat','분류'),el('strong','',name+' 목록'),el('span','search-card-sub',n+'개 챕터 · 눌러서 이동'));b.onclick=()=>{$('#search').value='';showHome(id)};grid.append(b)}
  sec.append(grid)}
 // 1. 꼬리표 (기념일·테마)
 const tags=(index.tagList||[]).filter(t=>[t.name,...(t.aliases||[])].some(a=>{const na=norm(a);return na.includes(nq)||(nq.length>=2&&nq.includes(na))}));
 for(const t of tags){
  const groups=displayGroups.filter(g=>(g.tags||[]).includes(t.id));if(!groups.length)continue;any=true;
  const sec=searchSection(host,t.name+' 관련 스토리',groups.length);const grid=el('div','search-grid');groups.forEach(g=>grid.append(searchCard(g)));sec.append(grid);
 }
 // 2. 캐릭터 → 챕터 추천 (비중 순)
 if(!cast){ensureCast();host.append(el('p','search-loading','캐릭터 정보를 불러오는 중…'))}
 else{
  // 「스에요이?」처럼 물음표만 붙은 이름은 본래 이름에 합치고, 「A & B」 함께 말하기는 따로 띄우지 않는다.
  const merged=new Map(),aliasHits=aliasTargets(nq);
  for(const [key,c] of Object.entries(cast.characters||{})){
   if(/[&＆]/.test(c.name))continue;
   const base=c.name.replace(/[?？]+$/,'').trim()||c.name;
   if(!norm(base).includes(nq)&&!aliasHits.some(a=>norm(base)===a||(a.length>=2&&norm(base).startsWith(a))))continue;
   const m=merged.get(base)||{name:base,lines:0,keys:[]};m.lines+=c.lines;m.keys.push(key);merged.set(base,m);
  }
  const chars=[...merged.values()].sort((a,b)=>b.lines-a.lines).slice(0,6);
  for(const c of chars){
   const agg=new Map();
   for(const key of c.keys)for(const r of cast.byCharacter[key]||[]){const x=agg.get(r.group)||{group:r.group,lines:0,status:'appears'};x.lines+=r.lines;if(r.status==='speaks')x.status='speaks';agg.set(r.group,x)}
   const rows=[...agg.values()].map(r=>({...r,g:byId.get(r.group),total:cast.chapterTotals?.[r.group]||0})).filter(r=>r.g);
   if(!rows.length)continue;any=true;
   rows.sort((a,b)=>(a.status!=='speaks')-(b.status!=='speaks')||(b.lines/(b.total||1))-(a.lines/(a.total||1)));
   const sec=searchSection(host,c.name+' 출연 챕터',rows.length);
   sec.append(el('p','search-hint','이 캐릭터가 활약하는 챕터를 비중이 큰 순서로 보여 줍니다. 카드를 누르면 챕터 전체를 볼 수 있어요.'));
   const grid=el('div','search-grid');
   for(const r of rows){const role=roleOf(r.lines,r.total,r.status);grid.append(searchCard(r.g,[{text:role,cls:'role-'+(role==='주연급'?'lead':role==='주요 조연'?'major':role==='조연'?'support':'minor')},{text:r.status==='speaks'?'대사 '+r.lines+'줄':'대사 없음'}]))}
   sec.append(grid);
  }
 }
 // 3. 챕터 이름
 const chapters=displayGroups.filter(g=>[g.title,g.subtitle,chapterDisplayTitle(g),g.officialName].some(v=>norm(v).includes(nq)));
 if(chapters.length){any=true;const sec=searchSection(host,'챕터',chapters.length);const grid=el('div','search-grid');chapters.forEach(g=>grid.append(searchCard(g)));sec.append(grid)}
 // 4. 에피소드 제목
 const eps=[];for(const g of displayGroups)for(const e of sortedEpisodes(g))if(norm(e.title).includes(nq))eps.push({g,e});
 if(eps.length){any=true;const sec=searchSection(host,'에피소드',eps.length);const list=el('div','search-episodes');
  eps.slice(0,60).forEach(({g,e})=>{const b=el('button','search-ep');b.type='button';b.append(el('small','',chapterDisplayTitle(g)+(episodeLabel(e)?' · '+episodeLabel(e):'')),el('strong','',episodeTitle(e)));b.onclick=()=>openEpisode(e.id);list.append(b)});
  if(eps.length>60)list.append(el('p','search-hint','앞의 60건만 보여 줍니다. 검색어를 더 자세히 입력해 보세요.'));sec.append(list)}
 if(!any&&cast)host.append(error('검색 결과가 없습니다.'));
}
function drawLibrary(){
 showOnly('library');bgmLeave();voiceStop();$('#crumb').textContent='';
 const q=$('#search').value.trim().toLowerCase(), host=$('#groups');host.replaceChildren();
 $('#listHead').classList.add('hidden');renderCatTabs();
 if(q){renderSearch(q,host);return}
 if(category==null&&!openFolderId){renderLanding(host);return}
 if(!index){host.append(el('p','loading-note','기록을 불러오는 중…'));return}
 if(!openFolderId){
  const name=(storyCategories.find(([id])=>id===category)||[,'전체 기록'])[1];
  $('#listTitle').textContent=openShelf?name+' › '+openShelf:name;$('#listCount').textContent=displayGroups.filter(g=>categoryMatches(g,category)&&(!openShelf||shelfFor(g)===openShelf)).length+'개 챕터';
  $('#listHead').classList.remove('hidden');
 }
 const visible=displayGroups.filter(g=>categoryMatches(g,category)).map(g=>({g,episodes:sortedEpisodes(g).filter(e=>!q||[e.title,e.description,e.id,g.title,chapterDisplayTitle(g)].some(v=>(v||'').toLowerCase().includes(q)))})).filter(x=>x.episodes.length);
 if(!visible.length){host.append(error('검색 결과가 없습니다.'));return}
 const selected=visible.find(x=>x.g.id===openFolderId||x.g.key===openFolderId);
 if(selected){
  const back=el('button','folder-back');back.append(ic('menu'),document.createTextNode(' '+(selected.g.shelfFolder?shelfFor(selected.g):'폴더 목록')));back.onclick=()=>showHome(category,{shelf:selected.g.shelfFolder?shelfFor(selected.g):null});
  // v0.12.4 (58번) 이전 · 다음 폴더: 같은 분류 목록 순서대로, 튜토리얼처럼 선반 폴더면 그 선반 안에서만. 처음 · 끝은 흐리게
  {const sib=visible.map(x=>x.g).filter(g=>selected.g.shelfFolder?(g.shelfFolder&&shelfFor(g)===shelfFor(selected.g)):!g.shelfFolder);const at=sib.findIndex(g=>g===selected.g);
   const nav=el('div','folder-nav');nav.append(back);
   const mk=(g,dir)=>{const b=el('button','folder-step '+dir);b.type='button';const lab=el('span','folder-step-label',dir==='prev'?'‹ 이전':'다음 ›');b.append(lab);if(g){b.append(el('small','folder-step-name',chapterDisplayTitle(g)));b.onclick=()=>showChapter(groupKey(g),category)}else b.disabled=true;return b};
   const steps=el('div','folder-steps');steps.append(mk(at>0?sib[at-1]:null,'prev'),mk(at>=0&&at<sib.length-1?sib[at+1]:null,'next'));nav.append(steps);host.append(nav)}
  const panel=el('section','folder-detail');const art=el('div','folder-art');art.dataset.gid=selected.g.id;art.append(el('div','folder-art-kicker','42LAB / CHAPTER RECORD'),el('div','folder-art-symbol','◇'),el('h2','',chapterDisplayTitle(selected.g)),el('p','folder-art-pending','CHAPTER IMAGE PENDING'));applyFolderArt(art);
  const side=el('div','folder-episodes');
  const episodeScroll=el('div','folder-episode-scroll');
  const header=el('div','folder-episodes-header');
  const heading=el('div','folder-episodes-title');
  heading.append(el('div','eyebrow','EPISODE INDEX'),el('h2','',chapterDisplayTitle(selected.g)));if(selected.g.subtitle)heading.append(el('p','chapter-subtitle',selected.g.subtitle));if(selected.g.note)heading.append(el('p','chapter-note',selected.g.note));
  header.append(heading);
  // v0.9.1: 구역(본편·다크존·메모리…)과 종류(전투 중 대사…) 버튼은 「골라 보기」. 누른 묶음만 목록에 남긴다.
  const tabs=chapterTabs(selected.g,selected.episodes),gid=groupKey(selected.g);
  let tabId=chapterTabMemory.get(gid);if(!tabs.some(t=>t.id===tabId))tabId=tabs[0]?.id;
  if(tabs.length>1){
   const nav=el('nav','chapter-section-nav');nav.setAttribute('aria-label','챕터 안 골라 보기');
   for(const t of tabs){const b=el('button','chapter-section-jump'+(t.id===tabId?' active':''));b.type='button';b.dataset.tab=t.id;b.append(el('span','',t.title),el('small','tab-count',String(t.eps.length)));b.setAttribute('aria-pressed',String(t.id===tabId));b.onclick=()=>{chapterTabMemory.set(gid,t.id);drawLibrary()};nav.append(b)}
   header.append(nav);
  }
  side.append(header,episodeScroll);
  const tab=tabs.find(t=>t.id===tabId);
  let prevDesc=null;
  for(const ep of tab?.eps||[]){
   const battle=ep.kind==='battleDialog';
   const row=el('button','folder-episode section-'+(tab.style||'standard'));
   const num=el('span','folder-episode-num',episodeNumber(ep));
   const txt=el('span','folder-episode-text');
   txt.append(el('strong','',battle?(ep.battle?.stageName||episodeTitle(ep).replace(/^전투 중 대사 · /,'')):episodeTitle(ep)));
   if(battle&&ep.follows){const f=findEpisode(ep.follows);if(f)txt.append(el('small','follows-note','본편 '+episodeNumber(f.e)+' 「'+episodeTitle(f.e)+'」 다음'))}
   if(ep.map)txt.append(el('small','follows-note',ep.map.num+'번 맵 · '+ep.map.name));
   // 같은 스테이지 전투 대사는 소개 문구가 같으므로 처음 한 번만
   if(ep.description&&!(battle&&ep.description===prevDesc))txt.append(el('small','',ep.description));prevDesc=ep.description;
   if(ep.part?.number&&ep.part?.total)txt.append(el('small','',ep.part.number+'/'+ep.part.total));
   {const a=el('span','folder-episode-arrow');a.append(ic('right'));row.append(num,txt,a)}
   row.onclick=()=>openEpisode(ep.id);episodeScroll.append(row);
  }
  panel.append(art,side);host.append(panel);
 }else{
  const makeCard=({g,episodes},i)=>{
   const b=el('button',viewMode==='folder'?'drive-tile':viewMode==='list'?'chapter-list-row':'folder-tile');
   b.type='button';
   const title=chapterDisplayTitle(g);
   if(viewMode==='file'){
    const visual=el('div','folder-tile-visual');visual.dataset.gid=g.id;
    visual.append(el('span','folder-tile-code','42LAB / '+String(i+1).padStart(2,'0')),el('span','folder-tile-symbol','◇'));
    const info=el('div','folder-tile-info');info.append(el('strong','',title));if(g.subtitle)info.append(el('span','chapter-card-subtitle',g.subtitle));info.append(el('small','',episodes.length+'개 기록'));
    b.append(visual,info);
   }else if(viewMode==='folder'){
    b.append(el('span','drive-folder-icon','▰'));
    const info=el('span','drive-folder-info');info.append(el('strong','',title));if(g.subtitle)info.append(el('span','chapter-card-subtitle',g.subtitle));info.append(el('small','',episodes.length+'개 기록'));b.append(info);
   }else{
    b.append(el('span','chapter-list-icon','≡'));
    const info=el('span','chapter-list-info');info.append(el('strong','',title));if(g.subtitle)info.append(el('span','chapter-card-subtitle',g.subtitle));info.append(el('small','',episodes.length+'개 기록'));
    {const a=el('span','chapter-list-arrow');a.append(ic('right'));b.append(info,a)}
   }
   {const v=b.querySelector('.folder-tile-visual');if(v)applyFolderArt(v)}
   b.onclick=()=>g._folder?showHome(category,{shelf:g.shelf}):showChapter(groupKey(g));
   if(g._folder){b.classList.add('shelf-folder-card');const sm=b.querySelector('small');if(sm)sm.textContent=g._count+'개 폴더 · '+episodes.length+'개 기록'}
   return b;
  };
  // v0.9.2 폴더 안 폴더: shelfFolder 묶음은 「그 외」에서 상위 폴더 카드 하나로, 누르면 세부 폴더
  let items=visible;
  if(openShelf){
   items=visible.filter(x=>shelfFor(x.g)===openShelf);
   const catName=(storyCategories.find(([id])=>id===category)||[,''])[1];
   const up=el('button','folder-back');up.append(ic('left'),document.createTextNode(' '+catName));up.onclick=()=>showHome(category);host.append(up);
  }else{
   const folders=new Map();items=[];
   for(const x of visible){
    if(x.g.shelfFolder){const k=shelfFor(x.g);let f=folders.get(k);if(!f){f={g:{id:'shelf:'+k,title:k,shelf:k,category:x.g.category,_folder:true,_count:0},episodes:[]};folders.set(k,f);items.push(f)}f.g._count++;f.episodes.push(...x.episodes)}
    else items.push(x);
   }
  }
  // Keep main story's chronology as a continuous list; group special stories into shelves.
  if(category==='all'&&!openShelf){
   host.append(renderCategorySections(items,makeCard));
  }else if(!openShelf&&items.some(x=>shelfFor(x.g))){
   host.append(renderShelfSections(items,makeCard));
  }else{
   const grid=el('div',viewMode==='folder'?'drive-grid':viewMode==='list'?'chapter-list':'folder-grid');
   items.forEach((item,i)=>grid.append(makeCard(item,i)));
   host.append(grid);
  }

 }
}
// Tab labels are presentation only. Category assignments and chapter order belong to Cherry's index.json.
// 목록 데이터가 오기 전에도 분류 버튼이 보이도록 기본값을 둔다 (데이터가 오면 그 값으로 바뀜)
let storyCategories=[['main','메인 스토리'],['exclusive','전속 스토리'],['event','이벤트 스토리'],['other','그 외'],['all','전체 기록']];
// Accept legacy category spellings if they appear in the index, without rewriting the source.
const categoryAliases={companion:'companionship',accompany:'companionship',courtesy:'companionship',donghaeng:'companionship',misc:'other',etc:'other'};
const displayCategory=value=>categoryAliases[value]||value;
const legacySpecialKeys=new Set(['1year','2year','23christ','23oath','24oath']);
const effectiveCategory=group=>displayCategory(group.category);
const categoryMatches=(group,selected)=>selected==='all'||effectiveCategory(group)===selected;
function chapterDisplayTitle(group){
 const title=group.title||group.key||'';
 // New chapter numbering is supplied by Cherry; no frontend-generated number.
 const chapter=group.chapterNo??group.chapterNumber??null;
 if(chapter===null||chapter==='')return title;
 const n=String(chapter);
 return title.startsWith(n+' ')||title.startsWith(n+'.')?title:n+'. '+title;
}

function renderCatTabs(){
 const nav=$('#catTabs');if(!nav)return;
 const want=storyCategories.filter(([id])=>id!=='all').length+1;
 if(nav.childElementCount!==want){nav.replaceChildren();const h=el('button','cat-tab cat-home','홈');h.type='button';h.dataset.category='';h.onclick=()=>{$('#search').value='';showHome(null)};nav.append(h);for(const [id,name] of storyCategories.filter(([id])=>id!=='all')){const b=el('button','cat-tab',name.replace(/\s*스토리$/,''));b.type='button';b.dataset.category=id;b.onclick=()=>{$('#search').value='';showHome(id)};nav.append(b)}}
 nav.querySelectorAll('.cat-tab').forEach(b=>{const on=b.dataset.category===(category??'')&&!openFolderId||(b.dataset.category!==''&&b.dataset.category===category);b.classList.toggle('selected',on);b.setAttribute('aria-pressed',String(on))});
}
function initIndex(d){index=d;storyCategories=[...(d.categories||[]).map(c=>[c.id,c.name]),['all','전체 기록']];displayGroups=makeDisplayGroups(d.groups||[]);drawLibrary()}
// ---------- v0.9.0 첫 화면: 공지 · 일러스트 · 피드백/다른 사이트 ----------
function deviceLabel(){
 const ua=navigator.userAgent||'';
 const os=/iPhone/.test(ua)?'iPhone':/iPad/.test(ua)||(/Macintosh/.test(ua)&&navigator.maxTouchPoints>1)?'iPad':/Android/.test(ua)?'Android':/Windows/.test(ua)?'Windows':/Mac OS X|Macintosh/.test(ua)?'Mac':/Linux/.test(ua)?'Linux':'기타';
 const br=/SamsungBrowser/.test(ua)?'Samsung Internet':/Edg\//.test(ua)?'Edge':/Whale/.test(ua)?'Whale':/NAVER/.test(ua)?'NAVER':/KAKAOTALK/.test(ua)?'KakaoTalk':/Firefox|FxiOS/.test(ua)?'Firefox':/Chrome|CriOS/.test(ua)?'Chrome':/Safari/.test(ua)?'Safari':'기타';
 return os+' '+br;
}
// 오류 코드 기능이 생기면 feedbackURL({code:'E301'})로 부른다. 칸 번호는 site_info.json의 feedback.prefill에 있다.
function feedbackURL({code}={}){
 const fb=siteInfo?.home?.feedback||{},pre=fb.prefill;
 if(!pre?.base||!pre.byLang)return fb.form||'';
 const L=pre.byLang[uiLang()]||pre.byLang.ko;if(!L)return fb.form||'';
 const p=[['usp','pp_url'],[pre.language,L.language],[L.device,deviceLabel()]];
 if(code)p.push([L.type,L.typeError],[L.code,code]);
 return pre.base+'?'+p.map(([k,v])=>k+'='+encodeURIComponent(v)).join('&');
}
function landingCard(cls,title,icon){const card=el('section','home-card '+cls);const head=el('div','home-card-head');if(icon){const s=el('span','home-card-icon');s.append(ic(icon));head.append(s)}head.append(el('h2','',title));card.append(head);return card}
function noticeDate(n){return n.date?String(n.date).replaceAll('-','.'):''}
function renderLanding(host){
 const home=siteInfo?.home||{},wrap=el('div','home-grid'),fb=home.feedback||{};
 // 모바일: 「외부 링크」 단추 줄(옆으로 밀기) — PC에서는 숨김
 const ext=el('section','home-ext');ext.append(el('div','tb-label','외부 링크'));
 const chips=el('nav','home-chips');chips.setAttribute('aria-label','외부 링크');
 const chip=(label,href,cls='')=>{const a=el(href?'a':'span','home-chip'+(cls?' '+cls:'')+(href?'':' disabled'),label);if(href){a.href=href;a.target='_blank';a.rel='noopener'}chips.append(a)};
 for(const s of home.otherSites||[])chip(s.name+(s.url?'':' · 준비 중'),s.url||'');
 chips.append(el('span','home-chip-sep','│'));
 chip('피드백 폼',feedbackURL()||fb.form||'','primary');chip('X '+(fb.xHandle||''),fb.x||'');
 ext.append(chips);host.append(ext);
 // 공지 (리스트)
 const notice=landingCard('home-notice','공지','menu');const list=el('div','notice-list');
 const notices=sortedNotices();
 if(!notices.length)list.append(el('p','bm-empty',siteInfo?'등록된 공지가 없습니다.':'공지를 불러오는 중…'));
 for(const n of notices){const b=el('button','notice-row'+(n.pinned?' pinned':''));b.type='button';b.append((()=>{const s=el('span','notice-pin');if(n.pinned)s.append(ic('pin'));return s})(),el('span','notice-date',noticeDate(n)),el('span','notice-title',n.title||''));b.onclick=()=>openNotice(n);list.append(b)}
 notice.append(list);
 // 생일 달력 (PC만)
 const cal=landingCard('home-birthday','생일');renderBirthday(cal);
 // 다른 사이트 · 피드백 (PC만)
 const side=el('div','home-side');
 const other=landingCard('home-other','Other');
 for(const s of home.otherSites||[]){const a=el(s.url?'a':'div','home-link'+(s.url?'':' disabled'));if(s.url){a.href=s.url;a.target='_blank';a.rel='noopener'}a.append(el('strong','',s.name),el('small','',s.url?(s.desc||''):(s.desc?s.desc+' · ':'')+'준비 중'));other.append(a)}
 if(!(home.otherSites||[]).length)other.append(el('p','bm-empty','준비 중'));
 const fbCard=landingCard('home-feedback','피드백');fbCard.append(...feedbackLinks());
 side.append(other,fbCard);
 wrap.append(notice,cal,side);host.append(wrap);
}
function sortedNotices(){return [...(siteInfo?.notices||[])].sort((a,b)=>(b.pinned===true)-(a.pinned===true)||String(b.date||'').localeCompare(String(a.date||'')))}
function openNotice(n){openInfo({title:n.title,items:[{title:noticeDate(n),lines:n.lines||[]}]})}
function feedbackLinks(){
 const fb=siteInfo?.home?.feedback||{};
 const form=el('a','home-link primary');form.href=feedbackURL()||fb.form||'#';form.target='_blank';form.rel='noopener';form.append(el('strong','','피드백 폼'),el('small','','오류 · 오탈자 · 기능 제안은 폼으로 먼저 보내 주세요.'));
 const x=el('a','home-link');x.href=fb.x||'#';x.target='_blank';x.rel='noopener';x.append(el('strong','','X '+(fb.xHandle||'')),el('small','','개인 연락 · 급한 문의만. 제보는 폼 제출을 우선 부탁드려요.'));
 return [form,x];
}
// ---------- v0.9.3 생일 달력 ----------
// 날짜는 한국 시간 새벽 5시에 바뀐다 (게임 서버 갱신 시각)
function gameToday(){const t=new Date(Date.now()+(9-5)*3600e3);return {y:t.getUTCFullYear(),m:t.getUTCMonth()+1,d:t.getUTCDate()}}
let dolls=null;
let calShift=0; // 0 = 이번 달, -1 = 지난달, +1 = 다음 달
function renderBirthday(card){
 const T=gameToday(),todayKey=String(T.m).padStart(2,'0')+String(T.d).padStart(2,'0');
 const box=el('div','cal-box');const cards=el('div','bday-list');
 let picked=null; // 달력에서 누른 날 (MMDD). 없으면 오늘
 const showCards=()=>{
  cards.replaceChildren();const key=picked||todayKey,isToday=key===todayKey;
  const who=(dolls?.dolls||[]).filter(x=>x.birthday===key);
  if(!dolls){cards.append(el('p','bm-empty','생일 정보를 불러오는 중…'));return}
  if(!isToday){const h=el('div','bday-pick-head');const back=el('button','bday-back','오늘로');back.type='button';back.onclick=()=>{picked=null;draw();showCards()};h.append(el('span','',key.slice(0,2)+'.'+key.slice(2)+' 생일'),back);cards.append(h)}
  if(!who.length)cards.append(el('p','bm-empty',isToday?'오늘 생일인 인형이 없어요.':'이날 생일인 인형이 없어요.'));
  for(const x of who){
   const c=el('div','bday-card'+(isToday?' today':''));
   const face=el('div','avatar bday-face');const url=(x.portrait&&imageMap[x.portrait])||imageMap[x.nameKo]||imageMap[x.name];
   if(url){const im=document.createElement('img');im.src=url.startsWith('./')?url:'./'+url;im.alt='';im.onerror=()=>{im.remove();face.classList.add('fallback')};face.append(im)}else face.classList.add('fallback');
   const t=el('div','bday-text');t.append(el('strong','',x.birthday+'. Happy Birthday!'),el('span','',x.name));
   c.append(face,t);cards.append(c);
  }
 };
 const draw=()=>{
  const v=new Date(Date.UTC(T.y,T.m-1+calShift,1)),Y=v.getUTCFullYear(),M=v.getUTCMonth()+1,mm=String(M).padStart(2,'0');
  const head=el('div','cal-head');
  const prev=el('button','cal-nav');prev.append(ic('left'));prev.type='button';prev.setAttribute('aria-label','이전 달');prev.onclick=()=>{calShift--;draw()};
  const next=el('button','cal-nav');next.append(ic('right'));next.type='button';next.setAttribute('aria-label','다음 달');next.onclick=()=>{calShift++;draw()};
  const title=el('button','cal-title',Y+'.'+mm);title.type='button';title.title='이번 달로';title.onclick=()=>{calShift=0;picked=null;draw();showCards()};
  head.append(prev,title,next);
  const grid=el('div','cal-grid');['일','월','화','수','목','금','토'].forEach(w=>grid.append(el('span','cal-w',w)));
  const list=(dolls?.dolls||[]).filter(x=>x.birthday&&x.birthday.slice(0,2)===mm);
  const days=new Set(list.map(x=>+x.birthday.slice(2)));
  const first=v.getUTCDay(),last=new Date(Date.UTC(Y,M,0)).getUTCDate();
  for(let i=0;i<first;i++)grid.append(el('span','cal-d blank',''));
  for(let d=1;d<=last;d++){
   const key=mm+String(d).padStart(2,'0'),cls='cal-d'+(days.has(d)?' bday':'')+(calShift===0&&d===T.d?' today':'')+(picked===key?' picked':'');
   // v0.9.12 생일 동그라미는 눌러서 그날 생일인 인형을 아래에 보여줌
   const c=days.has(d)?el('button',cls,String(d)):el('span',cls,String(d));
   if(days.has(d)){const names=list.filter(x=>+x.birthday.slice(2)===d).map(x=>x.name).join(', ');c.type='button';c.title=names;c.setAttribute('aria-label',M+'월 '+d+'일 생일: '+names);c.setAttribute('aria-pressed',String(picked===key));
    c.onclick=()=>{picked=(picked===key||key===todayKey)?null:key;draw();showCards()}}
   grid.append(c);
  }
  box.replaceChildren(head,grid);
 };
 draw();card.append(box);showCards();
 card.append(cards,el('p','cal-note','동그라미를 누르면 그날 생일인 인형을 볼 수 있어요. 매일 오전 5시(KST)에 갱신됩니다.'));
}
// Hierarchical navigation: category label navigates, chevron expands chapter links.
function closeArchiveMenu(){const menu=$('#archiveMenu');menu.classList.remove('open');menu.setAttribute('aria-hidden','true');$('#menuBtn').setAttribute('aria-expanded','false');$('#menuBtn').classList.remove('is-open')}
function renderArchiveMenu(){
 // v0.9.15 메뉴: 홈 / 전체 기록 ▶ (메인 · 전속 · 이벤트 · 그 외 ▶ → 챕터 · 폴더)
 const host=$('#archiveMenuList');host.replaceChildren();
 const homeLink=el('button','archive-menu-link archive-menu-home','홈');homeLink.type='button';homeLink.onclick=()=>{closeArchiveMenu();$('#search').value='';showHome(null)};host.append(homeLink);
 const foldRow=(name,onLabel,fill,cls)=>{
  const row=el('div','archive-menu-category'+(cls?' '+cls:''));const line=el('div','archive-menu-line');
  const label=el('button','archive-menu-link',name);label.type='button';label.onclick=onLabel;
  const children=el('div','archive-menu-children');const inner=el('div','archive-menu-children-inner');children.append(inner);
  const arrow=el('button','archive-menu-expand');arrow.type='button';arrow.append(ic('right','tri'));
  arrow.setAttribute('aria-label',name+' 펼치기');arrow.setAttribute('aria-expanded','false');
  arrow.onclick=()=>{const ex=row.classList.toggle('expanded');arrow.setAttribute('aria-expanded',String(ex))};
  fill(inner);line.append(label,arrow);row.append(line,children);return row;
 };
 const allRow=foldRow('전체 기록',()=>{closeArchiveMenu();$('#search').value='';showHome('all')},inner=>{
  for(const [id,name] of storyCategories.filter(([id])=>id!=='all')){
   inner.append(foldRow(name,()=>{closeArchiveMenu();showHome(id)},box=>{
    for(const g of displayGroups.filter(g=>categoryMatches(g,id))){const link=el('button','archive-menu-chapter',chapterDisplayTitle(g));link.type='button';link.onclick=()=>{closeArchiveMenu();showChapter(groupKey(g),id)};box.append(link)}
   },'archive-menu-sub'));
  }
 },'archive-menu-top');
 host.append(allRow);
 // v0.10.0 인형 기록
 const dollLink=el('button','archive-menu-link archive-menu-home archive-menu-dolls','인형 기록');dollLink.type='button';dollLink.onclick=()=>{closeArchiveMenu();$('#search').value='';showDolls()};host.append(dollLink);
}
$('#menuBtn').onclick=()=>{const menu=$('#archiveMenu');if(!menu.classList.contains('open')){renderArchiveMenu();menu.classList.add('open');menu.removeAttribute('aria-hidden');$('#menuBtn').setAttribute('aria-expanded','true');$('#menuBtn').classList.add('is-open')}else closeArchiveMenu()};
$('#archiveMenuClose').onclick=closeArchiveMenu;
$('#archiveMenuBackdrop').onclick=closeArchiveMenu;
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeArchiveMenu()});


// v0.11.0 교수 말투: 일본어 등은 여성 교수 말투가 따로 있음 (unit.alt.f) → 교수 모습이 여성이면 그 글로
const gz=o=>o&&o.alt&&o.alt.f&&profGender()==='f'?{...o,...o.alt.f}:o;
function spans(parent,unit){
 unit=gz(unit);
 const arr=unit.spans||[{text:unit.displayText||''}];
 for(const part of arr){
  const raw=part.professorName?nick():part.text||'';
  const styles=part.styles||[],lore=styles.find(x=>x.type==='worldRecord');
  const pieces=raw.split('\n');
  pieces.forEach((text,i)=>{
   if(i){const br=el('span','paragraph-break');br.setAttribute('aria-hidden','true');parent.append(br)}
   if(!text)return;
   const n=lore?el('button','world',text):el('span','',text);
   if(styles.some(x=>x.type==='accent'))n.classList.add('em');
   if(styles.some(x=>x.type==='bold'))n.style.fontWeight='700';
   if(lore)n.onclick=()=>showLore(lore.id);
   parent.append(n);
  });
 }
}
function showLore(id){let record=(data.worldRecords||{})[String(id)]||{};$('#loreTitle').textContent=record.name||'세계기록 '+id;$('#loreText').textContent=record.description||'설명 정보가 없습니다.';$('#lore').showModal()}
let imageMap={},speakerAliases={};
const SYSTEM_SPEAKERS=new Set(['시스템','시스템 음성','통신 시스템']);
function isProfessor(who){return who?.isProfessor===true}
function avatarFor(who,entry){
 const av=el('div','avatar');av.setAttribute('aria-label',(who.name||'알 수 없음')+' 프로필');
 // v0.9.10 말하는 인물의 그림(무대 위 같은 imgId)을 먼저 → 이름 → 무대에 한 명뿐일 때 그 그림
 if(who.noFace){av.classList.add('unknown');return av} // v0.12.5 얼굴을 일부러 비우는 화자 (이놀라 전속 2화 끝 새 인형 · 채운)
 const chars=entry.stage?.characters||[],faceIds=new Set((who.faces||[]).map(x=>x.imgId));
 const facePaths=chars.filter(c=>faceIds.has(c.imgId)).map(c=>c.path);const lone=chars.length===1&&!faceIds.size?[chars[0].path]:[];
 const speakerKey=who.heroId!=null?'hero:'+who.heroId:'name:'+(who.lookup||who.rawName||'');const portraitKey=speakerAliases[speakerKey];const ids=[who.portrait,...facePaths,portraitKey,speakerKey,String(who.heroId??''),who.lookup,who.rawName,who.name,...lone].filter(Boolean);
 // v0.9.13 회차별 얼굴 바꾸기 (예: 집도 시점의 페르시카)
 const ov=data?.meta?.portraitOverride;
 let url=ids.map(k=>imageMap[(ov&&ov[k])||k]).find(Boolean);
 if(url&&typeof url==='string'&&!url.startsWith('http')&&!url.startsWith('//')&&!url.startsWith('data:')){
  const img=document.createElement('img');img.loading='lazy';img.decoding='async';img.alt='';img.src=url.startsWith('/')?'.'+url:url.startsWith('./')?url:'./'+url.replace(/^\/+/, '');img.onerror=()=>{img.remove();av.classList.add('unknown')};av.append(img);
 }else av.classList.add('unknown'); // v0.9.14a 얼굴 그림이 없는 화자(??? · 엑스트라) = 사람 모양 실루엣
 return av;
}
function createUnit(block,unit,entry,context=''){
 let kind=block.kind,outer=el('div','entry '+context);outer.dataset.uid=unit.uid||block.id;
 if(unit.kind==='action'||unit.isAction===true||unit.style==='action'||kind==='action'){
  // Only explicitly classified stage directions are rendered without a speech bubble.
  const action=el('div','center-item action-direction');spans(action,unit);outer.append(action);
 }else if(kind==='dialogue'&&!isProfessor(block.speaker)&&SYSTEM_SPEAKERS.has(String(block.speaker?.name||'').trim())){
  // v0.9.1: 「시스템」 계열은 말풍선 대신 안내 상자
  const box=el('div','center-item system-box');box.append(el('span','system-tag','SYSTEM ›'));const body=el('span','system-text');spans(body,unit);box.append(body);outer.append(box);
 }else if(kind==='dialogue'){
  let who=block.speaker||{},right=isProfessor(who),first=entry.group?.first!==false,chat=el('div','chat'+(right?' right':''));
  if(!right){chat.append(first?avatarFor(who,entry):el('div','avatar-spacer'))}
  let main=el('div','chat-main');
  if(first&&(!right||who.professorVariant==='role'||who.professorVariant==='joint')){const label=el('div','name');if(who.nameSpans)spans(label,{spans:who.nameSpans});else label.textContent=who.name||nick();main.append(label)}
  let bubble=el('div','bubble'+(unit.monologue?' mono':'')+(first?' tail':''));spans(bubble,unit);main.append(bubble);chat.append(main);outer.append(chat);
 }else{
  const raw=String(unit.displayText||(unit.spans||[]).map(x=>x.text||'').join(''));
  const cm=raw.match(/^\s*(>>)\s*((?:SPECIAL\s+)?CHAPTER\s*\d*)\s*(\/\/)\s*([\s\S]*)$/i);
  if(cm&&(kind==='scene'||kind==='narration')){
   // v0.9.2 챕터 제목 줄: 콘솔 한 줄 (B안)
   const end=/E\s*N\s*D/.test(cm[4]);const c=el('div','center-item chapter-line'+(end?' is-end':''));
   c.append(el('span','cl-mark','>> '),el('span','cl-chapter',cm[2].replace(/\s+/g,' ').trim()),el('span','cl-sep',' // '),el('span','cl-title',cm[4].replace(/\u00a0/g,' ').replace(/\s{2,}/g,' ').trim()),el('span','cl-cursor','▌'));
   outer.append(c);return outer;
  }
  let cls=unit.style==='letter'?'letter':kind==='scene'?'scene':kind==='warning'?'warning':'narration';
  let c=el('div','center-item '+cls);spans(c,unit);outer.append(c)
 }return outer
}
// Cherry v2: only explicit option.display === "action" is an action direction.
// Never infer action status from parentheses, nor alter the stored source text.
function makeSelectedChoiceEntry(opt,uid){
 opt=gz(opt);
 const entry=el('div','entry choice-spoken'+(opt.display==='action'?' choice-action':''));
 if(uid)entry.dataset.uid=uid;
 const raw=String(opt.displayText??opt.rawText??'');
 if(opt.display==='action'){
  const text=raw.trim().replace(/^\(([\s\S]*)\)$/,'$1').trim();
  const direction=el('div','center-item action-direction choice-action-text',text);
  entry.append(direction);
 }else{
  const mono=/^\([\s\S]*\)$/.test(raw.trim());
  const chat=el('div','chat right'),main=el('div','chat-main'),bubble=el('div','bubble tail'+(mono?' mono':''));
  if(mono)bubble.textContent=raw.trim().slice(1,-1).trim();
  else spans(bubble,{spans:opt.spans||[{text:raw}]});
  main.append(bubble);chat.append(main);entry.append(chat);
 }
 return entry;
}
function showChoice(node,target){
 const b=data.blocks[node.choice],info=b?.choice;if(!info){target.append(error('선택지 데이터를 찾을 수 없습니다: '+node.choice));cursor++;pump();return}
 const mode=node.mode||'branch',opts=info.options||[],isAll=mode==='selectAll',isRevisit=mode==='revisit';
 const box=el('section','entry choice');box.dataset.uid=node.choice;
 box.append(el('h3','',isAll?'모든 질문을 확인하세요':isRevisit?'질문을 선택해 확인하세요':mode==='branch'?'선택지 · 다른 갈래도 볼 수 있습니다':'선택지를 골라 진행하세요'));
 const area=el('div','choice-output'),gate=el('p','choice-note status','선택해야 다음 대화로 진행합니다.');
 const chosen=new Set(),controls=[],paths=new Map();
 function renderParts(parts,holder){
  for(const n of parts||[]){
   if(n.ref){const block=data.blocks[n.ref];for(const u of block?.units||[])holder.append(createUnit(block,u,n,'branch-entry'))}
   else if(n.choice){
    const nested=el('div','nested-choice');nested.dataset.pending='true';holder.append(nested);
    const child=data.blocks[n.choice]?.choice?.options||[];
    for(const opt of child){
     const button=el('button','option',gz(opt).displayText||'선택 '+opt.index),slot=el('div','nested-output');
     nested.append(button,slot);
     button.onclick=()=>{nested.dataset.pending='false';nested.querySelectorAll(':scope > .option').forEach(x=>x.classList.toggle('selected',x===button));nested.querySelectorAll(':scope > .nested-output').forEach(x=>x.replaceChildren());const match=(n.options||[]).find(x=>x.index===opt.index);const r=makeSelectedChoiceEntry(opt,n.choice+'.selected.'+opt.index);slot.append(r);renderParts(match?.path||[],slot);if(!slot.querySelector('.nested-choice[data-pending="true"]'))resumeFlow();refreshPositions()};
    }
   }
  }
 }
 function appendBranch(opt,holder){
  const pathInfo=(node.options||[]).find(o=>o.index===opt.index);
  if(opt.displayText||opt.rawText){
   holder.append(makeSelectedChoiceEntry(opt,node.choice+'.selected.'+opt.index));
  }
  renderParts(pathInfo?.path||[],holder);
 }
 function resumeFlow(){
  if(box.dataset.resumed)return;
  if(area.querySelector('.nested-choice[data-pending="true"]'))return;
  box.dataset.resumed='true';cursor++;
  if(node.continueAt===null){$('#ending').classList.remove('hidden');refreshPositions();requestAnimationFrame(checkBottom);return}
  pump();
 }
 opts.forEach((opt,i)=>{
  if(i)box.append(el('div','choice-separator'));
  const btn=el('button','option',gz(opt).displayText||'선택 '+opt.index);controls.push(btn);box.append(btn);
  btn.onclick=()=>{
   if(opt.exit===true){chosen.add(opt.index);set('choices.'+current+'.'+node.choice,[...chosen]);btn.classList.add('selected');gate.textContent='질문을 마쳤습니다.';resumeFlow();refreshPositions();return}
   if(isAll||isRevisit){
    if(chosen.has(opt.index)){paths.get(opt.index)?.scrollIntoView({behavior:'smooth',block:'center'});return}
    chosen.add(opt.index);btn.classList.add('selected');
    if(chosen.size>1)area.append(el('div','branch-divider','다음 질문'));
    const segment=el('div','branch-segment');segment.dataset.branch=String(opt.index);
    appendBranch(opt,segment);area.append(segment);paths.set(opt.index,segment);
    const required=opts.filter(o=>!o.exit).length;
    gate.textContent=`${chosen.size}/${required}개 확인`;
    if(isAll&&chosen.size>=required&&!opts.some(o=>o.exit)){gate.textContent='모든 질문을 확인했습니다.';resumeFlow()}
    if(isRevisit&&!opts.some(o=>o.exit)&&chosen.size>=required){gate.textContent='모든 질문을 확인했습니다.';resumeFlow()}
   }else{
    chosen.clear();chosen.add(opt.index);controls.forEach(x=>x.classList.toggle('selected',x===btn));
    area.replaceChildren();const segment=el('div','branch-segment');appendBranch(opt,segment);area.append(segment);
    gate.textContent=mode==='branch'?'다른 선택지를 눌러 갈래를 바꿔 볼 수 있습니다.':'선택한 대사로 이어집니다.';
    resumeFlow();
   }
   set('choices.'+current+'.'+node.choice,[...chosen]);refreshPositions();
  };
 });
 const viewAll=el('button','choice-view-all','전부 보기');viewAll.type='button';box.append(viewAll);
 viewAll.onclick=()=>{
  // Render every branch in the normal reading stream (not a limited-height preview).
  // A choice is shown once, with each branch's dialogue/action in its original order.
  if(box.dataset.allExpanded)return;
  box.dataset.allExpanded='true';
  area.replaceChildren();chosen.clear();paths.clear();
  for(const opt of opts){
   if(opt.exit)continue;
   chosen.add(opt.index);
   if(paths.size)area.append(el('div','branch-divider','다음 선택지'));
   const segment=el('section','branch-segment');segment.dataset.branch=String(opt.index);
   appendBranch(opt,segment);area.append(segment);paths.set(opt.index,segment);
  }
  controls.forEach(btn=>{btn.disabled=true;btn.classList.add('view-all-selected')});
  viewAll.disabled=true;viewAll.textContent='모든 갈래 펼침';
  gate.textContent='모든 선택지의 내용이 아래에 순서대로 표시됩니다.';
  set('choices.'+current+'.'+node.choice,[...chosen]);
  resumeFlow();refreshPositions();
 };
 target.append(box,area,gate);
}
function refreshPositions(){positions=[...document.querySelectorAll('#stream > .entry, #stream > .choice-output .entry')];if(observer)observer.disconnect();observe()}
function pump(){while(cursor<flowNodes.length){let node=flowNodes[cursor];if(node.choice){showChoice(node,$('#stream'));refreshPositions();return}if(node.ref){let b=data.blocks[node.ref];maybeCG(node,$('#stream'));maybeBgmMark(node,$('#stream'));if(b){for(let unit of b.units||[])$('#stream').append(createUnit(b,unit,node))}}cursor++}$('#ending').classList.remove('hidden');refreshPositions();requestAnimationFrame(checkBottom)}
// ---------- v0.9.1 CG ----------
// 장면 배경 중 이름에 cg가 든 것 = CG. assets/cg/manifest.json에 있는 파일만 보여 준다 (없는 파일 요청을 만들지 않기 위해).
let cgSet=new Set(),lastCG=null;
// v0.9.9 챕터(폴더) 일러스트: assets/folder/manifest.json = {그룹 id: 파일 이름}. 바깥 카드는 작은 그림(s/), 안쪽 칸은 큰 그림
let folderArt=null;
function applyFolderArt(node){const slug=folderArt?.[node.dataset.gid];if(!slug||node.classList.contains('has-art'))return;
 const big=node.classList.contains('folder-art'),img=document.createElement('img');img.className='folder-art-img';img.alt='';img.decoding='async';if(!big)img.loading='lazy';
 img.src='./assets/folder/'+(big?'':'s/')+slug+'.webp';{const ps=folderArt?._pos?.[node.dataset.gid];if(ps&&!big)img.style.objectPosition=({top:'50% 0%',upper:'50% 15%',center:'50% 50%',lower:'50% 75%',bottom:'50% 100%'})[ps]||ps}img.onload=()=>node.classList.add('art-ready');img.onerror=()=>{img.remove();node.classList.remove('has-art')};
 node.classList.add('has-art');node.prepend(img)}
fetchJSON('./assets/folder/manifest.json',1).then(m=>{folderArt=m||{};document.querySelectorAll('[data-gid]').forEach(applyFolderArt)}).catch(()=>{folderArt={}});
fetchJSON('./assets/cg/manifest.json',1).then(m=>{cgSet=new Set(Array.isArray(m)?m:(m.files||[]))}).catch(()=>{});
const cgMode=()=>{const m=get('cgMode',null);if(m==='off'||m==='on')return m;if(m==='large'||m==='small')return 'on';return get('showCG',true)===false?'off':'on'};
const cgSrc=p=>'./assets/cg/'+p+'.webp';
function maybeCG(node,target){
 const raw=(node.stage?.backgrounds||[]).find(x=>/cg/i.test(String(x).split('/').pop()));
 if(!raw||raw===lastCG)return;lastCG=raw;
 if(cgMode()==='off')return;
 // 교수 모습이 남성이면 짝 그림(있을 때만)
 const alt=profGender()==='m'?data?.boyAlt?.[raw]:null,p=alt&&cgSet.has(alt)?alt:raw;
 if(!cgSet.has(p))return;
 const fig=el('figure','entry cg-figure');fig.dataset.uid=(node.ref||'')+'.cg';
 const btn=el('button','cg-thumb');btn.type='button';btn.setAttribute('aria-label','CG 펼치기');btn.setAttribute('aria-expanded','false');
 const img=document.createElement('img');img.src=cgSrc(p);img.alt='CG';img.loading='lazy';img.decoding='async';img.onerror=()=>fig.remove();btn.append(img);
 const full=el('button','cg-full');full.append(ic('expand'));full.type='button';full.setAttribute('aria-label','전체 화면으로 보기');full.tabIndex=-1;
 full.onclick=e=>{e.stopPropagation();$('#cgViewImg').src=cgSrc(p);$('#cgView').showModal()};
 btn.onclick=()=>{
  const open=!fig.classList.contains('open'),w=btn.clientWidth;
  const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(!reduce){btn.style.height=btn.clientHeight+'px';btn.offsetHeight;btn.style.height=Math.round(w/(open?2:5))+'px'}
  fig.classList.toggle('open',open);btn.setAttribute('aria-expanded',String(open));btn.setAttribute('aria-label',open?'CG 접기':'CG 펼치기');full.tabIndex=open?0:-1;
  const done=()=>{btn.style.height='';btn.removeEventListener('transitionend',done);refreshPositions()};
  if(reduce)done();else btn.addEventListener('transitionend',done);
 };
 fig.append(btn,full);target.append(fig);
}
// ---------- v0.9.1 끝까지 읽음 = 100% · 맨 위로 ----------
function checkBottom(){
 if($('#reader').classList.contains('hidden')||!positions.length||$('#ending').classList.contains('hidden'))return;
 if(window.innerHeight+window.scrollY<document.documentElement.scrollHeight-8)return;
 positions.forEach(x=>x.classList.remove('active'));const n=positions[positions.length-1];n.classList.add('active');active=positions.length-1;
 $('#trackFill').style.width='100%';$('#readingProgress').textContent='읽기 진행률 100%';set('position.'+current,n.dataset.uid);set('completed.'+current,true);
}
window.addEventListener('scroll',()=>{$('#toTop').classList.toggle('hidden',window.scrollY<500);checkBottom()},{passive:true});
$('#toTop').onclick=()=>window.scrollTo({top:0,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
function observe(){if(observer)observer.disconnect();positions=[...document.querySelectorAll('#stream > .entry, #stream > .choice-output .entry')];observer=new IntersectionObserver(entries=>{let visible=entries.filter(e=>e.isIntersecting).sort((a,b)=>a.boundingClientRect.top-b.boundingClientRect.top);if(!visible.length)return;let n=visible[0].target;positions.forEach(x=>x.classList.remove('active'));n.classList.add('active');active=positions.indexOf(n);const pct=Math.round((active+1)/Math.max(1,positions.length)*100);$('#trackFill').style.width=pct+'%';$('#readingProgress').textContent='읽기 진행률 '+pct+'%';set('position.'+current,n.dataset.uid);let max=get('farthest.'+current,0);if(active>max)set('farthest.'+current,active);if(cursor>=flowNodes.length&&active>=positions.length-1&& !$('#ending').classList.contains('hidden')){set('completed.'+current,true)}checkBottom()},{rootMargin:'-110px 0px -60% 0px',threshold:0});positions.forEach(x=>observer.observe(x))}
function resume(){let uid=get('position.'+current,null);let target=positions.find(x=>x.dataset.uid===uid);(target||positions[0])?.scrollIntoView({behavior:'smooth',block:'start'})}
// Presentation metadata is resolved from the visible index, never from raw file IDs.
function episodeDisplayContext(id){
 const group=displayGroups.find(g=>(g.episodes||[]).some(e=>e.id===id));
 const ep=group?.episodes?.find(e=>e.id===id);
 if(!group||!ep){const dm=dormFor(id);if(dm)return {breadcrumb:dm.g.doll?.name+' · 친밀도 스토리',number:'',title:dm.e.title};return {breadcrumb:'기록 열람',number:'',title:'기록 열람'}}
 const number=episodeLabel(ep);
 const groupTitle=chapterDisplayTitle(group);
 return {breadcrumb:groupTitle+(number?' · '+number:''),number,title:episodeTitle(ep)};
}
// Reading flow: hub sections (메모리) are separate; main chapters continue into the next chapter.
// v0.9.1: 「다음 회차」는 메인 스토리 본편에만. 그 외(이벤트·전속·메모리·전투 중 대사·튜토리얼…)는 목록으로 돌아가기만.
function flowOf(group){const defs=sectionDefs(group);return sortedEpisodes(group).filter(e=>kindOf(e)==='story'&&!defs.get(String(e.section))?.hub)}
function episodeNeighbors(id){
 for(const group of displayGroups){
  const all=sortedEpisodes(group),ep=all.find(e=>e.id===id);if(!ep)continue;
  const res={prev:null,next:null,groupId:groupKey(group),category:group.category,tab:tabIdFor(group,ep),linear:false};
  const hub=sectionDefs(group).get(String(ep.section))?.hub===true;
  if(group.category!=='main'||hub||kindOf(ep)!=='story'){
   // v0.9.11 메인 본편이 아니어도 같은 묶음 안에서 앞뒤로 (같은 종류끼리: 본편 · 전투 대사 · 튜토리얼). 튜토리얼 폴더들은 서로 이어짐
   const k=kindOf(ep),sec=String(ep.section??'');
   const same=g=>sortedEpisodes(g).filter(e=>kindOf(e)===k&&(!hub||String(e.section??'')===sec));
   let seq=same(group);
   if(group.shelfFolder){const sib=displayGroups.filter(g=>g.shelfFolder&&g.category===group.category&&shelfFor(g)===shelfFor(group));seq=sib.flatMap(same)}
   const at=seq.findIndex(e=>e.id===id);
   res.prev=seq[at-1]?.id||null;res.next=seq[at+1]?.id||null;res.linear=seq.length>1;
   return res;
  }
  res.linear=true;
  const seq=flowOf(group),at=seq.findIndex(e=>e.id===id);
  res.prev=seq[at-1]?.id||null;res.next=seq[at+1]?.id||null;
  const mains=displayGroups.filter(g=>g.category==='main'),mi=mains.indexOf(group);
  if(!res.next&&mains[mi+1])res.next=flowOf(mains[mi+1])[0]?.id||null;
  if(!res.prev&&mains[mi-1]){const f=flowOf(mains[mi-1]);res.prev=f[f.length-1]?.id||null}
  return res;
 }
 const dm=dormFor(id);if(dm){const eps=dm.g.episodes;return {prev:eps[dm.i-1]?.id||null,next:eps[dm.i+1]?.id||null,groupId:null,category:null,tab:null,linear:eps.length>1,dorm:dm.g.key}}
 return {prev:null,next:null,groupId:null,category:null,tab:null,linear:false};
}
function backToChapter(n){if(n.dorm){showDoll(n.dorm);return}if(n.groupId){if(n.tab)chapterTabMemory.set(n.groupId,n.tab);showChapter(n.groupId,n.category)}else showHome(category)}
function updateEpisodeNav(){
 const n=episodeNeighbors(current);
 $('#prevEpisode').hidden=$('#nextEpisode').hidden=!n.linear;
 $('#prevEpisode').disabled=!n.prev;$('#nextEpisode').disabled=!n.next;
 $('#prevEpisode').onclick=()=>n.prev&&openEpisode(n.prev);$('#nextEpisode').onclick=()=>n.next&&openEpisode(n.next);
 $('#toLibrary').onclick=()=>backToChapter(n);
 $('#back').replaceChildren(ic('left'),document.createTextNode(n.dorm?' 인형 프로필':' 챕터 목록'));
 // 메인 본편 끝: 이 회차 뒤에 나오는 전투 중 대사
 const host=$('#afterLinks');host.replaceChildren();
 if(n.linear&&!n.dorm){
  const g=displayGroups.find(x=>groupKey(x)===n.groupId);
  const battles=sortedEpisodes(g).filter(e=>e.kind==='battleDialog'&&e.follows===current);
  if(battles.length){host.append(el('p','after-head','이 회차의 전투 중 대사 '+battles.length+'편'));const row=el('div','after-row');
   for(const e of battles){const b=el('button','after-link');b.type='button';b.append(el('span','after-num',episodeNumber(e)),el('span','',e.battle?.stageName||episodeTitle(e)));b.onclick=()=>openEpisode(e.id);row.append(b)}
   host.append(row)}
 }
}
async function openEpisode(id,{push=true}={}){
 const token=++routeToken;
 try{
  let d=await fetchJSON(dataPath('episodes/'+encodeURIComponent(id)+'.json'));
  if(token!==routeToken)return;
  data=d;current=id;
  showOnly('reader');voiceStop();
  const context=episodeDisplayContext(id);
  $('#epTitle').textContent=context.title;$('#epDesc').textContent=d.meta?.description||'';
  document.querySelectorAll('.reader-head .fan-tl').forEach(x=>x.remove());if(d.meta?.fanTL)$('#epDesc').after(fanNote());
  $('#epId').textContent=context.breadcrumb;$('#crumb').textContent=context.breadcrumb;
  $('#stream').replaceChildren();$('#ending').classList.add('hidden');
  updateEpisodeNav();set('lastEpisode',id);updateBookmarkToggle();flowNodes=d.timeline||[];cursor=0;lastCG=null;lastMark=null;bgmMarkStarted=false;setEpisodeBgm(d.meta?.bgm||null);pump();
  if(push)saveRoute({type:'episode',id});
  window.scrollTo(0,0);observe();
 }catch(e){
  if(token===routeToken)showOpenError(id,e);
 }
}
function showOpenError(id,e){
 showOnly('reader');current=id;
 const found=findEpisode(id);$('#epTitle').textContent=found?episodeTitle(found.e):'기록 열람';$('#epId').textContent=found?chapterDisplayTitle(found.g)+(episodeLabel(found.e)?' · '+episodeLabel(found.e):''):'';$('#epDesc').textContent='';
 $('#ending').classList.add('hidden');const box=el('div','open-error');
 const offline=!e?.status;
 box.append(el('strong','',offline?'기록을 불러오지 못했어요':'기록 파일을 찾을 수 없어요'),el('p','',offline?'인터넷 연결이 잠시 불안정했을 수 있어요. 잠시 후 다시 시도해 주세요.':'사이트에 이 기록 파일이 없거나 주소가 바뀌었어요. ('+(e?.message||'')+')'));
 const retry=el('button','open-retry','다시 시도');retry.type='button';retry.onclick=()=>openEpisode(id,{push:false});box.append(retry);
 $('#stream').replaceChildren(box);updateEpisodeNav();
}
function goHome(){$('#search').value='';showHome(null)}
window.addEventListener('popstate',()=>{if(index)restoreRoute()});
window.addEventListener('hashchange',()=>{if(index)restoreRoute()});
$('#homeBtn').onclick=goHome;$('#back').onclick=()=>{const n=episodeNeighbors(current);if(n.groupId||n.dorm)backToChapter(n);else goHome()};$('#resumeBtn').onclick=resume;$('#userBtn').onclick=openUser;$('#userClose').onclick=()=>$('#userDialog').close();$('#userBack').onclick=()=>selectUserPage('root');document.querySelectorAll('[data-user-page]').forEach(b=>b.onclick=()=>selectUserPage(b.dataset.userPage));$('#bmToggle').onclick=()=>{if(current)toggleBookmark(current)};
// Settings: quick controls and independent subpages.
const settings=$('#settings');let settingsPage='root';
const fontValues={fontSize:[14,16,18,20,22,24],letterSpacing:[0,.5,1,1.5,2],lineHeight:[140,160,180,200]};
const themeNames={light:'라이트',dim:'딤',dark:'다크',persica:'페르시카',entropics:'엔트로피'};
function selectPage(page){settingsPage=page;$('#settingsRoot').hidden=page!=='root';$('#settingsFont').hidden=page!=='font';$('#settingsTheme').hidden=page!=='theme';$('#settingsBack').hidden=page==='root';$('#settingsTitle').textContent=page==='font'?'글꼴':page==='theme'?'테마':'설정';if(page==='theme')renderThemeList();if(page==='font')renderFontControls()}
function setTheme(t){set('theme',t);set('brightness',BRIGHT.includes(t)?t:'custom');applySettings();renderThemeList();renderQuick()}
function renderQuick(){const brightness=brightnessMode();document.querySelectorAll('[data-cg]').forEach(b=>b.classList.toggle('selected',cgMode()===b.dataset.cg));document.querySelectorAll('[data-prof]').forEach(b=>b.classList.toggle('selected',profGender()===b.dataset.prof));document.querySelectorAll('[data-brightness]').forEach(b=>b.classList.toggle('selected',b.dataset.brightness===brightness));const reading=get('readingMode','accessible');document.querySelectorAll('[data-reading]').forEach(b=>b.classList.toggle('selected',b.dataset.reading===reading))}
function renderFontControls(){let host=$('#fontControls');host.replaceChildren();{const wrap=el('div','setting-block');wrap.append(el('strong','','글꼴'));const opts=el('div','setting-options font-options font-family-options');const cur=get('fontFamily','sans');
 for(const [v,lab,cls] of [['system','기본','ff-system'],['sans','고딕','ff-sans'],['serif','명조','ff-serif']]){const b=el('button',(cur===v?'selected ':'')+cls,lab);b.type='button';b.onclick=()=>{set('fontFamily',v);applySettings();renderFontControls()};opts.append(b)}
 wrap.append(opts);host.append(wrap)}for(const [field,values] of Object.entries(fontValues)){const wrap=el('div','setting-block');const title=el('strong','',field==='fontSize'?'글자 크기':field==='letterSpacing'?'자간':'줄 간격');wrap.append(title);const options=el('div','setting-options font-options');let current=get(field,field==='fontSize'?16:field==='letterSpacing'?0:160);for(let v of values){let label=field==='lineHeight'?(v/100).toFixed(1):v+(field==='fontSize'||field==='letterSpacing'?'px':'');let b=el('button',current===v?'selected':'',label);b.onclick=()=>{set(field,v);applySettings();renderFontControls()};options.append(b)}wrap.append(options);host.append(wrap)}$('#settingsFont').style.setProperty('--preview-size',get('fontSize',16)+'px');$('#settingsFont').style.setProperty('--preview-spacing',get('letterSpacing',0)+'px');$('#settingsFont').style.setProperty('--preview-line',get('lineHeight',160)/100)}
function renderThemeList(){const host=$('#themeList');host.replaceChildren();for(const [id,name] of Object.entries(themeNames)){let locked=['persica','entropics'].includes(id)&&!get('unlocked.'+id,false);let row=el('div','theme-option');let b=el('button','theme-pick'+(currentTheme()===id?' selected':''));b.disabled=locked;const hidden=['persica','entropics'].includes(id);b.append(el('span','theme-swatch swatch-'+id),hidden?withIc(locked?'lock':'unlock',name):el('span','',name));if(currentTheme()===id){const c=el('span','theme-current');c.append(ic('check'));b.append(c)}b.onclick=()=>setTheme(id);row.append(b);if(!locked&&['persica','entropics'].includes(id)){let replay=el('button','theme-replay');replay.append(ic('replay'),document.createTextNode(' 재생'));replay.onclick=()=>runUnlock(id,true);row.append(replay)}host.append(row)}}
function renderLang(){const host=$('#langOptions');host.replaceChildren();const cur=uiLang();for(const [id,name] of LANGS){const ready=readyLangs.includes(id);const b=el('button',cur===id?'selected':'',name+(ready?'':' · 준비 중'));b.type='button';b.dataset.lang=id;b.disabled=!ready;b.onclick=()=>{if(uiLang()===id)return;set('lang',id);location.reload()};host.append(b)}}
$('#settingsBtn').onclick=()=>{selectPage('root');renderQuick();renderLang();settings.showModal()};$('#settingsClose').onclick=()=>settings.close();$('#settingsBack').onclick=()=>selectPage('root');document.querySelectorAll('[data-page]').forEach(b=>b.onclick=()=>selectPage(b.dataset.page));
$('#nickname').onchange=e=>{set('nickname',e.target.value.trim()||'교수');if(data&&current)openEpisode(current,{push:false})};
document.querySelectorAll('[data-brightness]').forEach(b=>b.onclick=()=>{const v=b.dataset.brightness;if(v==='system')set('brightness','system');else setTheme(v);applySettings();renderThemeList();renderQuick()});
document.querySelectorAll('[data-cg]').forEach(b=>b.onclick=()=>{set('cgMode',b.dataset.cg);renderQuick()});
try{matchMedia('(prefers-color-scheme: dark)').addEventListener('change',()=>{if(brightnessMode()==='system')applySettings()})}catch(e){}
document.querySelectorAll('[data-reading]').forEach(b=>b.onclick=()=>{set('readingMode',b.dataset.reading);applySettings();renderQuick()});
// Hidden theme unlock. Trigger is recognized only in find/search, never nickname.
let unlockTimer=null,unlockTarget=null,unlockWasUnlocked=false;const unlock=$('#unlockDialog');
function finishUnlock(){if(unlockTimer){clearInterval(unlockTimer);unlockTimer=null}if(!unlockTarget)return;set('unlocked.'+unlockTarget,true);$('#unlockResult').textContent='ACCESS GRANTED  //  '+(unlockWasUnlocked?'THEME ALREADY UNLOCKED':'THEME UNLOCKED')+' — '+themeNames[unlockTarget];$('#unlockDone').hidden=false;renderThemeList()}
function runUnlock(target,replay=false){if(unlock.open)unlock.close();unlockTarget=target;unlockWasUnlocked=get('unlocked.'+target,false);$('#hexOutput').textContent='[AUTH] SIGNATURE DETECTED\n[SCAN] DECRYPTING RECORD...\n';$('#unlockResult').textContent='';$('#unlockDone').hidden=true;unlock.classList.toggle('purple',target==='entropics');unlock.classList.toggle('pink',target==='persica');unlock.showModal();if(matchMedia('(prefers-reduced-motion: reduce)').matches){finishUnlock();return}let n=0;unlockTimer=setInterval(()=>{let bytes=Array.from({length:16},()=>Math.floor(Math.random()*256).toString(16).padStart(2,'0').toUpperCase()).join(' ');$('#hexOutput').textContent+=`0x${(0x42A0+n*16).toString(16).toUpperCase()}  ${bytes}\n`;$('#hexOutput').scrollTop=$('#hexOutput').scrollHeight;if(++n>=32)finishUnlock()},65)}
$('#unlockSkip').onclick=finishUnlock;$('#unlockDone').onclick=()=>unlock.close();unlock.addEventListener('close',()=>{if(unlockTimer)finishUnlock()});
$('#viewMode').value=viewMode;$('#viewMode').onchange=e=>{viewMode=e.target.value;set('viewMode',viewMode);openFolderId=null;drawLibrary()};$('#search').oninput=()=>{openFolderId=null;let q=$('#search').value.trim().toLowerCase();let trigger=(q==='entropic'||q==='entropics')?'entropics':(q==='2063.09.23'||q==='20630923')?'persica':null;if(trigger){$('#search').value='';runUnlock(trigger);return}drawLibrary()};
// Site notices (공지·업데이트·제보·저작권·개인정보) come from data/ko/site_info.json.
function renderFooter(info){
 const f=$('.site-footer');if(!f||!info)return;f.replaceChildren();
 // v0.9.15 맨 아래는 글 두 줄만 (안내 · 저작권 상세는 공지 「42LAB 기록 열람실 안내」). @아이디는 X 링크
 const top=el('div','footer-line');
 (info.footer||[]).forEach(t=>{const p=el('p','');const m=t.match(/@([A-Za-z0-9_]+)/);
  if(m){p.append(document.createTextNode(t.slice(0,m.index)));const a=el('a','footer-x',m[0]);a.href='https://x.com/'+m[1];a.target='_blank';a.rel='noopener';p.append(a,document.createTextNode(t.slice(m.index+m[0].length)))}else p.textContent=t;
  top.append(p)});
 f.append(top);
}
function openInfo(pg){
 const body=$('#infoBody');body.replaceChildren();$('#infoTitle').textContent=pg.title;
 for(const item of pg.items||[]){const box=el('section','info-item');if(item.title)box.append(el('h3','',item.title));(item.lines||[]).forEach(t=>box.append(el('p','',t)));body.append(box)}
 $('#infoDialog').showModal();
}
fetchJSON(dataPath('site_info.json')).then(info=>{siteInfo=info;fillHeroTags();renderSettingsFeedback();maybeWelcome();initBgm();if(Array.isArray(info.languages)&&info.languages.length)readyLangs=info.languages;renderFooter(info);if(index&&category==null&&!openFolderId&&!$('#search').value.trim()&&!$('#library').classList.contains('hidden'))drawLibrary()}).catch(()=>{});

// ---------- v0.9.3 소개 카드 태그 ----------
function fillHeroTags(){
 if(index){const n=(index.groups||[]).filter(g=>g.category!=='dorm').reduce((a,g)=>a+(g.episodes||[]).length,0);$('#tagRecords').textContent=n.toLocaleString('en-US')+' RECORDS'}
 if(siteInfo?.updated)$('#tagUpdated').textContent='UPDATED '+String(siteInfo.updated).replaceAll('-','.');
}
// ---------- v0.9.3 검색 칸 「//:_▌」 ----------
{const s=$('#search'),w=s.closest('.search-wrap');const sync=()=>w.classList.toggle('has-value',!!s.value);s.addEventListener('input',sync);sync();
 // 입력 글씨가 //:_ 바로 뒤에서 시작하도록 앞 글자 폭만큼 띄움
 const fit=()=>{const p=w.querySelector('.search-prompt');if(!p)return;const r=document.createRange();r.selectNodeContents(p.firstChild);w.style.setProperty('--prompt-w',Math.ceil(r.getBoundingClientRect().width)+'px')};fit();document.fonts?.ready.then(fit)}
// ---------- v0.9.3 별명 검색: 어떤 이름으로 찾아도 결과는 정식 이름 ----------
function aliasTargets(nq){
 if(!dolls||!nq)return [];
 const out=new Set();
 for(const x of dolls.dolls||[]){
  const names=[x.name,x.names?.zh,x.names?.ja,x.names?.en,...(x.aliases||[])].filter(Boolean).map(v=>norm(String(v).replace(/\([^)]*\)/g,'')));
  if(names.some(a=>a&&(a===nq||(nq.length>=2&&a.includes(nq)))))out.add(norm(String(x.name).split('·')[0]));
 }
 return [...out];
}
// ---------- v0.9.3 교수 모습 ----------
const profGender=()=>get('profGender','f')==='m'?'m':'f';
document.querySelectorAll('[data-prof]').forEach(b=>b.onclick=()=>{set('profGender',b.dataset.prof);renderQuick();if(data&&current&&!$('#reader').classList.contains('hidden'))openEpisode(current,{push:false})});
// ---------- v0.9.3 설정 맨 아래 피드백 ----------
function renderSettingsFeedback(){const h=$('#settingsFeedback');if(h)h.replaceChildren(...feedbackLinks())}
// ---------- v0.9.3 첫 접속: 교수 모습 → 공지 (언어 선택은 다른 언어가 열리면) ----------
function profPick(cls){
 // v0.10.3 교수 모습: 글자 없이 그림 두 장 (왼쪽 A 여성 · 오른쪽 B 남성)
 const row=el('div','prof-pick'+(cls?' '+cls:''));
 for(const [v,img,label] of [['f','prof_a','여성 교수'],['m','prof_b','남성 교수']]){
  const b=el('button','prof-card');b.type='button';b.dataset.prof=v;b.setAttribute('aria-label',label);b.title=label;
  const im=el('img');im.src='./assets/img/'+img+'.webp';im.alt='';im.decoding='async';b.append(im);row.append(b);
 }
 return row;
}
function maybeWelcome(){
 if(get('welcomed',false))return;
 const dlg=$('#welcome'),body=$('#welcomeBody');let picked=get('profGender',null);
 body.replaceChildren();
 // 1) 언어
 body.append(el('div','setting-label','LANGUAGE'));
 const langs=el('div','setting-options welcome-langs');
 for(const [id,name] of LANGS){const ready=readyLangs.includes(id);const b=el('button',uiLang()===id?'selected':'',name);b.type='button';b.disabled=!ready;if(!ready)b.title='준비 중';b.onclick=()=>{if(uiLang()===id)return;set('lang',id);location.reload()};langs.append(b)}
 body.append(langs);
 // 2) 공지
 const n=sortedNotices()[0];
 if(n){body.append(el('div','setting-label','NOTICE'));const box=el('div','welcome-notice');box.append(el('h3','welcome-notice-title',n.title||''));(n.lines||[]).forEach(t=>box.append(el('p','welcome-line',t)));body.append(box)}
 // 3) 교수 모습 (안 고르면 무작위)
 body.append(el('div','setting-label','PROFESSOR'));
 const pick=profPick('welcome-prof');
 const sync=()=>pick.querySelectorAll('.prof-card').forEach(b=>{const on=b.dataset.prof===picked;b.classList.toggle('selected',on);b.setAttribute('aria-pressed',String(on))});
 pick.querySelectorAll('.prof-card').forEach(b=>b.onclick=()=>{picked=b.dataset.prof;sync()});sync();
 body.append(pick,el('p','setting-hint','고르지 않으면 무작위로 정해져요. 사용자 창에서 언제든 바꿀 수 있어요.'));
 const ok=el('button','welcome-ok','확인');ok.type='button';
 ok.onclick=()=>{set('profGender',picked||(Math.random()<.5?'f':'m'));set('welcomed',true);renderQuick();dlg.close()};body.append(ok);
 try{dlg.showModal()}catch(e){}
 dlg.addEventListener('cancel',e=>{e.preventDefault()});
}
// ---------- v0.9.3 BGM (곡 파일이 있는 곳에서만: Cloudflare) ----------
let bgmMarkStarted=false,bgmList=null,bgmCtx=null,bgmGain=null,bgmSrc=null,bgmPlaying=null,bgmEpisode=null,lastMark=null;const bgmBuf=new Map();
const bgmBase=()=>siteInfo?.home?.bgmBase||'./assets/bgm/';
const bgmTitle=c=>String(c||'').replace(/^Mus_/,'').replace(/_/g,' ');
function initBgm(){fetchJSON(bgmBase()+'bgm.json',1).then(m=>{bgmList=m;document.querySelectorAll('.bgm-mark[hidden]').forEach(x=>{if(m?.[x.dataset.cue])x.hidden=false;else x.remove()});if(current&&!$('#reader').classList.contains('hidden'))setEpisodeBgm(bgmEpisode)}).catch(()=>{bgmList=null})}
function setEpisodeBgm(cue){bgmEpisode=cue;const bar=$('#bgmBar');const ok=!!(bgmList&&cue&&bgmList[cue]);bar.classList.toggle('hidden',!ok);if(ok){$('#bgmName').textContent=bgmTitle(cue);syncBgmBar()}}
// v0.12.4 (68번) 위 단추 · ♪ 단추 엇갈림 고침: 마지막으로 누른 곡만 이김(늦게 받아진 곡은 버림), 받는 중엔 그 단추에 … 표시, 받는 중에 다시 누르면 취소
let bgmReq=0,bgmLoading=null;
function syncBgmBar(){const on=bgmPlaying&&bgmPlaying===bgmEpisode;const wait=bgmLoading&&bgmLoading===bgmEpisode;$('#bgmPlay').replaceChildren(wait?el('span','bgm-wait','…'):ic(on?'pause':'play'));$('#bgmPlay').dataset.state=wait?'loading':on?'playing':'stopped';$('#bgmPlay').setAttribute('aria-label',on?'BGM 멈춤':'BGM 재생');const now=bgmLoading&&bgmLoading!==bgmEpisode?bgmLoading:bgmPlaying&&bgmPlaying!==bgmEpisode?bgmPlaying:null;$('#bgmNow').textContent=now?' · 지금: '+bgmTitle(now):'';document.querySelectorAll('.bgm-mark').forEach(m=>{m.classList.toggle('playing',m.dataset.cue===bgmPlaying&&!bgmLoading);m.classList.toggle('loading',m.dataset.cue===bgmLoading)})}
const bgmVolume=()=>Math.max(0,Math.min(100,+get('bgmVolume',30)));
async function bgmPlay(cue){
 const info=bgmList?.[cue];if(!info)return;
 const req=++bgmReq;bgmLoading=cue;syncBgmBar();
 try{
  bgmCtx=bgmCtx||new (window.AudioContext||window.webkitAudioContext)();if(bgmCtx.state==='suspended')await bgmCtx.resume();
  if(!bgmGain){bgmGain=bgmCtx.createGain();bgmGain.connect(bgmCtx.destination)}
  bgmGain.gain.value=(bgmVolume()/100)**2;
  let buf=bgmBuf.get(cue);
  if(!buf){const r=await fetch(bgmBase()+encodeURIComponent(info.file||cue+'.m4a'));if(!r.ok)throw Error('HTTP '+r.status);buf=await bgmCtx.decodeAudioData(await r.arrayBuffer());bgmBuf.set(cue,buf);if(bgmBuf.size>4)bgmBuf.delete(bgmBuf.keys().next().value)}
  if(req!==bgmReq)return; // 받는 사이 다른 곡을 눌렀거나 멈췄으면 이 곡은 버림
  bgmLoading=null;
  if($('#reader').classList.contains('hidden')){syncBgmBar();return} // 곡을 받는 사이 회차 화면을 나갔으면 틀지 않음
  bgmStop(false);
  const src=bgmCtx.createBufferSource();src.buffer=buf;src.loop=true;
  const ls=+info.loopStart||0,le=+info.loopEnd||0;if(le>ls&&le<=buf.duration+.05){src.loopStart=ls;src.loopEnd=Math.min(le,buf.duration)}
  src.connect(bgmGain);src.start();bgmSrc=src;bgmPlaying=cue;
 }catch(e){if(req!==bgmReq)return;bgmLoading=null;bgmPlaying=null;syncBgmBar();$('#bgmNow').textContent=' · 재생할 수 없어요';return}
 syncBgmBar();
}
// 곡 단추 하나를 눌렀을 때: 받는 중이면 취소, 그 곡이 나오는 중이면 멈춤, 아니면 그 곡 틀기
function bgmToggle(cue){if(!cue)return;if(bgmLoading===cue){bgmReq++;bgmLoading=null;syncBgmBar();return}if(bgmPlaying===cue&&!bgmLoading){bgmStop();return}bgmPlay(cue)}
// 회차 화면을 나가면(첫 화면 · 목록 · 챕터) 음악을 멈춤. 회차끼리 넘어갈 때는 계속
function bgmLeave(){if(bgmSrc||bgmPlaying||bgmLoading)bgmStop()}
function bgmStop(sync=true){try{bgmSrc?.stop()}catch(e){}bgmSrc=null;if(sync){bgmReq++;bgmLoading=null;bgmPlaying=null;syncBgmBar()}}
$('#bgmPlay').onclick=()=>bgmToggle(bgmEpisode);

// v0.9.7 창 바깥(어두운 부분)을 누르면 닫기. 첫 방문 창 · 테마 해금 연출은 제외
for(const id of ['settings','userDialog','infoDialog','cgView','lore']){const d=document.getElementById(id);if(!d)continue;let downOut=false;
 const out=e=>{const r=d.getBoundingClientRect();return e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom};
 d.addEventListener('pointerdown',e=>{downOut=e.target===d&&out(e)});
 d.addEventListener('click',e=>{if(downOut&&e.target===d&&out(e))d.close();downOut=false})}
// v0.9.6 음량은 설정 > SOUND 에서 (막대 채움 색은 --val)
{const v=$('#bgmVol');const show=()=>{$('#bgmVolNum').textContent=v.value+'%';v.style.setProperty('--val',v.value+'%')};v.value=bgmVolume();show();v.oninput=()=>{set('bgmVolume',+v.value);show();if(bgmGain)bgmGain.gain.value=(+v.value/100)**2}}

// 회차 중간에 곡이 바뀌는 곳: 「♪ 곡 이름」 작은 단추 (누르면 그 곡으로)
function maybeBgmMark(node,target){
 if(!('bgm' in node))return;if(node.bgm===null){lastMark=null;return}
 // 회차 첫 곡은 위 BGM 줄이 맡으므로 표시하지 않는다
 if(!bgmMarkStarted){bgmMarkStarted=true;lastMark=node.bgm;return}
 if(node.bgm===lastMark)return;lastMark=node.bgm;
 if(bgmList&&!bgmList[node.bgm])return; // 곡 목록이 아직 안 왔으면 일단 숨겨 두고, 오면 보이기 (v0.12.4)
 const m=el('button','bgm-mark');m.append(ic('music'),document.createTextNode(' '+bgmTitle(node.bgm)));m.type='button';m.dataset.cue=node.bgm;m.onclick=()=>bgmToggle(node.bgm);
 if(!bgmList)m.hidden=true;if(bgmPlaying===node.bgm)m.classList.add('playing');target.append(m);
}


// ---------- v0.10.0 인형 기록 (목록 · 프로필) — v0.10.1 채운 피드백 반영 ----------
// 데이터: data/<lang>/doll_index.json (목록) · profiles/<voiceKey>.json (상세). 그림 · 보이스는 Cloudflare (illustBase · voiceBase)
let dollIndex=null;const dollCache=new Map();
// v0.10.2 정렬은 기업별 · 직군별 두 가지만. 칸 안은 성급 낮은 순 → 가나다
let dollSort=['company','role'].includes(get('dollSort','company'))?get('dollSort','company'):'company',dollQuery='';
const dollFold=new Set(get('dollFold',[]));
const STAGE_NAME={1:'기본 투영',2:'확장 투영',3:'완벽 투영'};
const VOICE_GROUPS=[['basic','기본 보이스'],['affinity','친밀도 보이스'],['dorm','숙소 반응'],['live2d','Live2D 터치'],['extra','그 외']];
// 기업별 · 직군별로 나눌 때의 칸 순서 (목록에 없는 이름은 뒤에 가나다순)
// 언어별 칸 순서 (같은 위치 = 같은 기업). 목록에 없는 이름은 뒤에 가나다순
const CO_ORDER=[['42LAB','스바로그 중공업','유니버셜 애니씽 서비스','사이버 미디어','얼티 라이프 홀딩스','특수 슈타인즈게이트','정화자','엔트로피'],['42LAB','スヴァローグ重工','UAS','サイバーメディア','最終生命','特殊 STEINS;GATE','浄化者','エントロピー'],['42LAB','Svarog','UAS','Cyber Media','Ultimate Life','Special · STEINS;GATE','Sanctifier','Entropic'],['42LAB','火神重工','UAS','賽博傳媒','最終生命','特殊 命運石之門','淨化者','熵'],['42LAB','火神重工','UAS','赛博传媒','最终生命','特殊 命运石之门','净化者','熵']];
const ROLE_ORDER=[['수위','전사','사수','해결사','치료사'],['ガード','ファイター','シューター','ユニーク','メディック'],['Guard','Warrior','Sniper','Specialist','Medic'],['守衛','戰士','射手','特種','醫師'],['守卫','战士','射手','特种','医师']];
const LOAD_NOTE='처음 열 때는 불러오는 데 몇 초 걸릴 수 있어요.';
function showOnly(id){for(const x of ['library','reader','dollView'])$('#'+x).classList.toggle('hidden',x!==id)}
const loadDollIndex=()=>dollIndex?Promise.resolve(dollIndex):fetchJSON(dataPath('doll_index.json')).then(d=>dollIndex=d);
const dollFace=d=>imageMap[d.nameKo]||imageMap[d.name]||imageMap[(d.voiceKey||'')+'_avg']||imageMap[d.voiceKey]||null;
const starText=n=>'★'.repeat(Math.max(0,+n||0));
const bdayText=b=>b&&/^\d{4}$/.test(b)?(+b.slice(0,2))+'월 '+(+b.slice(2))+'일':'';
const dnorm=s=>String(s||'').toLowerCase().replace(/[\s·・.\-_()]/g,'');
// 긴 글은 문장 단위로 (덩어리로 묶지 않기)
function sentences(text){
 const out=[];
 for(const para of String(text||'').split(/\n+/)){const t=para.trim();if(!t)continue;
  const parts=t.match(/[^.!?。…]+(?:[.!?。…]+["'」』”’)]*|$)/g)||[t];
  parts.map(s=>s.trim()).filter(Boolean).forEach((s,i)=>out.push({s,first:i===0}));
 }
 return out;
}
// 게임 글 속 꼬리표 정리: <cmdr> → 교수 이름, 색 · 기울임 같은 꼬리표는 지움 (2026-10-29 채운 제보)
const cleanTags=t=>String(t||'').replace(/<cmdr>/gi,()=>nick()).replace(/<\/?(?:color|i|b|size)(?:=[^>]*)?>/gi,'');
function sentenceBlock(text,cls){const box=el('div','sent-block'+(cls?' '+cls:''));for(const {s,first} of sentences(cleanTags(text)))box.append(el('p','sent'+(first?' para':''),s));return box}
function foldSection(id,title,count,fill,{open=true}={}){
 const shut=dollFold.has(id)||(!open&&!dollFold.has('!'+id));
 const sec=el('section','doll-sec'+(shut?'':' expanded'));sec.dataset.sec=id;
 const head=el('button','doll-sec-head');head.type='button';head.setAttribute('aria-expanded',String(!shut));
 head.append(el('h3','',title));if(count!=null&&count!=='')head.append(el('span','doll-sec-count',String(count)));head.append(ic('right','tri'));
 const body=el('div','doll-sec-body'),inner=el('div','doll-sec-inner');body.append(inner);
 head.onclick=()=>{const ex=sec.classList.toggle('expanded');head.setAttribute('aria-expanded',String(ex));if(ex){dollFold.delete(id);if(!open)dollFold.add('!'+id)}else{dollFold.add(id);dollFold.delete('!'+id)}set('dollFold',[...dollFold])};
 fill(inner);sec.append(head,body);return sec;
}
// ----- 보이스 재생 (한 번에 하나) -----
const voiceAudio=new Audio();voiceAudio.preload='none';let voiceBtn=null,voiceState=null,voiceRepeat=get('voiceRepeat',false);
function voiceStop(){try{voiceAudio.pause()}catch(e){}if(voiceBtn){voiceBtn.classList.remove('playing','loading');if(!voiceBtn.classList.contains('voice-var'))voiceBtn.replaceChildren(ic('play'));voiceBtn.setAttribute('aria-label',voiceBtn.dataset.label+' 듣기');voiceBtn.closest('.voice-row')?.classList.remove('playing')}if(voiceState&&!voiceState.classList.contains('err'))voiceState.textContent='';voiceBtn=null;voiceState=null}
function voicePlay(url,btn,state){
 if(voiceBtn===btn){voiceStop();return}
 voiceStop();voiceBtn=btn;voiceState=state||null;
 if(state){state.classList.remove('err');state.textContent='불러오는 중…'}
 btn.classList.add('loading','playing');if(!btn.classList.contains('voice-var'))btn.replaceChildren(ic('pause'));btn.setAttribute('aria-label',btn.dataset.label+' 멈춤');btn.closest('.voice-row')?.classList.add('playing');
 voiceAudio.loop=voiceRepeat;voiceAudio.src=url;voiceAudio.volume=1;
 voiceAudio.play().catch(()=>{if(voiceBtn===btn){const st=voiceState;voiceStop();if(st){st.classList.add('err');st.textContent='재생할 수 없어요 · 다시 눌러 주세요'}}});
}
voiceAudio.addEventListener('ended',()=>{if(!voiceAudio.loop)voiceStop()});
voiceAudio.addEventListener('playing',()=>{voiceBtn?.classList.remove('loading');if(voiceState)voiceState.textContent=''});
voiceAudio.addEventListener('waiting',()=>{if(voiceState&&voiceBtn)voiceState.textContent='불러오는 중…'});
// ----- 목록 -----
async function showDolls({push=true}={}){
 const tok=++routeToken;showOnly('dollView');bgmLeave();voiceStop();closeArchiveMenu();$('#crumb').textContent='인형 기록';
 if(push)saveRoute({type:'dolls'});
 const host=$('#dollView');host.replaceChildren(el('p','loading-note','인형 기록을 불러오는 중…'));window.scrollTo(0,0);
 try{await loadDollIndex()}catch(e){if(tok===routeToken)host.replaceChildren(error('인형 기록을 불러오지 못했어요. ('+e.message+')'));return}
 if(tok===routeToken)renderDollList();
}
const byName=(a,b)=>a.name.localeCompare(b.name,'ko');
const sortDolls=list=>[...list].sort((a,b)=>(a.stars||0)-(b.stars||0)||byName(a,b));
function dollMatches(d,q){
 if(!q)return true;
 const extra=(dolls?.dolls||[]).find(x=>String(x.heroId)===String(d.heroId)||x.name===d.name);
 const names=[d.name,d.nameEn,extra?.nameKo,extra?.names?.zh,extra?.names?.ja,extra?.names?.en,...(extra?.aliases||[])].filter(Boolean).map(v=>dnorm(String(v).replace(/\([^)]*\)/g,'')));
 return names.some(n=>n.includes(q));
}
function selectBox(label,opts,val,on){
 const w=el('label','doll-ctl');w.append(el('span','doll-ctl-label',label));
 const box=el('span','doll-select');const s=el('select');for(const [v,n] of opts){const o=el('option','',n);o.value=v;s.append(o)}s.value=val;s.onchange=()=>on(s.value);
 box.append(s,ic('right','sel-ic'));w.append(box);return w;
}
function renderDollList(){
 const host=$('#dollView');host.replaceChildren();
 const all=dollIndex.dolls||[];
 const head=el('div','doll-list-head');const t=el('div');t.append(el('div','eyebrow','DATABASE / DOLLS'),el('h2','','인형 기록'));head.append(t);
 const count=el('span','section-sub');head.append(count);host.append(head);
 const bar=el('div','doll-controls');const left=el('div','doll-ctl-group');
 const orderOf=(lists,x)=>{for(const l of lists){const i=l.indexOf(x);if(i>=0)return i}return 99};
 const cos=[...new Set(all.map(d=>d.company).filter(Boolean))].sort((a,b)=>orderOf(CO_ORDER,a)-orderOf(CO_ORDER,b)||a.localeCompare(b,'ko'));
 const roles=[...new Set(all.map(d=>d.role).filter(Boolean))].sort((a,b)=>orderOf(ROLE_ORDER,a)-orderOf(ROLE_ORDER,b)||a.localeCompare(b,'ko'));
 const grid=el('div','doll-list-body');
 const drawGrid=()=>{
  const q=dnorm(dollQuery);
  const list=sortDolls(all.filter(d=>dollMatches(d,q)));
  count.textContent=list.length+'명';grid.replaceChildren();
  if(!list.length){grid.append(el('p','loading-note',q?'「'+dollQuery.trim()+'」에 맞는 인형이 없어요.':'인형이 없어요.'));return}
  const field=dollSort==='role'?'role':'company';
  for(const name of field==='company'?cos:roles){
   const part=list.filter(d=>d[field]===name);if(!part.length)continue;
   const gh=el('div','doll-group-head');gh.append(el('h3','',name),el('span','doll-group-count',part.length+'명'));
   const g=el('div','doll-grid');part.forEach(d=>g.append(dollCard(d)));grid.append(gh,g);
  }
 };
 left.append(selectBox('정렬',[['company','기업별'],['role','직군별']],dollSort,v=>{dollSort=v;set('dollSort',v);drawGrid()}));
 const sw=el('label','doll-ctl doll-search-wrap');sw.append(el('span','doll-ctl-label','인형 찾기'));
 const sbox=el('span','doll-search');const si=el('input');si.type='search';si.placeholder='이름 · 별명';si.value=dollQuery;si.setAttribute('aria-label','인형 이름으로 찾기');si.autocomplete='off';
 si.oninput=()=>{dollQuery=si.value;drawGrid()};sbox.append(el('span','doll-search-prompt','//:_'),si);sw.append(sbox);
 bar.append(left,sw);host.append(bar,grid);drawGrid();
}
function dollCard(d){
 const b=el('button','doll-card');b.type='button';b.dataset.key=d.voiceKey;
 const face=el('div','doll-face');const url=dollFace(d);if(url){const im=el('img');im.src=url;im.alt='';im.loading='lazy';face.append(im)}else face.classList.add('unknown');
 const info=el('div','doll-card-info');info.append(el('strong','',d.name));
 info.append(el('span','doll-card-meta',[d.company,d.role].filter(Boolean).join(' · ')));
 const foot=el('span','doll-card-foot');foot.append(el('span','doll-stars',starText(d.stars)));info.append(foot);
 b.append(face,info);b.onclick=()=>showDoll(d.voiceKey);return b;
}
// ----- 프로필 -----
async function showDoll(key,{push=true}={}){
 const tok=++routeToken;showOnly('dollView');bgmLeave();voiceStop();closeArchiveMenu();
 if(push)saveRoute({type:'doll',id:key});
 const host=$('#dollView');host.replaceChildren(el('p','loading-note','프로필을 불러오는 중…'));window.scrollTo(0,0);
 try{loadDollIndex().catch(()=>{});let p=dollCache.get(key);if(!p){p=await fetchJSON(dataPath('profiles/'+encodeURIComponent(key)+'.json'));dollCache.set(key,p)}if(tok!==routeToken)return;renderDoll(p)}
 catch(e){if(tok===routeToken){host.replaceChildren(error('프로필을 불러오지 못했어요. ('+e.message+')'))}}
}
const illust=(p,img,full)=>img?(p.illustBase||'')+(full?'full/'+img+'.png':'web/'+img+'.webp'):null;
// 그림 불러오기: 받는 동안 안내, 실패하면 다시 시도. token 으로 늦게 도착한 이전 그림은 버림
function loadInto(holder,src,alt,{onReady}={}){
 const tok=(holder._tok=(holder._tok||0)+1);
 holder.classList.remove('ready','failed');holder.classList.add('loading');
 holder.querySelector('.img-note')?.remove();holder.querySelector('img')?.remove();
 const note=el('div','img-note');note.append(el('span','img-spin'),el('span','','그림을 불러오는 중이에요 · 몇 초 걸릴 수 있어요'));holder.append(note);
 const im=new Image();im.alt=alt||'';im.decoding='async';
 im.onload=()=>{if(holder._tok!==tok)return;note.remove();holder.classList.remove('loading');holder.classList.add('ready');holder.prepend(im);onReady?.(im)};
 im.onerror=()=>{if(holder._tok!==tok)return;holder.classList.remove('loading');holder.classList.add('failed');note.replaceChildren(el('span','','그림을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.'));const r=el('button','img-retry','다시 불러오기');r.type='button';r.onclick=e=>{e.stopPropagation();loadInto(holder,src+(src.includes('?')?'&':'?')+'r='+Date.now(),alt,{onReady})};note.append(r)};
 im.src=src;
}
function zoomImage(src,alt){
 const dlg=$('#cgView');dlg.classList.add('doll-zoom');
 let box=dlg.querySelector('.zoom-box');
 if(!box){box=el('div','zoom-box');const old=$('#cgViewImg');old.after(box)}
 $('#cgViewImg').hidden=true;$('#cgViewImg').removeAttribute('src');
 loadInto(box,src,alt);try{dlg.showModal()}catch(e){}
}
$('#cgView').addEventListener('close',()=>{const d=$('#cgView');if(!d.classList.contains('doll-zoom'))return;d.classList.remove('doll-zoom');const box=d.querySelector('.zoom-box');if(box){box._tok=(box._tok||0)+1;box.remove()}$('#cgViewImg').hidden=false});
// 그림 넘겨 보기 (투영 · 스킨 공용). items: [{img,title,tab,desc,photo,photoName}]
function gallery(p,items,{label,tabs=false,cls=''}={}){
 const box=el('div','doll-gallery'+(cls?' '+cls:''));let at=0,photo=false;
 const stage=el('div','gal-stage');const fig=el('button','gal-img');fig.type='button';fig.setAttribute('aria-label','크게 보기');
 const zoomHint=el('span','gal-zoom');zoomHint.append(ic('expand'));
 const prev=el('button','gal-nav gal-prev');prev.type='button';prev.append(ic('left'));prev.setAttribute('aria-label','이전 '+label);
 const next=el('button','gal-nav gal-next');next.type='button';next.append(ic('right'));next.setAttribute('aria-label','다음 '+label);
 stage.append(fig,prev,next);
 const meta=el('div','gal-meta');const tabRow=el('div','gal-tabs');
 const draw=()=>{
  const it=items[at];const img=photo&&it.photo?it.photo:it.img;
  fig.replaceChildren();fig.classList.toggle('is-photo',!!(photo&&it.photo));
  if(img){fig.disabled=false;loadInto(fig,illust(p,img),it.title);fig.append(zoomHint);fig.onclick=()=>{if(fig.classList.contains('failed'))return;zoomImage(illust(p,img,true),it.title)}}
  else{fig._tok=(fig._tok||0)+1;fig.classList.remove('loading','failed','ready');fig.append(el('span','gal-pending','IMAGE PENDING'));fig.disabled=true}
  prev.disabled=at===0;next.disabled=at===items.length-1;prev.hidden=next.hidden=items.length<2;
  meta.replaceChildren();
  const top=el('div','gal-title');top.append(el('strong','',it.title||''));if(items.length>1)top.append(el('span','gal-count',(at+1)+' / '+items.length));meta.append(top);
  if(it.photo){const sw=el('div','gal-switch');for(const [v,n] of [[false,'입식 그림'],[true,'사진']]){const b=el('button',photo===v?'on':'',n);b.type='button';b.setAttribute('aria-pressed',String(photo===v));b.onclick=()=>{photo=v;draw()};sw.append(b)}meta.append(sw);if(photo&&it.photoName)meta.append(el('span','gal-sub',it.photoName))}
  if(it.desc)meta.append(sentenceBlock(it.desc,'gal-desc'));
  if(tabs){tabRow.replaceChildren();items.forEach((x,i)=>{const b=el('button','gal-tab'+(i===at?' on':''),x.tab||x.title);b.type='button';b.setAttribute('aria-pressed',String(i===at));b.onclick=()=>{at=i;photo=false;draw()};tabRow.append(b)})}
 };
 prev.onclick=()=>{if(at>0){at--;photo=false;draw()}};next.onclick=()=>{if(at<items.length-1){at++;photo=false;draw()}};
 box.tabIndex=0;box.addEventListener('keydown',e=>{if(e.target.closest('input,select'))return;if(e.key==='ArrowLeft'){prev.click();e.preventDefault()}if(e.key==='ArrowRight'){next.click();e.preventDefault()}});
 let sx=null;stage.addEventListener('touchstart',e=>{sx=e.touches[0].clientX},{passive:true});stage.addEventListener('touchend',e=>{if(sx==null)return;const dx=e.changedTouches[0].clientX-sx;sx=null;if(Math.abs(dx)>50)(dx<0?next:prev).click()});
 if(tabs)box.append(tabRow);box.append(stage,meta);draw();return box;
}
const voiceUrl=(p,folder,cue)=>(p.voiceBase||'')+encodeURIComponent(folder)+'/'+encodeURIComponent(cue)+'.m4a';
function voiceRow(p,v,folder){
 const row=el('div','voice-row'+(v.audio?'':' no-audio'));
 const b=el('button','voice-play');b.type='button';b.dataset.label=v.label;b.append(ic('play'));
 const state=el('span','voice-state');state.setAttribute('aria-live','polite');
 if(v.audio){b.setAttribute('aria-label',v.label+' 듣기');b.onclick=()=>voicePlay(voiceUrl(p,folder,v.cue),b,state)}
 else{b.disabled=true;b.setAttribute('aria-label',v.label+' (음성 없음)');b.title='음성 파일이 없어요'}
 const body=el('div','voice-body');const h=el('div','voice-head');h.append(el('strong','',v.label));if(v.unlock)h.append(el('span','voice-unlock',v.unlock));
 // 서약 A · B: 같은 줄에 버튼으로
 if(v.variants?.length){const vw=el('span','voice-vars');for(const x of v.variants){const vb=el('button','voice-var','서약 '+x.name);vb.type='button';vb.dataset.label='서약 '+x.name;vb.prepend(ic('play'));vb.setAttribute('aria-label','서약 '+x.name+' 듣기');vb.onclick=()=>voicePlay(voiceUrl(p,folder,x.cue),vb,state);vw.append(vb)}h.append(vw)}
 h.append(state);if(v.dur)h.append(el('span','voice-dur',v.dur.toFixed(1)+'초'));
 body.append(h);if(v.text)body.append(el('p','voice-text',cleanTags(v.text).replace(/\s*\n+\s*/g,' ')));
 row.append(b,body);return row;
}
function repeatButton(){
 const rep=el('button','voice-repeat'+(voiceRepeat?' on':''));rep.type='button';rep.setAttribute('aria-pressed',String(voiceRepeat));rep.append(ic('replay'),document.createTextNode(' 반복 재생'));
 rep.onclick=()=>{voiceRepeat=!voiceRepeat;set('voiceRepeat',voiceRepeat);voiceAudio.loop=voiceRepeat;document.querySelectorAll('.voice-repeat').forEach(r=>{r.classList.toggle('on',voiceRepeat);r.setAttribute('aria-pressed',String(voiceRepeat))})};
 return rep;
}
function voicePanel(p){
 const sets=[{name:'기본',voices:(p.voices||[]).filter(v=>v.group!=='affinity'),key:p.voiceKey},...(p.skinVoices||[]).map(s=>({name:s.skin,voices:s.voices||[],key:s.key}))].filter(s=>s.voices.length);
 const box=el('div','voice-panel');if(!sets.length){box.append(el('p','doll-empty','보이스가 없어요.'));return box}
 let at=0;
 const top=el('div','voice-top');const sw=el('div','voice-set');
 const prev=el('button','gal-nav-sm');prev.type='button';prev.append(ic('left'));prev.setAttribute('aria-label','이전 보이스 묶음');
 const next=el('button','gal-nav-sm');next.type='button';next.append(ic('right'));next.setAttribute('aria-label','다음 보이스 묶음');
 const name=el('strong','voice-set-name');sw.append(prev,name,next);if(sets.length<2)sw.classList.add('single');
 top.append(sw,repeatButton());
 const list=el('div','voice-groups');
 const draw=()=>{
  voiceStop();const s=sets[at];name.textContent=at===0?'기본 보이스 묶음':s.name;prev.disabled=at===0;next.disabled=at===sets.length-1;
  list.replaceChildren();
  for(const [gid,gname] of VOICE_GROUPS){
   const vs=s.voices.filter(v=>(v.group||'basic')===gid);if(!vs.length)continue;
   list.append(foldSection('voice-'+gid,gname,vs.length+'개',inner=>{for(const v of vs)inner.append(voiceRow(p,v,s.key))},{open:gid!=='extra'}));
  }
 };
 prev.onclick=()=>{if(at>0){at--;draw()}};next.onclick=()=>{if(at<sets.length-1){at++;draw()}};
 sw.tabIndex=0;sw.addEventListener('keydown',e=>{if(e.key==='ArrowLeft'){prev.click();e.preventDefault()}if(e.key==='ArrowRight'){next.click();e.preventDefault()}});
 box.append(el('p','load-note',LOAD_NOTE),top,list);draw();return box;
}
// 인형 스토리: 〔인형 이야기 1~5〕 ↔ 〔인형 보이스 1~5〕 (화살표로 넘김)
let storyPage=0;
function storyPanel(p){
 const box=el('div','story-pager');
 const head=el('div','story-head');
 const prev=el('button','gal-nav-sm story-prev');prev.type='button';prev.append(ic('left'));prev.setAttribute('aria-label','인형 이야기로');
 const next=el('button','gal-nav-sm story-next');next.type='button';next.append(ic('right'));next.setAttribute('aria-label','인형 보이스로');
 const tabs=el('div','story-tabs');const pages=[['인형 이야기'],['인형 보이스']];
 const body=el('div','story-body');
 const aff=(p.voices||[]).filter(v=>v.group==='affinity');
 const draw=()=>{
  voiceStop();prev.disabled=storyPage===0;next.disabled=storyPage===1;
  tabs.replaceChildren();pages.forEach(([n],i)=>{const t=el('button','story-tab'+(i===storyPage?' on':''),n);t.type='button';t.setAttribute('aria-pressed',String(i===storyPage));t.onclick=()=>{storyPage=i;draw()};tabs.append(t)});
  body.replaceChildren();
  if(storyPage===0){
   if(!p.infoStories?.length){body.append(el('p','doll-empty','한국어 번역 준비 중이에요.'));return}
   p.infoStories.forEach((t,i)=>{const a=el('article','doll-story');const h=el('div','doll-story-head');h.append(el('h4','','이야기 '+(i+1)));const lv=p.storyLevels?.[i];if(lv)h.append(el('span','voice-unlock','친밀도 '+lv));a.append(h,sentenceBlock(t));body.append(a)});
  }else{
   if(!aff.length){body.append(el('p','doll-empty','친밀도 보이스가 없어요.'));return}
   const t=el('div','voice-top');t.append(el('p','load-note',LOAD_NOTE),repeatButton());body.append(t);
   aff.forEach(v=>body.append(voiceRow(p,v,p.voiceKey)));
   // 숙소 대화 (같은 친밀도에 열리는 대화 장면) — 따로 펼쳐서
   const g=(index?.groups||[]).find(x=>x.category==='dorm'&&x.key===p.voiceKey);
   if(g?.episodes?.length){
    const wrap=el('div','dorm-more');const tg=el('button','dorm-more-toggle');tg.type='button';tg.setAttribute('aria-expanded','false');tg.append(document.createTextNode('숙소 대화 다시 보기 ('+g.episodes.length+'편) '),ic('right','tri'));
    const list=el('div','dorm-more-list');list.hidden=true;
    tg.onclick=()=>{const o=list.hidden;list.hidden=!o;tg.setAttribute('aria-expanded',String(o));wrap.classList.toggle('open',o)};
    g.episodes.forEach((e,i)=>{const r=el('button','doll-talk');r.type='button';r.append(el('span','doll-talk-num',String(i+1).padStart(2,'0')),el('strong','',e.title),el('span','voice-unlock',e.level?'친밀도 '+e.level:''));if(get('completed.'+e.id,false))r.append(withIc('check','열람 완료','completed-mark'));const ar=el('span','doll-talk-arrow');ar.append(ic('right'));r.append(ar);r.onclick=()=>openEpisode(e.id);list.append(r)});
    wrap.append(tg,list);body.append(wrap);
   }
  }
 };
 prev.onclick=()=>{if(storyPage>0){storyPage--;draw()}};next.onclick=()=>{if(storyPage<1){storyPage++;draw()}};
 head.append(prev,tabs,next);box.append(head,body);draw();return box;
}
// 본섭에만 있는 글을 옮긴 곳에 붙이는 「팬 번역」 안내 (2026-10-29 채운)
function fanNote(){const w=el('div','fan-tl');w.append(el('span','fan-tl-tag','팬 번역'),el('span','fan-tl-text','본섭에만 있는 글을 Claude(AI)로 옮긴 팬 번역이에요. 오류는 피드백 폼으로 알려 주세요.'));const u=(typeof feedbackURL==='function'&&feedbackURL())||siteInfo?.home?.feedback?.form;if(u){const a=el('a','fan-tl-link','피드백 폼');a.href=u;a.target='_blank';a.rel='noopener';w.append(a)}return w}
function renderDoll(p){
 const host=$('#dollView');host.replaceChildren();$('#crumb').textContent='인형 기록 · '+p.name;
 const back=el('button','folder-back');back.type='button';back.append(ic('left'),document.createTextNode(' 인형 목록'));back.onclick=()=>showDolls();host.append(back);
 // 1) 투영 + 기본 프로필 + 이력
 const hero=el('section','doll-hero');
 const proj=(p.projections||[]).map(x=>({img:x.img,title:x.name,tab:STAGE_NAME[x.stage]||'투영',desc:x.desc}));
 const artCol=el('div','doll-art-col');
 if(proj.length){artCol.append(el('p','load-note',LOAD_NOTE),gallery(p,proj,{label:'투영',tabs:true,cls:'gal-projection'}))}
 hero.append(artCol);
 const info=el('div','doll-info');
 info.append(el('div','eyebrow',[p.company,p.role].filter(Boolean).join(' / ').toUpperCase()||'DOLL RECORD'));
 const nameRow=el('div','doll-name-row');nameRow.append(el('h1','doll-name',p.name));
 if(p.alt?.key){const a=el('button','doll-alt');a.type='button';a.append(el('span','doll-alt-label','이격'),el('b','',p.alt.name||p.alt.key),ic('right'));a.setAttribute('aria-label',(p.alt.name||'')+' 프로필로 이동');a.onclick=()=>showDoll(p.alt.key);nameRow.append(a)}
 info.append(nameRow);
 // 전속 스토리로 바로 가기 (채운 2026-10-29, 기록 166) — 이격 버튼 아래 줄
 {const EXH={'exclusive:24winter':1080};const exs=(typeof displayGroups!=='undefined'?displayGroups:[]).filter(g=>g.category==='exclusive'&&String(g.doll?.heroId??EXH[g.id]??'')===String(p.heroId));
  if(exs.length){const row=el('div','doll-links');for(const g of exs){const b=el('button','doll-alt doll-ex');b.type='button';b.append(el('span','doll-alt-label','전속 스토리'),el('b','',chapterDisplayTitle(g)),ic('right'));b.onclick=()=>showChapter(groupKey(g),'exclusive');row.append(b)}info.append(row)}}
 if(p.fanTL)info.append(fanNote());
 const sub=el('p','doll-sub');sub.append(el('span','doll-stars',starText(p.stars)));if(p.nameEn)sub.append(el('span','',p.nameEn));info.append(sub);
 const dl=el('dl','doll-facts');
 for(const [k,v] of [['클래스',p.role],['기업',p.company],['모델명',p.model],['직업',p.job],['생일',bdayText(p.birthday)],['성우',p.cv]]){if(!v)continue;dl.append(el('dt','',k),el('dd','',v))}
 info.append(dl);
 if(p.quote)info.append(el('blockquote','doll-quote',cleanTags(p.quote)));
 if(p.oathTitle?.length){const o=el('div','doll-oath');const top=el('div','doll-oath-top');top.append(el('span','doll-oath-label','서약 칭호'));const t=el('span','doll-oath-title');p.oathTitle.forEach((x,i)=>{if(i)t.append(el('i','doll-oath-sep'));t.append(el('span','',x))});top.append(t);o.append(top);if(p.oathDesc){o.append(el('hr','doll-oath-line'),el('p','doll-oath-desc',p.oathDesc))}info.append(o)}
 const chips=(label,arr)=>{if(!arr?.length)return;const w=el('div','doll-chips');w.append(el('span','doll-chips-label',label));arr.forEach(x=>w.append(el('span','doll-chip',x)));info.append(w)};
 chips('좋아함',p.likes);chips('싫어함',p.dislikes);
 if(p.relations?.length){const w=el('div','doll-chips');w.append(el('span','doll-chips-label','관계'));for(const r of p.relations){const key=(dollIndex?.dolls||[]).find(d=>d.heroId===r.heroId)?.voiceKey;const c=el(key?'button':'span','doll-chip rel'+(key?' link':''));if(key){c.type='button';c.title=r.name+' 프로필로 이동';c.onclick=()=>showDoll(key)}c.append(el('b','',r.name),document.createTextNode(' '+String(r.text||'').replace(/^"|"$/g,'')));w.append(c)}info.append(w)}
 const car=el('div','doll-career');car.append(el('h4','',window.L?window.L('이력'):'이력'));car.append(p.career?sentenceBlock(p.career):el('p','doll-empty','한국어 번역 준비 중이에요.'));info.append(car);
 hero.append(info);host.append(hero);
 // 2) 인형 스토리
 host.append(foldSection('story','인형 스토리','',inner=>inner.append(storyPanel(p))));
 // 3) 보이스
 const vc=(p.voices||[]).filter(v=>v.group!=='affinity').length+(p.skinVoices||[]).reduce((a,s)=>a+s.voices.length,0);
 if(vc)host.append(foldSection('voice','보이스',vc+'개',inner=>inner.append(voicePanel(p))));
 // 4) 스킨
 const skins=(p.skinList||[]).map(x=>({img:x.img,title:x.name,desc:x.desc,photo:x.photo,photoName:x.photoName}));
 if(skins.length)host.append(foldSection('skin','스킨',skins.length+'벌',inner=>{inner.append(el('p','load-note',LOAD_NOTE),gallery(p,skins,{label:'스킨',cls:'gal-skin'}))}));
 window.scrollTo(0,0);
}
// 숙소 대화 회차: 목록(분류)에는 없지만 인형 프로필에서 열림 → 앞뒤 · 돌아가기를 그 인형 안에서
function dormFor(id){for(const g of index?.groups||[]){if(g.category!=='dorm')continue;const i=(g.episodes||[]).findIndex(e=>e.id===id);if(i>=0)return {g,i,e:g.episodes[i]}}return null}

applySettings();fetchJSON(dataPath('speakers.json')).then(m=>speakerAliases=m.aliases||{}).catch(()=>{});fetchJSON('./data/image_map.json',1).then(m=>{imageMap=m.portraits||m;const r=parseRoute();if(r.type==='home'&&!r.category&&document.querySelector('.bday-face'))drawLibrary()}).catch(()=>{});
// v0.9.2a: 느린 연결에서도 첫 화면이 비지 않게, 목록 데이터를 기다리지 않고 먼저 그린다
{const r=parseRoute();if(r.type==='home'&&!r.category){category=null;drawLibrary()}else{$('#groups').replaceChildren(el('p','loading-note','기록을 불러오는 중…'))}}
fetchJSON(dataPath('dolls.json')).then(d=>{dolls=d;if(index&&category==null&&!openFolderId&&!$('#search').value.trim()&&!$('#library').classList.contains('hidden'))drawLibrary()}).catch(()=>{dolls={dolls:[]}});
fetchJSON(dataPath('index.json')).then(d=>{initIndex(d);fillHeroTags();restoreRoute()}).catch(e=>$('#groups').append(error('데이터를 불러올 수 없습니다. data/'+dataLang()+'/index.json 위치를 확인하고 로컬 서버 또는 Cloudflare Pages에서 실행해 주세요. ('+e.message+')')));
})();