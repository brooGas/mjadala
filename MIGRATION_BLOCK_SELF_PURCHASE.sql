-- MJADALA: block sellers from buying their own published products through checkout.
-- Run this once in Supabase SQL Editor during the database-connection step.
-- This updates the existing RPC function; it does not affect purchases from other sellers.

create or replace function public.place_business_order(
  p_product_id uuid,
  p_quantity integer,
  p_delivery_method text,
  p_customer_name text,
  p_customer_phone text,
  p_delivery_address text,
  p_pool_id uuid default null
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_product public.business_products%rowtype;
  v_pool public.product_pools%rowtype;
  v_members integer := 0;
  v_discount numeric := 0;
  v_unit numeric;
  v_delivery numeric;
  v_total numeric;
  v_order_id uuid;
begin
  if v_user is null then raise exception 'Sign in before checkout'; end if;
  if p_quantity is null or p_quantity < 1 or p_quantity > 100 then raise exception 'Quantity must be between 1 and 100'; end if;
  if coalesce(trim(p_customer_name),'') = '' or coalesce(trim(p_customer_phone),'') = '' then raise exception 'Customer name and phone are required'; end if;
  if p_delivery_method is null or p_delivery_method not in ('standard','express','pickup') then raise exception 'Invalid delivery method'; end if;
  if p_delivery_method <> 'pickup' and coalesce(trim(p_delivery_address),'') = '' then raise exception 'Delivery address is required'; end if;

  select * into v_product from public.business_products
   where id = p_product_id and published = true for update;
  if not found then raise exception 'Product is unavailable'; end if;
  if v_product.seller_id = v_user then
    raise exception 'You cannot purchase your own product through customer checkout';
  end if;

  if p_delivery_method = 'pickup' then
    if not v_product.pickup_available then raise exception 'Pickup is not available for this product'; end if;
    v_delivery := 0;
  elsif p_delivery_method = 'express' then
    v_delivery := greatest(coalesce(v_product.express_delivery_fee,0),0);
  else
    v_delivery := greatest(coalesce(v_product.standard_delivery_fee,0),0);
  end if;

  v_unit := v_product.price;
  if p_pool_id is not null then
    if not coalesce(v_product.pooling_enabled,false) then raise exception 'Pooling is not enabled for this product'; end if;
    select * into v_pool from public.product_pools where id = p_pool_id and product_id = p_product_id and pool_status = 'open' for update;
    if not found then raise exception 'This group-buy pool is not open'; end if;
    select count(*) into v_members from public.product_pool_members where pool_id = p_pool_id;
    if v_members >= coalesce(v_product.pool_max_members,10) then raise exception 'This pool is full'; end if;
    if exists(select 1 from public.product_pool_members m join public.business_orders o on o.id=m.order_id where m.pool_id=p_pool_id and m.buyer_id=v_user) then
      raise exception 'You already joined this pool';
    end if;
    if v_members + 1 >= coalesce(v_product.pool_min_members,5) then
      v_discount := least(90,greatest(0,coalesce(v_product.pool_discount_percent,0)));
    end if;
    v_unit := round(v_product.price * (1 - v_discount / 100), 2);
    v_delivery := greatest(coalesce(v_product.pool_delivery_fee,0),0);
  end if;

  v_total := round(v_unit * p_quantity + v_delivery, 2);
  insert into public.business_orders(
    product_id,seller_id,buyer_id,quantity,unit_price,discount_amount,
    delivery_method,delivery_fee,total_amount,customer_name,customer_phone,
    delivery_address,order_status,payment_status
  ) values (
    v_product.id,v_product.seller_id,v_user,p_quantity,v_unit,
    round((v_product.price-v_unit)*p_quantity,2),p_delivery_method,v_delivery,v_total,
    trim(p_customer_name),trim(p_customer_phone),trim(coalesce(p_delivery_address,'')),'pending','pending'
  ) returning id into v_order_id;

  if p_pool_id is not null then
    insert into public.product_pool_members(pool_id,buyer_id,order_id) values (p_pool_id,v_user,v_order_id);
  end if;
  return jsonb_build_object('order_id',v_order_id,'total_amount',v_total,'unit_price',v_unit,
    'delivery_fee',v_delivery,'discount_amount',round((v_product.price-v_unit)*p_quantity,2),
    'payment_status','pending','pool_members_after',case when p_pool_id is null then null else v_members+1 end);
end;
$$;
