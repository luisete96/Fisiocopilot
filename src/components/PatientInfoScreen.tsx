import { useEffect, useRef, useState } from 'react';
import { Contact, Save } from 'lucide-react';
import type { Patient } from '../types';
import { calculateAge } from '../patientUtils';
import { Card, CardHeader } from './ui/Card';
import { Button } from './ui/Button';

type PatientDraft = {
  name: string;
  birthDate: string;
  dni: string;
  phone: string;
  email: string;
  occupation: string;
  medicalNotes: string;
  generalNotes: string;
};

function toDraft(patient: Patient): PatientDraft {
  return {
    name: patient.name ?? '',
    birthDate: patient.birthDate ?? '',
    dni: patient.dni ?? '',
    phone: patient.phone ?? '',
    email: patient.email ?? '',
    occupation: patient.occupation ?? '',
    medicalNotes: patient.medicalNotes ?? '',
    generalNotes: patient.generalNotes ?? patient.notes ?? '',
  };
}

export function PatientInfoScreen({
  patient,
  onUpdatePatient,
}: {
  patient: Patient | null;
  onUpdatePatient: (patient: Patient) => Promise<void>;
}) {
  const [draft, setDraft] = useState<PatientDraft | null>(patient ? toDraft(patient) : null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const loadedPatientId = useRef(patient?.id);
  const age = calculateAge(draft?.birthDate);

  useEffect(() => {
    if (loadedPatientId.current !== patient?.id) {
      loadedPatientId.current = patient?.id;
      setDraft(patient ? toDraft(patient) : null);
      setError(null);
      setSuccess(null);
    }
  }, [patient]);

  const update = <K extends keyof PatientDraft>(key: K, value: PatientDraft[K]) => {
    setDraft((current) => current ? { ...current, [key]: value } : current);
  };

  const handleSave = async () => {
    if (!patient || !draft?.name.trim()) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const updatedPatient: Patient = {
        ...patient,
        ...draft,
        name: draft.name.trim(),
        birthDate: draft.birthDate || null,
        id: patient.id,
        episodes: patient.episodes,
        dni: draft.dni,
        phone: draft.phone,
        email: draft.email,
        occupation: draft.occupation,
        medicalNotes: draft.medicalNotes,
        generalNotes: draft.generalNotes,
      };
      await onUpdatePatient(updatedPatient);
      setSuccess('Datos guardados correctamente');
    } catch (err) {
      console.error('Error al guardar paciente:', err);
      setError(getSaveErrorMessage(err));
    } finally {
      setSaving(false);
    }

    function getSaveErrorMessage(error: unknown): string {
      if (error instanceof Error) return error.message;
      if (typeof error === 'object' && error !== null && 'message' in error) {
        return String(error.message);
      }
      return 'No se pudo guardar los datos.';
    }
  };

  if (!patient || !draft) {
    return (
      <div className="mx-auto max-w-[1400px] px-4 py-6 lg:px-6">
        <Card className="p-12 text-center text-sm text-slate-500">
          Selecciona un paciente para consultar su ficha.
        </Card>
      </div>
    );
  }

  const textField = (
    key: Exclude<keyof PatientDraft, 'medicalNotes' | 'generalNotes'>,
    label: string,
    type = 'text',
  ) => (
    <label className="block text-sm font-medium text-slate-700">
      {label}
      <input
        type={type}
        value={draft[key]}
        onChange={(event) => update(key, event.target.value)}
        className="mt-1.5 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
      />
    </label>
  );

  return (
    <div className="mx-auto max-w-[1000px] space-y-5 px-4 py-6 lg:px-6">
      <Card>
        <CardHeader
          title="Ficha del paciente"
          description="Datos demográficos, de contacto y antecedentes"
          icon={<Contact className="h-5 w-5" />}
        />
        <div className="space-y-6 p-5">
          <div className="grid gap-4 md:grid-cols-2">
            {textField('name', 'Nombre completo')}
            {textField('birthDate', 'Fecha de nacimiento', 'date')}
            <div className="rounded-xl border border-primary-100 bg-primary-50/60 p-3 text-sm text-primary-800">
              <span className="font-medium">Edad calculada:</span> {age !== null ? `${age} años` : 'No disponible'}
            </div>
            {textField('dni', 'DNI')}
            {textField('phone', 'Teléfono', 'tel')}
            {textField('email', 'Email', 'email')}
            {textField('occupation', 'Ocupación / Deporte practicado')}
          </div>
          <label className="block text-sm font-medium text-slate-700">
            Antecedentes médicos / Alergias / Contraindicaciones generales
            <textarea
              rows={4}
              value={draft.medicalNotes}
              onChange={(event) => update('medicalNotes', event.target.value)}
              className="mt-1.5 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Notas administrativas
            <textarea
              rows={3}
              value={draft.generalNotes}
              onChange={(event) => update('generalNotes', event.target.value)}
              className="mt-1.5 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
            />
          </label>
          {error && <p role="alert" className="text-sm text-error-600">{error}</p>}
          {success && <p role="status" className="text-sm font-medium text-success-700">{success}</p>}
          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={saving || !draft.name.trim()}>
              <Save className="h-4 w-4" /> {saving ? 'Guardando…' : 'Guardar cambios en la ficha'}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
