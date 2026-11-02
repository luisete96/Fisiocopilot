create table if not exists public.catalog_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null default 'servicio'
    check (category in ('servicio', 'bono', 'producto')),
  price numeric(10, 2) not null check (price >= 0),
  vat_rate numeric(5, 2) not null default 0.00 check (vat_rate >= 0),
  total_sessions integer not null default 1 check (total_sessions > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists public.patient_vouchers (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid references public.patients(id) on delete cascade,
  patient_name text not null,
  voucher_name text not null,
  total_sessions integer not null check (total_sessions > 0),
  used_sessions integer not null default 0 check (used_sessions >= 0),
  remaining_sessions integer not null check (remaining_sessions >= 0),
  status text not null default 'activo' check (status in ('activo', 'agotado')),
  purchase_date timestamptz not null default timezone('utc'::text, now()),
  constraint patient_vouchers_session_balance_check
    check (used_sessions + remaining_sessions = total_sessions),
  constraint patient_vouchers_status_balance_check
    check ((remaining_sessions = 0 and status = 'agotado') or (remaining_sessions > 0 and status = 'activo'))
);

create table if not exists public.billing_transactions (
  id uuid primary key default gen_random_uuid(),
  transaction_date date not null default current_date,
  patient_id uuid references public.patients(id) on delete set null,
  patient_name text not null,
  item_id uuid references public.catalog_items(id) on delete set null,
  concept text not null,
  category text not null check (category in ('servicio', 'bono', 'producto', 'canje_bono')),
  base_amount numeric(10, 2) not null default 0.00 check (base_amount >= 0),
  vat_rate numeric(5, 2) not null default 0.00 check (vat_rate >= 0),
  vat_amount numeric(10, 2) not null default 0.00 check (vat_amount >= 0),
  total_amount numeric(10, 2) not null default 0.00 check (total_amount >= 0),
  payment_method text not null
    check (payment_method in ('efectivo', 'tarjeta', 'bizum', 'transferencia', 'bono')),
  physiotherapist_name text,
  voucher_id uuid references public.patient_vouchers(id) on delete set null,
  notes text,
  created_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists public.cash_closures (
  id uuid primary key default gen_random_uuid(),
  closure_date date not null unique,
  total_efectivo numeric(10, 2) not null default 0.00,
  total_tarjeta numeric(10, 2) not null default 0.00,
  total_bizum numeric(10, 2) not null default 0.00,
  total_transferencia numeric(10, 2) not null default 0.00,
  total_servicios_exentos numeric(10, 2) not null default 0.00,
  total_productos_base numeric(10, 2) not null default 0.00,
  total_iva_repercutido numeric(10, 2) not null default 0.00,
  total_facturado numeric(10, 2) not null default 0.00,
  closed_by text,
  notes text,
  created_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists idx_catalog_items_active_category
  on public.catalog_items (is_active, category);
create unique index if not exists idx_catalog_items_category_name
  on public.catalog_items (category, lower(name));
create index if not exists idx_patient_vouchers_patient_status
  on public.patient_vouchers (patient_id, status, purchase_date desc);
create index if not exists idx_billing_transactions_date
  on public.billing_transactions (transaction_date desc, created_at desc);
create index if not exists idx_billing_transactions_patient
  on public.billing_transactions (patient_id, transaction_date desc);

alter table public.catalog_items enable row level security;
alter table public.patient_vouchers enable row level security;
alter table public.billing_transactions enable row level security;
alter table public.cash_closures enable row level security;

drop policy if exists "Allow all catalog_items" on public.catalog_items;
create policy "Allow all catalog_items" on public.catalog_items
  for all to anon, authenticated using (true) with check (true);
drop policy if exists "Allow all patient_vouchers" on public.patient_vouchers;
create policy "Allow all patient_vouchers" on public.patient_vouchers
  for all to anon, authenticated using (true) with check (true);
drop policy if exists "Allow all billing_transactions" on public.billing_transactions;
create policy "Allow all billing_transactions" on public.billing_transactions
  for all to anon, authenticated using (true) with check (true);
drop policy if exists "Allow all cash_closures" on public.cash_closures;
create policy "Allow all cash_closures" on public.cash_closures
  for all to anon, authenticated using (true) with check (true);

grant select, insert, update, delete on public.catalog_items to anon, authenticated;
grant select, insert, update, delete on public.patient_vouchers to anon, authenticated;
grant select, insert, update, delete on public.billing_transactions to anon, authenticated;
grant select, insert, update, delete on public.cash_closures to anon, authenticated;

insert into public.catalog_items (name, category, price, vat_rate, total_sessions) values
  ('Valoración Inicial (30 min)', 'servicio', 35.00, 0.00, 1),
  ('Sesión Completa Fisioterapia', 'servicio', 50.00, 0.00, 1),
  ('Sesión Solo Indiba / Radiofrecuencia', 'servicio', 40.00, 0.00, 1),
  ('Sesión Entrenamiento / Readaptación', 'servicio', 45.00, 21.00, 1),
  ('Bono 5 Sesiones Fisioterapia', 'bono', 225.00, 0.00, 5),
  ('Crema / Material Terapéutico', 'producto', 15.00, 21.00, 1)
on conflict do nothing;

create or replace function public.purchase_patient_voucher(
  p_patient_id uuid,
  p_item_id uuid,
  p_patient_name text,
  p_voucher_name text,
  p_total_sessions integer,
  p_price numeric,
  p_vat_rate numeric,
  p_payment_method text,
  p_physiotherapist_name text,
  p_transaction_date date default current_date,
  p_notes text default null
) returns uuid
language plpgsql
set search_path = public
as $$
declare
  v_voucher_id uuid;
  v_base_amount numeric(10, 2);
  v_vat_amount numeric(10, 2);
begin
  if p_total_sessions <= 0 or p_price < 0 or p_vat_rate < 0 then
    raise exception 'Los datos del bono no son válidos.';
  end if;
  if p_payment_method not in ('efectivo', 'tarjeta', 'bizum', 'transferencia') then
    raise exception 'El método de pago del bono no es válido.';
  end if;

  v_base_amount := round(p_price / (1 + p_vat_rate / 100), 2);
  v_vat_amount := round(p_price - v_base_amount, 2);

  insert into public.patient_vouchers (
    patient_id, patient_name, voucher_name, total_sessions, used_sessions, remaining_sessions, status
  ) values (
    p_patient_id, p_patient_name, p_voucher_name, p_total_sessions, 0, p_total_sessions, 'activo'
  ) returning id into v_voucher_id;

  insert into public.billing_transactions (
    transaction_date, patient_id, patient_name, item_id, concept, category, base_amount, vat_rate, vat_amount, total_amount,
    payment_method, physiotherapist_name, voucher_id, notes
  ) values (
    p_transaction_date, p_patient_id, p_patient_name, p_item_id, p_voucher_name, 'bono', v_base_amount, p_vat_rate, v_vat_amount, p_price,
    p_payment_method, p_physiotherapist_name, v_voucher_id, p_notes
  );

  return v_voucher_id;
end;
$$;

create or replace function public.redeem_patient_voucher(
  p_voucher_id uuid,
  p_physiotherapist_name text,
  p_transaction_date date default current_date,
  p_notes text default null
) returns uuid
language plpgsql
set search_path = public
as $$
declare
  v_voucher public.patient_vouchers%rowtype;
  v_transaction_id uuid;
begin
  select * into v_voucher
  from public.patient_vouchers
  where id = p_voucher_id
  for update;

  if not found then
    raise exception 'No se encontró el bono seleccionado.';
  end if;
  if v_voucher.status <> 'activo' or v_voucher.remaining_sessions <= 0 then
    raise exception 'El bono ya está agotado.';
  end if;

  update public.patient_vouchers
  set used_sessions = used_sessions + 1,
      remaining_sessions = remaining_sessions - 1,
      status = case when remaining_sessions = 1 then 'agotado' else 'activo' end
  where id = p_voucher_id;

  insert into public.billing_transactions (
    transaction_date, patient_id, patient_name, concept, category, base_amount, vat_rate, vat_amount, total_amount,
    payment_method, physiotherapist_name, voucher_id, notes
  ) values (
    p_transaction_date, v_voucher.patient_id, v_voucher.patient_name, v_voucher.voucher_name || ' (sesión canjeada)',
    'canje_bono', 0, 0, 0, 0, 'bono', p_physiotherapist_name, v_voucher.id, p_notes
  ) returning id into v_transaction_id;

  return v_transaction_id;
end;
$$;

grant execute on function public.purchase_patient_voucher(uuid, uuid, text, text, integer, numeric, numeric, text, text, date, text)
  to anon, authenticated;
grant execute on function public.redeem_patient_voucher(uuid, text, date, text)
  to anon, authenticated;

notify pgrst, 'reload schema';
