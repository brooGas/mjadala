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
  let isAdmin = false;
  let subtopicFilter = null;
  let communities = [];
  const engCommunityIds = new Set(); // ids of every Engineering community, kept warm so the
                                      // old Communities-tab "View" buttons can be redirected here.
  let activeCommunity = null;
  let activeTab = '';
  let communityPosts = [];
  let adPlans = [];
  let engAds = [];
  let adCurrent = 0;
  let adTimer = null;
  let adPaused = false;
  let pendingAdMediaFile = null;
  const profileCache = new Map();
  const likeState = new Map();   // postId -> boolean liked (by me)
  const likeCounts = new Map();  // postId -> count
  const commentCounts = new Map();
  const openComments = new Set();
  const GEAR_SVG = '<svg class="std-icon" viewBox="0 0 24 24" style="width:24px;height:24px"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9c.14.47.43.88.84 1.17.3.2.65.32 1.02.34H21a2 2 0 1 1 0 4h-.09c-.47.02-.92.19-1.3.47-.27.2-.49.46-.63.76Z"/></svg>';
  function createFocalPicker(previewEl, imgEl){
    let fx = 50, fy = 50;
    function apply(){ imgEl.style.objectPosition = `${fx}% ${fy}%`; }
    function dragAt(clientX, clientY){
      const r = previewEl.getBoundingClientRect();
      fx = Math.max(0, Math.min(100, ((clientX - r.left) / r.width) * 100));
      fy = Math.max(0, Math.min(100, ((clientY - r.top) / r.height) * 100));
      apply();
    }
    let dragging = false;
    previewEl.addEventListener('pointerdown', e => { dragging = true; previewEl.classList.add('dragging'); previewEl.setPointerCapture(e.pointerId); dragAt(e.clientX, e.clientY); });
    previewEl.addEventListener('pointermove', e => { if (dragging) dragAt(e.clientX, e.clientY); });
    ['pointerup','pointercancel'].forEach(evt => previewEl.addEventListener(evt, () => { dragging = false; previewEl.classList.remove('dragging'); }));
    return { reset(x,y){ fx = (x==null?50:x); fy = (y==null?50:y); apply(); }, get x(){ return Math.round(fx); }, get y(){ return Math.round(fy); } };
  }

  const style = document.createElement('style');
  style.textContent = `
  #engineeringHub,#engCommunityDetail,#engAdsDashboard{position:absolute;inset:0;z-index:30;background:var(--paper);color:var(--ink);display:flex;flex-direction:column;overflow:hidden}
  #engineeringHub[hidden],#engCommunityDetail[hidden],#engAdsDashboard[hidden]{display:none!important}
  .eng-top{display:flex;align-items:center;gap:10px;padding:12px 15px;border-bottom:1px solid var(--line);background:var(--paper);flex:0 0 auto}
  .eng-top h2{font-size:16px;margin:0;flex:1}
  .eng-back{border:1px solid var(--line);background:#fff;border-radius:11px;width:34px;height:34px;display:grid;place-items:center;color:var(--green);flex:0 0 auto}
  .eng-body{flex:1;overflow-y:auto;overscroll-behavior:contain;padding:12px 15px calc(84px + env(safe-area-inset-bottom))}
  .eng-hero p.eyebrow{color:#f5dca8}
  .eng-sub-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:6px;margin:4px 0 2px}
  .eng-sub-chip{display:flex;flex-direction:column;align-items:center;gap:5px;border:1px solid var(--line);background:#fff;border-radius:13px;padding:9px 3px;font-size:9px;font-weight:750;color:var(--ink);text-align:center;line-height:1.2}
  .eng-sub-chip .eng-sub-ico{width:30px;height:30px;border-radius:50%;background:var(--soft);color:var(--green);display:grid;place-items:center}
  .eng-sub-chip.on{border-color:var(--green);background:#eef5ee}
  .eng-sub-chip.on .eng-sub-ico{background:var(--green);color:#fff}
  .eng-btn-primary{border:0;border-radius:12px;padding:10px 14px;background:var(--green);color:#fff;font-size:12px;font-weight:850;display:inline-flex;align-items:center;gap:6px}
  .eng-btn-primary:hover{background:var(--green2)}
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
  .eng-comm-card .eng-comm-ico{width:84px;height:84px;border-radius:16px;background:var(--soft);color:var(--green);display:grid;place-items:center}
  .eng-comm-card strong{font-size:12px;line-height:1.25;display:flex;align-items:center;gap:4px}
  .eng-comm-card .eng-verify{color:var(--green)}
  .eng-comm-card small{color:var(--muted);font-size:10px}
  .eng-comm-card button{margin-top:2px}
  .eng-comm-banner{background:linear-gradient(120deg,#174d35,#2f7757);color:#fff;border-radius:18px;padding:16px;display:flex;align-items:center;gap:12px;margin-bottom:4px}
  .eng-comm-banner .eng-comm-avatar{width:72px;height:72px;border-radius:16px;background:#ffffff22;border:1px solid #ffffff40;color:#fff;display:grid;place-items:center;flex:0 0 auto}
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
  .eng-pos-preview{position:relative;overflow:hidden;border-radius:16px;min-height:160px;background:var(--soft);margin:6px 0 2px;cursor:grab;touch-action:none;user-select:none;display:none}
  .eng-pos-preview.has-image{display:block}
  .eng-pos-preview.dragging{cursor:grabbing}
  .eng-pos-preview img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;pointer-events:none}
  .eng-pos-preview .eng-pos-hint{position:absolute;left:0;right:0;bottom:0;padding:7px 10px;background:linear-gradient(0deg,#000a,transparent);color:#fff;font-size:10px;font-weight:700}
  .eng-comm-avatar{position:relative;overflow:hidden}
  .eng-comm-avatar img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
  .eng-avatar-edit-btn{position:absolute;right:-4px;bottom:-4px;width:26px;height:26px;border-radius:50%;background:var(--green);color:#fff;border:2px solid #fff;display:grid;place-items:center;font-size:12px;z-index:1;line-height:1}
  .eng-comm-card .eng-comm-ico{position:relative;overflow:hidden}
  .eng-comm-card .eng-comm-ico img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
  .eng-plan-row{display:flex;align-items:center;gap:8px;justify-content:space-between;border:1px solid var(--line);border-radius:11px;padding:9px 10px;margin:6px 0;font-size:12px}
  .eng-plan-row .eng-plan-actions{display:flex;gap:6px;flex:0 0 auto}
  .eng-plan-row .eng-plan-actions button{border:1px solid #c7d9cc;background:#f2f8f1;color:var(--green);border-radius:8px;padding:5px 8px;font-size:10px;font-weight:800}
  .eng-pay-box{border:1px dashed #d9bd7b;background:#fffaf0;border-radius:11px;padding:9px;margin:8px 0;font-size:11px;color:#6b5c38}
  #engMyAds h5{font-size:11px;margin:10px 0 6px;color:var(--muted);text-transform:uppercase;letter-spacing:.04em}
  #engAdPaymentFields[hidden]{display:none}
  `;
  document.head.append(style);

  const hub = document.createElement('div');
  hub.id = 'engineeringHub'; hub.hidden = true;
  hub.innerHTML = `
    <div class="eng-top"><button type="button" class="eng-back" id="engHubBack" aria-label="Back">←</button><h2>Engineering</h2></div>
    <div class="eng-body">
      <div class="row-card" id="engAdPromoRow"><div class="thumb"><svg class="std-icon"><use href="#i-zap"/></svg></div><div class="grow"><h4>Engineering Ads Dashboard</h4><p>Promote a campaign and review submissions.</p></div><button type="button" class="mini-btn" id="engAdFormToggle">Open</button></div>
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
        <div class="eng-comm-avatar" id="engDetailAvatar"><svg class="std-icon" viewBox="0 0 24 24" style="width:24px;height:24px"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9c.14.47.43.88.84 1.17.3.2.65.32 1.02.34H21a2 2 0 1 1 0 4h-.09c-.47.02-.92.19-1.3.47-.27.2-.49.46-.63.76Z"/></svg></div>
        <div class="grow"><h3 id="engDetailName">—</h3><p id="engDetailMeta">—</p></div>
        <button type="button" class="eng-btn-primary" id="engDetailJoin">Join</button>
      </div>
      <section class="owner-panel" id="engAvatarEditor" hidden>
        <h4>Community photo</h4>
        <p class="subtle">Choose a photo, then drag it to pick what shows.</p>
        <div class="field"><label>Photo</label><input id="engAvatarFile" type="file" accept="image/*"></div>
        <div class="eng-pos-preview" id="engAvatarPreview"><img id="engAvatarPreviewImg" alt=""><div class="eng-pos-hint">Drag to reposition</div></div>
        <div class="owner-actions"><button type="button" class="eng-btn-primary" id="engAvatarSave">Save photo</button><button type="button" class="secondary" id="engAvatarCancel">Cancel</button></div>
        <p class="subtle" id="engAvatarMessage" aria-live="polite"></p>
      </section>
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
    <button type="button" class="eng-btn-primary" id="engCreateFab" style="position:absolute;right:16px;bottom:16px;border-radius:999px;box-shadow:0 6px 18px #0003;z-index:5">+ Create Post</button>`;
  host.appendChild(detail);

  const dashboard = document.createElement('div');
  dashboard.id = 'engAdsDashboard'; dashboard.hidden = true;
  dashboard.innerHTML = `
    <div class="eng-top"><button type="button" class="eng-back" id="engAdsDashBack" aria-label="Back">←</button><h2>Engineering Ads Dashboard</h2></div>
    <div class="eng-body">
      <section class="owner-panel" id="engAdFormBody">
        <h4>Promote in Engineering</h4>
        <p class="subtle">Ads are reviewed by an admin before they go live.</p>
        <div class="field"><label>Headline</label><input id="engAdTitle" maxlength="90" placeholder="What should engineers notice?"></div>
        <div class="field"><label>Description</label><textarea id="engAdDescription" rows="2" maxlength="240" placeholder="A short, clear message"></textarea></div>
        <div class="field"><label>Photo or video</label><input id="engAdMedia" type="file" accept="image/*,video/mp4,video/webm,video/quicktime"></div>
        <div class="eng-pos-preview" id="engAdPosPreview"><img id="engAdPosImg" alt=""><div class="eng-pos-hint">Drag to choose what shows</div></div>
        <div class="field-grid">
          <div class="field"><label>Show under</label><select id="engAdSubtopic"><option value="">All of Engineering</option>${SUBTOPICS.map(s => `<option value="${esc(s.key)}">${esc(s.label)}</option>`).join('')}</select></div>
          <div class="field"><label>Button text</label><select id="engAdCta"><option>Learn more</option><option>Shop now</option><option>Contact us</option><option>Visit website</option></select></div>
        </div>
        <div class="field-grid">
          <div class="field"><label>Destination link (optional)</label><input id="engAdUrl" type="url" placeholder="https://…"></div>
          <div class="field"><label>Plan</label><select id="engAdPlan"></select></div>
        </div>
        <div id="engAdPlanInfo" class="eng-pay-box" hidden></div>
        <div id="engAdPaymentFields" hidden>
          <div class="field"><label>Phone number for the M-Pesa prompt</label><input id="engAdPayPhone" maxlength="20" placeholder="07… or 2547…"></div>
          <p class="subtle">We'll send a Safaricom STK push to this number once you submit. Already paid another way?</p>
          <div class="field"><label>M-Pesa code you paid with (optional)</label><input id="engAdPayRef" maxlength="40" placeholder="e.g. QFT7X8ABCD"></div>
        </div>
        <div class="owner-actions"><button type="button" class="eng-btn-primary" id="engAdSubmit">Submit for review</button></div>
        <p class="subtle" id="engAdMessage" aria-live="polite"></p>
        <div id="engAdStkStatus"></div>
        <div id="engMyAds"></div>
      </section>
      <section class="owner-panel" id="engAdAdmin" hidden>
        <h4>Engineering ads review</h4>
        <p class="subtle">Review submitted campaigns — plan, payment and media — before they go live.</p>
        <div id="engAdReviewList">Loading…</div>
        <button type="button" class="mini-btn" id="engPlanManageToggle" aria-expanded="false" style="margin-top:10px">Manage ad plans</button>
        <div id="engPlanManage" hidden>
          <div id="engPlanList"></div>
          <h4 style="margin-top:12px">Add a plan</h4>
          <div class="field"><label>Name</label><input id="engPlanName" maxlength="60" placeholder="e.g. Starter"></div>
          <div class="field-grid">
            <div class="field"><label>Price (KES)</label><input id="engPlanPrice" type="number" min="0" step="1" value="0"></div>
            <div class="field"><label>Duration (days)</label><input id="engPlanDuration" type="number" min="1" step="1" value="7"></div>
          </div>
          <div class="field"><label><input id="engPlanFree" type="checkbox" style="width:auto;margin-right:6px">This is the free tier</label></div>
          <div class="field"><label>Payment instructions shown to advertisers (if paid)</label><textarea id="engPlanPayInstructions" rows="2" placeholder="e.g. Pay to Till 123456, then enter the M-Pesa code"></textarea></div>
          <div class="field"><label>Admin note (optional)</label><input id="engPlanDescription" maxlength="160" placeholder="Shown to advertisers"></div>
          <div class="owner-actions"><button type="button" class="eng-btn-primary" id="engPlanSave">Add plan</button></div>
          <p class="subtle" id="engPlanMessage" aria-live="polite"></p>
        </div>
      </section>
    </div>`;
  host.appendChild(dashboard);

  function openOverlay(el){ el.hidden = false; document.body.style.overflow = 'hidden'; }
  function closeOverlay(el){ el.hidden = true; document.body.style.overflow = ''; }
  function openAdsDashboard(){ openOverlay(dashboard); closeOverlay(hub); closeOverlay(detail); loadAdPlansForForm(); loadMyEngAds(); if (isAdmin) loadAdminAds(); }
  $('engAdsDashBack').onclick = () => { closeOverlay(dashboard); openOverlay(hub); };
  $('engAdFormToggle').onclick = () => openAdsDashboard();

  function openHub(){
    openOverlay(hub);
    renderSubGrid();
    loadTrending();
    loadCommunities();
  }
  $('engHubBack').onclick = () => closeOverlay(hub);

  // Tapping Home/Explore/Reels/Communities/Profile (or any in-app "see all"
  // link) must close the Engineering overlay so those key sections are
  // visible again underneath — the bottom nav itself always stays on screen.
  document.addEventListener('click', e => {
    if (e.target.closest('.nav-item') || e.target.closest('[data-go]')) {
      closeOverlay(detail); closeOverlay(hub); closeOverlay(dashboard);
    }
  }, true);

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
      loadEngAds();
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
    let q = sb.from('mj_communities').select('id,name,slug,description,subtopic,is_verified,is_private,approval_required,created_by,avatar_url,avatar_path,avatar_focal_x,avatar_focal_y').eq('topic','Engineering').order('name');
    if (subtopicFilter) q = q.eq('subtopic', subtopicFilter);
    const { data, error } = await q;
    if (error) { host.innerHTML = `<p class="live-empty">Communities unavailable: ${esc(error.message)}. Run MIGRATION_ENGINEERING_HUB.sql.</p>`; status.textContent=''; return; }
    communities = data || [];
    communities.forEach(c => engCommunityIds.add(c.id));
    status.textContent = `${communities.length} communit${communities.length===1?'y':'ies'}`;
    if (!communities.length) { host.innerHTML = '<p class="live-empty">No Engineering communities yet.</p>'; return; }
    host.innerHTML = communities.map(c => `<div class="eng-comm-card"><span class="eng-comm-ico" data-open-eng-community="${esc(c.id)}">${commIconInner(c)}${cardEditBtn(c.id)}</span><strong data-open-eng-community="${esc(c.id)}">${esc(c.name)}${c.is_verified?'<svg class="std-icon eng-verify" style="width:13px;height:13px"><use href="#i-check"/></svg>':''}</strong><small id="eng-members-${esc(c.id)}">Loading members…</small><button type="button" class="eng-btn-primary" style="justify-content:center" data-open-eng-community="${esc(c.id)}">View</button></div>`).join('');
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

  function commIconInner(c){
    if (c.avatar_url) return `<img src="${esc(c.avatar_url)}" alt="" loading="lazy" style="object-position:${c.avatar_focal_x ?? 50}% ${c.avatar_focal_y ?? 50}%">`;
    return GEAR_SVG;
  }
  function cardEditBtn(id){ return isAdmin ? `<button type="button" class="eng-avatar-edit-btn" data-edit-avatar="${esc(id)}" aria-label="Edit photo" title="Edit photo">✎</button>` : ''; }

  document.addEventListener('click', e => {
    const edit = e.target.closest('[data-edit-avatar]');
    if (edit) {
      e.stopImmediatePropagation();
      const c = communities.find(x => x.id === edit.dataset.editAvatar);
      if (c) openCommunityDetail(c).then(() => openAvatarEditor());
    }
  });
  document.addEventListener('click', e => {
    const open = e.target.closest('[data-open-eng-community]');
    if (open) { e.stopImmediatePropagation(); const c = communities.find(x => x.id === open.dataset.openEngCommunity); if (c) openCommunityDetail(c); }
  });

  // Engineering communities also show up in the app's original Communities
  // tab and in Home's "Popular spaces" (both use the older [data-open-community]
  // attribute, which opens a generic "Publish discussion" modal). Intercept
  // those taps in the capture phase — before that older handler runs — and
  // send them to our own Engineering community page instead, so there's only
  // one, better surface for an Engineering community. Other topics' communities
  // are untouched and keep using the original modal.
  sb.from('mj_communities').select('id').eq('topic','Engineering').then(({ data }) => (data || []).forEach(r => engCommunityIds.add(r.id)));
  document.addEventListener('click', e => {
    const old = e.target.closest('[data-open-community]');
    if (!old) return;
    const id = old.dataset.openCommunity;
    if (!engCommunityIds.has(id)) return;
    e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
    const existing = communities.find(x => x.id === id);
    if (existing) { openCommunityDetail(existing); return; }
    sb.from('mj_communities').select('id,name,slug,description,subtopic,is_verified,is_private,approval_required,created_by,avatar_url,avatar_path,avatar_focal_x,avatar_focal_y').eq('id', id).maybeSingle().then(({ data }) => {
      if (data) { communities.push(data); engCommunityIds.add(data.id); openCommunityDetail(data); }
    });
  }, true);

  async function openCommunityDetail(c){
    activeCommunity = c; activeTab = ''; communityPosts = [];
    $('engDetailName').innerHTML = `${esc(c.name)}${c.is_verified?'<svg class="std-icon" style="width:15px;height:15px;color:#f1d18a"><use href="#i-check"/></svg>':''}`;
    $('engDetailTitle').textContent = c.subtopic || 'Engineering';
    $('engDetailDesc').textContent = c.description || '';
    $('engDetailMeta').textContent = 'Loading members…';
    $('engDetailAvatar').innerHTML = commIconInner(c) + cardEditBtn(c.id);
    renderTabs();
    closeAvatarEditor();
    openOverlay(detail);
    closeOverlay(hub);
    await refreshMemberMeta();
    await loadFeed();
  }
  $('engDetailBack').onclick = () => { closeOverlay(detail); openOverlay(hub); loadCommunities(); };

  // Community photo editor — drag-to-reposition, same mechanism as ad media.
  let avatarObjectUrl = null, pendingAvatarFile = null;
  const avatarFocal = createFocalPicker($('engAvatarPreview'), $('engAvatarPreviewImg'));
  function openAvatarEditor(){
    if (!isAdmin || !activeCommunity) return;
    $('engAvatarEditor').hidden = false;
    $('engAvatarEditor').scrollIntoView({behavior:'smooth',block:'center'});
    avatarFocal.reset(activeCommunity.avatar_focal_x, activeCommunity.avatar_focal_y);
    if (activeCommunity.avatar_url) { $('engAvatarPreviewImg').src = activeCommunity.avatar_url; $('engAvatarPreview').classList.add('has-image'); }
  }
  function closeAvatarEditor(){
    $('engAvatarEditor').hidden = true;
    $('engAvatarMessage').textContent = '';
    pendingAvatarFile = null;
  }
  $('engAvatarCancel').onclick = closeAvatarEditor;
  $('engAvatarFile').addEventListener('change', () => {
    pendingAvatarFile = $('engAvatarFile').files[0] || null;
    if (avatarObjectUrl) { URL.revokeObjectURL(avatarObjectUrl); avatarObjectUrl = null; }
    if (pendingAvatarFile) {
      avatarFocal.reset(50, 50);
      avatarObjectUrl = URL.createObjectURL(pendingAvatarFile);
      $('engAvatarPreviewImg').src = avatarObjectUrl;
      $('engAvatarPreview').classList.add('has-image');
    }
  });
  $('engAvatarSave').onclick = async () => {
    const msg = $('engAvatarMessage');
    if (!activeCommunity) return;
    if (!pendingAvatarFile && !activeCommunity.avatar_url) { msg.textContent = 'Choose a photo first.'; return; }
    const btn = $('engAvatarSave'); btn.disabled = true; msg.textContent = 'Saving…';
    try {
      const patch = { avatar_focal_x: avatarFocal.x, avatar_focal_y: avatarFocal.y };
      if (pendingAvatarFile) {
        if (pendingAvatarFile.size > 6*1024*1024) throw new Error('Photo must be 6 MB or smaller.');
        const path = `${activeCommunity.id}/${crypto.randomUUID()}-${pendingAvatarFile.name.replace(/[^a-zA-Z0-9._-]/g,'_')}`;
        const up = await sb.storage.from('mj-community-avatars').upload(path, pendingAvatarFile, { upsert:false, contentType: pendingAvatarFile.type });
        if (up.error) throw up.error;
        const { data: pub } = sb.storage.from('mj-community-avatars').getPublicUrl(path);
        patch.avatar_url = pub.publicUrl; patch.avatar_path = path;
      }
      const { data: updated, error } = await sb.from('mj_communities').update(patch).eq('id', activeCommunity.id)
        .select('id,avatar_url,avatar_path,avatar_focal_x,avatar_focal_y').maybeSingle();
      if (error) throw error;
      // Supabase/PostgREST returns no error when RLS silently matches 0 rows — without this
      // check the UI would show "Saved" while nothing was actually written, and the photo
      // would vanish on the next real load. Treat that as a real failure instead.
      if (!updated) throw new Error('Not saved — run MIGRATION_ENGINEERING_ADS_AND_AVATARS.sql (admin update policy) or confirm this account is a Mjadala admin.');
      Object.assign(activeCommunity, updated);
      const idx = communities.findIndex(x => x.id === activeCommunity.id);
      if (idx > -1) Object.assign(communities[idx], updated);
      $('engDetailAvatar').innerHTML = commIconInner(activeCommunity) + cardEditBtn(activeCommunity.id);
      msg.textContent = 'Saved.';
      pendingAvatarFile = null;
      setTimeout(closeAvatarEditor, 700);
    } catch (err) { msg.textContent = 'Could not save: ' + (err.message || err); }
    finally { btn.disabled = false; }
  };

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

  // ---------- Engineering ads: plans, player, submission, admin review ----------
  const adBucket = 'mjadala-ads';

  function planLabel(p){ return `${p.name} — ${p.is_free || Number(p.price_kes) === 0 ? 'Free' : 'KES ' + Number(p.price_kes).toLocaleString()} / ${p.duration_days}d`; }

  async function loadAdPlansForForm(){
    const sel = $('engAdPlan');
    const { data, error } = await sb.from('mj_ad_plans').select('*').eq('is_active', true).order('sort_order');
    adPlans = error ? [] : (data || []);
    sel.innerHTML = adPlans.length ? adPlans.map(p => `<option value="${esc(p.id)}">${esc(planLabel(p))}</option>`).join('') : '<option value="">No plans available yet</option>';
    updatePlanInfo();
  }
  function updatePlanInfo(){
    const plan = adPlans.find(p => p.id === $('engAdPlan').value);
    const info = $('engAdPlanInfo'), payFields = $('engAdPaymentFields');
    if (!plan) { info.hidden = true; payFields.hidden = true; return; }
    const free = plan.is_free || Number(plan.price_kes) === 0;
    info.hidden = false;
    info.innerHTML = free
      ? `<strong>${esc(plan.name)}</strong> — free, runs ${esc(String(plan.duration_days))} days.${plan.description ? ' ' + esc(plan.description) : ''}`
      : `<strong>${esc(plan.name)}</strong> — KES ${Number(plan.price_kes).toLocaleString()}, runs ${esc(String(plan.duration_days))} days.${plan.description ? ' ' + esc(plan.description) : ''}<br>${esc(plan.payment_instructions || 'Pay, then enter your M-Pesa code below so an admin can verify it before approving.')}`;
    payFields.hidden = free;
  }
  $('engAdPlan').addEventListener('change', updatePlanInfo);

  const adMediaFocal = createFocalPicker($('engAdPosPreview'), $('engAdPosImg'));
  $('engAdMedia').addEventListener('change', () => {
    pendingAdMediaFile = $('engAdMedia').files[0] || null;
    if ($('engAdMedia')._prevUrl) { URL.revokeObjectURL($('engAdMedia')._prevUrl); }
    if (pendingAdMediaFile && pendingAdMediaFile.type.startsWith('image/')) {
      adMediaFocal.reset(50, 50);
      const url = URL.createObjectURL(pendingAdMediaFile);
      $('engAdMedia')._prevUrl = url;
      $('engAdPosImg').src = url;
      $('engAdPosPreview').classList.add('has-image');
    } else {
      $('engAdPosPreview').classList.remove('has-image');
      $('engAdPosImg').removeAttribute('src');
    }
  });


  $('engAdSubmit').onclick = async () => {
    const msg = $('engAdMessage');
    if (!user) { msg.textContent = 'Sign in to submit an advert.'; return; }
    const title = $('engAdTitle').value.trim(), planId = $('engAdPlan').value;
    const plan = adPlans.find(p => p.id === planId);
    if (!title || !pendingAdMediaFile || !plan) { msg.textContent = 'Add a headline, a photo or video, and choose a plan.'; return; }
    const free = plan.is_free || Number(plan.price_kes) === 0;
    const payRef = $('engAdPayRef').value.trim();
    const payPhone = $('engAdPayPhone').value.trim();
    if (!free && !payRef && !payPhone) { msg.textContent = 'Enter a phone number for the M-Pesa prompt, or a code you already paid with.'; return; }
    if (pendingAdMediaFile.size > 50*1024*1024) { msg.textContent = 'Media must be 50 MB or smaller.'; return; }
    const mediaType = pendingAdMediaFile.type.startsWith('video/') ? 'video' : (pendingAdMediaFile.type.startsWith('image/') ? 'image' : null);
    if (!mediaType) { msg.textContent = 'Choose an image or video.'; return; }
    const btn = $('engAdSubmit'); btn.disabled = true; msg.textContent = 'Submitting…';
    try {
      const path = `${user.id}/${crypto.randomUUID()}-${pendingAdMediaFile.name.replace(/[^a-zA-Z0-9._-]/g,'_')}`;
      const up = await sb.storage.from(adBucket).upload(path, pendingAdMediaFile, { upsert:false, contentType: pendingAdMediaFile.type });
      if (up.error) throw up.error;
      const { data: pub } = sb.storage.from(adBucket).getPublicUrl(path);
      const endsAt = new Date(Date.now() + plan.duration_days * 86400000).toISOString();
      const payload = {
        user_id: user.id, title, description: $('engAdDescription').value.trim(),
        media_url: pub.publicUrl, media_path: path, media_type: mediaType,
        category: 'Engineering', audience: 'engineering', eng_subtopic: $('engAdSubtopic').value || null,
        destination_url: $('engAdUrl').value.trim() || null, cta_text: $('engAdCta').value,
        ends_at: endsAt, status: 'pending', plan_id: plan.id,
        payment_status: free ? 'n/a' : 'pending', payment_reference: free ? null : (payRef || null),
        payment_phone: free ? null : (payPhone || null),
        media_focal_x: mediaType === 'image' ? Math.round(adMediaFocal.x) : null,
        media_focal_y: mediaType === 'image' ? Math.round(adMediaFocal.y) : null
      };
      const { data: inserted, error } = await sb.from('mj_ad_campaigns').insert(payload).select('id').single();
      if (error) throw error;
      ['engAdTitle','engAdDescription','engAdMedia','engAdUrl','engAdPayRef','engAdPayPhone'].forEach(id => $(id).value = '');
      $('engAdPosPreview').classList.remove('has-image'); $('engAdPosImg').removeAttribute('src');
      pendingAdMediaFile = null; adMediaFocal.reset(50,50);
      if (free) {
        msg.textContent = 'Submitted. It will appear after admin approval.';
      } else if (payPhone && !payRef) {
        msg.textContent = 'Submitted. Starting the M-Pesa prompt…';
        await startAdStkPush(inserted.id, payPhone);
      } else {
        msg.textContent = 'Submitted. An admin will verify your payment code and review it shortly.';
      }
      loadMyEngAds();
    } catch (err) { msg.textContent = 'Could not submit: ' + (err.message || err); }
    finally { btn.disabled = false; }
  };

  // ---------- Daraja (M-Pesa STK push) for paid ad plans ----------
  // Requires the daraja-ad-stk-push / daraja-ad-stk-query Supabase Edge
  // Functions (see DARAJA_AD_EDGE_FUNCTIONS/ in the delivered files) to be
  // deployed with the same M-Pesa secrets as the rest of Mjadala. If they
  // are not deployed yet, this fails gracefully and the advertiser can still
  // pay manually and enter the M-Pesa code above.
  async function startAdStkPush(campaignId, phone){
    const status = $('engAdStkStatus');
    status.innerHTML = '<p class="subtle">Requesting the Safaricom prompt…</p>';
    try {
      if (!sb.functions) throw new Error('Payments are not set up yet.');
      const { data, error } = await sb.functions.invoke('daraja-ad-stk-push', { body: { campaign_id: campaignId, phone } });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error || 'The M-Pesa prompt was not confirmed.');
      status.innerHTML = `<p class="subtle">${esc(data.customer_message || 'Check your phone for the Safaricom prompt and enter your PIN. Never share your PIN with anyone, including Mjadala.')}</p>`;
      watchAdPayment(campaignId, status);
    } catch (err) {
      status.innerHTML = `<p class="subtle">Could not start the M-Pesa prompt (${esc(err.message || String(err))}). You can still pay manually and enter the M-Pesa code above, then resubmit, or contact an admin.</p>`;
    }
  }
  function watchAdPayment(campaignId, statusEl){
    let finished = false, channel = null, polls = 0;
    const apply = (row) => {
      if (!row || finished) return;
      if (row.payment_status === 'paid') {
        statusEl.innerHTML = `<p class="subtle">Paid · Safaricom receipt ${esc(row.payment_reference || 'confirmed')}. Your ad is now with an admin for review.</p>`;
        finished = true; if (channel && sb.removeChannel) sb.removeChannel(channel);
        loadMyEngAds();
      } else if (row.payment_status === 'rejected') {
        statusEl.innerHTML = '<p class="subtle">The M-Pesa payment was not completed. You can try again or enter a code manually.</p>';
        finished = true; if (channel && sb.removeChannel) sb.removeChannel(channel);
      }
    };
    if (sb.channel) {
      channel = sb.channel('eng-ad-pay-' + campaignId)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'mj_ad_campaigns', filter: 'id=eq.' + campaignId }, p => apply(p.new))
        .subscribe();
    }
    const poller = setInterval(() => {
      if (finished || ++polls > 30) { clearInterval(poller); return; }
      if (polls >= 3 && polls % 3 === 1 && sb.functions) { sb.functions.invoke('daraja-ad-stk-query', { body: { campaign_id: campaignId } }).catch(() => {}); }
      sb.from('mj_ad_campaigns').select('payment_status,payment_reference').eq('id', campaignId).maybeSingle().then(({ data }) => apply(data));
    }, 4000);
    setTimeout(() => { finished = true; clearInterval(poller); if (channel && sb.removeChannel) sb.removeChannel(channel); }, 150000);
  }

  async function loadMyEngAds(){
    const host = $('engMyAds');
    if (!user) { host.innerHTML = ''; return; }
    const { data, error } = await sb.from('mj_ad_campaigns').select('id,title,status,rejection_reason,payment_status,created_at').eq('user_id', user.id).eq('category','Engineering').order('created_at',{ascending:false}).limit(10);
    if (error || !data || !data.length) { host.innerHTML = ''; return; }
    const label = s => s==='approved' ? 'Live now' : s==='rejected' ? 'Rejected' : 'Pending review';
    host.innerHTML = `<h5>Your Engineering ads</h5>${data.map(a => `<div class="mj-my-ad-row"><span>${esc(a.title)}</span><span class="mj-ad-pill ${esc(a.status)}" title="${a.status==='rejected'&&a.rejection_reason?esc(a.rejection_reason):''}">${label(a.status)}</span></div>`).join('')}`;
  }

  function stopAd(){ if (adTimer) clearTimeout(adTimer); adTimer = null; }
  function scheduleAd(){ stopAd(); if (adPaused || !engAds.length) return; const a = engAds[adCurrent]; adTimer = setTimeout(() => { adCurrent++; renderAdPlayer(); }, a.media_type==='video' ? 10000 : 5000); }
  function renderAdPlayer(){
    stopAd();
    const player = $('engAdPlayer');
    if (!player) return; // the carousel now lives on Home; this page only has the dashboard entry
    if (!engAds.length) { player.innerHTML = '<div class="mj-ad-content"><span class="mj-ad-tag">MJADALA · ENGINEERING</span><h3>Reach engineers across every subtopic.</h3><p>Sponsored Engineering campaigns will appear here.</p><a class="mj-ad-cta" href="#" id="engAdCreateLink">Promote in Engineering</a></div>'; $('engAdCreateLink')?.addEventListener('click', e => { e.preventDefault(); openAdsDashboard(); }); return; }
    adCurrent = (adCurrent + engAds.length) % engAds.length;
    const a = engAds[adCurrent], fx = Number.isFinite(a.media_focal_x) ? a.media_focal_x : 50, fy = Number.isFinite(a.media_focal_y) ? a.media_focal_y : 50;
    const media = a.media_type === 'video' ? `<video class="mj-ad-media" src="${esc(a.media_url)}" muted playsinline autoplay></video>` : `<img class="mj-ad-media" src="${esc(a.media_url)}" alt="Sponsored campaign" style="object-position:${fx}% ${fy}%">`;
    player.innerHTML = `${media}<div class="mj-ad-shade"></div><div class="mj-ad-dots">${engAds.map((_,i) => `<button type="button" class="${i===adCurrent?'active':''}" data-eng-ad-dot="${i}" aria-label="Show advert ${i+1}"></button>`).join('')}</div><div class="mj-ad-controls"><button type="button" id="engAdPause" aria-label="Pause advert">Ⅱ</button><button type="button" id="engAdNext" aria-label="Next advert">›</button></div><div class="mj-ad-content"><span class="mj-ad-tag">SPONSORED · ${esc(a.eng_subtopic || 'Engineering')}</span><h3>${esc(a.title)}</h3><p>${esc(a.description)}</p>${a.destination_url?`<a class="mj-ad-cta" href="${esc(a.destination_url)}" target="_blank" rel="noopener">${esc(a.cta_text||'Learn more')}</a>`:`<span class="mj-ad-cta" aria-disabled="true">${esc(a.cta_text||'Learn more')}</span>`}</div>`;
    const video = player.querySelector('video'); if (video) video.play().catch(() => {});
    $('engAdPause').onclick = () => { adPaused = !adPaused; if (video) { adPaused ? video.pause() : video.play().catch(()=>{}); } $('engAdPause').textContent = adPaused ? '▶' : 'Ⅱ'; adPaused ? stopAd() : scheduleAd(); };
    $('engAdNext').onclick = () => { adCurrent++; renderAdPlayer(); };
    player.querySelectorAll('[data-eng-ad-dot]').forEach(b => b.onclick = () => { adCurrent = Number(b.dataset.engAdDot); renderAdPlayer(); });
    scheduleAd();
  }
  async function loadEngAds(){
    let q = sb.from('mj_ad_campaigns').select('id,title,description,media_url,media_type,eng_subtopic,destination_url,cta_text,media_focal_x,media_focal_y').eq('status','approved').eq('is_active',true).eq('category','Engineering').gt('ends_at', new Date().toISOString()).order('approved_at',{ascending:false}).limit(8);
    if (subtopicFilter) q = q.or(`eng_subtopic.eq.${subtopicFilter},eng_subtopic.is.null`);
    const { data, error } = await q;
    engAds = error ? [] : (data || []);
    renderAdPlayer();
  }

  async function loadAdminAds(){
    if (!isAdmin) return;
    const host = $('engAdReviewList');
    const { data, error } = await sb.from('mj_ad_campaigns').select('*,mj_ad_plans(name,price_kes,is_free,duration_days)').eq('status','pending').eq('category','Engineering').order('created_at');
    if (error) { host.textContent = error.message; return; }
    const rows = data || [];
    host.innerHTML = rows.length ? rows.map(a => {
      const plan = a.mj_ad_plans;
      const payPill = a.payment_status === 'paid' ? '<span class="mj-ad-pill approved">Paid</span>' : a.payment_status === 'rejected' ? '<span class="mj-ad-pill rejected">Payment rejected</span>' : a.payment_status === 'pending' ? '<span class="mj-ad-pill pending">Payment pending</span>' : '<span class="mj-ad-pill approved">Free plan</span>';
      return `<article class="eng-plan-row" style="flex-direction:column;align-items:stretch">
        <strong>${esc(a.title)}</strong>
        <p class="eng-comm-desc" style="margin:2px 0">${esc(a.description)}</p>
        <p class="eng-pay-box" style="margin:4px 0">Plan: <strong>${plan ? esc(plan.name) : '—'}</strong>${plan && !plan.is_free ? ' · KES ' + Number(plan.price_kes).toLocaleString() : ''} ${payPill}${a.payment_reference ? ' · ref ' + esc(a.payment_reference) : ''}${a.payment_phone ? ' · ' + esc(a.payment_phone) : ''}</p>
        <p class="subtle">${esc(a.eng_subtopic || 'All of Engineering')} · ${esc(a.media_type)} · ends ${esc(new Date(a.ends_at).toLocaleDateString())}</p>
        <a href="${esc(a.media_url)}" target="_blank" rel="noopener">Preview media</a>
        <div class="eng-plan-actions" style="margin-top:7px">
          ${a.payment_status === 'pending' ? `<button type="button" data-ad-mark-paid="${a.id}">Mark paid</button><button type="button" data-ad-mark-rejected="${a.id}">Mark unpaid</button>` : ''}
          <button type="button" class="eng-btn-primary" data-eng-ad-review="${a.id}" data-decision="approved">Approve</button>
          <button type="button" data-eng-ad-review="${a.id}" data-decision="rejected">Reject</button>
        </div>
      </article>`;
    }).join('') : '<p class="live-empty">No Engineering campaigns awaiting review.</p>';
    host.querySelectorAll('[data-eng-ad-review]').forEach(b => b.onclick = async () => {
      const id = b.dataset.engAdReview, decision = b.dataset.decision;
      let reason = '';
      if (decision === 'rejected') { reason = prompt('Reason for rejection (shown to advertiser):') || ''; if (!reason) return; }
      b.disabled = true;
      const { error } = await sb.from('mj_ad_campaigns').update({ status: decision, rejection_reason: reason, approved_at: decision==='approved' ? new Date().toISOString() : null, is_active: decision==='approved' }).eq('id', id);
      if (error) alert(error.message);
      await loadAdminAds(); await loadEngAds();
    });
    host.querySelectorAll('[data-ad-mark-paid]').forEach(b => b.onclick = async () => { b.disabled = true; const { error } = await sb.from('mj_ad_campaigns').update({ payment_status: 'paid' }).eq('id', b.dataset.adMarkPaid); if (error) alert(error.message); await loadAdminAds(); });
    host.querySelectorAll('[data-ad-mark-rejected]').forEach(b => b.onclick = async () => { b.disabled = true; const { error } = await sb.from('mj_ad_campaigns').update({ payment_status: 'rejected' }).eq('id', b.dataset.adMarkRejected); if (error) alert(error.message); await loadAdminAds(); });
  }

  // ---------- Admin: manage ad plans ----------
  $('engPlanManageToggle').onclick = () => {
    const open = $('engPlanManageToggle').getAttribute('aria-expanded') !== 'true';
    $('engPlanManageToggle').setAttribute('aria-expanded', open ? 'true' : 'false');
    $('engPlanManage').hidden = !open;
    if (open) loadPlanList();
  };
  async function loadPlanList(){
    const host = $('engPlanList');
    const { data, error } = await sb.from('mj_ad_plans').select('*').order('sort_order');
    if (error) { host.textContent = error.message; return; }
    host.innerHTML = (data||[]).map(p => `<div class="eng-plan-row"><span>${esc(p.name)} — ${p.is_free?'Free':'KES '+Number(p.price_kes).toLocaleString()} / ${p.duration_days}d ${p.is_active?'':'(inactive)'}</span><span class="eng-plan-actions"><button type="button" data-plan-toggle="${p.id}" data-active="${p.is_active}">${p.is_active?'Deactivate':'Activate'}</button><button type="button" data-plan-delete="${p.id}">Delete</button></span></div>`).join('') || '<p class="live-empty">No plans yet.</p>';
    host.querySelectorAll('[data-plan-toggle]').forEach(b => b.onclick = async () => { const active = b.dataset.active === 'true'; const { error } = await sb.from('mj_ad_plans').update({ is_active: !active }).eq('id', b.dataset.planToggle); if (error) alert(error.message); await loadPlanList(); await loadAdPlansForForm(); });
    host.querySelectorAll('[data-plan-delete]').forEach(b => b.onclick = async () => { if (!confirm('Delete this plan? Ads already submitted under it keep their record.')) return; const { error } = await sb.from('mj_ad_plans').delete().eq('id', b.dataset.planDelete); if (error) alert(error.message); await loadPlanList(); await loadAdPlansForForm(); });
  }
  $('engPlanSave').onclick = async () => {
    const msg = $('engPlanMessage');
    const name = $('engPlanName').value.trim();
    if (!name) { msg.textContent = 'Give the plan a name.'; return; }
    const isFree = $('engPlanFree').checked;
    const btn = $('engPlanSave'); btn.disabled = true; msg.textContent = 'Saving…';
    try {
      const { error } = await sb.from('mj_ad_plans').insert({
        name, description: $('engPlanDescription').value.trim(),
        price_kes: isFree ? 0 : Number($('engPlanPrice').value || 0),
        is_free: isFree, duration_days: Number($('engPlanDuration').value || 7),
        payment_instructions: $('engPlanPayInstructions').value.trim()
      });
      if (error) throw error;
      msg.textContent = 'Plan added.';
      ['engPlanName','engPlanDescription','engPlanPayInstructions'].forEach(id => $(id).value = '');
      $('engPlanPrice').value = 0; $('engPlanDuration').value = 7; $('engPlanFree').checked = false;
      await loadPlanList(); await loadAdPlansForForm();
    } catch (err) { msg.textContent = 'Could not save: ' + (err.message || err); }
    finally { btn.disabled = false; }
  };

  async function refreshAdminVisibility(){
    const r = await sb.rpc('mj_is_creator_admin');
    isAdmin = !r.error && r.data === true;
    $('engAdAdmin').hidden = !isAdmin;
    if (isAdmin) loadAdminAds();
    loadCommunities();
  }

  sb.auth.getSession().then(({ data }) => { user = data.session?.user || null; refreshAdminVisibility(); loadEngAds(); loadAdPlansForForm(); });
  sb.auth.onAuthStateChange((_e, session) => { user = session?.user || null; refreshAdminVisibility(); loadMyEngAds(); });
})();
