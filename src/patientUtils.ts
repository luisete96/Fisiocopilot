export function calculateAge(birthDate?: string | null): number | null {
  if (!birthDate) return null;
  const birth = new Date(/^\d{4}-\d{2}-\d{2}$/.test(birthDate) ? `${birthDate}T00:00:00` : birthDate);
  if (Number.isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDifference = today.getMonth() - birth.getMonth();
  if (monthDifference < 0 || (monthDifference === 0 && today.getDate() < birth.getDate())) age--;
  return age >= 0 && age < 130 ? age : null;
}

export function normalizeText(value?: string | null): string {
  return (value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

const PATIENT_NOTES_PREFIX = '__fisiocopilot_patient_notes_v1__:';

export function hasPackedPatientNotes(value?: string | null): boolean {
  return value?.startsWith(PATIENT_NOTES_PREFIX) ?? false;
}

export function packPatientNotes(medicalNotes?: string | null, generalNotes?: string | null): string {
  return `${PATIENT_NOTES_PREFIX}${JSON.stringify({
    medicalNotes: medicalNotes ?? '',
    generalNotes: generalNotes ?? '',
  })}`;
}

export function unpackPatientNotes(value?: string | null): { medicalNotes: string; generalNotes: string } {
  if (!value) return { medicalNotes: '', generalNotes: '' };
  if (value.startsWith(PATIENT_NOTES_PREFIX)) {
    try {
      const parsed = JSON.parse(value.slice(PATIENT_NOTES_PREFIX.length)) as {
        medicalNotes?: string;
        generalNotes?: string;
      };
      return {
        medicalNotes: parsed.medicalNotes ?? '',
        generalNotes: parsed.generalNotes ?? '',
      };
    } catch (error) {
      console.error('No se pudieron leer las notas del paciente:', error);
    }
  }
  return { medicalNotes: '', generalNotes: value };
}
