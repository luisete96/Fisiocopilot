import { useState, useEffect, useCallback } from 'react';
import {
  Users, UserPlus, FileText, Plus, ChevronRight, Calendar,
  Activity, Trash2, Stethoscope, Loader2, ClipboardList, Search,
} from 'lucide-react';
import type { Patient, Episode, SessionEntry } from '../types';
import { calculateAge, hasPackedPatientNotes, isEpisodeActive, normalizeText, packPatientNotes, unpackPatientNotes } from '../patientUtils';
import { getSupabaseClient } from '../supabaseClient';
import { BODY_REGIONS } from '../mockData';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { Modal } from './ui/Modal';
import { EpisodeStatusControl } from './EpisodeStatusControl';

type PatientSortPreference = 'recent' | 'name-asc' | 'name-desc' | 'episodes';

const PATIENT_SORT_STORAGE_KEY = 'patients_sort_preference';
const PATIENT_SORT_OPTIONS: PatientSortPreference[] = ['recent', 'name-asc', 'name-desc', 'episodes'];

interface PatientsScreenProps {
  activePatientId: string | null;
  patients: Patient[];
  onPatientsLoaded: (patients: Patient[]) => Promise<void>;
  onPatientDeleted: (patientId: string) => void;
  episodes: Episode[];
  onSelectPatient: (patient: Patient) => void;
  onOpenExpediente: (episode: Episode, patient: Patient) => void;
  onOpenValoracion: (episode: Episode, patient: Patient) => void;
  onCreateEpisode: (patientId: string) => Promise<void>;
  onUpdateEpisode: (patientId: string, updatedEpisode: Episode) => Promise<void>;
  onDeleteEpisode: (episodeId: string) => Promise<void>;
}

export function PatientsScreen({
  activePatientId, patients, onPatientsLoaded, onPatientDeleted, episodes = [], onSelectPatient, onOpenExpediente, onOpenValoracion,
  onCreateEpisode, onUpdateEpisode, onDeleteEpisode,
}: PatientsScreenProps) {
  const [allSessions, setAllSessions] = useState<SessionEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [newPatientOpen, setNewPatientOpen] = useState(false);
  const [patientToDelete, setPatientToDelete] = useState<Patient | null>(null);
  const [deletingPatient, setDeletingPatient] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortPreference, setSortPreference] = useState<PatientSortPreference>(() => {
    try {
      const savedPreference = localStorage.getItem(PATIENT_SORT_STORAGE_KEY);
      return PATIENT_SORT_OPTIONS.includes(savedPreference as PatientSortPreference)
        ? savedPreference as PatientSortPreference
        : 'recent';
    } catch (error) {
      console.error('No se pudo leer la ordenación de pacientes guardada:', error);
      return 'recent';
    }
  });
  const [newPatientDraft, setNewPatientDraft] = useState({
    name: '', birthDate: '', dni: '', phone: '', email: '', occupation: '', medicalNotes: '',
  });

  const loadPatients = useCallback(async () => {
    const { data, error } = await getSupabaseClient().from('patients').select('*').order('name');
    if (error) throw error;
    if (data) {
      const mapped: Patient[] = data.map((p: Record<string, unknown>) => {
        const notes = unpackPatientNotes(p.notes as string | null);
        const hasStructuredNotes = hasPackedPatientNotes(p.notes as string | null);
        return {
          id: String(p.id),
          name: String(p.name),
          birthDate: (p.birthdate as string | null) ?? null,
          dni: String(p.dni ?? ''),
          phone: String(p.phone ?? ''),
          email: String(p.email ?? ''),
          occupation: String(p.occupation ?? ''),
          medicalNotes: hasStructuredNotes ? notes.medicalNotes : String(p.medical_notes ?? notes.medicalNotes),
          generalNotes: hasStructuredNotes ? notes.generalNotes : String(p.general_notes ?? notes.generalNotes),
          notes: p.notes as string | null,
          createdAt: String(p.created_at ?? ''),
        };
      });
      await onPatientsLoaded(mapped);
    } else {
      await onPatientsLoaded([]);
    }
  }, [onPatientsLoaded]);

  const loadAllSessions = useCallback(async () => {
    const { data, error } = await getSupabaseClient().from('sessions').select('*').order('date', { ascending: false });
    if (error) throw error;
    if (data) {
      const mapped: SessionEntry[] = data.map((s: Record<string, unknown>) => ({
        id: String(s.id),
        date: String(s.date),
        createdAt: typeof s.created_at === 'string' ? s.created_at : undefined,
        physio: String(s.physio),
        eva: Number(s.eva),
        summary: (s.summary as string) ?? '',
        techniques: (s.techniques as string[]) ?? [],
        techniquesSummary: (s.techniques_summary as string) ?? undefined,
        retest: (s.retest as string) ?? '',
        improvement: Number(s.improvement),
        episodeId: String(s.episode_id),
        clinicalData: (s.clinical_data as SessionEntry['clinicalData']) ?? null,
      }));
      setAllSessions(mapped);
    } else {
      setAllSessions([]);
    }
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setLoadError(null);
      try {
        await Promise.all([loadPatients(), loadAllSessions()]);
      } catch (error) {
        console.error('No se pudieron cargar los datos de pacientes:', error);
        setLoadError(getErrorMessage(error));
      } finally {
        setLoading(false);
      }
    })();
  }, [loadPatients, loadAllSessions]);

  const retryLoad = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      await Promise.all([loadPatients(), loadAllSessions()]);
    } catch (error) {
      console.error('No se pudieron cargar los datos de pacientes:', error);
      setLoadError(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePatient = async () => {
    if (!newPatientDraft.name.trim()) return;
    try {
      const { error } = await getSupabaseClient()
        .from('patients')
        .insert({
          name: newPatientDraft.name.trim(),
          birthdate: newPatientDraft.birthDate || null,
          dni: newPatientDraft.dni.trim() || null,
          phone: newPatientDraft.phone.trim() || null,
          email: newPatientDraft.email.trim() || null,
          occupation: newPatientDraft.occupation.trim() || null,
          notes: packPatientNotes(newPatientDraft.medicalNotes.trim(), ''),
        });
      if (error) throw error;
      await loadPatients();
      setNewPatientDraft({ name: '', birthDate: '', dni: '', phone: '', email: '', occupation: '', medicalNotes: '' });
      setNewPatientOpen(false);
    } catch (error) {
      console.error('No se pudo crear el paciente:', error);
      setLoadError(getErrorMessage(error));
    }
  };

  const startNewEpisode = async (patientId: string) => {
    setLoadError(null);
    try {
      await onCreateEpisode(patientId);
    } catch (error) {
      console.error('No se pudo crear el episodio:', error);
      setLoadError(getErrorMessage(error));
    }
  };

  const handleDeletePatient = async (id: string) => {
    setDeletingPatient(true);
    setLoadError(null);
    try {
      const { error } = await getSupabaseClient().from('patients').delete().eq('id', id);
      if (error) throw error;
      await loadPatients();
      onPatientDeleted(id);
      setPatientToDelete(null);
    } catch (error) {
      console.error('No se pudo eliminar el paciente:', error);
      setLoadError(getErrorMessage(error));
    } finally {
      setDeletingPatient(false);
    }
  };

  const handleDeleteEpisode = async (id: string) => {
    setLoadError(null);
    try {
      await onDeleteEpisode(id);
      await loadAllSessions();
    } catch (error) {
      console.error('No se pudo eliminar el episodio:', error);
      setLoadError(getErrorMessage(error));
    }
  };

  const selectedPatient = patients.find((p) => p.id === activePatientId);
  const patientEpisodes = episodes.filter((e) => e.patientId === activePatientId);
  const query = normalizeText(searchQuery);
  const filteredPatients = patients.filter((patient) =>
    [patient.name, patient.phone, patient.dni, patient.email, patient.occupation]
      .some((value) => normalizeText(value).includes(query)),
  );
  const sortedPatients = [...filteredPatients].sort((a, b) => {
    if (sortPreference === 'name-asc' || sortPreference === 'name-desc') {
      const direction = sortPreference === 'name-asc' ? 1 : -1;
      return direction * a.name.localeCompare(b.name, 'es', { sensitivity: 'base' });
    }
    if (sortPreference === 'episodes') {
      return (b.episodes?.length ?? 0) - (a.episodes?.length ?? 0)
        || getPatientLatestActivity(b, allSessions) - getPatientLatestActivity(a, allSessions);
    }
    return getPatientLatestActivity(b, allSessions) - getPatientLatestActivity(a, allSessions);
  });

  useEffect(() => {
    try {
      localStorage.setItem(PATIENT_SORT_STORAGE_KEY, sortPreference);
    } catch (error) {
      console.error('No se pudo guardar la ordenación de pacientes:', error);
      setLoadError('No se pudo guardar la preferencia de ordenación en este navegador.');
    }
  }, [sortPreference]);

  const sortedPatientEpisodes = [...patientEpisodes].sort(
    (a, b) => getEpisodeLatestDate(b, allSessions) - getEpisodeLatestDate(a, allSessions),
  );
  const activePatientEpisodes = sortedPatientEpisodes.filter(isEpisodeActive);
  const resolvedPatientEpisodes = sortedPatientEpisodes.filter((episode) => !isEpisodeActive(episode));

  const renderEpisodeCard = (ep: Episode, isActive: boolean, patient: Patient) => {
    const epSessions = allSessions
      .filter((session) => session.episodeId === ep.id)
      .sort((a, b) => getDateTimestamp(b.date || b.createdAt) - getDateTimestamp(a.date || a.createdAt));
    const lastEva = epSessions[0]?.eva;
    const firstEva = epSessions[epSessions.length - 1]?.eva;
    const sessionRegion = [...epSessions].reverse().find((session) => session.clinicalData?.region)?.clinicalData?.region;
    const regionLabel = BODY_REGIONS.find((region) => region.key === ep.region)?.label ?? ep.region;
    const isPlaceholderTitle = /^(nueva valoración|nuevo episodio)$/i.test(ep.title.trim());
    const displayTitle = isPlaceholderTitle ? sessionRegion || regionLabel || ep.title : ep.title;

    return (
      <div
        key={ep.id}
        className={`group rounded-xl border p-4 transition-all hover:border-primary-300 hover:shadow-card ${
          isActive ? 'border-slate-200 bg-white' : 'border-slate-200 bg-slate-100/70'
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h4 className={`text-sm font-semibold ${isActive ? 'text-slate-800' : 'text-slate-600'}`}>{displayTitle}</h4>
              {isActive && <Badge variant="success">Activo</Badge>}
              <EpisodeStatusControl episode={ep} onUpdate={onUpdateEpisode} />
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-slate-400">
              {regionLabel && normalizeText(ep.title) !== normalizeText(regionLabel) && (
                <span className="flex items-center gap-1">
                  <Stethoscope className="h-3 w-3" /> {regionLabel}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" /> {formatDate(ep.createdAt)}
              </span>
              <span className="flex items-center gap-1">
                <Activity className="h-3 w-3" /> {epSessions.length} sesión(es)
              </span>
              {firstEva !== undefined && lastEva !== undefined && firstEva > 0 && (
                <span className="flex items-center gap-1 font-medium text-slate-500">
                  EVA {firstEva}→{lastEva}
                </span>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={() => handleDeleteEpisode(ep.id)}
            className="rounded-lg p-1.5 text-slate-300 transition-colors hover:bg-error-50 hover:text-error-500"
            title="Eliminar episodio"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>

        {epSessions.length > 0 && (
          <div className="mt-3 space-y-1.5">
            {epSessions.slice(0, 3).map((session) => (
              <div key={session.id} className="flex items-center gap-3 rounded-lg bg-slate-50 p-2.5">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-100 text-primary-600">
                  <Calendar className="h-3.5 w-3.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-700">{formatDateShort(session.date)}</span>
                    <span className="text-xs text-slate-400">{session.physio}</span>
                  </div>
                  {session.techniquesSummary && (
                    <p className="mt-0.5 truncate text-xs font-medium text-secondary-700">{session.techniquesSummary}</p>
                  )}
                  <p className="mt-0.5 truncate text-xs text-slate-500">{session.retest}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded bg-error-50 text-xs font-bold text-error-600">
                    {session.eva}
                  </span>
                  {session.improvement > 0 && (
                    <span className="flex h-6 w-6 items-center justify-center rounded bg-success-50 text-xs font-bold text-success-600">
                      +{session.improvement}%
                    </span>
                  )}
                </div>
              </div>
            ))}
            {epSessions.length > 3 && (
              <p className="pl-10 text-xs text-slate-400">+{epSessions.length - 3} sesión(es) más…</p>
            )}
          </div>
        )}

        <div className="mt-3 flex items-center gap-2 border-t border-slate-200/70 pt-3">
          <Button size="sm" onClick={() => onOpenExpediente(ep, patient)}>
            <ClipboardList className="h-3.5 w-3.5" /> Ver Expediente
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
          <Button size="sm" variant="outline" onClick={() => onOpenValoracion(ep, patient)}>
            <FileText className="h-3.5 w-3.5" />
            {epSessions.length > 0 ? '+ Nueva Sesión / Seguimiento' : '+ Nueva Valoración'}
          </Button>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex h-[400px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-6 lg:px-6">
      {loadError && (
        <div role="alert" className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-error-200 bg-error-50 p-4 text-sm text-error-700">
          <span>No se pudieron cargar los datos: {loadError}</span>
          <Button size="sm" variant="outline" onClick={retryLoad}>Reintentar</Button>
        </div>
      )}
      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
        {/* Patient list sidebar */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
              <Users className="h-5 w-5 text-primary-600" /> Pacientes
            </h2>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">{patients.length} total</span>
              <Button size="sm" onClick={() => setNewPatientOpen(true)}>
                <UserPlus className="h-4 w-4" /> Nuevo
              </Button>
            </div>
          </div>
          <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-400 focus-within:border-primary-400 focus-within:ring-2 focus-within:ring-primary-100">
            <Search className="h-4 w-4 shrink-0" />
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Buscar por nombre, teléfono, DNI..."
              className="w-full bg-transparent text-slate-700 outline-none placeholder:text-slate-400"
            />
          </label>
          <label className="flex items-center justify-between gap-3 text-xs text-slate-500">
            <span>Ordenar pacientes</span>
            <select
              value={sortPreference}
              onChange={(event) => setSortPreference(event.target.value as PatientSortPreference)}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs text-slate-700 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
            >
              <option value="recent">Última sesión / Actividad reciente</option>
              <option value="name-asc">Nombre (A - Z)</option>
              <option value="name-desc">Nombre (Z - A)</option>
              <option value="episodes">Más episodios</option>
            </select>
          </label>
          <div className="space-y-2">
            {patients.length === 0 ? (
              <Card className="p-6 text-center">
                <p className="text-sm text-slate-400">No hay pacientes registrados.</p>
                <Button size="sm" variant="outline" className="mt-3" onClick={() => setNewPatientOpen(true)}>
                  <UserPlus className="h-4 w-4" /> Crear primer paciente
                </Button>
              </Card>
            ) : sortedPatients.length === 0 ? (
              <Card className="p-6 text-center">
                <p className="text-sm text-slate-400">No hay pacientes que coincidan con la búsqueda.</p>
              </Card>
            ) : (
              sortedPatients.map((p) => {
                const isActive = activePatientId === p.id;
                return (
                  <div key={p.id} className="relative">
                    <button
                      type="button"
                      onClick={() => onSelectPatient(p)}
                      className={`flex w-full items-center rounded-xl border p-3 pr-12 text-left transition-all ${
                        isActive
                          ? 'border-primary-400 bg-primary-50 shadow-sm ring-2 ring-primary-200'
                          : 'border-slate-200 bg-white hover:border-primary-200'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold ${
                          isActive ? 'bg-primary-600 text-white' : 'bg-slate-100 text-slate-500'
                        }`}>
                          {p.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className={`text-sm font-medium ${isActive ? 'text-primary-800' : 'text-slate-700'}`}>
                            {p.name}
                          </p>
                          <p className="text-xs text-slate-400">
                            {p.episodes?.length ?? 0} episodio(s)
                          </p>
                        </div>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPatientToDelete(p)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-300 transition-colors hover:bg-error-50 hover:text-error-500"
                      title="Eliminar paciente"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Episode detail panel — shows when a patient is selected */}
        <div className="flex-1 min-w-0 overflow-y-auto bg-slate-50 p-6">
          {selectedPatient ? (
            <div className="space-y-6">
              {/* Common patient header stays visible regardless of episode count. */}
              <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-600">
                      <Users className="h-5 w-5" />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-slate-800">{selectedPatient.name}</h2>
                      <p className="text-xs text-slate-500">
                        {calculateAge(selectedPatient.birthDate) !== null
                          ? `${calculateAge(selectedPatient.birthDate)} años`
                          : selectedPatient.birthDate ? formatDate(selectedPatient.birthDate) : 'Edad no disponible'}
                        {selectedPatient.phone ? ` · 📞 ${selectedPatient.phone}` : ''}
                      </p>
                    </div>
                  </div>
                  <Button
                    className="flex shrink-0 items-center gap-2 border-primary-200 text-primary-700 hover:bg-primary-50"
                    onClick={() => void startNewEpisode(selectedPatient.id)}
                    variant="outline"
                  >
                    <Plus className="h-4 w-4" />
                    Nuevo Episodio
                  </Button>
              </div>

              {patientEpisodes.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
                  <Stethoscope className="mx-auto h-12 w-12 text-slate-300" />
                  <p className="mt-2 text-sm text-slate-500">Este paciente no tiene episodios clínicos.</p>
                  <Button className="mt-4" onClick={() => void startNewEpisode(selectedPatient.id)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Nuevo Episodio
                  </Button>
                </div>
              ) : (
                <div className="space-y-5">
                  <section aria-labelledby="patient-active-episodes-heading" className="space-y-3">
                    <h3 id="patient-active-episodes-heading" className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                      <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                      Episodios Activos ({activePatientEpisodes.length})
                    </h3>
                    <div className="space-y-3">
                      {activePatientEpisodes.length > 0
                        ? activePatientEpisodes.map((episode) => renderEpisodeCard(episode, true, selectedPatient))
                        : <p className="rounded-xl border border-dashed border-slate-200 bg-white p-4 text-sm text-slate-400">No hay episodios activos.</p>}
                    </div>
                  </section>
                  {resolvedPatientEpisodes.length > 0 && (
                    <section aria-labelledby="patient-resolved-episodes-heading" className="space-y-3 border-t border-slate-200 pt-5">
                      <h3 id="patient-resolved-episodes-heading" className="text-sm font-semibold text-slate-500">
                        Episodios Resueltos ({resolvedPatientEpisodes.length})
                      </h3>
                      <div className="space-y-3">
                        {resolvedPatientEpisodes.map((episode) => renderEpisodeCard(episode, false, selectedPatient))}
                      </div>
                    </section>
                  )}
                </div>
              )}
            </div>
          ) : (
            <Card className="p-12 text-center">
              <Users className="mx-auto mb-4 h-12 w-12 text-slate-300" />
              <p className="text-sm text-slate-400">Selecciona un paciente o crea uno nuevo para ver sus episodios clínicos.</p>
            </Card>
          )}
        </div>
      </div>

      {/* New Patient Modal */}
      <Modal
        open={newPatientOpen}
        onClose={() => setNewPatientOpen(false)}
        title="Nuevo Paciente"
        subtitle="Registra los datos básicos del paciente"
        footer={
          <>
            <Button variant="ghost" onClick={() => setNewPatientOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreatePatient} disabled={!newPatientDraft.name.trim()}>
              <UserPlus className="h-4 w-4" /> Crear Paciente
            </Button>
          </>
        }
      >
        <div className="grid gap-4 md:grid-cols-2">
          <PatientInput label="Nombre y apellidos *" value={newPatientDraft.name} onChange={(name) => setNewPatientDraft((draft) => ({ ...draft, name }))} />
          <PatientInput label="Fecha de nacimiento" type="date" value={newPatientDraft.birthDate} onChange={(birthDate) => setNewPatientDraft((draft) => ({ ...draft, birthDate }))} />
          <PatientInput label="DNI" value={newPatientDraft.dni} onChange={(dni) => setNewPatientDraft((draft) => ({ ...draft, dni }))} />
          <PatientInput label="Teléfono" type="tel" value={newPatientDraft.phone} onChange={(phone) => setNewPatientDraft((draft) => ({ ...draft, phone }))} />
          <PatientInput label="Email" type="email" value={newPatientDraft.email} onChange={(email) => setNewPatientDraft((draft) => ({ ...draft, email }))} />
          <PatientInput label="Ocupación / Deporte principal" value={newPatientDraft.occupation} onChange={(occupation) => setNewPatientDraft((draft) => ({ ...draft, occupation }))} />
          <label className="block text-sm font-medium text-slate-700 md:col-span-2">
            Antecedentes médicos / Alergias
            <textarea
              rows={3}
              value={newPatientDraft.medicalNotes}
              onChange={(event) => setNewPatientDraft((draft) => ({ ...draft, medicalNotes: event.target.value }))}
              className="mt-1.5 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
            />
          </label>
          {loadError && <p role="alert" className="text-sm text-error-600 md:col-span-2">{loadError}</p>}
        </div>
      </Modal>

      <Modal
        open={!!patientToDelete}
        onClose={() => { if (!deletingPatient) setPatientToDelete(null); }}
        title="¿Eliminar paciente?"
        footer={
          <>
            <Button variant="ghost" onClick={() => setPatientToDelete(null)} disabled={deletingPatient}>
              Cancelar
            </Button>
            <Button
              variant="danger"
              onClick={() => patientToDelete && void handleDeletePatient(patientToDelete.id)}
              disabled={deletingPatient}
            >
              <Trash2 className="h-4 w-4" />
              {deletingPatient ? 'Eliminando…' : 'Eliminar definitivamente'}
            </Button>
          </>
        }
      >
        <p className="text-sm leading-relaxed text-slate-600">
          ¿Estás seguro de que deseas eliminar a &quot;{patientToDelete?.name}&quot; y todos sus episodios clínicos? Esta acción no se puede deshacer.
        </p>
        {loadError && <p role="alert" className="mt-3 text-sm text-error-600">{loadError}</p>}
      </Modal>
    </div>
  );
}

function PatientInput({
  label,
  value,
  onChange,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <label className="block text-sm font-medium text-slate-700">
      {label}
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1.5 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
      />
    </label>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso.includes('T') ? iso : iso + 'T00:00:00');
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
}

function formatDateShort(iso: string): string {
  const d = new Date(iso.includes('T') ? iso : iso + 'T00:00:00');
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error !== null && 'message' in error) {
    return String(error.message);
  }
  return 'Error de red al cargar pacientes.';
}

function getDateTimestamp(value?: string | null): number {
  if (!value) return 0;
  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function getEpisodeLatestDate(episode: Episode, sessions: SessionEntry[]): number {
  return Math.max(
    getDateTimestamp(episode.createdAt),
    getDateTimestamp(episode.updatedAt),
    getDateTimestamp(episode.latestSessionAt),
    ...(episode.sessions ?? []).flatMap((session) => [
      getDateTimestamp(session.date),
      getDateTimestamp(session.createdAt),
    ]),
    ...sessions
      .filter((session) => session.episodeId === episode.id)
      .flatMap((session) => [
        getDateTimestamp(session.date),
        getDateTimestamp(session.createdAt),
      ]),
  );
}

function getPatientLatestActivity(patient: Patient, sessions: SessionEntry[]): number {
  return Math.max(
    getDateTimestamp(patient.createdAt),
    ...(patient.episodes ?? []).map((episode) => getEpisodeLatestDate(episode, sessions)),
    ...sessions
      .filter((session) => {
        const patientEpisodeIds = new Set((patient.episodes ?? []).map((episode) => episode.id));
        return session.episodeId ? patientEpisodeIds.has(session.episodeId) : false;
      })
      .flatMap((session) => [
        getDateTimestamp(session.date),
        getDateTimestamp(session.createdAt),
      ]),
  );
}
