-- Mjadala inventory reservation + payment-confirmed stock reduction
-- Run in Supabase SQL Editor AFTER the existing business shopping tables/migration.
-- Existing stock_quantity values are initialized to 0; set accurate stock per product before accepting orders.

alter table public.business_products
  add column if not exists stock_quantity integer not null default 0,
  add column if not exists stock_reserved integer not null default 0;

alter table public.business_products
  drop constraint if exists business_products_stock_quantity_nonnegative,
  add constraint business_products_stock_quantity_nonnegative check (stock_quantity >= 0),
  drop constraint if exists business_products_stock_reserved_nonnegative,
  add constraint business_products_stock_reserved_nonnegative check (stock_reserved >= 0 and stock_reserved <= stock_quantity);

-- Reserve available units when an order is created. Product row locking serializes competing orders.
create or replace function public.mjadala_reserve_order_stock()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare v_available integer;
begin
  if tg_op = 'INSERT' then
    update public.business_products
       set stock_reserved = stock_reserved + new.quantity
     where id = new.product_id
       and published = true
       and stock_quantity - stock_reserved >= new.quantity;
    if not found then raise exception 'Insufficient stock: reduce quantity or choose another product'; end if;
  end if;
  return new;
end; $$;

drop trigger if exists mjadala_reserve_stock_on_order on public.business_orders;
create trigger mjadala_reserve_stock_on_order
before insert on public.business_orders
for each row execute function public.mjadala_reserve_order_stock();

-- On first confirmed payment, convert reservation into a real stock reduction exactly once.
-- On failure/cancellation, release reservation without reducing stock.
create or replace function public.mjadala_finalize_order_stock()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare v_status text; v_old text;
begin
  v_status := lower(coalesce(new.payment_status,''));
  v_old := case when tg_op='UPDATE' then lower(coalesce(old.payment_status,'')) else '' end;
  if tg_op='UPDATE' and v_status = v_old then return new; end if;

  if v_status = 'paid' and v_old <> 'paid' then
    update public.business_products
       set stock_quantity = stock_quantity - new.quantity,
           stock_reserved = stock_reserved - new.quantity
     where id = new.product_id
       and stock_reserved >= new.quantity
       and stock_quantity >= new.quantity;
    if not found then raise exception 'Cannot finalize payment: stock reservation is missing'; end if;
  elsif v_status in ('failed','cancelled','canceled','expired') and v_old not in ('failed','cancelled','canceled','expired','paid') then
    update public.business_products
       set stock_reserved = stock_reserved - new.quantity
     where id = new.product_id and stock_reserved >= new.quantity;
    if not found then raise exception 'Cannot release stock: reservation is missing'; end if;
  end if;
  return new;
end; $$;

drop trigger if exists mjadala_finalize_stock_on_payment on public.business_orders;
create trigger mjadala_finalize_stock_on_payment
after update of payment_status on public.business_orders
for each row execute function public.mjadala_finalize_order_stock();

-- Important: order insertion reserves units. Ensure the M-Pesa callback updates business_orders.payment_status
-- to exactly 'paid' on confirmed success and 'failed' on confirmed failure/cancellation.
-- Do not set 'paid' from browser code. Configure stock_quantity values for existing products before launch.
