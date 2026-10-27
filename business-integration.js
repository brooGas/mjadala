/* Mjadala Business + Shop integration. Uses the existing public Supabase project key.
   Never place a service_role key in browser code. */
(() => {
  'use strict';
  const SUPABASE_URL = 'https://olqwfscmhtdseljvfqvm.supabase.co';
  const SUPABASE_ANON_KEY = 'sb_publishable_Ay8LXBjvNhXQJDKQMF_Etw_SMb6_z4M';
  const AUTH_DOMAIN = 'mjadala.app';
  if (!window.supabase?.createClient) { console.error('Supabase SDK failed to load'); return; }
  const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  window.mjadalaAuth = { getSession: () => sb.auth.getSession(), signOut: () => sb.auth.signOut(), getUser: () => sb.auth.getUser() };
  const $ = id => document.getElementById(id);
  let session = null, activeProduct = null, selectedImages = [], poolId = null;
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
  function requireSession() {
    if (session?.user) return true;
    addAuthUI(); $('businessAuthPanel').style.display = 'block'; $('bizAuthStatus').textContent = 'Sign in first to save products or place orders.';
    $('businessAuthPanel').scrollIntoView({behavior:'smooth',block:'center'}); return false;
  }
  function readProductForm() {
    const name = $('sellerProductName').value.trim();
    const description = $('sellerProductDescription').value.trim();
    const price = Number($('sellerProductPrice').value);
    if (!name) throw new Error('Enter a product name.');
    if (!Number.isFinite(price) || price <= 0) throw new Error('Enter a price greater than zero.');
    const min = Math.max(2, Number($('poolMinimum').value) || 2);
    const max = Math.max(min, Number($('poolCapacity').value) || min);
    const discount = Math.min(90, Math.max(0, Number($('poolDiscount').value) || 0));
    return {
      seller_id: session.user.id, product_name:name, description, price, currency:'KES', image_urls:[],
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
    activeProduct = p;
    $('customerProductName').textContent = p.product_name;
    $('customerProductDescription').textContent = p.description || '';
    $('customerProductPrice').textContent = money(p.price);
    $('customerWarranty').textContent = p.warranty_period || 'No warranty offered';
    $('customerReturns').textContent = p.return_terms || 'No additional return policy provided.';
    $('customerTerms').textContent = p.additional_terms || 'No additional terms provided.';
    const thumb = document.querySelector('.product-thumb');
    if (thumb && p.image_urls?.[0]) { thumb.innerHTML = `<img alt="${escapeHTML(p.product_name)}" src="${p.image_urls[0]}" style="width:100%;height:100%;object-fit:cover;border-radius:12px">`; }
    const standard = Number(p.standard_delivery_fee || 0), express = Number(p.express_delivery_fee || 0);
    const delivery = $('deliveryMethod');
    delivery.innerHTML = `<option value="standard">Standard delivery · ${money(standard)}</option><option value="express">Express delivery · ${money(express)}</option>${p.pickup_available ? '<option value="pickup">Collect from seller · Free</option>' : ''}`;
    window.businessCurrentProduct = p;
    if (typeof window.updateCart === 'function') { /* legacy functions are scoped; event below refreshes totals */ }
    document.dispatchEvent(new CustomEvent('mjadala:product-loaded',{detail:p}));
    updateCartUI();
    $('poolSectionHeading').style.display = p.pooling_enabled ? '' : 'none';
    $('poolPanel').style.display = p.pooling_enabled ? '' : 'none';
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
      const businessName = prompt('Business name for your seller profile:');
      if (!businessName?.trim()) throw new Error('Business name is required to publish.');
      const { error: profileError } = await sb.from('business_profiles').upsert({user_id:session.user.id,business_name:businessName.trim(),updated_at:new Date().toISOString()},{onConflict:'user_id'});
      if (profileError) throw profileError;
      const files = selectedImages.length ? selectedImages : [...($('productPhotos').files || [])];
      payload.image_urls = await uploadPhotos(files);
      const { data, error } = await sb.from('business_products').insert(payload).select('*').single();
      if (error) throw error;
      renderProduct(data); status.textContent = 'Published and saved to Supabase.'; toast('Product published');
    } catch (e) { status.textContent = 'Could not publish: ' + errorText(e); }
  }
  async function loadProduct() {
    try {
      const {data,error} = await sb.from('business_products').select('*').eq('published',true).order('created_at',{ascending:false}).limit(1).maybeSingle();
      if (error) throw error;
      if (data) renderProduct(data);
    } catch (e) { console.warn('Could not load shop listing:',errorText(e)); }
  }
  async function checkout() {
    if (!requireSession()) return;
    const quantity = Math.max(0, Number($('qtyValue').textContent) || 0);
    if (!quantity) { toast('Add at least one item first'); return; }
    if (!activeProduct?.id) { toast('Publish or load a product first'); return; }
    const name = $('checkoutCustomerName').value.trim(), phone = $('checkoutCustomerPhone').value.trim();
    const method = $('deliveryMethod').value, address = $('deliveryAddress').value.trim();
    if (!name || !phone) { toast('Enter your name and phone number'); return; }
    if (method !== 'pickup' && !address) { toast('Enter your delivery location'); return; }
    const button = $('stkButton'); button.disabled = true; button.textContent = 'Creating secure order…';
    try {
      const {data,error} = await sb.rpc('place_business_order',{p_product_id:activeProduct.id,p_quantity:quantity,p_delivery_method:method,p_customer_name:name,p_customer_phone:phone,p_delivery_address:address || 'Seller pickup',p_pool_id:poolId});
      if (error) throw error;
      const result = Array.isArray(data) ? data[0] : data;
      showOrderResult(result);
      toast('Order created. M-Pesa payment is not yet connected.');
    } catch(e) { toast('Order failed: ' + errorText(e)); }
    finally { button.disabled = false; button.innerHTML = '<svg class="std-icon"><use href="#i-credit"/></svg> Pay with M-Pesa · STK Push'; }
  }
  function showOrderResult(r) {
    if (typeof window.showAccountPanel === 'function') window.showAccountPanel('Order created',[{icon:'✓',label:'Order reference',detail:r?.order_id || r?.id || 'Created'},{icon:'▣',label:'Amount due',detail:money(r?.total_amount)},{icon:'▦',label:'Payment status',detail:'Pending — M-Pesa gateway not connected yet.'}]);
    $('qtyValue').textContent='0'; updateCartUI();
  }
  async function handleJoinPool() {
    if (!requireSession()) return;
    if (!activeProduct?.id || !activeProduct.pooling_enabled) { toast('This product does not have pooling enabled.'); return; }
    try {
      if (!poolId) {
        const {data,error} = await sb.from('product_pools').insert({product_id:activeProduct.id,created_by:session.user.id,pool_name:activeProduct.product_name+' group buy',pool_status:'open'}).select('id').single();
        if (error) throw error; poolId=data.id;
      }
      $('poolStatus').textContent='Pool selected. Place your order to become a confirmed participant.';
      toast('Group-buy pool selected. Complete checkout to join.');
    } catch(e) { toast('Could not open pool: '+errorText(e)); }
  }
  document.addEventListener('click', e => {
    const publishButton = e.target.closest('#publishProduct');
    if (publishButton) { e.preventDefault(); e.stopImmediatePropagation(); publish(); return; }
    const checkoutButton = e.target.closest('#stkButton');
    if (checkoutButton) { e.preventDefault(); e.stopImmediatePropagation(); checkout(); return; }
    const joinButton = e.target.closest('#joinPoolButton');
    if (joinButton) { e.preventDefault(); e.stopImmediatePropagation(); handleJoinPool(); return; }
  }, true);
  const photoInput = $('productPhotos');
  photoInput.addEventListener('change',()=>{ selectedImages=[...(photoInput.files||[])]; });
  const drop = $('productPhotoDrop');
  drop.addEventListener('drop',e=>{ selectedImages=[...e.dataTransfer.files].filter(f=>f.type.startsWith('image/')); });
  $('deliveryMethod').addEventListener('change',updateCartUI);
  $('qtyPlus').addEventListener('click',()=>setTimeout(updateCartUI,0));
  $('qtyMinus').addEventListener('click',()=>setTimeout(updateCartUI,0));
  sb.auth.getSession().then(({data})=>{ session=data.session; if (!session) addAuthUI(); else loadProduct(); });
  sb.auth.onAuthStateChange((_event,newSession)=>{session=newSession;if(session){if($('businessAuthPanel'))$('businessAuthPanel').style.display='none';loadProduct();}else addAuthUI();});
})();
