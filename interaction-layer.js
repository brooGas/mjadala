/* Mjadala interaction layer: optimistic, reversible local UI actions.
   Server-backed actions remain delegated to Supabase; never fake a server success. */
(() => {
  'use strict';
  const STORE = 'mjadala-ui-state-v1';
  const $ = (sel, root=document) => root.querySelector(sel);
  const $$ = (sel, root=document) => [...root.querySelectorAll(sel)];
  const safeRead = () => { try { return JSON.parse(localStorage.getItem(STORE) || '{}'); } catch (_) { return {}; } };
  let state = safeRead();
  const persist = () => { try { localStorage.setItem(STORE, JSON.stringify(state)); } catch (_) {} };
  const toast = msg => typeof window.showToast === 'function' ? window.showToast(msg) : alert(msg);
  const svg = name => `<svg class="std-icon" aria-hidden="true"><use href="#i-${name}"></use></svg>`;
  const setPressed = (el, on) => { el.setAttribute('aria-pressed', String(!!on)); };

  // Convert the existing post action labels into accessible, keyboard-operable controls.
  $$('.post-actions span').forEach((el, i) => {
    if (el.querySelector('button')) return;
    const text = el.textContent.trim();
    const kind = text.startsWith('♡') ? 'like' : text.startsWith('◯') ? 'comment' : text.startsWith('↗') ? 'share' : text.startsWith('♧') ? 'save' : '';
    if (!kind) return;
    const label = kind[0].toUpperCase()+kind.slice(1);
    const btn = document.createElement('button'); btn.type='button'; btn.dataset.postAction=kind; btn.setAttribute('aria-label', label);
    const count = text.replace(/^[♡◯↗♧]\s*/, '');
    btn.innerHTML = svg(kind==='like'?'heart':kind==='comment'?'message':kind==='share'?'share':'bookmark') + (kind==='share'?' Share':` ${count}`);
    el.replaceWith(btn);
  });

  // Rehydrate optimistic state after refresh.
  $$('[data-reel-action="like"]').forEach(b => setPressed(b, !!state.reelLiked));
  $$('[data-reel-action="sound"]').forEach(b => { const on=!!state.reelSoundOn; b.innerHTML=svg(on?'volume-2':'volume-x'); b.setAttribute('aria-label',on?'Turn sound off':'Turn sound on'); b.title=on?'Sound on':'Sound off'; });
  if(state.theme==='dark') document.body.classList.add('dark');
  $$('[data-reel-action="save"]').forEach(b => { setPressed(b, !!state.reelSaved); if(state.reelSaved) b.lastElementChild.textContent='Saved'; });
  $$('.post-actions [data-post-action="like"]').forEach((b,i)=>setPressed(b,!!state.postLikes?.[i]));
  $$('[data-post-action="save"]').forEach((b,i)=>setPressed(b,!!state.postSaves?.[i]));
  $$('.row-card button[data-toast]').forEach(b => {
    const t=b.dataset.toast||'';
    if(t.toLowerCase().includes('follow request')) { const key=b.closest('.row-card')?.querySelector('h4')?.textContent||''; if(state.follows?.[key]) {b.textContent='Following';b.setAttribute('aria-pressed','true');} }
    if(t.toLowerCase().includes('community preview')) { const key=b.closest('.row-card')?.querySelector('h4')?.textContent||''; if(state.communities?.[key]) {b.textContent='Joined';b.setAttribute('aria-pressed','true');} }
  });

  // Search overlay uses the current visual system and returns actionable results.
  function openSearch() {
    let modal=$('#mjadalaSearchModal');
    if(!modal){ modal=document.createElement('div'); modal.id='mjadalaSearchModal'; modal.className='interaction-modal'; modal.innerHTML=`<div class="interaction-dialog" role="dialog" aria-modal="true" aria-labelledby="searchTitle"><div class="section-title"><span id="searchTitle">Search Mjadala</span><button type="button" class="mini-btn" data-close-modal aria-label="Close search">${svg('close')}</button></div><label for="mjadalaSearchInput">People, topics, communities or businesses</label><input id="mjadalaSearchInput" type="search" placeholder="Try engineering or business…" autocomplete="off"><div id="mjadalaSearchResults" class="search-results" aria-live="polite"></div></div>`; document.body.append(modal);
      modal.addEventListener('click',e=>{if(e.target===modal||e.target.closest('[data-close-modal]')) modal.remove();});
      $('#mjadalaSearchInput',modal).addEventListener('input',e=>renderSearch(e.target.value,modal));
    }
    modal.hidden=false; const input=$('#mjadalaSearchInput',modal); input.focus(); renderSearch('',modal);
  }
  function renderSearch(query,modal){
    const q=query.trim().toLowerCase(); const items=$$('.screen h4, .screen .category').map(el=>({label:el.textContent.trim(),screen:Number(el.closest('[data-screen]')?.dataset.screen||0)})).filter(x=>!q||x.label.toLowerCase().includes(q)).slice(0,10);
    $('#mjadalaSearchResults',modal).innerHTML=items.length?items.map((x,i)=>`<button type="button" class="search-result" data-result-screen="${x.screen}" data-result-label="${encodeURIComponent(x.label)}">${svg('search')}<span>${escapeHTML(x.label)}</span>${svg('chevron')}</button>`).join(''):'<p class="subtle">No matching items in the content currently loaded.</p>';
    $$('.search-result',modal).forEach(b=>b.addEventListener('click',()=>{const target=Number(b.dataset.resultScreen);modal.remove();if(typeof window.go==='function')window.go(target);toast('Opened '+decodeURIComponent(b.dataset.resultLabel));}));
  }
  function escapeHTML(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  const style=document.createElement('style'); style.textContent=`.interaction-modal{position:fixed;inset:0;z-index:1000;background:#07120dbb;display:grid;place-items:center;padding:18px}.interaction-modal[hidden]{display:none}.interaction-dialog{background:var(--panel,#fff);color:var(--text,#183a2a);width:min(100%,430px);max-height:80vh;overflow:auto;border-radius:18px;padding:16px;box-shadow:0 16px 48px #0005}.interaction-dialog label{display:block;font-size:12px;margin:12px 0 6px}.interaction-dialog input{width:100%;padding:12px;border:1px solid var(--line,#ddd);border-radius:10px;background:transparent;color:inherit}.search-result{display:flex;align-items:center;gap:10px;width:100%;padding:11px 4px;border:0;border-bottom:1px solid var(--line,#eee);background:transparent;color:inherit;text-align:left}.search-result span{flex:1}.search-result .std-icon{width:17px;height:17px}.account-action-btn{width:100%;display:flex;gap:10px;align-items:flex-start;text-align:left;padding:12px;border:0;border-bottom:1px solid var(--line,#eee);background:transparent;color:inherit}.account-action-btn small{display:block;opacity:.7;margin-top:3px}.account-action-btn .std-icon{width:18px;height:18px;flex:none}.post-actions button{cursor:pointer}.post-actions button[aria-pressed=true]{font-weight:700;color:var(--green,#174d35)}.post-actions button[aria-pressed=true] .std-icon{fill:#174d3520}`; document.head.append(style);

  // Local Reel composer: lets a creator choose and preview a video before a backend is connected.
  const reelInput=$('#reelVideoInput'), createReelButton=$('#createReelButton');
  if(createReelButton && reelInput){
    createReelButton.addEventListener('click',()=>reelInput.click());
    reelInput.addEventListener('change',()=>{
      const file=reelInput.files?.[0]; if(!file)return;
      if(!file.type.startsWith('video/')){toast('Choose a video file.');return;}
      const stage=$('#sampleReel'); if(!stage)return;
      const old=stage.querySelector('video[data-local-reel]'); if(old?.dataset.objectUrl)URL.revokeObjectURL(old.dataset.objectUrl);
      let video=stage.querySelector('video[data-local-reel]'); if(!video){video=document.createElement('video');video.dataset.localReel='true';video.controls=true;video.playsInline=true;video.style.cssText='position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:0;background:#111';stage.prepend(video);}
      const url=URL.createObjectURL(file);video.src=url;video.dataset.objectUrl=url;video.muted=!state.reelSoundOn;video.setAttribute('aria-label','Local Reel preview');
      const art=$('.reel-art',stage);if(art)art.style.display='none';
      $('#reelCreateStatus').textContent='Previewing '+file.name+'. This is local only; it has not been uploaded.';
      const menu=$('#reelMoreMenu'); if(menu){const del=$('[data-reel-action="delete"]',menu);if(del)del.textContent='Delete my local Reel';}
      state.localReelName=file.name;persist();toast('Video preview ready');
    });
  }
  // Override placeholder toast behavior with meaningful optimistic state where possible.
  document.addEventListener('click', async e => {
    const reel=e.target.closest('[data-reel-action]');
    if(reel){
      const action=reel.dataset.reelAction;
      if(action==='sound'){state.reelSoundOn=!state.reelSoundOn;persist();const on=!!state.reelSoundOn;const activeVideo=$('#sampleReel video[data-local-reel]');if(activeVideo)activeVideo.muted=!on;reel.innerHTML=svg(on?'volume-2':'volume-x');reel.setAttribute('aria-label',on?'Turn sound off':'Turn sound on');reel.title=on?'Sound on':'Sound off';toast(on?'Reel sound enabled':'Reel sound muted');e.preventDefault();return;}
      if(action==='menu'){const menu=$('#reelMoreMenu');if(menu)menu.hidden=!menu.hidden;e.preventDefault();return;}
      if(action==='like'){state.reelLiked=!state.reelLiked;persist();setPressed(reel,state.reelLiked);const c=$('[data-count="likes"]',reel);if(c)c.textContent=state.reelLiked?'1.2K + 1':'1.2K';toast(state.reelLiked?'You liked this Reel':'Like removed');e.preventDefault();return;}
      if(action==='save'){state.reelSaved=!state.reelSaved;persist();setPressed(reel,state.reelSaved);const label=reel.lastElementChild;if(label)label.textContent=state.reelSaved?'Saved':'Save';toast(state.reelSaved?'Saved to your collection':'Removed from saved');e.preventDefault();return;}
      if(action==='comment'){const value=prompt('Write a comment on this Reel:');if(value?.trim()){toast('Comment drafted locally. Sign in and connect the comments backend to publish it.');}e.preventDefault();return;}
      if(action==='share'){const url=location.href.split('#')[0]+'#reels';if(navigator.share){navigator.share({title:'Mjadala Reel',text:'Beautiful views, bigger dreams.',url}).catch(()=>{});}else if(navigator.clipboard?.writeText){navigator.clipboard.writeText(url).then(()=>toast('Reel link copied')).catch(()=>toast(url));}else toast('Reel link: '+url);e.preventDefault();return;}
      if(action==='report'){const reason=prompt('Why are you reporting this Reel?');if(reason?.trim())toast('Report prepared locally. Connect the moderation backend to submit it.');if($('#reelMoreMenu'))$('#reelMoreMenu').hidden=true;e.preventDefault();return;}
      if(action==='delete'){const video=$('#sampleReel video[data-local-reel]');if(video){if(video.dataset.objectUrl)URL.revokeObjectURL(video.dataset.objectUrl);video.remove();const art=$('.reel-art',$('#sampleReel'));if(art)art.style.display='';$('#reelCreateStatus').textContent='Your local Reel preview was removed. Nothing was uploaded.';state.localReelName=null;persist();toast('Local Reel preview deleted');}else toast('Only the Reel creator can delete a Reel. This displayed Reel is sample content.');if($('#reelMoreMenu'))$('#reelMoreMenu').hidden=true;e.preventDefault();return;}
    }
    const postAction=e.target.closest('[data-post-action]');
    if(postAction){const kind=postAction.dataset.postAction;const index=$$('.post-actions [data-post-action]').indexOf(postAction);if(kind==='like'){state.postLikes=state.postLikes||{};state.postLikes[index]=!state.postLikes[index];persist();setPressed(postAction,state.postLikes[index]);toast(state.postLikes[index]?'Post liked':'Like removed');}else if(kind==='save'){state.postSaves=state.postSaves||{};state.postSaves[index]=!state.postSaves[index];persist();setPressed(postAction,state.postSaves[index]);toast(state.postSaves[index]?'Post saved':'Removed from saved');}else if(kind==='comment'){const value=prompt('Write a comment:');if(value?.trim())toast('Comment drafted locally; publishing needs the connected comments backend.');}else if(kind==='share'){const url=location.href.split('#')[0];if(navigator.share)navigator.share({title:'Mjadala post',url}).catch(()=>{});else if(navigator.clipboard?.writeText)navigator.clipboard.writeText(url).then(()=>toast('Link copied')).catch(()=>toast(url));else toast('Share link: '+url);}e.preventDefault();return;}
    const follow=e.target.closest('button[data-toast]');
    if(follow && (follow.dataset.toast||'').toLowerCase().includes('follow request')){const key=follow.closest('.row-card')?.querySelector('h4')?.textContent||'person';state.follows=state.follows||{};state.follows[key]=!state.follows[key];persist();follow.textContent=state.follows[key]?'Following':'Follow';follow.setAttribute('aria-pressed',String(state.follows[key]));toast(state.follows[key]?'Following '+key:'Unfollowed '+key);e.preventDefault();e.stopImmediatePropagation();return;}
    if(follow && (follow.dataset.toast||'').toLowerCase().includes('community preview')){const key=follow.closest('.row-card')?.querySelector('h4')?.textContent||'community';state.communities=state.communities||{};state.communities[key]=!state.communities[key];persist();follow.textContent=state.communities[key]?'Joined':'Join';follow.setAttribute('aria-pressed',String(state.communities[key]));toast(state.communities[key]?'Joined '+key:'Left '+key);e.preventDefault();e.stopImmediatePropagation();return;}
    const menuAction=e.target.closest('[data-settings]');
    if(menuAction && menuAction.dataset.settings==='logout'){e.preventDefault();e.stopImmediatePropagation();showAccountPanel('Log out',[{icon:'logout',label:'Log out of Mjadala',detail:'End your signed-in session on this device.'},{icon:'chevron',label:'Cancel',detail:'Return to your account.'}]);return;}
    const account=e.target.closest('[data-account-action]');
    if(account){const action=account.dataset.accountAction;e.preventDefault();if(action==='settings'){showAccountPanel('Settings',[{icon:'settings',label:'General settings',detail:'App preferences and controls.'},{icon:'palette',label:'Appearance',detail:'Use the Appearance row to switch theme.'}]);}else if(action==='edit'){showAccountPanel('Edit profile',[{icon:'edit',label:'Profile editing',detail:'Profile edits require your signed-in profile record.'}]);toast('Profile editor needs the authenticated profile backend.');}else if(action==='privacy'||action==='notifications'){showAccountPanel(action==='privacy'?'Privacy & security':'Notifications',[{icon:action==='privacy'?'shield':'bell',label:action==='privacy'?'Privacy settings':'Notification preferences',detail:'These preferences need to be saved to your account to sync across devices.'}]);}e.stopImmediatePropagation();return;}
  }, true);

  // Account panels are real buttons; actions have explicit outcomes and never claim server work that did not occur.
  const originalShow=window.showAccountPanel;
  window.showAccountPanel=function(title,rows){
    const section=$('#accountSection'), sectionTitle=$('#accountSectionTitle'), panel=$('#accountPanel'), content=$('#accountPanelContent');
    if(!panel||!content){if(originalShow)originalShow(title,rows);return;}
    if(section)section.style.display='none';if(sectionTitle)sectionTitle.style.display='none';panel.style.display='block';$('#accountPanelTitle').textContent=title;
    const normalized=rows.map(r=>({icon:r.icon,label:r.label,detail:r.detail}));
    content.innerHTML=normalized.map((r,i)=>`<button type="button" class="account-action-btn" data-panel-action="${i}">${svg(['logout','chevron','alert','grid','truck','credit','check','settings','palette','edit','shield','bell'].includes(r.icon)?r.icon:'chevron')}<span>${escapeHTML(r.label)}<small>${escapeHTML(r.detail||'')}</small></span></button>`).join('');
    content.querySelectorAll('[data-panel-action]').forEach(btn=>btn.addEventListener('click',async()=>{
      const r=normalized[Number(btn.dataset.panelAction)];
      if(/cancel|keep my account/i.test(r.label)){if(typeof window.restoreAccount==='function')window.restoreAccount();else $('#backToAccount')?.click();return;}
      if(/log out of mjadala/i.test(r.label)){
        if(!window.mjadalaAuth?.signOut){toast('Authentication service is not available.');return;}
        btn.disabled=true;btn.querySelector('small').textContent='Signing out…';
        try{const result=await window.mjadalaAuth.signOut();if(result?.error)throw result.error;toast('Signed out successfully.');if(typeof window.restoreAccount==='function')window.restoreAccount();$('#businessAuthPanel')?.scrollIntoView({behavior:'smooth',block:'center'});}
        catch(err){btn.disabled=false;btn.querySelector('small').textContent=err.message||'Sign out failed. Try again.';}
        return;
      }
      if(/delete my account/i.test(r.label)){toast('Account deletion is disabled until a secure server-side deletion workflow is configured.');return;}
      if(/report reel/i.test(r.label)){toast('Use the Reel menu to prepare a report.');return;}
      if(/sample|creator/i.test(r.detail||'')){toast(r.detail);return;}
      if(/general settings/i.test(r.label)){toast('Your settings are shown below.');restoreAccount();return;}
      if(/appearance/i.test(r.label)){restoreAccount();$('#appearanceRow')?.scrollIntoView({behavior:'smooth',block:'center'});return;}
      toast(r.detail||r.label);
    }));
  };

  // Use icon buttons for the profile menu and keep the current approved layout intact.
  const oldGo=window.go;
  if(typeof oldGo==='function') window.go=function(i){oldGo(i);};
  document.addEventListener('click',e=>{const b=e.target.closest('#searchBtn');if(b){e.preventDefault();openSearch();e.stopImmediatePropagation();}},true);
})();
