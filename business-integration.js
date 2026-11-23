/* Mjadala Business + Shop integration. Uses the existing public Supabase project key.
   Never place a service_role key in browser code. */
(() => {
  'use strict';
  const SUPABASE_URL = 'https://olqwfscmhtdseljvfqvm.supabase.co';
  const SUPABASE_ANON_KEY = 'sb_publishable_Ay8LXBjvNhXQJDKQMF_Etw_SMb6_z4M';
  const AUTH_DOMAIN = 'mjadala.app';
  if (!window.supabase?.createClient) { console.error('Supabase SDK failed to load'); return; }
  const sb = window.mjadalaSupabaseClient || window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  window.mjadalaSupabaseClient = sb;
  window.mjadalaAuth = { getSession: () => sb.auth.getSession(), signOut: () => sb.auth.signOut(), getUser: () => sb.auth.getUser() };
  const $ = id => document.getElementById(id);
  let session = null, activeProduct = null, selectedImages = [], poolId = null, catalogProducts = [], productDetailOpen = false, poolOfferOpen = false;
  const money = n => 'KSh ' + Number(n || 0).toLocaleString('en-KE');
  const toast = msg => { if (typeof window.showToast === 'function') window.showToast(msg); else alert(msg); };
  const errorText = e => e?.message || String(e || 'Unknown error');
  const emailFor = nick => nick.trim().toLowerCase().replace(/^@/, '') + '@' + AUTH_DOMAIN;
  async function mjGetActivePlan(uid) {
    // Returns the plan whose limits should apply right now: the seller's real active
    // subscription, or the free Starter plan's limits if none (so Starter is still enforced).
    try {
      const { data: sub } = await sb.from('mj_business_subscriptions').select('*').eq('user_id', uid).order('created_at', { ascending: false }).limit(1).maybeSingle();
      let plan = null;
      if (sub && sub.plan_id) {
        const expired = sub.ends_at && new Date(sub.ends_at) < new Date();
        const bad = ['suspended', 'cancelled', 'canceled', 'revoked', 'rejected', 'expired'].includes(String(sub.status || '').toLowerCase());
        if (!expired && !bad) {
          const { data: p } = await sb.from('mj_business_plans').select('*').eq('id', sub.plan_id).maybeSingle();
          if (p) plan = p;
        }
      }
      if (!plan) {
        const { data: starter } = await sb.from('mj_business_plans').select('*').eq('plan_key', 'starter').maybeSingle();
        plan = starter || null;
      }
      return plan;
    } catch (_) { return null; }
  }

  function addAuthUI() {
    if ($('businessAuthPanel')) return;
    const section = document.querySelector('[data-screen="1"]');
    const panel = document.createElement('div'); panel.className = 'owner-panel'; panel.id = 'businessAuthPanel';
    panel.innerHTML = `<h4>Connect your Mjadala account</h4><p>Sign in with the nickname and password you already use on Mjadala to publish products and place orders.</p>
      <div class="field"><label for="bizNick">Mjadala nickname</label><input id="bizNick" autocomplete="username" placeholder="Your nickname"></div>
      <div class="field"><label for="bizPassword">Password</label><input id="bizPassword" type="password" autocomplete="current-password" placeholder="Your password"></div>
      <button type="button" id="bizSignIn">Sign in</button><p id="bizAuthStatus" class="cart-note" aria-live="polite"></p>`;
    section.insertBefore(panel, section.firstChild);
    $('bizSignIn').addEventListener('click', async () => {
      const nick = $('bizNick').value.trim(), pw = $('bizPassword').value;
      if (!nick || !pw) { $('bizAuthStatus').textContent = 'Enter your nickname and password.'; return; }
      $('bizSignIn').disabled = true; $('bizAuthStatus').textContent = 'Signing in…';
      try {
        const { data, error } = await sb.auth.signInWithPassword({ email: emailFor(nick), password: pw });
        if (error) throw error;
        session = data.session; $('bizAuthStatus').textContent = 'Signed in. Business tools are ready.';
        $('businessAuthPanel').style.display = 'none'; await loadProduct(); toast('Signed in to Mjadala');
      } catch (e) { $('bizAuthStatus').textContent = errorText(e); }
      finally { $('bizSignIn').disabled = false; }
    });
  }
  async function loadBusinessProfile() {
    if (!session?.user) return;
    try {
      const { data, error } = await sb.from('business_profiles').select('business_name,user_id').eq('user_id', session.user.id).maybeSingle();
      if (error) throw error;
      if (data?.business_name) { $('sellerBusinessName').value = data.business_name; $('myBusinessTitle').textContent = 'My Business · ' + data.business_name; $('businessProfileStatus').textContent = 'Your business profile is saved. Published products appear in the live marketplace.'; }
      const { data: profile } = await sb.from('profiles').select('nickname').eq('id', session.user.id).maybeSingle();
      const owner = profile?.nickname || session.user.email?.split('@')[0] || 'Account owner';
      $('myBusinessOwner').textContent = data?.business_name ? 'Owner: ' + owner : 'Create your business profile and manage your products.';
      $('businessOwnerLabel').textContent = 'Owner: ' + owner;
    } catch (e) { console.warn('Could not load business profile:', errorText(e)); }
  }
  $('openMyBusiness')?.addEventListener('click',()=>{
    if (!requireSession()) return;
    const panel = $('ownerPanel');
    if (panel) {
      const opening = getComputedStyle(panel).display === 'none';
      panel.style.display = opening ? 'block' : 'none';
      $('openMyBusiness').textContent = opening ? 'Close' : 'Open';
      const poolToggle = $('sellerPoolEnabled'); if (poolToggle) poolToggle.closest('.field').style.display = opening ? '' : 'none';
      if (!opening) { $('sellerPoolSettings').style.display = 'none'; }
      if (opening) { const poolToggle = $('sellerPoolEnabled'); if (poolToggle) poolToggle.closest('.field').style.display = ''; }
      if (opening) { loadOwnerInventory(); panel.scrollIntoView({behavior:'smooth',block:'start'}); $('sellerBusinessName')?.focus({preventScroll:true}); }
    }
  });

  function requireSession() {
    if (session?.user) return true;
    addAuthUI(); $('businessAuthPanel').style.display = 'block'; $('bizAuthStatus').textContent = 'Sign in first to save products or place orders.';
    $('businessAuthPanel').scrollIntoView({behavior:'smooth',block:'center'}); return false;
  }
  function readProductForm() {
    const name = $('sellerProductName').value.trim();
    const description = $('sellerProductDescription').value.trim();
    const price = Number($('sellerProductPrice').value);
    const stockQuantity = Number($('sellerProductQty')?.value);
    if (!Number.isInteger(stockQuantity) || stockQuantity < 0) throw new Error('Enter a whole-number available quantity (0 or more).');
    if (!name) throw new Error('Enter a product name.');
    if (!Number.isFinite(price) || price <= 0) throw new Error('Enter a price greater than zero.');
    const min = Math.max(2, Number($('poolMinimum').value) || 2);
    const max = Math.max(min, Number($('poolCapacity').value) || min);
    const discount = Math.min(90, Math.max(0, Number($('poolDiscount').value) || 0));
    return {
      seller_id: session.user.id, product_name:name, description, price, currency:'KES', image_urls:[], stock_quantity:stockQuantity,
      standard_delivery_fee: Math.max(0, Number($('sellerDeliveryFee').value) || 0),
      express_delivery_fee: Math.max(0, Number($('sellerExpressFee').value) || 0),
      pickup_available: $('sellerPickup').value !== 'delivery',
      warranty_available: $('sellerWarranty').value !== 'No warranty offered',
      warranty_period: $('sellerWarranty').value, warranty_terms: $('sellerWarranty').value,
      returns_allowed: !!$('sellerReturns').value.trim(), return_window_days:7, return_terms:$('sellerReturns').value.trim(),
      additional_terms:$('sellerTerms').value.trim(), pooling_enabled:$('sellerPoolEnabled').checked,
      pool_min_members:min, pool_max_members:max, pool_discount_percent:discount,
      pool_delivery_fee: Math.max(0, Number($('sellerPoolDeliveryFee').value) || 0), published:true
    };
  }
  async function uploadPhotos(files) {
    const urls = [];
    for (const file of files) {
      if (!file.type.startsWith('image/')) continue;
      if (file.size > 8 * 1024 * 1024) throw new Error(file.name + ' is over the 8 MB image limit.');
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g,'') || 'jpg';
      const path = `${session.user.id}/${crypto.randomUUID()}.${ext}`;
      const { error } = await sb.storage.from('product-images').upload(path, file, {upsert:false, contentType:file.type});
      if (error) throw error;
      const { data } = sb.storage.from('product-images').getPublicUrl(path);
      urls.push(data.publicUrl);
    }
    return urls;
  }
  function renderProduct(p, announceOwn = false) {
    if (activeProduct?.id && String(activeProduct.id) !== String(p.id)) poolId = null;
    activeProduct = p; productDetailOpen = true; poolOfferOpen = false;
    hidePoolSharePanel();
    if ($('qtyValue')) $('qtyValue').textContent = '0';
    const productCard = document.querySelector('.product-card'); if (productCard) productCard.style.display = '';
    if ($('customerTermsPanel')) $('customerTermsPanel').style.display = '';
    if ($('customerTermsContent')) $('customerTermsContent').style.display = 'none';
    if ($('toggleWarrantyDetails')) $('toggleWarrantyDetails').setAttribute('aria-expanded','false');
    if ($('toggleCheckoutPanel')) { $('toggleCheckoutPanel').setAttribute('aria-expanded','false'); $('toggleCheckoutPanel').style.display = 'flex'; }
    if ($('businessCartPanel')) $('businessCartPanel').style.display = 'none';
    if ($('poolPanel')) $('poolPanel').style.display = 'none';
    if ($('viewPoolOfferButton')) { $('viewPoolOfferButton').style.display = p.pooling_enabled ? 'inline-flex' : 'none'; $('viewPoolOfferButton').innerHTML = 'Pool Offer <span aria-hidden="true">⌄</span>'; $('viewPoolOfferButton').setAttribute('aria-expanded','false'); }
    const isOwnProduct = !!session?.user?.id && String(p.seller_id) === String(session.user.id);
    if ($('businessCartPanel')) $('businessCartPanel').style.display = 'none';
    if ($('toggleCheckoutPanel')) $('toggleCheckoutPanel').style.display = isOwnProduct ? 'none' : 'flex';
    const qtyControls = document.querySelector('.product-card .qty-controls'); if (qtyControls) qtyControls.style.display = isOwnProduct ? 'none' : '';
    // A seller can still see their own pool's offer/progress for reference, but may not join or invite into it as a buyer.
    if ($('viewPoolOfferButton')) $('viewPoolOfferButton').style.display = (p.pooling_enabled && !isOwnProduct) ? 'inline-flex' : 'none';
    if (isOwnProduct) { if ($('poolSectionHeading')) $('poolSectionHeading').style.display = 'none'; if ($('poolPanel')) $('poolPanel').style.display = 'none'; }
    if (isOwnProduct && announceOwn) toast('This is your product. You can manage it, but cannot purchase it or join its pool through customer checkout.');
    $('customerProductName').textContent = p.product_name;
    $('customerProductDescription').textContent = p.description || '';
    $('customerProductPrice').textContent = money(p.price);
    $('customerWarranty').textContent = p.warranty_period || 'No warranty offered';
    $('customerReturns').textContent = p.return_terms || 'No additional return policy provided.';
    $('customerTerms').textContent = p.additional_terms || 'No additional terms provided.';
    const thumb = document.querySelector('.product-thumb');
    if (thumb) {
      const image = Array.isArray(p.image_urls) ? p.image_urls.find(url => typeof url === 'string' && url.trim()) : null;
      thumb.innerHTML = image
        ? `<img alt="${escapeHTML(p.product_name)}" src="${escapeHTML(image)}" style="width:100%;height:100%;object-fit:cover;border-radius:12px">`
        : `<span class="product-image-fallback">${escapeHTML((p.product_name || 'P').trim().slice(0,2).toUpperCase())}</span>`;
    }
    const standard = Number(p.standard_delivery_fee || 0), express = Number(p.express_delivery_fee || 0);
    const delivery = $('deliveryMethod');
    delivery.innerHTML = `<option value="standard">Standard delivery · ${money(standard)}</option><option value="express">Express delivery · ${money(express)}</option>${p.pickup_available ? '<option value="pickup">Collect from seller · Free</option>' : ''}`;
    window.businessCurrentProduct = p;
    document.dispatchEvent(new CustomEvent('mjadala:product-loaded',{detail:p}));
    updateCartUI();
    $('poolSectionHeading').style.display = 'none';
    $('poolPanel').style.display = 'none';
    if (p.pooling_enabled) {
      $('poolMinimum').value = p.pool_min_members || 2; $('poolCapacity').value = p.pool_max_members || 5;
      $('poolDiscount').value = p.pool_discount_percent || 0; $('sellerPoolDeliveryFee').value = p.pool_delivery_fee || 0;
      $('poolDeliveryDisplay').textContent = money(p.pool_delivery_fee || 0);
      $('poolDeliveryExplanation').textContent = 'Seller-set pool delivery fee per customer: ' + money(p.pool_delivery_fee || 0) + '. Final discount eligibility is checked by the server when you order.';
      if (!isOwnProduct) {
        // Find any already-open pool for this product so progress/discount reflect real data as soon as the product opens.
        sb.from('product_pools').select('id').eq('product_id', p.id).eq('pool_status', 'open').order('created_at', { ascending: false }).limit(1).maybeSingle()
          .then(({ data }) => { if (activeProduct?.id === p.id) { poolId = data?.id || null; refreshPoolProgress(poolId); } })
          .catch(() => { refreshPoolProgress(null); });
      } else {
        refreshPoolProgress(null);
      }
    }
  }
  async function refreshPoolProgress(pid) {
    if (!activeProduct?.pooling_enabled) return;
    const min = Math.max(2, Number(activeProduct.pool_min_members) || 2);
    const unit = Number(activeProduct.price) || 0;
    const discountPercent = Number(activeProduct.pool_discount_percent) || 0;
    const deliveryFee = Number(activeProduct.pool_delivery_fee) || 0;
    $('poolMinimumDisplay').textContent = min;
    let memberCount = 0;
    if (pid) {
      try {
        // Real membership lives in product_pool_members (one row per buyer whose order
        // joined this pool). mj_pool_progress is a SECURITY DEFINER RPC so any shopper
        // can see an accurate count without being granted raw access to other members' rows.
        const { data, error } = await sb.rpc('mj_pool_progress', { p_pool_id: pid });
        if (error) throw error;
        memberCount = Math.max(0, Number(data) || 0);
      } catch (e) {
        console.warn('Could not load real pool progress:', errorText(e));
        if ($('poolProgressText')) $('poolProgressText').textContent = "Pool progress isn't available right now — try again shortly.";
        if ($('poolRegularPrice')) $('poolRegularPrice').textContent = money(unit);
        if ($('poolDiscountPrice')) $('poolDiscountPrice').textContent = money(unit);
        if ($('poolPersonalTotal')) $('poolPersonalTotal').textContent = money(unit + deliveryFee);
        return;
      }
    }
    const unlocked = memberCount >= min;
    if ($('poolMemberCount')) $('poolMemberCount').textContent = memberCount;
    if ($('poolProgressFill')) $('poolProgressFill').style.width = Math.min(100, (memberCount / min) * 100) + '%';
    if ($('poolProgressText')) $('poolProgressText').textContent = unlocked
      ? 'Minimum reached — the group discount is unlocked for this pool.'
      : 'Invite ' + (min - memberCount) + ' more ' + ((min - memberCount) === 1 ? 'person' : 'people') + ' to unlock the group offer.';
    if ($('poolRegularPrice')) $('poolRegularPrice').textContent = money(unit);
    if ($('poolDiscountPrice')) $('poolDiscountPrice').textContent = unlocked ? money(Math.round(unit * (1 - discountPercent / 100))) : money(unit);
    if ($('poolPersonalTotal')) $('poolPersonalTotal').textContent = money(Math.round(unit * (unlocked ? 1 - discountPercent / 100 : 1)) + deliveryFee);
    if ($('poolMembers')) {
      const known = Math.min(memberCount, min);
      $('poolMembers').innerHTML = Array.from({ length: known }, (_, i) =>
        `<div class="pool-member"><span class="member-avatar">${i + 1}</span><span><b>${i === 0 ? 'Pool member 1' : 'Pool member ' + (i + 1)}</b><small>Joined · separate order</small></span><span class="member-status">Joined</span></div>`
      ).join('') + Array.from({ length: Math.max(0, min - known) }, (_, i) =>
        `<div class="pool-member"><span class="member-avatar">?</span><span><b>Open spot</b><small>Awaiting an invite</small></span><span class="member-status pending">Invite</span></div>`
      ).join('');
    }
    if ($('joinPoolButton')) { const atCapacity = memberCount >= Math.max(min, Number(activeProduct.pool_max_members) || min); $('joinPoolButton').disabled = !pid ? false : atCapacity; $('joinPoolButton').style.opacity = (!pid ? false : atCapacity) ? '.55' : '1'; }
    if ($('leavePoolButton')) $('leavePoolButton').disabled = !pid;
  }
  function renderCatalog(products, preserveSource = false) {
    if (!preserveSource) catalogProducts = products || [];
    const displayProducts = products || [];
    const host = $('businessProductCatalog'); if (!host) return;
    if (!displayProducts.length) {
      host.innerHTML = '<p class="live-empty">No products have been published yet. Sellers can publish the first real listing below.</p>';
      const card = document.querySelector('.product-card'); if (card) card.style.display = 'none';
      return;
    }
    host.innerHTML = '<div class="market-grid">' + displayProducts.map(p => {
      const image = Array.isArray(p.image_urls) ? p.image_urls.find(url => typeof url === 'string' && url.trim()) : null;
      const isOwner = !!session?.user?.id && String(p.seller_id) === String(session.user.id);
      const initials = escapeHTML((p.product_name || 'P').trim().slice(0,2).toUpperCase());
      const imagePart = image
        ? `<img loading="lazy" src="${escapeHTML(image)}" alt="${escapeHTML(p.product_name)}" onerror="this.hidden=true;this.nextElementSibling.hidden=false"><div class="market-image-fallback" hidden>${initials}</div>`
        : `<div class="market-image-fallback">${initials}</div>`;
      const qty = Number.isFinite(Number(p.stock_quantity)) ? Number(p.stock_quantity) : null;
      return `<article class="market-item" data-open-product="${escapeHTML(p.id)}"><div class="market-image-wrap">${imagePart}<button type="button" class="market-fav" aria-pressed="false" aria-label="Save to favourites" data-fav-toggle onclick="event.stopPropagation();this.setAttribute('aria-pressed', this.getAttribute('aria-pressed')!=='true')"><svg class="std-icon"><use href="#i-heart"/></svg></button>${qty !== null && qty <= 5 ? `<span class="market-badge">${qty === 0 ? 'Out of stock' : qty + ' left'}</span>` : ''}</div><div class="market-body"><h4>${escapeHTML(p.product_name)}</h4><strong>${money(p.price)}</strong><p class="market-meta"><svg class="std-icon"><use href="#i-truck"/></svg> ${money(p.standard_delivery_fee || 0)} delivery</p></div><button type="button" class="market-cart" data-open-product="${escapeHTML(p.id)}" aria-label="View product"><svg class="std-icon"><use href="#i-cart"/></svg></button>${isOwner ? `<button type="button" class="market-remove" data-unpublish-product="${escapeHTML(p.id)}" onclick="event.stopPropagation()">Remove from marketplace</button>` : ''}</article>`;
    }).join('') + '</div>';
  }
  async function loadOwnerInventory() {
    if (!session?.user?.id) return;
    const panel = $('ownerPanel'); if (!panel) return;
    let inventory = panel.querySelector('#ownerProductInventory');
    if (!inventory) {
      inventory = document.createElement('div');
      inventory.id = 'ownerProductInventory'; inventory.className = 'owner-inventory';
      inventory.innerHTML = '<h4>My Products</h4><p class="subtle">Manage your existing listings without deleting order history.</p><div class="owner-product-list">Loading your products…</div>';
      panel.insertBefore(inventory, panel.firstChild);
    }
    const list = inventory.querySelector('.owner-product-list');
    try {
      const {data,error} = await sb.from('business_products').select('id,product_name,price,published,created_at,seller_id').eq('seller_id',session.user.id).order('created_at',{ascending:false});
      if (error) throw error;
      if (!data?.length) { list.innerHTML = '<p class="subtle">You have no products yet.</p>'; return; }
      list.innerHTML = data.map(p => `<div class="owner-product-row"><div class="owner-product-info"><strong>${escapeHTML(p.product_name || 'Untitled product')}</strong><small>${money(p.price)} · ${p.published ? 'Published' : 'Not published'}</small></div><button type="button" class="owner-product-action" ${p.published ? `data-unpublish-product="${escapeHTML(p.id)}"` : `data-publish-product="${escapeHTML(p.id)}"`}>${p.published ? 'Remove' : 'Publish'}</button>${p.published ? '' : `<button type="button" class="owner-product-action" data-delete-product="${escapeHTML(p.id)}" style="color:#a33!important;min-width:70px!important">Delete</button>`}</div>`).join('');
    } catch (err) {
      list.innerHTML = '<p class="subtle">Could not load your inventory: ' + escapeHTML(errorText(err)) + '</p>';
    }
  }
  function escapeHTML(s) { return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function updateCartUI() {
    if (!activeProduct) return;
    const q = Math.max(0, Number($('qtyValue').textContent) || 0);
    const method = $('deliveryMethod').value;
    const fee = method === 'pickup' ? 0 : method === 'express' ? Number(activeProduct.express_delivery_fee || 0) : Number(activeProduct.standard_delivery_fee || 0);
    $('cartCount').textContent = q; $('cartSubtotal').textContent = money(q * Number(activeProduct.price));
    $('cartDelivery').textContent = money(fee); $('cartTotal').textContent = money(q * Number(activeProduct.price) + fee);
    $('deliveryAddressWrap').style.display = method === 'pickup' ? 'none' : '';
    if ($('stkButton')) { $('stkButton').disabled = q === 0; $('stkButton').style.opacity = q === 0 ? '.55' : '1'; }
    window.mjSetCartBadge && window.mjSetCartBadge(q);
  }
  async function publish() {
    if (!requireSession()) return;
    const status = $('publishStatus'); status.textContent = 'Saving product and uploading images…';
    try {
      const payload = readProductForm();
      const businessName = $('sellerBusinessName').value.trim();
      if (!businessName) throw new Error('Enter your approved business name.');
      // Check approval + an active creator-assigned plan before uploading files or inserting anything.
      // The database trigger remains the final enforcement layer for every insert/update.
      const { data: canPublish, error: accessError } = await sb.rpc('mj_business_can_publish', { p_user: session.user.id });
      if (accessError) throw accessError;
      if (canPublish !== true) throw new Error('Your business must first be approved by Mjadala and have an active plan before you can publish. Submit the business application and wait for approval.');
      const { data: approvedBusiness, error: businessError } = await sb.from('business_profiles').select('business_name,directory_status').eq('user_id', session.user.id).maybeSingle();
      if (businessError) throw businessError;
      if (!approvedBusiness || approvedBusiness.directory_status !== 'approved') throw new Error('Your business has not received approval yet.');
      if (businessName.toLowerCase() !== String(approvedBusiness.business_name || '').toLowerCase()) throw new Error('Use the exact approved business name shown in your business profile.');
      $('myBusinessTitle').textContent = 'My Business · ' + approvedBusiness.business_name;
      $('businessProfileStatus').textContent = 'Your business is approved. Your active plan allows product publishing.';
      const { data: ownerProfile } = await sb.from('profiles').select('nickname').eq('id',session.user.id).maybeSingle(); const ownerName=ownerProfile?.nickname||session.user.email?.split('@')[0]||'Account owner'; $('myBusinessOwner').textContent='Owner: '+ownerName; $('businessOwnerLabel').textContent='Owner: '+ownerName;
      const files = selectedImages.length ? selectedImages : [...($('productPhotos').files || [])];
      const plan = await mjGetActivePlan(session.user.id);
      if (plan) {
        if (plan.product_limit != null) {
          const { count } = await sb.from('business_products').select('id', { count: 'exact', head: true }).eq('seller_id', session.user.id);
          if ((count || 0) >= Number(plan.product_limit)) throw new Error(`Your ${plan.plan_name} plan allows up to ${plan.product_limit} products. Remove a listing or pick a bigger plan in Business Plans to add more.`);
        }
        if (plan.photo_limit != null && files.length > Number(plan.photo_limit)) throw new Error(`Your ${plan.plan_name} plan allows up to ${plan.photo_limit} photo${Number(plan.photo_limit) === 1 ? '' : 's'} per product. You selected ${files.length}.`);
      }
      payload.image_urls = await uploadPhotos(files);
      let result = await sb.from('business_products').insert(payload).select('*').single();
      // Quantity is required. If the stock migration is missing, fail clearly rather than silently discarding inventory.
      if (result.error) throw result.error;
      const data = result.data;
      renderProduct(data);
      await loadProduct();
      await loadOwnerInventory();
      // Clear the creation fields after a successful save so the same details/photos
      // are not accidentally submitted as another listing.
      $('sellerProductName').value = '';
      $('sellerProductDescription').value = '';
      $('sellerProductPrice').value = '';
      selectedImages = [];
      $('productPhotos').value = '';
      $('productPhotoNames').textContent = 'No product photos selected';
      status.textContent = 'Published and saved to Supabase. The form is ready for another product.';
      toast('Product published');
    } catch (e) { status.textContent = 'Could not publish: ' + errorText(e); }
  }
  function hidePoolSharePanel() {
    const panel = $('poolSharePanel');
    if (panel) panel.style.display = 'none';
  }
  function closeProductDetail() {
    productDetailOpen = false; activeProduct = null; poolId = null; poolOfferOpen = false;
    hidePoolSharePanel();
    const detail = document.querySelector('.product-card'); if (detail) detail.style.display = 'none';
    ['customerTermsPanel','customerTermsContent','businessCartPanel','poolPanel','poolSectionHeading'].forEach(id => { const el=$(id); if(el) el.style.display='none'; });
    if ($('toggleCheckoutPanel')) $('toggleCheckoutPanel').style.display='none';
    if ($('viewPoolOfferButton')) $('viewPoolOfferButton').style.display='none';
  }
  async function loadProduct() {
    try {
      let productQuery = sb.from('business_products').select('*').eq('published',true).order('created_at',{ascending:false}).limit(60);
      if (window.mjadalaBusinessSellerFilter) productQuery = productQuery.eq('seller_id', window.mjadalaBusinessSellerFilter);
      const {data,error} = await productQuery;
      if (error) throw error;
      renderCatalog(data || []);
      const keep = activeProduct && (data || []).find(p => String(p.id) === String(activeProduct.id));
      if (keep) renderProduct(keep);
      else closeProductDetail();
    } catch (e) {
      const host = $('businessProductCatalog'); if (host) host.innerHTML = '<p class="live-empty">Could not load live listings: ' + escapeHTML(errorText(e)) + '</p>';
      console.warn('Could not load shop listing:',errorText(e));
    }
  }
  window.mjadalaBusinessReloadProducts = loadProduct;
  window.mjadalaBusinessShowAllProducts = () => { closeProductDetail(); window.mjadalaBusinessSellerFilter = null; loadProduct(); };
  window.mjadalaBusinessOpenStorefront = () => { closeProductDetail(); };
  window.mjadalaBusinessSearchProducts = async ({ query = '', maxPrice = null } = {}) => {
    // Fetch the current published marketplace rows for every Watt search.
    // This avoids searching an empty or stale catalogue if the first page load
    // has not finished yet. Only public, published products are considered.
    const { data, error } = await sb.from('business_products')
      .select('*')
      .eq('published', true)
      .order('created_at', { ascending: false })
      .limit(60);
    if (error) throw error;

    catalogProducts = data || [];
    const terms = String(query || '').toLowerCase().split(/\s+/).filter(Boolean);
    const ceiling = Number.isFinite(Number(maxPrice)) && Number(maxPrice) > 0 ? Number(maxPrice) : null;
    const matches = catalogProducts.filter(product => {
      const haystack = [product.product_name, product.description].filter(Boolean).join(' ').toLowerCase();
      const textMatch = !terms.length || terms.every(term => haystack.includes(term));
      const price = Number(product.price);
      const priceMatch = ceiling === null || (Number.isFinite(price) && price <= ceiling);
      return textMatch && priceMatch;
    });

    const host = $('businessProductCatalog');
    const heading = host?.previousElementSibling;
    if (heading) heading.dataset.wattSearch = 'true';
    if (!matches.length) {
      if (host) host.innerHTML = '<p class="live-empty">No published products matched those filters. Try a different product name or a higher budget.</p>';
      const card = document.querySelector('.product-card'); if (card) card.style.display = 'none';
      return { count: 0 };
    }
    renderCatalog(matches, true);
    return { count: matches.length };
  };
  async function checkout() {
    if (!requireSession()) return;
    const quantity = Math.max(0, Number($('qtyValue').textContent) || 0);
    if (!quantity) { toast('Add at least one item first'); return; }
    if (!activeProduct?.id) { toast('Open a product first'); return; }
    if (session?.user?.id && String(activeProduct.seller_id) === String(session.user.id)) { toast('You cannot purchase your own product through customer checkout.'); return; }
    const available = Number(activeProduct.stock_quantity);
    if (Number.isFinite(available) && available >= 0 && quantity > available) { toast('Only ' + available + ' item(s) are currently available.'); return; }
    if (Number.isFinite(available) && available === 0) { toast('This product is out of stock.'); return; }
    const name = $('checkoutCustomerName').value.trim(), phone = $('checkoutCustomerPhone').value.trim();
    const method = $('deliveryMethod').value, address = $('deliveryAddress').value.trim();
    if (!name || !phone) { toast('Enter your name and phone number'); return; }
    if (method !== 'pickup' && !address) { toast('Enter your delivery location'); return; }
    const button = $('stkButton'); button.disabled = true; button.textContent = 'Creating secure order…';
    try {
      const {data,error} = await sb.rpc('place_business_order',{p_product_id:activeProduct.id,p_quantity:quantity,p_delivery_method:method,p_customer_name:name,p_customer_phone:phone,p_delivery_address:address || 'Seller pickup',p_pool_id:poolId});
      if (error) throw error;
      const result = Array.isArray(data) ? data[0] : data;
      try {
        button.textContent = 'Requesting M-Pesa prompt…';
        const { data: payment, error: paymentError } = await sb.functions.invoke('daraja-stk-push', { body: { order_id: result.order_id, phone } });
        if (paymentError) throw paymentError;
        if (!payment?.ok) throw new Error(payment?.error || 'The M-Pesa prompt was not confirmed.');
        result.payment_status = 'pending';
        result.payment_message = payment.customer_message || 'Check your phone for the Safaricom prompt.';
        result.payment_started = true;
        showOrderResult(result);
        watchOrderStatus(result.order_id);
        toast('M-Pesa request accepted. Check your phone; never share your PIN with Mjadala.');
      } catch (paymentErr) {
        result.payment_started = false;
        result.payment_message = 'Order created, but the M-Pesa prompt could not be started: ' + errorText(paymentErr) + '. Your order remains unpaid; do not pay manually until you confirm its status.';
        showOrderResult(result);
        toast('Order saved; payment initiation needs setup.');
      }
    } catch(e) { toast('Order failed: ' + errorText(e)); }
    finally { button.disabled = false; button.innerHTML = '<svg class="std-icon"><use href="#i-credit"/></svg> Pay with M-Pesa · STK Push'; }
  }
  function watchOrderStatus(orderId) {
    if (!orderId) return;
    let channel = null;
    let finished = false;
    const applyStatus = (row, notify = false) => {
      if (!row || finished) return;
      const status = String(row.payment_status || '').toLowerCase();
      const buttons = [...document.querySelectorAll('#accountPanelContent .account-action-btn')];
      const paymentRow = buttons.find(b => (b.textContent || '').includes('Payment status'));
      const nextRow = buttons.find(b => (b.textContent || '').includes('Next step'));
      const small = paymentRow?.querySelector('small');
      if (status === 'paid') {
        if (small) small.textContent = 'Paid · Safaricom receipt ' + (row.mpesa_receipt_number || 'confirmed');
        if (nextRow?.querySelector('small')) nextRow.querySelector('small').textContent = 'Payment confirmed by Safaricom. Keep the receipt for your records.';
        if (notify) toast('Payment confirmed by Safaricom.');
        finished = true;
        if (channel && sb.removeChannel) sb.removeChannel(channel);
      } else if (status === 'failed') {
        if (small) small.textContent = 'Failed or cancelled · no payment confirmed';
        if (nextRow?.querySelector('small')) nextRow.querySelector('small').textContent = 'Check your M-Pesa messages before retrying. Do not pay twice.';
        if (notify) toast('M-Pesa payment was not completed.');
        finished = true;
        if (channel && sb.removeChannel) sb.removeChannel(channel);
      }
    };
    // Subscribe first, then fetch current status so an early callback isn't missed.
    if (sb.channel) {
      channel = sb.channel('mjadala-order-' + orderId)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'business_orders', filter: 'id=eq.' + orderId }, payload => applyStatus(payload.new, true))
        .subscribe();
    }
    sb.from('business_orders').select('payment_status,mpesa_receipt_number').eq('id', orderId).maybeSingle()
      .then(({ data, error }) => {
        if (error) { console.warn('Could not refresh payment status:', error.message); return; }
        applyStatus(data, false);
      });
    // Fallback: realtime can miss an update (RLS, publication, sleeping phone), so also poll every 4s for 3 minutes.
    let polls = 0;
    const poller = setInterval(() => {
      if (finished || ++polls > 45) { clearInterval(poller); return; }
      // Backup: from ~16s, every ~12s ask Safaricom directly (settles the order if the callback never arrived).
      if (polls >= 4 && polls % 3 === 1 && sb.functions) { sb.functions.invoke('daraja-stk-query', { body: { order_id: orderId } }).catch(() => {}); }
      sb.from('business_orders').select('payment_status,mpesa_receipt_number').eq('id', orderId).maybeSingle()
        .then(({ data }) => { if (data) applyStatus(data, true); });
    }, 4000);
    setTimeout(() => { try { if (channel && sb.removeChannel) sb.removeChannel(channel); } catch (_) {} }, 180000);
  }
  function showOrderResult(r) {
    if (typeof window.showAccountPanel === 'function') window.showAccountPanel('Order created',[{icon:'✓',label:'Order reference',detail:r?.order_id || r?.id || 'Created'},{icon:'▣',label:'Amount due',detail:money(r?.total_amount)},{icon:'▦',label:'Payment status',detail:r?.payment_started?'STK request accepted · awaiting Safaricom callback':'Unpaid · M-Pesa request not started'},{icon:'ℹ',label:'Next step',detail:r?.payment_message || 'Check the payment status before retrying.'}]);
    $('qtyValue').textContent='0'; updateCartUI();
  }
  async function handleJoinPool() {
    if (!requireSession()) return;
    if (!activeProduct?.id || !activeProduct.pooling_enabled) { toast('This product does not have pooling enabled.'); return; }
    if (String(activeProduct.seller_id) === String(session.user.id)) { toast('You cannot join your own product’s pool.'); return; }
    try {
      if (!poolId) {
        // Reuse an existing open pool for this product before creating another one.
        const existing = await sb.from('product_pools').select('id').eq('product_id',activeProduct.id).eq('pool_status','open').order('created_at',{ascending:false}).limit(1).maybeSingle();
        if (existing.error) throw existing.error;
        if (existing.data?.id) {
          poolId = existing.data.id;
        } else {
          const {data,error} = await sb.from('product_pools').insert({product_id:activeProduct.id,created_by:session.user.id,pool_name:activeProduct.product_name+' group buy',pool_status:'open'}).select('id').single();
          if (error) throw error; poolId=data.id;
        }
      }
      await refreshPoolProgress(poolId);
      $('poolStatus').textContent='You’re set to join this pool. Complete checkout to place your order in it, or invite others so it unlocks faster.';
      toast('Group-buy pool selected. Complete checkout to join.');
    } catch(e) { toast('Could not open pool: '+errorText(e)); }
  }
  function handleLeavePool() {
    if (!poolId) { toast('You are not currently in a pool for this product.'); return; }
    poolId = null;
    hidePoolSharePanel();
    if ($('poolStatus')) $('poolStatus').textContent = 'You left the pool. Checkout will no longer be linked to it unless you join again.';
    refreshPoolProgress(null);
    toast('Left the pool');
  }
  async function handleInvitePool() {
    if (!activeProduct?.id || !activeProduct.pooling_enabled) { toast('This product does not have pooling enabled.'); return; }
    if (!requireSession()) return;
    if (String(activeProduct.seller_id) === String(session.user.id)) { toast('You cannot join or invite others into your own product’s pool.'); return; }
    if (!poolId) { await handleJoinPool(); if (!poolId) return; }
    const url = new URL(location.href);
    url.search = ''; url.hash = '';
    url.searchParams.set('joinPool', poolId);
    url.searchParams.set('product', activeProduct.id);
    const link = url.toString();
    const shareText = `Join my group-buy pool for ${activeProduct.product_name} on Mjadala — we both get the discount once enough people join: `;
    if (navigator.share) {
      try { await navigator.share({ title: 'Join my Mjadala pool', text: shareText, url: link }); return; }
      catch (_) { /* cancelled or unsupported — fall back to the link panel below */ }
    }
    showPoolShareOptions(link, shareText);
  }
  function showPoolShareOptions(link, shareText) {
    const host = $('poolPanel'); if (!host) return;
    let panel = $('poolSharePanel');
    if (!panel) {
      panel = document.createElement('div');
      panel.id = 'poolSharePanel';
      panel.className = 'owner-panel';
      panel.style.marginTop = '8px';
      host.appendChild(panel);
    }
    const waText = encodeURIComponent(shareText + link);
    const mailSubject = encodeURIComponent('Join my Mjadala group-buy pool');
    const mailBody = encodeURIComponent(shareText + link);
    panel.innerHTML = `<p class="cart-note" style="margin-bottom:6px">Share this pool link so others can join instantly:</p>
      <p class="cart-note" id="poolShareLink" style="word-break:break-all;font-size:11px;background:rgba(127,127,127,.12);padding:6px 8px;border-radius:8px">${escapeHTML(link)}</p>
      <div class="pool-actions" style="margin-top:6px">
        <a class="pool-share-btn" href="https://wa.me/?text=${waText}" target="_blank" rel="noopener" style="text-decoration:none;text-align:center;display:inline-flex;align-items:center;justify-content:center">WhatsApp</a>
        <a class="pool-share-btn" href="mailto:?subject=${mailSubject}&body=${mailBody}" style="text-decoration:none;text-align:center;display:inline-flex;align-items:center;justify-content:center">Email</a>
        <button type="button" class="pool-share-btn" id="poolCopyLink">Copy link</button>
      </div>`;
    panel.style.display = 'block';
    panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    $('poolCopyLink')?.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(link); toast('Pool link copied'); }
      catch (_) { toast('Could not copy automatically — select and copy the link above.'); }
    });
  }
  window.mjadalaBusinessOpenPoolFromLink = async (productId, sharedPoolId) => {
    if (!productId || !sharedPoolId) return false;
    try {
      await loadProduct();
      let product = catalogProducts.find(p => String(p.id) === String(productId));
      if (!product) {
        const { data, error } = await sb.from('business_products').select('*').eq('id', productId).eq('published', true).maybeSingle();
        if (error) throw error;
        product = data;
      }
      if (!product) { toast('That pool link points to a product that is no longer available.'); return false; }
      renderProduct(product, false);
      document.querySelector('.product-card')?.scrollIntoView({behavior:'smooth',block:'start'});
      if (!product.pooling_enabled) { toast('This product no longer has group buying enabled.'); return true; }
      if (session?.user?.id && String(product.seller_id) === String(session.user.id)) {
        toast('This is your own product, so you cannot join its pool.');
        return true;
      }
      const { data: poolRow, error: poolErr } = await sb.from('product_pools').select('id,product_id,pool_status').eq('id', sharedPoolId).maybeSingle();
      if (poolErr) throw poolErr;
      if (!poolRow || String(poolRow.product_id) !== String(product.id) || poolRow.pool_status !== 'open') {
        toast('This pool link is no longer valid, but there may be a current pool for this product — tap Pool Offer to check.');
        return true;
      }
      poolId = sharedPoolId;
      poolOfferOpen = true;
      if ($('poolSectionHeading')) $('poolSectionHeading').style.display = '';
      if ($('poolPanel')) $('poolPanel').style.display = '';
      if ($('viewPoolOfferButton')) { $('viewPoolOfferButton').style.display = 'inline-flex'; $('viewPoolOfferButton').setAttribute('aria-expanded','true'); $('viewPoolOfferButton').innerHTML = 'Pool Offer <span aria-hidden="true">⌃</span>'; }
      await refreshPoolProgress(poolId);
      if ($('poolStatus')) $('poolStatus').textContent = 'You followed a shared pool link. Tap "Join this pool" to confirm, then check out to take part.';
      toast('Pool opened from your invite link');
      return true;
    } catch (e) {
      toast('Could not open that pool link: ' + errorText(e));
      return false;
    }
  };
  document.addEventListener('click', async e => {
    const unpublishButton = e.target.closest('[data-unpublish-product]');
    const publishAgainButton = e.target.closest('[data-publish-product]');
    const deleteButton = e.target.closest('[data-delete-product]');
    if (deleteButton) {
      e.preventDefault(); e.stopImmediatePropagation();
      if (!session?.user?.id) { toast('Sign in as the product owner first.'); return; }
      const deleteId = deleteButton.dataset.deleteProduct;
      const deleteName = deleteButton.closest('.owner-product-row')?.querySelector('strong')?.textContent || 'this product';
      if (!confirm(`Delete "${deleteName}" permanently? This cannot be undone. Products that already have orders cannot be deleted.`)) return;
      deleteButton.disabled = true; deleteButton.textContent = 'Deleting…';
      try {
        const { error } = await sb.rpc('delete_business_product', { p_product_id: deleteId });
        if (error) throw error;
        await loadProduct(); await loadOwnerInventory();
        toast('Product deleted permanently.');
      } catch (err) {
        toast(errorText(err));
        deleteButton.disabled = false; deleteButton.textContent = 'Delete';
      }
      return;
    }
    if (unpublishButton || publishAgainButton) {
      e.preventDefault(); e.stopImmediatePropagation();
      if (!session?.user?.id) { toast('Sign in as the product owner first.'); return; }
      const button = unpublishButton || publishAgainButton;
      const productId = button.dataset.unpublishProduct || button.dataset.publishProduct;
      const product = catalogProducts.find(p => String(p.id) === String(productId));
      const inventoryRow = button.closest('.owner-product-row');
      // Inventory may include unpublished products not present in the public catalogue;
      // seller_id is enforced in the database update filter as well.
      if (product && String(product.seller_id) !== String(session.user.id)) { toast('You can manage only products belonging to your account.'); return; }
      const shouldPublish = !!publishAgainButton;
      const name = product?.product_name || inventoryRow?.querySelector('strong')?.textContent || 'this product';
      // Republishing asks for the quantity available now, because stock changes between listings.
      let newStock = null;
      if (shouldPublish) {
        const entered = prompt(`How many units of "${name}" are available now? (whole number, 1 or more)`, '');
        if (entered === null) return;
        newStock = Number(String(entered).trim());
        if (!Number.isInteger(newStock) || newStock < 1) { toast('Enter a whole-number quantity of 1 or more to publish.'); return; }
      } else if (!confirm(`Remove "${name}" from the marketplace? Its order history will be preserved.`)) return;
      button.disabled = true; button.textContent = shouldPublish ? 'Publishing…' : 'Removing…';
      try {
        // Republish goes through the database function (checks owner + quantity); removing just hides the product.
        const { data, error } = shouldPublish
          ? await sb.rpc('republish_business_product', { p_product_id: productId, p_quantity: newStock }).then(r => ({ data: r.error ? null : [r.data], error: r.error }))
          : await sb.from('business_products').update({published: false}).eq('id', productId).eq('seller_id', session.user.id).select('id');
        if (error) throw error;
        if (!data?.length) throw new Error('No product was updated. Check that you are signed in as its owner.');
        if (!shouldPublish && activeProduct?.id === productId) activeProduct = null;
        await loadProduct(); await loadOwnerInventory();
        toast(shouldPublish ? 'Product published.' : 'Product removed from the marketplace. Order history is preserved.');
      } catch (err) {
        toast('Could not update this product. Your database may restrict owner updates. ' + errorText(err));
        button.disabled = false; button.textContent = shouldPublish ? 'Publish' : 'Remove';
      }
      return;
    }
    const backButton = e.target.closest('#backToMarketplace');
    if (backButton) {
      e.preventDefault(); productDetailOpen = false; activeProduct = null; poolId = null; poolOfferOpen = false;
      hidePoolSharePanel();
      const detailCard = document.querySelector('.product-card'); if (detailCard) detailCard.style.display = 'none';
      if ($('customerTermsPanel')) $('customerTermsPanel').style.display = 'none';
      if ($('customerTermsContent')) $('customerTermsContent').style.display = 'none';
      if ($('toggleWarrantyDetails')) $('toggleWarrantyDetails').setAttribute('aria-expanded','false');
      if ($('toggleCheckoutPanel')) { $('toggleCheckoutPanel').style.display = 'none'; $('toggleCheckoutPanel').setAttribute('aria-expanded','false'); }
      if ($('poolPanel')) $('poolPanel').style.display = 'none';
      if ($('poolSectionHeading')) $('poolSectionHeading').style.display = 'none';
      if ($('viewPoolOfferButton')) { $('viewPoolOfferButton').style.display = 'none'; $('viewPoolOfferButton').textContent = 'View Pool Offer'; $('viewPoolOfferButton').setAttribute('aria-expanded','false'); }
      if ($('businessCartPanel')) $('businessCartPanel').style.display = 'none';
      const qtyControls = document.querySelector('.product-card .qty-controls'); if (qtyControls) qtyControls.style.display = '';
      const catalog = $('businessProductCatalog'); catalog?.scrollIntoView({behavior:'smooth',block:'start'});
      return;
    }
    const poolOfferButton = e.target.closest('#viewPoolOfferButton');
    if (poolOfferButton) {
      e.preventDefault();
      if (!activeProduct?.pooling_enabled) return;
      poolOfferOpen = !poolOfferOpen;
      $('poolSectionHeading').style.display = poolOfferOpen ? '' : 'none';
      $('poolPanel').style.display = poolOfferOpen ? '' : 'none';
      poolOfferButton.setAttribute('aria-expanded', poolOfferOpen ? 'true' : 'false');
      poolOfferButton.innerHTML = poolOfferOpen ? 'Pool Offer <span aria-hidden="true">⌃</span>' : 'Pool Offer <span aria-hidden="true">⌄</span>';
      if (poolOfferOpen) $('poolPanel')?.scrollIntoView({behavior:'smooth',block:'start'});
      return;
    }
    const warrantyToggle = e.target.closest('#toggleWarrantyDetails');
    if (warrantyToggle) {
      e.preventDefault();
      const expanded = warrantyToggle.getAttribute('aria-expanded') !== 'true';
      warrantyToggle.setAttribute('aria-expanded', expanded ? 'true' : 'false');
      if ($('customerTermsContent')) $('customerTermsContent').style.display = expanded ? 'block' : 'none';
      return;
    }
    const checkoutToggle = e.target.closest('#toggleCheckoutPanel');
    if (checkoutToggle) {
      e.preventDefault();
      const expanded = checkoutToggle.getAttribute('aria-expanded') !== 'true';
      checkoutToggle.setAttribute('aria-expanded', expanded ? 'true' : 'false');
      if ($('businessCartPanel')) $('businessCartPanel').style.display = expanded ? 'block' : 'none';
      return;
    }
    const productButton = e.target.closest('[data-open-product]');
    if (productButton) {
      e.preventDefault();
      const selected = catalogProducts.find(p => String(p.id) === String(productButton.dataset.openProduct));
      if (selected) {
        renderProduct(selected, true);
        const detailCard = document.querySelector('.product-card');
        detailCard?.scrollIntoView({behavior:'smooth',block:'start'});
      }
      return;
    }
    const publishButton = e.target.closest('#publishProduct');
    if (publishButton) { e.preventDefault(); e.stopImmediatePropagation(); publish(); return; }
    const checkoutButton = e.target.closest('#stkButton');
    if (checkoutButton) { e.preventDefault(); e.stopImmediatePropagation(); checkout(); return; }
    const joinButton = e.target.closest('#joinPoolButton');
    if (joinButton) { e.preventDefault(); e.stopImmediatePropagation(); handleJoinPool(); return; }
    const leaveButton = e.target.closest('#leavePoolButton');
    if (leaveButton) { e.preventDefault(); e.stopImmediatePropagation(); handleLeavePool(); return; }
    const inviteButton = e.target.closest('#invitePoolButton');
    if (inviteButton) { e.preventDefault(); e.stopImmediatePropagation(); handleInvitePool(); return; }
  }, true);
  $('sellerPoolEnabled')?.addEventListener('change', () => {
    const enabled = $('sellerPoolEnabled').checked;
    if ($('sellerPoolSettings')) $('sellerPoolSettings').style.display = enabled ? 'block' : 'none';
    if ($('poolStatus')) $('poolStatus').textContent = enabled ? 'Group buying is enabled for this product. Publish/save the product to apply it.' : 'Group buying is disabled for this product.';
    if (!enabled && $('poolPanel')) $('poolPanel').style.display = 'none';
  });
  $('backToMarketplace')?.addEventListener('click', () => {
    productDetailOpen = false; activeProduct = null; poolId = null; poolOfferOpen = false;
    hidePoolSharePanel();
    const detailCard = document.querySelector('.product-card'); if (detailCard) detailCard.style.display = 'none';
    if ($('customerTermsPanel')) $('customerTermsPanel').style.display = 'none';
    if ($('customerTermsContent')) $('customerTermsContent').style.display = 'none';
    if ($('toggleWarrantyDetails')) $('toggleWarrantyDetails').setAttribute('aria-expanded','false');
    if ($('toggleCheckoutPanel')) { $('toggleCheckoutPanel').style.display = 'none'; $('toggleCheckoutPanel').setAttribute('aria-expanded','false'); }
    if ($('poolPanel')) $('poolPanel').style.display = 'none';
    if ($('poolSectionHeading')) $('poolSectionHeading').style.display = 'none';
    if ($('viewPoolOfferButton')) { $('viewPoolOfferButton').style.display = 'none'; $('viewPoolOfferButton').innerHTML = 'Pool Offer <span aria-hidden="true">⌄</span>'; $('viewPoolOfferButton').setAttribute('aria-expanded','false'); }
    if ($('businessCartPanel')) $('businessCartPanel').style.display = 'none';
    const qtyControls = document.querySelector('.product-card .qty-controls'); if (qtyControls) qtyControls.style.display = '';
    $('businessProductCatalog')?.scrollIntoView({behavior:'smooth',block:'start'});
  });
  const photoInput = $('productPhotos');
  photoInput.addEventListener('change',()=>{ selectedImages=[...(photoInput.files||[])]; });
  $('resetProductForm')?.addEventListener('click',()=>{ selectedImages=[]; if(photoInput) photoInput.value=''; if($('productPhotoNames')) $('productPhotoNames').textContent='No product photos selected'; });
  const drop = $('productPhotoDrop');
  drop.addEventListener('drop',e=>{ selectedImages=[...e.dataTransfer.files].filter(f=>f.type.startsWith('image/')); });
  $('deliveryMethod').addEventListener('change',updateCartUI);
  $('qtyPlus').addEventListener('click',()=>{
    const el = $('qtyValue'); const current = Math.max(0, Number(el.textContent) || 0);
    const max = Number.isFinite(Number(activeProduct?.stock_quantity)) ? Number(activeProduct.stock_quantity) : Infinity;
    el.textContent = String(Math.min(max, current + 1));
    updateCartUI();
  });
  $('qtyMinus').addEventListener('click',()=>{
    const el = $('qtyValue'); const current = Math.max(0, Number(el.textContent) || 0);
    el.textContent = String(Math.max(0, current - 1));
    updateCartUI();
  });
  let marketplaceChannel = null;
  function startMarketplaceRealtime(){ if(marketplaceChannel)sb.removeChannel(marketplaceChannel); marketplaceChannel=sb.channel('mjadala-marketplace').on('postgres_changes',{event:'*',schema:'public',table:'business_products'},()=>loadProduct()).subscribe(); }

  // ---------- My Orders (customer order history) ----------
  function orderStatusBadge(paymentStatus) {
    const s = String(paymentStatus || '').toLowerCase();
    const map = {
      paid:      { label: 'Paid',      bg: '#e3f3e6', fg: '#1f7a3d' },
      pending:   { label: 'Pending',   bg: '#fdf3df', fg: '#8a6a1f' },
      unpaid:    { label: 'Unpaid',    bg: '#fdf3df', fg: '#8a6a1f' },
      failed:    { label: 'Failed',    bg: '#fbe4e4', fg: '#a3312f' },
      cancelled: { label: 'Cancelled', bg: '#eceff1', fg: '#58646b' }
    };
    const o = map[s] || { label: paymentStatus || '—', bg: '#eceff1', fg: '#58646b' };
    return `<span style="display:inline-block;padding:2px 8px;border-radius:999px;font-size:10px;font-weight:800;white-space:nowrap;background:${o.bg};color:${o.fg}">${escapeHTML(o.label)}</span>`;
  }
  async function loadMyOrders() {
    const host = $('myOrdersList'); if (!host) return;
    if (!session?.user?.id) { host.innerHTML = '<p class="live-empty">Sign in to see your orders.</p>'; return; }
    host.innerHTML = '<p class="live-empty">Loading your orders…</p>';
    try {
      const { data: orders, error } = await sb.from('business_orders')
        .select('id,product_id,quantity,unit_price,delivery_fee,discount_amount,total_amount,delivery_method,delivery_address,order_status,payment_status,mpesa_receipt_number,created_at')
        .eq('buyer_id', session.user.id)
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      if (!orders?.length) { host.innerHTML = '<p class="live-empty">You have not placed any orders yet.</p>'; return; }
      const productIds = [...new Set(orders.map(o => o.product_id).filter(Boolean))];
      const names = {};
      if (productIds.length) {
        const { data: products } = await sb.from('business_products').select('id,product_name').in('id', productIds);
        (products || []).forEach(p => { names[p.id] = p.product_name; });
      }
      host.innerHTML = orders.map(o => {
        const name = names[o.product_id] || 'Product no longer listed';
        const date = new Date(o.created_at).toLocaleString('en-KE', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
        const isPending = ['pending', 'unpaid'].includes(String(o.payment_status).toLowerCase());
        return `<div class="row-card" style="flex-direction:column;align-items:stretch;gap:6px">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
            <div><h4 style="margin:0 0 2px">${escapeHTML(name)}</h4><p style="margin:0">${o.quantity} × ${money(o.unit_price)} · ${escapeHTML(o.delivery_method || 'standard')}</p></div>
            ${orderStatusBadge(o.payment_status)}
          </div>
          <div class="cart-line"><span>Total</span><strong>${money(o.total_amount)}</strong></div>
          ${o.mpesa_receipt_number ? `<p class="cart-note" style="text-align:left;margin:0">M-Pesa receipt: ${escapeHTML(o.mpesa_receipt_number)}</p>` : ''}
          <p class="cart-note" style="text-align:left;margin:0">${escapeHTML(date)} · Order status: ${escapeHTML(o.order_status || 'pending')}</p>
          ${isPending ? `<button type="button" class="forest-btn check-order-status" data-order-id="${escapeHTML(o.id)}">Check payment status</button>` : ''}
        </div>`;
      }).join('');
    } catch (e) {
      host.innerHTML = '<p class="live-empty">Could not load your orders: ' + escapeHTML(errorText(e)) + '</p>';
    }
  }
  window.mjadalaLoadMyOrders = loadMyOrders;
  $('myOrdersRow')?.addEventListener('click', () => {
    if (!requireSession()) return;
    if ($('accountSection')) $('accountSection').style.display = 'none';
    if ($('accountSectionTitle')) $('accountSectionTitle').style.display = 'none';
    if ($('myOrdersPanel')) $('myOrdersPanel').style.display = 'block';
    loadMyOrders();
  });
  $('myOrdersRow')?.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $('myOrdersRow').click(); } });
  $('backFromMyOrders')?.addEventListener('click', () => {
    if ($('myOrdersPanel')) $('myOrdersPanel').style.display = 'none';
    if ($('accountSection')) $('accountSection').style.display = 'block';
    if ($('accountSectionTitle')) $('accountSectionTitle').style.display = 'flex';
  });
  document.addEventListener('click', async e => {
    const checkBtn = e.target.closest('.check-order-status');
    if (!checkBtn) return;
    e.preventDefault();
    const orderId = checkBtn.dataset.orderId;
    checkBtn.disabled = true; checkBtn.textContent = 'Checking…';
    try { await sb.functions.invoke('daraja-stk-query', { body: { order_id: orderId } }); } catch (_) { /* best-effort nudge */ }
    await loadMyOrders();
  });

  sb.auth.getSession().then(({data})=>{ session=data.session; if (!session) addAuthUI(); else if($('businessAuthPanel'))$('businessAuthPanel').style.display='none'; if(session){loadBusinessProfile(); if($('ownerPanel') && getComputedStyle($('ownerPanel')).display!=='none') loadOwnerInventory();} loadProduct(); startMarketplaceRealtime(); });
  sb.auth.onAuthStateChange((_event,newSession)=>{session=newSession;if(session){if($('businessAuthPanel'))$('businessAuthPanel').style.display='none';loadBusinessProfile(); if($('ownerPanel') && getComputedStyle($('ownerPanel')).display!=='none') loadOwnerInventory();}else{addAuthUI();$('myBusinessTitle').textContent='My Business';$('myBusinessOwner').textContent='Sign in to manage your business.';}loadProduct();});
})();
