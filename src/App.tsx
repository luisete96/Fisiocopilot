import { useState, useCallback, useEffect } from 'react';
import { FileText } from 'lucide-react';
import type {
  TabKey, EquipmentKey, GeminiConfig, SessionEntry,
  ClinicalData, ClinicalReportResult, ClinicalSessionData,
  BodyRegion, Patient, Episode, Appointment,
} from './types';
import { Header } from './components/Header';
import { ValorationScreen } from './components/ValorationScreen';
import { ExpedienteScreen } from './components/ExpedienteScreen';
import { ClinicalReport } from './components/ClinicalReport';
import { PatientsScreen } from './components/PatientsScreen';
import { PatientInfoScreen } from './components/PatientInfoScreen';
import { AgendaScreen } from './components/AgendaScreen';
import { getSupabaseClient, supabaseConfigError } from './supabaseClient';
import { BODY_REGIONS } from './mockData';
import { normalizeText, packPatientNotes } from './patientUtils';

const DEFAULT_EQUIPMENT: Record<EquipmentKey, boolean> = {
  ecografo: true,
  camilla: true,
  dinamometro: false,
  invasivas: true,
  gimnasio: true,
  radiofrecuencia: false,
  superinductive: false,
  shockwaves_radial: false,
  shockwaves_focal: false,
};

const DEFAULT_GEMINI: GeminiConfig = {
  apiKey: /^TU_.*_AQUI$/i.test(import.meta.env.VITE_GEMINI_API_KEY?.trim() ?? '')
    ? ''
    : import.meta.env.VITE_GEMINI_API_KEY?.trim() ?? '',
};

function loadGeminiConfig(): GeminiConfig {
  const stored = loadFromStorage('fisiocopilot_gemini', DEFAULT_GEMINI);
  return { ...stored, apiKey: stored.apiKey || DEFAULT_GEMINI.apiKey };
}

const DEFAULT_PROFESSIONALS = ['Fisio: Luis', 'Fisio: Carlos'];

const DEFAULT_ANAMNESIS = {
  que: '',
  porque: '',
  desde: '',
};

function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw) as T;
  } catch {
    // ignore
  }
  return fallback;
}

function saveToStorage<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore
  }
}

function isMissingEpisodeClosureColumns(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const code = 'code' in error ? String(error.code) : '';
  const message = 'message' in error ? String(error.message) : '';
  return (code === '42703' || code === 'PGRST204') &&
    /closed_at|discharge_reason|discharge_notes/i.test(message);
}

export default function App() {
  const [activeTab, setActiveTab] = useState<TabKey>('pacientes');
  const [professionals, setProfessionals] = useState<string[]>(DEFAULT_PROFESSIONALS);
  const [selectedPhysio, setSelectedPhysio] = useState<string>('Fisio: Luis');
  const [equipment, setEquipment] = useState<Record<EquipmentKey, boolean>>(DEFAULT_EQUIPMENT);
  const [geminiConfig, setGeminiConfig] = useState<GeminiConfig>(loadGeminiConfig);
  const [sessions, setSessions] = useState<SessionEntry[]>([]);
  const [clinicalData, setClinicalData] = useState<ClinicalData | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [valuationInstanceKey, setValuationInstanceKey] = useState(0);

  const [anamnesis, setAnamnesis] = useState(DEFAULT_ANAMNESIS);
  const [region, setRegion] = useState<BodyRegion | null>(null);

  const [activeEpisodeId, setActiveEpisodeId] = useState<string | null>(null);
  const [patients, setPatients] = useState<Patient[]>(() => loadFromStorage('fisiocopilot_patients', []));
  const [appointments, setAppointments] = useState<Appointment[]>(() => loadFromStorage('fisiocopilot_appointments', []));
  const [activePatientId, setActivePatientId] = useState<string | null>(null);
  const activePatient = patients.find((patient) => patient.id === activePatientId) ?? null;
  const [activeEpisode, setActiveEpisode] = useState<Episode | null>(null);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [autoNamedEpisodeId, setAutoNamedEpisodeId] = useState<string | null>(null);

  useEffect(() => {
    saveToStorage('fisiocopilot_patients', patients);
  }, [patients]);

  useEffect(() => {
    saveToStorage('fisiocopilot_appointments', appointments);
  }, [appointments]);

  const loadEpisodesForPatient = useCallback(async (patientId: string): Promise<Episode[]> => {
    const cachedClosureData = loadFromStorage<Record<string, Pick<Episode, 'closedAt' | 'dischargeReason' | 'dischargeNotes'>>>(
      'fisiocopilot_episode_closures',
      {},
    );
    const { data } = await getSupabaseClient()
      .from('episodes')
      .select('*')
      .eq('patient_id', patientId)
      .order('created_at', { ascending: true });
    if (data) {
      const mapped: Episode[] = data.map((e: Record<string, unknown>) => {
        return {
          id: String(e.id),
          patientId: String(e.patient_id ?? e.patientId ?? ''),
          title: String(e.title ?? ''),
          region: (e.region as string | null) ?? null,
          anamnesis: (e.anamnesis as Episode['anamnesis']) ?? null,
          status: (e.status as 'active' | 'resolved') ?? 'active',
          createdAt: String(e.created_at ?? e.createdAt ?? ''),
          closedAt: (e.closed_at as string | undefined) ?? cachedClosureData[String(e.id)]?.closedAt,
          dischargeReason: (e.discharge_reason as Episode['dischargeReason']) ?? cachedClosureData[String(e.id)]?.dischargeReason,
          dischargeNotes: (e.discharge_notes as string | undefined) ?? cachedClosureData[String(e.id)]?.dischargeNotes,
          notes: (e.notes as string | undefined) ?? '',
        };
      });
      setEpisodes(mapped);
      return mapped;
    }
    setEpisodes([]);
    return [];
  }, []);

  const handleDeleteEpisode = useCallback(async (episodeId: string) => {
    const episode = episodes.find((item) => item.id === episodeId);
    if (!episode) throw new Error('No se encontró el episodio seleccionado.');
    const { error } = await getSupabaseClient().from('episodes').delete().eq('id', episodeId);
    if (error) throw error;
    setEpisodes((previous) => previous.filter((item) => item.id !== episodeId));
    setPatients((previous) => previous.map((patient) => patient.id === episode.patientId
      ? { ...patient, episodes: (patient.episodes ?? []).filter((item) => item.id !== episodeId) }
      : patient));
    if (activeEpisodeId === episodeId) {
      setActiveEpisode(null);
      setActiveEpisodeId(null);
      setSessions([]);
    }
  }, [activeEpisodeId, episodes]);

  const handleSaveAppointment = useCallback(async (appointment: Appointment) => {
    if (!patients.some((patient) => patient.id === appointment.patientId)) {
      throw new Error('El paciente asociado a la cita ya no existe.');
    }
    setAppointments((previous) => {
      const exists = previous.some((item) => item.id === appointment.id);
      return exists
        ? previous.map((item) => item.id === appointment.id ? appointment : item)
        : [...previous, appointment];
    });
  }, [patients]);

  const handleDeleteAppointment = useCallback((appointmentId: string) => {
    setAppointments((previous) => previous.filter((appointment) => appointment.id !== appointmentId));
  }, []);

  const handleCreatePatientFromAgenda = useCallback(async (name: string, phone: string): Promise<Patient> => {
    const { data, error } = await getSupabaseClient()
      .from('patients')
      .insert({
        name,
        birthdate: null,
        phone: phone || null,
        notes: packPatientNotes('', ''),
      })
      .select()
      .single();
    if (error) throw error;
    if (!data) throw new Error('Supabase no devolvió el paciente creado.');
    const patient: Patient = {
      id: String(data.id),
      name: String(data.name ?? name),
      birthDate: (data.birthdate as string | null) ?? null,
      dni: String(data.dni ?? ''),
      phone: String(data.phone ?? phone),
      email: String(data.email ?? ''),
      occupation: String(data.occupation ?? ''),
      medicalNotes: '',
      generalNotes: '',
      notes: (data.notes as string | null) ?? null,
      createdAt: String(data.created_at ?? new Date().toISOString()),
      episodes: [],
    };
    setPatients((previous) => [...previous, patient].sort((a, b) => a.name.localeCompare(b.name)));
    return patient;
  }, []);

  const ensureDefaultEpisode = useCallback(async (patientId: string): Promise<Episode | null> => {
    const existing = await loadEpisodesForPatient(patientId);
    if (existing.length > 0) return existing[0];
    const { data } = await getSupabaseClient()
      .from('episodes')
      .insert({
        patient_id: patientId,
        title: 'Episodio 1: Consulta Inicial',
        region: null,
        anamnesis: null,
        status: 'active',
      })
      .select()
      .single();
    if (data) {
      const ep: Episode = {
        id: String(data.id),
        patientId: String(data.patient_id),
        title: String(data.title),
        region: (data.region as string | null) ?? null,
        anamnesis: (data.anamnesis as Episode['anamnesis']) ?? null,
        status: (data.status as 'active' | 'resolved') ?? 'active',
        createdAt: String(data.created_at ?? ''),
        closedAt: (data.closed_at as string | undefined) ?? undefined,
        dischargeReason: (data.discharge_reason as Episode['dischargeReason']) ?? undefined,
        dischargeNotes: (data.discharge_notes as string | undefined) ?? undefined,
        notes: (data.notes as string | undefined) ?? '',
      };
      setEpisodes([ep]);
      setPatients((previous) => previous.map((patient) => patient.id === patientId
        ? { ...patient, episodes: [...(patient.episodes ?? []), ep] }
        : patient));
      return ep;
    }
    return null;
  }, [loadEpisodesForPatient]);

  const loadSessionsForEpisode = useCallback(async (episodeId: string | null) => {
    if (!episodeId) {
      setSessions([]);
      return;
    }
    const { data } = await getSupabaseClient()
      .from('sessions')
      .select('*')
      .eq('episode_id', episodeId)
      .order('date', { ascending: true });
    if (data) {
      const mapped: SessionEntry[] = data.map((s: Record<string, unknown>) => ({
        id: String(s.id),
        date: String(s.date),
        physio: String(s.physio),
        eva: Number(s.eva),
        evaPost: s.eva_post !== null && s.eva_post !== undefined ? Number(s.eva_post) : null,
        summary: (s.summary as string) ?? '',
        techniques: (s.techniques as string[]) ?? [],
        techniquesSummary: (s.techniques_summary as string) ?? undefined,
        retest: (s.retest as string) ?? '',
        improvement: Number(s.improvement),
        episodeId: String(s.episode_id),
        clinicalData: (s.clinical_data as ClinicalSessionData) ?? null,
      }));
      setSessions(mapped);
    } else {
      setSessions([]);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'expediente' && activeEpisodeId) {
      loadSessionsForEpisode(activeEpisodeId);
    }
  }, [activeTab, activeEpisodeId, loadSessionsForEpisode]);

  const handleAddProfessional = (name: string) => {
    const formatted = `Fisio: ${name}`;
    setProfessionals((prev) => [...prev, formatted]);
    setSelectedPhysio(formatted);
  };

  const handleEquipmentToggle = (key: EquipmentKey) => {
    setEquipment((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleGeminiSave = (config: GeminiConfig) => {
    setGeminiConfig(config);
    saveToStorage('fisiocopilot_gemini', config);
  };

  const handleAddSession = async (session: SessionEntry) => {
    if (activeEpisodeId) {
      const primaryHypothesis = clinicalData?.hypotheses.find((hypothesis) => hypothesis.isPrimary)?.label;
      if (clinicalData?.region) {
        await handleEpisodeContextChange(
          region,
          anamnesis.que,
          clinicalData.region,
          primaryHypothesis,
        );
      }
      const { data } = await getSupabaseClient()
        .from('sessions')
        .insert({
          patient_id: activePatient?.id,
          episode_id: activeEpisodeId,
          date: session.date,
          physio: session.physio,
          eva: session.eva,
          summary: session.summary,
          techniques: session.techniques,
          techniques_summary: session.techniquesSummary ?? null,
          retest: session.retest,
          improvement: session.improvement,
        })
        .select()
        .single();
      if (data) {
        await loadSessionsForEpisode(activeEpisodeId);
      }
    } else {
      setSessions((prev) => [...prev, session].sort((a, b) => a.date.localeCompare(b.date)));
    }
  };

  const handleDataChange = useCallback((data: ClinicalData) => {
    setClinicalData(data);
  }, []);

  const handleSaveReport = async (report: ClinicalReportResult, techniquesSummary?: string) => {
    const sessionClinicalData: ClinicalSessionData | null = clinicalData ? {
      dynamicQuestions: clinicalData.dynamicQuestions,
      dichotomousFindings: clinicalData.dichotomousFindings,
      redFlags: clinicalData.redFlags,
      yellowFlags: clinicalData.yellowFlags,
      tests: clinicalData.tests,
      comparable: clinicalData.comparable,
      hypotheses: clinicalData.hypotheses,
      anamnesis: clinicalData.anamnesis,
      region: clinicalData.region,
      aiPrognosis: clinicalData.aiPrognosis,
      aiTreatment: clinicalData.aiTreatment,
      report,
      techniquesSummary: techniquesSummary ?? null,
      equipmentSafety: clinicalData.equipmentSafety ?? [],
      previousHypotheses: clinicalData.previousHypotheses,
      evolution: clinicalData.evolution,
    } : null;

    const entry: SessionEntry = {
      id: `report-${Date.now()}`,
      date: new Date().toISOString().split('T')[0],
      physio: selectedPhysio,
      eva: clinicalData?.comparable.evaCurrent ?? clinicalData?.comparable.eva ?? 0,
      evaPost: clinicalData?.comparable.evaPost ?? null,
      summary: report.clinicalDiagnosis.slice(0, 200),
      techniques: [],
      techniquesSummary,
      retest: report.relevantAsteriskSign.slice(0, 150),
      improvement: 0,
      clinicalData: sessionClinicalData,
    };

    if (activeEpisodeId) {
      const primaryHypothesis = clinicalData?.hypotheses.find((hypothesis) => hypothesis.isPrimary)?.label;
      if (clinicalData?.region) {
        await handleEpisodeContextChange(
          region,
          anamnesis.que,
          clinicalData.region,
          primaryHypothesis,
        );
      }
      const { data } = await getSupabaseClient()
        .from('sessions')
        .insert({
          patient_id: activePatient?.id,
          episode_id: activeEpisodeId,
          date: entry.date,
          physio: entry.physio,
          eva: entry.eva,
          eva_post: entry.evaPost,
          summary: entry.summary,
          techniques: entry.techniques,
          techniques_summary: techniquesSummary ?? null,
          retest: entry.retest,
          improvement: entry.improvement,
          clinical_data: sessionClinicalData,
        })
        .select()
        .single();
      if (data) {
        await loadSessionsForEpisode(activeEpisodeId);
      }
      setActiveTab('expediente');
    } else {
      setSessions((prev) => [...prev, entry].sort((a, b) => a.date.localeCompare(b.date)));
    }
  };

  const handleSelectPatient = useCallback(async (patient: Patient) => {
    setAutoNamedEpisodeId(null);
    setActivePatientId(patient.id);
    setSessions([]);
    setActiveEpisode(null);
    setActiveEpisodeId(null);
    await loadEpisodesForPatient(patient.id);
  }, [loadEpisodesForPatient]);

  const handleSelectEpisode = useCallback((episode: Episode, patient: Patient) => {
    setAutoNamedEpisodeId(null);
    setValuationInstanceKey((current) => current + 1);
    setClinicalData(null);
    setSessions([]);
    setReportOpen(false);
    setActivePatientId(patient.id);
    setActiveEpisode(episode);
    setActiveEpisodeId(episode.id);
    if (episode.anamnesis) {
      setAnamnesis(episode.anamnesis);
    } else {
      setAnamnesis(DEFAULT_ANAMNESIS);
    }
    if (episode.region) {
      setRegion(episode.region as BodyRegion);
    } else {
      setRegion(null);
    }
    setActiveTab('valoracion');
    loadSessionsForEpisode(episode.id);
  }, [loadSessionsForEpisode]);

  const handleOpenAgendaPatient = useCallback((patientId: string) => {
    setActivePatientId(patientId);
    setActiveTab('pacientes');
  }, []);

  const handleStartAgendaAppointment = useCallback(async (appointment: Appointment) => {
    const patient = patients.find((item) => item.id === appointment.patientId);
    if (!patient) throw new Error('No se encontró el paciente asociado a la cita.');
    await handleSaveAppointment({ ...appointment, status: 'in_progress' });
    const linkedEpisode = episodes.find((episode) =>
      episode.id === appointment.episodeId && episode.patientId === patient.id,
    ) ?? patient.episodes?.find((episode) => episode.id === appointment.episodeId);
    const activeEpisodeForPatient = episodes.find((episode) =>
      episode.patientId === patient.id && episode.status === 'active',
    ) ?? patient.episodes?.find((episode) => episode.status === 'active');
    const episode = linkedEpisode ?? activeEpisodeForPatient ?? await ensureDefaultEpisode(patient.id);
    if (!episode) throw new Error('No se pudo encontrar o crear un episodio para la valoración.');
    handleSelectEpisode(episode, patient);
  }, [patients, episodes, handleSaveAppointment, ensureDefaultEpisode, handleSelectEpisode]);

  const handleOpenAgendaExpediente = useCallback(async (appointment: Appointment) => {
    const patient = patients.find((item) => item.id === appointment.patientId);
    if (!patient) throw new Error('No se encontró el paciente asociado a la cita.');
    const episode = episodes.find((item) =>
      item.id === appointment.episodeId && item.patientId === patient.id,
    ) ?? patient.episodes?.find((item) => item.id === appointment.episodeId)
      ?? episodes.find((item) =>
      item.patientId === patient.id && item.status === 'active',
    ) ?? patient.episodes?.find((item) => item.status === 'active');
    setActivePatientId(patient.id);
    setActiveEpisode(episode ?? null);
    setActiveEpisodeId(episode?.id ?? null);
    setSessions([]);
    setActiveTab('expediente');
    if (episode) await loadSessionsForEpisode(episode.id);
  }, [patients, episodes, loadSessionsForEpisode]);

  const handleBackToExpediente = useCallback(() => {
    setActiveTab('expediente');
  }, []);

  const handleOpenExpediente = useCallback((episode: Episode, patient: Patient) => {
    setAutoNamedEpisodeId(null);
    setActivePatientId(patient.id);
    setActiveEpisode(episode);
    setActiveEpisodeId(episode.id);
    setSessions([]);
    setActiveTab('expediente');
    loadSessionsForEpisode(episode.id);
  }, [loadSessionsForEpisode]);

  const handleOpenValoracion = (episode: Episode, patient: Patient) => {
    handleSelectEpisode(episode, patient);
  };

  const handleSelectEpisodeInExpediente = useCallback((episodeId: string) => {
    const ep = episodes.find((e) => e.id === episodeId);
    if (ep) {
      setAutoNamedEpisodeId(null);
      setActiveEpisode(ep);
      setActiveEpisodeId(ep.id);
      setSessions([]);
      loadSessionsForEpisode(ep.id);
    }
  }, [episodes, loadSessionsForEpisode]);

  const handleCreateEpisode = useCallback(async (patientId: string) => {
    if (!patientId || !patients.some((patient) => patient.id === patientId)) {
      throw new Error('No se encontró el paciente para crear el episodio.');
    }
    const { data, error } = await getSupabaseClient()
      .from('episodes')
      .insert({
        patient_id: patientId,
        title: 'Nueva valoración',
        region: null,
        anamnesis: null,
        status: 'active',
      })
      .select()
      .single();
    if (error) throw error;
    if (!data) throw new Error('Supabase no devolvió el episodio creado.');
    if (data) {
      const ep: Episode = {
        id: String(data.id),
        patientId: String(data.patient_id),
        title: String(data.title ?? 'Nueva valoración'),
        region: (data.region as string | null) ?? null,
        anamnesis: null,
        status: 'active',
        createdAt: String(data.created_at ?? ''),
      };
      setActivePatientId(patientId);
      setAutoNamedEpisodeId(ep.id);
      setValuationInstanceKey((current) => current + 1);
      setClinicalData(null);
      setAnamnesis(DEFAULT_ANAMNESIS);
      setRegion(null);
      setEpisodes((prev) => [...prev, ep]);
      setPatients((prev) => prev.map((entry) => entry.id === patientId
        ? { ...entry, episodes: [...(entry.episodes ?? []), ep] }
        : entry));
      setActiveEpisode(ep);
      setActiveEpisodeId(ep.id);
      setSessions([]);
      setActiveTab('valoracion');
    }
  }, [patients]);

  const handleCreateEpisodeInExpediente = useCallback(async () => {
    if (activePatient) await handleCreateEpisode(activePatient.id);
  }, [activePatient, handleCreateEpisode]);

  const handleUpdateEpisode = useCallback(async (patientId: string, updatedEpisode: Episode) => {
    if (!patientId || updatedEpisode.patientId !== patientId) {
      throw new Error('El paciente del episodio no coincide.');
    }
    const existingEpisode = episodes.find((episode) =>
      episode.id === updatedEpisode.id && episode.patientId === patientId,
    );
    if (!existingEpisode) throw new Error('No se encontró el episodio seleccionado.');

    const episodeToSave: Episode = { ...existingEpisode, ...updatedEpisode };
    const client = getSupabaseClient();
    let { data, error } = await client
      .from('episodes')
      .update({
        status: episodeToSave.status,
        closed_at: episodeToSave.closedAt ?? null,
        discharge_reason: episodeToSave.dischargeReason ?? null,
        discharge_notes: episodeToSave.dischargeNotes ?? null,
      })
      .eq('id', episodeToSave.id)
      .eq('patient_id', patientId)
      .select('id')
      .maybeSingle();
    if (error && isMissingEpisodeClosureColumns(error)) {
      console.warn('La base de datos aún no tiene las columnas de cierre; se guarda el estado y se conserva el motivo localmente.', error);
      const fallback = await client
        .from('episodes')
        .update({ status: episodeToSave.status })
        .eq('id', episodeToSave.id)
        .eq('patient_id', patientId)
        .select('id')
        .maybeSingle();
      data = fallback.data;
      error = fallback.error;
    }
    if (error) throw error;
    if (!data) throw new Error('Supabase no encontró el episodio para actualizar.');
    const cachedClosureData = loadFromStorage<Record<string, Pick<Episode, 'closedAt' | 'dischargeReason' | 'dischargeNotes'>>>(
      'fisiocopilot_episode_closures',
      {},
    );
    saveToStorage('fisiocopilot_episode_closures', {
      ...cachedClosureData,
      [episodeToSave.id]: {
        closedAt: episodeToSave.closedAt,
        dischargeReason: episodeToSave.dischargeReason,
        dischargeNotes: episodeToSave.dischargeNotes,
      },
    });
    setEpisodes((previous) => previous.map((episode) =>
      episode.id === episodeToSave.id && episode.patientId === patientId ? episodeToSave : episode,
    ));
    setActiveEpisode((previous) =>
      previous?.id === episodeToSave.id && previous.patientId === patientId
        ? { ...previous, ...episodeToSave }
        : previous,
    );

    setPatients((previous) => previous.map((patient) => {
      if (patient.id !== patientId) return patient;
      const patientEpisodes = patient.episodes ?? episodes.filter((episode) => episode.patientId === patientId);
      const hasEpisode = patientEpisodes.some((episode) => episode.id === episodeToSave.id);
      return {
        ...patient,
        episodes: hasEpisode
          ? patientEpisodes.map((episode) => episode.id === episodeToSave.id ? episodeToSave : episode)
          : [...patientEpisodes, episodeToSave],
      };
    }));
  }, [episodes, patients]);

  const handleEpisodeContextChange = useCallback(async (
    nextRegion: BodyRegion | null,
    reason: string,
    descriptiveRegion?: string,
    primaryHypothesis?: string,
  ) => {
    if (!activeEpisode || activeEpisode.status !== 'active' || !nextRegion) return;
    const descriptiveLabel = descriptiveRegion?.trim();
    const regionLabel = descriptiveLabel && normalizeText(descriptiveLabel) !== 'no especificada'
      ? descriptiveLabel
      : BODY_REGIONS.find((item) => item.key === nextRegion)?.label ?? reason.trim();
    const currentRegionLabel = BODY_REGIONS.find((item) => item.key === activeEpisode.region)?.label;
    const currentTitle = activeEpisode.title.trim();
    const isPlaceholder = !currentTitle || /^(nueva valoración|nuevo episodio)$/i.test(currentTitle);
    const isRegionTitle = !!currentRegionLabel &&
      (normalizeText(currentTitle) === normalizeText(currentRegionLabel) ||
        normalizeText(currentTitle).startsWith(`${normalizeText(currentRegionLabel)} `));
    const canAutoName = isPlaceholder || isRegionTitle || activeEpisode.id === autoNamedEpisodeId;
    const conciseHypothesis = primaryHypothesis?.trim();
    const hypothesisTitle = conciseHypothesis && conciseHypothesis.length <= 45
      ? `${regionLabel} — ${conciseHypothesis}`
      : regionLabel;
    const title = canAutoName ? hypothesisTitle || 'Nueva valoración' : activeEpisode.title;
    if (activeEpisode.title === title && activeEpisode.region === nextRegion) return;
    const { error } = await getSupabaseClient()
      .from('episodes')
      .update({ title, region: nextRegion })
      .eq('id', activeEpisode.id);
    if (error) throw error;
    if (canAutoName) setAutoNamedEpisodeId(activeEpisode.id);
    setActiveEpisode((previous) => previous?.id === activeEpisode.id ? { ...previous, title, region: nextRegion } : previous);
    setEpisodes((previous) => previous.map((episode) =>
      episode.id === activeEpisode.id ? { ...episode, title, region: nextRegion } : episode,
    ));
    setPatients((previous) => previous.map((patient) => ({
      ...patient,
      episodes: patient.episodes?.map((episode) =>
        episode.id === activeEpisode.id ? { ...episode, title, region: nextRegion } : episode,
      ),
    })));
  }, [activeEpisode, autoNamedEpisodeId]);

  const handleUpdatePatient = useCallback(async (patient: Patient) => {
    const { error } = await getSupabaseClient()
      .from('patients')
      .update({
        name: patient.name,
        birthdate: patient.birthDate || null,
        dni: patient.dni || null,
        phone: patient.phone || null,
        email: patient.email || null,
        occupation: patient.occupation || null,
        notes: packPatientNotes(patient.medicalNotes, patient.generalNotes ?? patient.notes),
      })
      .eq('id', patient.id);
    if (error) throw error;
    setPatients((previous) => previous.map((entry) => entry.id === patient.id
      ? { ...patient, episodes: patient.episodes ?? entry.episodes }
      : entry));
  }, []);

  const handlePatientsLoaded = useCallback(async (loadedPatients: Patient[]) => {
    if (loadedPatients.length === 0) {
      setPatients([]);
      setEpisodes([]);
      return;
    }
    const cachedClosureData = loadFromStorage<Record<string, Pick<Episode, 'closedAt' | 'dischargeReason' | 'dischargeNotes'>>>(
      'fisiocopilot_episode_closures',
      {},
    );
    const { data, error } = await getSupabaseClient()
      .from('episodes')
      .select('*')
      .in('patient_id', loadedPatients.map((patient) => patient.id))
      .order('created_at', { ascending: true });
    if (error) throw error;
    const loadedEpisodes: Episode[] = (data ?? []).map((row: Record<string, unknown>) => ({
      id: String(row.id),
      patientId: String(row.patient_id ?? ''),
      title: String(row.title ?? ''),
      region: (row.region as string | null) ?? null,
      anamnesis: (row.anamnesis as Episode['anamnesis']) ?? null,
      status: (row.status as Episode['status']) ?? 'active',
      createdAt: String(row.created_at ?? ''),
      closedAt: (row.closed_at as string | undefined) ?? cachedClosureData[String(row.id)]?.closedAt,
      dischargeReason: (row.discharge_reason as Episode['dischargeReason']) ?? cachedClosureData[String(row.id)]?.dischargeReason,
      dischargeNotes: (row.discharge_notes as string | undefined) ?? cachedClosureData[String(row.id)]?.dischargeNotes,
      notes: (row.notes as string | undefined) ?? '',
    }));
    const patientsWithEpisodes = loadedPatients.map((patient) => ({
      ...patient,
      episodes: loadedEpisodes.filter((episode) => episode.patientId === patient.id),
    }));
    setPatients(patientsWithEpisodes);
    setEpisodes(loadedEpisodes);
  }, []);

  const handleSaveClinicalSession = useCallback(async (
    sessionId: string,
    clinicalSessionData: ClinicalSessionData,
    techniquesSummary: string,
  ) => {
    const { error } = await getSupabaseClient()
      .from('sessions')
      .update({
        clinical_data: clinicalSessionData,
        techniques_summary: techniquesSummary || null,
      })
      .eq('id', sessionId);
    if (error) throw error;
    setSessions((previous) => previous.map((session) => session.id === sessionId
      ? { ...session, clinicalData: clinicalSessionData, techniquesSummary: techniquesSummary || undefined }
      : session));
  }, []);

  const handleNewValoracion = useCallback(async () => {
    if (!activePatient) return;
    if (activeEpisode) {
      handleSelectEpisode(activeEpisode, activePatient);
    } else {
      const ep = await ensureDefaultEpisode(activePatient.id);
      if (ep) {
        handleSelectEpisode(ep, activePatient);
      }
    }
  }, [activePatient, activeEpisode, ensureDefaultEpisode, handleSelectEpisode]);

  if (supabaseConfigError) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-10">
        <section className="w-full max-w-xl rounded-2xl border border-amber-200 bg-white p-6 shadow-sm">
          <h1 className="text-lg font-semibold text-slate-900">FisioCopilot necesita configuración</h1>
          <p className="mt-2 text-sm text-slate-600">{supabaseConfigError}</p>
          <p className="mt-4 text-sm text-slate-600">
            Crea <code className="rounded bg-slate-100 px-1.5 py-0.5">.env.local</code> en la raíz del proyecto con:
          </p>
          <pre className="mt-3 overflow-x-auto rounded-lg bg-slate-900 p-4 text-sm text-slate-100">
            {'VITE_SUPABASE_URL=https://fhaesvcbkvqcaldnyhpn.supabase.co\nVITE_SUPABASE_ANON_KEY=tu-clave-anon-publica\nVITE_GEMINI_API_KEY=tu-clave-de-google-ai-studio'}
          </pre>
          <p className="mt-3 text-xs text-slate-500">
            Reinicia el servidor de desarrollo después de guardar el archivo.
          </p>
        </section>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <Header
        activeTab={activeTab}
        onTabChange={setActiveTab}
        professionals={professionals}
        selectedPhysio={selectedPhysio}
        onPhysioChange={setSelectedPhysio}
        onAddProfessional={handleAddProfessional}
        equipment={equipment}
        onEquipmentToggle={handleEquipmentToggle}
        geminiConfig={geminiConfig}
        onGeminiConfigSave={handleGeminiSave}
        activePatientName={activePatient?.name ?? null}
        hasActivePatient={!!activePatient}
      />

      <main>
        {activeTab === 'agenda' && (
          <AgendaScreen
            appointments={appointments}
            patients={patients}
            episodes={episodes}
            onSaveAppointment={handleSaveAppointment}
            onDeleteAppointment={handleDeleteAppointment}
            onCreatePatient={handleCreatePatientFromAgenda}
            onOpenPatient={handleOpenAgendaPatient}
            onStartAppointment={handleStartAgendaAppointment}
            onOpenExpediente={handleOpenAgendaExpediente}
          />
        )}
        {activeTab === 'pacientes' && (
          <PatientsScreen
            activePatientId={activePatient?.id ?? null}
            patients={patients}
            onPatientsLoaded={handlePatientsLoaded}
            onPatientDeleted={(patientId) => {
              const remainingPatients = patients.filter((patient) => patient.id !== patientId);
              setPatients(remainingPatients);
              setAppointments((previous) => previous.filter((appointment) => appointment.patientId !== patientId));
              if (activePatient?.id === patientId) {
                setActivePatientId(null);
                setActiveEpisode(null);
                setActiveEpisodeId(null);
                setEpisodes([]);
                setSessions([]);
                setClinicalData(null);
              }
            }}
            episodes={episodes}
            onSelectPatient={handleSelectPatient}
            onOpenExpediente={handleOpenExpediente}
            onOpenValoracion={handleOpenValoracion}
            onCreateEpisode={handleCreateEpisode}
            onUpdateEpisode={handleUpdateEpisode}
            onDeleteEpisode={handleDeleteEpisode}
          />
        )}
        {activeTab === 'informacion' && (
          <PatientInfoScreen patient={activePatient} onUpdatePatient={handleUpdatePatient} />
        )}
        <div hidden={activeTab !== 'valoracion'}>
          <ValorationScreen
            key={valuationInstanceKey}
            equipment={equipment}
            geminiConfig={geminiConfig}
            physio={selectedPhysio}
            onDataChange={handleDataChange}
            anamnesis={anamnesis}
            onAnamnesisChange={setAnamnesis}
            region={region}
            onRegionChange={setRegion}
            previousSession={sessions.length > 0 ? sessions[sessions.length - 1] : null}
            activePatient={activePatient}
            activeEpisode={activeEpisode}
            onBackToExpediente={handleBackToExpediente}
            onEpisodeContextChange={handleEpisodeContextChange}
          />
        </div>
        {activeTab === 'expediente' && (
          <ExpedienteScreen
            sessions={sessions}
            onAddSession={handleAddSession}
            equipment={equipment}
            physio={selectedPhysio}
            activePatient={activePatient}
            activeEpisode={activeEpisode}
            episodes={episodes}
            onSelectEpisode={handleSelectEpisodeInExpediente}
            onCreateEpisode={handleCreateEpisodeInExpediente}
            onNewValoracion={handleNewValoracion}
            onUpdateEpisode={handleUpdateEpisode}
            onSaveClinicalSession={handleSaveClinicalSession}
          />
        )}
      </main>

      {/* Floating "Generar Historia Clínica" button */}
      {activeTab === 'valoracion' && (
        <button
          type="button"
          onClick={() => setReportOpen(true)}
          className="fixed bottom-6 right-6 z-30 flex h-11 items-center gap-2 rounded-full bg-gradient-to-br from-slate-700 to-slate-800 px-4 py-2 text-sm font-semibold text-white shadow-lg transition-all hover:shadow-xl hover:scale-105 active:scale-100"
        >
          <FileText className="h-4 w-4" />
          Historia Clínica
        </button>
      )}

      {/* Clinical Report Modal */}
      <ClinicalReport
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        clinicalData={clinicalData}
        geminiConfig={geminiConfig}
        physio={selectedPhysio}
        sessions={sessions}
        onSave={handleSaveReport}
      />
    </div>
  );
}
