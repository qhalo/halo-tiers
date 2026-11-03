const TIERLIST_DISCORD = 'https://discord.gg/halotiers';
const API = 'https://api.artefact-studio.dev/api/v2';
const $ = id => document.getElementById(id);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const asset = path => '/img/reference/' + path;
const MODES = [
 ['overall','Overall','overall.svg',null],['vanilla','Vanilla','vanilla.svg','https://discord.gg/halotiers'],
 ['uhc','UHC','uhc.svg','https://discord.gg/halotiers'],['pot','Pot','pot.svg','https://discord.gg/halotiers'],
 ['nethop','NethPot','nethop.svg','https://discord.gg/halotiers'],['smp','SMP','smp.svg','https://discord.gg/halotiers'],
 ['sword','Sword','sword.svg','https://discord.gg/halotiers'],['axe','Axe','axe.svg','https://discord.gg/halotiers'],
 ['mace','Mace','mace.svg','https://discord.gg/halotiers'],['spear','Spear','spear.png','https://discord.gg/halotiers']
];
const TITLES = [
 {min:400,title:'Combat Grandmaster',file:'combat_grandmaster.webp',fg:'#fde047',bg:'#fde04733'},
 {min:250,title:'Combat Master',file:'combat_master.webp',fg:'#fde047',bg:'#fde04733'},
 {min:100,title:'Combat Ace',file:'combat_ace.webp',fg:'#fda4af',bg:'#f43f5e4d'},
 {min:50,title:'Combat Specialist',file:'combat_specialist.svg',fg:'#d8b4fe',bg:'#c084fc4d'},
 {min:20,title:'Combat Cadet',file:'combat_cadet.svg',fg:'#c4b5fd',bg:'#818cfb33'},
 {min:10,title:'Combat Novice',file:'combat_novice.svg',fg:'#c4b5fd',bg:'#a5b4fc33'},
 {min:1,title:'Rookie',file:'rookie.svg',fg:'#d1d5db',bg:'#6b72804d'},
 {min:0,title:'Unranked',file:'rookie.svg',fg:'#d1d5db',bg:'#6b72804d'}
];
const POINTS = {1:[60,45],2:[30,20],3:[10,6],4:[4,3],5:[2,1]};
const regionNames={NA:'North America',EU:'Europe',SA:'South America',AU:'Australia',ME:'Middle East',AS:'Asia',AF:'Africa','??':'Unknown'};
let modes={},current='overall',players=[],rankedPlayers=[],columns={},offset=0,busy=false,hasMore=true,requestId=0,profileId=0,infoTab='titles',contextPlayer=null,observer=null,toastTimer;
function randomizeTies(list) {
 const sorted=[...new Map(list.map(p=>[p.uuid,p])).values()].sort((a,b)=>b.points-a.points);
 for(let start=0;start<sorted.length;){
  let end=start+1;
  while(end<sorted.length&&sorted[end].points===sorted[start].points)end++;
  for(let i=end-1;i>start;i--){const j=start+Math.floor(Math.random()*(i-start+1));[sorted[i],sorted[j]]=[sorted[j],sorted[i]];}
  start=end;
 }
 return sorted.map((p,i)=>({...p,overall:i+1}));
}
const titleFor = points => TITLES.find(t=>points>=t.min)||TITLES.at(-1);
const modeTitle = key => modes[key]?.title || MODES.find(m=>m[0]===key)?.[1] || key;
const iconFor = key => MODES.find(m=>m[0]===key)?.[2] || 'vanilla.svg';
const isSafeURL = value => {try{return /^https?:$/.test(new URL(value).protocol)}catch{return false}};
async function api(path) {
 const response=await fetch(API+path,{signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw new Error(response.status===404?'Player not found.':'Please refresh the page. If the error persists, let a staff member know.');
 return response.json();
}
function skin(p,width=60,height=60,classes='') {
 return `<img class="skin ${classes}" src="https://render.crafty.gg/3d/bust/${encodeURIComponent(p.uuid)}" width="${width}" height="${height}" alt="${esc(p.name)}&#39;s Skin" loading="lazy" onerror="this.onerror=null;this.src='/img/reference/skin-404.avif'">`;
}
function effective(r) {return r.retired&&r.peak_tier!=null?{...r,tier:r.peak_tier,pos:r.peak_pos??r.pos}:r;}
function tierSlots(rankings={}) {
 const sorted=Object.entries(rankings).sort(([ka,a],[kb,b])=>Number(a.retired)-Number(b.retired)||a.tier-b.tier||a.pos-b.pos||MODES.findIndex(m=>m[0]===ka)-MODES.findIndex(m=>m[0]===kb));
 return Array.from({length:8},(_,i)=>{
  if(!sorted[i])return '<span class="w-10 h-14 flex flex-col items-center relative" aria-hidden="true"><span class="size-8 bg-black/20 rounded-full flex items-center justify-center overflow-clip border-2 border-slate-500/50 border-dashed p-1"></span><span class="absolute bottom-0.5 left-2/4 -translate-x-2/4 rounded-lg w-9 flex h-6 bg-slate-500/10 backdrop-blur-sm text-center text-muted-foreground text-sm items-center justify-center">-</span></span>';
  const [key,raw]=sorted[i],r=effective(raw),code=`${r.pos===0?'h':'l'}t${r.tier}`,bg=r.retired?'var(--placement-other)':`var(--${code})`,fg=`var(--${code}-foreground)`;
  const tooltip=`${r.retired?'Retired ':''}${r.pos===0?'HT':'LT'}${r.tier}\n${POINTS[r.tier]?.[r.pos]??0} points`;
  return `<span class="tier-tooltip" tabindex="0" aria-label="${esc(modeTitle(key)+': '+tooltip)}" data-tooltip="${esc(tooltip)}"><span class="w-10 h-14 relative flex flex-col items-center"><span class="size-8 bg-black/50 rounded-full flex items-center justify-center overflow-clip border-2 p-1" style="border-color:${bg}"><img src="${asset('tier_icons/'+iconFor(key))}" width="20" height="20" class="object-contain" alt="${esc(modeTitle(key))}"></span><strong class="absolute bottom-1 left-2/4 -translate-x-2/4 text-[14px] px-1 rounded-lg w-9 text-center" style="background:${bg};color:${fg}">${r.pos===0?'HT':'LT'}${r.tier}</strong></span></span>`;
 }).join('');
}
function region(p,mobile=false) {
 const key=/^(NA|EU|SA|AU|ME|AS|AF)$/.test(p.region)?p.region.toLowerCase():'';
 return `<div class="h-[78px] md:bg-slate-700/10 flex items-center justify-center px-4 mr-2 max-md:ml-auto max-md:mr-0 md:ml-auto ${mobile?'md:hidden':'max-md:hidden'}"><span class="size-10 p-2 text-xl rounded-md flex items-center justify-center font-extrabold" title="${esc(regionNames[p.region]||'Unknown')}" style="background:var(--${key},var(--muted));color:var(--${key}-foreground,var(--muted-foreground))">${esc(p.region||'??')}</span></div>`;
}
function overallRow(p,rank) {
 const title=titleFor(p.points);
 return `<div class="overall-row overall-player-hover-transition w-full h-20 relative duration-150 sm:hover:-translate-x-4 sm:active:scale-[.99] max-md:h-fit flex flex-col bg-accent/20 hover:bg-accent rounded-xl my-2 border-2 border-border" role="button" tabindex="0" aria-haspopup="dialog" aria-label="Open ${esc(p.name)} profile" data-profile="${esc(p.uuid)}"><div class="w-full flex gap-2 items-center h-[inherit] max-md:flex-col"><div class="w-full h-[inherit] flex gap-2 items-center"><div class="max-w-40 w-full h-14 flex items-center p-2 relative overflow-clip rounded-xs"><img src="${asset('placements/'+(rank<4?rank+'-shimmer.svg':'other.svg'))}" class="w-full absolute inset-0 h-full" alt="shimmer"><h1 class="text-4xl font-bold self-end italic absolute drop-shadow-[0px_3px_1px_#232323]">${rank}.</h1>${skin(p,60,60,'absolute right-7 drop-shadow-[-4px_-2px_1px_#00000077]')}</div><div class="w-72 truncate"><h2 class="text-2xl text-slate-300 font-bold truncate">${esc(p.name)}</h2><h3 class="flex gap-1 text-disabled"><img src="${asset('titles/'+title.file)}" class="object-contain" width="24" height="24" alt="${title.title} icon"><span class="truncate text-slate-400">${title.title} <span class="text-slate-600">(${Number(p.points)} points)</span></span></h3></div>${region(p,true)}</div><div class="ml-auto h-full flex w-fit max-md:flex max-md:flex-wrap max-md:justify-between max-md:w-full max-md:px-1 max-md:py-2">${region(p)}<div class="space-y-1 w-full h-[inherit] flex md:items-center justify-center flex-col px-2"><h2 class="overall_player__label">Tiers</h2><div class="overall_player__slots-wrapper max-sm:flex-wrap">${tierSlots(p.rankings)}</div></div></div></div></div>`;
}
function overallHead(){return '<div class="w-full flex gap-2 max-md:hidden font-bold uppercase px-4 text-muted"><span>#</span><span class="w-[196px] text-right inline-block">Player</span><span class="inline-block text-right ml-auto">Region</span><span class="w-[340px] text-center">Tiers</span></div><div class="w-full flex gap-2 md:hidden font-bold uppercase px-4 text-muted"><span>#</span><span class="w-[196px] text-right inline-block">Player</span><span class="ml-auto w-[84px] inline-block text-right">Region</span></div>';}
const arrows = high => `<svg viewBox="0 0 24 24" width="32" height="32" fill="currentColor" aria-hidden="true"><path d="M7.41 ${high?'15.41':'14.41'} 12 ${high?'10.83':'9.83'}l4.59 4.58L18 13l-6-6-6 6z"/>${high?'<path d="m6 18 1.41 1.41L12 14.83l4.59 4.58L18 18l-6-6z"/>':''}</svg>`;
function tierPlayer(p){const high=p.pos===0,key=/^(NA|EU|SA|AU|ME|AS|AF)$/.test(p.region)?p.region.toLowerCase():'';return `<button type="button" class="tier-entry relative w-full h-9 group flex gap-2 items-center overflow-clip mt-0.5 player-hover-transition-effect ${high?'bg-[var(--hightier)] hover:bg-[var(--hightier-hover)]':'bg-[var(--lowtier)] hover:bg-[var(--lowtier-hover)]'}" aria-label="Open ${esc(p.name)} profile" aria-haspopup="dialog" data-profile="${esc(p.uuid)}"><span class="w-0.5 h-full flex items-center overflow-clip justify-center group-hover:w-10 duration-200" style="border-left:2px solid var(--${key}-foreground,var(--muted-foreground));background:var(--${key},var(--muted))"><strong class="duration-100 opacity-0 group-hover:opacity-100 text-lg" style="color:var(--${key}-foreground,var(--muted-foreground))">${esc(p.region)}</strong></span>${skin(p,30,30,'bg-black/20 rounded-lg')}<span class="truncate">${esc(p.name)}</span><span class="ml-auto size-8 flex items-center justify-center p-0.5 ${high?'text-[var(--hightier-icon-foreground)] group-hover:text-[var(--hightier-icon-foreground-hover)]':'text-[var(--lowtier-icon-foreground)] group-hover:text-[var(--lowtier-icon-foreground-hover)]'}">${arrows(high)}</span></button>`;}
function render(){
 if(current==='overall'){
  $('results').innerHTML=overallHead()+players.map(p=>overallRow(p,p.overall)).join('');
 }else{
  const scroll=$('tier-scroll')?.scrollLeft||0;
  $('results').innerHTML=`<div id="tier-scroll" class="tier-scroll mt-4 overflow-hidden mb-6"><div class="tier-board min-w-[80rem] grid grid-cols-5 gap-2 pb-8">${[1,2,3,4,5].map(t=>`<div class="w-full"><div class="w-full h-14 text-center flex items-center justify-center gap-2 font-bold text-[26px] rounded-t-xl bg-[var(--fg)]" style="background-color:var(--tier-${t});color:var(--tier-${t}-foreground)" role="columnheader">${t<=3?`<img src="${asset('icons/tier_'+t+'.svg')}" class="object-contain" width="32" height="32" alt="${t} icon">`:''}Tier ${t}</div>${(columns[t]||[]).map(tierPlayer).join('')}</div>`).join('')}</div></div>`;
  $('tier-scroll').scrollLeft=scroll;enableDrag($('tier-scroll'));
 }
}
function renderSkeleton(){
 if(current==='overall')$('results').innerHTML=overallHead()+Array.from({length:10},()=>'<div class="w-full h-20 rounded-xl my-2 bg-accent/50 animate-pulse"></div>').join('');
 else{$('results').innerHTML=`<div class="mt-4 overflow-hidden mb-6"><div class="min-w-[80rem] grid grid-cols-5 gap-2 pb-8">${[1,2,3,4,5].map(t=>`<div><div class="w-full h-14 text-center flex items-center justify-center gap-2 font-bold text-[26px] rounded-t-xl" style="background:var(--tier-${t});color:var(--tier-${t}-foreground)">Tier ${t}</div>${Array.from({length:10},()=>'<div class="w-full h-8 rounded-none mt-1 bg-accent/50 animate-pulse"></div>').join('')}</div>`).join('')}</div></div>`;}
}
async function load(reset=false){
 if(!reset&&(busy||!hasMore))return;
 const id=++requestId,mode=current;
 if(reset){offset=0;players=[];columns={};hasMore=true;renderSkeleton();}
 busy=true;
 try{
  if(mode!=='overall'&&!modes[mode]){hasMore=false;render();return;}
  if(mode==='overall'){
   if(offset===0){
    const pages=await Promise.all([api('/mode/overall?from=0&count=50'),api('/mode/overall?from=50&count=50')]);
    if(id!==requestId)return;
    if(!pages.every(Array.isArray))throw new Error('Invalid rankings response.');
    rankedPlayers=randomizeTies(pages.flat()).slice(0,100);
   }
   players.push(...rankedPlayers.slice(offset,offset+10));
   hasMore=offset+10<rankedPlayers.length;
  }else{
   const data=await api(`/mode/${encodeURIComponent(mode)}?from=${offset}&count=10`);
   if(id!==requestId)return;
   for(const t of [1,2,3,4,5]){const seen=new Set((columns[t]||[]).map(p=>p.uuid));columns[t]=[...(columns[t]||[]),...(data[t]||[]).filter(p=>!seen.has(p.uuid))];}hasMore=Object.values(data).some(list=>list.length===10);
  }
  offset+=10;render();
 }catch(e){if(id===requestId){hasMore=false;$('results').innerHTML=`<div class="error-state"><h2 class="text-2xl font-bold">Error loading players</h2><p>${esc(e.message)}</p><button id="retry-rankings">Try again</button></div>`;}}
 finally{if(id===requestId){busy=false;observeMore();}}
}
function observeMore(){observer?.disconnect();if(!hasMore)return;observer=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting))load();},{rootMargin:'200px'});observer.observe($('load-sentinel'));}
function renderTabs(){
 $('mode-tabs').innerHTML=MODES.map(([id,name,icon])=>`<a href="/rankings/${id}" ${id===current?'aria-current="page"':''}><span class="w-28 h-fit duration-100 ${id===current?'bg-accent/50':'text-muted-foreground/40 hover:bg-accent/50 hover:text-accent-foreground active:bg-accent/20'} text-nowrap relative flex flex-col items-center justify-end rounded-t-3xl border-2 border-b-none border-border px-8 pt-1"><img src="${asset('tier_icons/'+icon)}" width="30" height="30" alt="${name}"><strong class="capitalize">${name}</strong>${id===current?'<span class="w-full h-0.5 bg-white block absolute bottom-0 left-0"></span>':''}</span></a>`).join('');
}
function route(){
 const path=location.pathname.split('/').filter(Boolean),hash=location.hash.slice(1),key=path[0]==='rankings'?path[1]||'overall':hash||'overall';
 current=MODES.some(m=>m[0]===key)||modes[key]?key:'overall';
 $('information-popover').hidden=true;$('information-toggle').setAttribute('aria-expanded','false');renderTabs();load(true);
}
function navigate(path){if(location.pathname!==path){history.pushState({},'',path);}route();}
async function profile(value,byName=false){
 const id=++profileId;$('profile-content').innerHTML='<div class="profile-inner"><button class="profile-close" data-close-profile aria-label="Close profile">×</button><div class="profile-loading"><span class="loading-spinner" aria-label="Loading profile"></span></div></div>';
 $('profile-modal').showModal();document.body.style.overflow='hidden';
 try{
  const p=await api(`/profile/${byName?'by-name/':''}${encodeURIComponent(value)}`);if(id!==profileId)return;
  const title=titleFor(p.points),rank=rankedPlayers.find(player=>player.uuid===p.uuid)?.overall||p.overall||0;
  $('profile-content').innerHTML=`<div class="profile-inner"><button class="profile-close" data-close-profile aria-label="Close profile">×</button><section class="w-full h-fit text-center py-2 flex items-center justify-center flex-col space-y-4"><span class="m-auto size-28 overflow-clip border-2 border-[var(--frame-color)] bg-slate-800 rounded-full flex items-center justify-center pt-3.5" style="border-color:var(--placement-${rank&&rank<=3?rank:'other'})">${skin(p,95,95)}</span><h1 class="text-3xl font-bold !bg-clip-text text-slate-300">${esc(p.name)}</h1><h2 class="flex gap-2 items-center justify-center text-muted font-medium text-lg px-3 py-1 rounded-full cursor-default" style="color:${title.fg};background:${title.bg}" title="${title.min?`Obtained ${title.min}+ total points.`:'Starting rank'}"><img src="${asset('titles/'+title.file)}" width="30" height="30" alt="Achievement Icon">${title.title}</h2><h3 class="text-xl font-bold text-muted">${esc(regionNames[p.region]||'Unknown')}</h3><a class="bg-secondary rounded-xl text-sm flex items-center p-2 gap-2 hover:bg-secondary/90 text-muted-foreground hover:text-secondary-foreground duration-100" href="https://namemc.com/profile/${encodeURIComponent(p.uuid)}" target="_blank" rel="noopener noreferrer"><span class="pr-1 flex items-center justify-center border-r-2 border-muted"><img src="${asset('icons/namemc.png')}" height="20" width="20" alt="NameMC" class="object-contain rounded-sm"></span><span class="flex gap-1 items-center">NameMC <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h6v6m0-6L10 14M9 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-4"/></svg></span></a></section><section class="w-full h-fit space-y-6"><div class="w-full space-y-2"><h2 class="text-2xl text-muted-foreground font-medium">POSITION</h2><div class="h-12 profile-box_styles"><div class="${rank>9999?'w-40':rank>99?'w-32':'w-24'} h-full flex p-2 items-center relative truncate"><img src="${asset('placements/'+(rank&&rank<4?rank+'-shimmer.svg':'other.svg'))}" class="absolute inset-0 size-full" alt="shimmer"><strong class="w-full font-bold text-4xl max-sm:text-3xl italic absolute truncate drop-shadow-[0px_3px_1px_#232323]" title="Overall placement">${rank}.</strong></div><div class="flex gap-2 items-center"><img src="${asset('tier_icons/overall.svg')}" width="26" height="26" alt="Overall"><strong class="text-2xl max-sm:text-xl">OVERALL</strong><span class="text-xl text-slate-400 font-medium max-sm:text-sm">(${Number(p.points)} points)</span></div></div></div><div class="w-full h-fit space-y-2"><h2 class="text-2xl text-muted-foreground font-medium">TIERS</h2><div class="profile-box_styles p-2">${tierSlots(p.rankings)}</div></div></section></div>`;
 }catch(e){if(id===profileId)$('profile-content').innerHTML=`<div class="profile-inner"><button class="profile-close" data-close-profile aria-label="Close profile">×</button><div class="error-state"><h2 class="text-2xl font-bold">${esc(e.message)}</h2><p>Search for a Minecraft username to view their profile.</p></div></div>`;}
}
function closeProfile(){hideTierTooltip();$('profile-modal').close();profileId++;document.body.style.overflow='';}
function renderDiscords(){
 $('discord-menu').innerHTML=MODES.filter(m=>m[0]!=='overall').map(([key,name,icon,url])=>{const link=TIERLIST_DISCORD;return `<a href="${esc(isSafeURL(link)?link:'https://discord.gg/halotiers')}" target="_blank" rel="noopener noreferrer"><img src="${asset('tier_icons/'+icon)}" alt="">${esc(name)}</a>`;}).join('');
 $('mobile-menu').innerHTML='<span class="p-2 text-muted flex">Home</span><a href="/rankings/overall">Rankings</a><a href="https://discord.gg/halotiers" target="_blank" rel="noopener noreferrer">Discords</a><a href="https://api.artefact-studio.dev/docs/v2" target="_blank" rel="noopener noreferrer">API Docs</a>';
}
function renderInformation(){
 const extra=current!=='overall';
 let body='';
 if(infoTab==='titles')body=`<h1 class="mb-4">How to obtain <u>Achievement Titles</u></h1><ul class="space-y-2">${TITLES.filter(t=>t.title!=='Unranked').map(t=>`<li class="text-muted-foreground items-center space-y-0.5"><span class="flex gap-1 items-center"><img src="${asset('titles/'+t.file)}" width="20" height="20" alt="title icon"><h1 class="text-sm" style="color:${t.fg}">${t.title}</h1></span><p class="text-xs text-muted-foreground">${t.title==='Rookie'?'Starting rank for players with less than 10 points.':`Obtained ${t.min}+ total points.`}</p></li>`).join('')}</ul>`;
 if(infoTab==='points')body=`<h1 class="mb-4">How <u>ranking points</u> are calculated</h1><ul class="space-y-2">${Object.entries(POINTS).map(([t,values])=>`<li style="--item-color:var(--tier-${t}-foreground)"><h2 class="flex gap-2 items-center text-[var(--item-color)]">${t<=3?`<img src="${asset('icons/tier_'+t+'.svg')}" width="20" height="20" alt="Trophy">`:''}Tier ${t}</h2><div class="pl-1 flex items-center gap-1 border-l-2 border-[var(--item-color)] ml-0.5">${values.map((v,i)=>`<span class="text-xs rounded-full py-1 flex w-22 items-center gap-0.5 px-1.5" style="color:var(--item-color);background:color-mix(in oklab,var(--item-color) ${i?10:20}%,transparent)" title="${i?'Low':'High'} Tier">${i?'⌃':'⌃⌃'} ${v} Point${v>1?'s':''}</span>`).join('')}</div></li>`).join('')}</ul>`;
 if(infoTab==='test'){const m=modes[current],url=TIERLIST_DISCORD;body=`<h1 class="mb-4">How to get <u>Tier Tested</u></h1><p class="text-sm text-muted-foreground">${esc(m?.info_text||'Join the gamemode Discord server to request a tier test.')}</p>${isSafeURL(url)?`<a class="flex items-center justify-center bg-blue-600 rounded-md p-2 mt-4" href="${esc(url)}" target="_blank" rel="noopener noreferrer">Join the Discord</a>`:''}`;}
 if(infoTab==='kit'){const image=modes[current]?.kit_image;body=`<h1 class="mb-4">Testing Kit</h1>${isSafeURL(image)?`<img src="${esc(image)}" alt="${esc(modeTitle(current))} testing kit" class="info-kit">`:'<p class="text-sm text-muted-foreground">No testing kit available.</p>'}`;}
 $('information-popover').innerHTML=`<div class="info-tabs" role="tablist">${[['titles','Titles'],['points','Points'],...(extra?[['test','Tier Test'],['kit','Testing Kit']]:[])].map(([key,label])=>`<button role="tab" aria-selected="${key===infoTab}" data-info-tab="${key}">${label}</button>`).join('')}</div><div role="tabpanel">${body}</div>`;
 positionInformation();
}
function positionInformation(){if($('information-popover').hidden)return;const b=$('information-toggle').getBoundingClientRect(),box=$('information-popover');box.style.left=`${Math.min(Math.max(12,b.left+b.width/2-160),window.innerWidth-332)}px`;box.style.top=`${Math.max(12,Math.min(b.bottom+4,window.innerHeight-box.offsetHeight-12))}px`;}
function toast(message){clearTimeout(toastTimer);$('toast').textContent=message;$('toast').hidden=false;toastTimer=setTimeout(()=>{$('toast').hidden=true;},2500);}
async function copy(text){try{await navigator.clipboard.writeText(text);toast('Copied to clipboard');}catch{toast('Unable to copy to clipboard.');}}
function enableDrag(el){let startX=0,startScroll=0,dragging=false,moved=false;
 el.addEventListener('pointerdown',e=>{if(e.button!==0||e.pointerType==='touch')return;startX=e.clientX;startScroll=el.scrollLeft;dragging=true;moved=false;});
 el.addEventListener('pointermove',e=>{if(!dragging)return;if(Math.abs(e.clientX-startX)>5){moved=true;el.classList.add('dragging');el.setPointerCapture(e.pointerId);el.scrollLeft=startScroll-(e.clientX-startX);}});
 const finish=()=>{dragging=false;el.classList.remove('dragging');};el.addEventListener('pointerup',finish);el.addEventListener('pointercancel',finish);el.addEventListener('pointerleave',()=>{if(!moved)finish();});el.addEventListener('click',e=>{if(moved){e.preventDefault();e.stopPropagation();moved=false;}},true);
}
document.addEventListener('click',e=>{
 const link=e.target.closest('a');if(link&&link.getAttribute('href')?.startsWith('/')&&!link.getAttribute('target')){e.preventDefault();navigate(link.getAttribute('href')==='/'?'/rankings/overall':link.getAttribute('href'));$('mobile-menu').hidden=true;}
 const p=e.target.closest('[data-profile]');if(p)profile(p.dataset.profile);
 if(e.target.closest('[data-close-profile]'))closeProfile();
 if(e.target.closest('#retry-rankings'))load(true);
 if(!e.target.closest('#discord-toggle')&&!e.target.closest('#discord-menu')){$('discord-menu').hidden=true;$('discord-toggle').setAttribute('aria-expanded','false');}
 if(!e.target.closest('#information-toggle')&&!e.target.closest('#information-popover')){$('information-popover').hidden=true;$('information-toggle').setAttribute('aria-expanded','false');}
 if(!e.target.closest('#context-menu'))$('context-menu').hidden=true;
});
$('results').addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.matches('[data-profile]')){e.preventDefault();profile(e.target.dataset.profile);}});
$('results').addEventListener('contextmenu',e=>{const row=e.target.closest('[data-profile]');if(!row||current!=='overall')return;contextPlayer=players.find(p=>p.uuid===row.dataset.profile);if(!contextPlayer)return;e.preventDefault();$('context-menu').innerHTML=`<h2>${esc(contextPlayer.name)}</h2><button data-copy="uuid">♧ &nbsp;Copy UUID</button><button data-copy="name"># &nbsp;Copy Username</button><button data-copy="tiers">▤ &nbsp;Copy Tiers</button>`;$('context-menu').hidden=false;$('context-menu').style.left=`${Math.min(e.clientX,window.innerWidth-200)}px`;$('context-menu').style.top=`${Math.min(e.clientY,window.innerHeight-160)}px`;});
$('context-menu').addEventListener('click',e=>{const b=e.target.closest('[data-copy]');if(!b||!contextPlayer)return;let text=contextPlayer[b.dataset.copy];if(b.dataset.copy==='tiers')text=`Title: ${titleFor(contextPlayer.points).title} (${contextPlayer.points} points)\n`+Object.entries(contextPlayer.rankings||{}).map(([key,raw])=>{const r=effective(raw);return `${modeTitle(key)}: ${r.retired?'Retired ':''}${r.pos===0?'HT':'LT'}${r.tier} (${POINTS[r.tier]?.[r.pos]??0} points)`}).join('\n');copy(text);$('context-menu').hidden=true;});
$('search-player-input').addEventListener('keydown',e=>{if(e.key==='Enter'){const q=e.target.value.trim();if(q){profile(q.replace(/-/g,''),q.length<=16);e.target.blur();}}});
document.addEventListener('keydown',e=>{if(e.key==='/'&&!['INPUT','TEXTAREA'].includes(document.activeElement.tagName)&&!$('profile-modal').open){e.preventDefault();$('search-player-input').focus();}if(e.key==='Escape'){$('information-popover').hidden=true;$('discord-menu').hidden=true;$('context-menu').hidden=true;$('mobile-menu').hidden=true;}});
$('profile-modal').addEventListener('click',e=>{if(e.target===$('profile-modal')){const b=$('profile-modal').getBoundingClientRect();if(e.clientX<b.left||e.clientX>b.right||e.clientY<b.top||e.clientY>b.bottom)closeProfile();}});
$('profile-modal').addEventListener('close',()=>{profileId++;document.body.style.overflow='';});
$('copy-server').addEventListener('click',()=>copy('vanillapvp.club'));
$('discord-toggle').addEventListener('click',()=>{$('discord-menu').hidden=!$('discord-menu').hidden;$('discord-toggle').setAttribute('aria-expanded',String(!$('discord-menu').hidden));});
$('mobile-toggle').addEventListener('click',()=>{$('mobile-menu').hidden=!$('mobile-menu').hidden;$('mobile-toggle').setAttribute('aria-expanded',String(!$('mobile-menu').hidden));});
$('information-toggle').addEventListener('click',()=>{const show=$('information-popover').hidden;$('information-popover').hidden=!show;$('information-toggle').setAttribute('aria-expanded',String(show));if(show){infoTab='titles';renderInformation();}});
$('information-popover').addEventListener('click',e=>{const tab=e.target.closest('[data-info-tab]');if(tab){infoTab=tab.dataset.infoTab;renderInformation();}});
window.addEventListener('resize',positionInformation);window.addEventListener('scroll',positionInformation,{passive:true});window.addEventListener('popstate',route);window.addEventListener('hashchange',route);
(async()=>{try{modes=await api('/mode/list');for(const [key,m] of Object.entries(modes)){if(!MODES.some(v=>v[0]===key))MODES.push([key,m.title,'vanilla.svg',TIERLIST_DISCORD]);}renderDiscords();route();}catch{renderDiscords();route();}})();

// A top-layer tooltip avoids clipping inside both scroll boxes and modal dialogs.
const tierHoverCard=document.createElement('div');
tierHoverCard.id='tier-hover-card';
tierHoverCard.className='tier-hover-card';
const tierPopoverSupported=typeof tierHoverCard.showPopover==='function';
if(tierPopoverSupported)tierHoverCard.setAttribute('popover','manual');
tierHoverCard.hidden=true;
tierHoverCard.setAttribute('role','tooltip');
document.body.append(tierHoverCard);
let tierHoverTarget=null,tierHoverFrame,tierHoverCloseTimer;
function hideTierTooltip(immediate=false){
 if(tierHoverTarget)tierHoverTarget.removeAttribute('aria-describedby');
 tierHoverTarget=null;cancelAnimationFrame(tierHoverFrame);
 clearTimeout(tierHoverCloseTimer);
 const finish=()=>{
  if(tierPopoverSupported&&tierHoverCard.matches(':popover-open'))tierHoverCard.hidePopover();
  tierHoverCard.hidden=true;
  delete tierHoverCard.dataset.state;
 };
 if(immediate===true||tierHoverCard.hidden||matchMedia('(prefers-reduced-motion: reduce)').matches){finish();return;}
 tierHoverCard.dataset.state='closed';
 tierHoverCloseTimer=setTimeout(finish,140);
}
function positionTierTooltip(){
 if(!tierHoverTarget?.isConnected){hideTierTooltip();return;}
 const b=tierHoverTarget.getBoundingClientRect(),w=tierHoverCard.offsetWidth,h=tierHoverCard.offsetHeight;
 const below=b.top<h+8;
 const left=Math.max(8,Math.min(b.left+b.width/2-w/2,innerWidth-w-8));
 tierHoverCard.dataset.side=below?'bottom':'top';
 tierHoverCard.style.left=left+'px';
 tierHoverCard.style.top=Math.max(8,Math.min(below?b.bottom+6:b.top-h-6,innerHeight-h-8))+'px';
 tierHoverCard.style.setProperty('--tooltip-arrow',Math.max(10,Math.min(w-10,b.left+b.width/2-left))+'px');
 tierHoverFrame=requestAnimationFrame(positionTierTooltip);
}
function showTierTooltip(target){
 if(tierHoverTarget===target)return;
 hideTierTooltip(true);tierHoverTarget=target;
 const [title,points]=target.dataset.tooltip.split('\n');
 const heading=document.createElement('strong'),detail=document.createElement('span');
 heading.textContent=title;detail.textContent=points;
 tierHoverCard.replaceChildren(heading,detail);
 target.setAttribute('aria-describedby',tierHoverCard.id);
 // Keep the fallback inside the modal so it remains above its backdrop.
 if(!tierPopoverSupported)(target.closest('dialog')||document.body).append(tierHoverCard);
 tierHoverCard.hidden=false;
 if(tierPopoverSupported)tierHoverCard.showPopover();
 positionTierTooltip();
}
document.addEventListener('pointerover',e=>{const target=e.target.closest('.tier-tooltip');if(target&&e.pointerType!=='touch')showTierTooltip(target);});
// Scrolling or a results refresh can dismiss a tooltip without another pointerover.
document.addEventListener('pointermove',e=>{const target=e.target.closest('.tier-tooltip');if(target&&e.pointerType!=='touch')showTierTooltip(target);});
document.addEventListener('pointerout',e=>{if(tierHoverTarget?.contains(e.target)&&!tierHoverTarget.contains(e.relatedTarget))hideTierTooltip();});
document.addEventListener('focusin',e=>{const target=e.target.closest('.tier-tooltip');if(target)showTierTooltip(target);});
document.addEventListener('focusout',e=>{if(tierHoverTarget?.contains(e.target))hideTierTooltip();});
document.addEventListener('pointerdown',hideTierTooltip);
document.addEventListener('keydown',e=>{if(e.key==='Escape')hideTierTooltip();});
window.addEventListener('scroll',hideTierTooltip,true);
window.addEventListener('resize',hideTierTooltip);
$('profile-modal').addEventListener('close',hideTierTooltip);
