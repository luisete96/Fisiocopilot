import { useState, useRef, useEffect } from 'react';
import {
  Calendar, Plus, User, TrendingUp, Activity,
  ClipboardList, ChevronDown, FileText,
  Copy, Printer, X, Stethoscope, AlertTriangle, Target,
  ClipboardCheck, Lightbulb, FolderPlus, Folder, Pencil, Save,
} from 'lucide-react';
import {
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Area, ComposedChart,
} from 'recharts';
import type { SessionEntry, EquipmentKey, Patient, Episode, ClinicalSessionData, ClinicalReportResult } from '../types';
import { EQUIPMENT, BODY_REGIONS } from '../mockData';
import { Card, CardHeader } from './ui/Card';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { Modal } from './ui/Modal';
import { EpisodeStatusControl } from './EpisodeStatusControl';
import { normalizeText } from '../patientUtils';

interface ExpedienteScreenProps {
  sessions: SessionEntry[];
  onAddSession: (session: SessionEntry) => void;
  equipment: Record<EquipmentKey, boolean>;
  physio: string;
  activePatient?: Patient | null;
  activeEpisode?: Episode | null;
  episodes?: Episode[];
  onSelectEpisode?: (episodeId: string) => void;
  onCreateEpisode?: () => Promise<void>;
  onNewValoracion?: () => void;
  onUpdateEpisode?: (patientId: string, updatedEpisode: Episode) => Promise<void>;
  onSaveClinicalSession?: (sessionId: string, clinicalData: ClinicalSessionData, techniquesSummary: string) => Promise<void>;
}

export function ExpedienteScreen({ sessions = [], onAddSession, equipment, physio, activePatient, activeEpisode, episodes = [], onSelectEpisode, onCreateEpisode, onNewValoracion, onUpdateEpisode, onSaveClinicalSession }: ExpedienteScreenProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [reportSession, setReportSession] = useState<SessionEntry | null>(null);
  const [episodeCreateError, setEpisodeCreateError] = useState<string | null>(null);

  const startNewEpisode = async () => {
    setEpisodeCreateError(null);
    try {
      await onCreateEpisode?.();
    } catch (error) {
      console.error('No se pudo crear el episodio:', error);
      setEpisodeCreateError(error instanceof Error ? error.message : 'No se pudo crear el episodio.');
    }
  };

  const chartData = sessions.map((s) => ({
    date: formatDateShort(s.date),
    eva: s.eva,
    fullDate: s.date,
  }));

  const firstEva = sessions[0]?.eva || 0;
  const lastEva = sessions[sessions.length - 1]?.eva || 0;
  const globalImprovement = sessions.length > 1
    ? Math.round(((firstEva - lastEva) / firstEva) * 100)
    : 0;

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
            <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-primary-100 pt-3">
              <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
                <Folder className="h-3.5 w-3.5" /> Episodios:
              </span>
              {episodes.map((ep) => {
                const firstSessionRegion = [...sessions]
                  .filter((session) => session.episodeId === ep.id)
                  .sort((a, b) => a.date.localeCompare(b.date))
                  .find((session) => session.clinicalData?.region)?.clinicalData?.region;
                const regionLabel = BODY_REGIONS.find((item) => item.key === ep.region)?.label ?? ep.region;
                const isPlaceholderTitle = /^(nueva valoración|nuevo episodio)$/i.test(ep.title.trim());
                const displayTitle = isPlaceholderTitle ? firstSessionRegion || regionLabel || ep.title : ep.title;
                return (
                  <div key={ep.id} className="flex flex-wrap items-center gap-1 rounded-lg border border-slate-200 bg-white p-1">
                    <button
                      type="button"
                      onClick={() => onSelectEpisode(ep.id)}
                      className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium transition-all ${
                        activeEpisode?.id === ep.id ? 'bg-primary-600 text-white' : 'text-slate-600 hover:bg-slate-50'
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
                    {ep.status === 'active' && <Badge variant="success">Activo</Badge>}
                    {onUpdateEpisode && <EpisodeStatusControl episode={ep} onUpdate={onUpdateEpisode} />}
                  </div>
                );
              })}
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
              label="Mejoría global"
              value={`${globalImprovement}%`}
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
              title="Evolución del Signo Comparable (EVA)"
              description="Gráfica interactiva de la evolución del dolor por sesión"
              icon={<TrendingUp className="h-5 w-5" />}
              action={
                <Button size="sm" onClick={() => setModalOpen(true)}>
                  <Plus className="h-4 w-4" /> Añadir Sesión Manual
                </Button>
              }
            />
            <div className="p-5">
              <div className="mb-4 flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-error-500" />
                  <span className="text-xs text-slate-600">EVA (0–10)</span>
                </div>
                <Badge variant="success">
                  Mejoría del {globalImprovement}% — de EVA {firstEva} a EVA {lastEva}
                </Badge>
              </div>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartData} margin={{ top: 10, right: 10, bottom: 0, left: -10 }}>
                    <defs>
                      <linearGradient id="evaGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#ef4444" stopOpacity={0.15} />
                        <stop offset="100%" stopColor="#ef4444" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 12, fill: '#64748b' }}
                      axisLine={{ stroke: '#cbd5e1' }}
                    />
                    <YAxis
                      yAxisId="left"
                      domain={[0, 10]}
                      tick={{ fontSize: 12, fill: '#64748b' }}
                      axisLine={{ stroke: '#cbd5e1' }}
                      label={{
                        value: 'EVA',
                        angle: -90,
                        position: 'insideLeft',
                        style: { fontSize: 11, fill: '#94a3b8' },
                      }}
                    />
                    <Tooltip
                      contentStyle={{
                        borderRadius: '12px',
                        border: '1px solid #e2e8f0',
                        fontSize: '13px',
                      }}
                      labelStyle={{ fontWeight: 600, color: '#1e293b' }}
                    />
                    <ReferenceLine y={0} yAxisId="left" stroke="#cbd5e1" />
                    <Area
                      yAxisId="left"
                      type="monotone"
                      dataKey="eva"
                      stroke="#ef4444"
                      strokeWidth={2.5}
                      fill="url(#evaGradient)"
                      dot={{ r: 5, fill: '#ef4444' }}
                      activeDot={{ r: 7 }}
                      name="EVA"
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
          </Card>

          {/* Timeline */}
          <Card>
            <CardHeader
              title="Línea de Tiempo de Sesiones (Evolutivos)"
              description="Historial cronológico — clic en la tarjeta para desplegar detalles"
              icon={<ClipboardList className="h-5 w-5" />}
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
              {session.evaPost !== null && session.evaPost !== undefined ? (
                <div className="flex items-center gap-1.5 rounded-lg bg-error-50 px-3 py-1">
                  <span className="text-xs font-medium text-error-600">EVA</span>
                  <span className="text-sm font-bold text-error-700">{session.eva}/10</span>
                  <span className="text-xs text-slate-400">➔</span>
                  <span className="text-sm font-bold text-success-700">{session.evaPost}/10</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 rounded-lg bg-error-50 px-3 py-1">
                  <span className="text-xs font-medium text-error-600">EVA</span>
                  <span className="text-sm font-bold text-error-700">{session.eva}/10</span>
                </div>
              )}
              {session.improvement > 0 && (
                <div className="flex items-center gap-1.5 rounded-lg bg-success-50 px-3 py-1">
                  <TrendingUp className="h-3.5 w-3.5 text-success-600" />
                  <span className="text-sm font-bold text-success-700">+{session.improvement}%</span>
                </div>
              )}
            </div>
          </div>
          {session.techniquesSummary && (
            <div className="mt-2.5 flex items-center gap-2 rounded-lg border border-secondary-200 bg-secondary-50 px-3 py-2">
              <Activity className="h-3.5 w-3.5 shrink-0 text-secondary-600" />
              <span className="text-xs font-semibold text-secondary-800">{session.techniquesSummary}</span>
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
