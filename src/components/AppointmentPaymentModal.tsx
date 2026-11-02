import { useEffect, useState } from 'react';
import { Banknote, Check, CreditCard, HandCoins, Loader2, Wallet } from 'lucide-react';
import type { Appointment, CatalogItem, Patient, PatientVoucher, PaymentMethod } from '../types';
import { getSupabaseClient } from '../supabaseClient';
import { extractRpcIdentifier } from '../billingUtils';
import { Button } from './ui/Button';
import { Modal } from './ui/Modal';

type PaymentMode = 'voucher' | 'payment';
type DirectPaymentMethod = Exclude<PaymentMethod, 'bono'>;

const paymentMethods: DirectPaymentMethod[] = ['efectivo', 'tarjeta', 'bizum', 'transferencia'];
const paymentIcons: Record<DirectPaymentMethod, typeof Banknote> = {
  efectivo: Banknote,
  tarjeta: CreditCard,
  bizum: Wallet,
  transferencia: Banknote,
};

interface AppointmentPaymentModalProps {
  open: boolean;
  appointment: Appointment;
  patient: Patient | undefined;
  physiotherapist: string;
  onClose: () => void;
  onPaymentComplete: (transactionId: string) => Promise<void>;
}

export function AppointmentPaymentModal({
  open,
  appointment,
  patient,
  physiotherapist,
  onClose,
  onPaymentComplete,
}: AppointmentPaymentModalProps) {
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [vouchers, setVouchers] = useState<PatientVoucher[]>([]);
  const [selectedItemId, setSelectedItemId] = useState('');
  const [selectedVoucherId, setSelectedVoucherId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<DirectPaymentMethod>('efectivo');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let active = true;
    setLoading(true);
    setError(null);
    setCatalog([]);
    setVouchers([]);
    setSelectedItemId('');
    setSelectedVoucherId('');
    setNotes('');
    setPaymentMethod('efectivo');

    if (!patient) {
      setError('No se encontró el paciente de esta cita.');
      setLoading(false);
      return;
    }

    const loadPaymentOptions = async () => {
      const client = getSupabaseClient();
      const [catalogResult, voucherResult] = await Promise.all([
        client.from('catalog_items').select('*')
          .eq('is_active', true).eq('category', 'servicio').order('name'),
        client.from('patient_vouchers').select('*')
          .eq('patient_id', patient.id).eq('status', 'activo')
          .gt('remaining_sessions', 0).order('purchase_date', { ascending: false }),
      ]);
      if (!active) return;
      if (catalogResult.error || voucherResult.error) {
        const loadError = catalogResult.error ?? voucherResult.error;
        console.error('No se pudieron cargar las opciones de cobro de la cita:', loadError);
        setError(loadError?.message ?? 'No se pudieron cargar las opciones de cobro.');
        setLoading(false);
        return;
      }

      const loadedCatalog = (catalogResult.data ?? []).map(mapCatalogItem);
      const loadedVouchers = (voucherResult.data ?? []).map(mapPatientVoucher);
      setCatalog(loadedCatalog);
      setVouchers(loadedVouchers);
      setSelectedItemId(loadedCatalog[0]?.id ?? '');
      setSelectedVoucherId(loadedVouchers[0]?.id ?? '');
      setLoading(false);
    };

    void loadPaymentOptions();
    return () => { active = false; };
  }, [open, patient]);

  const selectedItem = catalog.find((item) => item.id === selectedItemId);
  const selectedVoucher = vouchers.find((voucher) => voucher.id === selectedVoucherId);

  const confirmPayment = async (paymentMode: PaymentMode) => {
    if (!patient) {
      setError('No se encontró el paciente de esta cita.');
      return;
    }
    if (paymentMode === 'voucher' && !selectedVoucher) {
      setError('El paciente no tiene bonos disponibles para canjear.');
      return;
    }
    if (paymentMode === 'payment' && !selectedItem) {
      setError('No hay tarifas de servicio activas. Configura una en Caja y Tarifas.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const { data, error: paymentError } = await getSupabaseClient()
        .rpc('register_appointment_payment', {
          p_appointment_id: appointment.id,
          p_patient_id: patient.id,
          p_patient_name: patient.name,
          p_payment_method: paymentMethod,
          p_physiotherapist_name: physiotherapist || null,
          p_transaction_date: getLocalDate(),
          p_item_id: paymentMode === 'payment' ? selectedItem?.id : null,
          p_voucher_id: paymentMode === 'voucher' ? selectedVoucher?.id : null,
          p_notes: notes.trim() || null,
        });
      if (paymentError) throw paymentError;
      const transactionId = extractRpcIdentifier(data);
      if (!transactionId) {
        throw new Error('Supabase no devolvió el identificador del cobro.');
      }
      await onPaymentComplete(transactionId);
      onClose();
    } catch (paymentError) {
      console.error('No se pudo completar el cobro de la cita:', paymentError);
      setError(getErrorMessage(paymentError));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={() => { if (!saving) onClose(); }}
      title="Cobrar sesión"
      subtitle={`${patient?.name ?? 'Paciente'} · ${formatDate(getLocalDate())} · ${physiotherapist || 'Fisioterapeuta'}`}
      footer={(
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button onClick={() => void confirmPayment('payment')} disabled={saving || loading || !selectedItem}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Confirmar cobro y completar cita
          </Button>
        </>
      )}
    >
      {loading ? (
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="h-7 w-7 animate-spin text-primary-600" />
        </div>
      ) : (
        <div className="space-y-4">
          {vouchers.length > 0 && (
            <div className="flex flex-wrap items-center gap-3 rounded-xl border border-success-300 bg-success-50 p-4 ring-2 ring-success-100">
              <Button
                variant="success"
                onClick={() => void confirmPayment('voucher')}
                disabled={saving || loading || !selectedVoucher}
                className="min-h-11 flex-1 justify-start whitespace-normal text-left"
              >
                {saving ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" /> : <HandCoins className="h-5 w-5 shrink-0" />}
                <span>
                  Canjear 1 sesión de Bono (Quedan {selectedVoucher?.remainingSessions ?? vouchers[0].remainingSessions})
                  <span className="block text-xs font-normal opacity-90">{selectedVoucher?.voucherName ?? vouchers[0].voucherName} · completar cita</span>
                </span>
              </Button>
              {vouchers.length > 1 && (
                <select
                  aria-label="Seleccionar bono"
                  value={selectedVoucherId}
                  onChange={(event) => setSelectedVoucherId(event.target.value)}
                  className="max-w-48 rounded-lg border border-success-200 bg-white px-2 py-2 text-xs"
                >
                  {vouchers.map((voucher) => (
                    <option key={voucher.id} value={voucher.id}>{voucher.voucherName} ({voucher.remainingSessions})</option>
                  ))}
                </select>
              )}
            </div>
          )}

          <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                <span className="rounded-lg bg-primary-100 p-2 text-primary-700"><Wallet className="h-4 w-4" /></span>
                Registrar cobro directo
              </div>
              <label className="block text-sm font-medium text-slate-700">
                Tarifa
                <select
                  value={selectedItemId}
                  onChange={(event) => setSelectedItemId(event.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm"
                  disabled={catalog.length === 0}
                >
                  {catalog.length === 0 && <option value="">No hay servicios activos</option>}
                  {catalog.map((item) => (
                    <option key={item.id} value={item.id}>{item.name} · {formatCurrency(item.price)}</option>
                  ))}
                </select>
              </label>
              <fieldset>
                <legend className="mb-2 text-sm font-medium text-slate-700">Método de pago</legend>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {paymentMethods.map((method) => {
                    const Icon = paymentIcons[method];
                    return (
                      <button
                        key={method}
                        type="button"
                        onClick={() => setPaymentMethod(method)}
                        className={`flex items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-xs font-medium capitalize ${
                          paymentMethod === method
                            ? 'border-primary-300 bg-white text-primary-700'
                            : 'border-slate-200 bg-white text-slate-500'
                        }`}
                      >
                        <Icon className="h-3.5 w-3.5" />{method}
                      </button>
                    );
                  })}
                </div>
              </fieldset>
              {selectedItem && (
                <div className="flex items-center justify-between border-t border-slate-200 pt-3">
                  <span className="text-sm text-slate-600">Importe total · IVA {selectedItem.vatRate}%</span>
                  <span className="text-lg font-bold tabular-nums text-slate-900">{formatCurrency(selectedItem.price)}</span>
                </div>
              )}
              </div>

          <label className="block text-sm font-medium text-slate-700">
            Nota del cobro (opcional)
            <input
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm"
              placeholder="Añadir una nota"
            />
          </label>
          {error && <p role="alert" className="rounded-lg border border-error-200 bg-error-50 p-3 text-sm text-error-700">{error}</p>}
        </div>
      )}
    </Modal>
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

function getLocalDate(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(value);
}

function formatDate(value: string): string {
  return new Date(`${value}T00:00:00`).toLocaleDateString('es-ES', {
    day: 'numeric', month: 'long', year: 'numeric',
  });
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error !== null && 'message' in error) return String(error.message);
  return 'Se produjo un error inesperado.';
}
