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
 if(route.type==='archive')return '#archive';
 if(route.type==='algos')return '#algorithms'+(route.cat?'/'+encodeURIComponent(route.cat):'');
 if(route.type==='record')return '#record/'+encodeURIComponent(route.id);
 if(route.type==='item')return '#item/'+encodeURIComponent(route.id);
 if(route.type==='dorm')return '#dorm/'+encodeURIComponent(route.id);
 if(route.type==='items')return '#items'+(route.cat?'/'+encodeURIComponent(route.cat):'');
 if(route.type==='tips')return '#tips'+(route.cat?'/'+encodeURIComponent(route.cat):'');
 if(route.type==='effects')return '#effects'+(route.cat?'/'+encodeURIComponent(route.cat):'');
 if(route.type==='commander')return '#commander';
 if(route.type==='fairy')return '#sprites'+(route.cat?'/'+route.cat:'');
 if(route.type==='functions')return '#functions'+(route.cat?'/'+route.cat.split('/').map(encodeURIComponent).join('/'):'');
 if(route.type==='records')return '#records'+(route.cat?'/'+encodeURIComponent(route.cat):'');
 if(route.type==='doll')return '#doll/'+encodeURIComponent(route.id)+(route.part&&route.part!=='profile'?'/'+encodeURIComponent(route.part):'');
 if(route.type==='chapter')return '#chapter/'+encodeURIComponent(route.category)+':'+encodeURIComponent(route.id);
 // v0.9.0: #home = 첫 화면(공지·일러스트·피드백), #home/<분류> = 그 분류의 스토리 목록 (#home/all = 전체 기록)
 return route.category?'#home/'+encodeURIComponent(route.category)+(route.shelf?'/'+encodeURIComponent(route.shelf):''):'#home';
}
function parseRoute(){
 let raw=location.hash.slice(1);
 try{
  if(raw.startsWith('ep/'))return {type:'episode',id:decodeURIComponent(raw.slice(3))};
  if(raw==='dolls')return {type:'dolls'};
  if(raw==='archive')return {type:'archive'};
  if(raw==='algorithms'||raw.startsWith('algorithms/'))return {type:'algos',cat:raw.startsWith('algorithms/')?decodeURIComponent(raw.slice(11)):null};
  if(raw.startsWith('record/'))return {type:'record',id:decodeURIComponent(raw.slice(7))};
  if(raw.startsWith('item/'))return {type:'item',id:decodeURIComponent(raw.slice(5))};
  if(raw.startsWith('dorm/'))return {type:'dorm',id:decodeURIComponent(raw.slice(5))};
  if(raw==='items'||raw.startsWith('items/'))return {type:'items',cat:raw.startsWith('items/')?decodeURIComponent(raw.slice(6)):null};
  if(raw==='tips'||raw.startsWith('tips/'))return {type:'tips',cat:raw.startsWith('tips/')?decodeURIComponent(raw.slice(5)):null};
  if(raw==='commander')return {type:'commander'};
  if(raw==='sprites'||raw.startsWith('sprites/'))return {type:'fairy',cat:raw.startsWith('sprites/')?raw.slice(8):null};
  if(raw==='functions'||raw.startsWith('functions/'))return {type:'functions',cat:raw.startsWith('functions/')?raw.slice(10).split('/').map(decodeURIComponent).join('/'):null};
  if(raw==='effects'||raw.startsWith('effects/'))return {type:'effects',cat:raw.startsWith('effects/')?decodeURIComponent(raw.slice(8)):null};
  if(raw==='records'||raw.startsWith('records/'))return {type:'records',cat:raw.startsWith('records/')?decodeURIComponent(raw.slice(8)):null};
  if(raw.startsWith('doll/')){const [k,pt]=raw.slice(5).split('/');return {type:'doll',id:decodeURIComponent(k),part:pt?decodeURIComponent(pt):null}}
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
function rememberScroll(){try{history.replaceState({...(history.state||{}),scrollY:window.scrollY,t:Date.now()},'')}catch(e){}}
let navCount=0;
function saveRoute(route){rememberScroll();navCount++;history.pushState({route},'',location.pathname+location.search+routeHash(route))}
const SCROLL_STALE=30*60*1000;
function restoreScroll(st){
 if(!st||typeof st.scrollY!=='number'||!st.scrollY)return;
 if(st.t&&Date.now()-st.t>SCROLL_STALE)return;
 const y=st.scrollY;let n=0;
 const go=()=>{window.scrollTo(0,y);if(++n<6&&Math.abs(window.scrollY-y)>4)setTimeout(go,150)};
 requestAnimationFrame(go);
}
if('scrollRestoration' in history)history.scrollRestoration='manual';
window.addEventListener('pagehide',rememberScroll);
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
// v1.7.4 전체 기록 = 메인 · 전속 · 이벤트 · 그 외 탭 화면. 'all' 로 들어오면 마지막에 본 탭(처음엔 메인)
const storyTabIds=()=>storyCategories.filter(([id])=>id!=='all').map(([id])=>id);
function showHome(cat=null,{push=true,shelf=null}={}){
 routeToken++;
 if(cat==='all'){const t=get('storyCat','main');const ids=storyTabIds();cat=ids.includes(t)?t:(ids[0]||'all')}
 selectCategory(cat);if(category&&category!=='all')set('storyCat',category);
 openFolderId=null;openShelf=shelf||null;
 $('#reader').classList.add('hidden');bgmLeave();
 $('#library').classList.remove('hidden');
 if(push)saveRoute({type:'home',category,shelf:openShelf});
 else if(location.hash==='#home/all'&&category!=='all')history.replaceState(history.state,'',location.pathname+location.search+routeHash({type:'home',category,shelf:null}));
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
 if(route.type==='dolls'){await showDolls({push:false});return}
 if(route.type==='archive'){await showArchive({push:false});return}
 if(route.type==='algos'){await showAlgos({push:false,cat:route.cat});return}
 if(route.type==='record'){await showRecord(route.id,{push:false});return}
 if(route.type==='item'){await showItem(route.id,{push:false});return}
 if(route.type==='dorm'){await showDormTheme(route.id,{push:false});return}
 if(route.type==='records'){await showRecords({push:false,cat:route.cat});return}
 if(route.type==='tips'){await showTips({push:false,cat:route.cat});return}
 if(route.type==='effects'){await showEffects({push:false,cat:route.cat});return}
 if(route.type==='functions'){await showFunctions({push:false,cat:route.cat});return}
 if(route.type==='commander'){await showCommander({push:false});return}
 if(route.type==='fairy'){await showFairy({push:false,cat:route.cat});return}
 if(route.type==='items'){await showItems({push:false,cat:route.cat});return}
 if(route.type==='doll'){await showDoll(route.id,{push:false,part:route.part});return}
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
// 공유 링크 (2026-10-30): 지금 보는 화면 주소를 그 언어 입구(/ja/ 등)로 만들어 공유 — 처음 받는 사람은 그 언어로 열림
const LANG_PATH={ko:'',ja:'ja/',en:'en/',tw:'tw/',zh:'zh/'};
function shareURL(){const base=location.origin+location.pathname.replace(/(?:ja|en|tw|zh)\/$/,'').replace(/index\.html$/,'');return base+(LANG_PATH[uiLang()]||'')+location.hash}
function toast(t){let e=$('#shareToast');if(!e){e=el('div','share-toast');e.id='shareToast';e.setAttribute('role','status');document.body.append(e)}e.textContent=t;e.classList.add('on');clearTimeout(e._t);e._t=setTimeout(()=>e.classList.remove('on'),1800)}
async function shareNow(title){const url=shareURL();const t=[title,'//:_42LAB-Archive'].filter(Boolean).join(' · ');
 if(navigator.share&&matchMedia('(pointer:coarse)').matches){try{await navigator.share({title:t,url});return}catch(e){if(e&&e.name==='AbortError')return}}
 try{await navigator.clipboard.writeText(url);toast(L('링크를 복사했어요.'))}catch{prompt(L('이 링크를 복사하세요.'),url)}}
function shareHash(hash,title){const base=location.origin+location.pathname.replace(/(?:ja|en|tw|zh)\/$/,'').replace(/index\.html$/,'');const url=base+(LANG_PATH[uiLang()]||'')+hash;const t=[title,'//:_42LAB-Archive'].filter(Boolean).join(' · ');
 (async()=>{if(navigator.share&&matchMedia('(pointer:coarse)').matches){try{await navigator.share({title:t,url});return}catch(e){if(e&&e.name==='AbortError')return}}
 try{await navigator.clipboard.writeText(url);toast(L('링크를 복사했어요.'))}catch{prompt(L('이 링크를 복사하세요.'),url)}})()}
function linkBtn(hash,title){const b=el('button','item-link');b.type='button';b.title='링크 복사';b.setAttribute('aria-label','링크 복사');b.append(ic('share'));b.onclick=e=>{e.stopPropagation();shareHash(hash,title)};return b}
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
// v1.2 기록 찾기 필터: 스토리 · 인형 · 아이템 · 시계 기록 · 로딩 팁 (아이콘은 data-kind 로 나중에 CSS 에서)
const SEARCH_KINDS=[['all','전체'],['story','스토리'],['doll','인형'],['item','아이템'],['record','시계 기록'],['tip','로딩 팁']];
let searchKind=SEARCH_KINDS.some(([k])=>k===get('searchKind','all'))?get('searchKind','all'):'all',searchDataLoading=false;
function ensureSearchData(){
 if(searchDataLoading||(dollIndex&&itemData&&furnData&&wrData&&tipData))return;
 searchDataLoading=true;
 Promise.all([loadDollIndex(),loadItems(),loadFurniture(),loadRecords(),tipData?tipData:fetchJSON(dataPath('loading_tips.json')).then(d=>tipData=d)].map(x=>Promise.resolve(x).catch(()=>null)))
  .then(()=>{searchDataLoading=false;if($('#search').value.trim()&&!$('#library').classList.contains('hidden'))drawLibrary()});
}
function searchExtra(nq){
 const hit=(...v)=>v.some(x=>norm(cleanTags(x||'')).includes(nq));
 const dolls=(dollIndex?.dolls||[]).filter(d=>dollMatches(d,dnorm(nq)));
 const items=[...(itemData?.items||[]).map(o=>({...o,kind:'item'})),...(furnData?.items||[]).map(o=>({...o,kind:'furn'}))].filter(o=>hit(o.name)||(nq.length>=2&&hit(o.desc)));
 const recs=(wrData?.records||[]).filter(r=>hit(r.name)||(nq.length>=2&&hit(r.description)));
 const tips=(tipData?.tips||[]).filter(t=>hit(t.title)||(nq.length>=2&&hit(t.text)));
 return {dolls,items,recs,tips};
}
function renderSearch(q,host){
 const nq=norm(q);ensureSearchData();
 const ex=searchExtra(nq);
 const bar=el('div','search-filters');bar.setAttribute('role','tablist');bar.setAttribute('aria-label','기록 찾기 분류');
 {const lb=el('span','search-filters-label');lb.title='필터';lb.append(ic('filter'));bar.append(lb)}
 const counts={doll:ex.dolls.length,item:ex.items.length,record:ex.recs.length,tip:ex.tips.length};
 for(const [k,name] of SEARCH_KINDS){
  const b=el('button','search-filter'+(searchKind===k?' selected':''));b.type='button';b.dataset.kind=k;b.setAttribute('role','tab');b.setAttribute('aria-selected',String(searchKind===k));
  b.append(el('span','search-filter-ic'),el('span','',name));if(counts[k]!=null)b.append(el('span','wr-tab-n',String(counts[k])));
  b.onclick=()=>{searchKind=k;set('searchKind',k);drawLibrary()};bar.append(b);
 }
 host.append(bar);
 const show=k=>searchKind==='all'||searchKind===k;
 let any=false;
 if(show('story'))any=renderStorySearch(q,host,searchKind==='story')||any;
 if(show('doll')&&ex.dolls.length){any=true;const sec=searchSection(host,'인형',ex.dolls.length);const g=el('div','doll-grid');ex.dolls.slice(0,searchKind==='doll'?99:8).forEach(d=>g.append(dollCard(d)));sec.append(g)}
 if(show('item')&&ex.items.length){any=true;const sec=searchSection(host,'아이템',ex.items.length);const list=el('div','search-episodes');
  const lim=searchKind==='item'?200:12;
  ex.items.slice(0,lim).forEach(o=>{const b=el('button','search-ep search-item');b.type='button';b.append(itemIcon(o.icon,'sm'));const t=el('span','search-item-text');t.append(el('small','',o.kind==='furn'?'숙소':(ITEM_PAGES.find(([pg])=>pg===itemTab(o))||[,''])[1]),el('strong','',o.name));b.append(t);b.onclick=()=>showItem(o.id);list.append(b)});
  if(ex.items.length>lim)list.append(el('p','search-hint','앞의 '+lim+'건만 보여 줍니다. 「아이템」 필터를 누르면 더 볼 수 있어요.'));sec.append(list)}
 if(show('record')&&ex.recs.length){any=true;const sec=searchSection(host,'시계 기록',ex.recs.length);const list=el('div','search-episodes');const tn=new Map((wrData.types||[]).map(t=>[t.id,t.name]));
  ex.recs.forEach(r=>{const b=el('button','search-ep');b.type='button';b.append(el('small','',tn.get(r.type)||''),el('strong','',r.name));b.onclick=()=>r.type===7?showRecord(r.id):openLore(r.name,r.description,r.id);list.append(b)});sec.append(list)}
 if(show('tip')&&ex.tips.length){any=true;const sec=searchSection(host,'로딩 팁',ex.tips.length);const list=el('div','search-tips');
  ex.tips.forEach(t=>{const c=el('div','search-tip');c.append(el('small','',t.title),el('p','',cleanTags(t.text)));list.append(c)});sec.append(list)}
 if(!any&&cast&&!searchDataLoading)host.append(error('검색 결과가 없습니다.'));
}
function renderStorySearch(q,host,only){
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
 if(only&&!any&&cast)host.append(error('검색 결과가 없습니다.'));
 return any;
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
  $('#listTitle').textContent=openShelf?name+' › '+openShelf:'전체 기록';$('#listCount').textContent=displayGroups.filter(g=>categoryMatches(g,category)&&(!openShelf||shelfFor(g)===openShelf)).length+'개 챕터';
  $('#listHead').classList.remove('hidden');
 }
 const visible=displayGroups.filter(g=>categoryMatches(g,category)).map(g=>({g,episodes:sortedEpisodes(g).filter(e=>!q||[e.title,e.description,e.id,g.title,chapterDisplayTitle(g)].some(v=>(v||'').toLowerCase().includes(q)))})).filter(x=>x.episodes.length);
 if(!visible.length){host.append(error('검색 결과가 없습니다.'));return}
 const selected=visible.find(x=>x.g.id===openFolderId||x.g.key===openFolderId);
 if(!openFolderId&&!openShelf&&category!=='all'){
  const bar=el('div','doll-controls wr-controls story-tabs');const tabs=el('div','wr-tabs');tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label','스토리 분류');
  for(const [id,name] of storyCategories.filter(([id])=>id!=='all')){
   const n=displayGroups.filter(g=>categoryMatches(g,id)).length;if(!n)continue;
   const on=id===category;const b=el('button','cat-tab wr-tab'+(on?' selected':''));b.type='button';b.setAttribute('role','tab');b.setAttribute('aria-selected',String(on));
   b.append(el('span','',name),el('span','wr-tab-n',String(n)));
   b.onclick=()=>{if(on)return;showHome(id,{push:false});history.replaceState(history.state,'',location.pathname+location.search+routeHash({type:'home',category:id,shelf:null}))};
   tabs.append(b)}
  bar.append(tabs);host.append(bar);
 }
 if(selected){
  const back=el('button','folder-back');back.append(ic('menu'),document.createTextNode(' '+(selected.g.shelfFolder?shelfFor(selected.g):'폴더 목록')));back.onclick=()=>showHome(category,{shelf:selected.g.shelfFolder?shelfFor(selected.g):null});
  // v0.12.4 (58번) 이전 · 다음 폴더: 같은 분류 목록 순서대로, 튜토리얼처럼 선반 폴더면 그 선반 안에서만. 처음 · 끝은 흐리게
  {const sib=visible.map(x=>x.g).filter(g=>selected.g.shelfFolder?(g.shelfFolder&&shelfFor(g)===shelfFor(selected.g)):!g.shelfFolder);const at=sib.findIndex(g=>g===selected.g);
   const nav=el('div','folder-nav');nav.append(back);
   const mk=(g,dir)=>{const b=el('button','folder-step '+dir);b.type='button';const lab=el('span','folder-step-label');if(dir==='prev')lab.append(ic('left'),el('span','','이전'));else lab.append(el('span','','다음'),ic('right'));b.append(lab);if(g){b.append(el('small','folder-step-name',chapterDisplayTitle(g)));b.onclick=()=>showChapter(groupKey(g),category)}else b.disabled=true;return b};
   const steps=el('div','folder-steps');steps.append(mk(at>0?sib[at-1]:null,'prev'),mk(at>=0&&at<sib.length-1?sib[at+1]:null,'next'));nav.append(steps);host.append(nav)}
  const panel=el('section','folder-detail');const art=el('div','folder-art');art.dataset.gid=selected.g.id;art.append(el('div','folder-art-kicker','42LAB / CHAPTER RECORD'),(()=>{const d=el('div','folder-art-symbol');d.append(ic('record'));return d})(),el('h2','',chapterDisplayTitle(selected.g)),el('p','folder-art-pending','CHAPTER IMAGE PENDING'));applyFolderArt(art);
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
    visual.append(el('span','folder-tile-code','42LAB / '+String(i+1).padStart(2,'0')),(()=>{const d=el('span','folder-tile-symbol');d.append(ic('record'));return d})());
    const info=el('div','folder-tile-info');info.append(el('strong','',title));if(g.subtitle)info.append(el('span','chapter-card-subtitle',g.subtitle));info.append(el('small','',episodes.length+'개 기록'));
    b.append(visual,info);
   }else if(viewMode==='folder'){
    {const fi=el('span','drive-folder-icon');fi.append(ic('folder-stack'));b.append(fi)}
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

// v1.5 퀵 바: 홈 · 전체 기록 · 인형 기록 · 자료실 (스토리 분류는 전체 기록 안에서)
const QUICK=[['home','홈'],['all','전체 기록'],['dolls','인형 기록'],['archive','자료실']];
function renderCatTabs(){
 const nav=$('#catTabs');if(!nav)return;
 if(nav.childElementCount!==QUICK.length){nav.replaceChildren();for(const [id,name] of QUICK){const b=el('button','cat-tab'+(id==='home'?' cat-home':''),name);b.type='button';b.dataset.quick=id;
  b.onclick=()=>{$('#search').value='';if(id==='home')showHome(null);else if(id==='all')showHome('all');else if(id==='dolls')showDolls();else showArchive()};nav.append(b)}}
 const cur=category==null?'home':'all';
 nav.querySelectorAll('.cat-tab').forEach(b=>{const on=b.dataset.quick===cur;b.classList.toggle('selected',on);b.setAttribute('aria-pressed',String(on))});
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
 const ext=el('section','home-ext');ext.append(el('div','tb-label','외부 URL'));
 const chips=el('nav','home-chips');chips.setAttribute('aria-label','외부 URL');
 const chip=(label,href,cls='')=>{const a=el(href?'a':'span','home-chip'+(cls?' '+cls:'')+(href?'':' disabled'),label);if(href){a.href=href;a.target='_blank';a.rel='noopener'}chips.append(a)};
 for(const s of home.otherSites||[])chip(s.name+(s.url?'':' · 준비 중'),s.url||'');
 chips.append(el('span','home-chip-sep','│'));
 chip('피드백 폼',feedbackURL()||fb.form||'','primary');chip('X '+(fb.xHandle||''),fb.x||'');if(fb.email)chip(fb.email,'mailto:'+fb.email);
 ext.append(chips);host.append(ext);
 // 공지 (리스트)
 const notice=landingCard('home-notice','공지','menu');const list=el('div','notice-list');
 // v1.3 업데이트 공지는 가장 최신 하나만 목록에, 지난 것은 오른쪽 위 「이전 기록」에서
 const allN=sortedNotices(),updates=allN.filter(n=>n.kind==='update');
 const notices=allN.filter(n=>n.kind!=='update'||n===updates[0]);
 if(updates.length>1){const b=el('button','notice-history');b.type='button';b.append(document.createTextNode('이전 기록'),el('span','wr-tab-n',String(updates.length-1)));
  b.onclick=()=>openInfo({title:'업데이트 기록',items:updates.slice(1).map(n=>({title:[noticeDate(n),n.title].filter(Boolean).join(' · '),lines:n.lines||[]}))});
  notice.querySelector('.home-card-head').append(b)}
 if(!notices.length)list.append(el('p','bm-empty',siteInfo?'등록된 공지가 없습니다.':'공지를 불러오는 중…'));
 for(const n of notices){const b=el('button','notice-row'+(n.pinned?' pinned':''));b.type='button';b.append((()=>{const s=el('span','notice-pin');if(n.pinned)s.append(ic('pin'));return s})(),el('span','notice-date',noticeDate(n)),el('span','notice-title',n.title||''));b.onclick=()=>openNotice(n);list.append(b)}
 notice.append(list);
 // 생일 달력 (PC만)
 const cal=landingCard('home-birthday','생일');renderBirthday(cal);
 // 외부 URL · 피드백 · 연락처 (PC만) — 한 칸에서 ‹ › 로 쪽 넘김 (v0.12.21)
 const side=el('div','home-side');
 const sites=el('div','home-page');
 for(const s of home.otherSites||[]){const a=el(s.url?'a':'div','home-link'+(s.url?'':' disabled'));if(s.url){a.href=s.url;a.target='_blank';a.rel='noopener'}a.append(el('strong','',s.name),el('small','',s.url?(s.desc||''):(s.desc?s.desc+' · ':'')+'준비 중'));sites.append(a)}
 if(!(home.otherSites||[]).length)sites.append(el('p','bm-empty','준비 중'));
 const fbPage=el('div','home-page');fbPage.append(...feedbackLinks());
 side.append(pagedCard('home-other',[['외부 URL',sites],['피드백 · 연락처',fbPage]]));
 wrap.append(notice,cal,side);host.append(wrap);
}
function sortedNotices(){return (siteInfo?.notices||[]).map((n,i)=>[n,i]).sort(([a,i],[b,j])=>(b.pinned===true)-(a.pinned===true)||String(b.date||'').localeCompare(String(a.date||''))||i-j).map(([n])=>n)}
function openNotice(n){openInfo({title:n.title,items:[{title:noticeDate(n),lines:n.lines||[]}]});if(n.popup){const box=el('div','popup-links');box.append(...feedbackLinks());$('#infoBody').append(box)}}
// v0.12.22 팝업 공지 (popup:true): 공지마다 한 번만, 첫 방문 창이 있으면 그 창을 닫은 뒤에
function maybePopup(){
 const n=(siteInfo?.notices||[]).find(x=>x.popup&&x.id&&!get('popupSeen.'+x.id,false));if(!n)return;
 const show=()=>{if($('#infoDialog').open)return;openNotice(n);$('#infoDialog').addEventListener('close',()=>set('popupSeen.'+n.id,true),{once:true})};
 const w=$('#welcome');if(w&&w.open)w.addEventListener('close',()=>setTimeout(show,250),{once:true});else show();
}
function feedbackLinks(){
 const fb=siteInfo?.home?.feedback||{};
 const form=el('a','home-link primary');form.href=feedbackURL()||fb.form||'#';form.target='_blank';form.rel='noopener';form.append(el('strong','','피드백 폼'),el('small','','오류 · 오탈자 · 기능 제안은 폼으로 먼저 보내 주세요.'));
 const contact=el('div','home-contact');contact.append(el('div','home-contact-label','개인 연락처'));
 const x=el('a','home-link');x.href=fb.x||'#';x.target='_blank';x.rel='noopener';x.append(el('strong','','X '+(fb.xHandle||'')),el('small','',fb.x?fb.x.replace(/^https?:\/\//,''):''));contact.append(x);
 if(fb.email){const m=el('a','home-link');m.href='mailto:'+fb.email;m.append(el('strong','','이메일'),el('small','',fb.email));contact.append(m)}
 contact.append(el('p','home-contact-note','되도록이면 피드백 사항은 피드백 폼으로 제출 부탁드리겠습니다.'));
 return [form,contact];
}
// 쪽 넘김 카드: pages = [[제목, 내용], …]. 제목줄 오른쪽 ‹ 1/2 › 단추, 키보드 ← → 도 됨
function pagedCard(cls,pages){
 const card=el('section','home-card home-paged '+cls),head=el('div','home-card-head'),h=el('h2','');
 const nav=el('div','page-nav'),prev=el('button','cal-nav'),next=el('button','cal-nav'),count=el('span','page-count');
 prev.type=next.type='button';prev.append(ic('left'));next.append(ic('right'));
 prev.setAttribute('aria-label','이전 쪽');next.setAttribute('aria-label','다음 쪽');
 nav.append(prev,count,next);head.append(h,nav);card.append(head);
 for(const [,body] of pages)card.append(body);
 let i=0;const go=d=>{i=(i+d+pages.length)%pages.length;h.textContent=pages[i][0];count.textContent=(i+1)+' / '+pages.length;pages.forEach(([,b],k)=>b.hidden=k!==i)};
 prev.onclick=()=>go(-1);next.onclick=()=>go(1);
 card.tabIndex=-1;card.addEventListener('keydown',e=>{if(e.target.closest('input,textarea'))return;if(e.key==='ArrowLeft'){go(-1);e.preventDefault()}else if(e.key==='ArrowRight'){go(1);e.preventDefault()}});
 go(0);return card;
}
// ---------- v0.9.3 생일 달력 ----------
// 날짜는 한국 시간 새벽 5시에 바뀐다 (게임 서버 갱신 시각)
function gameToday(){const t=new Date(Date.now()+(9-5)*3600e3);return {y:t.getUTCFullYear(),m:t.getUTCMonth()+1,d:t.getUTCDate()}}
let dolls=null;
let calShift=0; // 0 = 이번 달, -1 = 지난달, +1 = 다음 달
// v1.7.5 첫 화면 생일 칸은 오늘 생일인 인형(없으면 다음 생일)만, 달력은 「달력 펼치기」 팝업에서
const bdayCard=(x,isToday)=>{
 const c=el('div','bday-card'+(isToday?' today':''));
 const face=el('div','avatar bday-face');const url=(x.portrait&&imageMap[x.portrait])||imageMap[x.nameKo]||imageMap[x.name];
 if(url){const im=document.createElement('img');im.src=url.startsWith('./')?url:'./'+url;im.alt='';im.onerror=()=>{im.remove();face.classList.add('fallback')};face.append(im)}else face.classList.add('fallback');
 const t=el('div','bday-text');t.append(el('strong','',x.birthday+'. Happy Birthday!'),el('span','',x.name));
 c.append(face,t);return c};
function nextBirthday(T){
 const list=(dolls?.dolls||[]).filter(x=>/^\d{4}$/.test(x.birthday||''));if(!list.length)return null;
 const base=Date.UTC(T.y,T.m-1,T.d);let best=null;
 for(const x of list){const m=+x.birthday.slice(0,2),d=+x.birthday.slice(2);let t=Date.UTC(T.y,m-1,d);if(t<=base)t=Date.UTC(T.y+1,m-1,d);const n=Math.round((t-base)/864e5);if(!best||n<best.n)best={n,key:x.birthday,who:[]};}
 best.who=list.filter(x=>x.birthday===best.key);return best}
function renderBirthday(card){
 const T=gameToday(),todayKey=String(T.m).padStart(2,'0')+String(T.d).padStart(2,'0');
 const cards=el('div','bday-list');
 if(!dolls)cards.append(el('p','bm-empty','생일 정보를 불러오는 중…'));
 else{
  const who=(dolls.dolls||[]).filter(x=>x.birthday===todayKey);
  who.forEach(x=>cards.append(bdayCard(x,true)));
  if(!who.length){cards.append(el('p','bm-empty','오늘 생일인 인형이 없어요.'));
   const nx=nextBirthday(T);
   if(nx){const r=el('div','bday-next');r.append(el('span','bday-next-label','다음 생일'),el('span','bday-next-date',nx.key.slice(0,2)+'.'+nx.key.slice(2)),el('span','bday-next-d','D-'+nx.n));cards.append(r);nx.who.forEach(x=>cards.append(bdayCard(x,false)))}}
 }
 const btn=el('button','bday-open');btn.type='button';btn.append(ic('expand'),el('span','','달력 펼치기'));btn.onclick=openBirthdayCalendar;
 card.append(cards,btn);renderGacha(card);card.append(el('p','cal-note','매일 오전 5시(KST)에 갱신됩니다.'));
}
// v1.7.5 픽업(지정검색) 로테이션 — data/gacha.json (tools/client_extract/gacha.py). 기준일부터 days 일마다 다음 칸, 끝나면 처음으로
let gachaData=null,gachaLoading=false;
const redrawLanding=()=>{if(index&&category==null&&!openFolderId&&!$('#search').value.trim()&&!$('#library').classList.contains('hidden'))drawLibrary()};
function gachaNow(){
 const g=gachaData;if(!g?.slots?.length)return null;
 const T=gameToday(),[ay,am,ad]=g.anchor.split('-').map(Number);
 const since=Math.floor((Date.UTC(T.y,T.m-1,T.d)-Date.UTC(ay,am-1,ad))/864e5),n=g.slots.length;
 const k=Math.floor(since/g.days),at=((k%n)+n)%n,left=g.days-(since-k*g.days);
 const start=new Date(Date.UTC(ay,am-1,ad)+k*g.days*864e5);
 return {at,left,start,slot:g.slots[at],next:g.slots[(at+1)%n]};
}
const gTitle=p=>p.title?.[window.UI_LANG||'ko']||p.title?.ko||'';
function gachaDoll(id){
 const x=(dolls?.dolls||[]).find(d=>+d.heroId===+id),di=(dollIndex?.dolls||[]).find(d=>+d.heroId===+id);
 return {name:x?.name||di?.name||String(id),ko:x?.nameKo||x?.name||di?.name,career:di?.career,key:di?.voiceKey}}
function gachaFace(id,cls){
 const d=gachaDoll(id),b=el('button','gacha-face'+(cls?' '+cls:''));b.type='button';b.title=d.name;b.setAttribute('aria-label',d.name);
 const face=el('span','avatar');const url=imageMap[d.ko]||imageMap[d.name];
 if(url){const im=document.createElement('img');im.src=url.startsWith('./')?url:'./'+url;im.alt='';im.loading='lazy';im.onerror=()=>{im.remove();face.classList.add('fallback')};face.append(im)}else face.classList.add('fallback');
 b.append(face);
 if(d.career){const ci=el('span','dc-ic career gacha-career');ci.style.setProperty('--ci','url(/assets/img/class/career_'+d.career+'.png)');b.append(ci)}
 if(d.key)b.onclick=()=>showDoll(d.key);
 return b}
function gachaBlock(p,full){
 const box=el('div','gacha-pick'+(full?' full':''));
 box.append(el('div','gacha-title',gTitle(p)));
 const row=el('div','gacha-main');const m=gachaDoll(p.main);row.append(gachaFace(p.main,'main'));
 const t=el('div','gacha-main-text');t.append(el('span','gacha-label','메인 픽업'),el('strong','',m.name));row.append(t);box.append(row);
 const subs=el('div','gacha-subs');
 for(const id of p.subs){if(full){const c=el('div','gacha-sub');c.append(gachaFace(id),el('span','gacha-sub-name',gachaDoll(id).name));subs.append(c)}else subs.append(gachaFace(id))}
 box.append(subs);return box}
const mmdd=d=>String(d.getUTCMonth()+1).padStart(2,'0')+'.'+String(d.getUTCDate()).padStart(2,'0');
function renderGacha(card){
 const sec=el('div','gacha-sec');card.append(sec);
 if(!gachaData||!dollIndex){
  sec.append(el('p','bm-empty','픽업 일정을 불러오는 중…'));
  if(!gachaLoading){gachaLoading=true;Promise.all([gachaData||fetchJSON(new URL('/data/gacha.json',location.origin).href).then(d=>gachaData=d),loadDollIndex()]).then(redrawLanding).catch(()=>{gachaData=gachaData||{slots:[]};gachaLoading=false})}
  return}
 const now=gachaNow();if(!now){sec.remove();return}
 const head=el('div','gacha-head');head.append(el('span','gacha-head-title','픽업 일정'),el('span','gacha-server','글로벌 서버'),el('span','bday-next-d','D-'+now.left));head.title='글로벌 서버 기준이에요. 중국 본섭과는 일정이 달라요.';sec.append(head);
 const list=el('div','gacha-list');now.slot.forEach(p=>list.append(gachaBlock(p,false)));sec.append(list);
 const btn=el('button','bday-open');btn.type='button';btn.append(ic('expand'),el('span','','전체 픽업 일정'));btn.onclick=openGachaSchedule;sec.append(btn);
}
function openGachaSchedule(){
 openInfo({title:'픽업 일정',items:[]});
 const host=el('div','gacha-pop');$('#infoBody').append(host);
 const now=gachaNow();if(!now)return;const n=gachaData.slots.length,D=gachaData.days;
 host.append(el('p','cal-note gacha-pop-note','글로벌 서버 기준이에요. 중국 본섭과는 일정이 달라요.'),el('p','cal-note gacha-pop-note','2주마다 픽업 2개가 같이 열리고, 같은 순서로 돌아요. 매일 오전 5시(KST) 기준.'));
 for(let i=0;i<n;i++){
  const at=(now.at+i)%n,st=new Date(now.start.getTime()+i*D*864e5),en=new Date(st.getTime()+D*864e5);
  const sec=el('section','gacha-slot'+(i===0?' now':''));
  const h=el('div','gacha-slot-head');h.append(el('span','gacha-slot-date',mmdd(st)+' ~ '+mmdd(en)));if(i===0)h.append(el('span','bday-next-d','지금 · D-'+now.left));else h.append(el('span','gacha-slot-in',(i===1?now.left:now.left+(i-1)*D)+'일 뒤'));
  const body=el('div','gacha-slot-body');gachaData.slots[at].forEach(p=>body.append(gachaBlock(p,true)));
  sec.append(h,body);host.append(sec)}
}
function openBirthdayCalendar(){
 openInfo({title:'생일 달력',items:[]});
 const host=el('div','bday-pop');$('#infoBody').append(host);
 const T=gameToday(),todayKey=String(T.m).padStart(2,'0')+String(T.d).padStart(2,'0');
 const box=el('div','cal-box');const cards=el('div','bday-list');
 let picked=null; // 달력에서 누른 날 (MMDD). 없으면 오늘
 const showCards=()=>{
  cards.replaceChildren();const key=picked||todayKey,isToday=key===todayKey;
  const who=(dolls?.dolls||[]).filter(x=>x.birthday===key);
  if(!dolls){cards.append(el('p','bm-empty','생일 정보를 불러오는 중…'));return}
  if(!isToday){const h=el('div','bday-pick-head');const back=el('button','bday-back','오늘로');back.type='button';back.onclick=()=>{picked=null;draw();showCards()};h.append(el('span','',key.slice(0,2)+'.'+key.slice(2)+' 생일'),back);cards.append(h)}
  if(!who.length)cards.append(el('p','bm-empty',isToday?'오늘 생일인 인형이 없어요.':'이날 생일인 인형이 없어요.'));
  for(const x of who)cards.append(bdayCard(x,isToday));
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
   const c=days.has(d)?el('button',cls,String(d)):el('span',cls,String(d));
   if(days.has(d)){const names=list.filter(x=>+x.birthday.slice(2)===d).map(x=>x.name).join(', ');c.type='button';c.title=names;c.setAttribute('aria-label',M+'월 '+d+'일 생일: '+names);c.setAttribute('aria-pressed',String(picked===key));
    c.onclick=()=>{picked=(picked===key||key===todayKey)?null:key;draw();showCards()}}
   grid.append(c);
  }
  box.replaceChildren(head,grid);
 };
 draw();showCards();
 host.append(box,cards,el('p','cal-note','동그라미를 누르면 그날 생일인 인형을 볼 수 있어요.'));
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
 // v1.3 메뉴: 홈 / 기록 열람(전체 기록 ▶ · 인형 기록) / 자료실(시계 기록 ▶ · 로딩 팁 · 아이템)
 host.append(el('div','archive-menu-section','기록 열람'));
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
 {const sec=el('button','archive-menu-section archive-menu-section-link','자료실');sec.type='button';sec.onclick=()=>{closeArchiveMenu();$('#search').value='';showArchive()};host.append(sec)}
 const recFill=box=>{const put=()=>{box.replaceChildren();for(const t of (wrData?.types||[]).filter(t=>t.id)){const n=(wrData.records||[]).filter(r=>r.type===t.id).length;if(!n)continue;const link=el('button','archive-menu-chapter',t.name);link.type='button';link.onclick=()=>{closeArchiveMenu();$('#search').value='';showRecords({cat:String(t.id)})};box.append(link)}};
  if(wrData)put();else loadRecords().then(put).catch(()=>{})};
 host.append(foldRow('시계 기록',()=>{closeArchiveMenu();$('#search').value='';showRecords({cat:'0'})},recFill,'archive-menu-top'));
 const tipLink=el('button','archive-menu-link archive-menu-home archive-menu-dolls','로딩 팁');tipLink.type='button';tipLink.onclick=()=>{closeArchiveMenu();$('#search').value='';showTips()};host.append(tipLink);
 const itemLink=el('button','archive-menu-link archive-menu-home archive-menu-dolls','아이템');itemLink.type='button';itemLink.onclick=()=>{closeArchiveMenu();$('#search').value='';showItems()};host.append(itemLink);
 const algoLink=el('button','archive-menu-link archive-menu-home archive-menu-dolls','알고리즘');algoLink.type='button';algoLink.onclick=()=>{closeArchiveMenu();$('#search').value='';showAlgos()};host.append(algoLink);
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
function showLore(id){let record=(data.worldRecords||{})[String(id)]||{};openLore(record.name||'세계기록 '+id,record.description,id)}
function openLore(name,desc,id,eyebrow,tone){const dl=$('#lore');dl.querySelector('.eyebrow').textContent=eyebrow||'WORLD RECORD';dl.dataset.tone=tone||'';$('#loreTitle').textContent=name;$('#loreText').textContent=cleanTags(desc)||'설명 정보가 없습니다.';
 const f=$('#lore form');f.querySelector('.lore-link')?.remove();
 if(id&&typeof id==='object'&&id.fx!=null){const b=el('button','lore-link lore-fx');b.type='button';b.append(document.createTextNode('효과 사전에서 보기 '),ic('right'));b.onclick=e=>{e.preventDefault();dl.close();fxFocus=id.fx;fxQuery='';showEffects({cat:'all'})};f.append(b)}
 else if(id!=null){const b=linkBtn('#record/'+id,name);b.classList.add('lore-link');f.append(b)}
 $('#lore').showModal()}
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
window.addEventListener('popstate',e=>{if(!index)return;const st=e.state;restoreRoute().then(()=>{if(parseRoute().type!=='episode')restoreScroll(st)})});
window.addEventListener('hashchange',()=>{if(index)restoreRoute()});
$('#homeBtn').onclick=goHome;$('#back').onclick=()=>{const n=episodeNeighbors(current);if(n.groupId||n.dorm)backToChapter(n);else goHome()};$('#resumeBtn').onclick=resume;$('#shareBtn').onclick=()=>{const r=parseRoute();const t=r.type==='episode'?$('#epTitle')?.textContent:r.type==='doll'?$('.doll-name')?.textContent:'';shareNow(t||'')};$('#userBtn').onclick=openUser;$('#userClose').onclick=()=>$('#userDialog').close();$('#userBack').onclick=()=>selectUserPage('root');document.querySelectorAll('[data-user-page]').forEach(b=>b.onclick=()=>selectUserPage(b.dataset.userPage));$('#bmToggle').onclick=()=>{if(current)toggleBookmark(current)};
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
window.siteReady=fetchJSON(dataPath('site_info.json')).then(info=>{siteInfo=info;fillHeroTags();renderSettingsFeedback();maybeWelcome();maybePopup();initBgm();if(Array.isArray(info.languages)&&info.languages.length)readyLangs=info.languages;renderFooter(info);if(index&&category==null&&!openFolderId&&!$('#search').value.trim()&&!$('#library').classList.contains('hidden'))drawLibrary()}).catch(()=>{});

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
// v1.7.3 별 · 화살표 · 폴더는 이모지 · 기호 글자 대신 그림 아이콘 (기기마다 같게)
const starEl=(n,cls)=>{const w=el('span',cls||'doll-stars');w.setAttribute('aria-label','★'.repeat(Math.max(0,+n||0)));for(let i=0;i<Math.max(0,+n||0);i++)w.append(ic('star'));return w};
const icBtn=(name,cls)=>{const b=el('button',cls);b.type='button';b.append(ic(name));return b};
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
let dollArma=get('dollArma','off');
async function showDolls({push=true}={}){
 const tok=++routeToken;showOnly('dollView');bgmLeave();voiceStop();closeArchiveMenu();$('#crumb').textContent='인형 기록';
 if(push)saveRoute({type:'dolls'});
 const host=$('#dollView');host.replaceChildren(el('p','loading-note','인형 기록을 불러오는 중…'));window.scrollTo(0,0);
 try{await Promise.all([loadDollIndex(),loadArma().catch(()=>null)])}catch(e){if(tok===routeToken)host.replaceChildren(error('인형 기록을 불러오지 못했어요. ('+e.message+')'));return}
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
  const hasArma=d=>!!armaData?.heroes?.[String(d.heroId)];
  const list=sortDolls(all.filter(d=>dollMatches(d,q)&&(dollArma!=='on'||hasArma(d))));
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
 // v1.7.1 필터: 무장각인이 있는 인형만
 if(armaData?.heroes){const fw=el('div','doll-ctl');fw.append(el('span','doll-ctl-label','필터'));
  const tg=el('button','skill-arma-toggle doll-arma-filter');tg.type='button';
  const paint=()=>{const on=dollArma==='on';tg.classList.toggle('on',on);tg.setAttribute('aria-pressed',String(on));tg.replaceChildren(el('span','skill-arma-dot'),el('span','','무장각인'),el('span','skill-arma-state',on?'ON':'OFF'))};
  tg.onclick=()=>{dollArma=dollArma==='on'?'off':'on';set('dollArma',dollArma);paint();drawGrid()};paint();fw.append(tg);left.append(fw)}
 const sw=el('label','doll-ctl doll-search-wrap');sw.append(el('span','doll-ctl-label','인형 찾기'));
 const sbox=el('span','doll-search');const si=el('input');si.type='search';si.placeholder='이름 · 별명';si.value=dollQuery;si.setAttribute('aria-label','인형 이름으로 찾기');si.autocomplete='off';
 si.oninput=()=>{dollQuery=si.value;drawGrid()};sbox.append(el('span','doll-search-prompt','//:_'),si);sw.append(sbox);
 bar.append(left,sw);host.append(bar,grid);drawGrid();
}
// v1.5.10 직군(career 1 수위 · 2 사수 · 3 전사 · 4 해결사 · 5 치료사) · 분류(tag) 아이콘 — 게임 그림 assets/img/class
const TAG_NAME={1:'공격',2:'암살',3:'치료',4:'제어',5:'방어',6:'보조'};
function classLine(d,small){if(!d?.career)return null;
 const w=el('span','doll-class'+(small?' sm':''));const cn=dollIndex?.careers?.[d.career]||'';
 const ci=el('span','dc-ic career');ci.style.setProperty('--ci','url(/assets/img/class/career_'+d.career+'.png)');const c=el('span','dc-career');c.append(ci);if(!small)c.append(el('span','dc-name',cn));c.title=cn;w.append(c);
 for(const t of d.tags||[]){if(!small)w.append(el('span','dc-sep','|'));const ti=el('span','dc-ic tag');ti.style.setProperty('--ci','url(/assets/img/class/tag_'+t+'.png)');const g=el('span','dc-tag');g.title=TAG_NAME[t]||'';g.append(ti);if(!small)g.append(el('span','dc-name',TAG_NAME[t]||''));w.append(g)}
 return w}
function dollCard(d){
 const b=el('button','doll-card');b.type='button';b.dataset.key=d.voiceKey;
 const face=el('div','doll-face');const url=dollFace(d);if(url){const im=el('img');im.src=url;im.alt='';im.loading='lazy';face.append(im)}else face.classList.add('unknown');
 const info=el('div','doll-card-info');info.append(el('strong','',d.name));
 info.append(el('span','doll-card-meta',[d.company,d.role].filter(Boolean).join(' · ')));
 const foot=el('span','doll-card-foot');foot.append(starEl(d.stars));info.append(foot);
 b.append(face,info);b.onclick=()=>showDoll(d.voiceKey);return b;
}
// 게임 글의 <color=#..>…</color> 를 색 글자로 (나머지 꼬리표는 지움, innerHTML 쓰지 않음)
function richText(parent,text){
 const src=String(text||'').replace(/<cmdr>/gi,()=>nick());
 const re=/<color=(#[0-9a-fA-F]{6,8})>([\s\S]*?)<\/color>/gi;let last=0,m;
 const plain=t=>t.replace(/<\/?(?:color|i|b|size)(?:=[^>]*)?>/gi,'');
 while((m=re.exec(src))){if(m.index>last)parent.append(document.createTextNode(plain(src.slice(last,m.index))));const sp=el('span','wr-hl',plain(m[2]));sp.style.setProperty('--hl',m[1].slice(0,7));parent.append(sp);last=re.lastIndex}
 if(last<src.length)parent.append(document.createTextNode(plain(src.slice(last))));
}
// ----- v0.12.22 시계 기록 목록 (#records) -----
let wrData=null,wrCat=get('wrCat',0),wrQuery='';
const loadRecords=()=>wrData?Promise.resolve(wrData):fetchJSON(dataPath('world_records.json')).then(d=>wrData=d);
async function showRecords({push=true,cat=null}={}){
 const tok=++routeToken;showOnly('dollView');bgmLeave();voiceStop();closeArchiveMenu();$('#crumb').textContent='시계 기록';
 if(cat!=null&&/^\d+$/.test(cat))wrCat=+cat;
 if(push)saveRoute({type:'records',cat:wrCat?String(wrCat):null});
 const host=$('#dollView');host.replaceChildren(el('p','loading-note','시계 기록을 불러오는 중…'));window.scrollTo(0,0);
 try{await loadRecords()}catch(e){if(tok===routeToken)host.replaceChildren(error('시계 기록을 불러오지 못했어요. ('+e.message+')'));return}
 if(tok===routeToken)renderRecords();
}
function renderRecords(){
 const host=$('#dollView');host.replaceChildren();
 const all=wrData.records||[],types=wrData.types||[],tname=new Map(types.map(t=>[t.id,t.name]));
 if(!types.some(t=>t.id===wrCat&&(t.id===0||all.some(r=>r.type===t.id))))wrCat=0;
 const head=el('div','doll-list-head');const t=el('div');t.append(el('div','eyebrow','DATABASE / PERCEPTION RECORDS'),el('h2','','시계 기록'));head.append(t);
 const count=el('span','section-sub');head.append(count);host.append(head);
 const bar=el('div','doll-controls wr-controls');const tabs=el('div','wr-tabs');tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label','시계 기록 분류');
 const tabBtns=[];
 for(const ty of types){
  const n=ty.id===0?all.length:all.filter(r=>r.type===ty.id).length;if(!n)continue;
  const b=el('button','cat-tab wr-tab');b.type='button';b.setAttribute('role','tab');b.append(el('span','wr-tab-name',ty.name),el('span','wr-tab-n',String(n)));
  b.onclick=()=>{wrCat=ty.id;set('wrCat',wrCat);history.replaceState(history.state,'',location.pathname+location.search+routeHash({type:'records',cat:wrCat?String(wrCat):null}));sync();draw()};
  tabBtns.push([ty.id,b]);tabs.append(b);
 }
 const sync=()=>tabBtns.forEach(([id,b])=>{b.classList.toggle('selected',id===wrCat);b.setAttribute('aria-selected',String(id===wrCat))});
 const sw=el('label','doll-ctl doll-search-wrap');sw.append(el('span','doll-ctl-label','기록 찾기'));
 const sbox=el('span','doll-search');const si=el('input');si.type='search';si.placeholder='이름 · 내용';si.value=wrQuery;si.setAttribute('aria-label','시계 기록 찾기');si.autocomplete='off';
 si.oninput=()=>{wrQuery=si.value;draw()};sbox.append(el('span','doll-search-prompt','//:_'),si);sw.append(sbox);
 bar.append(tabs,sw);
 const list=el('div','wr-records');host.append(bar,list);
 // 《》 긴 글(분류 7 시계기록)은 카드와 나눠서, 하나씩 펼쳐 보는 줄로
 const LONG=7,opened=new Set();
 const draw=()=>{
  const q=dnorm(wrQuery);
  const rows=all.filter(r=>(wrCat===0||r.type===wrCat)&&(!q||dnorm(r.name).includes(q)||dnorm(r.description).includes(q)));
  count.textContent=rows.length+'개';list.replaceChildren();
  if(!rows.length){list.append(el('p','loading-note',q?'「'+wrQuery.trim()+'」에 맞는 기록이 없어요.':'기록이 없어요.'));return}
  const short=rows.filter(r=>r.type!==LONG),long=rows.filter(r=>r.type===LONG);
  if(short.length){const grid=el('div','wr-list');list.append(grid);
   for(const r of short){
    const b=el('button','wr-card');b.type='button';
    const top=el('div','wr-card-top');top.append(el('span','wr-no',String(r.id).padStart(2,'0')));
    if(wrCat===0&&tname.has(r.type))top.append(el('span','wr-type',tname.get(r.type)));
    if(r.src==='ko'&&dataLang()!=='ko')top.append(el('span','wr-src','한국어 원문'));
    const body=el('div','wr-body');body.append(el('strong','wr-name',r.name),el('small','wr-desc',cleanTags(r.description).replace(/\s+/g,' ')));
    b.append(top,body);b.onclick=()=>openLore(r.name,r.description,r.id);grid.append(b);
   }}
  if(long.length){
   if(short.length){const gh=el('div','doll-group-head wr-long-head');gh.append(el('h3','wr-body',tname.get(LONG)||''),el('span','doll-group-count',long.length+'개'));list.append(gh)}
   const box=el('div','wr-long');list.append(box);
   for(const r of long){
    const row=el('button','wr-long-item wr-long-row');row.type='button';
    const nm=el('span','wr-body wr-long-title');nm.append(el('span','wr-no',String(r.id).padStart(2,'0')),el('strong','',r.name));
    row.append(nm,el('span','wr-long-len',r.description.length.toLocaleString(window.UI_LOCALE||'ko-KR')+'자'),ic('right','tri'));
    row.onclick=()=>showRecord(r.id);box.append(row);
   }
  }
 };
 sync();draw();
}
// v1.2 시계 기록 한 항목 (#record/<id>): 긴 글(분류 7)은 읽기 화면, 짧은 글은 목록 + 설명 창
async function showRecord(id,{push=true}={}){
 const tok=++routeToken;
 try{await loadRecords()}catch(e){if(tok===routeToken){showOnly('dollView');$('#dollView').replaceChildren(error('시계 기록을 불러오지 못했어요. ('+e.message+')'))}return}
 if(tok!==routeToken)return;
 const r=(wrData.records||[]).find(x=>String(x.id)===String(id));
 if(!r){await showRecords({push});return}
 if(r.type!==7){
  wrCat=r.type;await showRecords({push:false,cat:String(r.type)});
  if(push)saveRoute({type:'record',id:r.id});
  openLore(r.name,r.description,r.id);
  $('#lore').addEventListener('close',()=>{if(parseRoute().type==='record')history.replaceState(history.state,'',location.pathname+location.search+routeHash({type:'records',cat:String(r.type)}))},{once:true});
  return;
 }
 showOnly('dollView');bgmLeave();voiceStop();closeArchiveMenu();
 if(push)saveRoute({type:'record',id:r.id});
 const tname=new Map((wrData.types||[]).map(t=>[t.id,t.name]));
 $('#crumb').textContent='시계 기록 · '+r.name;
 const host=$('#dollView');host.replaceChildren();window.scrollTo(0,0);
 const back=el('button','folder-back');back.type='button';back.append(ic('left'),document.createTextNode(' 시계 기록'));
 back.onclick=()=>{if(navCount>0)history.back();else showRecords({cat:'7'})};
 const head=el('div','record-head');const t=el('div');t.append(el('div','eyebrow','PERCEPTION RECORDS / '+String(r.id).padStart(2,'0')),el('h2','',r.name));
 const meta=el('span','section-sub');meta.append(document.createTextNode((tname.get(7)||'')+' · '+r.description.length.toLocaleString(window.UI_LOCALE||'ko-KR')+'자'));
 head.append(t,linkBtn('#record/'+r.id,r.name));
 const txt=el('div','wr-body wr-long-text record-text');richText(txt,r.description);
 const foot=el('div','record-foot');const back2=back.cloneNode(true);back2.onclick=back.onclick;foot.append(back2);
 host.append(back,head,meta,txt,foot);
}
// ----- v0.12.22 로딩 팁 (#tips) — 글만 (배경 그림 없음) -----
const TIP_GROUPS=[['all','전체'],['wiki','마그라세아 백과사전'],['sector','섹터'],['etc','그 외']];
const TIP_SUBS=[['corp','기업'],['faction','세력'],['etc','그 외']]; // 「그 외」 안 세부 분류
let tipData=null,tipCat=get('tipCat','all'),tipQuery='';if(!['all','wiki','sector','etc'].includes(tipCat))tipCat='all';
// v1.5 자료실: 메뉴 「자료실」 항목을 한 화면에 카드로 (누르면 바로 그 화면)
async function showArchive({push=true}={}){
 const tok=++routeToken;showOnly('dollView');bgmLeave();voiceStop();closeArchiveMenu();$('#crumb').textContent='자료실';
 if(push)saveRoute({type:'archive'});
 const host=$('#dollView');host.replaceChildren();window.scrollTo(0,0);
 const head=el('div','doll-list-head');const t=el('div');t.append(el('div','eyebrow','DATABASE / ARCHIVE'),el('h2','','자료실'));head.append(t);host.append(head);
 const grid=el('div','arc-grid');host.append(grid);
 const card=(eyebrow,name,desc,go)=>{const c=el('section','arc-card');const b=el('button','arc-main');b.type='button';b.onclick=go;
  const tx=el('span','arc-text');tx.append(el('span','eyebrow',eyebrow),el('strong','arc-name',name),el('span','arc-desc',desc));
  const n=el('span','arc-n');b.append(tx,n,ic('right','tri'));c.append(b);grid.append(c);return {c,n}};
 const rec=card('WORLD RECORDS','시계 기록','게임 속 세계 기록 · 장문 기록',()=>showRecords({cat:'0'}));
 const tip=card('LOADING TIPS','로딩 팁','로딩 화면에 나오는 백과사전 · 섹터 팁',()=>showTips());
 const itm=card('ITEMS','아이템','창고 · 숙소 가구 · 이벤트 보상',()=>showItems());
 const alg=card('ALGORITHMS','알고리즘','세트 효과 · 구역 · 기본 능력치',()=>showAlgos());
 const fnc=card('FUNCTIONS','함수','대상별 · 세트별 함수 도감',()=>showFunctions());
 loadFunctions().then(d=>{if(tok!==routeToken)return;cnt(fnc,(d.functions||[]).length);chipRow(fnc,[['대상별',()=>showFunctions({cat:'mark'})],['세트별',()=>showFunctions({cat:'tag'})]])}).catch(()=>{});
 const fry=card('SPRITES','성령','성령 정보 · 강화 시뮬레이터',()=>showFairy());
 loadFairy().then(d=>{if(tok!==routeToken)return;cnt(fry,(d.sprites||[]).length);chipRow(fry,[['성령 정보',()=>showFairy({cat:'info'})],['강화 시뮬레이터',()=>showFairy({cat:'sim'})]])}).catch(()=>{});
 const cmd=card('COMMANDER SKILLS','지휘 스킬','교수의 지휘 스킬 · 변형 · 성령 변형',()=>showCommander());
 loadCommander().then(d=>{if(tok!==routeToken)return;cnt(cmd,(d.families||[]).reduce((a,f)=>a+f.skills.length,0))}).catch(()=>{});
 const efx=card('EFFECTS','효과 사전','초록 · 빨간 · 주황 · 인형 고유 · 필드 효과',()=>showEffects());
 loadEffects().then(d=>{if(tok!==routeToken)return;cnt(efx,(d.effects||[]).length);chipRow(efx,(d.cats||[]).map(([k,n])=>[n,()=>showEffects({cat:k})]))}).catch(()=>{});
 const cnt=(o,n)=>{if(tok===routeToken&&n)o.n.textContent=n.toLocaleString(window.UI_LOCALE||'ko-KR')+'개'};
 loadRecords().then(()=>{if(tok!==routeToken)return;cnt(rec,(wrData.records||[]).length);
  const sub=el('div','arc-sub');for(const ty of (wrData.types||[]).filter(x=>x.id)){const k=(wrData.records||[]).filter(r=>r.type===ty.id).length;if(!k)continue;const b=el('button','arc-chip rec',ty.name);b.type='button';b.onclick=()=>showRecords({cat:String(ty.id)});sub.append(b)}
  if(sub.childNodes.length)rec.c.append(sub)}).catch(()=>{});
  const chipRow=(o,list)=>{const sub=el('div','arc-sub');for(const [name,go] of list){const b=el('button','arc-chip',name);b.type='button';b.onclick=go;sub.append(b)}if(sub.childNodes.length)o.c.append(sub)};
 (tipData?Promise.resolve(tipData):fetchJSON(dataPath('loading_tips.json')).then(d=>tipData=d)).then(d=>{if(tok!==routeToken)return;cnt(tip,(d.tips||[]).length);
  chipRow(tip,TIP_GROUPS.filter(([g])=>g!=='all'&&(d.tips||[]).some(x=>x.group===g)).map(([g,n])=>[n,()=>showTips({cat:g})]))}).catch(()=>{});
 loadAlgos().then(d=>{if(tok!==routeToken)return;cnt(alg,(d.sets||[]).filter(x=>x.two||x.three).length);chipRow(alg,Object.entries(d.areas||{}).filter(([k])=>(d.sets||[]).some(x=>String(x.area)===k)).map(([k,a])=>[a.name,()=>showAlgos({cat:k})]))}).catch(()=>{});
 loadItems().then(d=>{if(tok!==routeToken)return;cnt(itm,(d.items||[]).filter(o=>!String(o.grp||'').startsWith('widget:')).length);
  chipRow(itm,ITEM_PAGES.filter(([pg])=>pg).map(([pg,n])=>[n,()=>showItems({cat:String(pg)})]))}).catch(()=>{});
}
// v1.6.6 능력치 아이콘 (게임 attri_*, assets/img/attri)
const attrIc=name=>{const i=el('span','attr-ic');if(name)i.style.setProperty('--ai','url(/assets/img/attri/'+name+'.webp)');else i.classList.add('none');return i};
const attrLbl=(name,text)=>{const w=el('span','attr-lbl');w.append(attrIc(name),document.createTextNode(text));return w};
// ----- v1.6 알고리즘 도감 (#algorithms, data/<언어>/algorithms.json) -----
let algoData=null,algoCat=get('algoCat','all'),algoQuery='';
const loadAlgos=()=>algoData?Promise.resolve(algoData):fetchJSON(dataPath('algorithms.json')).then(d=>algoData=d);
async function showAlgos({push=true,cat=null}={}){
 const tok=++routeToken;showOnly('dollView');bgmLeave();voiceStop();closeArchiveMenu();$('#crumb').textContent='알고리즘';
 if(cat)algoCat=cat;
 if(push)saveRoute({type:'algos',cat:algoCat==='all'?null:algoCat});
 const host=$('#dollView');host.replaceChildren(el('p','loading-note','알고리즘을 불러오는 중…'));window.scrollTo(0,0);
 try{await Promise.all([loadAlgos(),window.siteReady?.catch(()=>{})])}catch(e){if(tok===routeToken)host.replaceChildren(error('알고리즘을 불러오지 못했어요. ('+e.message+')'));return}
 if(tok!==routeToken)return;
 const d=algoData,areas=d.areas||{},all=(d.sets||[]).filter(x=>x.two||x.three);
 if(algoCat!=='all'&&!areas[algoCat])algoCat='all';
 host.replaceChildren();
 const head=el('div','doll-list-head');const t=el('div');t.append(el('div','eyebrow','DATABASE / ALGORITHMS'),el('h2','','알고리즘'));head.append(t);
 const count=el('span','section-sub');head.append(count);host.append(head);
 const bar=el('div','doll-controls wr-controls');const tabs=el('div','wr-tabs');tabs.setAttribute('role','tablist');
 const btns=[];
 for(const [g,name] of [['all','전체'],...Object.entries(areas).map(([k,a])=>[k,a.name])]){
  const n=g==='all'?all.length:all.filter(x=>String(x.area)===g).length;if(!n)continue;
  const b=el('button','cat-tab wr-tab');b.type='button';b.setAttribute('role','tab');b.append(el('span',g==='all'?'':'algo-area-name',name),el('span','wr-tab-n',String(n)));
  b.onclick=()=>{algoCat=g;set('algoCat',g);history.replaceState(history.state,'',location.pathname+location.search+routeHash({type:'algos',cat:g==='all'?null:g}));sync();draw()};
  btns.push([g,b]);tabs.append(b)}
 const sync=()=>btns.forEach(([g,b])=>{b.classList.toggle('selected',g===algoCat);b.setAttribute('aria-selected',String(g===algoCat))});
 const sw=el('label','doll-ctl doll-search-wrap');sw.append(el('span','doll-ctl-label','기록 찾기'));
 const sbox=el('span','doll-search');const si=el('input');si.type='search';si.placeholder='이름 · 효과';si.value=algoQuery;si.autocomplete='off';si.setAttribute('aria-label','알고리즘 찾기');
 si.oninput=()=>{algoQuery=si.value;draw()};sbox.append(el('span','doll-search-prompt','//:_'),si);sw.append(sbox);
 // 알고리즘 설명 (접기 · 펼치기, 상태 기억)
 if(d.intro?.length){const box=el('section','algo-intro'+(get('algoIntro','open')==='open'?' open':''));const hb=el('button','algo-intro-head');hb.type='button';
  hb.append(el('span','eyebrow','GUIDE'),el('strong','','알고리즘이란?'),ic('right','tri'));hb.onclick=()=>{const on=box.classList.toggle('open');set('algoIntro',on?'open':'closed')};
  const bd=el('div','algo-intro-body');for(const [h,tx] of d.intro){const r=el('p','algo-intro-row');r.append(el('strong','algo-intro-h',h),el('span','algo-intro-t',tx));bd.append(r)}
  box.append(hb,bd);host.append(box)}
 bar.append(tabs,sw);const list=el('div','wr-list algo-list');const basic=el('section','algo-basic');host.append(bar,list,basic);
 const draw=()=>{
  const q=dnorm(algoQuery);
  const rows=all.filter(x=>(algoCat==='all'||String(x.area)===algoCat)&&(!q||[x.name,x.two,x.three].some(v=>dnorm(v||'').includes(q)))).sort((a,b)=>(a.area||9)-(b.area||9)||(a.three?1:0)-(b.three?1:0)||a.id-b.id);
  count.textContent=rows.length+'개';list.replaceChildren();
  if(!rows.length)list.append(el('p','loading-note','「'+algoQuery.trim()+'」에 맞는 알고리즘이 없어요.'));
  for(const x of rows){
   const c=el('div','wr-card algo-card');const top=el('div','algo-top');
   // 게임 세트 기호(assets/img/algo/suit_NN, 흰 그림 → 구역 색 바탕) + 아이템 그림 작게
   const em=el('span','algo-emblem a'+x.area);const nn=String(x.id).padStart(2,'0');em.style.setProperty('--em','url(/assets/img/algo/suit_'+nn+'.webp)');
   const probe=new Image();probe.onerror=()=>em.classList.add('none');probe.src='/assets/img/algo/suit_'+nn+'.webp';
   top.append(em);const ii=el('span','item-ic algo-item');const im=el('img');im.alt='';im.decoding='async';im.src='/assets/img/algo/item_'+nn+'.webp';im.onerror=()=>ii.remove();ii.append(im);top.append(ii);
   const tt=el('div','algo-head');tt.append(el('strong','algo-name',x.name),el('span','algo-area a'+x.area,areas[x.area]?.name||''));top.append(tt);c.append(top);
   const ef=el('div','algo-effects');
   if(x.two){const r=el('p','algo-eff');r.append(el('span','algo-n','2세트'),el('span','algo-text',x.two));ef.append(r)}
   if(x.three){const r=el('p','algo-eff');r.append(el('span','algo-n','3세트'),el('span','algo-text',x.three));ef.append(r)}
   c.append(ef);list.append(c)}
  // 능력치 표: 주요 수치(등급 · 칸 수별) · 부가 수치(품질별) — 고른 구역만
  basic.replaceChildren();if(q)return;
  const ak=Object.keys(areas).filter(k=>(d.main?.[k]||d.sub?.[k])&&(algoCat==='all'||k===algoCat));
  const table=(heads,rows)=>{const tb=el('table','algo-table');const th=el('tr');heads.forEach((h,i)=>th.append(el('th',i?'':'algo-th-stat',h)));tb.append(th);
   for(const r of rows){const tr=el('tr');r.forEach((c,i)=>{const td=el('td',i?'':'algo-td-stat');if(c instanceof Node)td.append(c);else td.textContent=c;tr.append(td)});tb.append(tr)}const w=el('div','algo-table-wrap');w.append(tb);return w};
  const pctIn=list=>{const c={};list.forEach(x=>c[x.stat]=(c[x.stat]||0)+1);return x=>x.stat+(x.pct&&c[x.stat]>1?' %':'')};
  // 접기 · 펼치기 (처음엔 접힘, 상태 기억)
  const fold=(key,title,note,fill)=>{const sec=el('section','algo-fold'+(get(key,'closed')==='open'?' open':''));const hb=el('button','algo-fold-head');hb.type='button';
   hb.append(el('strong','',title),el('span','algo-fold-note',note),ic('right','tri'));hb.onclick=()=>{const on=sec.classList.toggle('open');set(key,on?'open':'closed')};
   const bd=el('div','algo-fold-body');fill(bd);sec.append(hb,bd);basic.append(sec)};
  if(ak.length){
   fold('algoMain','주요 수치','등급 · 칸 수별 기본값이에요. 알고리즘 효율에 따라 더 올라가요.',bd=>{for(const k of ak){if(!d.main?.[k])continue;const box=el('div','algo-tbox');box.append(el('strong','algo-area a'+k,areas[k].name));
    box.append(table(['','파랑 1칸','파랑 2칸','보라 1칸','보라 2칸','주황 1칸','주황 2칸'],d.main[k].map(x=>[attrLbl(x.icon,pctIn(d.main[k])(x)),...['b1','b2','p1','p2','o1','o2'].map(c=>x[c]||'-')])));bd.append(box)}});
   fold('algoSub','부가 수치','품질별 값이에요. 알고리즘 효율의 영향을 받지 않아요.',bd=>{for(const k of ak){if(!d.sub?.[k])continue;const box=el('div','algo-tbox');box.append(el('strong','algo-area a'+k,areas[k].name));
    box.append(table(['','회색','파랑','보라','주황'],d.sub[k].map(x=>[attrLbl(x.icon,pctIn(d.sub[k])(x)),...x.v])));bd.append(box)}})}
 };
 sync();draw();
}
// ---------- v1.7.7 효과 사전 (data/<언어>/effects.json ← tools/client_extract/effects.py) ----------
// 분류: 게임 색(초록 · 빨강 · 주황) + 인형 고유 효과 (인형 1명 글에만 「이름」으로 나옴), 점 색은 게임 색
let fxData=null,fxCat=get('fxCat','all'),fxQuery='',fxFocus=null;
const loadEffects=()=>fxData?Promise.resolve(fxData):fetchJSON(dataPath('effects.json')).then(d=>fxData=d);
// v1.7.10 모드 효과 (탐색 · 던전 · 워체스)는 따로 — 그 탭을 열 때만 불러옴
let fxModes=null,fxSide=get('fxSide','all');const FX_MODES=new Set(['protocol','explore','dungeon','warchess']);
const loadFxModes=()=>fxModes?Promise.resolve(fxModes):fetchJSON(dataPath('effect_modes.json')).then(d=>fxModes=d);
const FX_COLOR={1:'초록',2:'빨강',3:'주황',0:'색 없음'};
async function showEffects({push=true,cat=null}={}){
 const tok=++routeToken;showOnly('dollView');bgmLeave();voiceStop();closeArchiveMenu();$('#crumb').textContent='효과 사전';
 if(cat)fxCat=cat;
 if(push)saveRoute({type:'effects',cat:fxCat==='all'?null:fxCat});
 const host=$('#dollView');host.replaceChildren(el('p','loading-note','효과 사전을 불러오는 중…'));window.scrollTo(0,0);
 try{await Promise.all([loadEffects(),loadDollIndex().catch(()=>null)])}catch(e){if(tok===routeToken)host.replaceChildren(error('효과 사전을 불러오지 못했어요. ('+e.message+')'));return}
 if(tok===routeToken)renderEffects();
}
function renderEffects(){
 const host=$('#dollView');host.replaceChildren();
 const all=fxData.effects||[],cats=[['all','전체'],...(fxData.cats||[])];
 if(!cats.some(([k])=>k===fxCat))fxCat='all';
 const head=el('div','doll-list-head');const t=el('div');t.append(el('div','eyebrow','DATABASE / EFFECTS'),el('h2','','효과 사전'));head.append(t);
 const count=el('span','section-sub');head.append(count);host.append(head);
 const bar=el('div','doll-controls wr-controls');const tabs=el('div','wr-tabs');tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label','효과 분류');
 const btns=[];
 for(const [g,name] of cats){
  const n=g==='all'?all.length:FX_MODES.has(g)?(fxData.modeCounts?.[g]||0):all.filter(x=>(x.cats||[x.cat]).includes(g)).length;if(!n)continue;
  const b=el('button','cat-tab wr-tab'+(FX_MODES.has(g)?' fx-mode-tab':''));b.type='button';b.setAttribute('role','tab');b.append(el('span','',name),el('span','wr-tab-n',String(n)));
  b.onclick=()=>{fxCat=g;set('fxCat',g);history.replaceState(history.state,'',location.pathname+location.search+routeHash({type:'effects',cat:g==='all'?null:g}));sync();draw()};
  btns.push([g,b]);tabs.append(b)}
 const sync=()=>btns.forEach(([g,b])=>{b.classList.toggle('selected',g===fxCat);b.setAttribute('aria-selected',String(g===fxCat))});
 const sw=el('label','doll-ctl doll-search-wrap');sw.append(el('span','doll-ctl-label','기록 찾기'));
 const sbox=el('span','doll-search');const si=el('input');si.type='search';si.placeholder='이름 · 내용 · 인형';si.value=fxQuery;si.setAttribute('aria-label','효과 찾기');si.autocomplete='off';
 si.oninput=()=>{fxQuery=si.value;draw()};sbox.append(el('span','doll-search-prompt','//:_'),si);sw.append(sbox);
 bar.append(tabs,sw);
 const legend=el('div','fx-legend');for(const c of [1,2,3]){const s=el('span','fx-leg');s.append(el('span','fx-dot c'+c),document.createTextNode(FX_COLOR[c]));legend.append(s)}
 const note=el('p','load-note','게임 속 스킬 설명에서 효과 이름을 누르면 나오는 설명이에요. 게임 안 색 그대로 나눴고, 「인형 고유 효과」는 인형 스킬 · 무장각인에 나오는 고유명사 효과예요. 고유 효과 · 필드 효과는 색 탭에도 같이 있어요. 「필드 · 발판 효과」에는 전투 맵 발판의 지형 함수도 모았어요.');
 const sideBar=el('div','fn-subs fx-sides');sideBar.hidden=true;
 const list=el('div','wr-list fx-list');host.append(note,legend,bar,sideBar,list);
 const byHero=new Map((dollIndex?.dolls||[]).map(d=>[+d.heroId,d]));
 const draw=()=>{
  const q=dnorm(fxQuery);
  if(FX_MODES.has(fxCat)&&!fxModes){list.replaceChildren(el('p','loading-note','효과 사전을 불러오는 중…'));sync();loadFxModes().then(()=>draw()).catch(e=>list.replaceChildren(error(e.message)));return}
  const src=FX_MODES.has(fxCat)?(fxModes.effects||[]):all;
  // v1.8.1 프로토콜: 유리 · 중립 · 불리 단추 + 묶음(기본 · 100번 단위) 제목
  sideBar.replaceChildren();sideBar.hidden=fxCat!=='protocol';
  if(fxCat==='protocol'){for(const [k,n] of [['all','전체'],['good','유리'],['neutral','중립'],['bad','불리']]){const b=el('button','fn-sub fx-side '+k+(k===fxSide?' on':''),n);b.type='button';b.onclick=()=>{fxSide=k;set('fxSide',k);draw()};sideBar.append(b)}}
  const rows=src.filter(x=>(fxCat!=='protocol'||fxSide==='all'||x.side===fxSide)&&(fxCat==='all'||(x.cats||[x.cat]).includes(fxCat))&&(!q||dnorm(x.name).includes(q)||dnorm(cleanTags(x.desc)).includes(q)||(x.dolls||[]).some(h=>dnorm(byHero.get(h)?.name||'').includes(q))));
  count.textContent=rows.length+'개';list.replaceChildren();sync();
  if(!rows.length){list.append(el('p','loading-note',q?'「'+fxQuery.trim()+'」에 맞는 효과가 없어요.':'효과가 없어요.'));return}
  let lastGrp=null;
  for(const x of rows.slice(0,400)){
   if(fxCat==='protocol'&&x.grp!==lastGrp){lastGrp=x.grp;list.append(el('h3','fx-grp',x.grp==='main'?'기본 프로토콜':'프로토콜 묶음 '+x.grp+'번대'))}
   const c=el('div','wr-card fx-card');c.id='fx-'+x.id;
   const top=el('div','wr-card-top');top.append(el('span','fx-dot c'+x.color));if(x.icon){const ii=itemIcon(x.icon.includes('/')?x.icon:'buff/'+x.icon,'sm fx-ic c'+x.color+(x.grid?' grid':'')+(x.mode?' xy':''));top.append(ii)}if(x.grid)top.append(el('span','fx-src','지형 함수'))
   const body=el('div','wr-body');body.append(el('strong','wr-name',x.name),el('p','tip-text',cleanTags(x.desc)));
   if(x.dolls?.length||x.algo){const w=el('div','tip-dolls');
    for(const h of x.dolls||[]){const d=byHero.get(+h);if(!d)continue;const b=el('button','doll-chip link tip-doll');b.type='button';b.append(ic('user'),document.createTextNode(' '+d.name));b.onclick=()=>showDoll(d.voiceKey,{part:'skill'});w.append(b)}
    if(x.algo){const b=el('button','doll-chip link tip-doll','알고리즘');b.type='button';b.onclick=()=>showAlgos();w.append(b)}
    body.append(w)}
   c.append(top,body);list.append(c)}
  if(rows.length>400)list.append(el('p','load-note','처음 400개만 보여요. 기록 찾기로 좁혀 보세요.'));
  if(fxFocus!=null){const t=document.getElementById('fx-'+fxFocus);fxFocus=null;if(t){t.classList.add('fx-focus');requestAnimationFrame(()=>t.scrollIntoView({block:'center'}))}}
 };
 draw();
}
// ---------- v1.8.0 성령 (data/<언어>/fairy.json ← tools/client_extract/fairy.py): 성령 정보(스펙표) · 강화 시뮬레이터 ----------
let fairyData=null,fairyTab=get('fairyTab','info'),fairySel=+get('fairySel',1)||1,fairyRar=+get('fairyRar',4)||4;
const loadFairy=()=>fairyData?Promise.resolve(fairyData):fetchJSON(dataPath('fairy.json')).then(d=>fairyData=d);
const RAR=['C','B','A','S'],RAR_CLS=['c','b','a','s'];
let fsim=null; // 시뮬레이터 상태 (이 창에서만)
async function showFairy({push=true,cat=null}={}){
 const tok=++routeToken;showOnly('dollView');bgmLeave();voiceStop();closeArchiveMenu();$('#crumb').textContent='성령';
 if(cat==='info'||cat==='sim')fairyTab=cat;
 if(push)saveRoute({type:'fairy',cat:fairyTab});
 const host=$('#dollView');host.replaceChildren(el('p','loading-note','성령을 불러오는 중…'));window.scrollTo(0,0);
 try{await Promise.all([loadFairy(),loadEffects().catch(()=>null)])}catch(e){if(tok===routeToken)host.replaceChildren(error('성령을 불러오지 못했어요. ('+e.message+')'));return}
 if(tok===routeToken)renderFairy();
}
function renderFairy(){
 const D=fairyData,host=$('#dollView');host.replaceChildren();
 const head=el('div','doll-list-head');const t=el('div');t.append(el('div','eyebrow','DATABASE / SPRITES'),el('h2','','성령'));head.append(t);host.append(head);
 const bar=el('div','doll-controls wr-controls');const tabs=el('div','wr-tabs');
 for(const [k,n] of [['info','성령 정보'],['sim','강화 시뮬레이터']]){const b=el('button','cat-tab wr-tab'+(k===fairyTab?' selected':''),n);b.type='button';b.onclick=()=>{fairyTab=k;set('fairyTab',k);history.replaceState(history.state,'',location.pathname+location.search+routeHash({type:'fairy',cat:k}));renderFairy()};tabs.append(b)}
 bar.append(tabs);host.append(bar);
 const itemName=i=>D.items?.[i]?.[0]||i;
 const costChips=(obj,mult=1)=>{const w=el('span','fy-cost');for(const [i,n] of Object.entries(obj||{})){const c=el('span','item-chip');c.append(itemIcon(D.items?.[i]?.[1]||'','sm'),el('span','item-chip-name',itemName(i)),el('span','item-chip-n','×'+(n*mult).toLocaleString(window.UI_LOCALE||'ko-KR')));w.append(c)}return w};
 const attrVal=(a,v)=>{const m=D.attrs?.[a];return m&&m[1]===2?(v/10)+'%':String(v)};
 const attrIds=Object.keys(D.attrs||{});
 const sprite=()=>D.sprites.find(x=>x.id===fairySel)||D.sprites[0];
 const pick=el('div','fy-pick');
 for(const sp of D.sprites){const b=el('button','fy-sprite'+(sp.id===sprite().id?' on':''));b.type='button';b.append(itemIcon(sp.icon?'fairy/'+sp.icon:'','fy-ic'),el('strong','',sp.name),el('span','fy-suit',sp.suit));if(sp.locked)b.append(el('span','fy-lock','미공개'));b.onclick=()=>{fairySel=sp.id;set('fairySel',sp.id);fsim=null;renderFairy()};pick.append(b)}
 host.append(pick);
 const skillCard=(sk,lvl,extra)=>{const c=el('div','fy-skill'+(sk.special?' special':''));const top=el('div','fy-skill-top');top.append(el('strong','',sk.name));if(sk.special)top.append(el('span','cmd-badge','고유'));if(extra)top.append(extra);c.append(top);
  const det=el('p','skill-detail');skillText(det,skillDetail(sk,lvl));c.append(det);
  if(sk.to){const b=el('button','fy-link');b.type='button';b.append(document.createTextNode('지휘 스킬 변형 '),ic('right'));b.onclick=()=>showCommander();c.append(b)}
  return c};
 if(fairyTab==='info'){
  const sp=sprite();
  // 스킬 (등급 C · B · A · S 단추)
  const ss=el('section','fy-sec');const sh=el('div','fy-sec-head');sh.append(el('h3','',sp.name+' · 스킬 '+sp.skills.length));
  const rb=el('div','fy-rar');D.rarity.slice().sort((a,b)=>a.level-b.level).forEach(r=>{const b=el('button','fy-rar-b '+RAR_CLS[r.level-1]+(r.level===fairyRar?' on':''));b.type='button';b.append(el('b','',r.name),el('small','',r.rate+'%'));b.onclick=()=>{fairyRar=r.level;set('fairyRar',r.level);renderFairy()};rb.append(b)});
  sh.append(rb);ss.append(sh,el('p','load-note','스킬은 등급(C · B · A · S)에 따라 수치가 달라요. 단추 아래 숫자는 게임에 표시된 등급 확률이에요. 「고유」는 이 성령만의 스킬이에요.'));
  const g=el('div','fy-skills');sp.skills.filter(x=>x.special).concat(sp.skills.filter(x=>!x.special)).forEach(x=>g.append(skillCard(x,fairyRar)));ss.append(g);host.append(ss);
  // 랭크
  const rs=el('section','fy-sec');rs.append(el('h3','','랭크 (공통)'));const rt=el('table','algo-table fy-table');const rh=el('tr');['랭크','최대 레벨','스킬 칸','랭크업 재료','분해 시 얻는 것'].forEach(x=>rh.append(el('th','',x)));rt.append(rh);
  for(const r of D.ranks){const tr=el('tr');tr.append(el('td','',r.rank+'★'),el('td','','Lv.'+r.levelMax),el('td','',String(r.slots)));const c1=el('td','');c1.append(costChips(r.cost));const c2=el('td','');c2.append(costChips(r.recycle));tr.append(c1,c2);rt.append(tr)}
  const rw=el('div','algo-table-wrap');rw.append(rt);rs.append(rw,el('p','load-note','재료는 게임 데이터의 랭크별 값 그대로예요.'));host.append(rs);
  // 레벨
  const ls=el('section','fy-sec');ls.append(el('h3','','레벨별 능력치 (공통)'));const lt=el('table','algo-table fy-table');const lh=el('tr');['레벨','다음 레벨까지 경험치'].concat(attrIds.map(a=>D.attrs[a][0])).forEach(x=>lh.append(el('th','',x)));lt.append(lh);
  const caps=new Set(D.ranks.map(r=>r.levelMax));
  for(const l of D.levels){const tr=el('tr',caps.has(l.lv)?'fy-cap':'');tr.append(el('td','','Lv.'+l.lv),el('td','',l.exp?l.exp.toLocaleString(window.UI_LOCALE||'ko-KR'):'-'));attrIds.forEach(a=>tr.append(el('td','',attrVal(a,l.attrs[a]||0))));lt.append(tr)}
  const lw=el('div','algo-table-wrap');lw.append(lt);ls.append(lw,el('p','load-note','능력치는 그 레벨까지 쌓인 값이에요. 진한 줄은 랭크별 최대 레벨이에요. 경험치는 「'+itemName(D.expItem)+'」로 채워요.'));host.append(ls);
  return}
 // ----- 강화 시뮬레이터 -----
 const sp=sprite();
 if(!fsim||fsim.id!==sp.id)fsim={id:sp.id,rank:1,lv:1,slots:[],rerolls:0};
 const R=()=>D.ranks.find(r=>r.rank===fsim.rank);
 const box=el('section','fy-sec fy-sim');host.append(box);
 const draw=()=>{box.replaceChildren();const rk=R();if(fsim.lv>rk.levelMax)fsim.lv=rk.levelMax;
  while(fsim.slots.length<rk.slots)fsim.slots.push(null);fsim.slots.length=rk.slots;
  const ctl=el('div','fy-ctl');
  const rkb=el('div','fy-ranks');D.ranks.forEach(r=>{const b=el('button','cat-tab wr-tab'+(r.rank===fsim.rank?' selected':''),r.rank+'★');b.type='button';b.onclick=()=>{fsim.rank=r.rank;draw()};rkb.append(b)});
  const lvbar=el('div','arma-lvbar stats-fbar');const dn=icBtn('down','arma-step'),up=icBtn('up','arma-step');const range=el('input','arma-range');range.type='range';range.min=1;range.max=rk.levelMax;range.value=fsim.lv;
  const lvTxt=el('span','arma-lvtxt');lvTxt.append(el('b','',String(fsim.lv)),document.createTextNode(' / '+rk.levelMax));
  const setLv=v=>{fsim.lv=Math.min(Math.max(v,1),rk.levelMax);draw()};dn.onclick=()=>setLv(fsim.lv-1);up.onclick=()=>setLv(fsim.lv+1);range.oninput=()=>setLv(+range.value);
  lvbar.append(dn,range,up,lvTxt);ctl.append(el('div','fy-label','랭크'),rkb,el('div','fy-label','레벨'),lvbar);box.append(ctl);
  // 능력치
  const L=D.levels.find(l=>l.lv===fsim.lv)||D.levels[0];const st=el('div','fy-stats');attrIds.forEach(a=>{const c=el('div','fy-stat');c.append(el('span','',D.attrs[a][0]),el('b','',attrVal(a,L.attrs[a]||0)));st.append(c)});box.append(el('h3','',sp.name+' · '+fsim.rank+'★ Lv.'+fsim.lv),st);
  // 스킬 칸 · 재구성 (게임 등급 확률로 뽑기)
  const roll=()=>{let x=Math.random()*100,acc=0;const rs=D.rarity.slice().sort((a,b)=>b.level-a.level);let lvl=1;for(const r of rs){acc+=r.rate;if(x<acc){lvl=r.level;break}}const pool=sp.skills;return {sk:pool[Math.floor(Math.random()*pool.length)],lvl}};
  const sl=el('div','fy-slots');fsim.slots.forEach((cur,i)=>{const c=el('div','fy-slot');const hd=el('div','fy-slot-head');hd.append(el('span','fy-label','스킬 칸 '+(i+1)));
   const b=el('button','fy-roll');b.type='button';b.append(document.createTextNode(cur?'재구성':'스킬 뽑기'));b.onclick=()=>{fsim.slots[i]=roll();fsim.rerolls++;draw()};hd.append(b);c.append(hd);
   if(cur)c.append(skillCard(cur.sk,cur.lvl,el('span','fy-rar-tag '+RAR_CLS[cur.lvl-1],RAR[cur.lvl-1])));else c.append(el('p','load-note','아직 스킬이 없어요.'));sl.append(c)});
  box.append(el('h3','','스킬 칸 '+rk.slots),sl);
  // 비용 (1★ Lv.1 부터 지금까지)
  let exp=0;for(const l of D.levels)if(l.lv<fsim.lv)exp+=l.exp;
  const cost={};D.ranks.filter(r=>r.rank>1&&r.rank<=fsim.rank).forEach(r=>{for(const [k,n] of Object.entries(r.cost))cost[k]=(cost[k]||0)+n});
  const cs=el('div','fy-costs');
  const row=(label,node)=>{const r=el('div','fy-cost-row');r.append(el('span','fy-label',label),node);cs.append(r)};
  row('경험치',costChips({[D.expItem]:exp}));row('랭크업 ('+(fsim.rank>1?'2★~'+fsim.rank+'★':'없음')+')',Object.keys(cost).length?costChips(cost):el('span','load-note','-'));
  row('재구성 '+fsim.rerolls+'회',costChips({'1923':fsim.rerolls}));
  const reset=el('button','fy-roll');reset.type='button';reset.textContent='처음부터';reset.onclick=()=>{fsim=null;renderFairy()};
  box.append(el('h3','','들어간 재료 (1★ Lv.1 부터)'),cs,reset,el('p','load-note','경험치 1 = 「'+itemName(D.expItem)+'」 1개로 계산했어요. 랭크업 재료는 랭크 표의 2★부터 지금 랭크까지 더한 값이에요. 재구성은 1회에 「'+itemName('1923')+'」 1개로 계산했어요. 뽑기는 게임 등급 확률(S '+(D.rarity.find(r=>r.level===4)?.rate)+'% …)로 하는 흉내예요.'));
 };
 draw();
}
// ---------- v1.7.9 지휘 스킬 (data/<언어>/commander.json ← tools/client_extract/commander.py) ----------
let cmdData=null,cmdLv=get('cmdLv','max');
const loadCommander=()=>cmdData?Promise.resolve(cmdData):fetchJSON(dataPath('commander.json')).then(d=>cmdData=d);
async function showCommander({push=true}={}){
 const tok=++routeToken;showOnly('dollView');bgmLeave();voiceStop();closeArchiveMenu();$('#crumb').textContent='지휘 스킬';
 if(push)saveRoute({type:'commander'});
 const host=$('#dollView');host.replaceChildren(el('p','loading-note','지휘 스킬을 불러오는 중…'));window.scrollTo(0,0);
 try{await Promise.all([loadCommander(),loadEffects().catch(()=>null)])}catch(e){if(tok===routeToken)host.replaceChildren(error('지휘 스킬을 불러오지 못했어요. ('+e.message+')'));return}
 if(tok!==routeToken)return;
 host.replaceChildren();
 const head=el('div','doll-list-head');const t=el('div');t.append(el('div','eyebrow','DATABASE / COMMANDER SKILLS'),el('h2','','지휘 스킬'));head.append(t);host.append(head);
 host.append(el('p','load-note','교수가 전투 중 쓰는 지휘 스킬이에요. 계열마다 기본 스킬과 변형이 있고, 「성령」 표시는 성령으로 바뀌는 변형이에요.'));
 const bar=el('div','skill-arma-bar');const tabs=el('div','wr-tabs');
 const lvBtns=[['1','Lv.1'],['max','Lv.MAX']].map(([k,n])=>{const b=el('button','cat-tab wr-tab',n);b.type='button';b.onclick=()=>{cmdLv=k;set('cmdLv',k);draw()};tabs.append(b);return [k,b]});
 bar.append(tabs);host.append(bar);
 const list=el('div','cmd-list');host.append(list);
 const draw=()=>{lvBtns.forEach(([k,b])=>b.classList.toggle('selected',k===cmdLv));list.replaceChildren();
  for(const f of cmdData.families||[]){
   const sec=el('section','cmd-fam');const h=el('div','cmd-fam-head');h.append(itemIcon(f.skills[0].icon,'cmd-ic big'),el('h3','',f.name),el('span','wr-tab-n',String(f.skills.length)));sec.append(h);
   for(const sk of f.skills){const row=el('div','cmd-skill'+(sk.fairy?' fairy':''));row.append(itemIcon(sk.icon,'cmd-ic'));
    const body=el('div','cmd-body');const nm=el('div','cmd-name');nm.append(el('strong','',sk.name));if(sk.fairy)nm.append(el('span','cmd-badge','성령'));body.append(nm);
    const det=el('p','skill-detail');skillText(det,skillDetail(sk,cmdLv==='max'?sk.maxLv:1));body.append(det);row.append(body);sec.append(row)}
   list.append(sec)}};
 draw();
}
// ---------- v1.7.8 함수 도감 (data/<언어>/functions.json ← tools/client_extract/functions.py) ----------
// 탭: 대상별(세부 탭 = 카드 모서리 표시) · 세트별(세부 탭 = 세트). 카드 테두리 색 = 게임 카드 색(파랑 · 보라 · 주황)
// 수치만 다른 같은 함수는 설명 아래 색 단추로 단계 전환
let fnData=null,fnMode=get('fnMode','mark'),fnSub=get('fnSub','all'),fnQuery='';
const loadFunctions=()=>fnData?Promise.resolve(fnData):fetchJSON(dataPath('functions.json')).then(d=>fnData=d);
const fnStep=new Map();
async function showFunctions({push=true,cat=null}={}){
 const tok=++routeToken;showOnly('dollView');bgmLeave();voiceStop();closeArchiveMenu();$('#crumb').textContent='함수';
 if(cat){const [m,sub]=cat.split('/');if(m==='mark'||m==='tag'){fnMode=m;fnSub=sub||'all'}}
 if(push)saveRoute({type:'functions',cat:fnMode+(fnSub!=='all'?'/'+fnSub:'')});
 const host=$('#dollView');host.replaceChildren(el('p','loading-note','함수를 불러오는 중…'));window.scrollTo(0,0);
 try{await Promise.all([loadFunctions(),loadEffects().catch(()=>null)])}catch(e){if(tok===routeToken)host.replaceChildren(error('함수를 불러오지 못했어요. ('+e.message+')'));return}
 if(tok===routeToken)renderFunctions();
}
function renderFunctions(){
 const host=$('#dollView');host.replaceChildren();
 const all=fnData.functions||[],marks=fnData.marks||[];
 // 같은 이름 세트(모드 · 버전마다 번호만 다름)는 하나로: 처음 번호가 대표
 const canon=new Map(),tags=[];for(const t of fnData.tags||[]){const f=tags.find(x=>x[1]===t[1]);if(f)canon.set(t[0],f[0]);else{canon.set(t[0],t[0]);tags.push(t)}}
 const tagsOf=o=>[...new Set((o.tags||[]).map(t=>canon.get(t)??t))];
 const markOf=new Map(marks.map(m=>[m[0],m])),tagOf=new Map(tags.map(t=>[t[0],t]));
 const head=el('div','doll-list-head');const t=el('div');t.append(el('div','eyebrow','DATABASE / FUNCTIONS'),el('h2','','함수'));head.append(t);
 const count=el('span','section-sub');head.append(count);host.append(head);
 host.append(el('p','load-note','게임 속 함수 카드예요. 카드 테두리 색은 게임 카드 색(파랑 · 보라 · 주황)이고, 수치만 다른 같은 함수는 설명 아래 단추로 바꿔 볼 수 있어요.'));
 const bar=el('div','doll-controls wr-controls');const tabs=el('div','wr-tabs');tabs.setAttribute('role','tablist');
 const modeBtns=[];
 for(const [m,name] of [['mark','대상별'],['tag','세트별']]){const b=el('button','cat-tab wr-tab',name);b.type='button';b.onclick=()=>{fnMode=m;fnSub='all';set('fnMode',m);set('fnSub','all');go()};modeBtns.push([m,b]);tabs.append(b)}
 const sw=el('label','doll-ctl doll-search-wrap');sw.append(el('span','doll-ctl-label','기록 찾기'));
 const sbox=el('span','doll-search');const si=el('input');si.type='search';si.placeholder='이름 · 내용';si.value=fnQuery;si.setAttribute('aria-label','함수 찾기');si.autocomplete='off';
 si.oninput=()=>{fnQuery=si.value;draw()};sbox.append(el('span','doll-search-prompt','//:_'),si);sw.append(sbox);
 bar.append(tabs,sw);host.append(bar);
 const subs=el('div','fn-subs');host.append(subs);
 const list=el('div','fn-list');host.append(list);
 const go=()=>{history.replaceState(history.state,'',location.pathname+location.search+routeHash({type:'functions',cat:fnMode+(fnSub!=='all'?'/'+fnSub:'')}));draw()};
 const cornerIc=m=>{const s=el('span','fn-corner');if(m?.[2])s.style.setProperty('--ci','url('+itemIconBase().replace(/\/?$/,'/')+'fx/'+m[2]+'.webp)');return s};
 const tagIc=t=>{const s=el('span','fn-tagic');if(t?.[2])s.style.backgroundImage='url('+itemIconBase().replace(/\/?$/,'/')+'fx/'+t[2]+'.webp)';return s};
 const inSub=o=>fnSub==='all'?(fnMode==='tag'?tagsOf(o).length>0:true):(fnMode==='mark'?String(o.mark)===fnSub:tagsOf(o).map(String).includes(fnSub));
 const card=o=>{
  const c=el('div','fn-card q'+(o.q||3));
  const art=itemIcon(o.icon,'fn-art');c.append(art);
  const body=el('div','fn-body');
  const top=el('div','fn-top');const m=markOf.get(o.mark);if(m){const mk=el('span','fn-mark');mk.append(cornerIc(m),el('span','',m[1]));top.append(mk)}
  for(const tg of tagsOf(o)){const tt=tagOf.get(tg);if(!tt)continue;const b=el('button','fn-tag');b.type='button';b.append(tagIc(tt),el('span','',tt[1]));b.onclick=()=>{fnMode='tag';fnSub=String(tg);set('fnMode','tag');set('fnSub',fnSub);go();window.scrollTo(0,0)};top.append(b)}
  body.append(el('strong','fn-name',o.name),top);
  const desc=el('p','fn-desc');body.append(desc);
  const steps=o.steps||[];
  const show=i=>{const st=steps[i]||o;desc.replaceChildren();skillText(desc,String(st.detail||st.brief||''));c.className='fn-card q'+(st.q||o.q||3)};
  if(steps.length>1){const row=el('div','fn-steps');row.append(el('span','fn-steps-label','단계'));
   steps.forEach((st,i)=>{const b=el('button','fn-step q'+st.q,String(i+1));b.type='button';b.onclick=()=>{fnStep.set(o.id,i);row.querySelectorAll('.fn-step').forEach((x,k)=>x.classList.toggle('on',k===i));show(i)};row.append(b)});
   body.append(row);const i0=fnStep.get(o.id)||0;row.querySelectorAll('.fn-step')[i0]?.classList.add('on');show(i0)}
  else show(-1);
  c.append(body);return c};
 const draw=()=>{
  modeBtns.forEach(([m,b])=>{b.classList.toggle('selected',m===fnMode);b.setAttribute('aria-selected',String(m===fnMode))});
  subs.replaceChildren();
  const opts=fnMode==='mark'?[['all','모든 함수',null],...marks.map(m=>[String(m[0]),m[1],m])]:[['all','모든 세트',null],...tags.map(t=>[String(t[0]),t[1],t])];
  if(!opts.some(([k])=>k===fnSub))fnSub='all';
  for(const [k,name,ref] of opts){const n=all.filter(o=>k==='all'?(fnMode==='tag'?tagsOf(o).length>0:true):(fnMode==='mark'?String(o.mark)===k:tagsOf(o).map(String).includes(k))).length;if(!n)continue;
   const b=el('button','fn-sub'+(k===fnSub?' on':''));b.type='button';if(ref)b.append(fnMode==='mark'?cornerIc(ref):tagIc(ref));b.append(el('span','',name),el('span','wr-tab-n',String(n)));
   b.onclick=()=>{fnSub=k;set('fnSub',k);go()};subs.append(b)}
  const q=dnorm(fnQuery);
  const rows=all.filter(o=>inSub(o)&&(!q||dnorm(o.name).includes(q)||dnorm(cleanTags(o.detail||o.brief||'')).includes(q)));
  count.textContent=rows.length+'개';list.replaceChildren();
  if(!rows.length){list.append(el('p','loading-note',q?'「'+fnQuery.trim()+'」에 맞는 함수가 없어요.':'함수가 없어요.'));return}
  if(fnMode==='tag'&&fnSub==='all'){for(const tg of tags){const part=rows.filter(o=>tagsOf(o).includes(tg[0]));if(!part.length)continue;const h=el('h3','fn-group');h.append(tagIc(tg),el('span','',tg[1]+' · '+part.length));list.append(h);const g=el('div','fn-grid');part.forEach(o=>g.append(card(o)));list.append(g)}}
  else{const g=el('div','fn-grid');rows.slice(0,400).forEach(o=>g.append(card(o)));list.append(g);if(rows.length>400)list.append(el('p','load-note','처음 400개만 보여요. 세부 탭이나 기록 찾기로 좁혀 보세요.'))}
 };
 draw();
}
async function showTips({push=true,cat=null}={}){
 const tok=++routeToken;showOnly('dollView');bgmLeave();voiceStop();closeArchiveMenu();$('#crumb').textContent='로딩 팁';
 if(cat&&TIP_GROUPS.some(([g])=>g===cat))tipCat=cat;
 if(push)saveRoute({type:'tips',cat:tipCat==='all'?null:tipCat});
 const host=$('#dollView');host.replaceChildren(el('p','loading-note','로딩 팁을 불러오는 중…'));window.scrollTo(0,0);
 try{if(!tipData)tipData=await fetchJSON(dataPath('loading_tips.json'));await loadDollIndex().catch(()=>null)}catch(e){if(tok===routeToken)host.replaceChildren(error('로딩 팁을 불러오지 못했어요. ('+e.message+')'));return}
 if(tok===routeToken)renderTips();
}
function renderTips(){
 const host=$('#dollView');host.replaceChildren();
 const all=tipData.tips||[];
 const head=el('div','doll-list-head');const t=el('div');t.append(el('div','eyebrow','DATABASE / LOADING TIPS'),el('h2','','로딩 팁'));head.append(t);
 const count=el('span','section-sub');head.append(count);host.append(head);
 const bar=el('div','doll-controls wr-controls');const tabs=el('div','wr-tabs');tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label','로딩 팁 분류');
 const btns=[];
 for(const [g,name] of TIP_GROUPS){
  const n=g==='all'?all.length:all.filter(x=>x.group===g).length;if(!n)continue;
  const b=el('button','cat-tab wr-tab');b.type='button';b.setAttribute('role','tab');b.append(el('span','',name),el('span','wr-tab-n',String(n)));
  b.onclick=()=>{tipCat=g;set('tipCat',g);history.replaceState(history.state,'',location.pathname+location.search+routeHash({type:'tips',cat:g==='all'?null:g}));sync();draw()};
  btns.push([g,b]);tabs.append(b);
 }
 const sync=()=>btns.forEach(([g,b])=>{b.classList.toggle('selected',g===tipCat);b.setAttribute('aria-selected',String(g===tipCat))});
 const sw=el('label','doll-ctl doll-search-wrap');sw.append(el('span','doll-ctl-label','기록 찾기'));
 const sbox=el('span','doll-search');const si=el('input');si.type='search';si.placeholder='이름 · 내용';si.value=tipQuery;si.setAttribute('aria-label','로딩 팁 찾기');si.autocomplete='off';
 si.oninput=()=>{tipQuery=si.value;draw()};sbox.append(el('span','doll-search-prompt','//:_'),si);sw.append(sbox);
 bar.append(tabs,sw);const list=el('div','wr-list tip-list');
 const note=el('p','load-note tip-note','번호는 게임 데이터의 공식 번호예요. '+(tipData.missing||[1,2,40]).join(' · ')+'번은 게임에서 지워져 없어요.');
 host.append(note,bar,list);
 const dname=k=>(dollIndex?.dolls||[]).find(d=>d.voiceKey===k)?.name||k;
 const draw=()=>{
  const q=dnorm(tipQuery);
  const rows=all.filter(x=>(tipCat==='all'||x.group===tipCat)&&(!q||dnorm(x.title).includes(q)||dnorm(x.text).includes(q)));
  count.textContent=rows.length+'개';list.replaceChildren();
  if(!rows.length){list.append(el('p','loading-note',q?'「'+tipQuery.trim()+'」에 맞는 기록이 없어요.':'기록이 없어요.'));return}
  const card=x=>{
   const c=el('div','wr-card tip-card');const top=el('div','wr-card-top');top.append(el('span','wr-no',String(x.id).padStart(2,'0')));
   const body=el('div','wr-body');body.append(el('strong','wr-name tip-title',x.title));body.append(el('p','tip-text',cleanTags(x.text)));
   // 글에 나오는 인형 → 아래에 이름 바로가기
   if(x.dolls?.length){const w=el('div','tip-dolls');for(const [k,alias] of x.dolls){const b=el('button','doll-chip link tip-doll');b.type='button';b.append(ic('user'),document.createTextNode(' '+(alias||dname(k))));b.onclick=()=>showDoll(k);w.append(b)}body.append(w)}
   c.append(top,body);return c};
  if(tipCat==='etc'&&!q){for(const [sg,sn] of TIP_SUBS){const part=rows.filter(x=>(x.sub||'etc')===sg);if(!part.length)continue;list.append(el('h3','tip-sub',sn+' · '+part.length));part.forEach(x=>list.append(card(x)))}}
  else rows.forEach(x=>list.append(card(x)));
 };
 sync();draw();
}
// ----- v0.12.22 아이템 (#items) — 게임 창고 분류 -----
// 그림: site_info.home.itemIconBase (Cloudflare 별도 프로젝트) + <icon 이름>.webp. 주소가 없거나 그림이 없으면 글만
const ITEM_PAGES=[[0,'전체'],[2,'기본 아이템'],[11,'선물'],[3,'소모 아이템'],[8,'알고리즘'],[9,'돌파 위젯'],[5,'육성재료'],[6,'공장재료'],[7,'기념품'],[12,'대형 이벤트'],[10,'이벤트 보상'],[100,'숙소']];
// v1.5.9 선물(인형 좋아함 · 싫어함 선물, items.json gifts.byDoll)은 「선물」 탭(11)으로 따로
let giftIds=null;const GIFT_TAB=11;
const isGift=o=>{if(!giftIds){if(!itemData)return false;giftIds=new Set(Object.values(itemData.gifts?.byDoll||{}).flat(2))}return giftIds.has(o.id)};
const EVENT_TAB=10,itemTab=o=>isGift(o)?GIFT_TAB:(o.tab??o.page);
const DORM=100;let furnData=null,dormView=get('dormView','cat')==='theme'?'theme':'cat',dormCat=0;
const loadFurniture=()=>furnData?Promise.resolve(furnData):fetchJSON(dataPath('furniture.json')).then(d=>furnData=d);
let itemData=null,itemCat=+get('itemCat',0)||0,itemQuery='';
const loadItems=()=>itemData?Promise.resolve(itemData):fetchJSON(dataPath('items.json')).then(d=>itemData=d);
const itemIconBase=()=>siteInfo?.home?.itemIconBase||'';
function itemIcon(icon,cls){
 const box=el('span','item-ic'+(cls?' '+cls:''));const base=itemIconBase();
 if(base&&icon){const im=el('img');im.alt='';im.loading='lazy';im.decoding='async';box.classList.add('loading');im.onload=()=>box.classList.remove('loading');im.onerror=()=>{im.remove();box.classList.remove('loading');box.classList.add('empty')};im.src=base.replace(/\/?$/,'/')+String(icon).split('/').map(encodeURIComponent).join('/')+'.webp';box.append(im)}else box.classList.add('empty');
 return box;
}
async function showItems({push=true,cat=null}={}){
 const tok=++routeToken;showOnly('dollView');bgmLeave();voiceStop();closeArchiveMenu();$('#crumb').textContent='아이템';
 if(cat!=null&&/^\d+$/.test(cat))itemCat=+cat;
 if(push)saveRoute({type:'items',cat:itemCat?String(itemCat):null});
 const host=$('#dollView');host.replaceChildren(el('p','loading-note','아이템을 불러오는 중…'));window.scrollTo(0,0);
 try{await Promise.all([loadItems(),loadFurniture().catch(()=>null),loadDollIndex().catch(()=>null),window.siteReady?.catch(()=>{})])}catch(e){if(tok===routeToken)host.replaceChildren(error('아이템을 불러오지 못했어요. ('+e.message+')'));return}
 if(tok===routeToken)renderItems();
}
const openGroups=new Set();
function renderItems(){
 const host=$('#dollView');host.replaceChildren();
 const every=itemData.items||[],refs=itemData.refs||{},groups=itemData.groups||{},byId=new Map(every.map(o=>[o.id,o]));
 // v1.5.8 돌파 위젯 6종(widget:*)은 목록에 안 보이고, 위젯 선택박스의 「선택 가능」 안에만
 const all=every.filter(o=>!String(o.grp||'').startsWith('widget:'));
 if(!ITEM_PAGES.some(([pg])=>pg===itemCat)||(itemCat===DORM&&!furnData))itemCat=0;
 const ref=id=>byId.get(id)||refs[String(id)]||{name:String(id)};
 const head=el('div','doll-list-head');const t=el('div');t.append(el('div','eyebrow','DATABASE / ITEMS'),el('h2','','아이템'));head.append(t);
 const count=el('span','section-sub');head.append(count);host.append(head);
 const bar=el('div','doll-controls wr-controls');const tabs=el('div','wr-tabs');tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label','아이템 분류');
 const btns=[];
 for(const [pg,name] of ITEM_PAGES){
  const n=pg===DORM?(furnData?.items||[]).length:pg===0?all.length:all.filter(o=>itemTab(o)===pg).length;if(!n)continue;
  const b=el('button','cat-tab wr-tab'+(pg===DORM?' wr-tab-dorm':''));b.type='button';b.setAttribute('role','tab');b.append(el('span','',name),el('span','wr-tab-n',String(n)));
  b.onclick=()=>{itemCat=pg;set('itemCat',pg);history.replaceState(history.state,'',location.pathname+location.search+routeHash({type:'items',cat:pg?String(pg):null}));sync();draw()};
  btns.push([pg,b]);tabs.append(b);
 }
 const sync=()=>btns.forEach(([g,b])=>{b.classList.toggle('selected',g===itemCat);b.setAttribute('aria-selected',String(g===itemCat))});
 const sw=el('label','doll-ctl doll-search-wrap');sw.append(el('span','doll-ctl-label','기록 찾기'));
 const sbox=el('span','doll-search');const si=el('input');si.type='search';si.placeholder='이름 · 내용';si.value=itemQuery;si.setAttribute('aria-label','아이템 찾기');si.autocomplete='off';
 si.oninput=()=>{itemQuery=si.value;draw()};sbox.append(el('span','doll-search-prompt','//:_'),si);sw.append(sbox);
 bar.append(tabs,sw);const list=el('div','item-list');host.append(bar,list);
 const opened=new Set();
 // 펼치기 단추 (구성품 · 선택 가능 · 폴더 · 이벤트별 설명 공용)
 const toggle=(card,key,label,n,fill,set_=opened)=>{
  const tg=el('button','item-toggle');tg.type='button';tg.setAttribute('aria-expanded',String(set_.has(key)));
  tg.append(el('span','',label));if(n!=null)tg.append(el('span','wr-tab-n',String(n)));tg.append(ic('right','tri'));
  const panel=el('div','item-panel');
  const go=on=>{card.classList.toggle('open',on);tg.setAttribute('aria-expanded',String(on));if(on&&!panel.childNodes.length)fill(panel)};
  tg.onclick=()=>{const on=!card.classList.contains('open');go(on);if(on)set_.add(key);else set_.delete(key)};
  card.append(tg,panel);if(set_.has(key))go(true);
 };
 const chips=(panel,ids)=>{const box=el('div','item-contents');for(const [id,n] of ids){const r=ref(id);const c=el('span','item-chip');c.append(itemIcon(r.icon,'sm'),el('span','item-chip-name',r.name));if(n>0)c.append(el('span','item-chip-n','×'+n));box.append(c)}panel.append(box)};
 const srcLine=(body,text)=>{const src=el('p','item-src');src.append(el('span','item-src-label','획득처'),el('span','item-src-text',cleanTags(text)));body.append(src)};
 const fanLines=(body,id)=>{const fans=giftFans(id);
  for(const [k,label] of [[0,'좋아함'],[1,'싫어함']]){if(!fans[k].length)continue;const row=el('p','item-src item-fans');row.append(el('span','item-src-label',label));const names=el('span','item-src-text');
   fans[k].forEach((d,i)=>{if(i)names.append(document.createTextNode(', '));const a=el('button','fan-link',d.name);a.type='button';a.onclick=()=>showDoll(d.voiceKey);names.append(a)});row.append(names);body.append(row)}};
 const boxToggle=(card,o)=>{const cont=o.contents||[],opts=o.options||[];
  if(cont.length)toggle(card,o.id,'구성품',cont.length,p=>chips(p,cont));
  else if(opts.length)toggle(card,o.id,'선택 가능',opts.length,p=>chips(p,opts.map(id=>[id,0])))};
 const shell=(o,ids,cls)=>{const card=el('div','item-card'+(cls?' '+cls:'')+(o.quality?' q'+o.quality:''));card.dataset.ids=ids.join(' ');card.append(linkBtn('#item/'+o.id,o.name));
  const main=el('div','item-main');main.append(itemIcon(o.icon));const body=el('div','item-body');main.append(body);card.append(main);return [card,body]};
 // v1.5.8 카드엔 이름 · 설명만, 나머지는 「자세히」 안에 (카드 크기 맞추기)
 const detail=(card,key,parts)=>{const n=parts.filter(Boolean).length;if(!n)return;toggle(card,'x'+key,'자세히',null,p=>parts.forEach(f=>f&&f(p)))};
 const boxPart=o=>{const cont=o.contents||[],opts=o.options||[];
  if(cont.length)return p=>{p.append(el('div','item-sub-label','구성품 · '+cont.length));chips(p,cont)};
  if(opts.length)return p=>{p.append(el('div','item-sub-label','선택 가능 · '+opts.length));chips(p,opts.map(id=>[id,0]))};
  return null};
 const fanPart=id=>{const f=giftFans(id);return f[0].length||f[1].length?p=>fanLines(p,id):null};
 const itemCard=o=>{const [card,body]=shell(o,[o.id]);body.append(el('strong','item-name',o.name));
  if(o.desc)body.append(el('p','item-desc',cleanTags(o.desc)));
  detail(card,o.id,[o.source?p=>srcLine(p,o.source):null,fanPart(o.id),boxPart(o)]);return card};
 // 이름 · 아이콘이 같은 아이템: 카드 하나, 획득처 모으기, 설명이 다르면 이벤트별로
 const mergedCard=ms=>{const o=ms[0];const [card,body]=shell(o,ms.map(m=>m.id),'item-merged');
  const nm=el('strong','item-name',o.name);body.append(nm,el('span','item-badge','×'+ms.length));
  const descs=[...new Set(ms.map(m=>m.desc||''))];
  if(descs.length===1&&descs[0])body.append(el('p','item-desc',cleanTags(descs[0])));
  else if(descs.length>1)body.append(el('p','item-desc',cleanTags(ms.find(m=>m.desc)?.desc||'')));
  const srcs=[...new Set(ms.map(m=>m.source).filter(Boolean))];
  detail(card,o.id,[
   srcs.length?p=>{const src=el('div','item-src item-src-list');src.append(el('span','item-src-label','획득처'));const ul=el('ul','item-src-text');srcs.forEach(x=>ul.append(el('li','',cleanTags(x))));src.append(ul);p.append(src)}:null,
   descs.length>1?p=>{p.append(el('div','item-sub-label','이벤트별 설명 · '+ms.length));for(const m of ms){const b=el('div','item-variant');b.append(el('small','',cleanTags(m.source||'')),el('p','item-desc',cleanTags(m.desc||'')));p.append(b)}}:null,
   fanPart(o.id),descs.length>1?null:boxPart(o)]);
  return card};
 // 폴더: 같은 종류(위젯 등급 · 인증키 · 검색 지령 …) 를 카드 하나에
 const folderCard=(g,ms)=>{const o=ms[0];const [card,body]=shell({...o,name:groups[g]?.title||o.name},ms.map(m=>m.id),'item-folder');
  body.append(el('strong','item-name',groups[g]?.title||o.name),el('span','item-badge',ms.length+'개'));
  body.append(el('p','item-desc item-folder-names',ms.map(m=>m.name).join(' · ')));
  toggle(card,g,'펼치기',ms.length,p=>{const gl=el('div','item-list item-sub');ms.forEach(m=>gl.append(itemCard(m)));p.append(gl)},openGroups);
  return card};
 const grouped=(box,rows)=>{
  const grid=el('div','item-list'),seen=new Set(),evs=[];
  for(const o of rows){
   const g=o.grp;if(!g){grid.append(itemCard(o));continue}
   if(seen.has(g))continue;seen.add(g);const ms=rows.filter(x=>x.grp===g),kind=groups[g]?.kind;
   if(kind==='merge')grid.append(ms.length>1?mergedCard(ms):itemCard(ms[0]));
   else if(kind==='event')evs.push([g,ms]);
   else grid.append(ms.length>1?folderCard(g,ms):itemCard(ms[0]));
  }
  if(grid.childNodes.length)box.append(grid);
  // v1.7.4 이벤트 폴더는 이벤트 순서(스토리 목록 순서, groups[g].ord)대로
  evs.sort((a,b)=>(groups[a[0]]?.ord??1e9)-(groups[b[0]]?.ord??1e9));
  if(evs.length){const acc=el('div','wr-long ev-list');
   for(const [g,ms] of evs){const item=el('section','wr-long-item');const h=el('button','wr-long-btn');h.type='button';
    const nm=el('span','wr-long-title');nm.append(el('strong','',groups[g]?.title||''));h.append(nm,el('span','wr-long-len',ms.length+'개'),ic('right','tri'));
    const panel=el('div','wr-long-panel');const fill=()=>{if(panel.childNodes.length)return;const gl=el('div','item-list ev-items');ms.forEach(m=>gl.append(itemCard(m)));panel.append(gl)};
    const go=on=>{item.classList.toggle('open',on);h.setAttribute('aria-expanded',String(on));if(on)fill()};
    h.onclick=()=>{const on=!item.classList.contains('open');go(on);if(on)openGroups.add(g);else openGroups.delete(g)};
    if(openGroups.has(g))go(true);item.append(h,panel);acc.append(item)}
   box.append(acc)}
 };
 const draw=()=>{
  const q=dnorm(itemQuery);
  list.classList.toggle('dorm-mode',itemCat===DORM);
  if(itemCat===DORM){drawDorm(list,count,q);return}
  list.classList.add('dorm-mode');list.replaceChildren();
  const rows=all.filter(o=>(itemCat===0||itemTab(o)===itemCat)&&(!q||dnorm(o.name).includes(q)||dnorm(o.desc).includes(q))).sort((a,b)=>(b.quality||0)-(a.quality||0));
  count.textContent=rows.length+'개';
  if(!rows.length){list.append(el('p','loading-note',q?'「'+itemQuery.trim()+'」에 맞는 기록이 없어요.':'기록이 없어요.'));return}
  if(q){const grid=el('div','item-list');rows.forEach(o=>grid.append(itemCard(o)));list.append(grid);return}
  if(itemCat!==0){grouped(list,rows);return}
  for(const [pg,name] of ITEM_PAGES){if(!pg||pg===DORM)continue;const part=rows.filter(o=>itemTab(o)===pg);if(!part.length)continue;
   const gh=el('div','doll-group-head');gh.append(el('h3','',name),el('span','doll-group-count',part.length+'개'));list.append(gh);grouped(list,part)}
 };
 sync();draw();focusItemCard();
}
// 선물 아이템을 좋아하는 · 싫어하는 인형 (items.json gifts.byDoll + doll_index)
let fanCache=null;
function giftFans(id){
 if(!fanCache){fanCache=new Map();const by=itemData?.gifts?.byDoll||{},dolls=new Map((dollIndex?.dolls||[]).map(d=>[d.voiceKey,d]));
  for(const [vk,[lk,dk]] of Object.entries(by)){const d=dolls.get(vk);if(!d)continue;[lk,dk].forEach((ids,k)=>ids.forEach(i=>{if(!fanCache.has(i))fanCache.set(i,[[],[]]);fanCache.get(i)[k].push(d)}))}
  for(const v of fanCache.values())v.forEach(a=>a.sort((x,y)=>x.name.localeCompare(y.name,'ko')))}
 return fanCache.get(id)||[[],[]];
}
// v1.2 아이템 한 항목 (#item/<id>): 그 칸으로 가서 잠깐 강조 (가구는 숙소 탭)
let focusItem=null;
async function showItem(id,{push=true}={}){
 id=+id;
 try{await Promise.all([loadItems(),loadFurniture().catch(()=>null)])}catch(e){await showItems({push});return}
 const it=(itemData.items||[]).find(o=>o.id===id),fu=(furnData?.items||[]).find(o=>o.id===id);
 if(!it&&!fu){await showItems({push});return}
 itemQuery='';focusItem=id;
 if(fu){await showDormTheme(fu.themes?.[0]??'etc',{push:false});if(push)saveRoute({type:'item',id});focusItemCard();return}
 itemCat=itemTab(it);if(it.grp)openGroups.add(it.grp);
 await showItems({push:false,cat:String(itemCat)});
 if(push)saveRoute({type:'item',id});
}
function focusItemCard(){
 if(focusItem==null)return;const id=focusItem;focusItem=null;
 const cs=document.querySelectorAll('.item-card[data-ids~="'+id+'"]'),c=cs[cs.length-1];if(!c)return;
 c.scrollIntoView({block:'center'});c.classList.add('item-focus');setTimeout(()=>c.classList.remove('item-focus'),2400);
}
// 숙소(가구): [종류별 | 테마별]
function furnCard(o,catName,themeName,inTheme){
 const card=el('div','item-card furn-card'+(o.quality?' q'+o.quality:''));card.dataset.ids=String(o.id);card.append(linkBtn('#item/'+o.id,o.name));
 const main=el('div','item-main');main.append(itemIcon(o.icon));
 const body=el('div','item-body');body.append(el('strong','item-name',o.name));
 const meta=[catName,o.comfort?'쾌적도 +'+o.comfort:'',o.size?o.size[0]+'×'+o.size[1]:''].filter(Boolean);
 if(meta.length){const m=el('span','furn-meta');meta.forEach((t,i)=>{if(i)m.append(document.createTextNode(' · '));m.append(el('span','',t))});body.append(m)}
 if(o.desc)body.append(el('p','item-desc',cleanTags(o.desc).trim()));
 if(o.themes?.length&&!inTheme){const t=el('p','item-src');t.append(el('span','item-src-label','테마'),el('span','item-src-text',o.themes.map(themeName).join(', ')));body.append(t)}
 if(o.source){const src=el('p','item-src');src.append(el('span','item-src-label','획득처'),el('span','item-src-text',cleanTags(o.source)));body.append(src)}
 main.append(body);card.append(main);return card;
}
// v1.3 숙소: 테마로만. 작은 폴더(이름 · 개수) → 누르면 테마 페이지 (#dorm/<id>). 테마 없는 가구는 「그 외 가구」
const DORM_ETC='etc';
function dormThemes(){const d=furnData||{items:[],themes:[]};const byId=new Map(d.items.map(o=>[o.id,o]));
 const out=d.themes.map(t=>({id:String(t.id),name:t.name,info:t.info,pics:t.pics||[],items:t.items.map(i=>byId.get(i)).filter(Boolean)}));
 const etc=d.items.filter(o=>!o.themes?.length);if(etc.length)out.push({id:DORM_ETC,name:'그 외 가구',info:'',pics:[],items:etc});
 return out}
function drawDorm(list,count,q){
 const d=furnData||{items:[],categories:[]};const cats=new Map(d.categories.map(c=>[c.id,c.name]));
 list.replaceChildren();
 if(q){const rows=d.items.filter(o=>dnorm(o.name).includes(q)||dnorm(o.desc).includes(q));count.textContent=rows.length+'개';
  const grid=el('div','item-list');list.append(grid);
  if(!rows.length){grid.append(el('p','loading-note','「'+itemQuery.trim()+'」에 맞는 기록이 없어요.'));return}
  const tn=new Map(d.themes.map(t=>[t.id,t.name]));rows.forEach(o=>grid.append(furnCard(o,cats.get(o.cat),id=>tn.get(id)||String(id))));return}
 const ths=dormThemes();count.textContent=ths.length+'세트';
 const grid=el('div','dorm-tiles');list.append(grid);
 for(const t of ths){const b=el('button','dorm-tile'+(t.id===DORM_ETC?' dorm-tile-etc':''));b.type='button';
  const ics=el('span','dorm-tile-ics');t.items.slice(0,4).forEach(o=>ics.append(itemIcon(o.icon,'sm')));
  const tx=el('span','dorm-tile-text');tx.append(el('strong','',t.name),el('small','',t.items.length+'개'));
  b.append(ics,tx);b.onclick=()=>showDormTheme(t.id);grid.append(b)}
}
async function showDormTheme(id,{push=true}={}){
 const tok=++routeToken;showOnly('dollView');bgmLeave();voiceStop();closeArchiveMenu();
 const host=$('#dollView');host.replaceChildren(el('p','loading-note','아이템을 불러오는 중…'));window.scrollTo(0,0);
 try{await Promise.all([loadItems(),loadFurniture()])}catch(e){if(tok===routeToken)host.replaceChildren(error('아이템을 불러오지 못했어요. ('+e.message+')'));return}
 if(tok!==routeToken)return;
 const t=dormThemes().find(x=>x.id===String(id));if(!t){itemCat=DORM;await showItems({push});return}
 if(push)saveRoute({type:'dorm',id:t.id});
 $('#crumb').textContent='숙소 · '+t.name;host.replaceChildren();
 const d=furnData;const cats=new Map(d.categories.map(c=>[c.id,c.name])),tn=new Map(d.themes.map(x=>[x.id,x.name]));
 const back=el('button','folder-back');back.type='button';back.append(ic('left'),document.createTextNode(' 숙소'));
 back.onclick=()=>{if(navCount>0)history.back();else{itemCat=DORM;showItems()}};
 const head=el('div','record-head');const h=el('div');h.append(el('div','eyebrow','DORM / THEME'),el('h2','',t.name));head.append(h,linkBtn('#dorm/'+t.id,t.name));
 host.append(back,head);
 if(t.info)host.append(el('p','dorm-theme-info dorm-page-info',cleanTags(t.info)));
 // 3D 프리셋 뷰 자리: site_info.home.dormPicBase 가 있으면 테마 그림(pics)을 띄움 (그림은 나중에)
 const base=siteInfo?.home?.dormPicBase;
 if(base&&t.pics.length){const pv=el('div','dorm-preview');t.pics.forEach(n=>{const im=el('img');im.alt='';im.loading='lazy';im.src=base.replace(/\/?$/,'/')+encodeURIComponent(n)+'.webp';im.onerror=()=>im.remove();pv.append(im)});host.append(pv)}
 const sub=el('span','section-sub',t.items.length+'개');host.append(sub);
 const grid=el('div','item-list dorm-page-list');t.items.forEach(o=>grid.append(furnCard(o,cats.get(o.cat),x=>tn.get(x)||String(x),t.id!==DORM_ETC)));host.append(grid);
}
// v1.2 프로필 선물 칸 → 아이템 (누르면 아이템 칸으로). 연결 정보가 있으면 그 순서 · 이름으로 다시 그림
function giftLinks(w,vk,kind){loadItems().then(d=>{
 const ids=d.gifts?.byDoll?.[vk]?.[kind];if(!ids?.length){giftIcons(w);return}
 const byId=new Map((d.items||[]).map(o=>[o.id,o]));
 w.querySelectorAll('.doll-chip').forEach(c=>c.remove());
 for(const id of ids){const o=byId.get(id);if(!o)continue;const b=el('button','doll-chip doll-chip-link');b.type='button';b.dataset.item=o.name;b.title=o.name;
  if(itemIconBase())b.append(itemIcon(o.icon,'chip'));b.append(document.createTextNode(o.name));b.onclick=()=>showItem(id);w.append(b)}
}).catch(()=>giftIcons(w))}
// 선물 칸 아이콘 (그림 주소가 있을 때만, 아이템 이름으로 연결)
function giftIcons(w){if(!itemIconBase())return;loadItems().then(d=>{const m=new Map((d.items||[]).filter(o=>o.page===2).map(o=>[o.name,o.icon]));w.querySelectorAll('.doll-chip[data-item]').forEach(c=>{const icon=m.get(c.dataset.item);if(icon&&!c.querySelector('.item-ic'))c.prepend(itemIcon(icon,'chip'))})}).catch(()=>{})}
// ----- v1.4 인형 스킬 (data/<언어>/skills.json) -----
let skillData=null;
const loadSkills=()=>skillData?Promise.resolve(skillData):fetchJSON(dataPath('skills.json')).then(d=>skillData=d);
const SKILL_TYPE={1:'자동',2:'패시브',3:'궁극기'},SKILL_ORDER={2:0,1:1,3:2};
const TERM_TONE={1:'green',2:'red',3:'orange'};
let skillLv=get('skillLv','max');
// v1.7.9 효과 이름 → 효과 사전 (스킬 용어 + 효과 사전 데이터, 지형 함수 제외)
function skillTerm(text){const terms=fxData?.effects?fxData.effects.filter(x=>!x.grid):(skillData?.terms||[]);const t=text.replace(/\s+/g,'');let best=null;
 for(const x of terms){const n=x.name.replace(/\s+/g,'');if(!n)continue;if((t===n||t.includes(n))&&(!best||n.length>best.name.replace(/\s+/g,'').length))best=x}return best}
// 색 글자 = 게임 표기 그대로, 용어 사전에 있는 말이면 누르면 설명 창 (v1.7.9: 「이름」 도, 설명 창에서 효과 사전으로)
const openTerm=term=>openLore(term.name,term.desc,{fx:term.id},'EFFECT',TERM_TONE[term.color]||'');
function skillText(parent,text){
 const src=String(text||'').replace(/<cmdr>/gi,()=>nick()).replace(/\\n/g,'\n').replace(/\s+$/,'');
 const re=/<color=(#[0-9a-fA-F]{6,8})>([\s\S]*?)<\/color>/gi;let last=0,m;
 const plain=t=>t.replace(/<\/?(?:color|i|b|size)(?:=[^>]*)?>/gi,'');
 const put=t=>{t=plain(t||'');if(!t)return;
  // 「이름」 이 효과 이름과 똑같으면 누를 수 있게
  const q=/「([^」]{1,20})」/g;let a=0,k;
  while((k=q.exec(t))){const term=skillTerm(k[1]);if(!term||term.name.replace(/\s+/g,'')!==k[1].replace(/\s+/g,''))continue;
   if(k.index>a)parent.append(document.createTextNode(t.slice(a,k.index)));
   const b=el('button','skill-hl skill-term skill-quote',k[0]);b.type='button';b.onclick=e=>{e.stopPropagation();openTerm(term)};parent.append(b);a=q.lastIndex}
  if(a<t.length)parent.append(document.createTextNode(t.slice(a)))};
 while((m=re.exec(src))){put(src.slice(last,m.index));const word=plain(m[2]);const term=skillTerm(word);
  const sp=el(term?'button':'span','skill-hl'+(term?' skill-term':''),word);sp.style.setProperty('--hl',m[1].slice(0,7));
  if(term){sp.type='button';sp.onclick=e=>{e.stopPropagation();openTerm(term)}}
  parent.append(sp);last=re.lastIndex}
 put(src.slice(last));
}
const fmtNum=v=>v==null?'?':(Math.round(v*100)/100).toLocaleString(window.UI_LOCALE||'ko-KR',{maximumFractionDigits:2});
function skillDetail(sk,lv){return String(sk.detail||'').replace(/\{(\d+)\}/g,(_,i)=>{const row=sk.vals?.[+i];return row?fmtNum(row[Math.min(lv,row.length)-1]):'{'+i+'}'})}
function skillPanel(p){
 const box=el('div','skill-list');
 const list=[...(p.skills||[])].sort((a,b)=>(SKILL_ORDER[a.type]??9)-(SKILL_ORDER[b.type]??9));
 if(list.some(x=>x.fan))box.append(fanNote());
 // v1.6.5 무장각인 적용: 단계 Ⅰ · Ⅱ · Ⅲ 강화가 붙는 스킬에 주황 안쪽 테두리 · 강화 이름 · 추가 효과
 const steps=(p.arma?.steps||[]).slice(0,3);
 if(steps.length){
  const on=get('armaOn','off')==='on';
  const bar=el('div','skill-arma-bar');const tg=el('button','skill-arma-toggle'+(on?' on':''));tg.type='button';tg.setAttribute('aria-pressed',String(on));
  tg.append(el('span','skill-arma-dot'),el('span','','무장각인 적용'),el('span','skill-arma-state',on?'ON':'OFF'));
  tg.onclick=()=>{set('armaOn',on?'off':'on');box.replaceWith(skillPanel(p))};
  bar.append(tg,el('span','skill-arma-name',[p.arma.name,'Ⅰ · Ⅱ · Ⅲ'].join(' · ')));box.append(bar);
 }
 const armaOn=steps.length&&get('armaOn','off')==='on';
 for(const sk of list){
  const ups=armaOn?steps.map((st,i)=>({st,i})).filter(x=>x.st.skill?.base===sk.id):[];
  const max=sk.maxLv||1;let lv=skillLv==='max'?max:Math.min(+skillLv||max,max);
  const row=el('section','skill-row');
  const head=el('button','skill-head');head.type='button';head.setAttribute('aria-expanded','false');
  const icw=skillHex(sk.icon,{type:sk.type,cat:sk.cat,enh:ups.length>0});
  const mid=el('span','skill-mid');const top=el('span','skill-top');
  top.append(el('span','skill-type t'+sk.type,SKILL_TYPE[sk.type]||''),el('strong','skill-name',ups.length?ups[ups.length-1].st.skill.name:sk.name));
  const meta=el('span','skill-meta');
  const preAt=l=>{if(!sk.pre)return null;let v=sk.pre[0];(sk.preLv||[]).forEach((L,i)=>{if(l>=L)v=sk.pre[i]});return v};
  const drawMeta=()=>{meta.replaceChildren();const pv=preAt(lv);if(pv!=null)meta.append(el('span','skill-chip','예충전 '+fmtNum(pv)+'초'));if(sk.cd){const c=el('span','skill-chip skill-cd');c.title='쿨타임';c.append(ic('hourglass'),el('span','',fmtNum(sk.cd)+'초'));meta.append(c)}};
  drawMeta();top.append(meta);
  const brief=el('span','skill-brief');skillText(brief,sk.brief);
  mid.append(top,brief);
  for(const {st,i} of ups){const r=el('span','skill-arma-add');r.append(el('span','skill-arma-tag','무장각인 '+ROMAN[i]));const t=el('span','skill-arma-text');skillText(t,st.skill.desc||'');r.append(t);mid.append(r)}head.append(icw,mid,ic('right','tri'));
  const panel=el('div','skill-panel');
  const fill=()=>{panel.replaceChildren();
   const lvbar=el('div','skill-lv');lvbar.append(el('span','skill-lv-label','레벨'));
   for(let i=1;i<=max;i++){const b=el('button','skill-lv-btn'+(i===lv?' on':''),i===max?'MAX':String(i));b.type='button';b.onclick=e=>{e.stopPropagation();lv=i;skillLv=i===max?'max':String(i);set('skillLv',skillLv);drawMeta();fill()};lvbar.append(b)}
   const det=el('p','skill-detail');skillText(det,skillDetail(sk,lv));
   panel.append(lvbar,det);
   if(sk.cut){/* 궁극기 컷씬: 영상 변환 후 연결 */}
  };
  head.onclick=()=>{const on=!row.classList.contains('open');row.classList.toggle('open',on);head.setAttribute('aria-expanded',String(on));if(on)fill()};
  row.append(head,panel);box.append(row);
 }
 return box;
}
// 스킬 아이콘 = 게임처럼 4층: 회색 육각 바탕(bg) + 종류별 밑그림(ICON_skill/passive/ultimate_base)을 분류 색으로 + 아이콘(그대로) + 흰 테두리(종류별 틀)
// 분류 cat: 1 공격 빨강 · 2 회복 연두 · 3 방어 파랑 · 4 특수 회청 / 궁극기 그림은 색이 들어 있어 그대로 / 무장각인 강화(enh)는 주황 테두리
const HEX_TONE={1:[.82,.14,.14],2:[.57,.82,.16],3:[.11,.63,.85],4:[.49,.54,.63]}; // 게임 Consts.HeroConsts eBattleSkillTypeColor: Attack · Recovery · Defense · Special
function hexFilters(){if(document.getElementById('skHexDefs'))return;
 const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');svg.id='skHexDefs';svg.setAttribute('width','0');svg.setAttribute('height','0');svg.style.position='absolute';
 // 검정 → 분류 색, 흰색 → 흰색 (out = c + (1 - c) × 밝기)
 for(const [k,[r,g,b]] of Object.entries(HEX_TONE)){const f=document.createElementNS(ns,'filter');f.id='skc'+k;f.setAttribute('color-interpolation-filters','sRGB');
  const m=document.createElementNS(ns,'feColorMatrix');m.setAttribute('type','matrix');
  m.setAttribute('values',[`${1-r} 0 0 0 ${r}`,`0 ${1-g} 0 0 ${g}`,`0 0 ${1-b} 0 ${b}`,'0 0 0 3 0'].join(' '));f.append(m);svg.append(f)}
 document.body.append(svg)}
function skillHex(icon,o={}){hexFilters();
 const w=el('span','skill-ic skill-hex t'+(o.type||1)+' c'+(o.cat||1)+(o.enh?' enh':''));
 const tn=HEX_TONE[o.cat||1]||HEX_TONE[1];w.style.setProperty('--hx','rgb('+tn.map(v=>Math.round(v*255)).join(',')+')');
 w.append(el('span','hex-fill'),el('span','hex-base'));const ii=itemIcon(icon?'skill/'+icon:'');w.append(ii);if(o.enh)w.append(el('span','hex-arma'));w.append(el('span','hex-fr'));return w}

// ----- v1.7 인형 능력치 · 친밀도 보너스 (data/<언어>/stats.json) -----
let statsData=null;
const loadStats=()=>statsData?Promise.resolve(statsData):fetchJSON(dataPath('stats.json')).then(d=>statsData=d);
let friendLv=+get('friendLv',20)||20;
const starLabel=n=>n%1?Math.floor(n)+'.5★':n+'★';
function statsPanel(p){
 const st=p.stats,order=statsData?.order||[],names=armaData?.attrs||{},icons=armaData?.attrIcons||{};
 const wrap=el('div','stats-wrap');
 // 왼쪽: 성급 · 레벨별 능력치
 const left=el('section','stats-card');left.append(el('div','stats-head','능력치'));
 const tb=el('table','algo-table stats-table');const th=el('tr');th.append(el('th','algo-th-stat',''));
 for(const c of st.cols){const h=el('th','');{const ss=el('span','stats-star');ss.append(document.createTextNode(c.star%1?Math.floor(c.star)+'.5':String(c.star)),ic('star'));h.append(ss)}h.append(el('span','stats-lv','Lv.'+c.lv));th.append(h)}tb.append(th);
 for(const a of order){if(!st.cols.some(c=>c.v[a]!=null))continue;const tr=el('tr');const td=el('td','algo-td-stat');td.append(attrLbl(icons[a],names[a]||a));tr.append(td);
  for(const c of st.cols){const v=c.v[a];tr.append(el('td','',v==null?'-':typeof v==='number'?v.toLocaleString(window.UI_LOCALE||'ko-KR'):v))}tb.append(tr)}
 const tw=el('div','algo-table-wrap');tw.append(tb);left.append(tw,el('p','load-note','Lv.60 · Lv.70 은 그 레벨에 필요한 마인드 확장을 포함한 값이에요. 알고리즘 · 무장각인 · 친밀도는 빼고 계산했어요.'));
 // 오른쪽: 친밀도 보너스
 const right=el('section','stats-card');const rh=el('div','stats-head');rh.append(document.createTextNode('친밀도 보너스'));right.append(rh);
 const bar=el('div','arma-lvbar stats-fbar');const dn=icBtn('down','arma-step'),up=icBtn('up','arma-step');
 const range=el('input','arma-range');range.type='range';range.min=1;range.max=20;range.value=friendLv;range.setAttribute('aria-label','친밀도');
 const lvTxt=el('span','arma-lvtxt');bar.append(el('span','arma-lvlabel','친밀도'),dn,range,up,lvTxt);right.append(bar);
 const list=el('div','stats-bonus');right.append(list);
 const draw=()=>{lvTxt.replaceChildren(el('b','',String(friendLv)),document.createTextNode(' / 20'));list.replaceChildren();
  for(const b of st.bonus||[]){const got=b.steps.filter(x=>x.fl<=friendLv);const cur=got[got.length-1],next=b.steps[got.length];
   const row=el('div','stats-brow'+(cur?'':' locked'));const ic=el('span','stats-fic');if(b.icon){const im=el('img');im.alt='';im.decoding='async';im.src='/assets/img/friend/'+b.icon+'.webp';im.onerror=()=>im.remove();ic.append(im)}row.append(ic);
   const body=el('div','stats-bbody');const t=el('div','stats-btop');t.append(el('strong','stats-bname',b.name),el('span','stats-bstep','LV'+got.length+' / '+b.steps.length));body.append(t);
   const line=el('div','stats-bline');line.append(attrLbl(icons[b.attr],names[b.attr]||''),el('b','stats-bval',cur?'+'+(typeof cur.v==='number'?cur.v.toLocaleString(window.UI_LOCALE||'ko-KR'):cur.v):'-'));body.append(line);
   const req=el('div','stats-breq');
   if(cur)req.append(el('span','skill-chip','인형 Lv.'+cur.hl+' 필요'));
   if(next)req.append(el('span','skill-chip stats-next','다음: 친밀도 '+next.fl+' · +'+next.v));
   body.append(req);row.append(body);list.append(row)}};
 const setLv=v=>{friendLv=Math.min(Math.max(v,1),20);set('friendLv',friendLv);range.value=friendLv;draw()};
 dn.onclick=()=>setLv(friendLv-1);up.onclick=()=>setLv(friendLv+1);range.oninput=()=>setLv(+range.value);
 draw();wrap.append(left,right);return wrap}
// ----- v1.4 무장각인 (data/<언어>/arma.json · 로고 = pnc-item arma/<heroId>.webp) -----
let armaData=null;
const loadArma=()=>armaData?Promise.resolve(armaData):fetchJSON(dataPath('arma.json')).then(d=>armaData=d);
const ROLE_TONE=['#3d8bff','#ff8a2a','#ff4f45','#a66bff','#3fc46b']; // 수위 · 전사 · 사수 · 해결사 · 치료사
const ROMAN=['Ⅰ','Ⅱ','Ⅲ'];
let armaLv=(v=>Number.isFinite(v)?v:30)(+get('armaLv',30));
// 1920×1080 화면 가운데 기준 좌표 → 무대 안 % 위치
const armaPos=(x,y)=>({left:(x+960)/19.2+'%',top:(540-y)/10.8+'%'});
const ARMA_NODE=[[-429,0],[429,0],[0,432]]; // 게임 화면: Ⅰ 왼쪽 · Ⅱ 오른쪽 · Ⅲ 위
function armaPanel(p){
 const a=p.arma,MAX=a.levels?.length||30,attrs=armaData?.attrs||{};
 const ri=ROLE_ORDER.map(l=>l.indexOf(p.role)).find(i=>i>=0);const tone=ROLE_TONE[ri]??ROLE_TONE[2];
 let lv=Math.min(Math.max(armaLv,0),MAX),sel='center';
 const wrap=el('div','arma');wrap.style.setProperty('--arma',tone);
 if(a.fan)wrap.append(fanNote());
 // 게임 화면 그대로: 1920×1080 판에 게임 조각(assets/img/arma, KR spriteatlas/ui_armainscripta)을 배치 위치대로 놓고 칸 너비에 맞춰 줄임
 const R='r'+(ri??2),IMG='/assets/img/arma/';
 const stage=el('div','arma-stage');const cv=el('div','arma-canvas');stage.append(cv);
 const put=(src,x,y,w,h,rot,cls)=>{const im=el('img','arma-px'+(cls?' '+cls:''));im.alt='';im.decoding='async';im.src=src.includes('/')?src:IMG+src+'.webp';
  Object.assign(im.style,{left:(960+x-w/2)+'px',top:(540-y-h/2)+'px',width:w+'px',height:h+'px'});if(rot)im.style.transform='rotate('+(-rot)+'deg)';cv.append(im);return im};
 // 네 귀퉁이 장식
 put('lt',172-960,540-218,202,164);put('lb',136-960,209-540,284,373);put('rt',873,240,242,330);put('rb',827,127-540,182,212);
 // 레벨 마름모 30개 (레벨만큼 켜짐, 지금 레벨엔 선택 표시)
 const pts=(armaData?.points||[]).map(([x,y])=>({x,y,off:put('pt_off_'+R,x,y,91,90,0,'pt-off'),on:put('pt_on_'+R,x,y,91,90,0,'pt-on')}));
 // 가운데
 put('center_'+R,0,0,1472,1125);put('cpu_'+R,0,0,902,902);
 [[-128,127,45],[-128,-126,0],[128,-126,225],[127,126,0]].forEach(([x,y,r])=>put('cpuline_'+R,x,y,108,154,r));
 // 가운데 흰 마름모 테두리 (CenterFrame 389 · CenterFrame(1) 1080, 둘 다 45도)
 [['f1',389],['f2',1080]].forEach(([k,w])=>{const d=el('span','arma-frame '+k);Object.assign(d.style,{left:(960-w/2)+'px',top:(540-w/2)+'px',width:w+'px',height:w+'px'});cv.append(d)});
 put('cdeco_'+R,0,0,360,360,45);
 put('arrow',0,318,19,38,90);put('arrow',-316,0,19,38,180);put('arrow',316,0,19,38,0);
 const cStep=put('n1',0,204,51,39,0,'c-step');
 const base=itemIconBase();if(base){const lg=put(base.replace(/\/?$/,'/')+'arma/'+p.heroId+'.webp',0,0,330,330,0,'c-logo');lg.onerror=()=>lg.remove()}
 const txt=(cls,y,t)=>{const d=el('div','arma-tx '+cls);d.style.top=(540-y)+'px';if(t)d.textContent=t;cv.append(d);return d};
 const cLv=txt('c-lv',-188),cLvL=txt('c-lvl',-222,'- 레벨 -');
 txt('c-name arma-name',-318,[a.hero,a.name].filter(Boolean).join('·'));put('word',3,-351,197,9);
 const center=el('button','arma-hit c');center.type='button';center.setAttribute('aria-label',a.name);Object.assign(center.style,{left:(960-200)+'px',top:(540-200)+'px'});cv.append(center);
 // 각인 돌파 칸: 게임 화면 Ⅰ 왼쪽 · Ⅱ 오른쪽 · Ⅲ 위
 const NUMS=[[43,33],[39,30],[51,39]];
 const nodes=a.steps.slice(0,3).map((st,i)=>{const [x,y]=ARMA_NODE[i];
  const g={fog:null};put('node_'+R,x,y,391,391,0,'node');put('node_deco',x,y,90,90);put('n'+(i+1),x,y,...NUMS[i]);
  g.fog=put('lockfog',x,y,220,220,0,'node-fog');g.sel=put('sel',x,y,126,128,45,'node-sel');
  const b=el('button','arma-hit n');b.type='button';b.setAttribute('aria-label','각인 돌파 '+ROMAN[i]);Object.assign(b.style,{left:(960+x-90)+'px',top:(540-y-90)+'px'});
  b.onclick=()=>{sel=i;draw()};cv.append(b);g.b=b;return g});
 center.onclick=()=>{sel='center';draw()};
 // 판 크기 맞추기
 const fit=()=>{cv.style.transform='scale('+(stage.clientWidth/1920)+')'};
 if(window.ResizeObserver)new ResizeObserver(fit).observe(stage);requestAnimationFrame(fit);
 // 레벨 조절
 const bar=el('div','arma-lvbar');
 const dn=icBtn('down','arma-step'),up=icBtn('up','arma-step');dn.setAttribute('aria-label','레벨 -1');up.setAttribute('aria-label','레벨 +1');
 const range=el('input','arma-range');range.type='range';range.min=0;range.max=MAX;range.value=lv;range.setAttribute('aria-label','레벨');
 const lvTxt=el('span','arma-lvtxt');
 const setLv=v=>{lv=Math.min(Math.max(v,0),MAX);armaLv=lv;set('armaLv',lv);range.value=lv;draw()};
 dn.onclick=()=>setLv(lv-1);up.onclick=()=>setLv(lv+1);range.oninput=()=>setLv(+range.value);
 bar.append(el('span','arma-lvlabel','레벨'),dn,range,up,lvTxt);
 const info=el('div','arma-info');
 // 단계 s(1~3)는 레벨 s×10 에서 돌파
 const open=i=>lv>=(a.steps[i]?.maxLv??(i+1)*10);
 const stepOf=()=>a.steps.findIndex(st=>lv<=st.maxLv)+1||a.steps.length;
 function draw(){
  pts.forEach((q,i)=>{q.on.hidden=i>=lv;q.off.hidden=i<lv});
  nodes.forEach((g,i)=>{g.fog.hidden=open(i);g.sel.hidden=sel!==i;g.b.classList.toggle('open',open(i))});
  cStep.src=IMG+'n'+Math.min(stepOf(),3)+'.webp';cLv.textContent=lv+'/'+MAX;
  lvTxt.replaceChildren(el('b','',String(lv).padStart(2,'0')),document.createTextNode(' / '+MAX));
  info.replaceChildren();
  if(sel==='center'){
   const h=el('div','arma-info-head');h.append(el('span','eyebrow','ARMA INSCRIPTA'),el('strong','arma-info-name arma-nm',a.name));info.append(h);
   if(a.desc)info.append(el('p','arma-desc',a.desc));
   const meta=el('div','arma-meta');meta.append(el('span','skill-chip','단계 '+ROMAN[stepOf()-1]),el('span','skill-chip','레벨 '+lv+' / '+MAX));info.append(meta);
   info.append(el('div','arma-sub','특성'));
   const tl=el('div','arma-traits');a.steps.forEach((st,i)=>{const t=el('button','arma-trait'+(open(i)?' open':''));t.type='button';t.append(el('span','arma-trait-n',ROMAN[i]),el('span','arma-trait-name',st.skill.name),el('span','arma-trait-lv',open(i)?'':'Lv.'+(st.maxLv??(i+1)*10)));t.onclick=()=>{sel=i;draw()};tl.append(t)});info.append(tl);
   info.append(el('div','arma-sub','능력치 상승'));
   const g=el('div','arma-stats');const row=a.levels[lv-1]||{};
   for(const [k,v] of Object.entries(row)){if(!v)continue;const it=el('div','arma-stat');const lb=el('span','');lb.append(attrIc(armaData?.attrIcons?.[k]),document.createTextNode(attrs[k]||k));it.append(lb,el('b','','+'+fmtNum(v)));g.append(it)}
   if(!g.childNodes.length)g.append(el('span','arma-none','—'));info.append(g);
  }else{
   const st=a.steps[sel],i=sel;
   const h=el('div','arma-info-head');h.append(el('span','eyebrow','STRENGTHEN '+ROMAN[i]),el('strong','arma-info-name','각인 돌파 '+ROMAN[i]));info.append(h);
   const card=el('div','arma-skill'+(open(i)?'':' locked'));card.append(skillHex(st.skill.icon,{type:(p.skills||[]).find(x=>x.id===st.skill.base)?.type,cat:st.skill.cat,enh:open(i)}));
   const body=el('div','arma-skill-body');body.append(el('strong','skill-name',st.skill.name));
   const base=(p.skills||[]).find(x=>x.id===st.skill.base);if(base)body.append(el('span','arma-base','강화: '+base.name));
   const d=el('p','skill-detail');skillText(d,st.skill.desc);body.append(d);card.append(body);info.append(card);
   info.append(el('p','arma-unlock',open(i)?'해금됨 · 레벨 '+(st.maxLv??(i+1)*10)+' 돌파':'레벨 '+(st.maxLv??(i+1)*10)+'에서 돌파'));
  }
 }
 wrap.append(stage,bar,info);draw();return wrap;
}
// ----- 프로필 -----
async function showDoll(key,{push=true,part=null}={}){
 const tok=++routeToken;showOnly('dollView');bgmLeave();voiceStop();closeArchiveMenu();
 if(push)saveRoute({type:'doll',id:key,part});
 const host=$('#dollView');host.replaceChildren(el('p','loading-note','프로필을 불러오는 중…'));window.scrollTo(0,0);
 try{loadDollIndex().catch(()=>{});let p=dollCache.get(key);if(!p){p=await fetchJSON(dataPath('profiles/'+encodeURIComponent(key)+'.json'));dollCache.set(key,p)}
  const [sk,am,stt]=await Promise.all([loadSkills().catch(()=>null),loadArma().catch(()=>null),loadStats().catch(()=>null),window.siteReady?.catch(()=>{}),loadDollIndex().catch(()=>null)]);if(stt&&!p.stats)p.stats=stt.heroes?.[String(p.heroId)]||null;if(sk&&!p.skills)p.skills=sk.heroes?.[String(p.heroId)]||null;if(am&&!p.arma)p.arma=am.heroes?.[String(p.heroId)]||null;
  if(tok!==routeToken)return;renderDoll(p,part)}
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
   // v1.5 이야기마다 접기 · 펼치기 (처음엔 모두 접힘, 위 버튼으로 모두)
   const arts=[];
   const allBtn=el('button','story-all');allBtn.type='button';
   const syncAll=()=>{const open=arts.every(a=>a.classList.contains('open'));allBtn.textContent=open?'모두 접기':'모두 펼치기'};
   allBtn.onclick=()=>{const open=!arts.every(a=>a.classList.contains('open'));arts.forEach(a=>{a.classList.toggle('open',open);a.querySelector('.doll-story-head').setAttribute('aria-expanded',String(open))});syncAll()};
   const bar=el('div','story-allbar');bar.append(allBtn);body.append(bar);
   p.infoStories.forEach((t,i)=>{const a=el('article','doll-story fold');const h=el('button','doll-story-head');h.type='button';h.setAttribute('aria-expanded','false');
    h.append(el('h4','','이야기 '+(i+1)));const lv=p.storyLevels?.[i];if(lv)h.append(el('span','voice-unlock','친밀도 '+lv));
    const pv=String(t||'').replace(/<[^>]+>/g,'').replace(/\s+/g,' ').trim();h.append(el('span','doll-story-peek',pv.length>70?pv.slice(0,70)+'…':pv),ic('right','tri'));
    h.onclick=()=>{const on=a.classList.toggle('open');h.setAttribute('aria-expanded',String(on));syncAll()};
    const bd=el('div','doll-story-fold');bd.append(sentenceBlock(t));a.append(h,bd);arts.push(a);body.append(a)});
   syncAll();
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
function renderDoll(p,startPart){
 const host=$('#dollView');host.replaceChildren();$('#crumb').textContent='인형 기록 · '+p.name;
 const back=el('button','folder-back');back.type='button';back.append(ic('left'),document.createTextNode(' 인형 목록'));back.onclick=()=>showDolls();host.append(back);
 // 1) 투영 + 기본 프로필 + 이력
 const hero=el('section','doll-hero');
 const proj=(p.projections||[]).map(x=>({img:x.img,title:x.name,tab:STAGE_NAME[x.stage]||'투영',desc:x.desc}));
 const artCol=el('div','doll-art-col');
 if(proj.length){artCol.append(el('p','load-note',LOAD_NOTE),gallery(p,proj,{label:'투영',tabs:true,cls:'gal-projection'}))}
 hero.append(artCol);
 const info=el('div','doll-info');
 // v1.7.4 게임 인형 번호 (#0410 = 고유 번호를 16진수 4자리로, 게임 UIGetHero 의 HeroIdTo4Hex 와 같음)
 {const hx=/^\d+$/.test(String(p.heroId??''))?'#'+(+p.heroId).toString(16).toUpperCase().padStart(4,'0'):'';
  info.append(el('div','eyebrow',[p.company,p.role,hx].filter(Boolean).join(' / ').toUpperCase()||'DOLL RECORD'))}
 const nameRow=el('div','doll-name-row');nameRow.append(el('h1','doll-name',p.name));
 if(p.alt?.key){const a=el('button','doll-alt');a.type='button';a.append(el('span','doll-alt-label','이격'),el('b','',p.alt.name||p.alt.key),ic('right'));a.setAttribute('aria-label',(p.alt.name||'')+' 프로필로 이동');a.onclick=()=>showDoll(p.alt.key);nameRow.append(a)}
 info.append(nameRow);
 // 전속 스토리로 바로 가기 (채운 2026-10-29, 기록 166) — 이격 버튼 아래 줄
 {const EXH={'exclusive:24winter':1080};const exs=(typeof displayGroups!=='undefined'?displayGroups:[]).filter(g=>g.category==='exclusive'&&String(g.doll?.heroId??EXH[g.id]??'')===String(p.heroId));
  if(exs.length){const row=el('div','doll-links');for(const g of exs){const b=el('button','doll-alt doll-ex');b.type='button';b.append(el('span','doll-alt-label','전속 스토리'),el('b','',chapterDisplayTitle(g)),ic('right'));b.onclick=()=>showChapter(groupKey(g),'exclusive');row.append(b)}info.append(row)}}
 if(p.fanTL)info.append(fanNote());
 {const di=(dollIndex?.dolls||[]).find(x=>x.heroId===p.heroId);const cl=classLine(di);if(cl)info.append(cl)}
 const sub=el('p','doll-sub');sub.append(starEl(p.stars));if(p.nameEn)sub.append(el('span','',p.nameEn));info.append(sub);
 const dl=el('dl','doll-facts');
 for(const [k,v] of [['클래스',p.role],['기업',p.company],['모델명',p.model],['직업',p.job],['생일',bdayText(p.birthday)],['성우',p.cv]]){if(!v)continue;dl.append(el('dt','',k),el('dd','',v))}
 info.append(dl);
 if(p.quote)info.append(el('blockquote','doll-quote',cleanTags(p.quote)));
 if(p.oathTitle?.length){const o=el('div','doll-oath');const top=el('div','doll-oath-top');top.append(el('span','doll-oath-label','서약 칭호'));const t=el('span','doll-oath-title');p.oathTitle.forEach((x,i)=>{if(i)t.append(el('i','doll-oath-sep'));t.append(el('span','',x))});top.append(t);o.append(top);if(p.oathDesc){o.append(el('hr','doll-oath-line'),el('p','doll-oath-desc',p.oathDesc))}info.append(o)}
 // v1.4 좋아함 · 싫어함 · 관계는 목차 「친밀도」 칸으로
 const affBox=el('div','doll-aff');
 const chips=(label,arr,kind)=>{if(!arr?.length)return;const w=el('div','doll-chips');w.append(el('span','doll-chips-label',label));arr.forEach(x=>{const c=el('span','doll-chip',x);c.dataset.item=x;w.append(c)});affBox.append(w);giftLinks(w,p.voiceKey,kind)};
 chips('좋아함',p.likes,0);chips('싫어함',p.dislikes,1);
 if(p.relations?.length){const w=el('div','doll-chips');w.append(el('span','doll-chips-label','관계'));for(const r of p.relations){const key=(dollIndex?.dolls||[]).find(d=>d.heroId===r.heroId)?.voiceKey;const c=el(key?'button':'span','doll-chip rel'+(key?' link':''));if(key){c.type='button';c.title=r.name+' 프로필로 이동';c.onclick=()=>showDoll(key)}c.append(el('b','',r.name),document.createTextNode(' '+String(r.text||'').replace(/^"|"$/g,'')));w.append(c)}affBox.append(w)}
 const car=el('div','doll-career');car.append(el('h4','',window.L?window.L('이력'):'이력'));car.append(p.career?sentenceBlock(p.career):el('p','doll-empty','한국어 번역 준비 중이에요.'));info.append(car);
 hero.append(info);
 // 2) v1.4 목차: 스킬 · 친밀도 · 보이스 · 스킨 — 누른 칸만 아래에 (마지막 선택 기억)
 const vc=(p.voices||[]).filter(v=>v.group!=='affinity').length+(p.skinVoices||[]).reduce((a,s)=>a+s.voices.length,0);
 const skins=(p.skinList||[]).map(x=>({img:x.img,title:x.name,desc:x.desc,photo:x.photo,photoName:x.photoName}));
 const parts=[];
 if(p.skills?.length&&typeof skillPanel==='function')parts.push(['skill','스킬',p.skills.length+'개',box=>box.append(skillPanel(p))]);
 if(p.arma?.steps?.length)parts.push(['arma','무장각인','',box=>box.append(armaPanel(p))]);
 parts.push(['affinity','친밀도','',box=>{if(affBox.childNodes.length)box.append(affBox);box.append(storyPanel(p))}]);
 if(vc)parts.push(['voice','보이스',vc+'개',box=>box.append(voicePanel(p))]);
 if(skins.length)parts.push(['skin','스킨',skins.length+'벌',box=>{box.append(el('p','load-note',LOAD_NOTE),gallery(p,skins,{label:'스킨',cls:'gal-skin'}))}]);
 if(p.stats?.cols?.length)parts.unshift(['stats','능력치','',box=>box.append(statsPanel(p))]);
 parts.unshift(['profile','프로필','',box=>box.append(hero)]);
 // 프로필 칸이 아닐 때 위에 작은 이름 줄
 const mini=el('div','doll-mini');mini.append(el('span','eyebrow',[p.company,p.role].filter(Boolean).join(' / ').toUpperCase()||'DOLL RECORD'),el('strong','doll-mini-name',p.name));
 const toc=el('section','doll-toc');const tb=el('div','tb-group doll-toc-bar');tb.append(el('div','tb-label','목차'));
 const nav=el('nav','cat-tabs doll-toc-tabs');nav.setAttribute('aria-label','목차');tb.append(nav);
 const body=el('div','doll-toc-body');toc.append(mini,tb,body);host.append(toc);
 let cur=parts.some(x=>x[0]===startPart)?startPart:'profile';
 const show=(id,push)=>{cur=id;voiceStop();
  if(push){const r=parseRoute();saveRoute({type:'doll',id:r.type==='doll'&&r.id?r.id:p.voiceKey,part:id})};
  nav.querySelectorAll('.cat-tab').forEach(b=>{const on=b.dataset.part===id;b.classList.toggle('selected',on);b.setAttribute('aria-pressed',String(on))});
  mini.hidden=id==='profile';
  body.replaceChildren();const part=parts.find(x=>x[0]===id);if(part)part[3](body);
  window.scrollTo(0,0)};
 for(const [id,name,n] of parts){const b=el('button','cat-tab doll-toc-tab');b.type='button';b.dataset.part=id;b.append(el('span','',name));if(n)b.append(el('span','wr-tab-n',n));b.onclick=()=>{if(id!==cur)show(id,true)};nav.append(b)}
 show(cur,false);
}
// 숙소 대화 회차: 목록(분류)에는 없지만 인형 프로필에서 열림 → 앞뒤 · 돌아가기를 그 인형 안에서
function dormFor(id){for(const g of index?.groups||[]){if(g.category!=='dorm')continue;const i=(g.episodes||[]).findIndex(e=>e.id===id);if(i>=0)return {g,i,e:g.episodes[i]}}return null}

applySettings();fetchJSON(dataPath('speakers.json')).then(m=>speakerAliases=m.aliases||{}).catch(()=>{});fetchJSON('./data/image_map.json',1).then(m=>{imageMap=m.portraits||m;const r=parseRoute();if(r.type==='home'&&!r.category&&document.querySelector('.bday-face'))drawLibrary()}).catch(()=>{});
// v0.9.2a: 느린 연결에서도 첫 화면이 비지 않게, 목록 데이터를 기다리지 않고 먼저 그린다
{const r=parseRoute();if(r.type==='home'&&!r.category){category=null;drawLibrary()}else{$('#groups').replaceChildren(el('p','loading-note','기록을 불러오는 중…'))}}
fetchJSON(dataPath('dolls.json')).then(d=>{dolls=d;if(index&&category==null&&!openFolderId&&!$('#search').value.trim()&&!$('#library').classList.contains('hidden'))drawLibrary()}).catch(()=>{dolls={dolls:[]}});
fetchJSON(dataPath('index.json')).then(d=>{initIndex(d);fillHeroTags();restoreRoute()}).catch(e=>$('#groups').append(error('데이터를 불러올 수 없습니다. data/'+dataLang()+'/index.json 위치를 확인하고 로컬 서버 또는 Cloudflare Pages에서 실행해 주세요. ('+e.message+')')));
})();