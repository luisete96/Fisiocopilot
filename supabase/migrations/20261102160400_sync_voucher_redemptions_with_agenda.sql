create or replace function public.redeem_patient_voucher_for_appointment(
  p_voucher_id uuid,
  p_appointment_id uuid,
  p_patient_id uuid,
  p_physiotherapist_name text,
  p_transaction_date date,
  p_notes text default null
) returns uuid
language plpgsql
set search_path = public
as $$
declare
  v_voucher public.patient_vouchers%rowtype;
  v_transaction_id uuid;
begin
  if p_appointment_id is null or p_patient_id is null then
    raise exception 'La cita y el paciente son obligatorios para asociar el canje.';
  end if;

  if exists (
    select 1
    from public.billing_transactions
    where appointment_id = p_appointment_id
  ) then
    raise exception 'Esta cita ya tiene un cobro o canje asociado.';
  end if;

  select * into v_voucher
  from public.patient_vouchers
  where id = p_voucher_id
  for update;

  if not found or v_voucher.patient_id is distinct from p_patient_id then
    raise exception 'El bono no pertenece al paciente de la cita.';
  end if;
  if v_voucher.status <> 'activo' or v_voucher.remaining_sessions <= 0 then
    raise exception 'El bono ya no tiene sesiones disponibles.';
  end if;

  update public.patient_vouchers
  set used_sessions = used_sessions + 1,
      remaining_sessions = remaining_sessions - 1,
      status = case when remaining_sessions = 1 then 'agotado' else 'activo' end
  where id = p_voucher_id;

  insert into public.billing_transactions (
    transaction_date, appointment_id, patient_id, patient_name, concept, category,
    base_amount, vat_rate, vat_amount, total_amount, payment_method,
    physiotherapist_name, voucher_id, notes
  ) values (
    p_transaction_date, p_appointment_id, v_voucher.patient_id, v_voucher.patient_name,
    v_voucher.voucher_name || ' (sesión canjeada)', 'canje_bono',
    0, 0, 0, 0, 'bono', p_physiotherapist_name, v_voucher.id, p_notes
  ) returning id into v_transaction_id;

  return v_transaction_id;
end;
$$;

grant execute on function public.redeem_patient_voucher_for_appointment(
  uuid, uuid, uuid, text, date, text
) to anon, authenticated;

notify pgrst, 'reload schema';
