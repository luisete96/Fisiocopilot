export type TabKey = 'agenda' | 'pacientes' | 'valoracion' | 'expediente' | 'informacion';

export type AppointmentStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
export type AppointmentType = 'primera_valoracion' | 'seguimiento' | 'readaptacion' | 'ecografia_invasiva';

export interface Appointment {
  id: string;
  patientId: string;
  episodeId?: string;
  date: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  type: AppointmentType;
  status: AppointmentStatus;
  notes?: string;
}

export type EquipmentKey =
  | 'ecografo'
  | 'camilla'
  | 'dinamometro'
  | 'invasivas'
  | 'gimnasio'
  | 'radiofrecuencia'
  | 'superinductive'
  | 'shockwaves_radial'
  | 'shockwaves_focal';

export interface Equipment {
  key: EquipmentKey;
  label: string;
  icon: string;
}

export type TestResult = 'positivo' | 'negativo' | 'dudoso' | null;

export interface OrthopedicTest {
  id: string;
  name: string;
  region: string;
  description: string;
  position: string;
  maneuver: string;
  positiveCriteria: string;
  sensitivity?: string | number | null;
  specificity?: string | number | null;
  sensibilidad?: string | number | null;
  sens?: string | number | null;
  especificidad?: string | number | null;
  esp?: string | number | null;
  result: TestResult;
  needsRetest?: boolean;
  retestReason?: string;
  evolutionStatus?: 'unchanged' | 'improved' | 'resolved';
  previousResult?: string;
}

export type RedFlagStatus = 'pending' | 'discarded';

export interface RedFlag {
  id: string;
  label: string;
  detail: string;
  discardLabel: string;
  status: RedFlagStatus;
}

export interface YellowFlag {
  id: string;
  label: string;
  checked: boolean;
}

export type BodyRegion =
  | 'cervical' | 'hombro' | 'codo' | 'muneca' | 'dorsal'
  | 'lumbar' | 'pelvis' | 'muslo' | 'rodilla' | 'tobillo' | 'pie';

export interface BodyRegionInfo {
  key: BodyRegion;
  label: string;
}

export interface DiagnosticHypothesis {
  id: string;
  label: string;
  compatibility: number;
  isPrimary: boolean;
  differentialTest?: string;
  justification?: string;
  painPhenotype?: string;
}

export interface AIPrognosis {
  text: string;
  grade1: string;
  grade2: string;
  grade3: string;
  recoveryTime?: string;
}

export interface SignoAsterisco {
  gestoFuncional: string;
  parametroEvaluado: string;
  evaBasalSugerida: number;
  instruccionesTestRetest: string;
}

export interface AIHypothesisResult {
  hypotheses: string[];
  differentialDiagnosis: string[];
  prognosisText: string;
  recoveryTime: string;
  treatmentGuidelines: string;
  targetFunctionalGesture: string;
  primaryHypothesis: {
    name: string;
    percentage: number;
    justification: string;
    painPhenotype: string;
  };
  differentialHypotheses: Array<{
    name: string;
    percentage: number;
    differentialTest: string;
    painPhenotype: string;
  }>;
  prognosis: AIPrognosis;
  suggestedTests: string[];
  recommendedTreatment: string;
  signoAsterisco: SignoAsterisco;
}

export interface SessionEntry {
  id: string;
  date: string;
  physio: string;
  eva: number;
  evaPost?: number | null;
  summary: string;
  techniques: string[];
  techniquesSummary?: string;
  retest: string;
  improvement: number;
  episodeId?: string;
  clinicalData?: ClinicalSessionData | null;
}

export interface ClinicalSessionData {
  dynamicQuestions?: string[];
  dichotomousFindings: {
    label: string;
    answer: string;
    note: string;
    needsReevaluation?: boolean;
    reevaluationReason?: string;
    evolutionStatus?: 'unchanged' | 'improved' | 'resolved';
    previousAnswer?: string;
  }[];
  redFlags: { label: string; status: string }[];
  yellowFlags: { label: string; checked: boolean }[];
  tests: {
    name: string;
    result: string;
    needsRetest?: boolean;
    retestReason?: string;
    evolutionStatus?: 'unchanged' | 'improved' | 'resolved';
    previousResult?: string;
  }[];
  comparable: ComparableSign;
  hypotheses: DiagnosticHypothesis[];
  anamnesis?: { que: string; porque: string; desde: string };
  region?: string;
  aiPrognosis?: AIPrognosis | null;
  aiTreatment?: string | null;
  report?: ClinicalReportResult | null;
  techniquesSummary?: string | null;
  equipmentSafety?: EquipmentSafetyCheck[];
  previousHypotheses?: DiagnosticHypothesis[];
  evolution?: {
    tissueResponse: string;
    perceivedChanges: string;
    functionalLimitation?: string;
  };
}

export interface EquipmentSafetyCheck {
  id: string;
  label: string;
  present: boolean | null;
  contraindicatedTechniques: string[];
  allowedTechniques: string[];
}

export interface ComparableSign {
  movement: string;
  eva: number;
  evaCurrent?: number | null;
  rom: string;
  romPost: string | null;
  parameter: string;
  evaPost: number | null;
  forceGrade: number | null;
  forceGradePost: number | null;
  forceKg: number | null;
  forceKgPost: number | null;
  forceMode: 'daniels' | 'dinamometro' | null;
  instructions: string;
}

export interface GeminiConfig {
  apiKey: string;
}

export type ClinicalStep =
  | 'anamnesis'
  | 'dynamic'
  | 'triage'
  | 'complementary'
  | 'exploration'
  | 'comparable'
  | 'hypothesis';

export interface ClinicalReportResult {
  clinicalDiagnosis: string;
  therapeuticGoals: string;
  treatmentPlan: string;
  relevantAsteriskSign: string;
  antiNoceboExplanation: string;
}

export type DichotomousAnswer = 'yes' | 'no' | null;

export interface DichotomousFinding {
  id: string;
  label: string;
  answer: DichotomousAnswer;
  note: string;
  needsReevaluation?: boolean;
  reevaluationReason?: string;
  evolutionStatus?: 'unchanged' | 'improved' | 'resolved';
  previousAnswer?: string;
}

export interface AIAnalyzeResult {
  dynamicQuestions: string[];
  dichotomousFindings: Omit<DichotomousFinding, 'answer' | 'note'>[];
  redFlags: { label: string; detail: string; discardLabel: string }[];
  yellowFlags: { label: string; id: string; checked: boolean }[];
  orthopedicTests: {
    name: string;
    region: string;
    description: string;
    position: string;
    maneuver: string;
    positiveCriteria: string;
    sensitivity: string;
    specificity: string;
    needsRetest?: boolean;
    retestReason?: string;
    evolutionStatus?: 'unchanged' | 'improved' | 'resolved';
    previousResult?: string;
  }[];
  questionsToReevaluate?: { questionText: string; reason: string }[];
}

export interface Patient {
  id: string;
  name: string;
  birthDate: string | null;
  episodes?: Episode[];
  dni?: string;
  phone?: string;
  email?: string;
  occupation?: string;
  medicalNotes?: string;
  generalNotes?: string;
  notes?: string | null;
  createdAt: string;
}

export interface Episode {
  id: string;
  patientId: string;
  title: string;
  region: string | null;
  anamnesis: { que: string; porque: string; desde: string } | null;
  status: 'active' | 'resolved';
  createdAt: string;
  closedAt?: string;
  dischargeReason?: 'alta_clinica' | 'derivacion' | 'abandono';
  dischargeNotes?: string;
  notes?: string;
  sessions?: SessionEntry[];
}

export interface TranscriptResult {
  queOcurre: string;
  aQueLoAchacas: string;
  desdeCuando: string;
  regionSugerida: string;
}

export interface TechniquesSummaryResult {
  techniquesSummary: string;
}

export interface SonoFinding {
  structure: string;
  findings: string[];
  notes: string;
}

export interface SonoTargetSuggestion {
  name: string;
  rationale: string;
  probeOrientation: string;
}

export interface SonoTargetsResult {
  structures: SonoTargetSuggestion[];
}

export interface ClinicalData {
  anamnesis: { que: string; porque: string; desde: string };
  region: string;
  dynamicQuestions?: string[];
  dichotomousFindings: {
    label: string;
    answer: string;
    note: string;
    needsReevaluation?: boolean;
    reevaluationReason?: string;
    evolutionStatus?: 'unchanged' | 'improved' | 'resolved';
    previousAnswer?: string;
  }[];
  redFlags: { label: string; status: string }[];
  yellowFlags: { label: string; checked: boolean }[];
  complementary: string;
  tests: {
    name: string;
    result: string;
    needsRetest?: boolean;
    retestReason?: string;
    evolutionStatus?: 'unchanged' | 'improved' | 'resolved';
    previousResult?: string;
  }[];
  sonoFindings: SonoFinding[];
  freeExploration: string;
  hypotheses: DiagnosticHypothesis[];
  comparable: ComparableSign;
  aiPrognosis: AIPrognosis | null;
  aiTreatment: string | null;
  equipment: Record<EquipmentKey, boolean>;
  equipmentSafety?: EquipmentSafetyCheck[];
  previousHypotheses?: DiagnosticHypothesis[];
  evolution?: {
    tissueResponse: string;
    perceivedChanges: string;
    functionalLimitation?: string;
  };
}
