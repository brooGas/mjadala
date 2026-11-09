/* Mjadala Engineering Hub. Additive module; does not depend on or modify
   Home, Explore, Reels, Communities tab, Profile, business tools or ads.
   Reuses the shared Supabase client and the app's existing CSS classes
   (.hero, .pill-btn, .chip, .trend-card, .live-post, .row-card, .mini-btn,
   .detail-accordion, .field, .owner-actions) so it looks native, not bolted on. */
(() => {
  'use strict';
  const sb = window.mjadalaSupabaseClient;
  if (!sb) return;
  const $ = id => document.getElementById(id);
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const host = document.querySelector('.phone') || document.body;
  if ($('engineeringHub')) return;

  const SUBTOPICS = [
    { key: 'Mechanical', label: 'Mechanical', icon: 'i-settings' },
    { key: 'Electrical', label: 'Electrical', icon: 'i-zap' },
    { key: 'Automation', label: 'Automation', icon: 'i-grid' },
    { key: 'Control Systems', label: 'Control Systems', icon: 'i-compass' },
    { key: 'NDT & Testing', label: 'NDT & Testing', icon: 'i-eye' }
  ];
  const TABS = [
    { key: '', label: 'All' },
    { key: 'question', label: 'Questions' },
    { key: 'project', label: 'Projects' },
    { key: 'tutorial', label: 'Tutorials' },
    { key: 'news', label: 'News' }
  ];

  let user = null;
  let subtopicFilter = null;
  let communities = [];
  let activeCommunity = null;
  let activeTab = '';
  let communityPosts = [];
  const profileCache = new Map();
  const likeState = new Map();   // postId -> boolean liked (by me)
  const likeCounts = new Map();  // postId -> count
  const commentCounts = new Map();
  const openComments = new Set();

  const style = document.createElement('style');
  style.textContent = `
  #engineeringHub,#engCommunityDetail{position:fixed;inset:0;z-index:4000;background:var(--paper);color:var(--ink);display:flex;flex-direction:column;overflow-y:auto;overscroll-behavior:contain}
  #engineeringHub[hidden],#engCommunityDetail[hidden]{display:none!important}
  .eng-top{display:flex;align-items:center;gap:10px;padding:12px 15px;border-bottom:1px solid var(--line);background:var(--paper);position:sticky;top:0;z-index:2}
  .eng-top h2{font-size:16px;margin:0;flex:1}
  .eng-back{border:1px solid var(--line);background:#fff;border-radius:11px;width:34px;height:34px;display:grid;place-items:center;color:var(--green);flex:0 0 auto}
  .eng-body{padding:12px 15px 24px}
  .eng-hero p.eyebrow{color:#f5dca8}
  .eng-sub-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:6px;margin:4px 0 2px}
  .eng-sub-chip{display:flex;flex-direction:column;align-items:center;gap:5px;border:1px solid var(--line);background:#fff;border-radius:13px;padding:9px 3px;font-size:9px;font-weight:750;color:var(--ink);text-align:center;line-height:1.2}
  .eng-sub-chip .eng-sub-ico{width:30px;height:30px;border-radius:50%;background:var(--soft);color:var(--green);display:grid;place-items:center}
  .eng-sub-chip.on{border-color:var(--green);background:#eef5ee}
  .eng-sub-chip.on .eng-sub-ico{background:var(--green);color:#fff}
  .eng-btn-primary{border:0;border-radius:12px;padding:10px 14px;background:#228b22;color:#fff;font-size:12px;font-weight:850;display:inline-flex;align-items:center;gap:6px}
  .eng-btn-primary:disabled{opacity:.6}
  .eng-learning{margin:12px 0;border-radius:18px;padding:15px;background:linear-gradient(120deg,var(--ivory),#fff6e4);border:1px solid #ecdcb0;display:flex;align-items:center;gap:12px}
  .eng-learning .eng-learning-ico{width:44px;height:44px;border-radius:12px;background:var(--gold);color:#4a3a14;display:grid;place-items:center;flex:0 0 auto}
  .eng-learning h4{margin:0 0 3px;font-size:14px}
  .eng-learning p{margin:0;font-size:11px;color:#6b5c38}
  .eng-learning-list{margin-top:10px}
  .eng-lesson-row{display:flex;align-items:center;gap:9px;padding:9px 0;border-top:1px solid #ecdcb0}
  .eng-lesson-row a{color:var(--green);font-weight:800;font-size:12px;text-decoration:none}
  .eng-lesson-row p{margin:2px 0 0;font-size:10px;color:var(--muted)}
  .eng-comm-grid{display:grid;grid-template-columns:1fr 1fr;gap:9px}
  .eng-comm-card{border:1px solid var(--line);border-radius:14px;padding:11px;background:#fff;display:flex;flex-direction:column;gap:7px;text-align:left}
  .eng-comm-card .eng-comm-ico{width:34px;height:34px;border-radius:10px;background:var(--soft);color:var(--green);display:grid;place-items:center}
  .eng-comm-card strong{font-size:12px;line-height:1.25;display:flex;align-items:center;gap:4px}
  .eng-comm-card .eng-verify{color:var(--green)}
  .eng-comm-card small{color:var(--muted);font-size:10px}
  .eng-comm-card button{margin-top:2px}
  .eng-comm-banner{background:linear-gradient(120deg,#174d35,#2f7757);color:#fff;border-radius:18px;padding:16px;display:flex;align-items:center;gap:12px;margin-bottom:4px}
  .eng-comm-banner .eng-comm-avatar{width:50px;height:50px;border-radius:14px;background:#ffffff22;border:1px solid #ffffff40;color:#fff;display:grid;place-items:center;flex:0 0 auto}
  .eng-comm-banner h3{margin:0 0 3px;font-size:16px;display:flex;align-items:center;gap:5px}
  .eng-comm-banner .eng-verify{color:#f1d18a}
  .eng-comm-banner p{margin:0;font-size:11px;color:#e2eee5}
  .eng-comm-banner button{margin-left:auto;flex:0 0 auto}
  .eng-comm-desc{font-size:12px;color:var(--muted);margin:10px 0}
  .eng-composer{border:1px solid var(--line);border-radius:14px;padding:11px;margin:10px 0;background:var(--soft)}
  .eng-composer textarea{width:100%;min-height:60px;border:1px solid var(--line);border-radius:10px;padding:9px;background:var(--paper);color:var(--ink);font:inherit;font-size:12px;box-sizing:border-box;resize:vertical}
  .eng-composer-row{display:flex;gap:7px;align-items:center;margin-top:7px;flex-wrap:wrap}
  .eng-composer-row select{border:1px solid var(--line);border-radius:9px;padding:7px;background:var(--paper);color:var(--ink);font-size:11px}
  .eng-post-type-pill{display:inline-block;font-size:9px;font-weight:800;padding:3px 8px;border-radius:999px;background:var(--soft);color:var(--green);text-transform:uppercase;letter-spacing:.03em;margin-right:6px}
  .eng-post-photo{width:100%;max-height:220px;object-fit:cover;border-radius:0}
  .eng-comment-box{border-top:1px solid var(--line);padding:9px 12px;background:var(--soft)}
  .eng-comment-row{font-size:11px;padding:6px 0;border-bottom:1px solid var(--line)}
  .eng-comment-row:last-child{border-bottom:0}
  .eng-comment-box textarea{width:100%;border:1px solid var(--line);border-radius:9px;padding:7px;font:inherit;font-size:11px;background:var(--paper);color:var(--ink);box-sizing:border-box;margin-top:6px;min-height:40px}
  .eng-comment-box button{margin-top:6px}
  `;
  document.head.append(style);

  const hub = document.createElement('div');
  hub.id = 'engineeringHub'; hub.hidden = true;
  hub.innerHTML = `
    <div class="eng-top"><button type="button" class="eng-back" id="engHubBack" aria-label="Back">←</button><h2>Engineering</h2></div>
    <div class="eng-body">
      <div class="hero"><div class="eyebrow">LEARN · SHARE · BUILD · GROW</div><h3>Engineering Innovations for a Better Africa</h3><p>Join the communities, trends and skills built for African engineers.</p><button type="button" class="pill-btn" id="engExploreBtn">Explore Engineering →</button></div>
      <div class="eng-sub-grid" id="engSubGrid"></div>
      <div class="section-title">Trending in Engineering <span class="subtle" id="engTrendStatus">Loading…</span></div>
      <div id="engTrending"><p class="live-empty">Loading trending stories…</p></div>
      <div class="eng-learning">
        <div class="eng-learning-ico"><svg class="std-icon" viewBox="0 0 24 24"><path d="M12 2 2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg></div>
        <div class="grow"><h4>Engineering Learning Hub</h4><p>Structured courses, practical tutorials and real-world projects.</p></div>
        <button type="button" class="eng-btn-primary" id="engStartLearning">Start Learning →</button>
      </div>
      <div id="engLearningList" class="eng-learning-list" hidden></div>
      <div class="section-title">Popular Communities <span class="subtle" id="engCommStatus">Loading…</span></div>
      <div class="eng-comm-grid" id="engCommunities"><p class="live-empty">Loading communities…</p></div>
    </div>`;
  host.appendChild(hub);

  const detail = document.createElement('div');
  detail.id = 'engCommunityDetail'; detail.hidden = true;
  detail.innerHTML = `
    <div class="eng-top"><button type="button" class="eng-back" id="engDetailBack" aria-label="Back">←</button><h2 id="engDetailTitle">Community</h2></div>
    <div class="eng-body">
      <div class="eng-comm-banner">
        <div class="eng-comm-avatar"><svg class="std-icon" viewBox="0 0 24 24" style="width:24px;height:24px"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9c.14.47.43.88.84 1.17.3.2.65.32 1.02.34H21a2 2 0 1 1 0 4h-.09c-.47.02-.92.19-1.3.47-.27.2-.49.46-.63.76Z"/></svg></div>
        <div class="grow"><h3 id="engDetailName">—</h3><p id="engDetailMeta">—</p></div>
        <button type="button" class="eng-btn-primary" id="engDetailJoin">Join</button>
      </div>
      <p class="eng-comm-desc" id="engDetailDesc"></p>
      <div class="chips" id="engDetailTabs" role="tablist"></div>
      <div class="eng-composer" id="engComposer" hidden>
        <textarea id="engPostBody" maxlength="3000" placeholder="Share a question, project, tutorial or update…"></textarea>
        <div class="eng-composer-row">
          <select id="engPostType"><option value="">Discussion</option><option value="question">Question</option><option value="project">Project</option><option value="tutorial">Tutorial</option><option value="news">News</option></select>
          <label class="mini-btn" for="engPostPhoto" style="cursor:pointer">Add photo</label>
          <input id="engPostPhoto" type="file" accept="image/*" hidden>
          <span class="subtle" id="engPostPhotoName"></span>
          <button type="button" class="eng-btn-primary" id="engPostSubmit" style="margin-left:auto">Post</button>
        </div>
        <p class="subtle" id="engPostStatus" aria-live="polite"></p>
      </div>
      <div id="engFeed"><p class="live-empty">Loading discussions…</p></div>
    </div>
    <button type="button" class="eng-btn-primary" id="engCreateFab" style="position:fixed;right:16px;bottom:22px;border-radius:999px;box-shadow:0 6px 18px #0003;z-index:5">+ Create Post</button>`;
  host.appendChild(detail);

  function openOverlay(el){ el.hidden = false; document.body.style.overflow = 'hidden'; }
  function closeOverlay(el){ el.hidden = true; document.body.style.overflow = ''; }

  function openHub(){
    openOverlay(hub);
    renderSubGrid();
    loadTrending();
    loadCommunities();
  }
  $('engHubBack').onclick = () => closeOverlay(hub);
  $('engExploreBtn').onclick = () => $('engTrending').scrollIntoView({behavior:'smooth',block:'start'});

  // Both existing "Engineering" category chips (Home and Explore) open the hub.
  // Matched by text so no existing markup needs to change.
  document.addEventListener('click', e => {
    const cat = e.target.closest('.category');
    if (cat && cat.textContent.trim().replace(/\s+/g,' ').includes('Engineering')) { e.preventDefault(); openHub(); }
  });

  function renderSubGrid(){
    const grid = $('engSubGrid');
    grid.innerHTML = SUBTOPICS.map(s => `<button type="button" class="eng-sub-chip ${subtopicFilter===s.key?'on':''}" data-subtopic="${esc(s.key)}"><span class="eng-sub-ico"><svg class="std-icon"><use href="#${s.icon}"/></svg></span>${esc(s.label)}</button>`).join('');
    grid.querySelectorAll('[data-subtopic]').forEach(b => b.onclick = () => {
      const key = b.dataset.subtopic;
      subtopicFilter = subtopicFilter === key ? null : key;
      renderSubGrid();
      loadTrending();
      loadCommunities();
    });
  }

  async function loadTrending(){
    const host = $('engTrending'), status = $('engTrendStatus');
    host.innerHTML = '<p class="live-empty">Loading trending stories…</p>';
    let q = sb.from('mj_trending_stories').select('id,title,description,image_url,topic,subtopic,source_label,created_at').eq('is_active', true).eq('topic','Engineering').order('created_at',{ascending:false}).limit(12);
    if (subtopicFilter) q = q.eq('subtopic', subtopicFilter);
    const { data, error } = await q;
    if (error) { host.innerHTML = '<p class="live-empty">No curated stories yet. Real activity from Engineering communities will appear here.</p>'; status.textContent=''; return; }
    const stories = data || [];
    status.textContent = stories.length ? `${stories.length} stor${stories.length===1?'y':'ies'}` : '';
    host.innerHTML = stories.length ? `<div class="trend-list">${stories.map(s => `<div class="trend-card" style="cursor:default">${s.image_url?`<img class="trend-photo" loading="lazy" src="${esc(s.image_url)}" alt="">`:'<span class="trend-photo trend-placeholder">✦</span>'}<span class="trend-copy"><strong>${esc(s.title)}</strong><p>${esc(s.description||'')}</p><span class="trend-meta">${esc(s.subtopic||s.topic)}${s.source_label?' · '+esc(s.source_label):''}</span></span></div>`).join('')}</div>` : '<p class="live-empty">No curated stories yet for this subtopic.</p>';
  }

  async function loadLearning(){
    const host = $('engLearningList');
    host.innerHTML = '<p class="live-empty">Loading resources…</p>';
    const { data, error } = await sb.from('mj_learning_resources').select('id,title,description,url').eq('is_active',true).eq('topic','Engineering').order('sort_order');
    if (error || !data || !data.length) { host.innerHTML = '<p class="live-empty">Lessons are being prepared. Check back soon.</p>'; return; }
    host.innerHTML = data.map(r => `<div class="eng-lesson-row">${r.url?`<a href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.title)}</a>`:`<strong style="font-size:12px">${esc(r.title)}</strong>`}<p>${esc(r.description||'')}</p></div>`).join('');
  }
  let learningOpen = false;
  $('engStartLearning').onclick = () => {
    learningOpen = !learningOpen;
    $('engLearningList').hidden = !learningOpen;
    $('engStartLearning').textContent = learningOpen ? 'Hide lessons' : 'Start Learning →';
    if (learningOpen) loadLearning();
  };

  async function loadCommunities(){
    const host = $('engCommunities'), status = $('engCommStatus');
    host.innerHTML = '<p class="live-empty">Loading communities…</p>';
    let q = sb.from('mj_communities').select('id,name,slug,description,subtopic,is_verified,is_private,approval_required,created_by').eq('topic','Engineering').order('name');
    if (subtopicFilter) q = q.eq('subtopic', subtopicFilter);
    const { data, error } = await q;
    if (error) { host.innerHTML = `<p class="live-empty">Communities unavailable: ${esc(error.message)}. Run MIGRATION_ENGINEERING_HUB.sql.</p>`; status.textContent=''; return; }
    communities = data || [];
    status.textContent = `${communities.length} communit${communities.length===1?'y':'ies'}`;
    if (!communities.length) { host.innerHTML = '<p class="live-empty">No Engineering communities yet.</p>'; return; }
    host.innerHTML = communities.map(c => `<div class="eng-comm-card" data-open-community="${esc(c.id)}"><span class="eng-comm-ico"><svg class="std-icon"><use href="#i-settings"/></svg></span><strong>${esc(c.name)}${c.is_verified?'<svg class="std-icon eng-verify" style="width:13px;height:13px"><use href="#i-check"/></svg>':''}</strong><small id="eng-members-${esc(c.id)}">Loading members…</small><button type="button" class="eng-btn-primary" style="justify-content:center" data-open-community="${esc(c.id)}">View</button></div>`).join('');
    communities.forEach(c => loadMemberCount(c.id));
  }

  async function loadMemberCount(id){
    const el = $('eng-members-'+id);
    if (!el) return;
    const { count, error } = await sb.from('mj_community_members').select('user_id',{count:'exact',head:true}).eq('community_id', id);
    el.textContent = error ? 'Members unavailable' : `${count||0} member${count===1?'':'s'}`;
  }

  async function profilesFor(ids){
    const need = [...new Set(ids)].filter(id => id && !profileCache.has(id));
    if (need.length) {
      const { data } = await sb.from('profiles').select('id,nickname,avatar_url').in('id', need);
      (data||[]).forEach(p => profileCache.set(p.id, p));
      need.forEach(id => { if (!profileCache.has(id)) profileCache.set(id, {nickname:'Mjadala member', avatar_url:null}); });
    }
  }
  function userOf(id){ return profileCache.get(id) || {nickname:'Mjadala member', avatar_url:null}; }

  document.addEventListener('click', e => {
    const open = e.target.closest('[data-open-community]');
    if (open) { const c = communities.find(x => x.id === open.dataset.openCommunity); if (c) openCommunityDetail(c); }
  });

  async function openCommunityDetail(c){
    activeCommunity = c; activeTab = ''; communityPosts = [];
    $('engDetailName').innerHTML = `${esc(c.name)}${c.is_verified?'<svg class="std-icon" style="width:15px;height:15px;color:#f1d18a"><use href="#i-check"/></svg>':''}`;
    $('engDetailTitle').textContent = c.subtopic || 'Engineering';
    $('engDetailDesc').textContent = c.description || '';
    $('engDetailMeta').textContent = 'Loading members…';
    renderTabs();
    openOverlay(detail);
    closeOverlay(hub);
    await refreshMemberMeta();
    await loadFeed();
  }
  $('engDetailBack').onclick = () => { closeOverlay(detail); openOverlay(hub); };

  async function refreshMemberMeta(){
    if (!activeCommunity) return;
    const { count } = await sb.from('mj_community_members').select('user_id',{count:'exact',head:true}).eq('community_id', activeCommunity.id);
    $('engDetailMeta').textContent = `${count||0} member${count===1?'':'s'} · ${activeCommunity.is_private?'Private':'Public'}`;
    let joined = false;
    if (user) { const { data } = await sb.from('mj_community_members').select('user_id').eq('community_id', activeCommunity.id).eq('user_id', user.id).maybeSingle(); joined = !!data; }
    const btn = $('engDetailJoin');
    btn.textContent = joined ? 'Joined' : (activeCommunity.approval_required || activeCommunity.is_private ? 'Request to join' : 'Join');
    btn.disabled = joined;
    $('engComposer').hidden = !joined;
    $('engCreateFab').hidden = !joined;
  }
  $('engDetailJoin').onclick = async () => {
    if (!activeCommunity) return;
    if (!user) { toastFallback('Sign in to join this community.'); return; }
    const btn = $('engDetailJoin'); btn.disabled = true; btn.textContent = 'Working…';
    try {
      if (activeCommunity.is_private || activeCommunity.approval_required) {
        const { error } = await sb.rpc('mj_request_community_join', { p_community_id: activeCommunity.id });
        if (error && !/duplicate|unique/i.test(error.message||'')) throw error;
        btn.textContent = 'Request sent';
      } else {
        const { error } = await sb.from('mj_community_members').insert({ community_id: activeCommunity.id, user_id: user.id, role: 'member' });
        if (error && !/duplicate|unique/i.test(error.message||'')) throw error;
      }
      await refreshMemberMeta();
    } catch (err) { toastFallback('Could not join: ' + (err.message||err)); btn.disabled = false; }
  };
  $('engCreateFab').onclick = () => { $('engComposer').hidden = false; $('engComposer').scrollIntoView({behavior:'smooth',block:'center'}); };

  function renderTabs(){
    $('engDetailTabs').innerHTML = TABS.map(t => `<button type="button" class="chip ${activeTab===t.key?'on':''}" data-eng-tab="${esc(t.key)}" role="tab" aria-selected="${activeTab===t.key}">${esc(t.label)}</button>`).join('');
    $('engDetailTabs').querySelectorAll('[data-eng-tab]').forEach(b => b.onclick = () => { activeTab = b.dataset.engTab; renderTabs(); loadFeed(); });
  }

  async function loadFeed(){
    const host = $('engFeed');
    if (!activeCommunity) return;
    host.innerHTML = '<p class="live-empty">Loading discussions…</p>';
    let q = sb.from('mj_posts').select('id,author_id,community_id,post_type,body,image_urls,created_at').eq('community_id', activeCommunity.id).order('created_at',{ascending:false}).limit(40);
    if (activeTab) q = q.eq('post_type', activeTab); else q = q.is('post_type', null).or('post_type.not.is.null'); // all types
    if (activeTab) { /* exact filter already applied above */ }
    const { data, error } = activeTab ? await sb.from('mj_posts').select('id,author_id,community_id,post_type,body,image_urls,created_at').eq('community_id', activeCommunity.id).eq('post_type', activeTab).order('created_at',{ascending:false}).limit(40)
      : await sb.from('mj_posts').select('id,author_id,community_id,post_type,body,image_urls,created_at').eq('community_id', activeCommunity.id).order('created_at',{ascending:false}).limit(40);
    if (error) { host.innerHTML = `<p class="live-empty">Could not load discussions: ${esc(error.message)}</p>`; return; }
    communityPosts = data || [];
    await profilesFor(communityPosts.map(p => p.author_id));
    await loadEngagement(communityPosts.map(p => p.id));
    renderFeed();
  }

  async function loadEngagement(ids){
    if (!ids.length) return;
    const [likesRes, myLikesRes, commentsRes] = await Promise.all([
      sb.from('mj_post_likes').select('post_id').in('post_id', ids),
      user ? sb.from('mj_post_likes').select('post_id').eq('user_id', user.id).in('post_id', ids) : Promise.resolve({data:[]}),
      sb.from('mj_comments').select('post_id').in('post_id', ids)
    ]);
    ids.forEach(id => likeCounts.set(id, 0));
    (likesRes.data||[]).forEach(r => likeCounts.set(r.post_id, (likeCounts.get(r.post_id)||0)+1));
    const mine = new Set((myLikesRes.data||[]).map(r => r.post_id));
    ids.forEach(id => likeState.set(id, mine.has(id)));
    ids.forEach(id => commentCounts.set(id, 0));
    (commentsRes.data||[]).forEach(r => commentCounts.set(r.post_id, (commentCounts.get(r.post_id)||0)+1));
  }

  function renderFeed(){
    const host = $('engFeed');
    if (!communityPosts.length) { host.innerHTML = '<p class="live-empty">No posts yet in this tab. Be the first to share one.</p>'; return; }
    host.innerHTML = communityPosts.map(p => {
      const u = userOf(p.author_id), liked = likeState.get(p.id), likeN = likeCounts.get(p.id)||0, commentN = commentCounts.get(p.id)||0;
      const photo = Array.isArray(p.image_urls) && p.image_urls[0] ? `<img class="eng-post-photo" loading="lazy" src="${esc(p.image_urls[0])}" alt="">` : '';
      return `<article class="live-post" data-eng-post="${p.id}"><div class="live-post-head"><div class="avatar">${u.avatar_url?`<img src="${esc(u.avatar_url)}" alt="" loading="lazy">`:esc((u.nickname||'M').slice(0,1).toUpperCase())}</div><div><strong>${esc(u.nickname||'Mjadala member')}</strong><small>${dateText(p.created_at)}</small></div></div>${photo}<div class="live-post-body">${p.post_type?`<span class="eng-post-type-pill">${esc(p.post_type)}</span>`:''}${esc(p.body)}</div><div class="live-post-actions"><button type="button" data-eng-like="${p.id}" aria-pressed="${!!liked}">${liked?'♥':'♡'} ${likeN}</button><button type="button" data-eng-comments="${p.id}">Comments · ${commentN}</button><button type="button" data-eng-share="${p.id}">Share</button></div>${openComments.has(p.id)?`<div class="eng-comment-box" id="eng-comments-${p.id}"><p class="live-empty">Loading comments…</p></div>`:''}</article>`;
    }).join('');
    openComments.forEach(id => loadCommentsFor(id));
  }

  function dateText(iso){ try { const d = new Date(iso), diff = (Date.now()-d.getTime())/1000; if (diff<60) return 'just now'; if (diff<3600) return Math.floor(diff/60)+'m ago'; if (diff<86400) return Math.floor(diff/3600)+'h ago'; return d.toLocaleDateString(); } catch { return ''; } }
  function toastFallback(msg){ if (typeof window.showToast === 'function') window.showToast(msg); else alert(msg); }

  document.addEventListener('click', async e => {
    const like = e.target.closest('[data-eng-like]');
    if (like) {
      if (!user) { toastFallback('Sign in to like posts.'); return; }
      const id = like.dataset.engLike, liked = likeState.get(id);
      likeState.set(id, !liked); likeCounts.set(id, (likeCounts.get(id)||0) + (liked?-1:1)); renderFeed();
      if (liked) await sb.from('mj_post_likes').delete().eq('post_id', id).eq('user_id', user.id);
      else await sb.from('mj_post_likes').insert({ post_id: id, user_id: user.id }).then(r => { if (r.error && !/duplicate|unique/i.test(r.error.message||'')) { likeState.set(id,false); likeCounts.set(id,(likeCounts.get(id)||0)-1); renderFeed(); } });
      return;
    }
    const comments = e.target.closest('[data-eng-comments]');
    if (comments) { const id = comments.dataset.engComments; if (openComments.has(id)) openComments.delete(id); else openComments.add(id); renderFeed(); return; }
    const share = e.target.closest('[data-eng-share]');
    if (share) {
      const id = share.dataset.engShare, p = communityPosts.find(x => x.id === id);
      const text = p ? p.body.slice(0,120) : 'Check out this post on Mjadala Engineering';
      if (navigator.share) { try { await navigator.share({ title: 'Mjadala Engineering', text }); } catch {} }
      else if (navigator.clipboard) { await navigator.clipboard.writeText(text); toastFallback('Post text copied.'); }
      return;
    }
    const sendComment = e.target.closest('[data-eng-send-comment]');
    if (sendComment) {
      const id = sendComment.dataset.engSendComment, box = $('eng-comments-'+id), textarea = box?.querySelector('textarea');
      if (!user) { toastFallback('Sign in to comment.'); return; }
      const body = textarea?.value.trim();
      if (!body) return;
      sendComment.disabled = true;
      const { error } = await sb.from('mj_comments').insert({ post_id: id, author_id: user.id, body });
      sendComment.disabled = false;
      if (error) { toastFallback('Could not comment: ' + error.message); return; }
      textarea.value = '';
      commentCounts.set(id, (commentCounts.get(id)||0) + 1);
      await loadCommentsFor(id);
      renderFeed();
    }
  });

  async function loadCommentsFor(postId){
    const box = $('eng-comments-'+postId);
    if (!box) return;
    const { data, error } = await sb.from('mj_comments').select('id,author_id,body,created_at').eq('post_id', postId).order('created_at',{ascending:true}).limit(60);
    if (error) { box.innerHTML = `<p class="live-empty">Comments unavailable: ${esc(error.message)}</p>`; return; }
    await profilesFor((data||[]).map(c => c.author_id));
    box.innerHTML = (data||[]).map(c => `<div class="eng-comment-row"><b>${esc(userOf(c.author_id).nickname||'Mjadala member')}</b> · ${dateText(c.created_at)}<br>${esc(c.body)}</div>`).join('') + `<textarea placeholder="Write a comment…" maxlength="1500"></textarea><button type="button" class="mini-btn" data-eng-send-comment="${postId}">Send</button>`;
  }

  let pendingPhoto = null;
  $('engPostPhoto').addEventListener('change', () => {
    pendingPhoto = $('engPostPhoto').files[0] || null;
    $('engPostPhotoName').textContent = pendingPhoto ? pendingPhoto.name : '';
  });
  $('engPostSubmit').onclick = async () => {
    const status = $('engPostStatus');
    if (!user) { status.textContent = 'Sign in to post.'; return; }
    if (!activeCommunity) return;
    const body = $('engPostBody').value.trim();
    if (!body) { status.textContent = 'Write something first.'; return; }
    const btn = $('engPostSubmit'); btn.disabled = true; status.textContent = 'Posting…';
    try {
      let imageUrls = [];
      if (pendingPhoto) {
        if (pendingPhoto.size > 8*1024*1024) throw new Error('Photo must be 8 MB or smaller.');
        const path = `${user.id}/${crypto.randomUUID()}-${pendingPhoto.name.replace(/[^a-zA-Z0-9._-]/g,'_')}`;
        const up = await sb.storage.from('mj-community-posts').upload(path, pendingPhoto, { upsert:false, contentType: pendingPhoto.type });
        if (up.error) throw up.error;
        const { data: pub } = sb.storage.from('mj-community-posts').getPublicUrl(path);
        imageUrls = [pub.publicUrl];
      }
      const postType = $('engPostType').value || null;
      const { error } = await sb.from('mj_posts').insert({ author_id: user.id, community_id: activeCommunity.id, topic: 'Engineering', post_type: postType, body, image_urls: imageUrls });
      if (error) throw error;
      status.textContent = 'Posted.';
      $('engPostBody').value = ''; $('engPostType').value = ''; $('engPostPhoto').value = ''; $('engPostPhotoName').textContent = ''; pendingPhoto = null;
      await loadFeed();
    } catch (err) { status.textContent = 'Could not post: ' + (err.message || err); }
    finally { btn.disabled = false; }
  };

  sb.auth.getSession().then(({ data }) => { user = data.session?.user || null; });
  sb.auth.onAuthStateChange((_e, session) => { user = session?.user || null; });
})();
