/* Mjadala Business Directory + creator administration. Requires the shared Supabase client. */
(() => {
  'use strict';
  const sb = window.mjadalaSupabaseClient;
  if (!sb) return;
  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let user = null, isCreator = false, plans = [], editingPlanId = null;
  const screen = document.querySelector('[data-screen="1"]');
  const catalog = $('businessProductCatalog');
  if (!screen || !catalog || $('mjadalaBusinessDirectory')) return;

  const style = document.createElement('style');
  style.textContent = `
    .biz-directory{border:1px solid var(--line);border-radius:16px;padding:13px;margin:12px 0;background:var(--paper);color:var(--ink)}
    .biz-dir-head{display:flex;align-items:center;justify-content:space-between;gap:10px}.biz-dir-head strong{font-size:14px}.biz-note{font-size:11px;color:var(--muted);margin:5px 0;line-height:1.45}
    .biz-dir-tabs{display:flex;gap:7px;overflow:auto;margin:11px 0}.biz-dir-tabs button,.biz-directory button{border:1px solid var(--line);border-radius:10px;padding:8px 11px;background:var(--soft);color:var(--ink);font-weight:750;font-size:11px;white-space:nowrap}
    .biz-dir-tabs button.active,.biz-directory button.biz-primary{background:var(--green);border-color:var(--green);color:#fff}
    .biz-directory input,.biz-directory textarea,.biz-directory select{width:100%;min-width:0;border:1px solid var(--line);border-radius:9px;padding:9px;background:var(--paper);color:var(--ink);font:inherit;font-size:12px;margin:4px 0 8px}
    .biz-directory label{display:block;font-size:11px;font-weight:750;margin-top:6px}.biz-dir-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:9px;margin-top:10px}.biz-dir-card{border:1px solid var(--line);border-radius:12px;padding:11px}.biz-dir-card strong{font-size:13px}.biz-dir-card p{font-size:11px;color:var(--muted);margin:5px 0}
    .biz-admin{border-top:1px solid var(--line);margin-top:15px;padding-top:13px}.biz-admin-head{display:flex;align-items:flex-start;justify-content:space-between;gap:8px;flex-wrap:wrap}.biz-admin h3{font-size:15px;margin:0}.biz-admin h4{font-size:12px;margin:15px 0 7px}
    .biz-metrics{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px;margin:11px 0}.biz-metric{border:1px solid var(--line);border-radius:11px;padding:9px;background:var(--soft)}.biz-metric small{display:block;color:var(--muted);font-size:10px}.biz-metric strong{display:block;font-size:18px;margin-top:3px}
    .biz-table-wrap{width:100%;overflow-x:auto;border:1px solid var(--line);border-radius:11px;margin:7px 0 12px}.biz-table{width:100%;border-collapse:collapse;min-width:570px;font-size:11px}.biz-table th,.biz-table td{padding:9px 8px;text-align:left;border-bottom:1px solid var(--line);vertical-align:middle}.biz-table th{background:var(--soft);font-size:10px;color:var(--muted);font-weight:800}.biz-table tr:last-child td{border-bottom:0}.biz-table td button{padding:7px 9px}.biz-table input,.biz-table select{margin:0;min-width:90px;padding:7px;font-size:11px}.biz-status{display:inline-block;border-radius:99px;padding:4px 7px;background:var(--soft);font-size:10px;font-weight:800}.biz-status.approved{color:#187647;background:#e8f6ee}.biz-status.pending{color:#956300;background:#fff5d9}.biz-status.rejected,.biz-status.suspended{color:#a33;background:#fcebea}
    .biz-admin-form{border:1px solid var(--line);border-radius:12px;padding:10px;margin:8px 0;background:var(--soft)}.biz-admin-form .biz-inline{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px}.biz-inline{display:flex;gap:7px;align-items:center;flex-wrap:wrap}.biz-inline>*{flex:1;min-width:85px}.biz-admin-actions{display:flex;gap:7px;flex-wrap:wrap}.biz-directory button:disabled{opacity:.55}.biz-price-wrap{overflow-x:auto;border:1px solid var(--line);border-radius:13px;margin:10px 0 13px}.biz-price-table{width:100%;min-width:610px;border-collapse:collapse;font-size:12px}.biz-price-table th,.biz-price-table td{padding:12px 10px;border-bottom:1px solid var(--line);text-align:left;vertical-align:middle}.biz-price-table th{background:var(--soft);font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.04em}.biz-price-table tr:last-child td{border-bottom:0}.biz-price-table .biz-price{font-size:15px;font-weight:850;color:var(--green)}.biz-plan-highlight{display:inline-block;padding:3px 7px;border-radius:99px;background:#e8f6ee;color:#187647;font-size:9px;font-weight:800}.biz-plan-actions{display:flex;gap:5px;flex-wrap:wrap}.biz-plan-actions button{font-size:10px;padding:6px 8px}.biz-public-plans{margin:10px 0 14px}.biz-public-plans h4{margin:0 0 5px;font-size:14px}.biz-public-plans .biz-note{margin-bottom:8px}
    @media(max-width:420px){.biz-metrics{gap:5px}.biz-metric{padding:7px}.biz-metric strong{font-size:16px}}
  `;
  document.head.append(style);

  const root = document.createElement('section');
  root.className = 'biz-directory';
  root.id = 'mjadalaBusinessDirectory';
  root.innerHTML = `
    <div class="biz-dir-head"><div><strong>Find a local business</strong><p class="biz-note">Discover approved traders and open their storefronts.</p></div><svg class="std-icon" viewBox="0 0 24 24"><path d="M3 10h18M5 10V6l2-3h10l2 3v4M5 10v11h14V10M9 21v-7h6v7"/></svg></div>
    <div class="biz-dir-tabs"><button type="button" id="bizDirectoryTab" class="active">Businesses</button><button type="button" id="bizAllProductsTab">All products</button><button type="button" id="bizApplyTab">Register a business</button></div>
    <div id="bizDirectoryView"><input id="bizDirectorySearch" placeholder="Search business name…" aria-label="Search business name"><div id="bizDirectoryResults" class="biz-dir-grid"><p class="biz-note">Loading businesses…</p></div></div>
    <div id="bizApplicationView" hidden><p class="biz-note" id="bizRegistrationNotice"></p><section class="biz-public-plans"><h4>Business plans & pricing</h4><p class="biz-note">Compare the available plans before applying. Mjadala will confirm approval and plan activation before publishing is enabled.</p><div id="bizPublicPlans"><p class="biz-note">Loading available plans…</p></div></section><label for="bizApplyName">Business or trading name</label><input id="bizApplyName" maxlength="100" placeholder="e.g. Mama Amina Vegetables"><label for="bizApplyDescription">What do you sell or offer?</label><textarea id="bizApplyDescription" rows="2" maxlength="500" placeholder="Brief description"></textarea><label for="bizApplyLocation">Location (area / estate / market)</label><input id="bizApplyLocation" maxlength="140" placeholder="e.g. Gikomba, Nairobi"><label for="bizApplyPhone">Contact phone (optional)</label><input id="bizApplyPhone" maxlength="30" placeholder="Phone number"><button type="button" class="biz-primary" id="bizSubmitApplication">Submit application</button><p class="biz-note" id="bizApplicationStatus" aria-live="polite"></p></div>
    <section class="biz-admin" id="bizCreatorAdmin" hidden>
      <div class="biz-admin-head"><div><h3>Creator business dashboard</h3><p class="biz-note">Review applications, manage approved sellers and control plans.</p></div><label style="display:flex;align-items:center;gap:7px;margin:0"><input type="checkbox" id="bizRegistrationSwitch" style="width:auto;margin:0"> Applications open</label></div>
      <div class="biz-metrics"><div class="biz-metric"><small>Pending applications</small><strong id="bizMetricPending">—</strong></div><div class="biz-metric"><small>Approved businesses</small><strong id="bizMetricApproved">—</strong></div><div class="biz-metric"><small>Available plans</small><strong id="bizMetricPlans">—</strong></div></div>
      <h4>Business applications</h4><div id="bizPendingApplications"><p class="biz-note">Loading…</p></div>
      <h4>Approved and existing businesses</h4><input id="bizExistingSearch" placeholder="Search business name…"><div id="bizExistingBusinesses"><p class="biz-note">Loading businesses…</p></div>
      <h4>Plans and pricing</h4><div id="bizPlanEditor"></div>
      <div class="biz-admin-form"><strong id="bizPlanFormTitle" style="font-size:12px">Add a business plan</strong><div class="biz-inline biz-admin-form-grid"><input id="bizPlanName" placeholder="Plan name"><input id="bizPlanPrice" type="number" min="0" step="1" placeholder="Price KSh"><input id="bizPlanDays" type="number" min="1" value="30" placeholder="Access days"><input id="bizPlanTrial" type="number" min="0" value="0" placeholder="Trial days"></div><input id="bizPlanDescription" placeholder="Plan benefits / description"><div class="biz-admin-actions"><button type="button" class="biz-primary" id="bizSavePlan">Add plan</button><button type="button" id="bizCancelPlanEdit" hidden>Cancel edit</button></div></div>
    </section>`;
  catalog.parentElement.insertBefore(root, catalog);

  const status = message => { const el = $('bizApplicationStatus'); if (el) el.textContent = message; };
  function setTab(which) {
    $('bizDirectoryView').hidden = which !== 'directory';
    $('bizApplicationView').hidden = which !== 'apply';
    $('bizDirectoryTab').classList.toggle('active', which === 'directory');
    $('bizApplyTab').classList.toggle('active', which === 'apply');
    $('bizAllProductsTab').classList.toggle('active', which === 'products');
  }
  function allProducts() {
    setTab('products');
    window.mjadalaBusinessSellerFilter = null;
    if (typeof window.mjadalaBusinessShowAllProducts === 'function') window.mjadalaBusinessShowAllProducts();
    else if (typeof window.mjadalaBusinessReloadProducts === 'function') window.mjadalaBusinessReloadProducts();
    catalog.scrollIntoView({behavior:'smooth', block:'start'});
  }
  function storefront(userId, name) {
    window.mjadalaBusinessSellerFilter = userId;
    if (typeof window.mjadalaBusinessOpenStorefront === 'function') window.mjadalaBusinessOpenStorefront();
    if (typeof window.mjadalaBusinessReloadProducts === 'function') window.mjadalaBusinessReloadProducts();
    const title = catalog.parentElement.querySelector('.section-title');
    if (title) title.innerHTML = `Products · ${esc(name)} <button type="button" id="bizBackToAll" class="mini-btn">All products</button>`;
    catalog.scrollIntoView({behavior:'smooth', block:'start'});
  }
  async function loadDirectory(query = '') {
    const host = $('bizDirectoryResults'); host.innerHTML = '<p class="biz-note">Searching…</p>';
    const {data,error} = await sb.rpc('mj_search_business_directory', {p_search:query});
    if (error) { host.innerHTML = `<p class="biz-note">Directory unavailable: ${esc(error.message)}</p>`; return; }
    host.innerHTML = data?.length ? data.map(b => `<article class="biz-dir-card"><strong>${esc(b.business_name)}</strong><p>${esc(b.business_description || 'Local business')}</p><p>${esc(b.business_location || 'Location not provided')}${b.business_phone ? ' · ' + esc(b.business_phone) : ''}</p><button type="button" data-storefront="${esc(b.user_id)}" data-business-name="${esc(b.business_name)}">View business</button></article>`).join('') : '<p class="biz-note">No approved businesses found yet.</p>';
  }
  function table(headers, rows) {
    return `<div class="biz-table-wrap"><table class="biz-table"><thead><tr>${headers.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${rows || `<tr><td colspan="${headers.length}" class="biz-note">No records to show.</td></tr>`}</tbody></table></div>`;
  }
  async function loadPublicPlans() {
    const host = $('bizPublicPlans');
    const {data,error} = await sb.from('mj_business_plans').select('id,plan_name,description,price_kes,billing_days,trial_days,is_free').eq('is_active',true).order('sort_order');
    if (error) { host.innerHTML = `<p class="biz-note">Plan pricing is temporarily unavailable. Please try again later.</p>`; return; }
    const activePlans = data || [];
    host.innerHTML = activePlans.length ? `<div class="biz-price-wrap"><table class="biz-price-table"><thead><tr><th>Plan</th><th>Price</th><th>Access</th><th>Trial</th><th>What's included</th></tr></thead><tbody>${activePlans.map((p,i)=>`<tr><td><strong>${esc(p.plan_name)}</strong>${i===1?'<br><span class="biz-plan-highlight">POPULAR</span>':''}</td><td><span class="biz-price">${p.is_free || Number(p.price_kes)===0?'Free':'KSh '+Number(p.price_kes).toLocaleString('en-KE')}</span></td><td>${Number(p.billing_days)} days</td><td>${Number(p.trial_days)>0?Number(p.trial_days)+' days':'—'}</td><td>${esc(p.description || 'Business listing and product publishing access, subject to approval')}</td></tr>`).join('')}</tbody></table></div>` : '<p class="biz-note">No business plans are currently available. Please check again later.</p>';
  }
  async function loadAdmin() {
    const sw = await sb.rpc('mj_get_business_registration_open');
    $('bizRegistrationSwitch').checked = !!sw.data;
    const p = await sb.from('mj_business_plans').select('*').order('sort_order');
    if (p.error) { $('bizPlanEditor').innerHTML = `<p class="biz-note">Could not load plans: ${esc(p.error.message)}</p>`; return; }
    plans = p.data || [];
    $('bizMetricPlans').textContent = plans.filter(x=>x.is_active).length;
    $('bizPlanEditor').innerHTML = plans.length ? table(['Plan','Price','Duration','Trial','Status','Manage'], plans.map(x=>`<tr><td><strong>${esc(x.plan_name)}</strong><br><span class="biz-note">${esc(x.description)}</span></td><td>KSh ${Number(x.price_kes).toLocaleString('en-KE')}</td><td>${x.billing_days} days</td><td>${x.trial_days} days</td><td><span class="biz-status ${x.is_active?'approved':'suspended'}">${x.is_active?'Active':'Suspended'}</span></td><td><div class="biz-plan-actions"><button type="button" data-edit-plan="${x.id}">Edit</button><button type="button" data-toggle-plan="${x.id}">${x.is_active?'Suspend':'Activate'}</button><button type="button" data-delete-plan="${x.id}">Delete</button></div></td></tr>`).join('')) : '<p class="biz-note">No plans created yet.</p>';
    const a = await sb.from('mj_business_applications').select('id,user_id,business_name,description,location_text,contact_phone,status,created_at').eq('status','pending').order('created_at',{ascending:true});
    if (a.error) $('bizPendingApplications').innerHTML = `<p class="biz-note">Could not load applications: ${esc(a.error.message)}</p>`;
    else {
      const rows = (a.data || []).map(x=>`<tr><td><strong>${esc(x.business_name)}</strong><br><span class="biz-note">${esc(x.description)}</span></td><td>${esc(x.location_text)}</td><td>${esc(x.contact_phone || '—')}</td><td><select data-plan-for="${x.id}">${plans.filter(z=>z.is_active).map(z=>`<option value="${z.id}">${esc(z.plan_name)} · KSh ${Number(z.price_kes).toLocaleString('en-KE')}</option>`).join('')}</select></td><td><input data-trial-for="${x.id}" type="number" min="0" value="0" aria-label="Trial days"></td><td><div class="biz-admin-actions"><button type="button" class="biz-primary" data-review="${x.id}" data-approve="true">Approve</button><button type="button" data-review="${x.id}" data-approve="false">Reject</button></div></td></tr>`).join('');
      $('bizPendingApplications').innerHTML = table(['Business / offer','Location','Contact','Plan','Trial','Decision'], rows);
      $('bizMetricPending').textContent = (a.data || []).length;
    }
    await searchExistingBusinesses($('bizExistingSearch').value.trim());
  }
  async function searchExistingBusinesses(query = '') {
    const host = $('bizExistingBusinesses'); host.innerHTML = '<p class="biz-note">Loading businesses…</p>';
    const {data,error} = await sb.rpc('mj_creator_list_business_profiles', {p_search:query});
    if (error) { host.innerHTML = `<p class="biz-note">${esc(error.message)}</p>`; return; }
    const rows = (data || []).map(b=>`<tr><td><strong>${esc(b.business_name)}</strong><br><span class="biz-note">${esc(b.user_id)}</span></td><td><span class="biz-status ${esc(b.directory_status)}">${esc(b.directory_status)}</span></td><td><select data-existing-plan="${b.user_id}">${plans.filter(z=>z.is_active).map(z=>`<option value="${z.id}">${esc(z.plan_name)} · KSh ${Number(z.price_kes).toLocaleString('en-KE')}</option>`).join('')}</select></td><td><input data-existing-days="${b.user_id}" type="number" min="1" value="30" aria-label="Access days"></td><td><button type="button" class="biz-primary" data-assign-existing="${b.user_id}">Approve / assign</button></td></tr>`).join('');
    host.innerHTML = table(['Business / owner ID','Approval','Plan','Days','Action'], rows);
    $('bizMetricApproved').textContent = (data || []).filter(b=>b.directory_status==='approved').length;
  }
  async function init() {
    const {data} = await sb.auth.getSession(); user = data.session?.user || null;
    const r = await sb.rpc('mj_is_creator_admin'); isCreator = !r.error && r.data === true;
    $('bizCreatorAdmin').hidden = !isCreator;
    if (isCreator) await loadAdmin();
    const open = await sb.rpc('mj_get_business_registration_open');
    $('bizRegistrationNotice').textContent = open.error ? 'Business registration setup is pending.' : open.data ? 'Applications are open. Your business must be approved before products can be published.' : 'Applications are temporarily closed. Contact Mjadala support.';
    $('bizSubmitApplication').disabled = !!open.error || !open.data;
    await loadPublicPlans();
    await loadDirectory();
  }

  $('bizDirectoryTab').onclick = () => setTab('directory');
  $('bizAllProductsTab').onclick = allProducts;
  $('bizApplyTab').onclick = () => setTab('apply');
  $('bizDirectorySearch').addEventListener('input', e => loadDirectory(e.target.value.trim()));
  $('bizExistingSearch').addEventListener('input', e => searchExistingBusinesses(e.target.value.trim()));
  $('bizSubmitApplication').onclick = async () => {
    if (!user) { status('Sign in to submit a business application.'); return; }
    const name = $('bizApplyName').value.trim();
    if (!name) { status('Enter your business or trading name.'); return; }
    const open = await sb.rpc('mj_get_business_registration_open');
    if (open.error || !open.data) { status('Business applications are currently closed.'); return; }
    const {error} = await sb.from('mj_business_applications').insert({user_id:user.id,business_name:name,description:$('bizApplyDescription').value.trim(),location_text:$('bizApplyLocation').value.trim(),contact_phone:$('bizApplyPhone').value.trim()});
    status(error ? error.message : 'Application submitted. You can publish products after creator approval and plan activation.');
    if (!error) ['bizApplyName','bizApplyDescription','bizApplyLocation','bizApplyPhone'].forEach(id=>$(id).value='');
  };
  $('bizRegistrationSwitch').onchange = async () => {
    const {error} = await sb.rpc('mj_creator_set_registration',{p_open:$('bizRegistrationSwitch').checked});
    if (error) { $('bizRegistrationSwitch').checked = !$('bizRegistrationSwitch').checked; alert(error.message); }
  };
  $('bizSavePlan').onclick = async () => {
    const name=$('bizPlanName').value.trim(), price=Number($('bizPlanPrice').value), days=Number($('bizPlanDays').value), trial=Number($('bizPlanTrial').value);
    if (!name || !Number.isFinite(price) || price<0 || days<1 || trial<0) { alert('Enter a plan name, valid price, access days and trial days.'); return; }
    const key=name.toLowerCase().replace(/[^a-z0-9_-]+/g,'-');
    const {error}=await sb.rpc('mj_creator_save_plan',{p_id:editingPlanId,p_key:key,p_name:name,p_description:$('bizPlanDescription').value,p_price:price,p_days:days,p_trial:trial,p_free:price===0,p_active:true});
    if (error) { alert(error.message); return; }
    resetPlanForm(); await loadAdmin(); await loadPublicPlans();
  };
  function resetPlanForm() { editingPlanId=null; $('bizPlanFormTitle').textContent='Add a business plan'; $('bizSavePlan').textContent='Add plan'; $('bizCancelPlanEdit').hidden=true; ['bizPlanName','bizPlanPrice','bizPlanDescription'].forEach(id=>$(id).value=''); $('bizPlanDays').value=30; $('bizPlanTrial').value=0; }
  $('bizCancelPlanEdit').onclick = resetPlanForm;

  document.addEventListener('click', async e => {
    const store = e.target.closest('[data-storefront]');
    if (store) { storefront(store.dataset.storefront, store.dataset.businessName); return; }
    if (e.target.closest('#bizBackToAll')) { allProducts(); return; }
    const edit = e.target.closest('[data-edit-plan]');
    if (edit) { const p=plans.find(x=>x.id===edit.dataset.editPlan); if(p){editingPlanId=p.id;$('bizPlanFormTitle').textContent='Edit business plan';$('bizSavePlan').textContent='Save plan changes';$('bizCancelPlanEdit').hidden=false;$('bizPlanName').value=p.plan_name;$('bizPlanPrice').value=p.price_kes;$('bizPlanDays').value=p.billing_days;$('bizPlanTrial').value=p.trial_days;$('bizPlanDescription').value=p.description;} return; }
    const togglePlan = e.target.closest('[data-toggle-plan]');
    if (togglePlan) {
      const p=plans.find(x=>x.id===togglePlan.dataset.togglePlan); if(!p) return;
      const next=!p.is_active;
      if (!confirm(`${next?'Activate':'Suspend'} the ${p.plan_name} plan? ${next?'It will appear to business applicants and can be assigned.':'It will disappear from new applications and assignments. Existing subscriptions are not automatically cancelled.'}`)) return;
      togglePlan.disabled=true;
      const {error}=await sb.from('mj_business_plans').update({is_active:next,updated_at:new Date().toISOString()}).eq('id',p.id);
      togglePlan.disabled=false;
      if(error) alert(error.message); else { await loadAdmin(); await loadPublicPlans(); }
      return;
    }
    const deletePlan = e.target.closest('[data-delete-plan]');
    if (deletePlan) {
      const p=plans.find(x=>x.id===deletePlan.dataset.deletePlan); if(!p) return;
      if (!confirm(`Delete the ${p.plan_name} plan permanently? If it has existing subscriptions, the database will prevent deletion; suspend it instead.`)) return;
      deletePlan.disabled=true;
      const {error}=await sb.from('mj_business_plans').delete().eq('id',p.id);
      deletePlan.disabled=false;
      if(error) { alert(`This plan could not be deleted. It may already be linked to a business subscription. Suspend it instead. Details: ${error.message}`); }
      else { if(editingPlanId===p.id) resetPlanForm(); await loadAdmin(); await loadPublicPlans(); }
      return;
    }
    const assign = e.target.closest('[data-assign-existing]');
    if (assign) {
      const uid=assign.dataset.assignExisting, plan=$(`[data-existing-plan="${uid}"]`)?.value, days=Number($(`[data-existing-days="${uid}"]`)?.value || 30);
      if (!plan) { alert('Create or select an active plan first.'); return; }
      assign.disabled=true;
      const {error}=await sb.rpc('mj_creator_assign_plan',{p_user:uid,p_plan:plan,p_days:days,p_admin_note:'Creator-assigned access'});
      assign.disabled=false;
      if (error) alert(error.message); else { alert('Business approved and plan assigned.'); await loadAdmin(); await loadDirectory(); }
      return;
    }
    const review = e.target.closest('[data-review]');
    if (review) {
      const app=review.dataset.review, approve=review.dataset.approve==='true', plan=$(`[data-plan-for="${app}"]`)?.value, trial=Number($(`[data-trial-for="${app}"]`)?.value || 0);
      if (approve && !plan) { alert('Create or select an active plan first.'); return; }
      review.disabled=true;
      const {error}=await sb.rpc('mj_creator_review_business',{p_application:app,p_approve:approve,p_plan:approve?plan:null,p_trial_days:trial,p_admin_note:''});
      review.disabled=false;
      if (error) alert(error.message); else { await loadAdmin(); await loadDirectory(); }
    }
  });
  sb.auth.onAuthStateChange((_event, session) => { user=session?.user || null; init(); });
  init();
})();
