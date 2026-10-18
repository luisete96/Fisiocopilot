import type {
  GeminiConfig,
  AIHypothesisResult,
  ClinicalReportResult,
  ClinicalData,
  AIAnalyzeResult,
  SignoAsterisco,
  TranscriptResult,
  TechniquesSummaryResult,
  SonoTargetsResult,
} from './types';

interface GeminiResponse {
  candidates: Array<{
    content: {
      parts: Array<{ text: string }>;
    };
  }>;
}

interface GeminiResponseSchema {
  type: 'OBJECT' | 'ARRAY' | 'STRING' | 'NUMBER' | 'INTEGER';
  description?: string;
  properties?: Record<string, GeminiResponseSchema>;
  items?: GeminiResponseSchema;
  required?: string[];
  propertyOrdering?: string[];
}

export const DEFAULT_MODEL = 'gemini-3.8-flash';

export const GEMINI_TIMEOUT_MS = 60000;
export const CLINICAL_REPORT_TIMEOUT_MS = 60000;
export const GEMINI_MAX_OUTPUT_TOKENS = 4096;
export const TRIAJE_MAX_OUTPUT_TOKENS = 2048;
export const TESTS_MAX_OUTPUT_TOKENS = 2048;
export const HYPOTHESIS_MAX_OUTPUT_TOKENS = 3500;

export const CLINICAL_REPORT_RESPONSE_SCHEMA: GeminiResponseSchema = {
  type: 'OBJECT',
  properties: {
    clinicalDiagnosis: {
      type: 'STRING',
      description: 'Diagnóstico fisioterápico completo fundamentado en las hipótesis y en los tests positivos y negativos.',
    },
    therapeuticGoals: {
      type: 'STRING',
      description: 'Objetivos terapéuticos SMART a corto, medio y largo plazo.',
    },
    treatmentPlan: {
      type: 'STRING',
      description: 'Plan de tratamiento detallado (técnicas invasivas/aparatología con dosimetría y ejercicio terapéutico adaptado).',
    },
    relevantAsteriskSign: {
      type: 'STRING',
      description: 'Signo o gesto funcional comparable diana y métrica objetiva de retest (EVA, ROM o fuerza).',
    },
    antiNoceboExplanation: {
      type: 'STRING',
      description: 'Explicación educativa y empoderadora para el paciente con enfoque anti-nocebo.',
    },
  },
  required: [
    'clinicalDiagnosis',
    'therapeuticGoals',
    'treatmentPlan',
    'relevantAsteriskSign',
    'antiNoceboExplanation',
  ],
  propertyOrdering: [
    'clinicalDiagnosis',
    'therapeuticGoals',
    'treatmentPlan',
    'relevantAsteriskSign',
    'antiNoceboExplanation',
  ],
};

export const TRIAJE_RESPONSE_SCHEMA: GeminiResponseSchema = {
  type: 'OBJECT',
  properties: {
    dynamicQuestions: { type: 'ARRAY', items: { type: 'STRING' } },
    dichotomousFindings: { type: 'ARRAY', items: { type: 'STRING' } },
    redFlags: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          label: { type: 'STRING' },
          detail: { type: 'STRING' },
          discardLabel: { type: 'STRING' },
        },
        required: ['label', 'detail', 'discardLabel'],
        propertyOrdering: ['label', 'detail', 'discardLabel'],
      },
    },
    yellowFlags: { type: 'ARRAY', items: { type: 'STRING' } },
    questionsToReevaluate: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          questionText: { type: 'STRING' },
          reason: { type: 'STRING' },
        },
        required: ['questionText', 'reason'],
        propertyOrdering: ['questionText', 'reason'],
      },
    },
  },
  required: ['dynamicQuestions', 'dichotomousFindings', 'redFlags', 'yellowFlags'],
  propertyOrdering: ['dynamicQuestions', 'dichotomousFindings', 'redFlags', 'yellowFlags', 'questionsToReevaluate'],
};

export const TESTS_RESPONSE_SCHEMA: GeminiResponseSchema = {
  type: 'OBJECT',
  properties: {
    orthopedicTests: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          name: { type: 'STRING' },
          region: { type: 'STRING' },
          description: { type: 'STRING' },
          position: { type: 'STRING' },
          maneuver: { type: 'STRING' },
          positiveCriteria: { type: 'STRING' },
          sensitivity: {
            type: 'INTEGER',
            description: 'Sensibilidad diagnóstica aproximada según la literatura, porcentaje entero de 0 a 100 (ejemplo: 79 para 79%).',
          },
          specificity: {
            type: 'INTEGER',
            description: 'Especificidad diagnóstica aproximada según la literatura, porcentaje entero de 0 a 100 (ejemplo: 88 para 88%).',
          },
        },
        required: [
          'name',
          'region',
          'description',
          'position',
          'maneuver',
          'positiveCriteria',
          'sensitivity',
          'specificity',
        ],
        propertyOrdering: [
          'name',
          'region',
          'description',
          'position',
          'maneuver',
          'positiveCriteria',
          'sensitivity',
          'specificity',
        ],
      },
    },
    testsToRetest: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          testName: { type: 'STRING' },
          reason: { type: 'STRING' },
        },
        required: ['testName', 'reason'],
        propertyOrdering: ['testName', 'reason'],
      },
    },
  },
  required: ['orthopedicTests'],
  propertyOrdering: ['orthopedicTests', 'testsToRetest'],
};

export const HYPOTHESIS_RESPONSE_SCHEMA: GeminiResponseSchema = {
  type: 'OBJECT',
  properties: {
    primaryHypothesis: {
      type: 'OBJECT',
      properties: {
        name: { type: 'STRING', description: 'Nombre clínico de la hipótesis principal' },
        percentage: { type: 'INTEGER', description: 'Probabilidad estimada de 0 a 100' },
        justification: { type: 'STRING', description: 'Justificación clínica basada en anamnesis y tests' },
        painPhenotype: { type: 'STRING', description: 'Ej: Nociceptivo mecánico, Neuropático periférico, Nociplástico' },
      },
      required: ['name', 'percentage', 'justification', 'painPhenotype'],
      propertyOrdering: ['name', 'percentage', 'justification', 'painPhenotype'],
    },
    differentialHypotheses: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          name: { type: 'STRING', description: 'Entidad clínica diferencial a descartar' },
          percentage: { type: 'INTEGER', description: 'Probabilidad estimada de 0 a 100' },
          differentialTest: { type: 'STRING', description: 'Criterio clínico o maniobra clave para descartarla frente a la principal' },
          painPhenotype: { type: 'STRING', description: 'Fenotipo de dolor predominante' },
        },
        required: ['name', 'percentage', 'differentialTest', 'painPhenotype'],
        propertyOrdering: ['name', 'percentage', 'differentialTest', 'painPhenotype'],
      },
    },
    prognosis: {
      type: 'STRING',
      description: 'Pronóstico clínico fundamentado',
    },
    recoveryTime: {
      type: 'STRING',
      description: 'Tiempo estimado de recuperación funcional (ej: 4-6 semanas)',
    },
    treatmentGuidelines: {
      type: 'STRING',
      description: 'Pautas clave y propuesta inicial de tratamiento/técnicas con dosimetría',
    },
    targetFunctionalGesture: {
      type: 'STRING',
      description: 'Gesto o movimiento funcional diana que reproduce el dolor o limitación',
    },
    signoAsterisco: {
      type: 'OBJECT',
      properties: {
        gestoFuncional: { type: 'STRING' },
        parametroEvaluado: { type: 'STRING' },
        evaBasalSugerida: { type: 'INTEGER' },
        instruccionesTestRetest: { type: 'STRING' },
      },
      required: ['gestoFuncional', 'parametroEvaluado', 'evaBasalSugerida', 'instruccionesTestRetest'],
      propertyOrdering: ['gestoFuncional', 'parametroEvaluado', 'evaBasalSugerida', 'instruccionesTestRetest'],
    },
  },
  required: [
    'primaryHypothesis',
    'differentialHypotheses',
    'prognosis',
    'recoveryTime',
    'treatmentGuidelines',
    'targetFunctionalGesture',
    'signoAsterisco',
  ],
  propertyOrdering: [
    'primaryHypothesis',
    'differentialHypotheses',
    'prognosis',
    'recoveryTime',
    'treatmentGuidelines',
    'targetFunctionalGesture',
    'signoAsterisco',
  ],
};

const RETRY_DELAYS_MS = [1000, 2000];
const RETRYABLE_STATUS = new Set([429, 500, 503]);

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function callGeminiDirect(
  model: string,
  prompt: string,
  apiKey: string,
  timeoutMs: number,
  maxOutputTokens: number,
  responseSchema?: GeminiResponseSchema,
): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${apiKey}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens,
          responseMimeType: 'application/json',
          ...(responseSchema ? { responseSchema } : {}),
        },
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error('Detalle del error devuelto por Google:', errorBody);
      const err = new Error(`Error ${response.status}: ${errorBody}`);
      (err as Error & { status?: number }).status = response.status;
      throw err;
    }

    const data = (await response.json()) as GeminiResponse;
    const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!textResponse) {
      throw new Error('Respuesta vacía de Gemini.');
    }
    return textResponse;
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error(`La petición a Gemini tardó más de ${timeoutMs / 1000}s y fue cancelada.`);
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function callModelWithRetry(
  model: string,
  prompt: string,
  apiKey: string,
  timeoutMs: number,
  maxOutputTokens: number,
  responseSchema?: GeminiResponseSchema,
): Promise<string> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    try {
      return await callGeminiDirect(model, prompt, apiKey, timeoutMs, maxOutputTokens, responseSchema);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      const status = (lastError as Error & { status?: number }).status;

      const isClientError =
        status !== undefined && status >= 400 && status < 500 && !RETRYABLE_STATUS.has(status);
      if (isClientError) {
        throw lastError;
      }

      if (attempt < RETRY_DELAYS_MS.length) {
        await sleep(RETRY_DELAYS_MS[attempt]);
        continue;
      }
      throw lastError;
    }
  }

  throw lastError ?? new Error(`El modelo ${model} falló tras varios intentos.`);
}

export async function callGemini(
  prompt: string,
  config: GeminiConfig,
  options: {
    timeoutMs?: number;
    maxOutputTokens?: number;
    responseSchema?: GeminiResponseSchema;
  } = {},
): Promise<string> {
  const apiKey = config?.apiKey?.trim() || import.meta.env.VITE_GEMINI_API_KEY?.trim() || '';
  if (!apiKey) {
    throw new Error('No se ha configurado la API Key de Google Gemini. Abre Ajustes e introduce tu clave.');
  }

  const timeoutMs = options.timeoutMs ?? GEMINI_TIMEOUT_MS;
  const maxOutputTokens = options.maxOutputTokens ?? GEMINI_MAX_OUTPUT_TOKENS;

  return callModelWithRetry(DEFAULT_MODEL, prompt, apiKey, timeoutMs, maxOutputTokens, options.responseSchema);
}

function stripJsonFence(raw: string): string {
  let cleaned = raw.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim();
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    cleaned = cleaned.slice(firstBrace, lastBrace + 1);
  }
  return cleaned.trim();
}

export function parseHypothesisResult(raw: string): AIHypothesisResult {
  const cleaned = stripJsonFence(raw);
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    const repaired = cleaned
      .replace(/[“”]/g, '"')
      .replace(/[‘’]/g, "'")
      .replace(/,\s*([}\]])/g, '$1');
    try {
      parsed = JSON.parse(repaired);
    } catch {
      const extractString = (key: string): string => {
        const match = raw.match(new RegExp(`"${key}"\\s*:\\s*"((?:\\\\.|[^"\\\\])*)(?:"|$)`));
        if (!match) return '';
        try {
          return JSON.parse(`"${match[1]}"`) as string;
        } catch {
          return match[1];
        }
      };
      const recoverArray = (key: string): string[] => {
        const match = raw.match(new RegExp(`"${key}"\\s*:\\s*\\[([\\s\\S]*?)(?:\\]|$)`));
        if (!match) return [];
        return Array.from(match[1].matchAll(/"((?:\\.|[^"\\])*)"/g), ([, value]) => {
          try {
            return JSON.parse(`"${value}"`) as string;
          } catch {
            return value;
          }
        });
      };
      const recoveredHypotheses = recoverArray('hypotheses');
      const recoveredDifferentials = recoverArray('differentialDiagnosis');
      const recoveredName = extractString('name') || recoveredHypotheses[0] || 'Hipótesis en revisión';
      parsed = {
        hypotheses: recoveredHypotheses.length > 0 ? recoveredHypotheses : [recoveredName],
        differentialDiagnosis: recoveredDifferentials,
        prognosis: extractString('prognosis'),
        recoveryTime: extractString('recoveryTime'),
        treatmentGuidelines: extractString('treatmentGuidelines') || extractString('recommendedTreatment'),
        targetFunctionalGesture:
          extractString('targetFunctionalGesture') ||
          extractString('gestoFuncional') ||
          extractString('gesto'),
        primaryHypothesis: {
          name: recoveredName,
          percentage: 70,
          justification: extractString('justification'),
          painPhenotype: extractString('painPhenotype') || 'Mecánico',
        },
        differentialHypotheses: [],
        suggestedTests: recoverArray('suggestedTests'),
        recommendedTreatment: extractString('treatmentGuidelines') || extractString('recommendedTreatment'),
        signoAsterisco: {
          gestoFuncional: extractString('targetFunctionalGesture') || extractString('gestoFuncional'),
          parametroEvaluado: 'Dolor (EVA)',
          evaBasalSugerida: 5,
          instruccionesTestRetest: extractString('instruccionesTestRetest'),
        },
      };
    }
  }

  const asObject = (value: unknown): Record<string, unknown> =>
    value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};

  const obj = asObject(parsed);
  const primary = asObject(obj.primaryHypothesis);

  const differentials = Array.isArray(obj.differentialHypotheses)
    ? obj.differentialHypotheses.map((value) => {
        const d = asObject(value);
        return {
          name: String(d.name ?? '').trim(),
          percentage: Number.isFinite(Number(d.percentage)) ? Number(d.percentage) : 30,
          differentialTest: String(d.differentialTest ?? '').trim(),
          painPhenotype: String(d.painPhenotype ?? '').trim(),
        };
      }).filter((d) => Boolean(d.name))
    : [];

  const hypothesisNames = Array.isArray(obj.hypotheses)
    ? obj.hypotheses.map((value) => String(value).trim()).filter(Boolean)
    : [];
  const differentialNames = Array.isArray(obj.differentialDiagnosis)
    ? obj.differentialDiagnosis.map((value) => String(value).trim()).filter(Boolean)
    : [];

  const primaryName = String(primary.name ?? hypothesisNames[0] ?? '').trim();

  const normalizedHypotheses =
    hypothesisNames.length > 0
      ? hypothesisNames
      : [primaryName, ...differentials.map((d) => d.name)].filter(Boolean);

  const normalizedDifferentialDiagnosis =
    differentialNames.length > 0
      ? differentialNames
      : differentials.map((d) =>
          d.differentialTest ? `${d.name} — ${d.differentialTest}` : d.name,
        );

  const finalDifferentials =
    differentials.length > 0
      ? differentials
      : normalizedDifferentialDiagnosis.slice(0, 2).map((item) => {
          const [namePart, ...rest] = item.split('—');
          return {
            name: (namePart || item).trim(),
            percentage: 25,
            differentialTest: rest.join('—').trim() || 'Valorar mediante test específico',
            painPhenotype: String(primary.painPhenotype ?? 'Mecánico'),
          };
        });

  const prognosisObj = asObject(obj.prognosis);
  const suggestedTests = Array.isArray(obj.suggestedTests)
    ? (obj.suggestedTests as unknown[]).map((t) => String(t))
    : [];

  const signoRaw = asObject(obj.signoAsterisco);
  const evaBasal = Number(signoRaw.evaBasal ?? signoRaw.evaBasalSugerida ?? 5);

  const targetFunctionalGesture = String(
    [
      obj.targetFunctionalGesture,
      signoRaw.gestoFuncional,
      signoRaw.gesto,
    ].find((value) => typeof value === 'string' && value.trim()) ?? '',
  ).trim();

  const legacyAsteriskSign: SignoAsterisco = {
    gestoFuncional: targetFunctionalGesture,
    parametroEvaluado: String(signoRaw.parametro ?? signoRaw.parametroEvaluado ?? 'Dolor (EVA)'),
    evaBasalSugerida: Number.isFinite(evaBasal) ? Math.min(10, Math.max(0, evaBasal)) : 5,
    instruccionesTestRetest: String(signoRaw.instruccionesTestRetest ?? ''),
  };

  const prognosisText = String(
    (typeof obj.prognosis === 'string' ? obj.prognosis : prognosisObj.text) ?? '',
  ).trim();

  const treatmentGuidelines = String(
    obj.treatmentGuidelines ?? obj.recommendedTreatment ?? '',
  ).trim();

  const recoveryTime =
    String(obj.recoveryTime ?? '').trim() ||
    String(prognosisObj.recoveryTime ?? '').trim() ||
    '4-6 semanas (según evolución)';

  const normalizedPrognosis =
    prognosisText || 'Pronóstico favorable sujeto a respuesta a la carga.';
  const normalizedTreatment =
    treatmentGuidelines || 'Propuesta de tratamiento pendiente de definir.';

  return {
    hypotheses: normalizedHypotheses,
    differentialDiagnosis: normalizedDifferentialDiagnosis,
    prognosisText: normalizedPrognosis,
    recoveryTime,
    treatmentGuidelines: normalizedTreatment,
    targetFunctionalGesture,
    primaryHypothesis: {
      name: primaryName || 'Hipótesis clínica principal',
      percentage: Number.isFinite(Number(primary.percentage)) ? Number(primary.percentage) : 75,
      justification: String(primary.justification ?? ''),
      painPhenotype: String(primary.painPhenotype ?? 'Nociceptivo mecánico'),
    },
    differentialHypotheses: finalDifferentials,
    prognosis: {
      text: normalizedPrognosis,
      grade1: String(prognosisObj.grade1 ?? ''),
      grade2: String(prognosisObj.grade2 ?? ''),
      grade3: String(prognosisObj.grade3 ?? ''),
      recoveryTime,
    },
    suggestedTests,
    recommendedTreatment: normalizedTreatment,
    signoAsterisco: legacyAsteriskSign,
  };
}

export function buildHypothesisPrompt(context: {
  anamnesis: { que: string; porque: string; desde: string };
  region: string;
  testResults: string;
  redFlags: string;
  freeExploration: string;
  comparableSign: string;
  equipment: string;
  dichotomousFindings?: { positive: string[]; negative: string[] };
  sonoFindings?: string;
  isFollowUp?: boolean;
  priorTreatment?: string;
  evolucionTejido?: string;
  nuevasSensaciones?: string;
  priorHypotheses?: string;
  evolutionFindings?: string;
  equipmentSafety?: ClinicalData['equipmentSafety'];
}): string {
  const findingsStr = context.dichotomousFindings
    ? `\nHallazgos confirmados (SÍ): ${context.dichotomousFindings.positive.join('; ') || 'ninguno'}\nHallazgos descartados (NO): ${context.dichotomousFindings.negative.join('; ') || 'ninguno'}`
    : '';
  const sonoStr = context.sonoFindings
    ? `\nHallazgos ecográficos: ${context.sonoFindings}`
    : '';
  const followUpStr = context.isFollowUp
    ? `\n\nSESIÓN DE SEGUIMIENTO — RECÁLCULO DE HIPÓTESIS:\nTratamiento anterior aplicado: ${context.priorTreatment || 'no registrado'}\nRespuesta del tejido a 24-48h: ${context.evolucionTejido || 'no descrita'}\nNuevas sensaciones / cambios: ${context.nuevasSensaciones || 'ninguna'}\nHipótesis anteriores: ${context.priorHypotheses || 'no registradas'}\nCambios de preguntas y re-tests de hoy: ${context.evolutionFindings || 'ninguno registrado'}\nMantén trazabilidad de las hipótesis anteriores en la justificación y el diagnóstico, indicando remisión/resolución si corresponde, y recalcula plan y dosimetría para la diana clínica actual.`
    : '';
  const asteriskRule = context.isFollowUp
    ? '\nREGLA INMUTABLE DEL SIGNO ASTERISCO: el gesto/test de referencia comunicado arriba es el definido en la valoración inicial. No lo redefinas, no lo reformules ni propongas otro; evalúa únicamente la respuesta actual sobre exactamente ese mismo gesto.'
    : '';
  const safetyGuidance = formatEquipmentSafetyGuidance(context.equipmentSafety);

  return `Eres un asistente experto de razonamiento clínico para fisioterapeutas. Analiza los datos del paciente y devuelve EXCLUSIVAMENTE un objeto JSON válido, sin bloques markdown.

Datos del caso:
- Síntoma principal: ${context.anamnesis?.que || 'no registrado'}
- Mecanismo: ${context.anamnesis?.porque || 'no registrado'}
- Temporalidad: ${context.anamnesis?.desde || 'no registrada'}
- Región afectada: ${context.region}
- Resultados de tests: ${context.testResults}
- Banderas rojas: ${context.redFlags}
- Exploración libre: ${context.freeExploration}
- Signo comparable actual: ${context.comparableSign}${asteriskRule}
- Material disponible en la clínica: ${context.equipment || 'ninguno'}${findingsStr}${sonoStr}${followUpStr}${safetyGuidance}

En la propuesta de tratamiento, excluye estrictamente todas las técnicas contraindicadas por los checks positivos. Prioriza las alternativas permitidas indicadas. Si un check positivo no enumera alternativas (p. ej., proceso tumoral activo local), no apliques agentes físicos ni abordajes sobre esa zona y recomienda coordinación/valoración médica antes de tratarla.

Devuelve un objeto JSON con esta estructura exacta:
{
  "primaryHypothesis": {
    "name": "Nombre de la entidad clínica más probable",
    "percentage": 75,
    "justification": "Justificación clínica integrando anamnesis y tests positivos/negativos",
    "painPhenotype": "Nociceptivo mecánico / Neuropático periférico / Nociplástico"
  },
  "differentialHypotheses": [
    {
      "name": "Primera entidad diferencial a descartar",
      "percentage": 20,
      "differentialTest": "Test o hallazgo clínico concreto para descartarla o confirmarla",
      "painPhenotype": "Fenotipo de dolor"
    },
    {
      "name": "Segunda entidad diferencial a descartar",
      "percentage": 10,
      "differentialTest": "Test o hallazgo clínico concreto para descartarla o confirmarla",
      "painPhenotype": "Fenotipo de dolor"
    }
  ],
  "prognosis": "Pronóstico clínico fundamentado en los hallazgos y la evolución",
  "recoveryTime": "Tiempo estimado de recuperación funcional (ej: 4-6 semanas)",
  "treatmentGuidelines": "Pautas clave y propuesta de tratamiento con dosimetría exacta según el material disponible",
  "targetFunctionalGesture": "${context.isFollowUp ? 'No modificar el Signo Asterisco de referencia indicado arriba' : 'Gesto o movimiento funcional diana observable que reproduce el síntoma (ej: Elevación activa de hombro >90°)'}",
  "signoAsterisco": {
    "gestoFuncional": "${context.isFollowUp ? 'Repetir exactamente el Signo Asterisco de referencia indicado arriba, sin cambios' : 'Mismo gesto funcional diana observable'}",
    "parametroEvaluado": "Dolor (EVA)",
    "evaBasalSugerida": 6,
    "instruccionesTestRetest": "Instrucción breve de cómo medir antes y después de la sesión"
  }
}

REGLAS CRÍTICAS:
- Incluye siempre 1 primaryHypothesis y 2 elementos en differentialHypotheses con su differentialTest claro para poder descartarlas.
- targetFunctionalGesture y signoAsterisco.gestoFuncional son obligatorios y nunca deben ir vacíos. En seguimiento, repite literalmente el Signo Asterisco de referencia y no lo cambies.
- En treatmentGuidelines incluye dosimetría real del material disponible (EPI/EPTE en mA/segundos, NMP en Hz/µs, Diatermia, SIS, Ondas de choque en bares/disparos y Ejercicio terapéutico).`;
}

function formatEquipmentSafetyGuidance(checks: ClinicalData['equipmentSafety']): string {
  const positiveChecks = (checks ?? []).filter((check) => check.present === true);
  if (positiveChecks.length === 0) return '\n\nSEGURIDAD DE APARATOLOGÍA: no hay contraindicaciones marcadas como presentes.';

  return `\n\nRESTRICCIONES CLÍNICAS DE SEGURIDAD (respuestas "Presente / Sí"):\n${positiveChecks
    .map((check) => {
      const contraindicatedTechniques = check.contraindicatedTechniques ?? [];
      const allowedTechniques = check.allowedTechniques ?? [];
      const contraindicated = contraindicatedTechniques.length > 0
        ? contraindicatedTechniques.join('; ')
        : 'no aplicar técnicas sobre el tejido/zona afectada sin valoración médica';
      const allowed = allowedTechniques.length > 0
        ? allowedTechniques.join('; ')
        : 'no hay alternativas preautorizadas; requiere valoración/coordinación médica antes de tratar la zona afectada';
      return `- ${check.label}\n  ⛔ Contraindicado: ${contraindicated}\n  ✅ Permitido/alternativas: ${allowed}`;
    })
    .join('\n')}\nNo recomendar ni incluir dosimetría de ninguna técnica contraindicada. Las restricciones tienen prioridad sobre el material disponible.`;
}

export function buildClinicalReportPrompt(data: ClinicalData): string {
  const hypotheses = data.hypotheses ?? [];
  const tests = data.tests ?? [];
  const dichotomous = data.dichotomousFindings ?? [];
  const redFlagsList = data.redFlags ?? [];
  const yellowFlagsList = data.yellowFlags ?? [];
  const sonoList = data.sonoFindings ?? [];

  const primary = hypotheses.find((h) => h.isPrimary);

  const normalizeResult = (result: string | null | undefined): 'positivo' | 'negativo' | 'sin valorar' => {
    const normalized = String(result ?? '').trim().toLocaleLowerCase('es');
    if (['positivo', 'positive', '+'].includes(normalized)) return 'positivo';
    if (['negativo', 'negative', '-'].includes(normalized)) return 'negativo';
    return 'sin valorar';
  };

  const positiveTests = tests
    .filter((test) => normalizeResult(test.result) === 'positivo')
    .map((test) => test.name);
  const negativeTests = tests
    .filter((test) => normalizeResult(test.result) === 'negativo')
    .map((test) => test.name);

  const answeredFindings = dichotomous
    .filter((finding) => ['yes', 'no', 'sí', 'si'].includes(String(finding.answer ?? '').trim().toLocaleLowerCase('es')))
    .map((finding) => `${finding.label}: ${finding.answer}${finding.note ? ` (${finding.note})` : ''}`);

  const redFlags = redFlagsList.map((flag) => `${flag.label}: ${flag.status}`);
  const yellowFlags = yellowFlagsList.filter((flag) => flag.checked).map((flag) => flag.label);

  const hypothesisSummary = hypotheses.map((hypothesis) =>
    `${hypothesis.isPrimary ? 'Principal' : 'Diferencial'}: ${hypothesis.label}` +
    `${hypothesis.painPhenotype ? ` (fenotipo: ${hypothesis.painPhenotype})` : ''}` +
    `${hypothesis.justification ? ` — ${hypothesis.justification}` : ''}` +
    `${hypothesis.differentialTest ? ` — Criterio diferencial: ${hypothesis.differentialTest}` : ''}`,
  );
  const previousHypothesisSummary = (data.previousHypotheses ?? []).map((hypothesis) =>
    `${hypothesis.isPrimary ? 'Principal' : 'Diferencial'}: ${hypothesis.label}` +
    `${hypothesis.justification ? ` — ${hypothesis.justification}` : ''}`,
  );
  const evolutionSummary = [
    ...(data.evolution?.tissueResponse ? [`Respuesta tisular: ${data.evolution.tissueResponse}`] : []),
    ...(data.evolution?.perceivedChanges ? [`Cambios percibidos: ${data.evolution.perceivedChanges}`] : []),
    ...dichotomous
      .filter((finding) => finding.evolutionStatus)
      .map((finding) => `Pregunta "${finding.label}": inicial ${finding.previousAnswer || 'sin dato'} → ${finding.evolutionStatus}`),
    ...tests
      .filter((test) => test.evolutionStatus)
      .map((test) => `Re-test "${test.name}": inicial ${test.previousResult || 'sin dato'} → ${test.evolutionStatus}`),
  ];

  const equipmentLabels: Record<string, string> = {
    ecografo: 'Ecógrafo musculoesquelético',
    camilla: 'Camilla',
    dinamometro: 'Dinamómetro',
    invasivas: 'Técnicas invasivas (punción seca / electrólisis / neuromodulación percutánea)',
    gimnasio: 'Gimnasio / Pesas / Poleas',
    radiofrecuencia: 'Radiofrecuencia / Diatermia / Tecarterapia',
    superinductive: 'Sistema Superinductivo (SIS)',
    shockwaves_radial: 'Ondas de Choque Radiales (RSWT)',
    shockwaves_focal: 'Ondas de Choque Focales (FSWT)',
  };
  const activeEquipment = Object.entries(data.equipment ?? {})
    .filter(([, v]) => v)
    .map(([k]) => equipmentLabels[k] || k)
    .join(', ');
  const safetyGuidance = formatEquipmentSafetyGuidance(data.equipmentSafety);

  return `Redacta una historia e informe clínico completo de fisioterapia en español integrando TODOS los datos recopilados en la valoración.

DATOS RECOPILADOS DEL PACIENTE:
- Síntoma principal (Qué le pasa): ${data.anamnesis?.que || 'no registrado'}
- Mecanismo lesional (Por qué): ${data.anamnesis?.porque || 'no registrado'}
- Temporalidad (Desde cuándo): ${data.anamnesis?.desde || 'no registrada'}
- Región anatómica: ${data.region || 'no especificada'}
- Preguntas e interrogatorio (Anamnesis dicotómica): ${answeredFindings.join('; ') || 'sin hallazgos marcados'}
- Banderas rojas: ${redFlags.join('; ') || 'descartadas / sin hallazgos'}
- Banderas amarillas: ${yellowFlags.join('; ') || 'ninguna'}
- Tests ortopédicos POSITIVOS: ${positiveTests.join('; ') || 'ninguno'}
- Tests ortopédicos NEGATIVOS: ${negativeTests.join('; ') || 'ninguno'}
- Pruebas complementarias: ${data.complementary || 'no registradas'}
- Ecografía musculoesquelética: ${sonoList.length > 0 ? sonoList.map((s) => `${s.structure}: ${(s.findings ?? []).join(', ')}${s.notes ? ` (${s.notes})` : ''}`).join('; ') : 'no realizada'}
- Exploración libre: ${data.freeExploration || 'no registrada'}
- Hipótesis calculadas: ${hypothesisSummary.join(' | ') || primary?.label || 'pendiente'}
- Hipótesis de la sesión previa: ${previousHypothesisSummary.join(' | ') || 'no disponible'}
- Evolución y cambios en preguntas / re-tests: ${evolutionSummary.join('; ') || 'no hay cambios de seguimiento registrados'}
- Signo comparable / Gesto funcional diana (*): ${data.comparable?.movement || 'no registrado'} (Parámetro: ${data.comparable?.parameter || 'EVA'}, EVA basal: ${data.comparable?.eva ?? '-'}/10${data.comparable?.evaCurrent != null ? `, EVA actual de seguimiento: ${data.comparable.evaCurrent}/10` : ''}${data.comparable?.evaPost != null ? `, EVA post-tratamiento: ${data.comparable.evaPost}/10` : ''})
- Evolución de la limitación funcional respecto al basal: ${data.evolution?.functionalLimitation || 'no descrita'}
- Pronóstico estimado previo: ${data.aiPrognosis?.text || 'no calculado'} (${data.aiPrognosis?.recoveryTime || ''})
- Propuesta terapéutica previa: ${data.aiTreatment || 'no calculada'}
- Material disponible en clínica: ${activeEquipment || 'ninguno'}
${safetyGuidance}

Si es seguimiento, mantén la trazabilidad de las hipótesis previas indicando cuáles están en remisión o resueltas según los re-tests, destaca la diana actual y recalcula el diagnóstico fisioterápico y el plan con dosimetría centrados en ella. El Signo Asterisco mostrado es fijo e inmutable desde la valoración inicial: conserva literalmente su descripción; solo informa la EVA actual y la evolución funcional sobre ese mismo signo.
Respeta las restricciones de seguridad anteriores en el diagnóstico y el plan: no incluyas técnicas contraindicadas ni dosimetría para ellas y favorece solo las alternativas permitidas.

Devuelve EXCLUSIVAMENTE un objeto JSON válido con estas 5 claves exactas (ninguna puede quedar vacía):
{
  "clinicalDiagnosis": "1. Juicio clínico y diagnóstico fisioterápico razonado integrando la historia, los tests positivos, los negativos y el descarte diferencial.",
  "therapeuticGoals": "2. Objetivos terapéuticos SMART a corto y medio/largo plazo.",
  "treatmentPlan": "3. Plan de tratamiento estructurado con las técnicas elegidas, dosimetría y progresión de ejercicio según el material disponible.",
  "relevantAsteriskSign": "4. Descripción del signo comparable diana (*) evaluado, valores basales y criterio objetivo de retest.",
  "antiNoceboExplanation": "5. Explicación clara, tranquilizadora y empoderadora para el paciente (enfoque anti-nocebo basado en adaptación tisular y capacidad de carga)."
}`;
}

export function parseClinicalReportResult(raw: string): ClinicalReportResult {
  const aliases: Record<keyof ClinicalReportResult, string[]> = {
    clinicalDiagnosis: ['clinicalDiagnosis', 'diagnosticoFisioterapico', 'diagnostico', 'diagnosis'],
    therapeuticGoals: ['therapeuticGoals', 'objetivosSMART', 'objetivosTerapeuticos', 'objetivos'],
    treatmentPlan: ['treatmentPlan', 'planTratamiento', 'planDeTratamiento', 'tratamiento'],
    relevantAsteriskSign: ['relevantAsteriskSign', 'signoComparable', 'signoComparableRetest', 'signoAsterisco'],
    antiNoceboExplanation: ['antiNoceboExplanation', 'explicacionAntiNocebo', 'explicacionPaciente'],
  };

  const toFieldText = (value: unknown): string => {
    if (typeof value === 'string') return value.trim();
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    if (Array.isArray(value)) return value.map(toFieldText).filter(Boolean).join('\n');
    if (value && typeof value === 'object') return JSON.stringify(value);
    return '';
  };

  const mapReportFields = (value: unknown): ClinicalReportResult => {
    const source =
      value && typeof value === 'object' && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : {};
    const mapped = {} as ClinicalReportResult;
    for (const field of Object.keys(aliases) as Array<keyof ClinicalReportResult>) {
      const matchingKey = aliases[field].find(
        (key) => Object.prototype.hasOwnProperty.call(source, key) && toFieldText(source[key]),
      );
      mapped[field] = matchingKey ? toFieldText(source[matchingKey]) : '';
    }
    return mapped;
  };

  const recoverFieldsFromMalformedJson = (): ClinicalReportResult => {
    const recovered = {} as ClinicalReportResult;
    for (const field of Object.keys(aliases) as Array<keyof ClinicalReportResult>) {
      let value = '';
      for (const key of aliases[field]) {
        const match = raw.match(new RegExp(`"${key}"\\s*:\\s*"((?:\\\\.|[^"\\\\])*)(?:"|$)`));
        if (!match) continue;
        try {
          value = JSON.parse(`"${match[1]}"`) as string;
        } catch {
          value = match[1];
        }
        if (value.trim()) break;
      }
      recovered[field] = value.trim();
    }
    if (!Object.values(recovered).some(Boolean) && raw.trim()) {
      recovered.clinicalDiagnosis = raw.trim();
    }
    return recovered;
  };

  const cleaned = stripJsonFence(raw);
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    const repaired = cleaned
      .replace(/[“”]/g, '"')
      .replace(/[‘’]/g, "'")
      .replace(/,\s*([}\]])/g, '$1');
    try {
      parsed = JSON.parse(repaired);
    } catch {
      return recoverFieldsFromMalformedJson();
    }
  }

  const mapped = mapReportFields(parsed);
  if (!Object.values(mapped).some(Boolean)) {
    return recoverFieldsFromMalformedJson();
  }
  return mapped;
}

export function buildTriajePrompt(
  anamnesis: { que: string; porque: string; desde: string },
  region: string,
  isFollowUp?: boolean,
  priorFindings?: string,
  priorTests?: string,
  evolucionTejido?: string,
  nuevasSensaciones?: string,
  reevaluationCandidates?: string,
): string {
  const followUpSection = isFollowUp
    ? `\n\nSESIÓN DE SEGUIMIENTO — MODO SEGUIMIENTO INTELIGENTE:\nPreguntas dicotómicas ya respondidas en la valoración previa: ${priorFindings || 'ninguna'}\nTests ortopédicos ya explorados previamente: ${priorTests || 'ninguno'}\nRespuesta del tejido a 24-48h: ${evolucionTejido || 'no descrita'}\nNuevas sensaciones: ${nuevasSensaciones || 'ninguna'}\nAnaliza la evolución y recomienda reevaluar únicamente preguntas previas cuya respuesta pueda haber cambiado o sea clínicamente relevante hoy. Conserva las preguntas previas sin seleccionarlas si no son pertinentes. Devuelve opcionalmente "questionsToReevaluate": [{"questionText":"texto exacto o identificable de la pregunta previa","reason":"motivo clínico breve"}]. No incluyas preguntas nuevas en ese array.\nCandidatas previas: ${reevaluationCandidates || priorFindings || 'ninguna'}`
    : '';

  return `Eres un asistente experto de razonamiento clínico para fisioterapeutas. Con base en la anamnesis inicial del paciente, sugiere preguntas de profundización y afirmaciones dicotómicas (Sí/No) sobre lo que siente el paciente, además de banderas rojas y amarillas.

PROHIBICIÓN ESTRICTA:
Esta fase es EXCLUSIVAMENTE de INTERROGATORIO / ANAMNESIS VERBAL al paciente.
ESTÁ TERMINANTEMENTE PROHIBIDO incluir nombres de tests ortopédicos, pruebas clínicas o maniobras de exploración física (prohibido mencionar Test de Neer, Hawkins, Jobe, Yocum, Speed, Lachman, McMurray, Lasègue, Slump, Tinel, Phalen, etc.) ni preguntar si un test o maniobra da positivo. Las afirmaciones solo pueden tratar sobre síntomas cotidianos que el paciente experimenta y puede contestar con Sí o No (ej. dolor nocturno al apoyarse, hormigueo en los dedos, rigidez matutina, pérdida de fuerza al levantar objetos, chasquidos audibles, bloqueo articular).

DATOS DEL PACIENTE:
- Síntoma principal: ${anamnesis.que}
- Mecanismo: ${anamnesis.porque}
- Temporalidad: ${anamnesis.desde}
- Región afectada: ${region}${followUpSection}

Devuelve EXCLUSIVAMENTE un objeto JSON válido:
{
  "dynamicQuestions": ["Pregunta abierta breve al paciente sobre su dolor o función"],
  "dichotomousFindings": [
    "Afirmación sobre un síntoma del paciente que se contesta Sí o No (SIN mencionar tests físicos)"
  ],
  "redFlags": [
    {
      "label": "Nombre breve",
      "detail": "Criterio clínico a descartar",
      "discardLabel": "Descartar"
    }
  ],
  "yellowFlags": ["Bandera amarilla psicosocial pertinente"]
}

En seguimiento, añade opcionalmente "questionsToReevaluate": [{"questionText":"Pregunta previa seleccionada","reason":"Motivo clínico breve"}].

Reglas:
- Máximo 4 elementos en dynamicQuestions y máximo 6 en dichotomousFindings.
- Máximo 3 redFlags y 3 yellowFlags.
- Responde en español.`;
}

export function buildTestsPrompt(context: {
  anamnesis: { que: string; porque: string; desde: string };
  region: string;
  positiveFindings: string[];
  negativeFindings: string[];
  isFollowUp?: boolean;
  priorTests?: string;
  evolucionTejido?: string;
  nuevasSensaciones?: string;
  reevaluationCandidates?: string;
}): string {
  const followUpSection = context.isFollowUp
    ? `\n\nSESIÓN DE SEGUIMIENTO — MODO SEGUIMIENTO INTELIGENTE:\nTests ortopédicos ya explorados previamente: ${context.priorTests || 'ninguno'}\nRespuesta del tejido: ${context.evolucionTejido || 'no descrita'}\nNuevas sensaciones: ${context.nuevasSensaciones || 'ninguna'}\nRecomienda en "testsToRetest" únicamente tests previos clínicamente relevantes para re-testear hoy, identificándolos por nombre y proporcionando un motivo breve. Conserva lo anterior y añade tests nuevos solo si hace falta.\nCandidatos previos: ${context.reevaluationCandidates || context.priorTests || 'ninguno'}`
    : '';

  return `Sugiere hasta 3 tests ortopédicos o funcionales relevantes para la región y los datos clínicos. Para cada test ortopédico sugerido, incluye OBLIGATORIAMENTE su sensibilidad y especificidad diagnóstica aproximada según la literatura científica (Hegedus, Magee, Cleland, Dutton) como número entero entre 1 y 100 (nunca 0 ni vacío).

DATOS DEL PACIENTE:
- Síntoma principal: ${context.anamnesis.que}
- Mecanismo: ${context.anamnesis.porque}
- Temporalidad: ${context.anamnesis.desde}
- Región afectada: ${context.region}
- Hallazgos confirmados (SÍ): ${context.positiveFindings.join('; ') || 'ninguno'}
- Hallazgos descartados (NO): ${context.negativeFindings.join('; ') || 'ninguno'}${followUpSection}

Devuelve solo un objeto JSON válido con esta estructura:
{
  "orthopedicTests": [
    {
      "name": "Nombre del test",
      "region": "${context.region}",
      "description": "Qué estructura o patología valora",
      "position": "Posición del paciente",
      "maneuver": "Ejecución breve de la maniobra",
      "positiveCriteria": "Signo que confirma que el test es positivo",
      "sensitivity": 79,
      "specificity": 88
    }
  ]
}`;
}

export function parseTriajeResult(raw: string): AIAnalyzeResult {
  const salvageStringArray = (key: string): string[] => {
    const match = raw.match(new RegExp(`"${key}"\\s*:\\s*\\[([\\s\\S]*?)(?:\\]|$)`));
    if (!match) return [];
    const values: string[] = [];
    const stringPattern = /"(?:\\.|[^"\\])*"/g;
    for (const item of match[1].matchAll(stringPattern)) {
      try {
        const value: unknown = JSON.parse(item[0]);
        if (typeof value === 'string' && value.trim()) values.push(value.trim());
      } catch {
        continue;
      }
    }
    return values;
  };

  const fallbackResult = (includePlainText = false): AIAnalyzeResult => {
    const partialQuestions = salvageStringArray('dynamicQuestions').slice(0, 4);
    const partialFindings = salvageStringArray('dichotomousFindings').slice(0, 6);
    const isJsonLike = /^\s*(?:\[|\{)/.test(raw);
    const fallbackQuestions =
      includePlainText && !isJsonLike
        ? raw
            .split(/\r?\n/)
            .map((line) => line.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '').trim())
            .filter(Boolean)
        : [];
    return {
      dynamicQuestions: partialQuestions.length > 0 ? partialQuestions : fallbackQuestions.slice(0, 4),
      dichotomousFindings: partialFindings.map((label, i) => ({
        id: `ai-df-${i}`,
        label,
      })),
      redFlags: [],
      yellowFlags: [],
      orthopedicTests: [],
    };
  };

  const cleaned = stripJsonFence(raw);
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    const repaired = cleaned.replace(/[“”]/g, '"').replace(/,\s*([}\]])/g, '$1');
    try {
      parsed = JSON.parse(repaired);
    } catch {
      return fallbackResult(true);
    }
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return fallbackResult(true);
  }
  const obj = parsed as Record<string, unknown>;

  const dynamicQuestions = Array.isArray(obj.dynamicQuestions)
    ? (obj.dynamicQuestions as unknown[]).slice(0, 4).map((q) => String(q))
    : [];

  const dichotomousFindings = Array.isArray(obj.dichotomousFindings)
    ? (obj.dichotomousFindings as unknown[]).slice(0, 6).map((f, i) => ({
        id: `ai-df-${i}`,
        label: String(f),
      }))
    : [];

  const redFlags = Array.isArray(obj.redFlags)
    ? (obj.redFlags as Array<Record<string, unknown>>).slice(0, 3).map((rf, i) => ({
        label: String(rf.label ?? ''),
        detail: String(rf.detail ?? ''),
        discardLabel: String(rf.discardLabel ?? 'Descartar'),
        id: `ai-rf-${i}`,
        status: 'pending' as const,
      }))
    : [];

  const yellowFlags = Array.isArray(obj.yellowFlags)
    ? (obj.yellowFlags as unknown[]).slice(0, 3).map((yf, i) => ({
        label: String(yf),
        id: `ai-yf-${i}`,
        checked: false,
      }))
    : [];

  const questionsToReevaluate = Array.isArray(obj.questionsToReevaluate)
    ? (obj.questionsToReevaluate as Array<Record<string, unknown>>)
        .filter((item) => typeof item.questionText === 'string' && typeof item.reason === 'string')
        .map((item) => ({ questionText: String(item.questionText), reason: String(item.reason) }))
    : undefined;

  return {
    dynamicQuestions,
    dichotomousFindings,
    redFlags,
    yellowFlags,
    orthopedicTests: [],
    ...(questionsToReevaluate ? { questionsToReevaluate } : {}),
  };
}

export function parseTestsResult(raw: string): {
  orthopedicTests: AIAnalyzeResult['orthopedicTests'];
  testsToRetest?: { testName: string; reason: string }[];
} {
  const cleaned = stripJsonFence(raw);
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    try {
      parsed = JSON.parse(cleaned.replace(/[“”]/g, '"').replace(/,\s*([}\]])/g, '$1'));
    } catch {
      const arrayStart = raw.indexOf('[', raw.indexOf('"orthopedicTests"'));
      const recovered: Array<Record<string, unknown>> = [];
      if (arrayStart >= 0) {
        let depth = 0;
        let objectStart = -1;
        let inString = false;
        let escaped = false;
        for (let i = arrayStart + 1; i < raw.length; i++) {
          const char = raw[i];
          if (inString) {
            if (escaped) escaped = false;
            else if (char === '\\') escaped = true;
            else if (char === '"') inString = false;
            continue;
          }
          if (char === '"') {
            inString = true;
          } else if (char === '{') {
            if (depth === 0) objectStart = i;
            depth++;
          } else if (char === '}') {
            depth--;
            if (depth === 0 && objectStart >= 0) {
              try {
                const item: unknown = JSON.parse(raw.slice(objectStart, i + 1));
                if (item && typeof item === 'object' && !Array.isArray(item)) {
                  recovered.push(item as Record<string, unknown>);
                }
              } catch {
                // Ignore incomplete item
              }
              objectStart = -1;
            }
          }
        }
      }
      parsed = { orthopedicTests: recovered };
    }
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { orthopedicTests: [] };
  }
  const obj = parsed as Record<string, unknown>;

  const formatStat = (val: unknown): string => {
    if (val === null || val === undefined || val === '') return '';
    const num = Number(String(val).replace('%', '').trim());
    if (!Number.isFinite(num) || num <= 0) return '';
    const pct = num > 0 && num <= 1 ? Math.round(num * 100) : Math.round(num);
    return `${pct}%`;
  };

  const orthopedicTests = Array.isArray(obj.orthopedicTests)
    ? (obj.orthopedicTests as Array<Record<string, unknown>>).slice(0, 3).map((t, i) => ({
        id: `ai-test-${i}`,
        name: String(t.name ?? ''),
        region: String(t.region ?? ''),
        description: String(t.description ?? ''),
        position: String(t.position ?? ''),
        maneuver: String(t.maneuver ?? ''),
        positiveCriteria: String(t.positiveCriteria ?? ''),
        sensitivity: formatStat(t.sensitivity ?? t.sensibilidad),
        specificity: formatStat(t.specificity ?? t.especificidad),
        result: null as null,
      }))
    : [];

  const testsToRetest = Array.isArray(obj.testsToRetest)
    ? (obj.testsToRetest as Array<Record<string, unknown>>)
        .filter((item) => typeof item.testName === 'string' && typeof item.reason === 'string')
        .map((item) => ({ testName: String(item.testName), reason: String(item.reason) }))
    : undefined;

  return {
    orthopedicTests,
    ...(testsToRetest ? { testsToRetest } : {}),
  };
}

export function buildTranscriptPrompt(transcript: string): string {
  return `Eres un asistente clínico para fisioterapeutas. A partir de la transcripción de una entrevista paciente-fisioterapeuta, extrae la información clave y devuelve EXCLUSIVAMENTE un objeto JSON válido:

{
  "queOcurre": "Síntoma principal y localización descritos por el paciente",
  "aQueLoAchacas": "Mecanismo de lesión, trauma o forma de inicio",
  "desdeCuando": "Temporalidad: agudo, subagudo o crónico con tiempo aproximado",
  "regionSugerida": "Una de: cervical, hombro, codo, muneca, dorsal, lumbar, pelvis, muslo, rodilla, tobillo, pie"
}

TRANSCRIPCIÓN:
${transcript}`;
}

export function parseTranscriptResult(raw: string): TranscriptResult {
  const cleaned = stripJsonFence(raw);
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error('La respuesta de Gemini no es JSON válido.');
  }
  const obj = parsed as Record<string, unknown>;
  if (!obj || typeof obj !== 'object') {
    throw new Error('La respuesta de Gemini no tiene la estructura esperada.');
  }
  return {
    queOcurre: String(obj.queOcurre ?? ''),
    aQueLoAchacas: String(obj.aQueLoAchacas ?? ''),
    desdeCuando: String(obj.desdeCuando ?? ''),
    regionSugerida: String(obj.regionSugerida ?? ''),
  };
}

export function buildTechniquesSummaryPrompt(treatmentPlan: string, techniques: string[]): string {
  return `Eres un fisioterapeuta experto. A partir del plan de tratamiento y las técnicas aplicadas, genera un resumen ULTRA-COMPACTO de una sola línea en formato clínico telegráfico.

Devuelve EXCLUSIVAMENTE un objeto JSON válido:
{
  "techniquesSummary": "EPI 3mA 3 disparos rotuliano | Terapia manual serrato | Movilización torácica"
}

PLAN DE TRATAMIENTO:
${treatmentPlan}

TÉCNICAS APLICADAS:
${techniques.join(', ')}`;
}

export function parseTechniquesSummaryResult(raw: string): TechniquesSummaryResult {
  const cleaned = stripJsonFence(raw);
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error('La respuesta de Gemini no es JSON válido.');
  }
  const obj = parsed as Record<string, unknown>;
  if (!obj || typeof obj !== 'object') {
    throw new Error('La respuesta de Gemini no tiene la estructura esperada.');
  }
  return {
    techniquesSummary: String(obj.techniquesSummary ?? ''),
  };
}

export function buildSonoTargetsPrompt(context: {
  region: string;
  anamnesis: { que: string; porque: string; desde: string };
  testResults: string;
}): string {
  return `Eres un fisioterapeuta experto en ecografía musculoesquelética. Con base en la región anatómica, la anamnesis y los resultados de tests ortopédicos, predice las 2 a 4 estructuras anatómicas prioritarias a explorar con sonda ecográfica.

DATOS DEL PACIENTE:
- Región afectada: ${context.region}
- Síntoma principal: ${context.anamnesis.que}
- Mecanismo: ${context.anamnesis.porque}
- Temporalidad: ${context.anamnesis.desde}
- Resultados de tests ortopédicos: ${context.testResults}

Devuelve EXCLUSIVAMENTE un objeto JSON válido:
{
  "structures": [
    {
      "name": "Nombre anatómico de la estructura diana",
      "rationale": "Justificación breve de por qué explorar esta estructura según la clínica",
      "probeOrientation": "Orientación de sonda recomendada"
    }
  ]
}`;
}

export function parseSonoTargetsResult(raw: string): SonoTargetsResult {
  const cleaned = stripJsonFence(raw);
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error('La respuesta de Gemini no es JSON válido.');
  }
  const obj = parsed as Record<string, unknown>;
  if (!obj || typeof obj !== 'object') {
    throw new Error('La respuesta de Gemini no tiene la estructura esperada.');
  }
  const structures = Array.isArray(obj.structures)
    ? (obj.structures as Array<Record<string, unknown>>).map((s) => ({
        name: String(s.name ?? ''),
        rationale: String(s.rationale ?? ''),
        probeOrientation: String(s.probeOrientation ?? ''),
      }))
    : [];
  return { structures };
}

export async function transcribeClinicalAudio(
  audioBase64: string,
  mimeType: string,
  config?: GeminiConfig,
): Promise<{
  rawTranscript: string;
  whatHappens?: string;
  cause?: string;
  duration?: string;
  followUpNotes?: string;
}> {
  const apiKey = config?.apiKey?.trim() || import.meta.env.VITE_GEMINI_API_KEY?.trim() || '';
  if (!apiKey) {
    throw new Error('No se ha configurado la API Key de Google Gemini. Abre Ajustes e introduce tu clave.');
  }
  if (!audioBase64.trim()) throw new Error('No se recibió audio para transcribir.');
  if (!mimeType.trim()) throw new Error('No se pudo determinar el formato del audio grabado.');

  const prompt = `Transcribe el audio en español y extrae, sin inventar información, los datos clínicos que estén explícitamente presentes. Devuelve exclusivamente JSON válido con estas claves: "rawTranscript" (transcripción completa y fiel, obligatoria), "whatHappens" (síntoma principal y localización, opcional), "cause" (mecanismo o causa, opcional), "duration" (desde cuándo/evolución temporal, opcional) y "followUpNotes" (si es un seguimiento, resumen breve que distinga respuesta del tejido a 24-48h y cambios percibidos; opcional). Conserva las claves opcionales vacías si no hay información y no añadas diagnósticos ni detalles no mencionados.`;
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(DEFAULT_MODEL)}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: prompt },
            { inlineData: { mimeType, data: audioBase64 } },
          ],
        }],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: 'application/json',
        },
      }),
    },
  );
  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Error ${response.status} al transcribir audio con Gemini: ${errorBody}`);
  }

  const result = (await response.json()) as GeminiResponse;
  const responseText = result.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!responseText) throw new Error('Gemini devolvió una respuesta vacía al transcribir el audio.');

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripJsonFence(responseText));
  } catch {
    throw new Error('Gemini devolvió un JSON inválido al transcribir el audio.');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Gemini devolvió una estructura inesperada al transcribir el audio.');
  }

  const transcript = parsed as Record<string, unknown>;
  const rawTranscript = typeof transcript.rawTranscript === 'string' ? transcript.rawTranscript.trim() : '';
  if (!rawTranscript) throw new Error('Gemini no pudo extraer una transcripción del audio.');
  return {
    rawTranscript,
    ...(typeof transcript.whatHappens === 'string' && transcript.whatHappens.trim()
      ? { whatHappens: transcript.whatHappens.trim() }
      : {}),
    ...(typeof transcript.cause === 'string' && transcript.cause.trim()
      ? { cause: transcript.cause.trim() }
      : {}),
    ...(typeof transcript.duration === 'string' && transcript.duration.trim()
      ? { duration: transcript.duration.trim() }
      : {}),
    ...(typeof transcript.followUpNotes === 'string' && transcript.followUpNotes.trim()
      ? { followUpNotes: transcript.followUpNotes.trim() }
      : {}),
  };
}