import { useState, useEffect, useCallback } from 'react';
import {
  FileText, Copy, Check, Target, Stethoscope, Activity,
  Loader2, Brain, Save, Clipboard, HeartHandshake,
} from 'lucide-react';
import type {
  ClinicalData, ClinicalReportResult, GeminiConfig, SessionEntry,
} from '../types';
import { EQUIPMENT } from '../mockData';
import {
  callGemini,
  CLINICAL_REPORT_TIMEOUT_MS,
  GEMINI_MAX_OUTPUT_TOKENS,
  CLINICAL_REPORT_RESPONSE_SCHEMA,
  buildClinicalReportPrompt,
  parseClinicalReportResult,
  buildTechniquesSummaryPrompt,
  parseTechniquesSummaryResult,
} from '../geminiService';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';

interface ClinicalReportProps {
  open: boolean;
  onClose: () => void;
  clinicalData: ClinicalData | null;
  geminiConfig: GeminiConfig;
  physio: string;
  sessions: SessionEntry[];
  onSave: (report: ClinicalReportResult, techniquesSummary?: string) => void;
}

const EMPTY_REPORT: ClinicalReportResult = {
  clinicalDiagnosis: '',
  therapeuticGoals: '',
  treatmentPlan: '',
  relevantAsteriskSign: '',
  antiNoceboExplanation: '',
};

export function ClinicalReport(props: ClinicalReportProps) {
  const {
    open, onClose, clinicalData, geminiConfig, physio, sessions, onSave,
  } = props;
  const [report, setReport] = useState<ClinicalReportResult>(EMPTY_REPORT);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  const hasApiKey = Boolean(
    geminiConfig?.apiKey?.trim() || import.meta.env.VITE_GEMINI_API_KEY?.trim(),
  );

  const activeEquipment = clinicalData?.equipment
    ? EQUIPMENT.filter((e) => clinicalData.equipment[e.key]).map((e) => e.label)
    : [];

  const generateReport = useCallback(async () => {
    if (!clinicalData) {
      console.warn('ALERTA: ClinicalReport no tiene clinicalData.', clinicalData);
      setError('No hay datos de valoración disponibles para generar la historia clínica.');
      return;
    }

    setLoading(true);
    setError(null);
    setSaved(false);

    try {
      const prompt = buildClinicalReportPrompt(clinicalData);
      console.log('--> PROMPT ENVIADO A GEMINI (INFORME):', prompt);

      const rawResult = await callGemini(prompt, geminiConfig, {
        timeoutMs: CLINICAL_REPORT_TIMEOUT_MS,
        maxOutputTokens: GEMINI_MAX_OUTPUT_TOKENS,
        responseSchema: CLINICAL_REPORT_RESPONSE_SCHEMA,
      });

      console.log('--> RESPUESTA CRUDA DE GEMINI (INFORME):', rawResult);
      const response = parseClinicalReportResult(rawResult);

      const generatedReport: ClinicalReportResult = {
        clinicalDiagnosis:
          response.clinicalDiagnosis ||
          'No se pudo extraer el diagnóstico fisioterápico. Pulsa Regenerar con IA.',
        therapeuticGoals:
          response.therapeuticGoals ||
          'No se pudieron extraer los objetivos terapéuticos. Pulsa Regenerar con IA.',
        treatmentPlan:
          response.treatmentPlan ||
          'No se pudo extraer el plan de tratamiento. Pulsa Regenerar con IA.',
        relevantAsteriskSign:
          response.relevantAsteriskSign ||
          'No se pudo extraer el signo comparable y métrica de retest. Pulsa Regenerar con IA.',
        antiNoceboExplanation:
          response.antiNoceboExplanation ||
          'No se pudo extraer la explicación al paciente. Pulsa Regenerar con IA.',
      };

      console.log('--> INFORME PARSEADO Y ASIGNADO AL ESTADO:', generatedReport);
      setReport(generatedReport);
    } catch (err) {
      console.error('Detalle error historia clínica:', err);
      setError(err instanceof Error ? err.message : 'Error al generar el informe.');
    } finally {
      setLoading(false);
    }
  }, [clinicalData, geminiConfig]);

  useEffect(() => {
    if (open && clinicalData && hasApiKey && !report.clinicalDiagnosis && !loading) {
      generateReport();
    }
    if (!open) {
      setReport(EMPTY_REPORT);
      setError(null);
      setCopied(false);
      setSaved(false);
    }
  }, [open, clinicalData, hasApiKey, report.clinicalDiagnosis, loading, generateReport]);

  const handleCopy = async () => {
    const text = formatReportText(report, physio, activeEquipment);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    let techniquesSummary: string | undefined;
    try {
      if (hasApiKey && report.treatmentPlan) {
        const prompt = buildTechniquesSummaryPrompt(report.treatmentPlan, activeEquipment);
        const raw = await callGemini(prompt, geminiConfig);
        const result = parseTechniquesSummaryResult(raw);
        techniquesSummary = result.techniquesSummary || undefined;
      }
    } catch {
      // techniquesSummary is optional — save without it
    } finally {
      onSave(report, techniquesSummary);
      setSaving(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    }
  };

  const updateField = (field: keyof ClinicalReportResult, value: string) => {
    setReport((prev) => ({ ...prev, [field]: value }));
    setSaved(false);
  };

  const firstEva = sessions[0]?.eva || 0;
  const lastEva = sessions[sessions.length - 1]?.eva || 0;
  const improvement = firstEva > 0 ? Math.round(((firstEva - lastEva) / firstEva) * 100) : 0;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Historia Clínica"
      subtitle="Informe estructurado generado por IA — editable"
      size="xl"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cerrar</Button>
          <Button variant="outline" onClick={generateReport} disabled={loading || !hasApiKey}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Brain className="h-4 w-4" />}
            Regenerar con IA
          </Button>
          <Button onClick={handleCopy} disabled={loading || !report.clinicalDiagnosis}>
            {copied ? (
              <><Check className="h-4 w-4" /> Copiado</>
            ) : (
              <><Copy className="h-4 w-4" /> Copiar al portapapeles</>
            )}
          </Button>
          <Button onClick={handleSave} disabled={loading || saving || !report.clinicalDiagnosis}>
            {saving ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Guardando…</>
            ) : saved ? (
              <><Check className="h-4 w-4" /> Guardado</>
            ) : (
              <><Save className="h-4 w-4" /> Guardar en expediente</>
            )}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {loading && (
          <div className="flex items-center gap-3 rounded-xl border border-primary-100 bg-primary-50 p-4">
            <Loader2 className="h-5 w-5 animate-spin text-primary-600" />
            <p className="text-sm text-primary-700">
              Generando informe con Gemini… Se envían todos los datos clínicos recopilados.
            </p>
          </div>
        )}
        {error && (
          <div className="flex items-center gap-3 rounded-xl border border-error-200 bg-error-50 p-4">
            <p className="text-sm text-error-700">{error}</p>
          </div>
        )}
        {!hasApiKey && !loading && (
          <div className="flex items-center gap-3 rounded-xl border border-warning-200 bg-warning-50 p-4">
            <p className="text-sm text-warning-800">
              Sin API key de Gemini configurada. Configúrala en Ajustes o en VITE_GEMINI_API_KEY para generar el informe con IA.
            </p>
          </div>
        )}

        <EditableBlock
          number={1}
          icon={<FileText className="h-5 w-5" />}
          title="Diagnóstico Fisioterápico"
          value={report.clinicalDiagnosis}
          onChange={(v) => updateField('clinicalDiagnosis', v)}
          placeholder="Redacción profesional del diagnóstico fisioterápico…"
          rows={6}
        />

        <EditableBlock
          number={2}
          icon={<Target className="h-5 w-5" />}
          title="Objetivos Terapéuticos (SMART)"
          value={report.therapeuticGoals}
          onChange={(v) => updateField('therapeuticGoals', v)}
          placeholder="Objetivos a corto y medio/largo plazo…"
          rows={5}
        />

        <EditableBlock
          number={3}
          icon={<Stethoscope className="h-5 w-5" />}
          title="Plan de Tratamiento"
          badge={`Material: ${activeEquipment.length} disponible(s)`}
          value={report.treatmentPlan}
          onChange={(v) => updateField('treatmentPlan', v)}
          placeholder="Plan de tratamiento personalizado según equipamiento…"
          rows={6}
        />

        <EditableBlock
          number={4}
          icon={<Activity className="h-5 w-5" />}
          title="Signo Comparable y Métrica de Retest"
          value={report.relevantAsteriskSign}
          onChange={(v) => updateField('relevantAsteriskSign', v)}
          placeholder="Signo comparable de referencia y métrica de retest…"
          rows={4}
        />

        <EditableBlock
          number={5}
          icon={<HeartHandshake className="h-5 w-5" />}
          title="Explicación al Paciente (Anti-Nocebo)"
          value={report.antiNoceboExplanation}
          onChange={(v) => updateField('antiNoceboExplanation', v)}
          placeholder="Explicación empoderadora basada en capacidad de carga, adaptación tisular y neurofisiología del dolor…"
          rows={4}
        />

        {sessions.length > 0 && (
          <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Evolución de sesiones (EVA {firstEva}→{lastEva} · {improvement}% mejora)
            </p>
            <div className="space-y-1.5">
              {sessions.map((s) => (
                <div key={s.id} className="flex items-center gap-3 text-sm">
                  <span className="w-24 text-slate-500">{formatDateShort(s.date)}</span>
                  <span className="flex h-6 w-6 items-center justify-center rounded bg-error-50 text-xs font-bold text-error-600">
                    {s.eva}
                  </span>
                  {s.techniquesSummary ? (
                    <span className="truncate text-xs font-medium text-secondary-700">{s.techniquesSummary}</span>
                  ) : (
                    <span className="text-slate-600">{s.retest}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center gap-2 text-xs text-slate-400">
          <Clipboard className="h-3.5 w-3.5" />
          Informe generado por FisioCopilot · Profesional: {physio} ·
          {' '}{new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}
        </div>
      </div>
    </Modal>
  );
}

function EditableBlock({
  number, icon, title, badge, value, onChange, placeholder, rows = 4,
}: {
  number: number;
  icon: React.ReactNode;
  title: string;
  badge?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  rows?: number;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
            {icon}
          </span>
          <h3 className="text-sm font-semibold text-slate-800">
            <span className="mr-2 text-slate-400">{number}.</span>
            {title}
          </h3>
        </div>
        {badge && (
          <span className="rounded-md bg-slate-100 px-2.5 py-1 text-xs text-slate-500">
            {badge}
          </span>
        )}
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        disabled={false}
        className="w-full resize-y rounded-lg border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm leading-relaxed text-slate-700 outline-none transition-colors focus:border-primary-400 focus:bg-white focus:ring-2 focus:ring-primary-100 disabled:cursor-not-allowed disabled:opacity-50"
      />
    </div>
  );
}

function formatReportText(
  report: ClinicalReportResult,
  physio: string,
  activeEquipment: string[],
): string {
  const lines: string[] = [];
  lines.push('═══════════════════════════════════════════════════');
  lines.push('         HISTORIA CLÍNICA DE FISIOTERAPIA          ');
  lines.push('              FisioCopilot · Asistente Clínico     ');
  lines.push('═══════════════════════════════════════════════════');
  lines.push(`Fecha: ${new Date().toLocaleDateString('es-ES')}`);
  lines.push(`Profesional responsable: ${physio}`);
  lines.push(`Material disponible: ${activeEquipment.join(', ') || 'no configurado'}`);
  lines.push('');
  lines.push('1. DIAGNÓSTICO FISIOTERÁPICO');
  lines.push('─'.repeat(50));
  lines.push(report.clinicalDiagnosis);
  lines.push('');
  lines.push('2. OBJETIVOS TERAPÉUTICOS');
  lines.push('─'.repeat(50));
  lines.push(report.therapeuticGoals);
  lines.push('');
  lines.push('3. PLAN DE TRATAMIENTO');
  lines.push('─'.repeat(50));
  lines.push(report.treatmentPlan);
  lines.push('');
  lines.push('4. SIGNO COMPARABLE Y MÉTRICA DE RETEST');
  lines.push('─'.repeat(50));
  lines.push(report.relevantAsteriskSign);
  lines.push('');
  lines.push('5. EXPLICACIÓN AL PACIENTE (ANTI-NOCEBO)');
  lines.push('─'.repeat(50));
  lines.push(report.antiNoceboExplanation);
  lines.push('');
  lines.push('═══════════════════════════════════════════════════');
  return lines.join('\n');
}

function formatDateShort(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
}