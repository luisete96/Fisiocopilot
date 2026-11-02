alter table public.billing_transactions
  add column if not exists appointment_id uuid;

create unique index if not exists idx_billing_transactions_appointment_id
  on public.billing_transactions (appointment_id)
  where appointment_id is not null;

create or replace function public.register_appointment_payment(
  p_appointment_id uuid,
  p_patient_id uuid,
  p_patient_name text,
  p_payment_method text,
  p_physiotherapist_name text,
  p_transaction_date date,
  p_item_id uuid default null,
  p_voucher_id uuid default null,
  p_notes text default null
) returns uuid
language plpgsql
set search_path = public
as $$
declare
  v_transaction_id uuid;
  v_item public.catalog_items%rowtype;
  v_voucher public.patient_vouchers%rowtype;
  v_category text;
  v_concept text;
  v_base_amount numeric(10, 2);
  v_vat_rate numeric(5, 2);
  v_vat_amount numeric(10, 2);
  v_total_amount numeric(10, 2);
  v_voucher_id uuid;
  v_payment_method text;
begin
  if p_appointment_id is null or p_patient_id is null or coalesce(trim(p_patient_name), '') = '' then
    raise exception 'La cita y el paciente son obligatorios.';
  end if;

  if exists (
    select 1 from public.billing_transactions
    where appointment_id = p_appointment_id
  ) then
    raise exception 'Esta cita ya tiene un cobro asociado.';
  end if;

  if p_voucher_id is not null then
    select * into v_voucher
    from public.patient_vouchers
    where id = p_voucher_id
    for update;

    if not found or v_voucher.patient_id is distinct from p_patient_id then
      raise exception 'El bono no pertenece al paciente de esta cita.';
    end if;
    if v_voucher.status <> 'activo' or v_voucher.remaining_sessions <= 0 then
      raise exception 'El bono seleccionado no tiene sesiones disponibles.';
    end if;

    update public.patient_vouchers
    set used_sessions = used_sessions + 1,
        remaining_sessions = remaining_sessions - 1,
        status = case when remaining_sessions = 1 then 'agotado' else 'activo' end
    where id = p_voucher_id;

    v_category := 'canje_bono';
    v_concept := v_voucher.voucher_name || ' (sesión canjeada)';
    v_base_amount := 0;
    v_vat_rate := 0;
    v_vat_amount := 0;
    v_total_amount := 0;
    v_voucher_id := p_voucher_id;
    v_payment_method := 'bono';
  else
    if p_payment_method not in ('efectivo', 'tarjeta', 'bizum', 'transferencia') then
      raise exception 'Selecciona un método de pago válido.';
    end if;
    if p_item_id is null then
      raise exception 'Selecciona una tarifa para registrar el cobro.';
    end if;

    select * into v_item
    from public.catalog_items
    where id = p_item_id and is_active = true and category = 'servicio';

    if not found then
      raise exception 'La tarifa no existe o no está activa.';
    end if;

    v_category := 'servicio';
    v_concept := v_item.name;
    v_base_amount := round(v_item.price / (1 + v_item.vat_rate / 100), 2);
    v_vat_rate := v_item.vat_rate;
    v_vat_amount := round(v_item.price - v_base_amount, 2);
    v_total_amount := v_item.price;
    v_voucher_id := null;
    v_payment_method := p_payment_method;
  end if;

  insert into public.billing_transactions (
    transaction_date, appointment_id, patient_id, patient_name, item_id, concept, category,
    base_amount, vat_rate, vat_amount, total_amount, payment_method,
    physiotherapist_name, voucher_id, notes
  ) values (
    p_transaction_date, p_appointment_id, p_patient_id, p_patient_name,
    case when p_voucher_id is null then p_item_id else null end,
    v_concept, v_category, v_base_amount, v_vat_rate, v_vat_amount, v_total_amount,
    v_payment_method, p_physiotherapist_name, v_voucher_id, p_notes
  ) returning id into v_transaction_id;

  return v_transaction_id;
end;
$$;

grant execute on function public.register_appointment_payment(
  uuid, uuid, text, text, text, date, uuid, uuid, text
) to anon, authenticated;

notify pgrst, 'reload schema';
