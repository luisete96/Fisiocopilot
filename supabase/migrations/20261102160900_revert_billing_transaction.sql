create or replace function public.revert_billing_transaction(
  p_transaction_id uuid
) returns uuid
language plpgsql
set search_path = public
as $$
declare
  v_transaction public.billing_transactions%rowtype;
  v_voucher public.patient_vouchers%rowtype;
  v_closure_date date;
  v_total_efectivo numeric(10, 2);
  v_total_tarjeta numeric(10, 2);
  v_total_bizum numeric(10, 2);
  v_total_transferencia numeric(10, 2);
  v_total_servicios_exentos numeric(10, 2);
  v_total_productos_base numeric(10, 2);
  v_total_iva numeric(10, 2);
  v_total_facturado numeric(10, 2);
begin
  select * into v_transaction
  from public.billing_transactions
  where id = p_transaction_id
  for update;

  if not found then
    raise exception 'No se encontró el movimiento de caja.';
  end if;

  if v_transaction.category = 'canje_bono' then
    if v_transaction.voucher_id is null then
      raise exception 'No se puede devolver la sesión: el movimiento ya no tiene un bono asociado.';
    end if;

    select * into v_voucher
    from public.patient_vouchers
    where id = v_transaction.voucher_id
    for update;

    if not found or v_voucher.used_sessions <= 0 then
      raise exception 'No se puede devolver la sesión al bono porque no se encontró un saldo válido.';
    end if;

    update public.patient_vouchers
    set used_sessions = used_sessions - 1,
        remaining_sessions = remaining_sessions + 1,
        status = 'activo'
    where id = v_voucher.id;
  elsif v_transaction.category = 'bono' and v_transaction.voucher_id is not null then
    select * into v_voucher
    from public.patient_vouchers
    where id = v_transaction.voucher_id
    for update;

    if found then
      if v_voucher.used_sessions <> 0 then
        raise exception 'No se puede eliminar la venta: el bono ya tiene sesiones canjeadas.';
      end if;
      delete from public.patient_vouchers where id = v_voucher.id;
    end if;
  end if;

  v_closure_date := v_transaction.transaction_date;
  delete from public.billing_transactions where id = p_transaction_id;

  select
    coalesce(sum(total_amount) filter (where payment_method = 'efectivo'), 0),
    coalesce(sum(total_amount) filter (where payment_method = 'tarjeta'), 0),
    coalesce(sum(total_amount) filter (where payment_method = 'bizum'), 0),
    coalesce(sum(total_amount) filter (where payment_method = 'transferencia'), 0),
    coalesce(sum(base_amount) filter (where category = 'servicio' and vat_rate = 0), 0),
    coalesce(sum(base_amount) filter (where category = 'producto'), 0),
    coalesce(sum(vat_amount), 0),
    coalesce(sum(total_amount), 0)
  into
    v_total_efectivo, v_total_tarjeta, v_total_bizum, v_total_transferencia,
    v_total_servicios_exentos, v_total_productos_base, v_total_iva, v_total_facturado
  from public.billing_transactions
  where transaction_date = v_closure_date;

  update public.cash_closures
  set total_efectivo = v_total_efectivo,
      total_tarjeta = v_total_tarjeta,
      total_bizum = v_total_bizum,
      total_transferencia = v_total_transferencia,
      total_servicios_exentos = v_total_servicios_exentos,
      total_productos_base = v_total_productos_base,
      total_iva_repercutido = v_total_iva,
      total_facturado = v_total_facturado
  where closure_date = v_closure_date;

  return p_transaction_id;
end;
$$;

grant execute on function public.revert_billing_transaction(uuid)
  to anon, authenticated;

notify pgrst, 'reload schema';
