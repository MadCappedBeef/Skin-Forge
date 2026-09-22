"use strict";
(() => {
 const hub=document.querySelector('#community'),editor=document.querySelector('#top'),status=document.querySelector('#community-status');
 const list=document.querySelector('#community-list'),more=document.querySelector('#community-more');
 let user=null,catalog=[],next=null,loading=0,mutating=false;
 let closePreview=null,communityPaused=false;
 const node=(tag,text,className)=>{const element=document.createElement(tag);if(text!==undefined)element.textContent=text;if(className)element.className=className;return element;};
 const button=(text,action)=>{const element=node('button',text,'button button-quiet');element.type='button';element.addEventListener('click',action);return element;};
 const profiles=new Map();
 function steamIdentity(id){
  const link=node('a',undefined,'steam-identity');link.href='https://steamcommunity.com/profiles/'+id;link.target='_blank';link.rel='noopener noreferrer';link.title='Steam '+id;
  const icon=node('span','S','steam-avatar steam-avatar-fallback'),name=node('span','Steam '+id);link.append(icon,name);
  if(!profiles.has(id))profiles.set(id,api('/profile/'+id).catch(()=>null));
  profiles.get(id).then(profile=>{
   if(!profile)return;name.textContent=profile.name;
   if(profile.avatar){const image=node('img',undefined,'steam-avatar');image.alt='';image.width=32;image.height=32;image.referrerPolicy='no-referrer';image.addEventListener('error',()=>image.replaceWith(icon),{once:true});image.src=profile.avatar;icon.replaceWith(image);}
  });
  return link;
 }
 async function api(path,body){
  const response=await fetch('/api/community'+path,{...(body?{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':user?.csrf||''},body:JSON.stringify(body)}:{})});
  const result=await response.json().catch(()=>({message:'Community service is unavailable.'}));
  if(!response.ok)throw Error(result.message||'Request failed.');return result;
 }
 function tab(community){
  if(closePreview)closePreview();
  hub.hidden=!community;editor.hidden=community;
  document.querySelector('#community-tab').setAttribute('aria-pressed',String(community));document.querySelector('#editor-tab').setAttribute('aria-pressed',String(!community));
  if(community){window.history.replaceState(null,'','#community');document.querySelector('#community-current-species').textContent='Species: '+(document.querySelector('#viewer-species').selectedOptions[0]?.textContent||'Choose a species in the editor first.');refresh();}
  else window.history.replaceState(null,'','#top');
 }
 async function refresh(){
  try{
   const account=await api('/me');user=account.user;communityPaused=!!account.paused;
   document.querySelector('#community-database-control').hidden=!(user?.owner||account.canResume);
   document.querySelector('#community-database-toggle').textContent=communityPaused?'Resume community':'Pause community';
   document.querySelector('#community-database-note').textContent=communityPaused?'Database access is paused. Resume here using this browser within seven days, or use Cloudflare recovery.':'Pause community browsing, sign-ins and submissions to stop new database queries. Saved skins remain intact. The editor and viewer stay available.';
   if(communityPaused){
    loading++;if(closePreview)closePreview();list.replaceChildren();more.hidden=true;
    for(const id of ['community-login','community-logout','community-publish','community-admin','community-admin-filter'])document.querySelector('#'+id).hidden=true;
    document.querySelector('#community-user').replaceChildren();
    status.textContent='Community skins are temporarily paused. The skin editor and 3D viewer are still available.';return;
   }
   document.querySelector('#community-login').hidden=!!user;
   document.querySelector('#community-logout').hidden=!user;
   const accountDisplay=document.querySelector('#community-user');accountDisplay.replaceChildren();
   if(user){accountDisplay.append(steamIdentity(user.steamId));const role=user.owner?'Owner':user.admin?'Admin':user.banned?'Banned':'';if(role)accountDisplay.append(node('span',role,'community-role'));}
   document.querySelector('#community-publish').hidden=!user||user.banned;
   document.querySelector('#community-admin').hidden=!user?.admin;
   document.querySelector('#community-admin-filter').hidden=!user?.admin;
   if(!user?.admin)document.querySelector('#community-show-hidden').checked=false;
   const actions=document.querySelector('#community-user-action');for(const option of [...actions.options])if(['promote','demote'].includes(option.value))option.remove();
   if(user?.owner){actions.add(new Option('Grant admin access','promote'));actions.add(new Option('Remove admin access','demote'));}
   await load();if(user?.admin)await loadAdmin();
  }catch(error){status.textContent=error.message;}
 }
 async function load(append=false){
  const generation=++loading;status.textContent='Loading community skins...';more.disabled=true;
  const params=new URLSearchParams({offset:String(append?next||0:0),q:document.querySelector('#community-query').value,species:document.querySelector('#community-species').value,glitch:document.querySelector('#community-glitch').value});
  if(user?.admin&&document.querySelector('#community-show-hidden').checked)params.set('admin','1');
  try{
   const result=await api('/skins?'+params);if(generation!==loading)return;
   if(!append){if(closePreview)closePreview();list.replaceChildren();}
   for(const item of result.skins)list.append(card(item));
   next=result.next;more.hidden=next===null;
   status.textContent=list.children.length?'':'No skins found. Be the first to share one!';
  }catch(error){if(generation===loading)status.textContent=error.message;}
  finally{if(generation===loading)more.disabled=false;}
 }
 function view(item){
  commit(item.skin,'Community skin loaded.');elements.skinName.value=item.title;scheduleSave();
  const species=document.querySelector('#viewer-species');
  if([...species.options].some(option=>option.value===item.species&&!option.disabled)){species.value=item.species;species.dispatchEvent(new Event('change'));}
  else toast('The skin loaded, but this species is unavailable in the viewer.',true);
  tab(false);document.querySelector('.viewer-panel').scrollIntoView({behavior:'smooth'});
 }
 function card(item){
  const card=node('article',undefined,'panel community-card');card.append(node('h3',item.title));
  if(item.glitched){const badge=node('span','Glitched','community-glitch-badge');badge.title='Contains colour values outside 0?1. View in-game to see glitch effects.';card.append(badge);}
  card.append(node('p',(catalog.find(entry=>entry.id===item.species)?.name||item.species)+' · '+new Date(item.createdAt*1000).toLocaleDateString()));
  card.append(steamIdentity(item.steamId));
  if(item.hidden||item.accountHidden)card.append(node('p','Hidden'+(item.accountHidden?' by account moderation':'')+(item.reason?': '+item.reason:'')));
  const preview=node('div',undefined,'community-preview');
  const launch=button('Preview in 3D',()=>{
   if(closePreview)closePreview();
   const frame=document.createElement('iframe');frame.title=item.title+' ? interactive 3D preview';frame.src='SkinViewer/mini.html';
   frame.addEventListener('load',()=>frame.contentWindow?.postMessage({type:'skinforge:mini',species:item.species,skin:item.skin},location.origin));
   const close=button('Close preview',()=>closePreview?.());
   preview.replaceChildren(frame,close);
   closePreview=()=>{preview.replaceChildren(launch);closePreview=null;};
  });
  preview.append(launch);card.append(preview);
  const colours=node('div',undefined,'community-swatches');for(const field of COLOUR_FIELDS){const swatch=node('span');const value=item.skin[field.key];swatch.style.backgroundColor='rgb('+RGB_CHANNELS.map(channel=>Math.round(Math.min(1,Math.max(0,value[channel]))*255)).join(',')+')';swatch.title=field.label;colours.append(swatch);}card.append(colours);
  const actions=node('div',undefined,'community-actions');actions.append(button('View / use skin',()=>view(item)));
  if(user&&!user.banned)actions.append(button('Report',()=>{const reason=prompt('Why are you reporting this skin?');if(reason?.trim())mutate('/report',{id:item.id,reason});}));
  if(user?.steamId===item.steamId&&!item.hidden)actions.append(button('Remove my skin',()=>{if(confirm('Remove this skin from the community gallery?'))mutate('/remove',{id:item.id});}));
  if(user?.admin&&(user.steamId!==item.steamId||item.hidden))actions.append(button(item.hidden?'Restore':'Remove',()=>moderate(item.hidden?'restore':'hide',item.id)));
  if(user?.admin){actions.append(button('Rename',()=>{const name=prompt('New skin name',item.title);if(name?.trim())moderate('rename',item.id,{title:name});}));actions.append(button('Ban user',()=>moderate('ban',item.steamId)));actions.append(button('Ban + hide all',()=>moderate('ban-all',item.steamId)));}
  card.append(actions);return card;
 }
 async function mutate(path,body){
  if(mutating)return;mutating=true;status.textContent='Saving...';
  try{const result=await api(path,body);await refresh();status.textContent=result.message||'Saved.';return true;}catch(error){status.textContent=error.message;return false;}finally{mutating=false;}
 }
 function moderate(action,id,extra={}){const reason=prompt('Reason for this action (recorded in moderation history):');if(reason?.trim())mutate('/moderate',{action,id,reason,...extra});}
 async function loadAdmin(){
  const result=await api('/admin');
  const reports=document.querySelector('#community-reports');reports.replaceChildren();
  if(!result.reports.length)reports.append(node('p','No open reports.'));
  for(const report of result.reports){const row=node('div',undefined,'community-admin-row');row.append(node('strong',report.title),node('p',report.reason+' — reported by '+report.steam_id));const actions=node('div',undefined,'community-actions');actions.append(button('Find skin',()=>{document.querySelector('#community-query').value=report.title;document.querySelector('#community-species').value='';document.querySelector('#community-show-hidden').checked=true;document.querySelector('#community-glitch').value='';load();list.scrollIntoView();}),button('Remove skin',()=>moderate('hide',report.skin_id)),button('Ban + hide all',()=>moderate('ban-all',report.author_id)),button('Resolve report',()=>moderate('resolve',report.id)));row.append(actions);reports.append(row);}
  const users=document.querySelector('#community-users');users.replaceChildren();
  if(!result.users.length)users.append(node('p','No banned users or additional admins.'));
  for(const account of result.users){const row=node('div',undefined,'community-admin-row');row.append(node('p',account.steam_id+(account.is_admin?' · Admin':'')+(account.banned?' · Banned':'')+(account.hide_skins?' · Skins hidden':'')+(account.ban_reason?' · '+account.ban_reason:'')));const actions=node('div',undefined,'community-actions');if(account.banned)actions.append(button('Unban',()=>moderate('unban',account.steam_id)));if(account.hide_skins)actions.append(button('Restore account skins',()=>moderate('restore-user',account.steam_id)));if(user.owner&&account.is_admin)actions.append(button('Remove admin',()=>moderate('demote',account.steam_id)));row.append(actions);users.append(row);}
  const audit=document.querySelector('#community-audit');audit.replaceChildren();for(const entry of result.audit)audit.append(node('p',`${new Date(entry.created_at*1000).toLocaleString()} · ${entry.admin_id} · ${entry.action} · ${entry.target} · ${entry.reason}`));
 }
 const shareDialog=document.querySelector('#quick-share-dialog'),shareForm=document.querySelector('#quick-share-form'),shareStatus=document.querySelector('#quick-share-status'),shareLogin=document.querySelector('#quick-share-login');
 let shareSkin=null,sharing=false,shareGeneration=0;
 document.querySelector('#viewer-share').addEventListener('click',async()=>{
  const species=document.querySelector('#viewer-species');
  if(!species.value||species.selectedOptions[0]?.disabled){toast('Choose an available species first.',true);return;}
  const generation=++shareGeneration;
  shareSkin={species:species.value,skin:snapshot()};
  document.querySelector('#quick-share-name').value=elements.skinName.value.trim().slice(0,80);
  document.querySelector('#quick-share-species').textContent=species.selectedOptions[0].textContent;
  document.querySelector('#quick-share-gallery').hidden=true;delete shareStatus.dataset.state;
  shareForm.hidden=true;shareLogin.hidden=true;shareStatus.textContent='Checking Steam sign-in...';shareDialog.showModal();
  try{
   const account=await api('/me');if(generation!==shareGeneration)return;user=account.user;
   if(account.paused){shareLogin.hidden=true;shareForm.hidden=true;shareStatus.textContent='Community sharing is temporarily paused.';return;}
   shareLogin.hidden=!!user;shareForm.hidden=!user||user.banned;
   shareStatus.textContent=!user?'Sign in, then return to the live preview and press Share skin. Your skin stays saved in this browser.':user.banned?'Your account cannot publish community skins.':'';
   if(user&&!user.banned)document.querySelector('#quick-share-name').focus();
  }catch(error){if(generation===shareGeneration)shareStatus.textContent=error.message;}
 });
 document.querySelector('#quick-share-gallery').addEventListener('click',()=>{shareDialog.close();tab(true);hub.scrollIntoView({behavior:'smooth'});});
 shareDialog.addEventListener('cancel',event=>{if(sharing)event.preventDefault();});
 shareDialog.addEventListener('close',()=>{shareGeneration++;});
 shareForm.addEventListener('submit',async event=>{
  event.preventDefault();if(sharing||!shareSkin)return;sharing=true;
  const buttons=[...shareDialog.querySelectorAll('button')];buttons.forEach(button=>button.disabled=true);shareStatus.textContent='Publishing skin...';
  try{
   await api('/skins',{...shareSkin,title:document.querySelector('#quick-share-name').value});
   shareForm.hidden=true;shareSkin=null;shareStatus.dataset.state='success';shareStatus.textContent='Skin published! Your creation is now in the community gallery.';document.querySelector('#quick-share-gallery').hidden=false;toast('Skin shared to the community.');
  }catch(error){shareStatus.dataset.state='error';shareStatus.textContent=error.message;}finally{sharing=false;buttons.forEach(button=>button.disabled=false);}
 });
 document.querySelector('#community-database-toggle').addEventListener('click',async event=>{
  if(!confirm(communityPaused?'Resume community database access?':'Pause all community database access? Resume using this browser within seven days. After that, use Cloudflare recovery.'))return;
  const button=event.currentTarget;button.disabled=true;
  try{
   const response=await fetch('/api/community/control',{method:'POST',headers:{'X-SkinForge-Control':'1','X-SkinForge-State':communityPaused?'resume':'pause','X-CSRF-Token':user?.csrf||''}});
   const result=await response.json();if(!response.ok)throw Error(result.message);await refresh();status.textContent=result.message;
  }catch(error){status.textContent=error.message;}finally{button.disabled=false;}
 });
 document.querySelector('#editor-tab').addEventListener('click',()=>tab(false));document.querySelector('#community-tab').addEventListener('click',()=>tab(true));
 document.querySelector('#community-glitch').addEventListener('change',()=>load());
 document.querySelector('#community-search').addEventListener('submit',event=>{event.preventDefault();load();});document.querySelector('#community-show-hidden').addEventListener('change',()=>load());more.addEventListener('click',()=>load(true));
 document.querySelector('#community-logout').addEventListener('click',async()=>{if(await mutate('/logout',{}))document.querySelector('#community-publish').open=false;});
 document.querySelector('#community-publish-form').addEventListener('submit',async event=>{event.preventDefault();const submit=event.submitter||event.target.querySelector('button[type="submit"]');submit.disabled=true;try{const ok=await mutate('/skins',{title:document.querySelector('#community-title-input').value,species:document.querySelector('#viewer-species').value,skin:snapshot()});if(ok){event.target.reset();document.querySelector('#community-publish').open=false;}}finally{submit.disabled=false;}});
 document.querySelector('#community-admin-user').addEventListener('submit',event=>{event.preventDefault();mutate('/moderate',{id:document.querySelector('#community-steamid').value.trim(),action:document.querySelector('#community-user-action').value,reason:document.querySelector('#community-admin-reason').value.trim()});});
 fetch('SkinViewer/catalog.json').then(response=>response.json()).then(data=>{catalog=data.species;for(const entry of catalog.filter(item=>item.model))document.querySelector('#community-species').add(new Option(entry.name,entry.id));}).catch(()=>{});
 window.addEventListener('hashchange',()=>tab(location.hash==='#community'));
 if(location.hash==='#community')tab(true);
})();
