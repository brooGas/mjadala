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
    .biz-dir-head{display:flex;align-items:center;justify-content:space-between;gap:10px}.biz-admin-open{border:1px solid var(--line);border-radius:10px;padding:8px 10px;background:#244b35;color:#fff;font-size:10px;font-weight:850;white-space:nowrap}.biz-dir-head strong{font-size:14px}.biz-note{font-size:11px;color:var(--muted);margin:5px 0;line-height:1.45}
    .biz-dir-tabs{display:flex;gap:7px;overflow:auto;margin:11px 0}.biz-dir-tabs button,.biz-directory button{border:1px solid var(--line);border-radius:10px;padding:8px 11px;background:var(--soft);color:var(--ink);font-weight:750;font-size:11px;white-space:nowrap}
    .biz-dir-tabs button.active,.biz-directory button.biz-primary{background:var(--green);border-color:var(--green);color:#fff}
    .biz-directory input,.biz-directory textarea,.biz-directory select{width:100%;min-width:0;border:1px solid var(--line);border-radius:9px;padding:9px;background:var(--paper);color:var(--ink);font:inherit;font-size:12px;margin:4px 0 8px}
    .biz-directory label{display:block;font-size:11px;font-weight:750;margin-top:6px}.biz-dir-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:9px;margin-top:10px}.biz-dir-card{border:1px solid var(--line);border-radius:12px;padding:11px}.biz-dir-card strong{font-size:13px}.biz-dir-card p{font-size:11px;color:var(--muted);margin:5px 0}
    .biz-admin{border:1px solid var(--line);border-radius:16px;margin-top:13px;padding:12px;background:var(--soft);box-shadow:0 8px 24px #173b2b0d}.biz-admin-head{display:flex;align-items:flex-start;justify-content:space-between;gap:8px;flex-wrap:wrap}.biz-admin h3{font-size:15px;margin:0}.biz-admin h4{font-size:12px;margin:15px 0 7px}
    .biz-metrics{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px;margin:11px 0}.biz-metric{border:1px solid var(--line);border-radius:11px;padding:9px;background:var(--soft)}.biz-metric small{display:block;color:var(--muted);font-size:10px}.biz-metric strong{display:block;font-size:18px;margin-top:3px}
    .biz-table-wrap{width:100%;overflow-x:auto;border:1px solid var(--line);border-radius:11px;margin:7px 0 12px}.biz-table{width:100%;border-collapse:collapse;min-width:570px;font-size:11px}.biz-table th,.biz-table td{padding:9px 8px;text-align:left;border-bottom:1px solid var(--line);vertical-align:middle}.biz-table th{background:var(--soft);font-size:10px;color:var(--muted);font-weight:800}.biz-table tr:last-child td{border-bottom:0}.biz-table td button{padding:7px 9px}.biz-table input,.biz-table select{margin:0;min-width:90px;padding:7px;font-size:11px}.biz-status{display:inline-block;border-radius:99px;padding:4px 7px;background:var(--soft);font-size:10px;font-weight:800}.biz-status.approved{color:#187647;background:#e8f6ee}.biz-status.pending{color:#956300;background:#fff5d9}.biz-status.rejected,.biz-status.suspended{color:#a33;background:#fcebea}
    .biz-admin-form{border:1px solid var(--line);border-radius:12px;padding:10px;margin:8px 0;background:var(--soft)}.biz-admin-form .biz-inline{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px}.biz-inline{display:flex;gap:7px;align-items:center;flex-wrap:wrap}.biz-inline>*{flex:1;min-width:85px}.biz-admin-actions{display:flex;gap:7px;flex-wrap:wrap}.biz-directory button:disabled{opacity:.55}
    .biz-public-plans{margin:10px 0 16px;border:1px solid #d8dfd1;border-radius:16px;padding:13px;background:#f6f4e9;color:#203b2b}.biz-public-plans-head strong{font-size:15px;color:#203b2b}.biz-plan-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px;margin-top:11px}.biz-plan-card{position:relative;display:block;border:1px solid #d5ddcf;border-radius:14px;padding:12px;background:#fffdf5;color:#203b2b;cursor:pointer;min-width:0}.biz-plan-card:has(input:checked){border:2px solid #b38a35;background:#fff9e7;box-shadow:0 5px 16px #263b2a16;padding:11px}.biz-plan-card input{position:absolute;right:10px;top:10px;width:17px;height:17px;accent-color:#244b35}.biz-plan-card b{display:block;font-size:13px;padding-right:20px}.biz-plan-card .biz-plan-price{display:block;font-size:20px;font-weight:900;color:#244b35;margin:8px 0 2px}.biz-plan-card small{display:block;font-size:10px;color:#647267;line-height:1.4}.biz-plan-popular{position:absolute;left:9px;top:-8px;background:#b38a35;color:#fff;padding:3px 7px;border-radius:20px;font-size:9px;font-weight:850}.biz-plan-trial{display:inline-block;margin-top:8px;padding:4px 7px;border-radius:20px;background:#e9eee3;color:#31553b;font-size:9px;font-weight:850}.biz-plan-state{display:inline-block;border-radius:20px;padding:4px 8px;font-size:10px;font-weight:800;background:#e8f6ee;color:#187647}.biz-admin details{border:1px solid var(--line);border-radius:12px;margin:9px 0;background:var(--paper);overflow:hidden}.biz-admin details>summary{list-style:none;cursor:pointer;padding:12px 13px;font-size:12px;font-weight:850;display:flex;align-items:center;justify-content:space-between;gap:8px;background:var(--soft)}.biz-admin details>summary::-webkit-details-marker{display:none}.biz-admin details>summary:after{content:'＋';font-size:16px;color:var(--green)}.biz-admin details[open]>summary:after{content:'−'}.biz-admin details>.biz-admin-section{padding:0 10px 10px}.biz-admin .biz-table-wrap{overscroll-behavior-x:contain;touch-action:pan-x pan-y}
    @media(max-width:520px){.biz-plan-grid{grid-template-columns:1fr 1fr;gap:7px}.biz-plan-card{padding:10px}.biz-plan-card .biz-plan-price{font-size:18px}.biz-admin details>summary{padding:11px}}
    @media(max-width:420px){.biz-metrics{gap:5px}.biz-metric{padding:7px}.biz-metric strong{font-size:16px}}
  `;
  document.head.append(style);

  const root = document.createElement('section');
  root.className = 'biz-directory';
  root.id = 'mjadalaBusinessDirectory';
  root.innerHTML = `
    <div class="biz-dir-head"><div><strong>Find a local business</strong><p class="biz-note">Discover approved traders and open their storefronts.</p></div><button type="button" class="biz-admin-open" id="bizAdminOpen" hidden>Admin Management</button></div>
    <div class="biz-dir-tabs"><button type="button" id="bizDirectoryTab" class="active">Businesses</button><button type="button" id="bizAllProductsTab">All products</button><button type="button" id="bizApplyTab">Register a business</button></div>
    <div id="bizDirectoryView"><input id="bizDirectorySearch" placeholder="Search business name…" aria-label="Search business name"><div id="bizDirectoryResults" class="biz-dir-grid"><p class="biz-note">Loading businesses…</p></div></div>
    <div id="bizApplicationView" hidden><p class="biz-note" id="bizRegistrationNotice"></p><section class="biz-public-plans"><div class="biz-public-plans-head"><div><strong>Business plans</strong><p class="biz-note">Choose the level of support that fits your business. Your plan is confirmed by the Mjadala team after review.</p></div></div><div id="bizPublicPlans"><p class="biz-note">Loading available plans…</p></div></section><label for="bizApplyName">Business or trading name</label><input id="bizApplyName" maxlength="100" placeholder="e.g. Mama Amina Vegetables"><label for="bizApplyDescription">What do you sell or offer?</label><textarea id="bizApplyDescription" rows="2" maxlength="500" placeholder="Brief description"></textarea><label for="bizApplyLocation">Location (area / estate / market)</label><input id="bizApplyLocation" maxlength="140" placeholder="e.g. Gikomba, Nairobi"><label for="bizApplyPhone">Contact phone (optional)</label><input id="bizApplyPhone" maxlength="30" placeholder="Phone number"><button type="button" class="biz-primary" id="bizSubmitApplication">Submit application</button><p class="biz-note" id="bizApplicationStatus" aria-live="polite"></p></div>
    <section class="biz-admin" id="bizCreatorAdmin" hidden>
      <div class="biz-admin-head"><div><h3>Admin Management</h3><p class="biz-note">One dashboard for adverts, business applications, sellers and plans.</p></div><button type="button" id="bizAdminClose">Close dashboard</button></div>
      <div class="biz-admin-head" style="margin-top:10px"><strong style="font-size:12px">Business settings</strong><label style="display:flex;align-items:center;gap:7px;margin:0"><input type="checkbox" id="bizRegistrationSwitch" style="width:auto;margin:0"> Applications open</label></div>
      <div class="biz-metrics"><div class="biz-metric"><small>Pending applications</small><strong id="bizMetricPending">—</strong></div><div class="biz-metric"><small>Approved businesses</small><strong id="bizMetricApproved">—</strong></div><div class="biz-metric"><small>Available plans</small><strong id="bizMetricPlans">—</strong></div></div>
      <details><summary>Business applications</summary><div class="biz-admin-section"><div id="bizPendingApplications"><p class="biz-note">Loading…</p></div></div></details>
      <details><summary>Approved and existing businesses</summary><div class="biz-admin-section"><input id="bizExistingSearch" placeholder="Search business name…"><div id="bizExistingBusinesses"><p class="biz-note">Loading businesses…</p></div></div></details>
      <details><summary>Plans and pricing</summary><div class="biz-admin-section"><div id="bizPlanEditor"></div>
      <div class="biz-admin-form"><strong id="bizPlanFormTitle" style="font-size:12px">Add a business plan</strong><div class="biz-inline biz-admin-form-grid"><input id="bizPlanName" placeholder="Plan name"><input id="bizPlanPrice" type="number" min="0" step="1" placeholder="Price KSh"><input id="bizPlanDays" type="number" min="1" value="30" placeholder="Access days"><input id="bizPlanTrial" type="number" min="0" value="0" placeholder="Trial days"></div><input id="bizPlanDescription" placeholder="Plan benefits / description"><div class="biz-admin-actions"><button type="button" class="biz-primary" id="bizSavePlan">Add plan</button><button type="button" id="bizCancelPlanEdit" hidden>Cancel edit</button></div></div></div></details>
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
  async function loadAdmin() {
    const sw = await sb.rpc('mj_get_business_registration_open');
    $('bizRegistrationSwitch').checked = !!sw.data;
    const p = await sb.from('mj_business_plans').select('*').order('sort_order');
    if (p.error) { $('bizPlanEditor').innerHTML = `<p class="biz-note">Could not load plans: ${esc(p.error.message)}</p>`; return; }
    plans = p.data || [];
    $('bizMetricPlans').textContent = plans.filter(x=>x.is_active).length;
    $('bizPlanEditor').innerHTML = plans.length ? table(['Plan','Price','Duration','Trial','Status','Actions'], plans.map(x=>`<tr><td><strong>${esc(x.plan_name)}</strong><br><span class="biz-note">${esc(x.description)}</span></td><td>KSh ${Number(x.price_kes).toLocaleString('en-KE')}</td><td>${x.billing_days} days</td><td>${x.trial_days} days</td><td><span class="biz-status ${x.is_active?'approved':'suspended'}">${x.is_active?'Active':'Suspended'}</span></td><td><div class="biz-admin-actions"><button type="button" data-edit-plan="${x.id}">Edit</button><button type="button" data-toggle-plan="${x.id}" data-next-active="${!x.is_active}">${x.is_active?'Suspend':'Reactivate'}</button><button type="button" data-delete-plan="${x.id}" style="color:#a33">Delete</button></div></td></tr>`).join('')) : '<p class="biz-note">No plans created yet.</p>';
    const a = await sb.from('mj_business_applications').select('id,user_id,business_name,description,location_text,contact_phone,status,created_at').eq('status','pending').order('created_at',{ascending:true});
    if (a.error) $('bizPendingApplications').innerHTML = `<p class="biz-note">Could not load applications: ${esc(a.error.message)}</p>`;
    else {
      const rows = (a.data || []).map(x=>`<tr><td><strong>${esc(x.business_name)}</strong><br><span class="biz-note">${esc(x.description)}</span></td><td>${esc(x.location_text)}</td><td>${esc(x.contact_phone || '—')}</td><td><select data-plan-for="${x.id}">${plans.filter(z=>z.is_active).map(z=>`<option value="${z.id}">${esc(z.plan_name)} · KSh ${Number(z.price_kes).toLocaleString('en-KE')}</option>`).join('')}</select></td><td><input data-trial-for="${x.id}" type="number" min="0" value="0" aria-label="Trial days"></td><td><div class="biz-admin-actions"><button type="button" class="biz-primary" data-review="${x.id}" data-approve="true">Approve</button><button type="button" data-review="${x.id}" data-approve="false">Reject</button></div></td></tr>`).join('');
      $('bizPendingApplications').innerHTML = table(['Business / offer','Location','Contact','Plan','Trial','Decision'], rows);
      $('bizMetricPending').textContent = (a.data || []).length;
    }
    await searchExistingBusinesses($('bizExistingSearch').value.trim());
    renderPublicPlans();
  }
  function renderPublicPlans() {
    const host = $('bizPublicPlans');
    if (!host) return;
    const available = plans.filter(p => p.is_active);
    if (!available.length) { host.innerHTML = '<p class="biz-note">Business plans are being updated. Please check again soon.</p>'; return; }
    const chosen = $('bizSelectedPlan')?.value || (available.find(p=>p.plan_key==='growth')?.id || ''); host.innerHTML = `<div class="biz-plan-grid">${available.map(p=>`<label class="biz-plan-card">${p.plan_key==='growth'?'<span class="biz-plan-popular">MOST POPULAR</span>':''}<input type="radio" name="bizSelectedPlan" id="bizSelectedPlan" value="${p.id}" ${chosen===p.id?'checked':''}><b>${esc(p.plan_name)}</b><span class="biz-plan-price">${Number(p.price_kes)===0?'Free':'KSh '+Number(p.price_kes).toLocaleString('en-KE')}</span><small>Per ${Number(p.billing_days)} days · ${esc(p.description || 'Business listing and product tools')}</small><span class="biz-plan-trial">${Number(p.trial_days)>0?Number(p.trial_days)+'-day trial':'No trial'}</span></label>`).join('')}</div><p class="biz-note">Selecting a plan records your preference only. Paid checkout and verified activation will be completed separately.</p>`;
  }
  async function searchExistingBusinesses(query = '') {
    const host = $('bizExistingBusinesses'); host.innerHTML = '<p class="biz-note">Loading businesses…</p>';
    const {data,error} = await sb.rpc('mj_creator_list_business_profiles', {p_search:query});
    if (error) { host.innerHTML = `<p class="biz-note">${esc(error.message)}</p>`; return; }
    const activePlans = plans.filter(z => z.is_active === true);
    const rows = (data || []).map(b=>`<tr><td><strong>${esc(b.business_name)}</strong><br><span class="biz-note">${esc(b.user_id)}</span></td><td><span class="biz-status ${esc(b.directory_status)}">${esc(b.directory_status)}</span></td><td><select data-existing-plan="${b.user_id}" ${activePlans.length ? '' : 'disabled'}><option value="">${activePlans.length ? 'Choose active plan' : 'No active plans — reactivate one'}</option>${activePlans.map(z=>`<option value="${z.id}">${esc(z.plan_name)} · KSh ${Number(z.price_kes).toLocaleString('en-KE')}</option>`).join('')}</select></td><td><input data-existing-days="${b.user_id}" type="number" min="1" value="30" aria-label="Access days"></td><td><button type="button" class="biz-primary" data-assign-existing="${b.user_id}" ${activePlans.length ? '' : 'disabled'}>Approve / assign</button></td></tr>`).join('');
    host.innerHTML = table(['Business / owner ID','Approval','Plan','Days','Action'], rows);
    $('bizMetricApproved').textContent = (data || []).filter(b=>b.directory_status==='approved').length;
  }
  async function init() {
    const {data} = await sb.auth.getSession(); user = data.session?.user || null;
    const r = await sb.rpc('mj_is_creator_admin'); isCreator = !r.error && r.data === true;
    $('bizAdminOpen').hidden = !isCreator;
    $('bizCreatorAdmin').hidden = true;
    if (isCreator) await loadAdmin();
    else { const publicPlans = await sb.from('mj_business_plans').select('*').eq('is_active',true).order('sort_order'); if (!publicPlans.error) { plans = publicPlans.data || []; renderPublicPlans(); } else $('bizPublicPlans').innerHTML = `<p class="biz-note">Could not load plans: ${esc(publicPlans.error.message)}</p>`; }
    const open = await sb.rpc('mj_get_business_registration_open');
    $('bizRegistrationNotice').textContent = open.error ? 'Business registration setup is pending.' : open.data ? 'Applications are open. Your business must be approved before products can be published.' : 'Applications are temporarily closed. Contact Mjadala support.';
    $('bizSubmitApplication').disabled = !!open.error || !open.data;
    await loadDirectory();
  }

  $('bizAdminOpen').onclick = () => { if (!isCreator) return; const panel=$('bizCreatorAdmin'); panel.hidden=false; panel.scrollIntoView({behavior:'smooth',block:'start'}); loadAdmin(); };
  $('bizAdminClose').onclick = () => { $('bizCreatorAdmin').hidden=true; $('bizAdminOpen').scrollIntoView({behavior:'smooth',block:'center'}); };
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
    const selectedPlan = document.querySelector('input[name="bizSelectedPlan"]:checked')?.value;
    if (!selectedPlan) { status('Choose a business plan before submitting.'); return; }
    const {error} = await sb.from('mj_business_applications').insert({user_id:user.id,business_name:name,description:$('bizApplyDescription').value.trim(),location_text:$('bizApplyLocation').value.trim(),contact_phone:$('bizApplyPhone').value.trim(),selected_plan_id:selectedPlan});
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
    const {error}=await sb.rpc('mj_creator_save_plan',{p_id:editingPlanId,p_key:key,p_name:name,p_description:$('bizPlanDescription').value,p_price:price,p_days:days,p_trial:trial,p_free:price===0,p_active:editingPlanId ? !!plans.find(p=>p.id===editingPlanId)?.is_active : true});
    if (error) { alert(error.message); return; }
    resetPlanForm(); await loadAdmin();
  };
  function resetPlanForm() { editingPlanId=null; $('bizPlanFormTitle').textContent='Add a business plan'; $('bizSavePlan').textContent='Add plan'; $('bizCancelPlanEdit').hidden=true; ['bizPlanName','bizPlanPrice','bizPlanDescription'].forEach(id=>$(id).value=''); $('bizPlanDays').value=30; $('bizPlanTrial').value=0; }
  $('bizCancelPlanEdit').onclick = resetPlanForm;

  document.addEventListener('touchstart', e => { if (e.target.closest('.biz-table-wrap,.biz-plan-grid')) e.stopPropagation(); }, {capture:true,passive:true});
  document.addEventListener('touchmove', e => { if (e.target.closest('.biz-table-wrap')) e.stopPropagation(); }, {capture:true,passive:true});
  document.addEventListener('click', async e => {
    const store = e.target.closest('[data-storefront]');
    if (store) { storefront(store.dataset.storefront, store.dataset.businessName); return; }
    if (e.target.closest('#bizBackToAll')) { allProducts(); return; }
    const edit = e.target.closest('[data-edit-plan]');
    if (edit) { const p=plans.find(x=>x.id===edit.dataset.editPlan); if(p){editingPlanId=p.id;$('bizPlanFormTitle').textContent='Edit business plan';$('bizSavePlan').textContent='Save plan changes';$('bizCancelPlanEdit').hidden=false;$('bizPlanName').value=p.plan_name;$('bizPlanPrice').value=p.price_kes;$('bizPlanDays').value=p.billing_days;$('bizPlanTrial').value=p.trial_days;$('bizPlanDescription').value=p.description;} return; }
    const togglePlan = e.target.closest('[data-toggle-plan]');
    if (togglePlan) {
      const planId=togglePlan.dataset.togglePlan, next=togglePlan.dataset.nextActive==='true', plan=plans.find(p=>p.id===planId);
      if (!plan) return;
      const verb=next?'reactivate':'suspend';
      if (!confirm(`${verb[0].toUpperCase()+verb.slice(1)} the ${plan.plan_name} plan? ${next?'It will become available for new assignments.':'It will no longer be available for new assignments.'}`)) return;
      togglePlan.disabled=true;
      const {error}=await sb.from('mj_business_plans').update({is_active:next,updated_at:new Date().toISOString()}).eq('id',planId);
      togglePlan.disabled=false;
      if (error) alert('Could not update plan: '+error.message); else await loadAdmin();
      return;
    }
    const deletePlan = e.target.closest('[data-delete-plan]');
    if (deletePlan) {
      const planId=deletePlan.dataset.deletePlan, plan=plans.find(p=>p.id===planId);
      if (!plan) return;
      const usage=await sb.from('mj_business_subscriptions').select('id',{count:'exact',head:true}).eq('plan_id',planId);
      if (usage.error) { alert('Could not check whether this plan is assigned: '+usage.error.message); return; }
      if ((usage.count||0)>0) { alert('This plan has already been assigned to a business and cannot be deleted safely. Suspend it instead; existing subscription records will be preserved.'); return; }
      if (!confirm(`Permanently delete the ${plan.plan_name} plan? This cannot be undone.`)) return;
      deletePlan.disabled=true;
      const {error}=await sb.from('mj_business_plans').delete().eq('id',planId);
      deletePlan.disabled=false;
      if (error) alert('Could not delete plan: '+error.message); else { if(editingPlanId===planId) resetPlanForm(); await loadAdmin(); }
      return;
    }
    const assign = e.target.closest('[data-assign-existing]');
    if (assign) {
      const uid=assign.dataset.assignExisting;
      const selector=document.querySelector(`[data-existing-plan="${uid}"]`), plan=selector?.value;
      const days=Number(document.querySelector(`[data-existing-days="${uid}"]`)?.value || 30);
      if (!selector || !plan) { alert(plans.some(p=>p.is_active===true) ? 'Choose an active plan for this business.' : 'There are no active plans. Reactivate a plan under Plans and Pricing first.'); return; }
      if (!Number.isInteger(days) || days < 1) { alert('Enter a valid access duration of at least one day.'); return; }
      assign.disabled=true; const oldLabel=assign.textContent; assign.textContent='Assigning…';
      try {
        const {error}=await sb.rpc('mj_creator_assign_plan',{p_user:uid,p_plan:plan,p_days:days,p_admin_note:'Creator-assigned access'});
        if (error) { console.error('Plan assignment failed:',error); alert('Plan assignment failed: '+error.message+(error.code?'\nCode: '+error.code:'')); }
        else { alert('Plan assigned successfully.'); await loadAdmin(); await loadDirectory(); }
      } catch(err) { console.error('Plan assignment exception:',err); alert('Plan assignment could not complete: '+(err.message||String(err))); }
      finally { assign.disabled=false; assign.textContent=oldLabel; }
      return;
    }
    const review = e.target.closest('[data-review]');
    if (review) {
      const app=review.dataset.review, approve=review.dataset.approve==='true', plan=document.querySelector(`[data-plan-for="${app}"]`)?.value, trial=Number(document.querySelector(`[data-trial-for="${app}"]`)?.value || 0);
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
