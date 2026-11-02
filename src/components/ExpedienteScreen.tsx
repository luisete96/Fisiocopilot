import { useState, useRef, useEffect } from 'react';
import {
  Calendar, Plus, User, TrendingUp, Activity,
  ClipboardList, ChevronDown, FileText,
  Copy, Printer, X, Stethoscope, AlertTriangle, Target,
  ClipboardCheck, Lightbulb, FolderPlus, Folder, Pencil, Save, Loader2,
} from 'lucide-react';
import {
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, ComposedChart, Line,
} from 'recharts';
import type { SessionEntry, EquipmentKey, Patient, Episode, ClinicalSessionData, ClinicalReportResult, GeminiConfig } from '../types';
import { EQUIPMENT, BODY_REGIONS } from '../mockData';
import { callGemini } from '../geminiService';
import { Card, CardHeader } from './ui/Card';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { Modal } from './ui/Modal';
import { EpisodeStatusControl } from './EpisodeStatusControl';
import { isEpisodeActive, normalizeText } from '../patientUtils';

interface ExpedienteScreenProps {
  sessions: SessionEntry[];
  onAddSession: (session: SessionEntry) => void;
  equipment: Record<EquipmentKey, boolean>;
  physio: string;
  geminiConfig: GeminiConfig;
  activePatient?: Patient | null;
  activeEpisode?: Episode | null;
  episodes?: Episode[];
  onSelectEpisode?: (episodeId: string) => void;
  onCreateEpisode?: () => Promise<void>;
  onNewValoracion?: () => void;
  onUpdateEpisode?: (patientId: string, updatedEpisode: Episode) => Promise<void>;
  onSaveClinicalSession?: (sessionId: string, clinicalData: ClinicalSessionData, techniquesSummary: string) => Promise<void>;
}

export function ExpedienteScreen({ sessions = [], onAddSession, equipment, physio, geminiConfig, activePatient, activeEpisode, episodes = [], onSelectEpisode, onCreateEpisode, onNewValoracion, onUpdateEpisode, onSaveClinicalSession }: ExpedienteScreenProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [reportSession, setReportSession] = useState<SessionEntry | null>(null);
  const [episodeCreateError, setEpisodeCreateError] = useState<string | null>(null);
  const [officialReportOpen, setOfficialReportOpen] = useState(false);

  const startNewEpisode = async () => {
    setEpisodeCreateError(null);
    try {
      await onCreateEpisode?.();
    } catch (error) {
      console.error('No se pudo crear el episodio:', error);
      setEpisodeCreateError(error instanceof Error ? error.message : 'No se pudo crear el episodio.');
    }
  };

  const chronologicalSessions = [...sessions].sort((a, b) => a.date.localeCompare(b.date));
  const latestComparableSession = [...chronologicalSessions].reverse().find((session) =>
    Boolean(session.clinicalData?.comparable?.parameter),
  ) ?? chronologicalSessions[chronologicalSessions.length - 1];
  const activeParameter = getSessionParameter(latestComparableSession);
  const activeForceMode = activeParameter === 'force'
    ? latestComparableSession?.clinicalData?.comparable?.forceMode
    : null;
  const chartSessions = chronologicalSessions.filter((session) =>
    getSessionParameter(session) === activeParameter
    && (activeParameter !== 'force' || session.clinicalData?.comparable?.forceMode === activeForceMode),
  );
  const chartData = chartSessions.map((session) => getChartValues(session, activeParameter));
  const firstSessionValues = chartData[0];
  const lastSessionValues = chartData[chartData.length - 1];
  const startValue = firstSessionValues?.pre ?? firstSessionValues?.post ?? 0;
  const endValue = lastSessionValues?.post ?? lastSessionValues?.pre ?? 0;
  const hasNumericChartData = chartData.some((point) => point.pre !== null || point.post !== null);
  const globalImprovement = chartData.length > 1 && startValue !== 0
    ? Math.round((activeParameter === 'eva'
      ? (startValue - endValue) / startValue
      : (endValue - startValue) / startValue) * 100)
    : 0;
  const lastEva = sessions[sessions.length - 1]?.clinicalData?.comparable?.evaCurrent
    ?? sessions[sessions.length - 1]?.clinicalData?.comparable?.eva
    ?? sessions[sessions.length - 1]?.eva
    ?? 0;
  const sortedEpisodes = [...episodes].sort((a, b) => {
    const activeDifference = Number(isEpisodeActive(b)) - Number(isEpisodeActive(a));
    if (activeDifference !== 0) return activeDifference;
    return getLatestEpisodeActivity(b, sessions) - getLatestEpisodeActivity(a, sessions);
  });
  const activeEpisodes = sortedEpisodes.filter(isEpisodeActive);
  const closedEpisodes = sortedEpisodes.filter((episode) => !isEpisodeActive(episode));

  const renderEpisode = (ep: Episode, isActive: boolean) => {
    const firstSessionRegion = [...sessions]
      .filter((session) => session.episodeId === ep.id)
      .sort((a, b) => a.date.localeCompare(b.date))
      .find((session) => session.clinicalData?.region)?.clinicalData?.region;
    const regionLabel = BODY_REGIONS.find((item) => item.key === ep.region)?.label ?? ep.region;
    const isPlaceholderTitle = /^(nueva valoración|nuevo episodio)$/i.test(ep.title.trim());
    const displayTitle = isPlaceholderTitle ? firstSessionRegion || regionLabel || ep.title : ep.title;
    return (
      <div
        key={ep.id}
        className={`flex flex-wrap items-center gap-1 rounded-lg border p-1 ${
          isActive ? 'border-success-200 bg-white' : 'border-slate-200 bg-slate-50'
        }`}
      >
        <button
          type="button"
          onClick={() => onSelectEpisode?.(ep.id)}
          className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium transition-all ${
            activeEpisode?.id === ep.id
              ? 'bg-primary-600 text-white'
              : isActive ? 'text-slate-700 hover:bg-success-50' : 'text-slate-500 hover:bg-slate-100'
          }`}
        >
          {displayTitle}
          {regionLabel && normalizeText(displayTitle) !== normalizeText(regionLabel) && (
            <span className={`rounded px-1.5 py-0.5 text-[10px] ${
              activeEpisode?.id === ep.id ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-400'
            }`}>
              {regionLabel}
            </span>
          )}
        </button>
        {isActive && <Badge variant="success">Activo</Badge>}
        {onUpdateEpisode && <EpisodeStatusControl episode={ep} onUpdate={onUpdateEpisode} />}
      </div>
    );
  };

  return (
    <div className="mx-auto max-w-[1400px] space-y-6 px-4 py-6 lg:px-6">
      {/* Patient header + episode selector */}
      {activePatient && (
        <div className="rounded-2xl border border-primary-200 bg-gradient-to-r from-primary-50 to-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-600 text-white">
                <ClipboardList className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-800">{activePatient.name}</h2>
                {activePatient.birthDate && (
                  <p className="text-xs text-slate-500">
                    Nacimiento: {formatDate(activePatient.birthDate)}
                  </p>
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={onNewValoracion}>
                <Plus className="h-4 w-4" /> {sessions.length > 0 ? 'Nueva Sesión / Seguimiento' : 'Nueva Valoración'}
              </Button>
              <Button size="sm" variant="outline" onClick={() => void startNewEpisode()}>
                <FolderPlus className="h-4 w-4" /> + Nuevo Episodio
              </Button>
            </div>
          </div>

          {/* Episode selector */}
          {episodes.length > 0 && onSelectEpisode && (
            <div className="mt-4 space-y-4 border-t border-primary-100 pt-3">
              <section aria-labelledby="active-episodes-heading">
                <h3 id="active-episodes-heading" className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-success-700">
                  <Folder className="h-3.5 w-3.5" /> Episodios en Curso (Activos)
                </h3>
                <div className="flex flex-wrap items-center gap-2">
                  {activeEpisodes.length > 0
                    ? activeEpisodes.map((episode) => renderEpisode(episode, true))
                    : <p className="text-xs text-slate-400">No hay episodios activos.</p>}
                </div>
              </section>
              {closedEpisodes.length > 0 && (
                <section aria-labelledby="closed-episodes-heading" className="border-t border-slate-200 pt-3">
                  <h3 id="closed-episodes-heading" className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <Folder className="h-3.5 w-3.5" /> Historial de Episodios Finalizados (Alta Clínica)
                  </h3>
                  <div className="flex flex-wrap items-center gap-2">
                    {closedEpisodes.map((episode) => renderEpisode(episode, false))}
                  </div>
                </section>
              )}
              {onCreateEpisode && <Button size="sm" variant="outline" onClick={() => void startNewEpisode()}><FolderPlus className="h-3.5 w-3.5" /> + Nuevo Episodio</Button>}
            </div>
          )}
          {episodes.length === 0 && onCreateEpisode && (
            <div className="mt-4 flex items-center gap-2 border-t border-primary-100 pt-3">
              <p className="text-xs text-slate-400">Sin episodios.</p>
            </div>
          )}
          {episodeCreateError && <p role="alert" className="mt-2 text-xs text-error-600">{episodeCreateError}</p>}
        </div>
      )}

      {/* Empty state — no patient */}
      {!activePatient && (
        <Card className="p-12 text-center">
          <ClipboardList className="mx-auto mb-4 h-12 w-12 text-slate-300" />
          <p className="text-sm text-slate-400">Selecciona un paciente desde la pestaña Pacientes para ver su expediente.</p>
        </Card>
      )}

      {/* Empty state — patient with no sessions */}
      {activePatient && sessions.length === 0 && (
        <Card className="p-8 text-center">
          <Activity className="mx-auto mb-3 h-10 w-10 text-slate-300" />
          <p className="text-sm text-slate-500">Este episodio aún no tiene sesiones registradas.</p>
          <p className="mt-1 text-xs text-slate-400">Pulsa “Nueva Valoración” para iniciar la primera valoración clínica.</p>
        </Card>
      )}

      {sessions.length > 0 && (
        <>
          {/* Summary header */}
          <div className="grid gap-4 sm:grid-cols-3">
            <StatBox
              icon={<Activity className="h-5 w-5" />}
              label="Sesiones registradas"
              value={`${sessions.length}`}
              color="primary"
            />
            <StatBox
              icon={<TrendingUp className="h-5 w-5" />}
              label={activeParameter === 'eva' ? 'Mejoría global (EVA)' : 'Cambio del parámetro'}
              value={activeParameter === 'paresthesias'
                ? 'Cualitativo'
                : hasNumericChartData ? `${globalImprovement}%` : 'Sin datos'}
              color="success"
            />
            <StatBox
              icon={<Calendar className="h-5 w-5" />}
              label="Última sesión"
              value={sessions[sessions.length - 1] ? formatDate(sessions[sessions.length - 1].date) : '—'}
              color="secondary"
            />
          </div>

          {/* Evolution Chart */}
          <Card>
            <CardHeader
              title={getChartTitle(activeParameter)}
              description={activeParameter === 'paresthesias'
                ? 'Evolución cualitativa del signo comparable'
                : 'Gráfica de la evolución del signo comparable por sesión'}
              icon={<TrendingUp className="h-5 w-5" />}
              action={
                <Button size="sm" onClick={() => setModalOpen(true)}>
                  <Plus className="h-4 w-4" /> Añadir Sesión Manual
                </Button>
              }
            />
            <div className="p-5">
              {activeParameter === 'paresthesias' ? (
                <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-5 text-sm text-amber-900">
                  Parámetro cualitativo (Aparición de parestesias) — Consultar evolución detallada en la línea de tiempo
                </p>
              ) : (
                <>
              <div className="mb-4 flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-primary-600" />
                  <span className="text-xs text-slate-600">{getChartSeriesLabel(activeParameter)} inicial</span>
                </div>
                {chartData.some((point) => point.post !== null) && (
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-emerald-500" />
                    <span className="text-xs text-slate-600">{getChartSeriesLabel(activeParameter)} final</span>
                  </div>
                )}
                {chartData.length > 1 && hasNumericChartData && (
                  <Badge variant="success">
                    Cambio: {formatMetricValue(startValue, activeParameter, activeForceMode)} → {formatMetricValue(endValue, activeParameter, activeForceMode)}
                  </Badge>
                )}
              </div>
              {!hasNumericChartData ? (
                <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                  No hay mediciones numéricas registradas para este parámetro.
                </p>
              ) : (
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartData} margin={{ top: 10, right: 10, bottom: 0, left: -10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 12, fill: '#64748b' }}
                      axisLine={{ stroke: '#cbd5e1' }}
                    />
                    <YAxis
                      yAxisId="left"
                      domain={activeParameter === 'rom' ? [0, 180] : activeParameter === 'eva' ? [0, 10] : activeForceMode === 'daniels' ? [0, 5] : ['auto', 'auto']}
                      tick={{ fontSize: 12, fill: '#64748b' }}
                      axisLine={{ stroke: '#cbd5e1' }}
                      label={{
                        value: getYAxisLabel(activeParameter, activeForceMode),
                        angle: -90,
                        position: 'insideLeft',
                        style: { fontSize: 11, fill: '#94a3b8' },
                      }}
                    />
                    <Tooltip
                      formatter={(value, name) => [
                        typeof value === 'number' ? formatMetricValue(value, activeParameter, activeForceMode) : 'Sin registro',
                        String(name),
                      ]}
                      contentStyle={{
                        borderRadius: '12px',
                        border: '1px solid #e2e8f0',
                        fontSize: '13px',
                      }}
                      labelStyle={{ fontWeight: 600, color: '#1e293b' }}
                    />
                    <ReferenceLine y={0} yAxisId="left" stroke="#cbd5e1" />
                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey="pre"
                      stroke="#4f46e5"
                      strokeWidth={2.5}
                      dot={{ r: 5, fill: '#4f46e5' }}
                      activeDot={{ r: 7 }}
                      name={`${getChartSeriesLabel(activeParameter)} inicial`}
                    />
                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey="post"
                      stroke="#10b981"
                      strokeWidth={2.5}
                      dot={{ r: 5, fill: '#10b981' }}
                      activeDot={{ r: 7 }}
                      connectNulls={false}
                      name={`${getChartSeriesLabel(activeParameter)} final`}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              )}
                </>
              )}
            </div>
          </Card>

          {/* Timeline */}
          <Card>
            <CardHeader
              title="Línea de Tiempo de Sesiones (Evolutivos)"
              description="Historial cronológico — clic en la tarjeta para desplegar detalles"
              icon={<ClipboardList className="h-5 w-5" />}
              action={
                <Button
                  size="sm"
                  onClick={() => setOfficialReportOpen(true)}
                  className="bg-emerald-600 text-white hover:bg-emerald-700"
                >
                  <FileText className="h-4 w-4" /> Generar Informe Clínico
                </Button>
              }
            />
            <div className="p-5">
              <div className="relative space-y-5 before:absolute before:left-[19px] before:top-2 before:h-[calc(100%-1rem)] before:w-0.5 before:bg-slate-200">
                {[...sessions].reverse().map((session) => (
                  <SessionTimelineEntry
                    key={session.id}
                    session={session}
                    onViewReport={() => setReportSession(session)}
                  />
                ))}
              </div>
            </div>
          </Card>
        </>
      )}

      {/* Add Session Modal */}
      <AddSessionModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onAdd={onAddSession}
        equipment={equipment}
        physio={physio}
        lastEva={lastEva}
      />

      {/* Full Clinical Report Modal */}
      <FullReportModal
        session={reportSession}
        onClose={() => setReportSession(null)}
        onSave={onSaveClinicalSession}
      />
      <OfficialReportModal
        open={officialReportOpen}
        onClose={() => setOfficialReportOpen(false)}
        sessions={sessions}
        patient={activePatient ?? null}
        episode={activeEpisode ?? null}
        physio={physio}
        geminiConfig={geminiConfig}
      />
    </div>
  );
}

function SessionTimelineEntry({
  session,
  onViewReport,
}: {
  session: SessionEntry;
  onViewReport: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const cd = session.clinicalData;
  const displayTreatment = session.treatmentSummary
    || session.techniquesSummary
    || session.shortTreatment
    || session.manualTreatment
    || session.treatmentPlan
    || cd?.techniquesSummary
    || cd?.report?.treatmentPlan
    || cd?.manualTreatmentPlan
    || cd?.aiTreatment;
  const sessionParameter = getSessionParameter(session);
  const metricBadge = getSessionMetricBadge(session, sessionParameter);

  return (
    <div className="relative flex gap-4 pl-0">
      {/* Dot */}
      <div className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-600 text-white ring-4 ring-white">
        <Calendar className="h-4 w-4" />
      </div>
      {/* Content */}
      <div className="flex-1 rounded-xl border border-slate-200 bg-white shadow-card transition-shadow hover:shadow-card-hover">
        {/* Clickable header area */}
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="w-full p-4 text-left"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-slate-800">
                {formatDate(session.date)}
              </span>
              <Badge variant="default">
                <User className="h-3 w-3" /> {session.physio}
              </Badge>
              <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${expanded ? 'rotate-180' : ''}`} />
            </div>
            <div className="flex items-center gap-2">
              {metricBadge}
              {sessionParameter === 'eva' && session.improvement > 0 && (
                <div className="flex items-center gap-1.5 rounded-lg bg-success-50 px-3 py-1">
                  <TrendingUp className="h-3.5 w-3.5 text-success-600" />
                  <span className="text-sm font-bold text-success-700">+{session.improvement}%</span>
                </div>
              )}
            </div>
          </div>
          {displayTreatment && (
            <div className="mt-2.5 flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50/60 px-3 py-2">
              <Activity className="h-3.5 w-3.5 shrink-0 text-blue-600" />
              <span className="whitespace-pre-wrap text-left text-xs font-semibold text-blue-800">{displayTreatment}</span>
            </div>
          )}
        </button>

        {/* Expanded details */}
        {expanded && (
          <div className="border-t border-slate-100 px-4 pb-4 pt-3">
            <p className="text-sm text-slate-600">{session.summary}</p>

            {/* Techniques chips */}
            {session.techniques.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {(session.techniques ?? []).map((tech, i) => (
                  <span
                    key={i}
                    className="rounded-lg bg-secondary-50 px-2.5 py-1 text-xs font-medium text-secondary-700"
                  >
                    {tech}
                  </span>
                ))}
              </div>
            )}

            {/* Retest */}
            <div className="mt-3 flex items-start gap-2 rounded-lg border border-primary-100 bg-primary-50/50 p-3">
              <Target className="mt-0.5 h-4 w-4 shrink-0 text-primary-600" />
              <div>
                <p className="text-xs font-semibold text-primary-700">Re-test del Signo Asterisco</p>
                <p className="mt-0.5 text-xs text-slate-600">{session.retest}</p>
                {cd?.comparable?.movement && (
                  <p className="mt-1 text-xs text-slate-500">
                    Gesto: {cd.comparable.movement} — Parámetro: {cd.comparable.parameter}
                  </p>
                )}
              </div>
            </div>

            {/* Evolution data (follow-up) */}
            {cd?.anamnesis && (
              <div className="mt-3 rounded-lg border border-slate-100 bg-slate-50 p-3">
                <p className="text-xs font-semibold text-slate-600">Anamnesis</p>
                <p className="mt-1 text-xs text-slate-500">
                  {cd.anamnesis.que || '—'} · {cd.anamnesis.porque || '—'} · {cd.anamnesis.desde || '—'}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Action bar — always visible */}
        <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-4 py-2.5">
          <Button size="sm" variant="outline" onClick={onViewReport}>
            <FileText className="h-3.5 w-3.5" /> Ver Historia Completa
          </Button>
        </div>
      </div>
    </div>
  );
}

function getLatestEpisodeActivity(episode: Episode, sessions: SessionEntry[]): number {
  const activityDates = [
    episode.createdAt,
    episode.updatedAt,
    episode.latestSessionAt,
    ...sessions
      .filter((session) => session.episodeId === episode.id)
      .map((session) => session.date),
  ];
  return activityDates.reduce((latest, value) => {
    if (!value) return latest;
    const timestamp = new Date(value).getTime();
    return Number.isNaN(timestamp) ? latest : Math.max(latest, timestamp);
  }, 0);
}

type SessionParameter = 'eva' | 'rom' | 'force' | 'paresthesias';

function getSessionParameter(session?: SessionEntry): SessionParameter {
  const parameter = normalizeText(session?.clinicalData?.comparable?.parameter ?? '');
  if (parameter.includes('parestesia')) return 'paresthesias';
  if (parameter.includes('fuerza') || parameter.includes('inhibicion')) return 'force';
  if (parameter.includes('rom') || parameter.includes('rango articular')) return 'rom';
  return 'eva';
}

function getNumericValue(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = typeof value === 'number' ? value : Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function getChartValues(session: SessionEntry, parameter: SessionParameter) {
  const comparable = session.clinicalData?.comparable;
  let pre: number | null;
  let post: number | null;

  if (parameter === 'rom') {
    pre = getNumericValue(comparable?.rom);
    post = getNumericValue(comparable?.romPost);
  } else if (parameter === 'force') {
    pre = comparable?.forceMode === 'daniels'
      ? getNumericValue(comparable.forceGrade)
      : getNumericValue(comparable?.forceKg);
    post = comparable?.forceMode === 'daniels'
      ? getNumericValue(comparable.forceGradePost)
      : getNumericValue(comparable?.forceKgPost);
  } else {
    pre = getNumericValue(comparable?.evaCurrent ?? comparable?.eva) ?? getNumericValue(session.eva);
    post = getNumericValue(comparable?.evaPost ?? session.evaPost);
  }

  return {
    date: formatDateShort(session.date),
    fullDate: session.date,
    pre,
    post,
  };
}

function getChartTitle(parameter: SessionParameter): string {
  if (parameter === 'rom') return 'Evolución Rango Articular (°)';
  if (parameter === 'force') return 'Evolución de Fuerza';
  if (parameter === 'paresthesias') return 'Evolución de Parestesias';
  return 'Evolución del Signo Comparable (EVA)';
}

function getChartSeriesLabel(parameter: SessionParameter): string {
  if (parameter === 'rom') return 'ROM';
  if (parameter === 'force') return 'Fuerza';
  return 'EVA';
}

function getYAxisLabel(parameter: SessionParameter, forceMode?: 'daniels' | 'dinamometro' | null): string {
  if (parameter === 'rom') return 'Grados (°)';
  if (parameter === 'force') return forceMode === 'daniels' ? 'Fuerza (/5)' : 'Fuerza (kg)';
  return 'EVA';
}

function formatMetricValue(value: number, parameter: SessionParameter, forceMode?: 'daniels' | 'dinamometro' | null): string {
  if (parameter === 'rom') return `${value}°`;
  if (parameter === 'force') return forceMode === 'daniels' ? `${value}/5` : `${value} kg`;
  return `${value}/10`;
}

function getSessionMetricBadge(session: SessionEntry, parameter: SessionParameter) {
  const comparable = session.clinicalData?.comparable;
  if (parameter === 'paresthesias') {
    return (
      <div className="rounded-lg bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">
        Test de Parestesias
      </div>
    );
  }
  if (parameter === 'rom') {
    const pre = getNumericValue(comparable?.rom);
    const post = getNumericValue(comparable?.romPost);
    return (
      <div className="flex items-center gap-1.5 rounded-lg bg-blue-50 px-3 py-1">
        <span className="text-sm font-bold text-blue-800">
          ROM {pre === null ? '—' : `${pre}°`}
          {post !== null && ` → ${post}° (${post - (pre ?? post) >= 0 ? '+' : ''}${post - (pre ?? post)}°)`}
        </span>
      </div>
    );
  }
  if (parameter === 'force') {
    const isDaniels = comparable?.forceMode === 'daniels';
    const pre = getNumericValue(isDaniels ? comparable?.forceGrade : comparable?.forceKg);
    const post = getNumericValue(isDaniels ? comparable?.forceGradePost : comparable?.forceKgPost);
    const unit = isDaniels ? '/5' : ' kg';
    return (
      <div className="flex items-center gap-1.5 rounded-lg bg-blue-50 px-3 py-1">
        <span className="text-sm font-bold text-blue-800">
          Fuerza {pre === null ? '—' : `${pre}${unit}`}
          {post !== null && ` → ${post}${unit}`}
        </span>
      </div>
    );
  }
  const pre = getNumericValue(comparable?.evaCurrent ?? comparable?.eva) ?? getNumericValue(session.eva) ?? 0;
  const post = getNumericValue(comparable?.evaPost ?? session.evaPost);
  return (
    <div className="flex items-center gap-1.5 rounded-lg bg-error-50 px-3 py-1">
      <span className="text-xs font-medium text-error-600">EVA</span>
      <span className="text-sm font-bold text-error-700">{pre}/10</span>
      {post !== null && (
        <>
          <span className="text-xs text-slate-400">→</span>
          <span className="text-sm font-bold text-success-700">{post}/10</span>
        </>
      )}
    </div>
  );
}

function FullReportModal({
  session,
  onClose,
  onSave,
}: {
  session: SessionEntry | null;
  onClose: () => void;
  onSave?: (sessionId: string, clinicalData: ClinicalSessionData, techniquesSummary: string) => Promise<void>;
}) {
  const reportRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedData, setSavedData] = useState<{ sessionId: string; clinicalData: ClinicalSessionData; techniquesSummary: string } | null>(null);
  const [draft, setDraft] = useState({
    prognosis: '',
    treatmentPlan: '',
    relevantAsteriskSign: '',
    techniquesSummary: '',
    antiNoceboExplanation: '',
  });

  useEffect(() => {
    setIsEditing(false);
    setSavedData(null);
    setSaveError(null);
  }, [session?.id]);

  if (!session) return null;
  const cd = savedData?.sessionId === session.id
    ? savedData.clinicalData
    : session.clinicalData as ClinicalSessionData | null;
  const report = cd?.report;
  const techniquesSummary = savedData?.sessionId === session.id
    ? savedData.techniquesSummary
    : session.techniquesSummary ?? cd?.techniquesSummary ?? '';

  const beginEditing = () => {
    setDraft({
      prognosis: cd?.aiPrognosis?.text ?? '',
      treatmentPlan: report?.treatmentPlan ?? cd?.aiTreatment ?? '',
      relevantAsteriskSign: report?.relevantAsteriskSign ?? '',
      techniquesSummary,
      antiNoceboExplanation: report?.antiNoceboExplanation ?? '',
    });
    setSaveError(null);
    setIsEditing(true);
  };

  const handleSave = async () => {
    if (!onSave || !cd) return;
    const updatedReport: ClinicalReportResult = {
      clinicalDiagnosis: report?.clinicalDiagnosis ?? '',
      therapeuticGoals: report?.therapeuticGoals ?? '',
      treatmentPlan: draft.treatmentPlan,
      relevantAsteriskSign: draft.relevantAsteriskSign,
      antiNoceboExplanation: draft.antiNoceboExplanation,
    };
    const updatedClinicalData: ClinicalSessionData = {
      ...cd,
      aiPrognosis: {
        text: draft.prognosis,
        grade1: cd.aiPrognosis?.grade1 ?? '',
        grade2: cd.aiPrognosis?.grade2 ?? '',
        grade3: cd.aiPrognosis?.grade3 ?? '',
        recoveryTime: cd.aiPrognosis?.recoveryTime,
      },
      report: updatedReport,
      techniquesSummary: draft.techniquesSummary,
    };
    setSaving(true);
    setSaveError(null);
    try {
      await onSave(session.id, updatedClinicalData, draft.techniquesSummary);
      setSavedData({
        sessionId: session.id,
        clinicalData: updatedClinicalData,
        techniquesSummary: draft.techniquesSummary,
      });
      setIsEditing(false);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'No se pudo guardar el informe.');
    } finally {
      setSaving(false);
    }
  };

  const buildPlainText = (): string => {
    const lines: string[] = [];
    lines.push(`HISTORIA CLÍNICA — ${formatDate(session.date)}`);
    lines.push(`Fisioterapeuta: ${session.physio}`);
    lines.push('');
    lines.push('S — SUBJETIVO (Motivo / Anamnesis)');
    if (cd?.anamnesis) {
      lines.push(`  Qué ocurre: ${cd.anamnesis.que}`);
      lines.push(`  A qué lo achaca: ${cd.anamnesis.porque}`);
      lines.push(`  Desde cuándo: ${cd.anamnesis.desde}`);
    }
    lines.push(`  Región: ${cd?.region || 'no especificada'}`);
    lines.push('');
    lines.push('BANDERAS DE SEGURIDAD');
    if (cd?.redFlags) {
      cd.redFlags.forEach((rf) => lines.push(`  [${rf.status === 'discarded' ? 'descartada' : 'pendiente'}] ${rf.label}`));
    }
    if (cd?.yellowFlags) {
      cd.yellowFlags.filter((y) => y.checked).forEach((y) => lines.push(`  [amarilla] ${y.label}`));
    }
    cd?.equipmentSafety?.forEach((check) => {
      const status = check.present === null ? 'pendiente' : check.present ? 'presente' : 'descartado';
      lines.push(`  [seguridad de aparatología: ${status}] ${check.label}`);
      if (check.present) lines.push(`    Contraindicada: ${check.contraindicatedTechniques.join(', ')}`);
    });
    lines.push('');
    lines.push('O — OBJETIVO (Exploración y Signo Asterisco)');
    if (cd?.dichotomousFindings) {
      cd.dichotomousFindings.forEach((f) => lines.push(`  ${f.label}: ${f.answer}`));
    }
    if (cd?.tests) {
      cd.tests.forEach((t) => lines.push(`  ${t.name}: ${t.result}`));
    }
    if (cd?.comparable) {
      lines.push(`  Signo Asterisco: ${cd.comparable.movement} — ${cd.comparable.parameter} — EVA ${cd.comparable.eva}/10${cd.comparable.evaPost !== null ? ` → ${cd.comparable.evaPost}/10` : ''}`);
    }
    lines.push('');
    lines.push('A — ASSESSMENT (Hipótesis / Fenotipo)');
    if (cd?.hypotheses) {
      cd.hypotheses.forEach((h) => lines.push(`  ${h.isPrimary ? '[Principal]' : '[Diferencial]'} ${h.label} — ${h.painPhenotype || 'sin clasificar'}`));
    }
    if (cd?.aiPrognosis?.text) {
      lines.push(`  Pronóstico: ${cd.aiPrognosis.text}`);
    }
    lines.push('');
    lines.push('P — PLAN (Tratamiento con Dosimetría)');
    if (report?.treatmentPlan) {
      lines.push(report.treatmentPlan);
    } else if (cd?.aiTreatment) {
      lines.push(cd.aiTreatment);
    }
    if (techniquesSummary) {
      lines.push(`  Técnicas: ${techniquesSummary}`);
    }
    lines.push('');
    if (report?.antiNoceboExplanation) {
      lines.push('GUION ANTI-NOCEBO');
      lines.push(report.antiNoceboExplanation);
    }
    return lines.join('\n');
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(buildPlainText());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  const handlePrint = () => {
    const content = reportRef.current?.innerHTML ?? '';
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`
      <html><head><title>Historia Clínica — ${formatDate(session.date)}</title>
      <style>
        body { font-family: sans-serif; padding: 40px; color: #1e293b; max-width: 800px; margin: auto; }
        h1 { font-size: 18px; color: #1e4e8c; }
        h2 { font-size: 14px; color: #475569; margin-top: 24px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; }
        p { font-size: 12px; line-height: 1.6; }
        .meta { color: #64748b; font-size: 11px; }
      </style></head><body>${content}</body></html>
    `);
    win.document.close();
    win.focus();
    win.print();
  };

  return (
    <Modal
      open={!!session}
      onClose={onClose}
      title="Historia Clínica Completa"
      subtitle={`Sesión del ${formatDate(session.date)} · ${session.physio}`}
      size="xl"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            <X className="h-4 w-4" /> Cerrar
          </Button>
          {isEditing ? (
            <>
              <Button variant="ghost" onClick={() => setIsEditing(false)} disabled={saving}>Cancelar edición</Button>
              <Button onClick={handleSave} disabled={saving}>
                <Save className="h-4 w-4" /> {saving ? 'Guardando…' : 'Guardar cambios'}
              </Button>
            </>
          ) : (
            onSave && cd && (
              <Button variant="outline" onClick={beginEditing}>
                <Pencil className="h-4 w-4" /> Editar informe
              </Button>
            )
          )}
          <Button variant="outline" onClick={handleCopy}>
            <Copy className="h-4 w-4" /> {copied ? 'Copiado' : 'Copiar'}
          </Button>
          <Button onClick={handlePrint}>
            <Printer className="h-4 w-4" /> Imprimir / PDF
          </Button>
        </>
      }
    >
      <div ref={reportRef} className="space-y-5">
        {/* S — Subjetivo */}
        <SoapSection icon={<Stethoscope className="h-4 w-4" />} title="S — Motivo y Anamnesis">
          {cd?.anamnesis && (
            <div className="space-y-1 text-sm text-slate-600">
              <p><span className="font-medium text-slate-700">Qué ocurre:</span> {cd.anamnesis.que || '—'}</p>
              <p><span className="font-medium text-slate-700">A qué lo achaca:</span> {cd.anamnesis.porque || '—'}</p>
              <p><span className="font-medium text-slate-700">Desde cuándo:</span> {cd.anamnesis.desde || '—'}</p>
              <p><span className="font-medium text-slate-700">Región:</span> {cd.region || 'no especificada'}</p>
            </div>
          )}
          {!cd?.anamnesis && <p className="text-sm text-slate-400">Sin datos de anamnesis registrados.</p>}
        </SoapSection>

        {/* Banderas */}
        <SoapSection icon={<AlertTriangle className="h-4 w-4" />} title="Banderas de Seguridad">
          <div className="space-y-1.5">
            {cd?.redFlags?.map((rf, i) => (
              <div key={i} className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs ${rf.status === 'discarded' ? 'bg-success-50 text-success-700' : 'bg-error-50 text-error-700'}`}>
                <AlertTriangle className="h-3 w-3 shrink-0" />
                <span className="font-medium">{rf.label}</span>
                <span className="text-slate-400">({rf.status === 'discarded' ? 'descartada' : 'pendiente'})</span>
              </div>
            ))}
            {cd?.yellowFlags?.filter((y) => y.checked).map((y, i) => (
              <div key={i} className="flex items-center gap-2 rounded-lg bg-warning-50 px-3 py-1.5 text-xs text-warning-700">
                <Lightbulb className="h-3 w-3 shrink-0" />
                <span className="font-medium">{y.label}</span>
              </div>
            ))}
            {cd?.equipmentSafety?.map((check) => (
              <div
                key={check.id}
                className={`rounded-lg px-3 py-1.5 text-xs ${
                  check.present === true
                    ? 'bg-error-50 text-error-700'
                    : check.present === false
                      ? 'bg-success-50 text-success-700'
                      : 'bg-warning-50 text-warning-700'
                }`}
              >
                {check.present === true ? 'Presente' : check.present === false ? 'Descartado' : 'Pendiente'}: {check.label}
                {check.present && <p className="mt-0.5">Contraindicada: {check.contraindicatedTechniques.join(', ')}</p>}
              </div>
            ))}
            {(!cd?.redFlags?.length && !cd?.yellowFlags?.filter((y) => y.checked).length && !cd?.equipmentSafety?.length) && (
              <p className="text-sm text-slate-400">Sin banderas registradas.</p>
            )}
          </div>
        </SoapSection>

        {/* O — Objetivo */}
        <SoapSection icon={<ClipboardCheck className="h-4 w-4" />} title="O — Exploración y Signo Asterisco">
          <div className="space-y-2 text-sm text-slate-600">
            {cd?.dichotomousFindings && cd.dichotomousFindings.length > 0 && (
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Hallazgos Sí/No</p>
                {cd.dichotomousFindings?.map((f, i) => (
                  <p key={i} className="text-xs">• {f.label}: <span className="font-medium">{f.answer}</span></p>
                ))}
              </div>
            )}
            {cd?.tests && cd.tests.length > 0 && (
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Tests Ortopédicos</p>
                {cd.tests?.map((t, i) => (
                  <p key={i} className="text-xs">• {t.name}: <span className="font-medium">{t.result}</span></p>
                ))}
              </div>
            )}
            {cd?.comparable && (
              <div className="rounded-lg border border-primary-100 bg-primary-50/50 p-3">
                <p className="text-xs font-semibold text-primary-700">Signo Asterisco</p>
                <p className="mt-1 text-xs text-slate-600">{cd.comparable.movement}</p>
                <p className="text-xs text-slate-500">
                  Parámetro: {cd.comparable.parameter} — EVA: {cd.comparable.eva}/10
                  {cd.comparable.evaPost !== null ? ` → ${cd.comparable.evaPost}/10` : ''}
                </p>
              </div>
            )}
            {(!cd?.dichotomousFindings?.length && !cd?.tests?.length && !cd?.comparable?.movement) && (
              <p className="text-sm text-slate-400">Sin datos de exploración registrados.</p>
            )}
          </div>
        </SoapSection>

        {/* A — Assessment */}
        <SoapSection icon={<Activity className="h-4 w-4" />} title="A — Hipótesis y Fenotipo">
          <div className="space-y-2 text-sm text-slate-600">
            {cd?.hypotheses?.map((h, i) => (
              <div key={i} className={`rounded-lg p-2.5 text-xs ${h.isPrimary ? 'bg-primary-50 border border-primary-200' : 'bg-slate-50 border border-slate-100'}`}>
                <p className="font-semibold text-slate-700">
                  {h.isPrimary ? 'Hipótesis Principal' : 'Diferencial'}: {h.label}
                </p>
                {h.painPhenotype && <p className="mt-0.5 text-slate-500">Fenotipo: {h.painPhenotype}</p>}
                {h.justification && <p className="mt-0.5 text-slate-500">{h.justification}</p>}
              </div>
            ))}
            {cd?.aiPrognosis?.text && (
              <div className="rounded-lg bg-success-50 p-2.5 text-xs">
                <p className="font-semibold text-success-700">Pronóstico</p>
                {isEditing ? (
                  <textarea
                    rows={3}
                    value={draft.prognosis}
                    onChange={(event) => setDraft((current) => ({ ...current, prognosis: event.target.value }))}
                    className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700"
                  />
                ) : (
                  <p className="mt-0.5 text-slate-600">{cd.aiPrognosis.text}</p>
                )}
              </div>
            )}
            {isEditing && !cd?.aiPrognosis?.text && (
              <label className="block rounded-lg bg-success-50 p-2.5 text-xs font-semibold text-success-700">
                Pronóstico
                <textarea
                  rows={3}
                  value={draft.prognosis}
                  onChange={(event) => setDraft((current) => ({ ...current, prognosis: event.target.value }))}
                  className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-normal text-slate-700"
                />
              </label>
            )}
            {(!cd?.hypotheses?.length && !cd?.aiPrognosis?.text) && (
              <p className="text-sm text-slate-400">Sin hipótesis registradas.</p>
            )}
          </div>
        </SoapSection>

        {/* P — Plan */}
        <SoapSection icon={<Target className="h-4 w-4" />} title="P — Tratamiento y Dosimetría">
          <div className="space-y-2 text-sm text-slate-600">
            {(report?.treatmentPlan || isEditing) && (
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Plan de Tratamiento</p>
                {isEditing ? (
                  <textarea
                    rows={5}
                    value={draft.treatmentPlan}
                    onChange={(event) => setDraft((current) => ({ ...current, treatmentPlan: event.target.value }))}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-700"
                  />
                ) : (
                  <p className="text-xs whitespace-pre-wrap">{report?.treatmentPlan}</p>
                )}
              </div>
            )}
            {!report?.treatmentPlan && cd?.aiTreatment && !isEditing && (
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Tratamiento IA</p>
                <p className="text-xs whitespace-pre-wrap">{cd.aiTreatment}</p>
              </div>
            )}
            {(report?.relevantAsteriskSign || isEditing) && (
              <div className="rounded-lg border border-primary-100 bg-primary-50/30 p-2.5 text-xs">
                <p className="font-semibold text-primary-700">Signo Asterisco de Referencia</p>
                {isEditing ? (
                  <textarea
                    rows={3}
                    value={draft.relevantAsteriskSign}
                    onChange={(event) => setDraft((current) => ({ ...current, relevantAsteriskSign: event.target.value }))}
                    className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700"
                  />
                ) : (
                  <p className="mt-0.5 text-slate-600">{report?.relevantAsteriskSign}</p>
                )}
              </div>
            )}
            {(techniquesSummary || isEditing) && (
              <div className="rounded-lg border border-secondary-200 bg-secondary-50 p-2.5 text-xs">
                <p className="font-semibold text-secondary-700">Técnicas aplicadas</p>
                {isEditing ? (
                  <textarea
                    rows={3}
                    value={draft.techniquesSummary}
                    onChange={(event) => setDraft((current) => ({ ...current, techniquesSummary: event.target.value }))}
                    className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700"
                  />
                ) : (
                  <p className="mt-0.5 text-secondary-800">{techniquesSummary}</p>
                )}
              </div>
            )}
            {(!report?.treatmentPlan && !cd?.aiTreatment && !techniquesSummary) && (
              <p className="text-sm text-slate-400">Sin plan de tratamiento registrado.</p>
            )}
          </div>
        </SoapSection>

        {/* Guion Anti-Nocebo */}
        {(report?.antiNoceboExplanation || isEditing) && (
          <SoapSection icon={<Lightbulb className="h-4 w-4" />} title="Guion Anti-Nocebo para el Paciente">
            {isEditing ? (
              <textarea
                rows={5}
                value={draft.antiNoceboExplanation}
                onChange={(event) => setDraft((current) => ({ ...current, antiNoceboExplanation: event.target.value }))}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700"
              />
            ) : (
              <p className="text-sm text-slate-600 whitespace-pre-wrap">{report?.antiNoceboExplanation}</p>
            )}
          </SoapSection>
        )}
        {saveError && <p role="alert" className="text-sm text-error-600">{saveError}</p>}
      </div>
    </Modal>
  );
}

function SoapSection({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-white p-4">
      <div className="mb-3 flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary-50 text-primary-600">
          {icon}
        </div>
        <h3 className="text-sm font-bold text-slate-800">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function StatBox({
  icon, label, value, color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: 'primary' | 'success' | 'secondary';
}) {
  const colors = {
    primary: 'bg-primary-50 text-primary-600',
    success: 'bg-success-50 text-success-600',
    secondary: 'bg-secondary-50 text-secondary-600',
  };
  return (
    <Card className="p-4">
      <div className="flex items-center gap-3">
        <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${colors[color]}`}>
          {icon}
        </div>
        <div>
          <p className="text-xs font-medium text-slate-400">{label}</p>
          <p className="text-xl font-bold text-slate-800">{value}</p>
        </div>
      </div>
    </Card>
  );
}

function AddSessionModal({
  open, onClose, onAdd, equipment, physio, lastEva,
}: {
  open: boolean;
  onClose: () => void;
  onAdd: (s: SessionEntry) => void;
  equipment: Record<EquipmentKey, boolean>;
  physio: string;
  lastEva: number;
}) {
  const today = new Date().toISOString().split('T')[0];
  const [date, setDate] = useState(today);
  const [eva, setEva] = useState(Math.max(0, lastEva - 1));
  const [summary, setSummary] = useState('');
  const [retest, setRetest] = useState('');
  const [techniquesSummary, setTechniquesSummary] = useState('');
  const [selectedTechniques, setSelectedTechniques] = useState<Set<string>>(new Set());

  const availableTechniques = EQUIPMENT.filter((e) => equipment[e.key]).map((e) => e.label);
  const allTechniques = ['Educación en gestión de carga', 'Ejercicio isométrico', 'Movilización articular', ...availableTechniques];

  const toggleTechnique = (t: string) => {
    setSelectedTechniques((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });
  };

  const improvement = lastEva > 0 ? Math.round(((lastEva - eva) / lastEva) * 100) : 0;

  const handleSubmit = () => {
    if (!date || !retest.trim()) return;
    const session: SessionEntry = {
      id: `s${Date.now()}`,
      date,
      physio,
      eva,
      summary: summary || 'Sesión de tratamiento y retest del signo comparable.',
      techniques: Array.from(selectedTechniques),
      techniquesSummary: techniquesSummary || undefined,
      retest,
      improvement: Math.max(0, improvement),
    };
    onAdd(session);
    setSummary('');
    setRetest('');
    setTechniquesSummary('');
    setSelectedTechniques(new Set());
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Añadir Nueva Sesión"
      subtitle="Registra la evolución y el retest del signo comparable"
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={!retest.trim()}>
            <Plus className="h-4 w-4" /> Registrar Sesión
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Fecha</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              EVA del Retest (0–10)
            </label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={0}
                max={10}
                value={eva}
                onChange={(e) => setEva(Number(e.target.value))}
                className="flex-1 accent-primary-600"
              />
              <span className="flex h-9 w-11 items-center justify-center rounded-lg bg-primary-600 text-base font-bold text-white">
                {eva}
              </span>
            </div>
            {improvement !== 0 && (
              <p className={`mt-1 text-xs ${improvement > 0 ? 'text-success-600' : 'text-error-600'}`}>
                {improvement > 0 ? `Mejoría del ${improvement}% respecto a la sesión anterior` : `Empeoramiento del ${Math.abs(improvement)}%`}
              </p>
            )}
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">
            Técnicas aplicadas <span className="text-xs text-slate-400">(según material activo)</span>
          </label>
          <div className="flex flex-wrap gap-2">
            {allTechniques.map((t) => {
              const active = selectedTechniques.has(t);
              return (
                <button
                  type="button"
                  key={t}
                  onClick={() => toggleTechnique(t)}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-all ${
                    active
                      ? 'border-primary-300 bg-primary-50 text-primary-700'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-primary-200'
                  }`}
                >
                  {active && <Check className="mr-1 inline h-3 w-3" />}
                  {t}
                </button>
              );
            })}
          </div>
          {availableTechniques.length === 0 && (
            <p className="mt-2 text-xs text-slate-400">
              No hay material activo. Activa equipamiento en la cabecera para ver técnicas relacionadas.
            </p>
          )}
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">
            Resumen compacto de técnicas <span className="text-xs text-slate-400">(una línea, formato telegráfico)</span>
          </label>
          <input
            value={techniquesSummary}
            onChange={(e) => setTechniquesSummary(e.target.value)}
            placeholder="Ej: EPI 3mA 3 disparos rotuliano | Terapia manual serrato | Movilización torácica"
            className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">
            Resumen de la sesión
          </label>
          <textarea
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            rows={3}
            placeholder="Describe el tratamiento y la evolución…"
            className="w-full resize-y rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">
            Retest del Signo Comparable <span className="text-error-500">*</span>
          </label>
          <textarea
            value={retest}
            onChange={(e) => setRetest(e.target.value)}
            rows={2}
            placeholder="Ej: SLDS EVA 3/10, 10 repeticiones antes de dolor"
            className="w-full resize-y rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
          />
        </div>
      </div>
    </Modal>
  );
}

interface OfficialReportSettings {
  physiotherapist: string;
  registrationNumber: string;
  clinicName: string;
  clinicDetails: string;
  recipient: string;
  finalNotes: string;
}

const OFFICIAL_REPORT_SETTINGS_KEY = 'fisiocopilot_official_report_settings';

function readOfficialReportSettings(defaultPhysio: string): OfficialReportSettings {
  const defaults: OfficialReportSettings = {
    physiotherapist: defaultPhysio.replace(/^Fisio:\s*/i, ''),
    registrationNumber: '',
    clinicName: '',
    clinicDetails: '',
    recipient: 'Médico Traumatólogo / Especialista',
    finalNotes: '',
  };
  try {
    const stored = localStorage.getItem(OFFICIAL_REPORT_SETTINGS_KEY);
    if (!stored) return defaults;
    const parsed: Partial<OfficialReportSettings> = JSON.parse(stored);
    const storedText = (key: keyof OfficialReportSettings) => {
      const value = parsed?.[key];
      return typeof value === 'string' ? value : defaults[key];
    };
    return {
      physiotherapist: storedText('physiotherapist'),
      registrationNumber: storedText('registrationNumber'),
      clinicName: storedText('clinicName'),
      clinicDetails: storedText('clinicDetails'),
      recipient: storedText('recipient'),
      finalNotes: storedText('finalNotes'),
    };
  } catch (error) {
    console.error('No se pudo leer la configuración del informe clínico:', error);
    return defaults;
  }
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character] ?? character);
}

interface OfficialReportSection {
  title: string;
  content: string;
}

const OFFICIAL_REPORT_SECTION_TITLES = [
  'MOTIVO DE CONSULTA Y ANAMNESIS EVOLUTIVA',
  'VALORACIÓN FÍSICA, CRIBADO Y PRUEBAS COMPLEMENTARIAS',
  'JUICIO CLÍNICO FISIOTERÁPICO',
  'INTERVENCIÓN FISIOTERÁPICA REALIZADA (RESUMEN DE SESIONES)',
  'EVOLUCIÓN OBJETIVA Y SIGNO COMPARABLE (TEST-RETEST)',
  'CONCLUSIONES Y RECOMENDACIONES CLÍNICAS',
];

function extractReportText(raw: string): string {
  const cleanText = (text: string) => text
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\n')
    .replace(/```(?:json|text)?/gi, '')
    .replace(/```/g, '')
    .trim();
  const textFields = ['cuerpo_informe', 'cuerpoInforme', 'reportBody', 'body', 'report', 'content', 'informe', 'text'];
  let candidate: unknown = raw.trim();

  for (let attempt = 0; attempt < 3 && typeof candidate === 'string'; attempt += 1) {
    const text = candidate.replace(/```(?:json|text)?/gi, '').replace(/```/g, '').trim();
    try {
      const parsed: unknown = JSON.parse(text);
      if (typeof parsed === 'string') {
        candidate = parsed;
        continue;
      }
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        const record = parsed as Record<string, unknown>;
        const field = textFields.find((key) => typeof record[key] === 'string')
          ?? Object.keys(record).find((key) => typeof record[key] === 'string');
        if (field) {
          candidate = record[field];
          continue;
        }
      }
      candidate = text;
      break;
    } catch {
      candidate = cleanText(text);
      break;
    }
  }

  if (typeof candidate !== 'string') {
    throw new Error('Gemini devolvió un formato de informe que no se pudo interpretar.');
  }
  return cleanText(candidate)
    .replace(/^\s*(?:#{1,6}\s*)?INFORME CLÍNICO FISIOTERÁPICO\s*\n?/i, '')
    .replace(/^\s*(?:1[).]\s*)?ENCABEZADO PROFESIONAL[\s\S]*?(?=^(?:#{1,6}\s*)?(?:MOTIVO DE CONSULTA|2[).]\s*MOTIVO DE CONSULTA)\b)/im, '')
    .replace(/^\s*(?:Firma|Fdo\.?):[\s\S]*$/im, '')
    .replace(/^\s*(?:Fisioterapeuta Col\.?\s*Nº|Nº de colegiado|Clínica)\s*:.*$/gim, '')
    .trim();
}

function parseOfficialReportSections(reportText: string): OfficialReportSection[] {
  const sections: OfficialReportSection[] = [];
  let currentSection: OfficialReportSection | null = null;
  const normalizeHeading = (line: string) => line
    .replace(/\*\*/g, '')
    .replace(/^\s*#{1,6}\s*/, '')
    .replace(/^\s*\d+[).]\s*/, '')
    .replace(/:$/, '')
    .trim()
    .toLocaleUpperCase('es');

  for (const line of reportText.split(/\r?\n/)) {
    const normalizedLine = normalizeHeading(line);
    const matchedTitle = OFFICIAL_REPORT_SECTION_TITLES.find((title) =>
      normalizedLine === title || normalizedLine.startsWith(`${title}:`),
    );
    if (matchedTitle) {
      const originalHeading = line
        .replace(/\*\*/g, '')
        .replace(/^\s*#{1,6}\s*/, '')
        .replace(/^\s*\d+[).]\s*/, '')
        .trim();
      const headingContent = originalHeading.toLocaleUpperCase('es').startsWith(`${matchedTitle}:`)
        ? originalHeading.slice(matchedTitle.length + 1).trim()
        : '';
      currentSection = { title: matchedTitle, content: headingContent };
      sections.push(currentSection);
    } else if (currentSection) {
      currentSection.content = currentSection.content
        ? `${currentSection.content}\n${line}`
        : line;
    } else if (line.trim()) {
      currentSection = { title: OFFICIAL_REPORT_SECTION_TITLES[0], content: line };
      sections.push(currentSection);
    }
  }

  if (sections.length === 0 && reportText.trim()) {
    sections.push({ title: OFFICIAL_REPORT_SECTION_TITLES[0], content: reportText.trim() });
  }
  const sectionContentByTitle = new Map<string, string>();
  for (const section of sections) {
    const existing = sectionContentByTitle.get(section.title);
    sectionContentByTitle.set(
      section.title,
      [existing, section.content.trim()].filter(Boolean).join('\n\n'),
    );
  }
  return OFFICIAL_REPORT_SECTION_TITLES.map((title) => ({
    title,
    content: sectionContentByTitle.get(title) ?? '',
  }));
}

function OfficialReportModal({
  open,
  onClose,
  sessions,
  patient,
  episode,
  physio,
  geminiConfig,
}: {
  open: boolean;
  onClose: () => void;
  sessions: SessionEntry[];
  patient: Patient | null;
  episode: Episode | null;
  physio: string;
  geminiConfig: GeminiConfig;
}) {
  const [settings, setSettings] = useState<OfficialReportSettings>(() => readOfficialReportSettings(physio));
  const [reportSections, setReportSections] = useState<OfficialReportSection[]>([]);
  const [reportIssueDate, setReportIssueDate] = useState('');
  const [isPreview, setIsPreview] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const hasApiKey = Boolean(geminiConfig.apiKey.trim() || import.meta.env.VITE_GEMINI_API_KEY?.trim());

  useEffect(() => {
    if (!open) return;
    setSettings((current) => ({
      ...current,
      physiotherapist: physio.replace(/^Fisio:\s*/i, ''),
    }));
    setError(null);
  }, [open, physio]);

  useEffect(() => {
    try {
      localStorage.setItem(OFFICIAL_REPORT_SETTINGS_KEY, JSON.stringify(settings));
    } catch (storageError) {
      console.error('No se pudo guardar la configuración del informe clínico:', storageError);
    }
  }, [settings]);

  const updateSetting = (key: keyof OfficialReportSettings, value: string) => {
    setSettings((current) => ({ ...current, [key]: value }));
  };

  const createReport = async () => {
    if (!hasApiKey) {
      setError('Configura la API key de Gemini en Ajustes para generar el informe.');
      return;
    }
    if (sessions.length === 0) {
      setError('Este episodio aún no tiene sesiones clínicas registradas.');
      return;
    }

    setLoading(true);
    setError(null);
    setCopied(false);
    try {
      const issueDate = new Date().toISOString().slice(0, 10);
      const clinicalSessions = [...sessions]
        .sort((a, b) => a.date.localeCompare(b.date))
        .map((session) => {
          const clinicalData = session.clinicalData;
          const comparable = clinicalData?.comparable;
          const primaryHypothesis = clinicalData?.hypotheses?.find((hypothesis) => hypothesis.isPrimary);
          const treatment = session.treatmentSummary
            || session.shortTreatment
            || session.treatmentPlan
            || session.manualTreatment
            || session.techniquesSummary
            || clinicalData?.techniquesSummary
            || clinicalData?.report?.treatmentPlan
            || clinicalData?.manualTreatmentPlan
            || clinicalData?.aiTreatment
            || session.techniques?.join(' | ')
            || 'No registrado';
          return {
            sessionNumber: 0,
            date: session.date,
            physiotherapist: session.physio,
            reasonAndAnamnesis: clinicalData?.anamnesis ?? session.summary,
            region: clinicalData?.region ?? episode?.region ?? 'No especificada',
            diagnosis: clinicalData?.manualClinicalDiagnosis
              || clinicalData?.report?.clinicalDiagnosis
              || (primaryHypothesis
                ? `${primaryHypothesis.label}${primaryHypothesis.justification ? `: ${primaryHypothesis.justification}` : ''}`
                : 'No registrado'),
            differentialHypotheses: (clinicalData?.hypotheses ?? [])
              .filter((hypothesis) => !hypothesis.isPrimary)
              .map((hypothesis) => ({
                name: hypothesis.label,
                reasoning: hypothesis.justification,
              })),
            interviewFindings: (clinicalData?.dichotomousFindings ?? []).map((finding) => ({
              question: finding.label,
              answer: finding.answer,
              note: finding.note,
            })),
            orthopedicTests: (clinicalData?.tests ?? []).map((test) => ({
              name: test.name,
              region: test.region,
              description: test.description,
              position: test.position,
              maneuver: test.maneuver,
              positiveCriteria: test.positiveCriteria,
              result: test.result || 'Sin valorar',
            })),
            redFlags: (clinicalData?.redFlags ?? []).map((flag) => ({
              label: flag.label,
              status: flag.status,
            })),
            yellowFlags: (clinicalData?.yellowFlags ?? []).filter((flag) => flag.checked).map((flag) => flag.label),
            ultrasound: clinicalData?.manualSonoFindings
              || (clinicalData?.sonoFindings ?? []).map((finding) =>
                `${finding.structure}: ${finding.findings.join(', ')}${finding.notes ? ` (${finding.notes})` : ''}`,
              ).join('; ')
              || 'No registrado',
            complementaryTests: clinicalData?.complementary || 'No registrado',
            physicalExploration: clinicalData?.freeExploration || 'No registrada',
            treatment,
            sessionNotes: session.summary,
            retest: session.retest,
            comparable: comparable ? {
              movement: comparable.movement,
              parameter: comparable.parameter,
              evaPre: comparable.evaCurrent ?? comparable.eva,
              evaPost: comparable.evaPost,
              romPre: comparable.rom,
              romPost: comparable.romPost,
              forceMode: comparable.forceMode,
              forcePre: comparable.forceMode === 'daniels' ? comparable.forceGrade : comparable.forceKg,
              forcePost: comparable.forceMode === 'daniels' ? comparable.forceGradePost : comparable.forceKgPost,
              instructions: comparable.instructions,
            } : null,
            evolution: clinicalData?.evolution ?? null,
            equipmentSafety: clinicalData?.equipmentSafety ?? [],
          };
        });
      clinicalSessions.forEach((session, index) => {
        session.sessionNumber = index + 1;
      });
      const firstComparable = clinicalSessions.find((session) => session.comparable)?.comparable ?? null;
      const lastComparable = [...clinicalSessions].reverse().find((session) => session.comparable)?.comparable ?? null;
      const sessionDateRange = clinicalSessions.length > 0
        ? `${formatDate(clinicalSessions[0].date)} y ${formatDate(clinicalSessions[clinicalSessions.length - 1].date)}`
        : 'sin fechas registradas';
      const clinicalTimelineSummary = `${clinicalSessions.length} sesiones realizadas entre ${sessionDateRange}`;
      const overallObjectiveProgress = firstComparable && lastComparable
        ? {
            movement: firstComparable.movement,
            parameter: firstComparable.parameter,
            initialSession: firstComparable,
            latestSession: lastComparable,
          }
        : null;
      const patientData = {
        name: patient?.name || 'No especificado',
        dateOfBirth: patient?.birthDate || 'No registrada',
      };
      const episodeData = {
        title: episode?.title || 'No especificado',
        region: episode?.region || 'No especificada',
        anamnesis: episode?.anamnesis ?? null,
      };
      const prompt = `Actúa como redactor de un informe clínico fisioterápico profesional de derivación. Redacta en español, con tono clínico objetivo, claro y conciso. Utiliza exclusivamente los datos recibidos: no inventes diagnósticos, hallazgos, resultados negativos, causalidad, pronóstico ni recomendaciones. Distingue claramente entre dato no registrado, test sin valorar y hallazgo descartado. Integra cronológicamente las sesiones y conserva los valores medidos tal como aparecen.

Genera el informe clínico completo en seis secciones con estos títulos exactos, en mayúsculas y cada título en una línea independiente:
MOTIVO DE CONSULTA Y ANAMNESIS EVOLUTIVA: cronología de los síntomas iniciales, mecanismo desencadenante y evolución subjetiva a lo largo de las sesiones.
VALORACIÓN FÍSICA, CRIBADO Y PRUEBAS COMPLEMENTARIAS: exploración funcional, tests ortopédicos con sus resultados reales, banderas rojas descartadas solo cuando el estado figure como descartado, y ecografía/pruebas complementarias si constan.
JUICIO CLÍNICO FISIOTERÁPICO: diagnóstico fisioterápico principal manual o hipótesis principal registrada con el razonamiento documentado. No formules diagnósticos nuevos.
INTERVENCIÓN FISIOTERÁPICA REALIZADA (RESUMEN DE SESIONES): indica el total y sintetiza con concisión las técnicas realmente aplicadas por sesión, incluidas dosis cuando consten.
EVOLUCIÓN OBJETIVA Y SIGNO COMPARABLE (TEST-RETEST): identifica el Signo Asterisco y compara la medición basal de la primera sesión con la última disponible para el mismo parámetro (EVA, ROM en grados, fuerza o parestesias). Conserva unidades; no conviertas valores ausentes en cero.
CONCLUSIONES Y RECOMENDACIONES CLÍNICAS: describe la situación actual respaldada por los datos y el motivo de derivación. No inventes recomendaciones de autotratamiento ni seguimiento no indicadas explícitamente en los datos.

No escribas JSON, bloques de código, un encabezado institucional ni una firma: la aplicación ya los presentará mediante la plantilla del documento. No numeres las secciones. No omitas ninguna de las seis secciones. No añadas un séptimo apartado.

Datos del paciente: ${JSON.stringify(patientData)}
Episodio: ${JSON.stringify(episodeData)}
${clinicalTimelineSummary}.
Progresión global del Signo Asterisco desde la primera sesión hasta la última: ${JSON.stringify(overallObjectiveProgress)}
Datos reales de cada sesión en orden cronológico (incluye anamnesis, exploración, banderas, tests, tratamiento, retest y evolución): ${JSON.stringify(clinicalSessions)}
Motivo u observaciones del fisioterapeuta: ${settings.finalNotes || 'No indicado'}
Destinatario: ${settings.recipient}
Fecha de emisión: ${formatDate(issueDate)}

Devuelve únicamente el texto clínico de las seis secciones; sin encabezado profesional ni firma.`;
      const rawBody = await callGemini(prompt, geminiConfig, { timeoutMs: 90000, maxOutputTokens: 4096 });
      const body = extractReportText(rawBody);
      setReportSections(parseOfficialReportSections(body));
      setReportIssueDate(issueDate);
      setIsPreview(true);
    } catch (generationError) {
      console.error('No se pudo generar el informe clínico:', generationError);
      setError(generationError instanceof Error ? generationError.message : 'No se pudo generar el informe clínico.');
    } finally {
      setLoading(false);
    }
  };

  const copyReport = async () => {
    try {
      const sortedSessions = [...sessions].sort((a, b) => a.date.localeCompare(b.date));
      const plainText = [
        'INFORME CLÍNICO FISIOTERÁPICO',
        settings.clinicName,
        settings.clinicDetails,
        `Fisioterapeuta: ${settings.physiotherapist}`,
        `Nº de colegiado: ${settings.registrationNumber}`,
        `Fecha de emisión: ${formatDate(reportIssueDate)}`,
        `Dirigido a: ${settings.recipient}`,
        '',
        `Paciente: ${patient?.name || 'No especificado'}`,
        `Fecha de nacimiento: ${patient?.birthDate ? formatDate(patient.birthDate) : 'No registrada'}`,
        `Inicio del episodio: ${episode?.createdAt ? formatDate(episode.createdAt.slice(0, 10)) : 'No registrado'}`,
        `Sesiones realizadas: ${sortedSessions.length}`,
        '',
        ...reportSections.flatMap((section) => [section.title, section.content, '']),
        `Fdo.: ${settings.physiotherapist}`,
        `Fisioterapeuta Col. Nº ${settings.registrationNumber}`,
        settings.clinicName,
      ].filter((line) => line !== undefined);
      await navigator.clipboard.writeText(plainText.join('\n'));
      setCopied(true);
      setError(null);
    } catch (copyError) {
      console.error('No se pudo copiar el informe clínico:', copyError);
      setError('No se pudo copiar el informe. Comprueba los permisos del portapapeles.');
    }
  };

  const printReport = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      setError('El navegador ha bloqueado la ventana de impresión. Permite ventanas emergentes e inténtalo de nuevo.');
      return;
    }
    const reportSectionsHtml = reportSections.map((section) => `
      <section class="report-section">
        <h2>${escapeHtml(section.title)}</h2>
        <p>${escapeHtml(section.content).replace(/\r?\n/g, '<br>')}</p>
      </section>
    `).join('');
    printWindow.document.open();
    printWindow.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Informe clínico</title><style>
      @page { size: A4; margin: 18mm; }
      * { box-sizing: border-box; }
      body { color: #334155; font: 10.5pt/1.55 Arial, sans-serif; margin: 0; }
      .document { max-width: 174mm; margin: 0 auto; }
      .institutional-header { display: flex; justify-content: space-between; gap: 24px; padding: 0 0 16px; border-bottom: 3px solid #059669; }
      .institutional-header h1 { color: #064e3b; font-size: 17pt; margin: 0 0 8px; }
      .clinic { color: #0f172a; font-size: 14pt; font-weight: 700; margin: 0 0 4px; }
      .header-right { min-width: 220px; text-align: right; }
      .header-right p, .institutional-header p { margin: 2px 0; }
      .patient-data { background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; margin: 16px 0; padding: 12px; }
      .patient-data p { margin: 3px 0; }
      .report-section { break-inside: avoid; margin: 18px 0 0; }
      .report-section h2 { border-bottom: 1px solid #cbd5e1; color: #065f46; font-size: 10pt; font-weight: 700; letter-spacing: .04em; margin: 0 0 8px; padding-bottom: 4px; }
      .report-section p { line-height: 1.6; margin: 0; white-space: pre-line; }
      .signature { border-top: 1px solid #cbd5e1; display: flex; justify-content: flex-end; margin-top: 40px; padding-top: 24px; text-align: right; }
      .signature p { margin: 2px 0; }
    </style></head><body><main class="document">
      <header class="institutional-header">
        <div><h1>INFORME CLÍNICO FISIOTERÁPICO</h1><p class="clinic">${escapeHtml(settings.clinicName || 'Clínica / Centro')}</p><p>${escapeHtml(settings.clinicDetails || '')}</p></div>
        <div class="header-right"><p><strong>Fisioterapeuta:</strong> ${escapeHtml(settings.physiotherapist)}</p><p><strong>Nº de colegiado:</strong> ${escapeHtml(settings.registrationNumber)}</p><p><strong>Fecha:</strong> ${escapeHtml(formatDate(reportIssueDate))}</p><p><strong>Dirigido a:</strong> ${escapeHtml(settings.recipient)}</p></div>
      </header>
      <section class="patient-data"><p><strong>Paciente:</strong> ${escapeHtml(patient?.name || 'No especificado')}</p><p><strong>Fecha de nacimiento:</strong> ${escapeHtml(patient?.birthDate ? formatDate(patient.birthDate) : 'No registrada')}</p><p><strong>Inicio del episodio:</strong> ${escapeHtml(episode?.createdAt ? formatDate(episode.createdAt.slice(0, 10)) : 'No registrado')}</p><p><strong>Sesiones realizadas:</strong> ${sessions.length}</p></section>
      ${reportSectionsHtml}
      <footer class="signature"><div><p><em>Fdo.: ${escapeHtml(settings.physiotherapist)}</em></p><p>Fisioterapeuta Col. Nº ${escapeHtml(settings.registrationNumber)}</p><p>${escapeHtml(settings.clinicName)}</p></div></footer>
    </main></body></html>`);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  const closeModal = () => {
    setIsPreview(false);
    setReportSections([]);
    setReportIssueDate('');
    setError(null);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={closeModal}
      title={isPreview ? 'Vista previa del Informe Clínico' : 'Configurar Informe Clínico / Derivación'}
      subtitle={isPreview ? 'Revisa y edita el informe antes de copiarlo o imprimirlo.' : 'Datos profesionales y destinatario para este informe'}
      size="xl"
      footer={isPreview ? (
        <>
          <Button variant="ghost" onClick={() => setIsPreview(false)}>Editar configuración</Button>
          <Button variant="outline" onClick={copyReport}>
            {copied ? <ClipboardCheck className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? 'Copiado' : 'Copiar texto'}
          </Button>
          <Button onClick={printReport}>
            <Printer className="h-4 w-4" /> Imprimir / Guardar como PDF
          </Button>
        </>
      ) : (
        <>
          <Button variant="ghost" onClick={closeModal}>Cancelar</Button>
          <Button
            onClick={() => void createReport()}
            disabled={loading || !hasApiKey || sessions.length === 0}
            className="bg-emerald-600 text-white hover:bg-emerald-700"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
            {loading ? 'Generando informe…' : 'Crear Informe'}
          </Button>
        </>
      )}
    >
      {isPreview ? (
        <article className="mx-auto max-w-4xl rounded-lg bg-white p-4 text-slate-700 sm:p-8">
          <header className="flex flex-col justify-between gap-5 border-b-[3px] border-emerald-600 pb-4 sm:flex-row">
            <div>
              <h1 className="text-xl font-bold tracking-tight text-emerald-900">INFORME CLÍNICO FISIOTERÁPICO</h1>
              <p className="mt-2 text-lg font-bold text-slate-900">{settings.clinicName || 'Clínica / Centro'}</p>
              {settings.clinicDetails && <p className="mt-1 whitespace-pre-line text-sm text-slate-600">{settings.clinicDetails}</p>}
            </div>
            <div className="text-sm sm:min-w-64 sm:text-right">
              <p><strong>Fisioterapeuta:</strong> {settings.physiotherapist || 'No especificado'}</p>
              <p><strong>Nº de colegiado:</strong> {settings.registrationNumber || 'No especificado'}</p>
              <p><strong>Fecha de emisión:</strong> {reportIssueDate ? formatDate(reportIssueDate) : '—'}</p>
              <p><strong>Dirigido a:</strong> {settings.recipient}</p>
            </div>
          </header>
          <section className="mb-4 mt-4 grid gap-1 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm sm:grid-cols-2">
            <p><strong>Paciente:</strong> {patient?.name || 'No especificado'}</p>
            <p><strong>Fecha de nacimiento:</strong> {patient?.birthDate ? formatDate(patient.birthDate) : 'No registrada'}</p>
            <p><strong>Inicio del episodio:</strong> {episode?.createdAt ? formatDate(episode.createdAt.slice(0, 10)) : 'No registrado'}</p>
            <p><strong>Sesiones realizadas:</strong> {sessions.length}</p>
          </section>
          {reportSections.map((section, index) => (
            <section key={`${section.title}-${index}`} className="mb-5 mt-5">
              <h2 className="mb-2 border-b border-slate-200 pb-1 text-sm font-bold uppercase tracking-wide text-emerald-800">
                {section.title}
              </h2>
              <textarea
                aria-label={`Contenido: ${section.title}`}
                value={section.content}
                onChange={(event) => {
                  setReportSections((current) => current.map((item, itemIndex) =>
                    itemIndex === index ? { ...item, content: event.target.value } : item,
                  ));
                  setCopied(false);
                }}
                rows={Math.max(3, section.content.split('\n').length + 1)}
                className="w-full resize-y rounded-md border border-transparent bg-transparent px-1 py-1 text-sm leading-relaxed text-slate-700 outline-none hover:border-slate-200 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
              />
            </section>
          ))}
          <footer className="mt-10 flex justify-end border-t border-slate-200 pt-6">
            <div className="text-right text-sm text-slate-700">
              <p className="italic">Fdo.: {settings.physiotherapist || 'No especificado'}</p>
              <p>Fisioterapeuta Col. Nº {settings.registrationNumber || 'No especificado'}</p>
              <p>{settings.clinicName || 'Clínica / Centro'}</p>
            </div>
          </footer>
        </article>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-medium text-slate-700">
            Nombre del Fisioterapeuta
            <input value={settings.physiotherapist} onChange={(event) => updateSetting('physiotherapist', event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 font-normal outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100" />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Nº de Colegiado
            <input value={settings.registrationNumber} onChange={(event) => updateSetting('registrationNumber', event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 font-normal outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100" />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Nombre de la Clínica / Centro
            <input value={settings.clinicName} onChange={(event) => updateSetting('clinicName', event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 font-normal outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100" />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Datos adicionales de la Clínica
            <input value={settings.clinicDetails} onChange={(event) => updateSetting('clinicDetails', event.target.value)} placeholder="Dirección / Teléfono" className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 font-normal outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100" />
          </label>
          <label className="text-sm font-medium text-slate-700 sm:col-span-2">
            Dirigido a
            <select value={settings.recipient} onChange={(event) => updateSetting('recipient', event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 font-normal outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100">
              <option>Médico Traumatólogo / Especialista</option>
              <option>Médico de Atención Primaria</option>
              <option>Otro Fisioterapeuta / Compañero</option>
              <option>Informe para el Paciente / Aseguradora</option>
            </select>
          </label>
          <label className="text-sm font-medium text-slate-700 sm:col-span-2">
            Motivo del informe / Observaciones finales
            <textarea value={settings.finalNotes} onChange={(event) => updateSetting('finalNotes', event.target.value)} rows={3} className="mt-1.5 w-full resize-y rounded-xl border border-slate-200 px-3 py-2.5 font-normal outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100" />
          </label>
          {!hasApiKey && (
            <p className="sm:col-span-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              Configura la API key de Gemini en Ajustes para generar el informe.
            </p>
          )}
          {sessions.length === 0 && (
            <p className="sm:col-span-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              Este episodio aún no tiene sesiones clínicas registradas.
            </p>
          )}
        </div>
      )}
      {error && <p role="alert" className="mt-4 rounded-lg border border-error-200 bg-error-50 px-3 py-2 text-sm text-error-700">{error}</p>}
    </Modal>
  );
}

function Check({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
      <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
}

function formatDateShort(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
}
