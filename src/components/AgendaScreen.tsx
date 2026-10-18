import { useMemo, useState } from 'react';
import {
  Activity, Calendar, Check, ChevronLeft, ChevronRight, Clock, FileText,
  Pencil, Phone, Plus, Stethoscope, Trash2, User, X,
} from 'lucide-react';
import type {
  Appointment, AppointmentStatus, AppointmentType, Episode, Patient,
} from '../types';
import { Button } from './ui/Button';
import { Card, CardHeader } from './ui/Card';
import { Modal } from './ui/Modal';

interface AgendaScreenProps {
  appointments: Appointment[];
  patients: Patient[];
  episodes: Episode[];
  onSaveAppointment: (appointment: Appointment) => Promise<void>;
  onDeleteAppointment: (appointmentId: string) => void;
  onCreatePatient: (name: string, phone: string) => Promise<Patient>;
  onOpenPatient: (patientId: string) => void;
  onStartAppointment: (appointment: Appointment) => Promise<void>;
  onOpenExpediente: (appointment: Appointment) => Promise<void>;
}

type AgendaView = 'day' | 'list';
type AppointmentDraft = Omit<Appointment, 'durationMinutes'> & { durationMinutes: number };

const TYPE_LABELS: Record<AppointmentType, string> = {
  primera_valoracion: '1ª Valoración',
  seguimiento: 'Seguimiento',
  readaptacion: 'Readaptación',
  ecografia_invasiva: 'Ecografía / Invasiva',
};

const STATUS_LABELS: Record<AppointmentStatus, string> = {
  scheduled: 'Programada',
  in_progress: 'En consulta',
  completed: 'Completada',
  cancelled: 'Cancelada',
};

const TYPE_STYLES: Record<AppointmentType, string> = {
  primera_valoracion: 'border-l-blue-500',
  seguimiento: 'border-l-emerald-500',
  readaptacion: 'border-l-violet-500',
  ecografia_invasiva: 'border-l-amber-500',
};

function dateKey(date: Date): string {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return localDate.toISOString().slice(0, 10);
}

function addDays(value: string, amount: number): string {
  const date = new Date(`${value}T12:00:00`);
  date.setDate(date.getDate() + amount);
  return dateKey(date);
}

function getEndTime(startTime: string, duration: number): string {
  const [hours, minutes] = startTime.split(':').map(Number);
  const end = hours * 60 + minutes + duration;
  return `${String(Math.floor(end / 60) % 24).padStart(2, '0')}:${String(end % 60).padStart(2, '0')}`;
}

function timeToMinutes(value: string): number {
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
}

function appointmentDuration(start: string, end: string): number {
  return Math.max(0, timeToMinutes(end) - timeToMinutes(start));
}

function emptyDraft(date: string, startTime = '09:00'): AppointmentDraft {
  return {
    id: '',
    patientId: '',
    episodeId: '',
    date,
    startTime,
    endTime: getEndTime(startTime, 60),
    durationMinutes: 60,
    type: 'seguimiento',
    status: 'scheduled',
    notes: '',
  };
}

function formatSelectedDate(value: string): string {
  return new Intl.DateTimeFormat('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(`${value}T12:00:00`));
}

export function AgendaScreen({
  appointments, patients, episodes, onSaveAppointment, onDeleteAppointment,
  onCreatePatient, onOpenPatient, onStartAppointment, onOpenExpediente,
}: AgendaScreenProps) {
  const [selectedDate, setSelectedDate] = useState(() => dateKey(new Date()));
  const [view, setView] = useState<AgendaView>('day');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<AppointmentDraft>(() => emptyDraft(dateKey(new Date())));
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [patientSearch, setPatientSearch] = useState('');
  const [creatingPatient, setCreatingPatient] = useState(false);
  const [newPatientName, setNewPatientName] = useState('');
  const [newPatientPhone, setNewPatientPhone] = useState('');

  const dayAppointments = useMemo(() => appointments
    .filter((appointment) => appointment.date === selectedDate)
    .sort((a, b) => a.startTime.localeCompare(b.startTime)), [appointments, selectedDate]);
  const pendingCount = dayAppointments.filter((appointment) => appointment.status === 'scheduled').length;
  const completedCount = dayAppointments.filter((appointment) => appointment.status === 'completed').length;
  const selectedPatient = patients.find((patient) => patient.id === draft.patientId);
  const patientEpisodes = episodes.filter((episode) =>
    episode.patientId === draft.patientId && episode.status === 'active',
  );
  const searchedPatients = patients.filter((patient) =>
    `${patient.name} ${patient.phone ?? ''}`.toLowerCase().includes(patientSearch.toLowerCase()),
  );
  const overlaps = appointments.find((appointment) => {
    if (appointment.id === editingId || appointment.date !== draft.date || appointment.status === 'cancelled') return false;
    return timeToMinutes(draft.startTime) < timeToMinutes(appointment.endTime) &&
      timeToMinutes(draft.endTime) > timeToMinutes(appointment.startTime);
  });

  const openNewAppointment = (startTime = '09:00') => {
    setEditingId(null);
    setDraft(emptyDraft(selectedDate, startTime));
    setPatientSearch('');
    setCreatingPatient(false);
    setFormError(null);
    setModalOpen(true);
  };

  const openEditAppointment = (appointment: Appointment) => {
    setEditingId(appointment.id);
    setDraft({
      ...appointment,
      episodeId: appointment.episodeId ?? '',
      durationMinutes: appointment.durationMinutes || appointmentDuration(appointment.startTime, appointment.endTime),
    });
    setPatientSearch('');
    setCreatingPatient(false);
    setFormError(null);
    setModalOpen(true);
  };

  const updateStatus = (appointment: Appointment, status: AppointmentStatus) => {
    void onSaveAppointment({ ...appointment, status });
  };

  const saveDraft = async () => {
    setFormError(null);
    if (!draft.patientId) {
      setFormError('Selecciona un paciente o crea uno nuevo.');
      return;
    }
    if (!draft.date || !draft.startTime || !draft.endTime || timeToMinutes(draft.endTime) <= timeToMinutes(draft.startTime)) {
      setFormError('Revisa la fecha y el horario: la hora de fin debe ser posterior a la de inicio.');
      return;
    }
    setSaving(true);
    try {
      await onSaveAppointment({
        ...draft,
        id: editingId ?? crypto.randomUUID(),
        episodeId: draft.episodeId || undefined,
        durationMinutes: appointmentDuration(draft.startTime, draft.endTime),
      });
      setModalOpen(false);
    } catch (error) {
      console.error('No se pudo guardar la cita:', error);
      setFormError(error instanceof Error ? error.message : 'No se pudo guardar la cita.');
    } finally {
      setSaving(false);
    }
  };

  const createPatientForAppointment = async () => {
    setFormError(null);
    if (!newPatientName.trim()) {
      setFormError('Escribe el nombre y los apellidos del paciente.');
      return;
    }
    setSaving(true);
    try {
      const patient = await onCreatePatient(newPatientName.trim(), newPatientPhone.trim());
      setDraft((current) => ({ ...current, patientId: patient.id, episodeId: '' }));
      setPatientSearch(patient.name);
      setCreatingPatient(false);
      setNewPatientName('');
      setNewPatientPhone('');
    } catch (error) {
      console.error('No se pudo crear el paciente desde la agenda:', error);
      setFormError(error instanceof Error ? error.message : 'No se pudo crear el paciente.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-[1440px] px-4 py-6 lg:px-6">
      <Card className="mb-5 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setSelectedDate((date) => addDays(date, -1))}>
                <ChevronLeft className="h-4 w-4" /> Día anterior
              </Button>
              <Button variant="outline" size="sm" onClick={() => setSelectedDate(dateKey(new Date()))}>Hoy</Button>
              <Button variant="outline" size="sm" onClick={() => setSelectedDate((date) => addDays(date, 1))}>
                Día siguiente <ChevronRight className="h-4 w-4" />
              </Button>
              <input
                aria-label="Seleccionar fecha de agenda"
                type="date"
                value={selectedDate}
                onChange={(event) => setSelectedDate(event.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
              />
            </div>
            <h1 className="mt-4 text-xl font-bold capitalize text-slate-900">{formatSelectedDate(selectedDate)}</h1>
            <div className="mt-3 flex flex-wrap gap-2">
              <SummaryPill label={`Total citas: ${dayAppointments.length}`} />
              <SummaryPill label={`Pendientes: ${pendingCount}`} />
              <SummaryPill label={`Completadas: ${completedCount}`} />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex rounded-xl border border-slate-200 bg-slate-50 p-1">
              <button
                type="button"
                onClick={() => setView('day')}
                className={`rounded-lg px-3 py-2 text-sm font-medium ${view === 'day' ? 'bg-white text-primary-700 shadow-sm' : 'text-slate-500'}`}
              >Vista Día (Por horas)</button>
              <button
                type="button"
                onClick={() => setView('list')}
                className={`rounded-lg px-3 py-2 text-sm font-medium ${view === 'list' ? 'bg-white text-primary-700 shadow-sm' : 'text-slate-500'}`}
              >Vista Lista / Resumen</button>
            </div>
            <Button onClick={() => openNewAppointment()}>
              <Plus className="h-4 w-4" /> Nueva Cita
            </Button>
          </div>
        </div>
      </Card>

      {view === 'day' ? (
        <Card>
          <CardHeader title="Agenda del día" description="Horario de atención · 08:00–21:00" icon={<Calendar className="h-5 w-5" />} />
          <div className="divide-y divide-slate-100 px-5">
            {Array.from({ length: 13 }, (_, index) => index + 8).map((hour) => {
              const startTime = `${String(hour).padStart(2, '0')}:00`;
              const slotAppointments = dayAppointments.filter((appointment) => Number(appointment.startTime.slice(0, 2)) === hour);
              const isOccupied = dayAppointments.some((appointment) =>
                appointment.status !== 'cancelled' &&
                timeToMinutes(appointment.startTime) < (hour + 1) * 60 &&
                timeToMinutes(appointment.endTime) > hour * 60,
              );
              return (
                <div key={hour} className="group grid min-h-[84px] grid-cols-[72px_1fr] gap-3 py-3">
                  <div className="pt-2 text-sm font-semibold tabular-nums text-slate-500">{startTime}</div>
                  <div className="space-y-2">
                    {slotAppointments.map((appointment) => {
                      const patient = patients.find((item) => item.id === appointment.patientId);
                      const episode = episodes.find((item) => item.id === appointment.episodeId);
                      return (
                        <AppointmentCard
                          key={appointment.id}
                          appointment={appointment}
                          patient={patient}
                          episode={episode}
                          onOpenPatient={() => onOpenPatient(appointment.patientId)}
                          onStart={() => void onStartAppointment(appointment)}
                          onOpenExpediente={() => void onOpenExpediente(appointment)}
                          onEdit={() => openEditAppointment(appointment)}
                          onDelete={() => {
                            if (window.confirm('¿Eliminar esta cita de la agenda?')) onDeleteAppointment(appointment.id);
                          }}
                          onComplete={() => updateStatus(appointment, 'completed')}
                          onCancel={() => updateStatus(appointment, 'cancelled')}
                        />
                      );
                    })}
                    {!isOccupied && (
                      <button
                        type="button"
                        onClick={() => openNewAppointment(startTime)}
                        className="flex h-14 w-full items-center rounded-lg border border-dashed border-transparent px-3 text-left text-sm text-transparent transition-colors hover:border-primary-200 hover:bg-primary-50/60 hover:text-primary-700 focus-visible:border-primary-300 focus-visible:text-primary-700"
                      >
                        <Plus className="mr-1 h-4 w-4" /> Agendar a las {startTime}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      ) : (
        <Card>
          <CardHeader title="Resumen de citas" description={`${dayAppointments.length} cita(s) para esta fecha`} icon={<Activity className="h-5 w-5" />} />
          <div className="space-y-3 p-5">
            {dayAppointments.length === 0 && <p className="py-8 text-center text-sm text-slate-400">No hay citas para este día.</p>}
            {dayAppointments.map((appointment) => (
              <AppointmentCard
                key={appointment.id}
                appointment={appointment}
                patient={patients.find((item) => item.id === appointment.patientId)}
                episode={episodes.find((item) => item.id === appointment.episodeId)}
                onOpenPatient={() => onOpenPatient(appointment.patientId)}
                onStart={() => void onStartAppointment(appointment)}
                onOpenExpediente={() => void onOpenExpediente(appointment)}
                onEdit={() => openEditAppointment(appointment)}
                onDelete={() => {
                  if (window.confirm('¿Eliminar esta cita de la agenda?')) onDeleteAppointment(appointment.id);
                }}
                onComplete={() => updateStatus(appointment, 'completed')}
                onCancel={() => updateStatus(appointment, 'cancelled')}
              />
            ))}
          </div>
        </Card>
      )}

      <Modal
        open={modalOpen}
        onClose={() => !saving && setModalOpen(false)}
        title={editingId ? 'Editar cita' : 'Nueva cita'}
        subtitle="Vincula la cita con un paciente y, si corresponde, con su episodio clínico."
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setModalOpen(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={() => void saveDraft()} disabled={saving}>{saving ? 'Guardando…' : 'Guardar cita'}</Button>
          </>
        }
      >
        <div className="space-y-5">
          {formError && <p role="alert" className="rounded-lg border border-error-200 bg-error-50 p-3 text-sm text-error-700">{formError}</p>}
          <section className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <label className="text-sm font-semibold text-slate-700">Paciente</label>
              <button type="button" onClick={() => { setCreatingPatient((value) => !value); setFormError(null); }} className="text-sm font-semibold text-primary-700 hover:underline">
                {creatingPatient ? 'Elegir existente' : '+ Crear paciente nuevo al vuelo'}
              </button>
            </div>
            {creatingPatient ? (
              <div className="grid gap-3 rounded-xl border border-primary-100 bg-primary-50/50 p-4 sm:grid-cols-2">
                <input value={newPatientName} onChange={(event) => setNewPatientName(event.target.value)} placeholder="Nombre y apellidos" className="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
                <input value={newPatientPhone} onChange={(event) => setNewPatientPhone(event.target.value)} placeholder="Teléfono" className="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
                <Button size="sm" onClick={() => void createPatientForAppointment()} disabled={saving}><Plus className="h-4 w-4" /> Crear y asignar</Button>
              </div>
            ) : (
              <>
                <input value={patientSearch} onChange={(event) => setPatientSearch(event.target.value)} placeholder="Buscar paciente por nombre o teléfono…" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
                <select
                  value={draft.patientId}
                  onChange={(event) => setDraft((current) => ({ ...current, patientId: event.target.value, episodeId: '' }))}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                >
                  <option value="">Seleccionar paciente</option>
                  {searchedPatients.map((patient) => <option key={patient.id} value={patient.id}>{patient.name}{patient.phone ? ` · ${patient.phone}` : ''}</option>)}
                </select>
              </>
            )}
            {selectedPatient && <p className="text-xs text-slate-500">Paciente seleccionado: <strong>{selectedPatient.name}</strong></p>}
            {patientEpisodes.length > 0 && (
              <label className="block space-y-1 text-sm text-slate-600">
                Episodio asociado
                <select value={draft.episodeId} onChange={(event) => setDraft((current) => ({ ...current, episodeId: event.target.value }))} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2">
                  <option value="">Nuevo episodio / Sin especificar</option>
                  {patientEpisodes.map((episode) => <option key={episode.id} value={episode.id}>{episode.title || episode.region || 'Episodio sin título'}</option>)}
                </select>
              </label>
            )}
          </section>

          <section className="grid gap-3 sm:grid-cols-3">
            <label className="space-y-1 text-sm text-slate-600">Fecha
              <input type="date" value={draft.date} onChange={(event) => setDraft((current) => ({ ...current, date: event.target.value }))} className="w-full rounded-lg border border-slate-200 px-3 py-2" />
            </label>
            <label className="space-y-1 text-sm text-slate-600">Hora de inicio
              <input type="time" value={draft.startTime} onChange={(event) => setDraft((current) => ({ ...current, startTime: event.target.value, endTime: getEndTime(event.target.value, current.durationMinutes) }))} className="w-full rounded-lg border border-slate-200 px-3 py-2" />
            </label>
            <label className="space-y-1 text-sm text-slate-600">Hora de fin
              <input type="time" value={draft.endTime} onChange={(event) => setDraft((current) => ({ ...current, endTime: event.target.value, durationMinutes: appointmentDuration(current.startTime, event.target.value) }))} className="w-full rounded-lg border border-slate-200 px-3 py-2" />
            </label>
          </section>
          <section>
            <p className="mb-2 text-sm font-semibold text-slate-700">Duración de sesión</p>
            <div className="flex flex-wrap gap-2">
              {[30, 45, 60, 90].map((minutes) => (
                <button key={minutes} type="button" onClick={() => setDraft((current) => ({ ...current, durationMinutes: minutes, endTime: getEndTime(current.startTime, minutes) }))} className={`rounded-full border px-3 py-1.5 text-sm ${draft.durationMinutes === minutes ? 'border-primary-300 bg-primary-50 font-semibold text-primary-700' : 'border-slate-200 text-slate-600'}`}>
                  {minutes} min
                </button>
              ))}
            </div>
          </section>
          <section>
            <p className="mb-2 text-sm font-semibold text-slate-700">Tipo de cita</p>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(TYPE_LABELS) as AppointmentType[]).map((type) => (
                <button key={type} type="button" onClick={() => setDraft((current) => ({ ...current, type }))} className={`rounded-full border px-3 py-1.5 text-sm ${draft.type === type ? 'border-primary-300 bg-primary-50 font-semibold text-primary-700' : 'border-slate-200 text-slate-600'}`}>
                  {TYPE_LABELS[type]}
                </button>
              ))}
            </div>
          </section>
          <label className="block space-y-1 text-sm text-slate-600">Notas de la cita
            <textarea value={draft.notes ?? ''} onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))} rows={3} placeholder="Ej. Viene con resonancia reciente" className="w-full rounded-lg border border-slate-200 px-3 py-2" />
          </label>
          {overlaps && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              ⚠️ Atención: Ya tienes a {patients.find((patient) => patient.id === overlaps.patientId)?.name ?? 'otro paciente'} agendado en este horario. Puedes guardar la cita o cambiar la hora.
            </p>
          )}
        </div>
      </Modal>
    </div>
  );
}

function SummaryPill({ label }: { label: string }) {
  return <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600">{label}</span>;
}

function AppointmentCard({
  appointment, patient, episode, onOpenPatient, onStart, onOpenExpediente, onEdit,
  onDelete, onComplete, onCancel,
}: {
  appointment: Appointment;
  patient?: Patient;
  episode?: Episode;
  onOpenPatient: () => void;
  onStart: () => void;
  onOpenExpediente: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onComplete: () => void;
  onCancel: () => void;
}) {
  const isCancelled = appointment.status === 'cancelled';
  return (
    <article className={`rounded-xl border border-slate-200 border-l-4 bg-white p-4 shadow-sm ${isCancelled ? 'border-l-slate-300 opacity-60' : TYPE_STYLES[appointment.type]}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className={`flex items-center gap-1.5 text-xs font-semibold tabular-nums ${isCancelled ? 'text-slate-400 line-through' : 'text-slate-500'}`}>
            <Clock className="h-3.5 w-3.5" /> {appointment.startTime} - {appointment.endTime} · {appointment.durationMinutes} min
          </p>
          <button type="button" onClick={onOpenPatient} className="mt-1 text-left text-base font-bold text-slate-800 hover:text-primary-700">
            {patient?.name ?? 'Paciente no disponible'}
          </button>
          {patient?.phone && <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500"><Phone className="h-3 w-3" />{patient.phone}</p>}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-primary-50 px-2.5 py-1 text-xs font-semibold text-primary-700">{TYPE_LABELS[appointment.type]}</span>
            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${appointment.status === 'completed' ? 'bg-emerald-50 text-emerald-700' : appointment.status === 'in_progress' ? 'bg-blue-50 text-blue-700' : appointment.status === 'cancelled' ? 'bg-slate-100 text-slate-500' : 'bg-amber-50 text-amber-700'}`}>
              {STATUS_LABELS[appointment.status]}
            </span>
            {episode && <span className="inline-flex items-center gap-1 text-xs text-slate-500"><FileText className="h-3 w-3" />{episode.title || episode.region}</span>}
          </div>
          {appointment.notes && <p className="mt-2 text-sm text-slate-600">{appointment.notes}</p>}
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Button variant="outline" size="sm" onClick={onOpenPatient}><User className="h-3.5 w-3.5" /> Ver en Pacientes</Button>
          <Button size="sm" onClick={onStart} disabled={isCancelled || appointment.status === 'completed'}><Stethoscope className="h-3.5 w-3.5" /> Valorar / Seguimiento</Button>
          <Button variant="outline" size="sm" onClick={onOpenExpediente}><FileText className="h-3.5 w-3.5" /> Expediente</Button>
          {appointment.status !== 'completed' && appointment.status !== 'cancelled' && (
            <>
              <Button variant="outline" size="sm" onClick={onComplete}><Check className="h-3.5 w-3.5" /> Completada</Button>
              <Button variant="outline" size="sm" onClick={onCancel}><X className="h-3.5 w-3.5" /> Cancelar</Button>
            </>
          )}
          <Button variant="ghost" size="sm" onClick={onEdit}><Pencil className="h-3.5 w-3.5" /> Editar</Button>
          <Button variant="ghost" size="sm" onClick={onDelete}><Trash2 className="h-3.5 w-3.5" /> Eliminar</Button>
        </div>
      </div>
    </article>
  );
}
