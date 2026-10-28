(() => {
const $=s=>document.querySelector(s), el=(tag,cls,text)=>{let n=document.createElement(tag);if(cls)n.className=cls;if(text!=null)n.textContent=text;return n};
// v0.9.5 아이콘: 모양 이미지를 글자색으로 칠함 (assets/icons)
const ic=(name,cls)=>{const i=el('i','ic ic-'+name+(cls?' '+cls:''));i.setAttribute('aria-hidden','true');return i};
const withIc=(name,text,cls)=>{const s=el('span',cls||'');s.append(ic(name),document.createTextNode(' '+text));return s};
const key='42lab.', get=(k,f)=>{try{let v=localStorage.getItem(key+k);return v===null?f:JSON.parse(v)}catch{return f}},set=(k,v)=>{try{localStorage.setItem(key+k,JSON.stringify(v));return true}catch{return false}};
let index=null,data=null,current='',positions=[],observer=null,active=0,category=null,flowNodes=[],cursor=0,choiceStates={},suspendObserve=false;
const nick=()=>get('nickname','교수')||'교수';
// ---------- v0.9.0 언어 기반 ----------
// 사이트가 실제로 가진 언어(data/<lang>/)만 사용한다. 준비 안 된 언어를 골라도 데이터는 ko로 읽는다.
const LANGS=[['ko','한국어'],['zh','中文'],['ja','日本語'],['en','English']];
let readyLangs=['ko'],siteInfo=null;
const uiLang=()=>{const v=get('lang','ko');return LANGS.some(([id])=>id===v)?v:'ko'};
const dataLang=()=>readyLangs.includes(uiLang())?uiLang():'ko';
const dataPath=p=>'./data/'+dataLang()+'/'+p;
document.documentElement.lang=dataLang();
// v0.9.1 밝기: 시스템(기본) · 라이트 · 딤 · 다크. 시스템이면 기기 설정을 계속 따라간다.
const BRIGHT=['light','dim','dark'];
const osDark=()=>matchMedia('(prefers-color-scheme: dark)').matches;
function brightnessMode(){const b=get('brightness',null);if(b)return b;const t=get('theme',null);return t?(BRIGHT.includes(t)?t:'custom'):'system'}
const currentTheme=()=>brightnessMode()==='system'?(osDark()?'dark':'light'):get('theme','dim');
const applySettings=()=>{const t=currentTheme();document.body.className=t;document.documentElement.style.setProperty('--fs',get('fontSize',16)+'px');document.documentElement.style.setProperty('--lh',get('lineHeight',160)/100);document.documentElement.style.setProperty('--letter-space',get('letterSpacing',0)+'px');document.documentElement.style.setProperty('--paragraph-gap',get('readingMode','accessible')==='accessible'?'12px':'0px');};

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
function episodeLabel(ep){const n=episodeNumber(ep);if(!n)return '';return ep.kind==='battleDialog'?'전투 '+n:ep.kind==='tutorial'?'튜토리얼 '+n:n}
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
 if(route.type==='chapter')return '#chapter/'+encodeURIComponent(route.category)+':'+encodeURIComponent(route.id);
 // v0.9.0: #home = 첫 화면(공지·일러스트·피드백), #home/<분류> = 그 분류의 스토리 목록 (#home/all = 전체 기록)
 return route.category?'#home/'+encodeURIComponent(route.category)+(route.shelf?'/'+encodeURIComponent(route.shelf):''):'#home';
}
function parseRoute(){
 let raw=location.hash.slice(1);
 try{
  if(raw.startsWith('ep/'))return {type:'episode',id:decodeURIComponent(raw.slice(3))};
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
function saveRoute(route){history.pushState({route},'',routeHash(route))}
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
 if(route.type==='chapter'&&showChapter(route.id,route.category,{push:false}))return;
 showHome(route.category||null,{push:false,shelf:route.shelf||null});
}
// A presentation-only shelf layout: no edits to Cherry's episode data or ordering.
// Explicit group metadata from a future index takes precedence over legacy title/key hints.
function shelfFor(g){const v=g.shelf;return typeof v==='string'&&v.trim()?v.trim():null}
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
  left.append(el('span','story-shelf-icon','▱'),el('h3','',label));
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
 if(!set('bookmarks',list))alert('브라우저 저장소를 사용할 수 없어 북마크를 저장하지 못했습니다. (시크릿 모드나 저장 차단 설정을 확인해 주세요)');
 updateBookmarkToggle();
}
function bookmarkRow(id,{at,last}={}){
 const found=findEpisode(id),row=el('div','bm-row'+(found?'':' missing'));
 const info=el('div','bm-info');
 if(found){
  const ctx=chapterDisplayTitle(found.g)+(episodeLabel(found.e)?' · '+episodeLabel(found.e):'');
  info.append(el('small','',ctx),el('strong','',episodeTitle(found.e)));
 }else info.append(el('small','','기록을 찾을 수 없음'),el('strong','','데이터에서 사라진 기록입니다'));
 if(at)info.append(el('span','bm-date',new Date(at).toLocaleDateString('ko-KR')+' 저장'));
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
function openUser(){renderQuick();$('#nickname').value=nick();selectUserPage('root');renderUserPanel();$('#userDialog').showModal()}

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
 $('#library').classList.remove('hidden');$('#reader').classList.add('hidden');bgmLeave();$('#crumb').textContent='';
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
  const back=el('button','folder-back');back.append(ic('left'),document.createTextNode(' '+(selected.g.shelfFolder?shelfFor(selected.g):'폴더 목록')));back.onclick=()=>showHome(category,{shelf:selected.g.shelfFolder?shelfFor(selected.g):null});host.append(back);
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
    if(x.g.shelfFolder){const k=shelfFor(x.g);let f=folders.get(k);if(!f){f={g:{id:'shelf:'+k,title:k,shelf:k,_folder:true,_count:0},episodes:[]};folders.set(k,f);items.push(f)}f.g._count++;f.episodes.push(...x.episodes)}
    else items.push(x);
   }
  }
  // Keep main story's chronology as a continuous list; group special stories into shelves.
  if(!openShelf&&items.some(x=>shelfFor(x.g))){
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
 const T=gameToday();
 const box=el('div','cal-box');const cards=el('div','bday-list');
 const draw=()=>{
  const v=new Date(Date.UTC(T.y,T.m-1+calShift,1)),Y=v.getUTCFullYear(),M=v.getUTCMonth()+1,mm=String(M).padStart(2,'0');
  const head=el('div','cal-head');
  const prev=el('button','cal-nav');prev.append(ic('left'));prev.type='button';prev.setAttribute('aria-label','이전 달');prev.onclick=()=>{calShift--;draw()};
  const next=el('button','cal-nav');next.append(ic('right'));next.type='button';next.setAttribute('aria-label','다음 달');next.onclick=()=>{calShift++;draw()};
  const title=el('button','cal-title',Y+'.'+mm);title.type='button';title.title='이번 달로';title.onclick=()=>{calShift=0;draw()};
  head.append(prev,title,next);
  const grid=el('div','cal-grid');['일','월','화','수','목','금','토'].forEach(w=>grid.append(el('span','cal-w',w)));
  const list=(dolls?.dolls||[]).filter(x=>x.birthday&&x.birthday.slice(0,2)===mm);
  const days=new Set(list.map(x=>+x.birthday.slice(2)));
  const first=v.getUTCDay(),last=new Date(Date.UTC(Y,M,0)).getUTCDate();
  for(let i=0;i<first;i++)grid.append(el('span','cal-d blank',''));
  for(let d=1;d<=last;d++){const c=el('span','cal-d'+(days.has(d)?' bday':'')+(calShift===0&&d===T.d?' today':''),String(d));if(days.has(d))c.title=list.filter(x=>+x.birthday.slice(2)===d).map(x=>x.name).join(', ');grid.append(c)}
  box.replaceChildren(head,grid);
 };
 draw();card.append(box);
 // 아래 카드는 오늘 생일인 인형만
 const key=String(T.m).padStart(2,'0')+String(T.d).padStart(2,'0');
 const todays=(dolls?.dolls||[]).filter(x=>x.birthday===key);
 if(!dolls)cards.append(el('p','bm-empty','생일 정보를 불러오는 중…'));
 else if(!todays.length)cards.append(el('p','bm-empty','오늘 생일인 인형이 없어요.'));
 for(const x of todays){
  const c=el('div','bday-card today');
  const face=el('div','avatar bday-face');const url=x.portrait&&(imageMap[x.portrait]||('./assets/portraits/'+x.portrait+'.webp'));
  if(x.portrait){const im=document.createElement('img');im.src=url;im.alt='';im.onerror=()=>{im.remove();face.classList.add('fallback')};face.append(im)}else face.classList.add('fallback');
  const t=el('div','bday-text');t.append(el('strong','',x.birthday+'. Happy Birthday!'),el('span','',x.name));
  c.append(face,t);cards.append(c);
 }
 card.append(cards,el('p','cal-note','매일 오전 5시(KST)에 갱신됩니다.'));
}
// Hierarchical navigation: category label navigates, chevron expands chapter links.
function closeArchiveMenu(){const menu=$('#archiveMenu');menu.classList.remove('open');menu.setAttribute('aria-hidden','true');$('#menuBtn').setAttribute('aria-expanded','false');$('#menuBtn').classList.remove('is-open')}
function renderArchiveMenu(){
 const host=$('#archiveMenuList');host.replaceChildren();
 const homeLink=el('button','archive-menu-link archive-menu-home','홈');homeLink.type='button';homeLink.onclick=()=>{closeArchiveMenu();$('#search').value='';showHome(null)};host.append(homeLink);
 for(const [id,name] of storyCategories.filter(([id])=>id!=='all')){
  const row=el('div','archive-menu-category');
  const line=el('div','archive-menu-line');
  const label=el('button','archive-menu-link',name);label.type='button';
  label.onclick=()=>{closeArchiveMenu();showHome(id)};
  const groups=displayGroups.filter(g=>categoryMatches(g,id));
  const children=el('div','archive-menu-children');const inner=el('div','archive-menu-children-inner');children.append(inner);
  const arrow=el('button','archive-menu-expand');arrow.type='button';arrow.append(ic('right','tri'));
  arrow.setAttribute('aria-label',name+' 챕터 펼치기');arrow.setAttribute('aria-expanded','false');
  arrow.onclick=()=>{const expanded=row.classList.toggle('expanded');arrow.setAttribute('aria-expanded',String(expanded))};
  for(const g of groups){const link=el('button','archive-menu-chapter',chapterDisplayTitle(g));link.type='button';link.onclick=()=>{closeArchiveMenu();showChapter(groupKey(g),id)};inner.append(link)}
  line.append(label,arrow);row.append(line,children);host.append(row);
 }
 const all=el('button','archive-menu-link archive-menu-all','전체 기록');all.onclick=()=>{closeArchiveMenu();showHome('all')};host.append(all);
}
$('#menuBtn').onclick=()=>{const menu=$('#archiveMenu');if(!menu.classList.contains('open')){renderArchiveMenu();menu.classList.add('open');menu.removeAttribute('aria-hidden');$('#menuBtn').setAttribute('aria-expanded','true');$('#menuBtn').classList.add('is-open')}else closeArchiveMenu()};
$('#archiveMenuClose').onclick=closeArchiveMenu;
$('#archiveMenuBackdrop').onclick=closeArchiveMenu;
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeArchiveMenu()});


function spans(parent,unit){
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
 const paths=[...(entry.stage?.characters||[]).map(x=>x.path),...(who.faces||[]).map(x=>x.path)].filter(Boolean);
 const speakerKey=who.heroId!=null?'hero:'+who.heroId:'name:'+(who.rawName||'');const portraitKey=speakerAliases[speakerKey];const ids=[portraitKey,speakerKey,String(who.heroId??''),who.rawName,who.name,...paths].filter(Boolean);
 let url=ids.map(k=>imageMap[k]).find(Boolean);
 if(url&&typeof url==='string'&&!url.startsWith('http')&&!url.startsWith('//')&&!url.startsWith('data:')){
  const img=document.createElement('img');img.loading='lazy';img.decoding='async';img.alt='';img.src=url.startsWith('/')?'.'+url:url.startsWith('./')?url:'./'+url.replace(/^\/+/, '');img.onerror=()=>{img.remove();av.classList.add('fallback')};av.append(img);
 }else av.classList.add('fallback');
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
     const button=el('button','option',opt.displayText||'선택 '+opt.index),slot=el('div','nested-output');
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
  const btn=el('button','option',opt.displayText||'선택 '+opt.index);controls.push(btn);box.append(btn);
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
 img.src='./assets/folder/'+(big?'':'s/')+slug+'.webp';img.onload=()=>node.classList.add('art-ready');img.onerror=()=>{img.remove();node.classList.remove('has-art')};
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
 if(!group||!ep)return {breadcrumb:'기록 열람',number:'',title:'기록 열람'};
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
  if(group.category!=='main'||hub||kindOf(ep)!=='story')return res;
  res.linear=true;
  const seq=flowOf(group),at=seq.findIndex(e=>e.id===id);
  res.prev=seq[at-1]?.id||null;res.next=seq[at+1]?.id||null;
  const mains=displayGroups.filter(g=>g.category==='main'),mi=mains.indexOf(group);
  if(!res.next&&mains[mi+1])res.next=flowOf(mains[mi+1])[0]?.id||null;
  if(!res.prev&&mains[mi-1]){const f=flowOf(mains[mi-1]);res.prev=f[f.length-1]?.id||null}
  return res;
 }
 return {prev:null,next:null,groupId:null,category:null,tab:null,linear:false};
}
function backToChapter(n){if(n.groupId){if(n.tab)chapterTabMemory.set(n.groupId,n.tab);showChapter(n.groupId,n.category)}else showHome(category)}
function updateEpisodeNav(){
 const n=episodeNeighbors(current);
 $('#prevEpisode').hidden=$('#nextEpisode').hidden=!n.linear;
 $('#prevEpisode').disabled=!n.prev;$('#nextEpisode').disabled=!n.next;
 $('#prevEpisode').onclick=()=>n.prev&&openEpisode(n.prev);$('#nextEpisode').onclick=()=>n.next&&openEpisode(n.next);
 $('#toLibrary').onclick=()=>backToChapter(n);
 // 메인 본편 끝: 이 회차 뒤에 나오는 전투 중 대사
 const host=$('#afterLinks');host.replaceChildren();
 if(n.linear){
  const g=displayGroups.find(x=>groupKey(x)===n.groupId);
  const battles=sortedEpisodes(g).filter(e=>e.kind==='battleDialog'&&e.follows===current);
  if(battles.length){host.append(el('p','after-head','이 회차의 전투 중 대사 '+battles.length+'편'));const row=el('div','after-row');
   for(const e of battles){const b=el('button','after-link');b.type='button';b.append(el('span','after-num','전투 '+episodeNumber(e)),el('span','',e.battle?.stageName||episodeTitle(e)));b.onclick=()=>openEpisode(e.id);row.append(b)}
   host.append(row)}
 }
}
async function openEpisode(id,{push=true}={}){
 const token=++routeToken;
 try{
  let d=await fetchJSON(dataPath('episodes/'+encodeURIComponent(id)+'.json'));
  if(token!==routeToken)return;
  data=d;current=id;
  $('#library').classList.add('hidden');$('#reader').classList.remove('hidden');
  const context=episodeDisplayContext(id);
  $('#epTitle').textContent=context.title;$('#epDesc').textContent=d.meta?.description||'';
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
 $('#library').classList.add('hidden');$('#reader').classList.remove('hidden');current=id;
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
$('#homeBtn').onclick=goHome;$('#back').onclick=()=>{const n=episodeNeighbors(current);if(n.groupId)backToChapter(n);else goHome()};$('#resumeBtn').onclick=resume;$('#userBtn').onclick=openUser;$('#userClose').onclick=()=>$('#userDialog').close();$('#userBack').onclick=()=>selectUserPage('root');document.querySelectorAll('[data-user-page]').forEach(b=>b.onclick=()=>selectUserPage(b.dataset.userPage));$('#bmToggle').onclick=()=>{if(current)toggleBookmark(current)};
// Settings: quick controls and independent subpages.
const settings=$('#settings');let settingsPage='root';
const fontValues={fontSize:[14,16,18,20,22,24],letterSpacing:[0,.5,1,1.5,2],lineHeight:[140,160,180,200]};
const themeNames={light:'라이트',dim:'딤',dark:'다크',persica:'페르시카',entropics:'엔트로피'};
function selectPage(page){settingsPage=page;$('#settingsRoot').hidden=page!=='root';$('#settingsFont').hidden=page!=='font';$('#settingsTheme').hidden=page!=='theme';$('#settingsBack').hidden=page==='root';$('#settingsTitle').textContent=page==='font'?'글꼴':page==='theme'?'테마':'설정';if(page==='theme')renderThemeList();if(page==='font')renderFontControls()}
function setTheme(t){set('theme',t);set('brightness',BRIGHT.includes(t)?t:'custom');applySettings();renderThemeList();renderQuick()}
function renderQuick(){const brightness=brightnessMode();document.querySelectorAll('[data-cg]').forEach(b=>b.classList.toggle('selected',cgMode()===b.dataset.cg));document.querySelectorAll('[data-prof]').forEach(b=>b.classList.toggle('selected',profGender()===b.dataset.prof));document.querySelectorAll('[data-brightness]').forEach(b=>b.classList.toggle('selected',b.dataset.brightness===brightness));const reading=get('readingMode','accessible');document.querySelectorAll('[data-reading]').forEach(b=>b.classList.toggle('selected',b.dataset.reading===reading))}
function renderFontControls(){let host=$('#fontControls');host.replaceChildren();for(const [field,values] of Object.entries(fontValues)){const wrap=el('div','setting-block');const title=el('strong','',field==='fontSize'?'글자 크기':field==='letterSpacing'?'자간':'줄 간격');wrap.append(title);const options=el('div','setting-options font-options');let current=get(field,field==='fontSize'?16:field==='letterSpacing'?0:160);for(let v of values){let label=field==='lineHeight'?(v/100).toFixed(1):v+(field==='fontSize'||field==='letterSpacing'?'px':'');let b=el('button',current===v?'selected':'',label);b.onclick=()=>{set(field,v);applySettings();renderFontControls()};options.append(b)}wrap.append(options);host.append(wrap)}$('#settingsFont').style.setProperty('--preview-size',get('fontSize',16)+'px');$('#settingsFont').style.setProperty('--preview-spacing',get('letterSpacing',0)+'px');$('#settingsFont').style.setProperty('--preview-line',get('lineHeight',160)/100)}
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
$('#viewMode').value=viewMode;$('#viewMode').onchange=e=>{viewMode=e.target.value;set('viewMode',viewMode);openFolderId=null;drawLibrary()};$('#search').oninput=()=>{openFolderId=null;let q=$('#search').value.trim().toLowerCase();let trigger=q==='entropics'?'entropics':(q==='2063.09.23'||q==='20630923')?'persica':null;if(trigger){$('#search').value='';runUnlock(trigger);return}drawLibrary()};
// Site notices (공지·업데이트·제보·저작권·개인정보) come from data/ko/site_info.json.
function renderFooter(info){
 const f=$('.site-footer');if(!f||!info)return;f.replaceChildren();
 const top=el('div','footer-line');(info.footer||[]).forEach(t=>top.append(el('p','',t)));f.append(top);
 const nav=el('nav','footer-links');nav.setAttribute('aria-label','사이트 안내');
 (info.pages||[]).forEach(pg=>{const b=el('button','footer-link',pg.title);b.type='button';b.onclick=()=>openInfo(pg);nav.append(b)});f.append(nav);
}
function openInfo(pg){
 const body=$('#infoBody');body.replaceChildren();$('#infoTitle').textContent=pg.title;
 for(const item of pg.items||[]){const box=el('section','info-item');if(item.title)box.append(el('h3','',item.title));(item.lines||[]).forEach(t=>box.append(el('p','',t)));body.append(box)}
 $('#infoDialog').showModal();
}
fetchJSON(dataPath('site_info.json')).then(info=>{siteInfo=info;fillHeroTags();renderSettingsFeedback();maybeWelcome();initBgm();if(Array.isArray(info.languages)&&info.languages.length)readyLangs=info.languages;renderFooter(info);if(index&&category==null&&!openFolderId&&!$('#search').value.trim()&&!$('#library').classList.contains('hidden'))drawLibrary()}).catch(()=>{});

// ---------- v0.9.3 소개 카드 태그 ----------
function fillHeroTags(){
 if(index){const n=(index.groups||[]).reduce((a,g)=>a+(g.episodes||[]).length,0);$('#tagRecords').textContent=n.toLocaleString('en-US')+' RECORDS'}
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
function maybeWelcome(){
 if(get('welcomed',false))return;
 const dlg=$('#welcome'),body=$('#welcomeBody');
 const step1=()=>{body.replaceChildren();
  body.append(el('div','setting-label','PROFESSOR'),el('p','welcome-q','교수님의 모습을 골라 주세요.'),el('p','setting-hint','이야기 속 교수 그림(일부 CG 포함)이 고른 모습으로 나옵니다. 사용자 창에서 언제든 바꿀 수 있어요.'));
  const row=el('div','setting-options welcome-pick');
  for(const [v,label] of [['f','여성 교수'],['m','남성 교수']]){const b=el('button','',label);b.type='button';b.onclick=()=>{set('profGender',v);step2()};row.append(b)}
  body.append(row)};
 const step2=()=>{body.replaceChildren();const n=sortedNotices()[0];
  body.append(el('div','setting-label','NOTICE'));
  if(n){body.append(el('h3','welcome-notice-title',n.title||''));(n.lines||[]).forEach(t=>body.append(el('p','welcome-line',t)))}
  const ok=el('button','welcome-ok','확인');ok.type='button';ok.onclick=()=>{set('welcomed',true);dlg.close()};body.append(ok)};
 step1();try{dlg.showModal()}catch(e){}
 dlg.addEventListener('cancel',e=>{e.preventDefault()});
}
// ---------- v0.9.3 BGM (곡 파일이 있는 곳에서만: Cloudflare) ----------
let bgmMarkStarted=false,bgmList=null,bgmCtx=null,bgmGain=null,bgmSrc=null,bgmPlaying=null,bgmEpisode=null,lastMark=null;const bgmBuf=new Map();
const bgmBase=()=>siteInfo?.home?.bgmBase||'./assets/bgm/';
const bgmTitle=c=>String(c||'').replace(/^Mus_/,'').replace(/_/g,' ');
function initBgm(){fetchJSON(bgmBase()+'bgm.json',1).then(m=>{bgmList=m;if(current&&!$('#reader').classList.contains('hidden'))setEpisodeBgm(bgmEpisode)}).catch(()=>{bgmList=null})}
function setEpisodeBgm(cue){bgmEpisode=cue;const bar=$('#bgmBar');const ok=!!(bgmList&&cue&&bgmList[cue]);bar.classList.toggle('hidden',!ok);if(ok){$('#bgmName').textContent=bgmTitle(cue);syncBgmBar()}}
function syncBgmBar(){const on=bgmPlaying&&bgmPlaying===bgmEpisode;$('#bgmPlay').replaceChildren(ic(on?'pause':'play'));$('#bgmPlay').dataset.state=on?'playing':'stopped';$('#bgmPlay').setAttribute('aria-label',on?'BGM 멈춤':'BGM 재생');$('#bgmNow').textContent=bgmPlaying&&bgmPlaying!==bgmEpisode?' · 지금: '+bgmTitle(bgmPlaying):'';document.querySelectorAll('.bgm-mark').forEach(m=>m.classList.toggle('playing',m.dataset.cue===bgmPlaying))}
const bgmVolume=()=>Math.max(0,Math.min(100,+get('bgmVolume',30)));
async function bgmPlay(cue){
 const info=bgmList?.[cue];if(!info)return;
 try{
  bgmCtx=bgmCtx||new (window.AudioContext||window.webkitAudioContext)();if(bgmCtx.state==='suspended')await bgmCtx.resume();
  if(!bgmGain){bgmGain=bgmCtx.createGain();bgmGain.connect(bgmCtx.destination)}
  bgmGain.gain.value=(bgmVolume()/100)**2;
  let buf=bgmBuf.get(cue);
  if(!buf){$('#bgmPlay').replaceChildren(el('span','bgm-wait','…'));const r=await fetch(bgmBase()+encodeURIComponent(info.file||cue+'.m4a'));if(!r.ok)throw Error('HTTP '+r.status);buf=await bgmCtx.decodeAudioData(await r.arrayBuffer());bgmBuf.set(cue,buf);if(bgmBuf.size>4)bgmBuf.delete(bgmBuf.keys().next().value)}
  if($('#reader').classList.contains('hidden'))return; // 곡을 받는 사이 회차 화면을 나갔으면 틀지 않음
  bgmStop(false);
  const src=bgmCtx.createBufferSource();src.buffer=buf;src.loop=true;
  const ls=+info.loopStart||0,le=+info.loopEnd||0;if(le>ls&&le<=buf.duration+.05){src.loopStart=ls;src.loopEnd=Math.min(le,buf.duration)}
  src.connect(bgmGain);src.start();bgmSrc=src;bgmPlaying=cue;
 }catch(e){bgmPlaying=null;$('#bgmNow').textContent=' · 재생할 수 없어요'}
 syncBgmBar();
}
// 회차 화면을 나가면(첫 화면 · 목록 · 챕터) 음악을 멈춤. 회차끼리 넘어갈 때는 계속
function bgmLeave(){if(bgmSrc||bgmPlaying)bgmStop()}
function bgmStop(sync=true){try{bgmSrc?.stop()}catch(e){}bgmSrc=null;if(sync){bgmPlaying=null;syncBgmBar()}}
$('#bgmPlay').onclick=()=>{if(bgmPlaying&&bgmPlaying===bgmEpisode)bgmStop();else bgmPlay(bgmEpisode)};

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
 if(!bgmList?.[node.bgm])return;
 const m=el('button','bgm-mark');m.append(ic('music'),document.createTextNode(' '+bgmTitle(node.bgm)));m.type='button';m.dataset.cue=node.bgm;m.onclick=()=>{if(bgmPlaying===node.bgm)bgmStop();else bgmPlay(node.bgm)};
 if(bgmPlaying===node.bgm)m.classList.add('playing');target.append(m);
}

applySettings();fetchJSON(dataPath('speakers.json')).then(m=>speakerAliases=m.aliases||{}).catch(()=>{});fetchJSON('./data/image_map.json',1).then(m=>{imageMap=m.portraits||m}).catch(()=>{});
// v0.9.2a: 느린 연결에서도 첫 화면이 비지 않게, 목록 데이터를 기다리지 않고 먼저 그린다
{const r=parseRoute();if(r.type==='home'&&!r.category){category=null;drawLibrary()}else{$('#groups').replaceChildren(el('p','loading-note','기록을 불러오는 중…'))}}
fetchJSON(dataPath('dolls.json')).then(d=>{dolls=d;if(index&&category==null&&!openFolderId&&!$('#search').value.trim()&&!$('#library').classList.contains('hidden'))drawLibrary()}).catch(()=>{dolls={dolls:[]}});
fetchJSON(dataPath('index.json')).then(d=>{initIndex(d);fillHeroTags();restoreRoute()}).catch(e=>$('#groups').append(error('데이터를 불러올 수 없습니다. data/'+dataLang()+'/index.json 위치를 확인하고 로컬 서버 또는 Cloudflare Pages에서 실행해 주세요. ('+e.message+')')));
})();