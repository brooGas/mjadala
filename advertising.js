/* Mjadala Explore advertising. Additive module; does not depend on or modify Reels. */
(() => {
  'use strict';
  const sb = window.mjadalaSupabaseClient;
  const $ = id => document.getElementById(id);
  if (!sb || !$('mjadalaAdPlayer')) return;
  const bucket = 'mjadala-ads';
  let sessionUser = null, isAdmin = false, ads = [], current = 0, timer = null, paused = false;
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const style = document.createElement('style');
  style.textContent = `
  .mj-ad-shell{position:relative;overflow:hidden;border-radius:20px;background:#183c2b;color:#fff;min-height:220px;margin:12px 0 18px;box-shadow:0 8px 24px #173b2b18}
  .mj-ad-bg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;filter:blur(18px) brightness(.6) saturate(1.1);transform:scale(1.15);opacity:.9}
  .mj-ad-media{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}.mj-ad-shade{position:absolute;inset:0;background:linear-gradient(0deg,#102b20d8 0%,#102b2055 38%,#102b2000 65%)}
  .mj-ad-content{position:relative;z-index:1;min-height:220px;padding:18px;display:flex;flex-direction:column;align-items:flex-start;justify-content:flex-end;gap:7px}.mj-ad-tag{font-size:9px;font-weight:900;letter-spacing:1.2px;text-transform:uppercase;color:#f1d18a}.mj-ad-content h3{font-size:13px;line-height:1.25;max-width:300px;margin:0;font-weight:800}.mj-ad-content p{font-size:11px;line-height:1.45;max-width:300px;margin:0;color:#f3f3e9}.mj-ad-cta{display:inline-flex;margin-top:5px;padding:9px 14px;border-radius:30px;background:#e9c878;color:#193c2b;font-size:11px;font-weight:900;text-decoration:none}.mj-ad-controls{position:absolute;z-index:2;right:12px;top:12px;display:flex;gap:6px}.mj-ad-controls button,.mj-ad-dots button{border:1px solid #ffffff75;background:#163b2db8;color:white;border-radius:50%;width:30px;height:30px}.mj-ad-dots{position:absolute;z-index:2;left:18px;top:16px;display:flex;gap:4px}.mj-ad-dots button{width:18px;height:4px;border:0;border-radius:8px;padding:0;opacity:.5}.mj-ad-dots button.active{opacity:1;background:#f1d18a}.mj-ad-form{border:1px solid var(--line);border-radius:16px;padding:13px;margin:12px 0;background:var(--paper);color:var(--ink)}.mj-ad-form h3{font-size:15px;margin:0 0 5px}.mj-ad-admin-row{border:1px solid var(--line);border-radius:11px;padding:10px;margin:8px 0;font-size:12px}.mj-ad-admin-row button{margin:7px 6px 0 0;padding:7px 10px;border:0;border-radius:8px;background:var(--green);color:white}.mj-ad-status{font-size:10px;color:var(--muted)}.mj-ad-note{font-size:10px;color:var(--muted);margin:6px 0 0}#mjAdPromoRow{margin:8px 0}
  #mjAdsDashboard{position:absolute;inset:0;z-index:30;background:var(--paper);color:var(--ink);display:flex;flex-direction:column;overflow:hidden}
  #mjAdsDashboard[hidden]{display:none!important}
  .mj-ad-top{display:flex;align-items:center;gap:10px;padding:12px 15px;border-bottom:1px solid var(--line);background:var(--paper);flex:0 0 auto}
  .mj-ad-top h2{font-size:16px;margin:0;flex:1}
  .mj-ad-back{border:1px solid var(--line);background:#fff;border-radius:11px;width:34px;height:34px;display:grid;place-items:center;color:var(--green);flex:0 0 auto}
  .mj-ad-dash-body{flex:1;overflow-y:auto;overscroll-behavior:contain;padding:12px 15px calc(84px + env(safe-area-inset-bottom))}
  #mjAdPosPreview{position:relative;overflow:hidden;border-radius:16px;min-height:220px;background:var(--soft);margin:6px 0 2px;cursor:grab;touch-action:none;user-select:none;display:none}
  #mjAdPosPreview.has-image{display:block}
  #mjAdPosPreview.dragging{cursor:grabbing}
  #mjAdPosPreview img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;pointer-events:none}
  #mjAdPosPreview .mj-ad-pos-hint{position:absolute;left:0;right:0;bottom:0;padding:7px 10px;background:linear-gradient(0deg,#000a,transparent);color:#fff;font-size:10px;font-weight:700;letter-spacing:.02em}
  #mjMyCampaigns{margin-top:10px;border-top:1px solid var(--line);padding-top:8px}
  #mjMyCampaigns h5{font-size:11px;margin:0 0 6px;color:var(--muted);text-transform:uppercase;letter-spacing:.04em}
  .mj-my-ad-row{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:7px 0;border-bottom:1px solid var(--line);font-size:12px}
  .mj-my-ad-row:last-child{border-bottom:0}
  .mj-ad-pill{font-size:9px;font-weight:800;padding:3px 8px;border-radius:999px;white-space:nowrap}
  .mj-ad-pill.pending{background:#fde8c4;color:#7a5200}.mj-ad-pill.approved{background:#d6ecd9;color:#1d6b33}.mj-ad-pill.rejected{background:#fbd8d8;color:#a3222a}
  `;
  document.head.append(style);
  const player = $('mjadalaAdPlayer');
  const host = document.querySelector('.phone') || document.body;
  const dashboard = document.createElement('div'); dashboard.id = 'mjAdsDashboard'; dashboard.hidden = true;
  dashboard.innerHTML = `<div class="mj-ad-top"><button type="button" class="mj-ad-back" id="mjAdsDashBack" aria-label="Back">←</button><h2>Business Ads Dashboard</h2></div><div class="mj-ad-dash-body" id="mjAdsDashBody"></div>`;
  host.appendChild(dashboard);
  const promoRow = document.createElement('div'); promoRow.className='row-card'; promoRow.id='mjAdPromoRow'; promoRow.innerHTML=`<div class="thumb"><svg class="std-icon"><use href="#i-zap"/></svg></div><div class="grow"><h4>Business Ads Dashboard</h4><p>Promote a campaign and review submissions.</p></div><button type="button" id="mjAdFormToggle" class="mini-btn">Open</button>`;
  const myBusinessRow = $('openMyBusiness')?.closest('.row-card');
  if (myBusinessRow) myBusinessRow.insertAdjacentElement('afterend', promoRow);
  else player.insertAdjacentElement('afterend', promoRow);
  const toggle = promoRow.querySelector('#mjAdFormToggle');
  const form = document.createElement('section'); form.className='owner-panel'; form.id='mjAdFormBody'; form.innerHTML=`<h4>Promote your business</h4><p>Create a sponsored photo or video campaign for Explore. Ads are reviewed before they appear publicly.</p><div class="field"><label>Campaign headline</label><input id="mjAdTitle" maxlength="90" placeholder="What should people notice?"></div><div class="field"><label>Description</label><textarea id="mjAdDescription" rows="2" maxlength="240" placeholder="A short, clear message"></textarea></div><div class="field"><label>Photo or video</label><input id="mjAdMedia" type="file" accept="image/*,video/mp4,video/webm,video/quicktime"></div><div id="mjAdPosPreview"><img id="mjAdPosImg" alt=""><div class="mj-ad-pos-hint">Drag the photo to choose what shows</div></div><div class="field-grid"><div class="field"><label>Category</label><select id="mjAdCategory"><option>Business</option><option>Engineering</option><option>Education</option><option>Technology</option><option>Innovation</option><option>Other</option></select></div><div class="field"><label>Button text</label><select id="mjAdCta"><option>Learn more</option><option>Shop now</option><option>Contact us</option><option>Visit website</option></select></div></div><div class="field-grid"><div class="field"><label>Destination link (optional)</label><input id="mjAdUrl" type="url" placeholder="https://…"></div><div class="field"><label>Campaign end date</label><input id="mjAdEnd" type="date"></div></div><div class="owner-actions"><button type="button" id="mjAdSubmit">Submit for review</button></div><p class="mj-ad-note" id="mjAdMessage" aria-live="polite"></p><div id="mjMyCampaigns"></div>`;
  $('mjAdsDashBody').appendChild(form);
  // Let the advertiser pick which part of their photo stays visible once it's cropped to fit
  // the ad holder, by dragging directly on a live preview (instead of a slider).
  let focalX = 50, focalY = 50, previewObjectUrl = null;
  const posPreview = $('mjAdPosPreview'), posImg = $('mjAdPosImg');
  function applyFocal(){ posImg.style.objectPosition = `${focalX}% ${focalY}%`; }
  function dragAt(clientX, clientY){
    const r = posPreview.getBoundingClientRect();
    focalX = Math.max(0, Math.min(100, ((clientX - r.left) / r.width) * 100));
    focalY = Math.max(0, Math.min(100, ((clientY - r.top) / r.height) * 100));
    applyFocal();
  }
  let dragging = false;
  posPreview.addEventListener('pointerdown', e => { dragging = true; posPreview.classList.add('dragging'); posPreview.setPointerCapture(e.pointerId); dragAt(e.clientX, e.clientY); });
  posPreview.addEventListener('pointermove', e => { if (dragging) dragAt(e.clientX, e.clientY); });
  ['pointerup','pointercancel'].forEach(evt => posPreview.addEventListener(evt, () => { dragging = false; posPreview.classList.remove('dragging'); }));
  $('mjAdMedia').addEventListener('change', () => {
    const file = $('mjAdMedia').files[0];
    if (previewObjectUrl) { URL.revokeObjectURL(previewObjectUrl); previewObjectUrl = null; }
    if (file && file.type.startsWith('image/')) {
      focalX = 50; focalY = 50; applyFocal();
      previewObjectUrl = URL.createObjectURL(file);
      posImg.src = previewObjectUrl;
      posPreview.classList.add('has-image');
    } else {
      posPreview.classList.remove('has-image');
      posImg.removeAttribute('src');
    }
  });
  function openAdsDashboard(){ dashboard.hidden = false; document.body.style.overflow = 'hidden'; loadMyCampaigns(); if (isAdmin) loadAdmin(); }
  function closeAdsDashboard(){ dashboard.hidden = true; document.body.style.overflow = ''; }
  toggle.onclick = () => openAdsDashboard();
  $('mjAdsDashBack').onclick = () => closeAdsDashboard();
  const admin = document.createElement('section'); admin.className='mj-ad-form'; admin.id='mjAdAdmin'; admin.hidden=true; admin.innerHTML='<h3>Advertising review</h3><p class="mj-ad-note">Review submitted campaigns before publication.</p><div id="mjAdReviewList">Loading…</div>';
  $('mjAdsDashBody').appendChild(admin);
  async function loadMyCampaigns(){
    const host = $('mjMyCampaigns');
    if (!host) return;
    if (!sessionUser) { host.innerHTML = ''; return; }
    const {data,error} = await sb.from('mj_ad_campaigns').select('id,title,status,rejection_reason,created_at').eq('user_id',sessionUser.id).order('created_at',{ascending:false}).limit(10);
    if (error || !data || !data.length) { host.innerHTML = ''; return; }
    const label = s => s==='approved'?'Live now':s==='rejected'?'Rejected':'Pending review';
    host.innerHTML = `<h5>Your campaigns</h5>${data.map(a=>`<div class="mj-my-ad-row"><span>${esc(a.title)}</span><span class="mj-ad-pill ${esc(a.status)}" title="${a.status==='rejected'&&a.rejection_reason?esc(a.rejection_reason):''}">${label(a.status)}</span></div>`).join('')}`;
  }
  function stop(){ if(timer) clearTimeout(timer); timer=null; }
  function render(){
    stop(); if(!ads.length){player.innerHTML='<div class="mj-ad-content"><span class="mj-ad-tag">MJADALA · EXPLORE</span><h3>Discover businesses and ideas worth your attention.</h3><p>Sponsored stories from the Mjadala community will appear here.</p><a class="mj-ad-cta" href="#" id="mjAdCreateLink">Promote your business</a></div>'; $('mjAdCreateLink')?.addEventListener('click',e=>{e.preventDefault();openAdsDashboard();}); return;}
    current=(current+ads.length)%ads.length; const a=ads[current]; const fx=Number.isFinite(a.media_focal_x)?a.media_focal_x:50,fy=Number.isFinite(a.media_focal_y)?a.media_focal_y:50;const media=a.media_type==='video'?`<video class="mj-ad-media" src="${esc(a.media_url)}" muted playsinline autoplay></video>`:`<img class="mj-ad-bg" src="${esc(a.media_url)}" alt="" aria-hidden="true"><img class="mj-ad-media" src="${esc(a.media_url)}" alt="Sponsored campaign" style="object-position:${fx}% ${fy}%">`;
    player.innerHTML=`${media}<div class="mj-ad-shade"></div><div class="mj-ad-dots">${ads.map((_,i)=>`<button type="button" class="${i===current?'active':''}" data-dot="${i}" aria-label="Show advert ${i+1}"></button>`).join('')}</div><div class="mj-ad-controls"><button type="button" id="mjAdPause" aria-label="Pause advert">Ⅱ</button><button type="button" id="mjAdNext" aria-label="Next advert">›</button></div><div class="mj-ad-content"><span class="mj-ad-tag">SPONSORED · ${esc(a.category)}</span><h3>${esc(a.title)}</h3><p>${esc(a.description)}</p>${a.destination_url?`<a class="mj-ad-cta" href="${esc(a.destination_url)}" target="_blank" rel="noopener">${esc(a.cta_text||'Learn more')}</a>`:`<span class="mj-ad-cta" aria-disabled="true">${esc(a.cta_text||'Learn more')}</span>`}</div>`;
    const video=player.querySelector('video'); if(video) video.play().catch(()=>{});
    $('mjAdPause').onclick=()=>{paused=!paused; if(video){paused?video.pause():video.play().catch(()=>{});} $('mjAdPause').textContent=paused?'▶':'Ⅱ'; if(!paused) schedule(); else stop();};
    $('mjAdNext').onclick=()=>{current++;render();}; player.querySelectorAll('[data-dot]').forEach(b=>b.onclick=()=>{current=Number(b.dataset.dot);render();});
    schedule();
  }
  function schedule(){stop();if(paused||!ads.length)return;const a=ads[current];timer=setTimeout(()=>{current++;render();},a.media_type==='video'?10000:5000);}
  async function loadAds(){const baseCols='id,title,description,media_url,media_type,category,destination_url,cta_text';let {data,error}=await sb.from('mj_ad_campaigns').select(baseCols+',media_focal_x,media_focal_y').eq('status','approved').eq('is_active',true).gt('ends_at',new Date().toISOString()).order('approved_at',{ascending:false}).limit(8);if(error&&/media_focal_x|media_focal_y/.test(error.message||'')){({data,error}=await sb.from('mj_ad_campaigns').select(baseCols).eq('status','approved').eq('is_active',true).gt('ends_at',new Date().toISOString()).order('approved_at',{ascending:false}).limit(8));}ads=error?[]:(data||[]);render();}
  async function loadAdmin(){if(!isAdmin)return;const host=$('mjAdReviewList');const {data,error}=await sb.from('mj_ad_campaigns').select('*').eq('status','pending').order('created_at');if(error){host.textContent=error.message;return;}host.innerHTML=(data||[]).map(a=>`<article class="mj-ad-admin-row"><strong>${esc(a.title)}</strong><p>${esc(a.description)}</p><p class="mj-ad-status">${esc(a.category)} · ${esc(a.media_type)} · ends ${esc(a.ends_at)}</p><a href="${esc(a.media_url)}" target="_blank" rel="noopener">Preview media</a><br><button data-ad-review="${a.id}" data-decision="approved">Approve</button><button data-ad-review="${a.id}" data-decision="rejected">Reject</button></article>`).join('')||'<p class="mj-ad-note">No campaigns awaiting review.</p>';host.querySelectorAll('[data-ad-review]').forEach(b=>b.onclick=async()=>{const id=b.dataset.adReview,decision=b.dataset.decision;let reason='';if(decision==='rejected'){reason=prompt('Reason for rejection (shown to advertiser):')||'';if(!reason)return;}b.disabled=true;const {error}=await sb.from('mj_ad_campaigns').update({status:decision,rejection_reason:reason,approved_at:decision==='approved'?new Date().toISOString():null,is_active:decision==='approved'}).eq('id',id);if(error)alert(error.message);await loadAdmin();await loadAds();document.dispatchEvent(new CustomEvent('mj-ads-changed'));});}
  $('mjAdSubmit').onclick=async()=>{const msg=$('mjAdMessage');if(!sessionUser){msg.textContent='Sign in to submit an advert.';return;}const file=$('mjAdMedia').files[0],title=$('mjAdTitle').value.trim(),end=$('mjAdEnd').value;if(!title||!file||!end){msg.textContent='Add a headline, media file and campaign end date.';return;}if(file.size>50*1024*1024){msg.textContent='Media must be 50 MB or smaller.';return;}const mediaType=file.type.startsWith('video/')?'video':'image';if(!file.type.startsWith('image/')&&!file.type.startsWith('video/')){msg.textContent='Choose an image or video.';return;}const path=`${sessionUser.id}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g,'_')}`;const upload=await sb.storage.from(bucket).upload(path,file,{upsert:false,contentType:file.type});if(upload.error){msg.textContent='Upload failed: '+upload.error.message;return;}const {data:publicData}=sb.storage.from(bucket).getPublicUrl(path);const basePayload={user_id:sessionUser.id,title,description:$('mjAdDescription').value.trim(),media_url:publicData.publicUrl,media_path:path,media_type:mediaType,category:$('mjAdCategory').value,destination_url:$('mjAdUrl').value.trim()||null,cta_text:$('mjAdCta').value,ends_at:new Date(end+'T23:59:59').toISOString(),status:'pending'};const focalPayload=mediaType==='image'?{media_focal_x:Math.round(focalX),media_focal_y:Math.round(focalY)}:{};let {error}=await sb.from('mj_ad_campaigns').insert({...basePayload,...focalPayload});if(error&&/media_focal_x|media_focal_y/.test(error.message||'')){({error}=await sb.from('mj_ad_campaigns').insert(basePayload));}if(error){msg.textContent='Campaign could not be saved: '+error.message;return;}msg.textContent='Submitted. Your campaign will appear after admin approval — see "Your campaigns" below for its status.';['mjAdTitle','mjAdDescription','mjAdMedia','mjAdUrl','mjAdEnd'].forEach(id=>$(id).value='');focalX=50;focalY=50;posPreview.classList.remove('has-image');posImg.removeAttribute('src');if(previewObjectUrl){URL.revokeObjectURL(previewObjectUrl);previewObjectUrl=null;}loadMyCampaigns();};
  sb.auth.getSession().then(async({data})=>{sessionUser=data.session?.user||null;const r=await sb.rpc('mj_is_creator_admin');isAdmin=!r.error&&r.data===true;admin.hidden=!isAdmin;if(isAdmin)loadAdmin();loadMyCampaigns();});
  document.addEventListener('mj-ads-changed', loadAds);
  sb.auth.onAuthStateChange(async(_event,session)=>{sessionUser=session?.user||null;const r=await sb.rpc('mj_is_creator_admin');isAdmin=!r.error&&r.data===true;admin.hidden=!isAdmin;if(isAdmin)loadAdmin();loadMyCampaigns();});

  // The Business workspace gets its OWN ad carousel, showing only ads that were
  // NOT submitted through Engineering's promote form. Independent from the
  // Home screen's "all ads" player above and from Engineering's own player.
  (function initBizAdPlayer(){
    const anchor = $('openMyBusiness')?.closest('.row-card');
    if (!anchor) return;
    const bizPlayer = document.createElement('section');
    bizPlayer.className = 'mj-ad-shell'; bizPlayer.id = 'mjBizAdPlayer'; bizPlayer.setAttribute('aria-label','Sponsored business campaigns');
    anchor.insertAdjacentElement('beforebegin', bizPlayer);
    let bizAds = [], bizCurrent = 0, bizTimer = null, bizPaused = false;
    function bizStop(){ if (bizTimer) clearTimeout(bizTimer); bizTimer = null; }
    function bizRender(){
      bizStop();
      if (!bizAds.length) { bizPlayer.innerHTML = '<div class="mj-ad-content"><span class="mj-ad-tag">BUSINESS</span><h3>Reach more customers on Mjadala.</h3><p>Sponsored business campaigns will appear here.</p></div>'; return; }
      bizCurrent = (bizCurrent + bizAds.length) % bizAds.length;
      const a = bizAds[bizCurrent];
      const fx = Number.isFinite(a.media_focal_x) ? a.media_focal_x : 50, fy = Number.isFinite(a.media_focal_y) ? a.media_focal_y : 50;
      const media = a.media_type === 'video' ? `<video class="mj-ad-media" src="${esc(a.media_url)}" muted playsinline autoplay></video>` : `<img class="mj-ad-bg" src="${esc(a.media_url)}" alt="" aria-hidden="true"><img class="mj-ad-media" src="${esc(a.media_url)}" alt="Sponsored campaign" style="object-position:${fx}% ${fy}%">`;
      bizPlayer.innerHTML = `${media}<div class="mj-ad-shade"></div><div class="mj-ad-dots">${bizAds.map((_,i)=>`<button type="button" class="${i===bizCurrent?'active':''}" data-biz-dot="${i}" aria-label="Show advert ${i+1}"></button>`).join('')}</div><div class="mj-ad-controls"><button type="button" id="mjBizAdPause" aria-label="Pause advert">Ⅱ</button><button type="button" id="mjBizAdNext" aria-label="Next advert">›</button></div><div class="mj-ad-content"><span class="mj-ad-tag">SPONSORED · ${esc(a.category)}</span><h3>${esc(a.title)}</h3><p>${esc(a.description)}</p>${a.destination_url?`<a class="mj-ad-cta" href="${esc(a.destination_url)}" target="_blank" rel="noopener">${esc(a.cta_text||'Learn more')}</a>`:`<span class="mj-ad-cta" aria-disabled="true">${esc(a.cta_text||'Learn more')}</span>`}</div>`;
      const video = bizPlayer.querySelector('video'); if (video) video.play().catch(()=>{});
      $('mjBizAdPause').onclick = () => { bizPaused = !bizPaused; if (video) { bizPaused ? video.pause() : video.play().catch(()=>{}); } $('mjBizAdPause').textContent = bizPaused ? '▶' : 'Ⅱ'; bizPaused ? bizStop() : bizSchedule(); };
      $('mjBizAdNext').onclick = () => { bizCurrent++; bizRender(); };
      bizPlayer.querySelectorAll('[data-biz-dot]').forEach(b => b.onclick = () => { bizCurrent = Number(b.dataset.bizDot); bizRender(); });
      bizSchedule();
    }
    function bizSchedule(){ bizStop(); if (bizPaused || !bizAds.length) return; const a = bizAds[bizCurrent]; bizTimer = setTimeout(() => { bizCurrent++; bizRender(); }, a.media_type === 'video' ? 10000 : 5000); }
    async function loadBizAds(){
      const baseCols = 'id,title,description,media_url,media_type,category,destination_url,cta_text';
      let { data, error } = await sb.from('mj_ad_campaigns').select(baseCols + ',media_focal_x,media_focal_y').eq('status','approved').eq('is_active',true).neq('category','Engineering').gt('ends_at', new Date().toISOString()).order('approved_at',{ascending:false}).limit(8);
      if (error && /media_focal_x|media_focal_y/.test(error.message || '')) { ({ data, error } = await sb.from('mj_ad_campaigns').select(baseCols).eq('status','approved').eq('is_active',true).neq('category','Engineering').gt('ends_at', new Date().toISOString()).order('approved_at',{ascending:false}).limit(8)); }
      bizAds = error ? [] : (data || []);
      bizRender();
    }
    loadBizAds();
    document.addEventListener('mj-ads-changed', loadBizAds);
  })();
  loadAds();
})();
