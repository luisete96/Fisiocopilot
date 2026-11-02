import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Banknote, CalendarDays, Check, ClipboardList, CreditCard, Euro,
  FileSpreadsheet, HandCoins, Loader2, Plus, Receipt, RefreshCw, RotateCcw,
  Search, ShoppingBag, Tag, Wallet, X,
} from 'lucide-react';
import type {
  Appointment, BillingCategory, BillingTransaction, CashClosure, CatalogItem, Patient,
  PatientVoucher, PaymentMethod,
} from '../types';
import { getSupabaseClient } from '../supabaseClient';
import { extractRpcIdentifier } from '../billingUtils';
import { normalizeText } from '../patientUtils';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { Modal } from './ui/Modal';

type BillingSection = 'resumen' | 'bonos' | 'tarifas' | 'informes';
type VoucherFilter = 'active' | 'exhausted' | 'all';
type ReportPeriod = 'month' | 'q1' | 'q2' | 'q3' | 'q4' | 'year' | 'custom';
type SaleDraft = {
  patientId: string;
  itemId: string;
  paymentMethod: Exclude<PaymentMethod, 'bono'>;
  notes: string;
};
type CatalogDraft = {
  id?: string;
  isActive: boolean;
  name: string;
  category: CatalogItem['category'];
  price: string;
  vatRate: string;
  totalSessions: string;
};

const PAYMENT_METHODS: Exclude<PaymentMethod, 'bono'>[] = [
  'efectivo', 'tarjeta', 'bizum', 'transferencia',
];

const emptyCatalogDraft: CatalogDraft = {
  isActive: true,
  name: '',
  category: 'servicio',
  price: '',
  vatRate: '0',
  totalSessions: '1',
};

interface BillingScreenProps {
  patients: Patient[];
  appointments: Appointment[];
  physiotherapist: string;
  onSaveAppointment: (appointment: Appointment) => Promise<void>;
}

export function BillingScreen({
  patients, appointments, physiotherapist, onSaveAppointment,
}: BillingScreenProps) {
  const [section, setSection] = useState<BillingSection>('resumen');
  const [selectedDate, setSelectedDate] = useState(getLocalDate());
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [vouchers, setVouchers] = useState<PatientVoucher[]>([]);
  const [transactions, setTransactions] = useState<BillingTransaction[]>([]);
  const [reportTransactions, setReportTransactions] = useState<BillingTransaction[]>([]);
  const [closure, setClosure] = useState<CashClosure | null>(null);
  const [loading, setLoading] = useState(true);
  const [reportLoading, setReportLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saleOpen, setSaleOpen] = useState(false);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [saleDraft, setSaleDraft] = useState<SaleDraft>({
    patientId: '',
    itemId: '',
    paymentMethod: 'efectivo',
    notes: '',
  });
  const [catalogDraft, setCatalogDraft] = useState<CatalogDraft>(emptyCatalogDraft);
  const [voucherNotes, setVoucherNotes] = useState<Record<string, string>>({});
  const [voucherSearch, setVoucherSearch] = useState('');
  const [voucherFilter, setVoucherFilter] = useState<VoucherFilter>('active');
  const initialReportRange = getPeriodRange('month', new Date());
  const [reportPeriod, setReportPeriod] = useState<ReportPeriod>('month');
  const [reportStartDate, setReportStartDate] = useState(initialReportRange.start);
  const [reportEndDate, setReportEndDate] = useState(initialReportRange.end);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    const client = getSupabaseClient();
    const [catalogResult, voucherResult, transactionResult, closureResult] = await Promise.all([
      client.from('catalog_items').select('*').order('category').order('name'),
      client.from('patient_vouchers').select('*').order('purchase_date', { ascending: false }),
      client.from('billing_transactions').select('*').eq('transaction_date', selectedDate)
        .order('created_at', { ascending: false }),
      client.from('cash_closures').select('*').eq('closure_date', selectedDate).maybeSingle(),
    ]);
    const failedResult = [catalogResult, voucherResult, transactionResult, closureResult]
      .find((result) => result.error);
    if (failedResult?.error) {
      setError(failedResult.error.message);
      setLoading(false);
      return;
    }

    setCatalog((catalogResult.data ?? []).map(mapCatalogItem));
    setVouchers((voucherResult.data ?? []).map(mapPatientVoucher));
    setTransactions((transactionResult.data ?? []).map(mapBillingTransaction));
    setClosure(closureResult.data ? mapCashClosure(closureResult.data) : null);
    setLoading(false);
  }, [selectedDate]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const loadReportData = useCallback(async () => {
    if (!reportStartDate || !reportEndDate || reportStartDate > reportEndDate) {
      setError('La fecha de inicio del informe debe ser anterior o igual a la fecha de fin.');
      setReportTransactions([]);
      return;
    }

    setReportLoading(true);
    setError(null);
    const pageSize = 1000;
    const allRows: Record<string, unknown>[] = [];
    try {
      for (let offset = 0; ; offset += pageSize) {
        const { data, error: reportError } = await getSupabaseClient()
          .from('billing_transactions')
          .select('*')
          .gte('transaction_date', reportStartDate)
          .lte('transaction_date', reportEndDate)
          .order('transaction_date', { ascending: false })
          .order('created_at', { ascending: false })
          .range(offset, offset + pageSize - 1);
        if (reportError) throw reportError;
        const page = (data ?? []) as Record<string, unknown>[];
        allRows.push(...page);
        if (page.length < pageSize) break;
      }
      setReportTransactions(allRows.map(mapBillingTransaction));
    } catch (reportError) {
      console.error('No se pudieron cargar los movimientos fiscales:', reportError);
      setError(getErrorMessage(reportError));
      setReportTransactions([]);
    } finally {
      setReportLoading(false);
    }
  }, [reportEndDate, reportStartDate]);

  useEffect(() => {
    if (section === 'informes') void loadReportData();
  }, [section, loadReportData]);

  const activeCatalog = catalog.filter((item) => item.isActive);
  const activeVouchers = vouchers.filter((voucher) => voucher.status === 'activo' && voucher.remainingSessions > 0);
  const filteredVouchers = vouchers.filter((voucher) => {
    const matchesStatus = voucherFilter === 'all'
      || (voucherFilter === 'active' && voucher.remainingSessions > 0 && voucher.status !== 'agotado')
      || (voucherFilter === 'exhausted' && (voucher.remainingSessions === 0 || voucher.status === 'agotado'));
    const query = normalizeText(voucherSearch);
    const matchesSearch = !query
      || normalizeText(voucher.patientName).includes(query)
      || normalizeText(voucher.voucherName).includes(query);
    return matchesStatus && matchesSearch;
  });
  const totals = useMemo(() => calculateDailyTotals(transactions), [transactions]);
  const reportTotals = useMemo(
    () => calculateFiscalTotals(reportTransactions.filter((transaction) => transaction.category !== 'canje_bono')),
    [reportTransactions],
  );
  const reportRows = useMemo(
    () => reportTransactions.filter((transaction) => transaction.category !== 'canje_bono'),
    [reportTransactions],
  );
  const selectedSaleItem = activeCatalog.find((item) => item.id === saleDraft.itemId);

  const selectReportPeriod = (period: Exclude<ReportPeriod, 'custom'>) => {
    const range = getPeriodRange(period, new Date());
    setReportPeriod(period);
    setReportStartDate(range.start);
    setReportEndDate(range.end);
  };

  const updateReportStartDate = (value: string) => {
    setReportPeriod('custom');
    setReportStartDate(value);
  };

  const updateReportEndDate = (value: string) => {
    setReportPeriod('custom');
    setReportEndDate(value);
  };

  const exportFiscalReport = () => {
    if (reportRows.length === 0) {
      setError('No hay movimientos facturados para exportar en el periodo seleccionado.');
      return;
    }
    const csvRows = [
      ['INFORME FISCAL', reportStartDate, reportEndDate],
      ['Total exento', formatCsvAmount(reportTotals.exempt)],
      ['Base imponible sujeta a IVA', formatCsvAmount(reportTotals.taxableBase)],
      ['Cuota IVA repercutido', formatCsvAmount(reportTotals.vat)],
      ['Total facturado', formatCsvAmount(reportTotals.total)],
      [],
      ['Fecha', 'Paciente', 'Concepto', 'Categoría', 'Método de pago', 'Base (€)', 'IVA (%)', 'Cuota IVA (€)', 'Total (€)'],
      ...reportRows.map((transaction) => [
        transaction.transactionDate,
        transaction.patientName,
        transaction.concept,
        getCategoryLabel(transaction.category),
        transaction.paymentMethod,
        formatCsvAmount(transaction.baseAmount),
        formatCsvAmount(transaction.vatRate),
        formatCsvAmount(transaction.vatAmount),
        formatCsvAmount(transaction.totalAmount),
      ]),
    ];
    const csvContent = `\uFEFF${csvRows.map((row) => row.map(escapeCsvValue).join(';')).join('\r\n')}`;
    const file = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(file);
    const link = document.createElement('a');
    link.href = url;
    link.download = `informe_fiscal_${reportStartDate}_${reportEndDate}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const openNewSale = () => {
    setSaleDraft({
      patientId: '',
      itemId: activeCatalog[0]?.id ?? '',
      paymentMethod: 'efectivo',
      notes: '',
    });
    setNotice(null);
    setError(null);
    setSaleOpen(true);
  };

  const submitSale = async () => {
    const item = activeCatalog.find((catalogItem) => catalogItem.id === saleDraft.itemId);
    const patient = patients.find((listedPatient) => listedPatient.id === saleDraft.patientId);
    if (!item) {
      setError('Selecciona una tarifa activa para registrar el cobro.');
      return;
    }
    if (item.category === 'bono' && !patient) {
      setError('Selecciona al paciente para asociar el bono.');
      return;
    }

    const baseAmount = roundMoney(item.price / (1 + item.vatRate / 100));
    const vatAmount = roundMoney(item.price - baseAmount);
    setSaving(true);
    setError(null);
    try {
      if (item.category === 'bono') {
        if (!patient) throw new Error('Selecciona el paciente al que se asignará el bono.');
        const { data: purchaseResult, error: rpcError } = await getSupabaseClient().rpc('purchase_patient_voucher', {
          p_patient_id: patient.id,
          p_item_id: item.id,
          p_patient_name: patient.name,
          p_voucher_name: item.name,
          p_total_sessions: item.totalSessions,
          p_price: item.price,
          p_vat_rate: item.vatRate,
          p_payment_method: saleDraft.paymentMethod,
          p_physiotherapist_name: physiotherapist || null,
          p_transaction_date: selectedDate,
          p_notes: saleDraft.notes.trim() || null,
        });
        if (rpcError) throw rpcError;
        if (!extractRpcIdentifier(purchaseResult)) {
          throw new Error('Supabase no devolvió el identificador del bono o del cobro.');
        }
      } else {
        const { error: insertError } = await getSupabaseClient()
          .from('billing_transactions')
          .insert({
            transaction_date: selectedDate,
            patient_id: patient?.id ?? null,
            patient_name: patient?.name ?? 'Paciente no registrado',
            item_id: item.id,
            concept: item.name,
            category: item.category,
            base_amount: baseAmount,
            vat_rate: item.vatRate,
            vat_amount: vatAmount,
            total_amount: item.price,
            payment_method: saleDraft.paymentMethod,
            physiotherapist_name: physiotherapist || null,
            notes: saleDraft.notes.trim() || null,
          });
        if (insertError) throw insertError;
      }
      setSaleOpen(false);
      setNotice(item.category === 'bono' ? 'Bono vendido y cobro registrado.' : 'Cobro registrado correctamente.');
      await loadData();
    } catch (saveError) {
      console.error('No se pudo registrar el cobro:', saveError);
      setError(getErrorMessage(saveError));
    } finally {
      setSaving(false);
    }
  };

  const saveCatalogItem = async () => {
    const price = Number(catalogDraft.price);
    const vatRate = Number(catalogDraft.vatRate);
    const totalSessions = Number(catalogDraft.totalSessions);
    if (!catalogDraft.name.trim() || !Number.isFinite(price) || price < 0 ||
      !Number.isFinite(vatRate) || vatRate < 0 ||
      !Number.isInteger(totalSessions) || totalSessions < 1) {
      setError('Revisa el nombre, precio, IVA y número de sesiones.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload = {
        ...(catalogDraft.id ? { id: catalogDraft.id } : {}),
        name: catalogDraft.name.trim(),
        category: catalogDraft.category,
        price: roundMoney(price),
        vat_rate: vatRate,
        total_sessions: totalSessions,
        is_active: catalogDraft.isActive,
      };
      const { error: saveError } = await getSupabaseClient()
        .from('catalog_items')
        .upsert(payload)
        .select('id')
        .single();
      if (saveError) throw saveError;
      setCatalogOpen(false);
      setNotice('Tarifa guardada.');
      await loadData();
    } catch (saveError) {
      console.error('No se pudo guardar la tarifa:', saveError);
      setError(getErrorMessage(saveError));
    } finally {
      setSaving(false);
    }
  };

  const toggleCatalogItem = async (item: CatalogItem) => {
    setError(null);
    try {
      const { error: updateError } = await getSupabaseClient()
        .from('catalog_items')
        .update({ is_active: !item.isActive })
        .eq('id', item.id);
      if (updateError) throw updateError;
      await loadData();
    } catch (updateError) {
      console.error('No se pudo actualizar la tarifa:', updateError);
      setError(getErrorMessage(updateError));
    }
  };

  const redeemVoucher = async (voucher: PatientVoucher) => {
    const patientName = normalizeText(voucher.patientName);
    const matchingPatientIds = new Set(patients
      .filter((patient) => !voucher.patientId && normalizeText(patient.name) === patientName)
      .map((patient) => patient.id));
    const today = getLocalDate();
    const appointmentToday = appointments.find((appointment) =>
      ((Boolean(voucher.patientId) && appointment.patientId === voucher.patientId)
        || matchingPatientIds.has(appointment.patientId))
      && appointment.date === today
      && (appointment.status === 'scheduled' || appointment.status === 'in_progress'),
    );

    if (!appointmentToday && !window.confirm(
      `Atención: ${voucher.patientName} no tiene ninguna cita agendada para el día de hoy. ¿Estás seguro de que deseas descontarle una sesión de su bono?`,
    )) {
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const { data: redemptionResult, error: rpcError } = appointmentToday
        ? await getSupabaseClient().rpc('redeem_patient_voucher_for_appointment', {
          p_voucher_id: voucher.id,
          p_appointment_id: appointmentToday.id,
          p_patient_id: appointmentToday.patientId,
          p_physiotherapist_name: physiotherapist || null,
          p_transaction_date: today,
          p_notes: voucherNotes[voucher.id]?.trim() || null,
        })
        : await getSupabaseClient().rpc('redeem_patient_voucher', {
          p_voucher_id: voucher.id,
          p_physiotherapist_name: physiotherapist || null,
          p_transaction_date: today,
          p_notes: voucherNotes[voucher.id]?.trim() || null,
        });
      if (rpcError) throw rpcError;
      if (!extractRpcIdentifier(redemptionResult)) {
        throw new Error('Supabase no devolvió el identificador del canje.');
      }
      setVoucherNotes((previous) => ({ ...previous, [voucher.id]: '' }));
      let appointmentUpdateFailed = false;
      if (appointmentToday) {
        try {
          await onSaveAppointment({ ...appointmentToday, status: 'completed' });
        } catch (appointmentError) {
          appointmentUpdateFailed = true;
          console.error('El bono se canjeó, pero no se pudo actualizar el estado de la cita:', appointmentError);
        }
      }
      setNotice(appointmentUpdateFailed
        ? `Canje registrado y quedan ${voucher.remainingSessions - 1} sesión(es), pero no se pudo marcar la cita como completada.`
        : appointmentToday
          ? `Sesión canjeada y cita marcada como completada. Quedan ${voucher.remainingSessions - 1} sesión(es).`
          : `Sesión canjeada. Quedan ${voucher.remainingSessions - 1} sesión(es).`);
      await loadData();
    } catch (redeemError) {
      console.error('No se pudo canjear la sesión del bono:', redeemError);
      setError(getErrorMessage(redeemError));
    } finally {
      setSaving(false);
    }
  };

  const revertTransaction = async (transaction: BillingTransaction) => {
    const isVoucherRedemption = transaction.category === 'canje_bono';
    const isVoucherSale = transaction.category === 'bono';
    const confirmation = isVoucherRedemption
      ? '¿Deseas anular este canje? La sesión se devolverá al bono del paciente y la cita volverá a figurar como pendiente de cobro.'
      : isVoucherSale
        ? `¿Deseas anular la venta de este bono de ${formatCurrency(transaction.totalAmount)}? Se eliminará el registro de caja y el bono del paciente quedará cancelado.`
        : `¿Deseas anular este cobro de ${formatCurrency(transaction.totalAmount)} de ${transaction.patientName}? El dinero se restará de la caja diaria y la cita volverá a figurar como no cobrada.`;
    if (!window.confirm(confirmation)) return;

    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const { data, error: revertError } = await getSupabaseClient()
        .rpc('revert_billing_transaction', { p_transaction_id: transaction.id });
      if (revertError) throw revertError;
      const returnedId = extractRpcIdentifier(data) ?? transaction.id;
      const revertedTransaction = transactions.find((item) => item.id === returnedId) ?? transaction;

      let appointmentUpdateFailed = false;
      const linkedAppointment = revertedTransaction.appointmentId
        ? appointments.find((appointment) => appointment.id === revertedTransaction.appointmentId)
        : undefined;
      if (linkedAppointment) {
        try {
          await onSaveAppointment({ ...linkedAppointment, status: 'scheduled' });
        } catch (appointmentError) {
          appointmentUpdateFailed = true;
          console.error('El movimiento se anuló, pero no se pudo actualizar la cita:', appointmentError);
        }
      }

      setNotice('Cobro cancelado correctamente.');
      if (appointmentUpdateFailed) {
        setError('El movimiento se canceló, pero no se pudo devolver la cita a pendiente de cobro. Actualiza la cita desde Agenda.');
      }
      await loadData();
    } catch (revertError) {
      console.error('No se pudo anular el movimiento de caja:', revertError);
      setError(getErrorMessage(revertError));
    } finally {
      setSaving(false);
    }
  };

  const closeCash = async () => {
    if (transactions.length === 0) {
      setError('No hay cobros registrados para cerrar la caja de esta fecha.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const { error: upsertError } = await getSupabaseClient()
        .from('cash_closures')
        .upsert({
          closure_date: selectedDate,
          total_efectivo: totals.efectivo,
          total_tarjeta: totals.tarjeta,
          total_bizum: totals.bizum,
          total_transferencia: totals.transferencia,
          total_servicios_exentos: totals.serviciosExentos,
          total_productos_base: totals.productosBase,
          total_iva_repercutido: totals.iva,
          total_facturado: totals.facturado,
          closed_by: physiotherapist || null,
          notes: closure?.notes ?? null,
        }, { onConflict: 'closure_date' });
      if (upsertError) throw upsertError;
      setNotice(`Caja del ${formatDate(selectedDate)} cerrada correctamente.`);
      await loadData();
    } catch (closeError) {
      console.error('No se pudo cerrar la caja:', closeError);
      setError(getErrorMessage(closeError));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-[1400px] space-y-6 px-4 py-6 lg:px-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-slate-900">
            <Wallet className="h-6 w-6 text-primary-600" /> Caja, Tarifas y Bonos
          </h1>
          <p className="mt-1 text-sm text-slate-500">Cobros, bonos de pacientes y cierres diarios.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">
            <CalendarDays className="h-4 w-4" />
            <input
              type="date"
              value={selectedDate}
              onChange={(event) => setSelectedDate(event.target.value)}
              className="bg-transparent outline-none"
            />
          </label>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              void loadData();
              if (section === 'informes') void loadReportData();
            }}
            disabled={loading || reportLoading}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Actualizar
          </Button>
          <Button size="sm" onClick={openNewSale} disabled={loading || activeCatalog.length === 0}>
            <Plus className="h-4 w-4" /> Nuevo cobro
          </Button>
        </div>
      </header>

      {error && <div role="alert" className="rounded-xl border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-700">{error}</div>}
      {notice && <div role="status" className="rounded-xl border border-success-200 bg-success-50 px-4 py-3 text-sm text-success-700">{notice}</div>}

      <nav className="flex flex-wrap gap-2 border-b border-slate-200 pb-3" aria-label="Secciones de caja">
        <SectionButton active={section === 'resumen'} onClick={() => setSection('resumen')} icon={<Receipt className="h-4 w-4" />}>Caja diaria</SectionButton>
        <SectionButton active={section === 'bonos'} onClick={() => setSection('bonos')} icon={<HandCoins className="h-4 w-4" />}>Bonos de pacientes</SectionButton>
        <SectionButton active={section === 'tarifas'} onClick={() => setSection('tarifas')} icon={<Tag className="h-4 w-4" />}>Tarifas y catálogo</SectionButton>
        <SectionButton active={section === 'informes'} onClick={() => setSection('informes')} icon={<FileSpreadsheet className="h-4 w-4" />}>Informes y Fiscalidad</SectionButton>
      </nav>

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
        </div>
      ) : (
        <>
          {section === 'resumen' && (
            <div className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <SummaryCard label="Total facturado" value={formatCurrency(totals.facturado)} icon={<Euro className="h-5 w-5" />} />
                <SummaryCard label="Efectivo" value={formatCurrency(totals.efectivo)} icon={<Banknote className="h-5 w-5" />} />
                <SummaryCard label="Tarjeta" value={formatCurrency(totals.tarjeta)} icon={<CreditCard className="h-5 w-5" />} />
                <SummaryCard label="Bizum + Transferencia" value={formatCurrency(totals.bizum + totals.transferencia)} icon={<Wallet className="h-5 w-5" />} />
              </div>

              <Card className="overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
                  <div>
                    <h2 className="font-semibold text-slate-800">Movimientos del día</h2>
                    <p className="text-xs text-slate-500">{formatDate(selectedDate)} · {transactions.length} movimiento(s)</p>
                  </div>
                  <Button size="sm" onClick={closeCash} disabled={saving || transactions.length === 0}>
                    <Check className="h-4 w-4" /> {closure ? 'Actualizar cierre' : 'Cerrar caja'}
                  </Button>
                </div>
                {transactions.length === 0 ? (
                  <p className="p-8 text-center text-sm text-slate-400">Todavía no hay movimientos para esta fecha.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[700px] text-left text-sm">
                      <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                        <tr>
                          <th className="px-5 py-3">Hora</th>
                          <th className="px-5 py-3">Paciente / concepto</th>
                          <th className="px-5 py-3">Categoría</th>
                          <th className="px-5 py-3">Pago</th>
                          <th className="px-5 py-3 text-right">Base</th>
                          <th className="px-5 py-3 text-right">IVA</th>
                          <th className="px-5 py-3 text-right">Total</th>
                          <th className="px-5 py-3 text-right">ACCIONES</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {transactions.map((transaction) => (
                          <tr key={transaction.id}>
                            <td className="whitespace-nowrap px-5 py-3 text-slate-500">{formatTime(transaction.createdAt)}</td>
                            <td className="px-5 py-3">
                              <p className="font-medium text-slate-800">{transaction.patientName}</p>
                              <p className="text-xs text-slate-500">{transaction.concept}</p>
                            </td>
                            <td className="px-5 py-3"><Badge variant={transaction.category === 'canje_bono' ? 'default' : 'primary'}>{getCategoryLabel(transaction.category)}</Badge></td>
                            <td className="px-5 py-3 capitalize text-slate-600">{transaction.paymentMethod}</td>
                            <td className="px-5 py-3 text-right tabular-nums">{formatCurrency(transaction.baseAmount)}</td>
                            <td className="px-5 py-3 text-right tabular-nums">{formatCurrency(transaction.vatAmount)}</td>
                            <td className="px-5 py-3 text-right font-semibold tabular-nums">{formatCurrency(transaction.totalAmount)}</td>
                            <td className="px-5 py-3 text-right">
                              <button
                                type="button"
                                title={transaction.category === 'canje_bono'
                                  ? 'Deshacer canje y devolver sesión al bono'
                                  : transaction.category === 'bono'
                                    ? 'Anular venta y cancelar bono del paciente'
                                    : 'Eliminar apunte de caja'}
                                aria-label={transaction.category === 'canje_bono'
                                  ? `Deshacer canje de ${transaction.patientName}`
                                  : `Anular ${transaction.category === 'bono' ? 'venta de bono' : 'cobro'} de ${transaction.patientName}`}
                                onClick={() => void revertTransaction(transaction)}
                                disabled={saving}
                                className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                <RotateCcw className="h-4 w-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>

              <div className="grid gap-4 lg:grid-cols-2">
                <Card className="p-5">
                  <h3 className="mb-3 font-semibold text-slate-800">Desglose fiscal</h3>
                  <dl className="space-y-2 text-sm">
                    <TotalRow label="Servicios exentos" value={totals.serviciosExentos} />
                    <TotalRow label="Base de productos" value={totals.productosBase} />
                    <TotalRow label="IVA repercutido" value={totals.iva} />
                    <div className="border-t border-slate-100 pt-2"><TotalRow label="Total facturado" value={totals.facturado} strong /></div>
                  </dl>
                </Card>
                <Card className="p-5">
                  <h3 className="mb-3 font-semibold text-slate-800">Estado del cierre</h3>
                  {closure ? (
                    <div className="space-y-2">
                      <Badge variant="success"><Check className="h-3.5 w-3.5" /> Caja cerrada</Badge>
                      <p className="text-sm text-slate-600">Cierre guardado por {closure.closedBy || 'profesional no especificado'} por un total de <strong>{formatCurrency(closure.totalFacturado)}</strong>.</p>
                      {closure.notes && <p className="text-sm text-slate-500">{closure.notes}</p>}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500">La caja de esta fecha todavía no se ha cerrado.</p>
                  )}
                  <p className="mt-3 text-xs text-slate-400">El cierre consolida los cobros registrados y puede actualizarse si se añaden movimientos del mismo día.</p>
                </Card>
              </div>
            </div>
          )}

          {section === 'informes' && (
            <section className="space-y-5">
              <Card className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h2 className="font-semibold text-slate-800">Informes fiscales y arqueos históricos</h2>
                    <p className="mt-1 text-sm text-slate-500">Resumen de ingresos facturados por periodo, excluyendo canjes de bonos.</p>
                  </div>
                  <Button onClick={exportFiscalReport} disabled={reportLoading || reportRows.length === 0}>
                    <FileSpreadsheet className="h-4 w-4" /> Descargar Excel para Gestoría (.csv)
                  </Button>
                </div>
                <div className="mt-4 flex flex-wrap gap-2" aria-label="Periodos rápidos">
                  <ReportPeriodButton active={reportPeriod === 'month'} onClick={() => selectReportPeriod('month')}>Este Mes</ReportPeriodButton>
                  <ReportPeriodButton active={reportPeriod === 'q1'} onClick={() => selectReportPeriod('q1')}>1º Trimestre (T1: Ene-Mar)</ReportPeriodButton>
                  <ReportPeriodButton active={reportPeriod === 'q2'} onClick={() => selectReportPeriod('q2')}>2º Trimestre (T2: Abr-Jun)</ReportPeriodButton>
                  <ReportPeriodButton active={reportPeriod === 'q3'} onClick={() => selectReportPeriod('q3')}>3º Trimestre (T3: Jul-Sep)</ReportPeriodButton>
                  <ReportPeriodButton active={reportPeriod === 'q4'} onClick={() => selectReportPeriod('q4')}>4º Trimestre (T4: Oct-Dic)</ReportPeriodButton>
                  <ReportPeriodButton active={reportPeriod === 'year'} onClick={() => selectReportPeriod('year')}>Año Completo</ReportPeriodButton>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <label className="block text-sm font-medium text-slate-700">
                    Fecha Inicio
                    <input
                      type="date"
                      value={reportStartDate}
                      max={reportEndDate || undefined}
                      onChange={(event) => updateReportStartDate(event.target.value)}
                      className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                    />
                  </label>
                  <label className="block text-sm font-medium text-slate-700">
                    Fecha Fin
                    <input
                      type="date"
                      value={reportEndDate}
                      min={reportStartDate || undefined}
                      onChange={(event) => updateReportEndDate(event.target.value)}
                      className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                    />
                  </label>
                </div>
                <p className="mt-3 text-xs text-slate-400">
                  Periodo: {reportStartDate ? formatDate(reportStartDate) : '—'} – {reportEndDate ? formatDate(reportEndDate) : '—'}
                </p>
              </Card>

              {reportLoading ? (
                <div className="flex h-36 items-center justify-center">
                  <Loader2 className="h-7 w-7 animate-spin text-primary-600" />
                </div>
              ) : (
                <>
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <SummaryCard
                      label="Ingresos sanitarios exentos (Art. 20)"
                      value={formatCurrency(reportTotals.exempt)}
                      icon={<Euro className="h-5 w-5" />}
                    />
                    <SummaryCard
                      label="Base sujeta a IVA"
                      value={formatCurrency(reportTotals.taxableBase)}
                      icon={<Receipt className="h-5 w-5" />}
                    />
                    <SummaryCard
                      label="IVA repercutido · Modelo 303"
                      value={formatCurrency(reportTotals.vat)}
                      icon={<FileSpreadsheet className="h-5 w-5" />}
                    />
                    <SummaryCard
                      label="Total facturado"
                      value={formatCurrency(reportTotals.total)}
                      icon={<Wallet className="h-5 w-5" />}
                    />
                  </div>

                  <Card className="p-5">
                    <h3 className="mb-3 font-semibold text-slate-800">Desglose por forma de pago</h3>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      <SummaryCard label="Efectivo" value={formatCurrency(reportTotals.efectivo)} icon={<Banknote className="h-5 w-5" />} />
                      <SummaryCard label="Tarjeta / TPV" value={formatCurrency(reportTotals.tarjeta)} icon={<CreditCard className="h-5 w-5" />} />
                      <SummaryCard label="Bizum" value={formatCurrency(reportTotals.bizum)} icon={<Wallet className="h-5 w-5" />} />
                      <SummaryCard label="Transferencia" value={formatCurrency(reportTotals.transferencia)} icon={<ClipboardList className="h-5 w-5" />} />
                    </div>
                  </Card>

                  <Card className="overflow-hidden">
                    <div className="border-b border-slate-100 px-5 py-4">
                      <h3 className="font-semibold text-slate-800">Movimientos del periodo</h3>
                      <p className="text-xs text-slate-500">{reportRows.length} movimiento(s) · los canjes de bono no se incluyen en el informe fiscal</p>
                    </div>
                    {reportRows.length === 0 ? (
                      <p className="p-8 text-center text-sm text-slate-400">No hay cobros facturables en el periodo seleccionado.</p>
                    ) : (
                      <div className="max-h-[600px] overflow-auto">
                        <table className="w-full min-w-[950px] text-left text-sm">
                          <thead className="sticky top-0 bg-slate-50 text-xs uppercase text-slate-500">
                            <tr>
                              <th className="px-4 py-3">Fecha</th>
                              <th className="px-4 py-3">Paciente</th>
                              <th className="px-4 py-3">Concepto</th>
                              <th className="px-4 py-3">Categoría</th>
                              <th className="px-4 py-3">Método de pago</th>
                              <th className="px-4 py-3 text-right">Base (€)</th>
                              <th className="px-4 py-3 text-right">IVA (%)</th>
                              <th className="px-4 py-3 text-right">Cuota IVA (€)</th>
                              <th className="px-4 py-3 text-right">Total (€)</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {reportRows.map((transaction) => (
                              <tr key={transaction.id}>
                                <td className="whitespace-nowrap px-4 py-3 text-slate-600">{formatDate(transaction.transactionDate)}</td>
                                <td className="px-4 py-3 text-slate-700">{transaction.patientName}</td>
                                <td className="px-4 py-3 text-slate-700">{transaction.concept}</td>
                                <td className="px-4 py-3 capitalize text-slate-600">{getCategoryLabel(transaction.category)}</td>
                                <td className="px-4 py-3 capitalize text-slate-600">{transaction.paymentMethod}</td>
                                <td className="px-4 py-3 text-right tabular-nums">{formatCurrency(transaction.baseAmount)}</td>
                                <td className="px-4 py-3 text-right tabular-nums">{formatPercent(transaction.vatRate)}</td>
                                <td className="px-4 py-3 text-right tabular-nums">{formatCurrency(transaction.vatAmount)}</td>
                                <td className="px-4 py-3 text-right font-semibold tabular-nums">{formatCurrency(transaction.totalAmount)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </Card>
                </>
              )}
            </section>
          )}

          {section === 'bonos' && (
            <Card className="overflow-hidden">
              <div className="flex flex-col gap-4 border-b border-slate-100 px-5 py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="font-semibold text-slate-800">Bonos de pacientes</h2>
                    <p className="text-xs text-slate-500">{activeVouchers.length} bono(s) con sesiones disponibles · {vouchers.length} total</p>
                  </div>
                  <label className="flex w-full items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm md:w-80">
                    <Search className="h-4 w-4 shrink-0 text-slate-400" />
                    <input
                      type="search"
                      value={voucherSearch}
                      onChange={(event) => setVoucherSearch(event.target.value)}
                      placeholder="Buscar por paciente o bono..."
                      aria-label="Buscar por paciente o bono"
                      className="w-full bg-transparent text-slate-700 outline-none placeholder:text-slate-400"
                    />
                    {voucherSearch && (
                      <button
                        type="button"
                        onClick={() => setVoucherSearch('')}
                        aria-label="Limpiar búsqueda"
                        className="rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </label>
                </div>
                <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar bonos por estado">
                  <VoucherFilterButton active={voucherFilter === 'active'} onClick={() => setVoucherFilter('active')}>
                    Activos / Con sesiones
                  </VoucherFilterButton>
                  <VoucherFilterButton active={voucherFilter === 'exhausted'} onClick={() => setVoucherFilter('exhausted')}>
                    Agotados / Historial
                  </VoucherFilterButton>
                  <VoucherFilterButton active={voucherFilter === 'all'} onClick={() => setVoucherFilter('all')}>
                    Todos
                  </VoucherFilterButton>
                </div>
              </div>
              {vouchers.length === 0 ? (
                <p className="p-8 text-center text-sm text-slate-400">Todavía no se han vendido bonos.</p>
              ) : filteredVouchers.length === 0 && voucherSearch.trim() ? (
                <div className="flex flex-col items-center gap-3 p-10 text-center">
                  <p className="text-sm text-slate-500">
                    No se encontraron bonos para &quot;{voucherSearch.trim()}&quot;
                  </p>
                  <Button size="sm" variant="outline" onClick={() => setVoucherSearch('')}>
                    Limpiar búsqueda
                  </Button>
                </div>
              ) : filteredVouchers.length === 0 ? (
                <p className="p-8 text-center text-sm text-slate-400">
                  No hay bonos que coincidan con el filtro seleccionado.
                </p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {filteredVouchers.map((voucher) => (
                    <div key={voucher.id} className="flex flex-col gap-3 p-5 lg:flex-row lg:items-center lg:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-semibold text-slate-800">{voucher.voucherName}</h3>
                          <Badge variant={voucher.status === 'activo' ? 'success' : 'default'}>{voucher.status}</Badge>
                        </div>
                        <p className="mt-1 text-sm text-slate-500">{voucher.patientName} · comprado el {formatDate(voucher.purchaseDate.slice(0, 10))}</p>
                        <p className="mt-1 text-sm font-medium text-slate-700">
                          {voucher.remainingSessions} de {voucher.totalSessions} sesiones disponibles
                          <span className="ml-2 text-xs font-normal text-slate-400">({voucher.usedSessions} usadas)</span>
                        </p>
                        <div className="mt-2 h-2 max-w-sm overflow-hidden rounded-full bg-slate-100">
                          <div
                            className={`h-full rounded-full ${voucher.remainingSessions > 0 ? 'bg-success-500' : 'bg-slate-400'}`}
                            style={{ width: `${Math.min(100, voucher.remainingSessions / voucher.totalSessions * 100)}%` }}
                          />
                        </div>
                      </div>
                      {voucher.remainingSessions > 0 && (
                        <div className="flex flex-wrap items-center gap-2">
                          <input
                            aria-label={`Nota de canje para ${voucher.patientName}`}
                            value={voucherNotes[voucher.id] ?? ''}
                            onChange={(event) => setVoucherNotes((previous) => ({ ...previous, [voucher.id]: event.target.value }))}
                            placeholder="Nota de canje (opcional)"
                            className="min-w-48 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary-400"
                          />
                          <Button size="sm" onClick={() => void redeemVoucher(voucher)} disabled={saving}>
                            <HandCoins className="h-4 w-4" /> Canjear sesión
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}

          {section === 'tarifas' && (
            <Card className="overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
                <div>
                  <h2 className="font-semibold text-slate-800">Catálogo de tarifas</h2>
                  <p className="text-xs text-slate-500">{activeCatalog.length} tarifa(s) activas</p>
                </div>
                <Button size="sm" onClick={() => {
                  setCatalogDraft(emptyCatalogDraft);
                  setCatalogOpen(true);
                  setError(null);
                }}>
                  <Plus className="h-4 w-4" /> Nueva tarifa
                </Button>
              </div>
              {catalog.length === 0 ? (
                <p className="p-8 text-center text-sm text-slate-400">No hay tarifas. Ejecuta la migración para cargar el catálogo inicial.</p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {catalog.map((item) => (
                    <div key={item.id} className={`flex flex-wrap items-center justify-between gap-4 p-4 ${item.isActive ? '' : 'bg-slate-50 opacity-70'}`}>
                      <div className="flex items-start gap-3">
                        <div className={`mt-0.5 rounded-lg p-2 ${item.category === 'producto' ? 'bg-amber-50 text-amber-700' : item.category === 'bono' ? 'bg-secondary-50 text-secondary-700' : 'bg-primary-50 text-primary-700'}`}>
                          {item.category === 'producto' ? <ShoppingBag className="h-4 w-4" /> : item.category === 'bono' ? <HandCoins className="h-4 w-4" /> : <ClipboardList className="h-4 w-4" />}
                        </div>
                        <div>
                          <h3 className="font-medium text-slate-800">{item.name}</h3>
                          <p className="text-xs capitalize text-slate-500">
                            {item.category}{item.category === 'bono' ? ` · ${item.totalSessions} sesiones` : ''} · IVA {item.vatRate}%
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-semibold tabular-nums text-slate-800">{formatCurrency(item.price)}</span>
                        <Button size="sm" variant="outline" onClick={() => {
                          setCatalogDraft({
                            id: item.id,
                            isActive: item.isActive,
                            name: item.name,
                            category: item.category,
                            price: String(item.price),
                            vatRate: String(item.vatRate),
                            totalSessions: String(item.totalSessions),
                          });
                          setCatalogOpen(true);
                          setError(null);
                        }}>Editar</Button>
                        <button
                          type="button"
                          onClick={() => void toggleCatalogItem(item)}
                          className={`rounded-lg px-3 py-2 text-xs font-medium ${item.isActive ? 'text-slate-500 hover:bg-slate-100' : 'text-success-700 hover:bg-success-50'}`}
                        >
                          {item.isActive ? 'Desactivar' : 'Activar'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}
        </>
      )}

      <Modal
        open={saleOpen}
        onClose={() => { if (!saving) setSaleOpen(false); }}
        title="Registrar cobro"
        subtitle="El importe y el IVA se calculan desde el catálogo."
        footer={
          <>
            <Button variant="ghost" onClick={() => setSaleOpen(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={() => void submitSale()} disabled={saving || !selectedSaleItem}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Confirmar cobro
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <label className="block text-sm font-medium text-slate-700">
            Concepto
            <select
              value={saleDraft.itemId}
              onChange={(event) => setSaleDraft((draft) => ({ ...draft, itemId: event.target.value }))}
              className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm"
            >
              {activeCatalog.map((item) => (
                <option key={item.id} value={item.id}>{item.name} · {formatCurrency(item.price)}</option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Paciente {selectedSaleItem?.category === 'bono' ? '*' : '(opcional)'}
            <select
              value={saleDraft.patientId}
              onChange={(event) => setSaleDraft((draft) => ({ ...draft, patientId: event.target.value }))}
              className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm"
            >
              <option value="">Paciente no registrado</option>
              {patients.map((patient) => <option key={patient.id} value={patient.id}>{patient.name}</option>)}
            </select>
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Método de pago
            <select
              value={saleDraft.paymentMethod}
              onChange={(event) => setSaleDraft((draft) => ({ ...draft, paymentMethod: event.target.value as SaleDraft['paymentMethod'] }))}
              className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm"
            >
              {PAYMENT_METHODS.map((method) => <option key={method} value={method}>{method[0].toUpperCase() + method.slice(1)}</option>)}
            </select>
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Notas (opcional)
            <textarea
              rows={2}
              value={saleDraft.notes}
              onChange={(event) => setSaleDraft((draft) => ({ ...draft, notes: event.target.value }))}
              className="mt-1.5 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm"
            />
          </label>
          {selectedSaleItem && (
            <div className="rounded-xl bg-slate-50 p-4">
              <TotalRow label="Base imponible" value={roundMoney(selectedSaleItem.price / (1 + selectedSaleItem.vatRate / 100))} />
              <TotalRow label={`IVA (${selectedSaleItem.vatRate}%)`} value={roundMoney(selectedSaleItem.price - selectedSaleItem.price / (1 + selectedSaleItem.vatRate / 100))} />
              <div className="mt-2 border-t border-slate-200 pt-2"><TotalRow label="Total" value={selectedSaleItem.price} strong /></div>
              {selectedSaleItem.category === 'bono' && (
                <p className="mt-2 text-xs text-secondary-700">Se crearán un bono de {selectedSaleItem.totalSessions} sesiones y su movimiento de cobro.</p>
              )}
            </div>
          )}
          {error && <p role="alert" className="text-sm text-error-600">{error}</p>}
        </div>
      </Modal>

      <Modal
        open={catalogOpen}
        onClose={() => { if (!saving) setCatalogOpen(false); }}
        title={catalogDraft.id ? 'Editar tarifa' : 'Nueva tarifa'}
        footer={
          <>
            <Button variant="ghost" onClick={() => setCatalogOpen(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={() => void saveCatalogItem()} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Guardar tarifa
            </Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-medium text-slate-700 sm:col-span-2">
            Nombre
            <input
              value={catalogDraft.name}
              onChange={(event) => setCatalogDraft((draft) => ({ ...draft, name: event.target.value }))}
              className="mt-1.5 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm"
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Categoría
            <select
              value={catalogDraft.category}
              onChange={(event) => setCatalogDraft((draft) => ({
                ...draft,
                category: event.target.value as CatalogItem['category'],
                vatRate: event.target.value === 'producto' ? '21' : '0',
                totalSessions: event.target.value === 'bono' ? draft.totalSessions : '1',
              }))}
              className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm"
            >
              <option value="servicio">Servicio</option>
              <option value="bono">Bono</option>
              <option value="producto">Producto</option>
            </select>
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Precio final (€)
            <input
              type="number"
              min="0"
              step="0.01"
              value={catalogDraft.price}
              onChange={(event) => setCatalogDraft((draft) => ({ ...draft, price: event.target.value }))}
              className="mt-1.5 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm"
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            IVA (%)
            <input
              type="number"
              min="0"
              step="0.01"
              value={catalogDraft.vatRate}
              onChange={(event) => setCatalogDraft((draft) => ({ ...draft, vatRate: event.target.value }))}
              className="mt-1.5 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm"
            />
          </label>
          {catalogDraft.category === 'bono' && (
            <label className="block text-sm font-medium text-slate-700">
              Sesiones incluidas
              <input
                type="number"
                min="1"
                step="1"
                value={catalogDraft.totalSessions}
                onChange={(event) => setCatalogDraft((draft) => ({ ...draft, totalSessions: event.target.value }))}
                className="mt-1.5 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm"
              />
            </label>
          )}
          {error && <p role="alert" className="text-sm text-error-600 sm:col-span-2">{error}</p>}
        </div>
      </Modal>
    </div>
  );
}

function SectionButton({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${
        active ? 'bg-primary-600 text-white' : 'text-slate-600 hover:bg-slate-100'
      }`}
    >
      {icon}{children}
    </button>
  );
}

function VoucherFilterButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
        active
          ? 'border-primary-200 bg-primary-50 text-primary-700'
          : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
      }`}
    >
      {children}
    </button>
  );
}

function ReportPeriodButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
        active
          ? 'border-primary-200 bg-primary-50 text-primary-700'
          : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
      }`}
    >
      {children}
    </button>
  );
}

function SummaryCard({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-primary-50 p-2.5 text-primary-600">{icon}</div>
        <div>
          <p className="text-xs text-slate-500">{label}</p>
          <p className="mt-0.5 text-xl font-bold tabular-nums text-slate-800">{value}</p>
        </div>
      </div>
    </Card>
  );
}

function TotalRow({ label, value, strong = false }: { label: string; value: number; strong?: boolean }) {
  return (
    <div className={`flex items-center justify-between gap-3 text-sm ${strong ? 'font-semibold text-slate-800' : 'text-slate-600'}`}>
      <span>{label}</span><span className="tabular-nums">{formatCurrency(value)}</span>
    </div>
  );
}

function mapCatalogItem(row: Record<string, unknown>): CatalogItem {
  return {
    id: String(row.id),
    name: String(row.name ?? ''),
    category: row.category as CatalogItem['category'],
    price: Number(row.price ?? 0),
    vatRate: Number(row.vat_rate ?? 0),
    totalSessions: Number(row.total_sessions ?? 1),
    isActive: Boolean(row.is_active),
  };
}

function mapPatientVoucher(row: Record<string, unknown>): PatientVoucher {
  return {
    id: String(row.id),
    patientId: typeof row.patient_id === 'string' ? row.patient_id : null,
    patientName: String(row.patient_name ?? ''),
    voucherName: String(row.voucher_name ?? ''),
    totalSessions: Number(row.total_sessions ?? 0),
    usedSessions: Number(row.used_sessions ?? 0),
    remainingSessions: Number(row.remaining_sessions ?? 0),
    status: row.status === 'agotado' ? 'agotado' : 'activo',
    purchaseDate: String(row.purchase_date ?? ''),
  };
}

function mapBillingTransaction(row: Record<string, unknown>): BillingTransaction {
  return {
    id: String(row.id),
    transactionDate: String(row.transaction_date ?? ''),
    patientId: typeof row.patient_id === 'string' ? row.patient_id : null,
    patientName: String(row.patient_name ?? ''),
    itemId: typeof row.item_id === 'string' ? row.item_id : null,
    appointmentId: typeof row.appointment_id === 'string' ? row.appointment_id : null,
    concept: String(row.concept ?? ''),
    category: row.category as BillingCategory,
    baseAmount: Number(row.base_amount ?? 0),
    vatRate: Number(row.vat_rate ?? 0),
    vatAmount: Number(row.vat_amount ?? 0),
    totalAmount: Number(row.total_amount ?? 0),
    paymentMethod: row.payment_method as PaymentMethod,
    physiotherapistName: typeof row.physiotherapist_name === 'string' ? row.physiotherapist_name : null,
    voucherId: typeof row.voucher_id === 'string' ? row.voucher_id : null,
    notes: typeof row.notes === 'string' ? row.notes : null,
    createdAt: String(row.created_at ?? ''),
  };
}

function mapCashClosure(row: Record<string, unknown>): CashClosure {
  return {
    id: String(row.id),
    closureDate: String(row.closure_date ?? ''),
    totalEfectivo: Number(row.total_efectivo ?? 0),
    totalTarjeta: Number(row.total_tarjeta ?? 0),
    totalBizum: Number(row.total_bizum ?? 0),
    totalTransferencia: Number(row.total_transferencia ?? 0),
    totalServiciosExentos: Number(row.total_servicios_exentos ?? 0),
    totalProductosBase: Number(row.total_productos_base ?? 0),
    totalIvaRepercutido: Number(row.total_iva_repercutido ?? 0),
    totalFacturado: Number(row.total_facturado ?? 0),
    closedBy: typeof row.closed_by === 'string' ? row.closed_by : null,
    notes: typeof row.notes === 'string' ? row.notes : null,
  };
}

function calculateDailyTotals(transactions: BillingTransaction[]) {
  const totals = {
    efectivo: 0,
    tarjeta: 0,
    bizum: 0,
    transferencia: 0,
    serviciosExentos: 0,
    productosBase: 0,
    iva: 0,
    facturado: 0,
  };
  transactions.forEach((transaction) => {
    if (transaction.paymentMethod in totals) {
      const method = transaction.paymentMethod as keyof Pick<typeof totals, 'efectivo' | 'tarjeta' | 'bizum' | 'transferencia'>;
      totals[method] += transaction.totalAmount;
    }
    if (transaction.category === 'servicio' && transaction.vatRate === 0) {
      totals.serviciosExentos += transaction.baseAmount;
    }
    if (transaction.category === 'producto') totals.productosBase += transaction.baseAmount;
    totals.iva += transaction.vatAmount;
    totals.facturado += transaction.totalAmount;
  });
  return Object.fromEntries(Object.entries(totals).map(([key, value]) => [key, roundMoney(value)])) as typeof totals;
}

function calculateFiscalTotals(transactions: BillingTransaction[]) {
  const totals = {
    exempt: 0,
    taxableBase: 0,
    vat: 0,
    total: 0,
    efectivo: 0,
    tarjeta: 0,
    bizum: 0,
    transferencia: 0,
  };
  transactions.forEach((transaction) => {
    if (
      (transaction.category === 'servicio' || transaction.category === 'bono') &&
      Number(transaction.vatRate) === 0
    ) {
      totals.exempt += Number(transaction.totalAmount);
    }
    if (transaction.vatRate > 0) totals.taxableBase += transaction.baseAmount;
    totals.vat += transaction.vatAmount;
    totals.total += transaction.totalAmount;
    if (transaction.paymentMethod === 'efectivo') totals.efectivo += transaction.totalAmount;
    if (transaction.paymentMethod === 'tarjeta') totals.tarjeta += transaction.totalAmount;
    if (transaction.paymentMethod === 'bizum') totals.bizum += transaction.totalAmount;
    if (transaction.paymentMethod === 'transferencia') totals.transferencia += transaction.totalAmount;
  });
  return Object.fromEntries(Object.entries(totals).map(([key, value]) => [key, roundMoney(value)])) as typeof totals;
}

function getPeriodRange(period: Exclude<ReportPeriod, 'custom'>, referenceDate: Date): { start: string; end: string } {
  const year = referenceDate.getFullYear();
  const month = referenceDate.getMonth();
  if (period === 'month') {
    return {
      start: toLocalDateString(new Date(year, month, 1)),
      end: toLocalDateString(new Date(year, month + 1, 0)),
    };
  }
  if (period === 'year') {
    return {
      start: toLocalDateString(new Date(year, 0, 1)),
      end: toLocalDateString(new Date(year, 11, 31)),
    };
  }
  const quarter = Number(period.slice(1)) - 1;
  const firstMonth = quarter * 3;
  return {
    start: toLocalDateString(new Date(year, firstMonth, 1)),
    end: toLocalDateString(new Date(year, firstMonth + 3, 0)),
  };
}

function toLocalDateString(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function formatCsvAmount(value: number): string {
  return value.toFixed(2).replace('.', ',');
}

function escapeCsvValue(value: string | number): string {
  const text = String(value);
  const safeText = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safeText.replace(/"/g, '""')}"`;
}

function formatPercent(value: number): string {
  return `${new Intl.NumberFormat('es-ES', { maximumFractionDigits: 2 }).format(value)}%`;
}

function getLocalDate(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(value);
}

function formatDate(value: string): string {
  return new Date(`${value.slice(0, 10)}T00:00:00`).toLocaleDateString('es-ES', {
    day: 'numeric', month: 'long', year: 'numeric',
  });
}

function formatTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
}

function getCategoryLabel(category: BillingCategory): string {
  return category === 'canje_bono' ? 'Canje de bono' : category;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error !== null && 'message' in error) return String(error.message);
  return 'Se produjo un error inesperado.';
}
