import { useState } from 'react';
import { Check, RotateCcw } from 'lucide-react';
import type { Episode } from '../types';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { Modal } from './ui/Modal';

export function EpisodeStatusControl({
  episode,
  onUpdate,
}: {
  episode: Episode;
  onUpdate: (patientId: string, updatedEpisode: Episode) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<Episode['dischargeReason']>('alta_clinica');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleResolve = async () => {
    setSaving(true);
    setError(null);
    try {
      await onUpdate(episode.patientId, {
        ...episode,
        status: 'resolved',
        closedAt: new Date().toISOString(),
        dischargeReason: reason,
        dischargeNotes: notes.trim(),
      });
      setOpen(false);
      setNotes('');
    } catch (saveError) {
      console.error('No se pudo actualizar el episodio:', saveError);
      setError(getErrorMessage(saveError, 'No se pudo actualizar el episodio.'));
    } finally {
      setSaving(false);
    }
  };

  const handleReopen = async () => {
    setError(null);
    try {
      await onUpdate(episode.patientId, {
        ...episode,
        status: 'active',
        closedAt: undefined,
        dischargeReason: undefined,
        dischargeNotes: undefined,
      });
    } catch (saveError) {
      console.error('No se pudo reabrir el episodio:', saveError);
      setError(getErrorMessage(saveError, 'No se pudo reabrir el episodio.'));
    }
  };

  return (
    <>
      {episode.status === 'active' ? (
        <button
          type="button"
          onClick={() => { setError(null); setOpen(true); }}
          className="rounded-lg px-2 py-1 text-xs font-medium text-success-700 transition-colors hover:bg-success-50"
        >
          <Check className="mr-1 inline h-3.5 w-3.5" /> Dar de alta / Resolver
        </button>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="default">Resuelto</Badge>
          <button
            type="button"
            onClick={handleReopen}
            className="rounded-lg px-2 py-1 text-xs font-medium text-primary-700 transition-colors hover:bg-primary-50"
          >
            <RotateCcw className="mr-1 inline h-3.5 w-3.5" /> Reabrir episodio
          </button>
          {error && <span role="alert" className="text-xs text-error-600">{error}</span>}
        </div>
      )}
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Resolver episodio"
        subtitle={episode.title}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleResolve} disabled={saving}>
              <Check className="h-4 w-4" /> {saving ? 'Guardando…' : 'Confirmar alta'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <label className="block text-sm font-medium text-slate-700">
            Motivo del cierre
            <select
              value={reason}
              onChange={(event) => setReason(event.target.value as Episode['dischargeReason'])}
              className="mt-1.5 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
            >
              <option value="alta_clinica">Alta clínica (Objetivos cumplidos)</option>
              <option value="derivacion">Derivación médica</option>
              <option value="abandono">Abandono de tratamiento</option>
            </select>
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Nota breve (opcional)
            <textarea
              rows={3}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              className="mt-1.5 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
            />
          </label>
          {error && <p role="alert" className="text-sm text-error-600">{error}</p>}
        </div>
      </Modal>
    </>
  );
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error !== null && 'message' in error) {
    return String(error.message);
  }
  return fallback;
}
