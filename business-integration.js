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
  let session = null, activeProduct = null, selectedImages = [], poolId = null, catalogProducts = [], productDetailOpen = false;
  const money = n => 'KSh ' + Number(n || 0).toLocaleString('en-KE');
  const toast = msg => { if (typeof window.showToast === 'function') window.showToast(msg); else alert(msg); };
  const errorText = e => e?.message || String(e || 'Unknown error');
  const emailFor = nick => nick.trim().toLowerCase().replace(/^@/, '') + '@' + AUTH_DOMAIN;

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
  function renderProduct(p) {
    if (activeProduct?.id && String(activeProduct.id) !== String(p.id)) poolId = null;
    activeProduct = p; productDetailOpen = true;
    const productCard = document.querySelector('.product-card'); if (productCard) productCard.style.display = '';
    if ($('customerTermsPanel')) $('customerTermsPanel').style.display = '';
    if ($('poolPanel')) $('poolPanel').style.display = p.pooling_enabled ? '' : 'none';
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
    if (typeof window.updateCart === 'function') { /* legacy functions are scoped; event below refreshes totals */ }
    document.dispatchEvent(new CustomEvent('mjadala:product-loaded',{detail:p}));
    updateCartUI();
    $('poolSectionHeading').style.display = p.pooling_enabled ? '' : 'none';
    $('poolPanel').style.display = p.pooling_enabled && productDetailOpen ? '' : 'none';
    if (p.pooling_enabled) {
      $('poolMinimum').value = p.pool_min_members || 2; $('poolCapacity').value = p.pool_max_members || 5;
      $('poolDiscount').value = p.pool_discount_percent || 0; $('sellerPoolDeliveryFee').value = p.pool_delivery_fee || 0;
      $('poolMinimumDisplay').textContent = p.pool_min_members || 2;
      $('poolRegularPrice').textContent = money(p.price);
      $('poolDiscountPrice').textContent = money(Math.round(Number(p.price) * (1 - Number(p.pool_discount_percent || 0)/100)));
      $('poolDeliveryDisplay').textContent = money(p.pool_delivery_fee || 0);
      $('poolDeliveryExplanation').textContent = 'Seller-set pool delivery fee per customer: ' + money(p.pool_delivery_fee || 0) + '. Final discount eligibility is checked by the server when you order.';
    }
  }
  function renderCatalog(products) {
    catalogProducts = products || [];
    const host = $('businessProductCatalog'); if (!host) return;
    if (!catalogProducts.length) {
      host.innerHTML = '<p class="live-empty">No products have been published yet. Sellers can publish the first real listing below.</p>';
      const card = document.querySelector('.product-card'); if (card) card.style.display = 'none';
      return;
    }
    host.innerHTML = '<div class="market-grid">' + catalogProducts.map(p => {
      const image = Array.isArray(p.image_urls) ? p.image_urls.find(url => typeof url === 'string' && url.trim()) : null;
      const isOwner = !!session?.user?.id && String(p.seller_id) === String(session.user.id);
      const initials = escapeHTML((p.product_name || 'P').trim().slice(0,2).toUpperCase());
      const imageMarkup = image
        ? `<div class="market-image-wrap"><img loading="lazy" src="${escapeHTML(image)}" alt="${escapeHTML(p.product_name)}" onerror="this.hidden=true;this.nextElementSibling.hidden=false"><div class="market-image-fallback" hidden>${initials}</div></div>`
        : `<div class="market-image-fallback">${initials}</div>`;
      return `<article class="market-item">${imageMarkup}<h4>${escapeHTML(p.product_name)}</h4><strong>${money(p.price)}</strong><p class="subtle">Available quantity: ${Number.isFinite(Number(p.stock_quantity)) ? Number(p.stock_quantity) : 'Check with seller'}</p><p>Standard delivery ${money(p.standard_delivery_fee || 0)} · Express ${money(p.express_delivery_fee || 0)}</p><button type="button" data-open-product="${escapeHTML(p.id)}">View product</button>${isOwner ? `<button type="button" class="market-remove" data-unpublish-product="${escapeHTML(p.id)}">Remove from marketplace</button>` : ''}</article>`;
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
      list.innerHTML = data.map(p => `<div class="owner-product-row"><div class="owner-product-info"><strong>${escapeHTML(p.product_name || 'Untitled product')}</strong><small>${money(p.price)} · ${p.published ? 'Published' : 'Not published'}</small></div><button type="button" class="owner-product-action" ${p.published ? `data-unpublish-product="${escapeHTML(p.id)}"` : `data-publish-product="${escapeHTML(p.id)}"`}>${p.published ? 'Remove' : 'Publish'}</button></div>`).join('');
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
  }
  async function publish() {
    if (!requireSession()) return;
    const status = $('publishStatus'); status.textContent = 'Saving product and uploading images…';
    try {
      const payload = readProductForm();
      const businessName = $('sellerBusinessName').value.trim();
      if (!businessName) throw new Error('Enter your business name before publishing.');
      const { error: profileError } = await sb.from('business_profiles').upsert({user_id:session.user.id,business_name:businessName,updated_at:new Date().toISOString()},{onConflict:'user_id'});
      if (profileError) throw profileError;
      $('myBusinessTitle').textContent = 'My Business · ' + businessName; $('businessProfileStatus').textContent = 'Your business profile is saved. Published products appear in the live marketplace.';
      const { data: ownerProfile } = await sb.from('profiles').select('nickname').eq('id',session.user.id).maybeSingle(); const ownerName=ownerProfile?.nickname||session.user.email?.split('@')[0]||'Account owner'; $('myBusinessOwner').textContent='Owner: '+ownerName; $('businessOwnerLabel').textContent='Owner: '+ownerName;
      const files = selectedImages.length ? selectedImages : [...($('productPhotos').files || [])];
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
  async function loadProduct() {
    try {
      const {data,error} = await sb.from('business_products').select('*').eq('published',true).order('created_at',{ascending:false}).limit(24);
      if (error) throw error;
      renderCatalog(data || []);
      if (data?.length) {
        const keep = activeProduct && data.find(p => p.id === activeProduct.id);
        renderProduct(keep || data[0]);
      } else activeProduct = null;
    } catch (e) {
      const host = $('businessProductCatalog'); if (host) host.innerHTML = '<p class="live-empty">Could not load live listings: ' + escapeHTML(errorText(e)) + '</p>';
      console.warn('Could not load shop listing:',errorText(e));
    }
  }
  async function checkout() {
    if (!requireSession()) return;
    const quantity = Math.max(0, Number($('qtyValue').textContent) || 0);
    if (!quantity) { toast('Add at least one item first'); return; }
    if (!activeProduct?.id) { toast('Publish or load a product first'); return; }
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
    setTimeout(() => { try { if (channel && sb.removeChannel) sb.removeChannel(channel); } catch (_) {} }, 120000);
  }
  function showOrderResult(r) {
    if (typeof window.showAccountPanel === 'function') window.showAccountPanel('Order created',[{icon:'✓',label:'Order reference',detail:r?.order_id || r?.id || 'Created'},{icon:'▣',label:'Amount due',detail:money(r?.total_amount)},{icon:'▦',label:'Payment status',detail:r?.payment_started?'STK request accepted · awaiting Safaricom callback':'Unpaid · M-Pesa request not started'},{icon:'ℹ',label:'Next step',detail:r?.payment_message || 'Check the payment status before retrying.'}]);
    $('qtyValue').textContent='0'; updateCartUI();
  }
  async function handleJoinPool() {
    if (!requireSession()) return;
    if (!activeProduct?.id || !activeProduct.pooling_enabled) { toast('This product does not have pooling enabled.'); return; }
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
      $('poolStatus').textContent='Open pool found. Complete checkout to place your order in this pool.';
      toast('Group-buy pool selected. Complete checkout to join.');
    } catch(e) { toast('Could not open pool: '+errorText(e)); }
  }
  document.addEventListener('click', async e => {
    const unpublishButton = e.target.closest('[data-unpublish-product]');
    const publishAgainButton = e.target.closest('[data-publish-product]');
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
      if (!confirm(shouldPublish ? `Publish “${name}” to the marketplace?` : `Remove “${name}” from the marketplace? Its order history will be preserved.`)) return;
      button.disabled = true; button.textContent = shouldPublish ? 'Publishing…' : 'Removing…';
      try {
        const { data, error } = await sb.from('business_products').update({published: shouldPublish}).eq('id', productId).eq('seller_id', session.user.id).select('id');
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
      e.preventDefault(); productDetailOpen = false; activeProduct = null; poolId = null;
      const detailCard = document.querySelector('.product-card'); if (detailCard) detailCard.style.display = 'none';
      if ($('customerTermsPanel')) $('customerTermsPanel').style.display = 'none';
      if ($('poolPanel')) $('poolPanel').style.display = 'none';
      if ($('poolSectionHeading')) $('poolSectionHeading').style.display = 'none';
      const catalog = $('businessProductCatalog'); catalog?.scrollIntoView({behavior:'smooth',block:'start'});
      return;
    }
    const productButton = e.target.closest('[data-open-product]');
    if (productButton) {
      e.preventDefault();
      const selected = catalogProducts.find(p => String(p.id) === String(productButton.dataset.openProduct));
      if (selected) {
        renderProduct(selected);
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
  }, true);
  $('sellerPoolEnabled')?.addEventListener('change', () => {
    const enabled = $('sellerPoolEnabled').checked;
    if ($('sellerPoolSettings')) $('sellerPoolSettings').style.display = enabled ? 'block' : 'none';
    if ($('poolStatus')) $('poolStatus').textContent = enabled ? 'Group buying is enabled for this product. Publish/save the product to apply it.' : 'Group buying is disabled for this product.';
    if (!enabled && $('poolPanel')) $('poolPanel').style.display = 'none';
  });
  $('backToMarketplace')?.addEventListener('click', () => {
    productDetailOpen = false; activeProduct = null; poolId = null;
    const detailCard = document.querySelector('.product-card'); if (detailCard) detailCard.style.display = 'none';
    if ($('customerTermsPanel')) $('customerTermsPanel').style.display = 'none';
    if ($('poolPanel')) $('poolPanel').style.display = 'none';
    if ($('poolSectionHeading')) $('poolSectionHeading').style.display = 'none';
    $('businessProductCatalog')?.scrollIntoView({behavior:'smooth',block:'start'});
  });
  const photoInput = $('productPhotos');
  photoInput.addEventListener('change',()=>{ selectedImages=[...(photoInput.files||[])]; });
  $('resetProductForm')?.addEventListener('click',()=>{ selectedImages=[]; if(photoInput) photoInput.value=''; if($('productPhotoNames')) $('productPhotoNames').textContent='No product photos selected'; });
  const drop = $('productPhotoDrop');
  drop.addEventListener('drop',e=>{ selectedImages=[...e.dataTransfer.files].filter(f=>f.type.startsWith('image/')); });
  $('deliveryMethod').addEventListener('change',updateCartUI);
  $('qtyPlus').addEventListener('click',()=>setTimeout(updateCartUI,0));
  $('qtyMinus').addEventListener('click',()=>setTimeout(updateCartUI,0));
  let marketplaceChannel = null;
  function startMarketplaceRealtime(){ if(marketplaceChannel)sb.removeChannel(marketplaceChannel); marketplaceChannel=sb.channel('mjadala-marketplace').on('postgres_changes',{event:'*',schema:'public',table:'business_products'},()=>loadProduct()).subscribe(); }
  sb.auth.getSession().then(({data})=>{ session=data.session; if (!session) addAuthUI(); else if($('businessAuthPanel'))$('businessAuthPanel').style.display='none'; if(session){loadBusinessProfile(); if($('ownerPanel') && getComputedStyle($('ownerPanel')).display!=='none') loadOwnerInventory();} loadProduct(); startMarketplaceRealtime(); });
  sb.auth.onAuthStateChange((_event,newSession)=>{session=newSession;if(session){if($('businessAuthPanel'))$('businessAuthPanel').style.display='none';loadBusinessProfile(); if($('ownerPanel') && getComputedStyle($('ownerPanel')).display!=='none') loadOwnerInventory();}else{addAuthUI();$('myBusinessTitle').textContent='My Business';$('myBusinessOwner').textContent='Sign in to manage your business.';}loadProduct();});
})();
