import { useState, useEffect, useRef, useMemo } from 'react';
import {
  MessageSquareText, AlertTriangle, ShieldCheck, FileText,
  Stethoscope, Zap, Brain, Target, ChevronRight, Check, X,
  Microscope, ClipboardList, TrendingUp, Lightbulb, Loader2, Pencil,
  Mic, MicOff, ChevronDown, History, RefreshCw,
} from 'lucide-react';
import type {
  BodyRegion, OrthopedicTest, TestResult, RedFlag, YellowFlag,
  DiagnosticHypothesis, ComparableSign, GeminiConfig, EquipmentKey,
  AIPrognosis, ClinicalData, DichotomousFinding, DichotomousAnswer,
  SessionEntry, ClinicalSessionData, Patient, Episode, SonoTargetSuggestion, EquipmentSafetyCheck,
} from '../types';
import {
  DYNAMIC_QUESTIONS, INITIAL_RED_FLAGS, YELLOW_FLAGS, INITIAL_TESTS,
  EQUIPMENT, BODY_REGIONS,
} from '../mockData';
import { Card, CardHeader } from './ui/Card';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { Modal } from './ui/Modal';
import { BodyMap } from './BodyMap';
import type { BodyMapSelection } from './BodyMap';
import { OrthopedicTests } from './OrthopedicTests';
import { calculateAge, normalizeText } from '../patientUtils';
import { CLINICAL_FAST_TRACK } from '../data/clinicalFastTrack';
import type { FastTrackRegion } from '../data/clinicalFastTrack';
import { callGemini, transcribeClinicalAudio, TRIAJE_RESPONSE_SCHEMA, TRIAJE_MAX_OUTPUT_TOKENS, TESTS_RESPONSE_SCHEMA, TESTS_FOLLOW_UP_RESPONSE_SCHEMA, TESTS_MAX_OUTPUT_TOKENS, HYPOTHESIS_RESPONSE_SCHEMA, HYPOTHESIS_MAX_OUTPUT_TOKENS, buildHypothesisPrompt, parseHypothesisResult, buildTriajePrompt, parseTriajeResult, buildTestsPrompt, parseTestsResult, buildSonoTargetsPrompt, parseSonoTargetsResult } from '../geminiService';

const BODY_REGION_FAST_TRACK: Partial<Record<BodyRegion, string>> = {
  cervical: 'cervical',
  hombro: 'hombro',
  codo: 'codo',
  muneca: 'muneca_mano',
  dorsal: 'dorsal',
  lumbar: 'lumbar',
  pelvis: 'pelvis_cadera',
  muslo: 'muslo',
  rodilla: 'rodilla',
  tobillo: 'tobillo',
  pie: 'pie',
};

const FAST_TRACK_BODY_REGION = Object.fromEntries(
  Object.entries(BODY_REGION_FAST_TRACK).map(([bodyRegion, regionId]) => [regionId, bodyRegion]),
) as Record<string, BodyRegion>;

function detectFastTrackRegions(text: string): FastTrackRegion[] {
  const normalizedText = ` ${normalizeText(text).replace(/[^\p{L}\p{N}]+/gu, ' ')} `;
  return Object.values(CLINICAL_FAST_TRACK).filter((fastTrackRegion) =>
    fastTrackRegion.keywords.some((keyword) => {
      const normalizedKeyword = normalizeText(keyword).replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
      return normalizedText.includes(` ${normalizedKeyword} `);
    }),
  );
}

function createFastTrackTests(
  regions: FastTrackRegion[],
  selections: BodyMapSelection[],
  previous: OrthopedicTest[] = [],
): OrthopedicTest[] {
  const previousStaticTests = new Map(
    previous.filter((test) => test.isStatic).map((test) => [test.id, test]),
  );
  return regions.flatMap((fastTrackRegion) => {
    const selectedSubZones = selections.find((selection) => selection.regionId === fastTrackRegion.id)?.subZones ?? [];
    const tests = [...fastTrackRegion.tests].sort((a, b) => {
      const aMatches = a.subZones?.some((zone) => selectedSubZones.includes(zone)) ? 0 : 1;
      const bMatches = b.subZones?.some((zone) => selectedSubZones.includes(zone)) ? 0 : 1;
      return aMatches - bMatches;
    });
    return tests.map((test) => {
      const id = `fast-track-${fastTrackRegion.id}-${test.id}`;
      const matchingSubZones = test.subZones?.filter((zone) => selectedSubZones.includes(zone)) ?? [];
      return {
        ...test,
        id,
        isStatic: true,
        regionId: fastTrackRegion.id,
        region: [fastTrackRegion.name, ...matchingSubZones].join(' · '),
        position: test.patientPosition,
        patientPosition: test.patientPosition,
        maneuver: test.maneuver,
        positiveCriteria: test.positivityCriteria,
        positivityCriteria: test.positivityCriteria,
        result: previousStaticTests.get(id)?.result ?? null,
      };
    });
  });
}

function createFastTrackQuestions(
  regions: FastTrackRegion[],
  selections: BodyMapSelection[],
  previous: DichotomousFinding[] = [],
): DichotomousFinding[] {
  const previousStaticQuestions = new Map(
    previous.filter((finding) => finding.isStatic).map((finding) => [finding.id, finding]),
  );
  return regions.flatMap((fastTrackRegion) => {
    const selectedSubZones = selections.find((selection) => selection.regionId === fastTrackRegion.id)?.subZones ?? [];
    const questions = [...fastTrackRegion.questions].sort((a, b) => {
      const aMatches = a.subZones?.some((zone) => selectedSubZones.includes(zone)) ? 0 : 1;
      const bMatches = b.subZones?.some((zone) => selectedSubZones.includes(zone)) ? 0 : 1;
      return aMatches - bMatches;
    });
    return questions.map((question) => {
      const id = `fast-track-${fastTrackRegion.id}-${question.id}`;
      const previousQuestion = previousStaticQuestions.get(id);
      return {
        id,
        label: question.text,
        text: question.text,
        answer: previousQuestion?.answer ?? null,
        note: previousQuestion?.note ?? '',
        sourceRegionId: fastTrackRegion.id,
        isStatic: true,
      };
    });
  });
}

interface ValorationScreenProps {
  equipment: Record<EquipmentKey, boolean>;
  geminiConfig: GeminiConfig;
  physio: string;
  onDataChange: (data: ClinicalData) => void;
  anamnesis: Anamnesis;
  onAnamnesisChange: (a: Anamnesis) => void;
  region: BodyRegion | null;
  onRegionChange: (r: BodyRegion | null) => void;
  previousSession?: SessionEntry | null;
  activePatient?: Patient | null;
  activeEpisode?: Episode | null;
  onBackToExpediente?: () => void;
  onEpisodeContextChange?: (
    region: BodyRegion | null,
    reason: string,
    descriptiveRegion?: string,
    primaryHypothesis?: string,
  ) => Promise<void>;
}

interface Anamnesis {
  que: string;
  porque: string;
  desde: string;
}

interface SonoTargetEntry {
  id: string;
  name: string;
  rationale: string;
  probeOrientation: string;
  findings: string[];
  notes: string;
}

const SONO_FINDING_OPTIONS = [
  'Sin alteraciones / Ecoestructura normal',
  'Engrosamiento focal / fusiforme',
  'Pérdida de patrón fibrilar',
  'Área hipoecoica',
  'Solución de continuidad / Rotura (parcial/total)',
  'Calcificación / Foco hiperecoico con sombra acústica',
  'Señal Power Doppler (+) / Neovascularización',
  'Derrame / Colección anecoica',
  'Irregularidad cortical / Entesofito',
];

function recommendationMatches(recommendation: string, candidate: string): boolean {
  const recommended = normalizeText(recommendation);
  const existing = normalizeText(candidate);
  if (!recommended || !existing) return false;
  if (recommended === existing || recommended.includes(existing) || existing.includes(recommended)) return true;

  const ignoredWords = new Set(['para', 'como', 'donde', 'cuando', 'desde', 'sobre', 'segun', 'hoy', 'test', 'pregunta']);
  const recommendedWords = new Set(recommended.split(/\s+/).filter((word) => word.length > 3 && !ignoredWords.has(word)));
  const existingWords = new Set(existing.split(/\s+/).filter((word) => word.length > 3 && !ignoredWords.has(word)));
  const shared = [...recommendedWords].filter((word) => existingWords.has(word)).length;
  return shared >= 2 && shared / Math.min(recommendedWords.size, existingWords.size) >= 0.6;
}

function evolutionLabel(status: 'unchanged' | 'improved' | 'resolved'): string {
  return {
    unchanged: 'Sigue igual',
    improved: 'Ha mejorado',
    resolved: 'Resuelto',
  }[status];
}

function answerLabel(answer: string | null | undefined): string {
  if (answer === 'yes') return 'Sí';
  if (answer === 'no') return 'No';
  return answer || 'sin dato';
}

export function ValorationScreen({ equipment, geminiConfig, onDataChange, anamnesis, onAnamnesisChange, region, onRegionChange, previousSession, activePatient, activeEpisode, onBackToExpediente, onEpisodeContextChange }: ValorationScreenProps) {
  const isFollowUp = !!(previousSession && previousSession.clinicalData);
  const previousComparable = previousSession?.clinicalData?.comparable;
  const initialFastTrackId = !isFollowUp && region ? BODY_REGION_FAST_TRACK[region] : undefined;
  const initialSelectedRegions: BodyMapSelection[] = initialFastTrackId
    ? [{ regionId: initialFastTrackId, laterality: '', subZones: [] }]
    : [];
  const initialTextFastTrackRegions = isFollowUp
    ? []
    : detectFastTrackRegions([anamnesis.que, anamnesis.porque, anamnesis.desde].join(' '));
  const initialActiveRegionIds = new Set([
    ...initialSelectedRegions.map((selection) => selection.regionId),
    ...initialTextFastTrackRegions.map((item) => item.id),
  ]);
  const initialFastTrackRegions = Object.values(CLINICAL_FAST_TRACK)
    .filter((item) => initialActiveRegionIds.has(item.id));
  const [anamnesisCollapsed, setAnamnesisCollapsed] = useState(false);
  const [isLiteMode, setIsLiteMode] = useState(() => {
    try {
      return localStorage.getItem('initial_assessment_mode') === 'lite';
    } catch (error) {
      console.error('No se pudo leer el modo de valoración guardado:', error);
      return false;
    }
  });
  const [manualClinicalDiagnosis, setManualClinicalDiagnosis] = useState('');
  const [manualTreatmentPlan, setManualTreatmentPlan] = useState('');
  const [manualSonoFindings, setManualSonoFindings] = useState('');
  const [evolucionTejido, setEvolucionTejido] = useState('');
  const [nuevasSensaciones, setNuevasSensaciones] = useState('');
  const [functionalLimitation, setFunctionalLimitation] = useState('');
  const [openQuestionsNotes, setOpenQuestionsNotes] = useState('');
  const [laterality, setLaterality] = useState('');
  const [subRegion, setSubRegion] = useState('');
  const [selectedRegions, setSelectedRegions] = useState<BodyMapSelection[]>(initialSelectedRegions);
  const [evaActualPresesion, setEvaActualPresesion] = useState<number | null>(null);
  const [testsNotice, setTestsNotice] = useState<string | null>(null);
  const [redFlags, setRedFlags] = useState<RedFlag[]>(INITIAL_RED_FLAGS);
  const [yellowFlags, setYellowFlags] = useState<YellowFlag[]>(YELLOW_FLAGS);
  const [complementary, setComplementary] = useState('');
  const [tests, setTests] = useState<OrthopedicTest[]>(() => (
    isFollowUp ? INITIAL_TESTS : createFastTrackTests(initialFastTrackRegions, initialSelectedRegions)
  ));
  const [sonoTargets, setSonoTargets] = useState<SonoTargetEntry[]>([]);
  const [sonoTargetsLoading, setSonoTargetsLoading] = useState(false);
  const [sonoTargetsError, setSonoTargetsError] = useState<string | null>(null);
  const [freeExploration, setFreeExploration] = useState('');
  const [comparable, setComparable] = useState<ComparableSign>({
    movement: '',
    eva: 0,
    rom: '',
    romPost: null,
    parameter: 'Dolor (EVA)',
    evaPost: null,
    forceGrade: null,
    forceGradePost: null,
    forceKg: null,
    forceKgPost: null,
    forceMode: null,
    instructions: '',
  });
  const [hypotheses, setHypotheses] = useState<DiagnosticHypothesis[]>([]);
  const [differentialModal, setDifferentialModal] = useState<DiagnosticHypothesis | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [episodeContextError, setEpisodeContextError] = useState<string | null>(null);
  const [aiPrognosis, setAiPrognosis] = useState<AIPrognosis | null>(null);
  const [aiTreatment, setAiTreatment] = useState<string | null>(null);
  const [triajeLoading, setTriajeLoading] = useState(false);
  const [triajeError, setTriajeError] = useState<string | null>(null);
  const [testsLoading, setTestsLoading] = useState(false);
  const [testsError, setTestsError] = useState<string | null>(null);

  const [aiDynamicQuestions, setAiDynamicQuestions] = useState<string[] | null>(null);
  const [dichotomousFindings, setDichotomousFindings] = useState<DichotomousFinding[]>(() => (
    isFollowUp ? [] : createFastTrackQuestions(initialFastTrackRegions, initialSelectedRegions)
  ));
  const [equipmentSafetyAnswers, setEquipmentSafetyAnswers] = useState<Record<string, boolean>>({});
  const [expandedNoteId, setExpandedNoteId] = useState<string | null>(null);

  const [isRecording, setIsRecording] = useState(false);
  const [isProcessingDictation, setIsProcessingDictation] = useState(false);
  const [transcriptError, setTranscriptError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const selectedRegionsRef = useRef(selectedRegions);
  const anamnesisRef = useRef(anamnesis);
  const regionRef = useRef(region);
  useEffect(() => {
    try {
      localStorage.setItem('initial_assessment_mode', isLiteMode ? 'lite' : 'complete');
    } catch (error) {
      console.error('No se pudo guardar el modo de valoración:', error);
    }
  }, [isLiteMode]);
  useEffect(() => { anamnesisRef.current = anamnesis; }, [anamnesis]);
  useEffect(() => { regionRef.current = region; }, [region]);
  const activeFastTrackRegions = useMemo(() => {
    if (isFollowUp) return [];
    const activeIds = new Set([
      ...detectFastTrackRegions([anamnesis.que, anamnesis.porque, anamnesis.desde].join(' '))
        .map((item) => item.id),
      ...selectedRegions.map((selection) => selection.regionId),
    ]);
    return Object.values(CLINICAL_FAST_TRACK).filter((item) => activeIds.has(item.id));
  }, [anamnesis.que, anamnesis.porque, anamnesis.desde, isFollowUp, selectedRegions]);
  const syncFastTrackData = (
    text: string,
    selections: BodyMapSelection[] = selectedRegionsRef.current,
  ) => {
    if (isFollowUp) return;
    const activeRegionIds = new Set([
      ...detectFastTrackRegions(text).map((item) => item.id),
      ...selections.map((selection) => selection.regionId),
    ]);
    const activeRegions = Object.values(CLINICAL_FAST_TRACK)
      .filter((item) => activeRegionIds.has(item.id));

    setTests((previous) => {
      const activeStaticTests = createFastTrackTests(activeRegions, selections, previous);
      return [...activeStaticTests, ...previous.filter((test) => !test.isStatic)];
    });
    setDichotomousFindings((previous) => [
      ...createFastTrackQuestions(activeRegions, selections, previous),
      ...previous.filter((finding) => !finding.isStatic),
    ]);
  };
  const regionLabel = BODY_REGIONS.find((item) => item.key === region)?.label ?? region ?? '';
  const clinicalRegion = [regionLabel, subRegion, laterality].filter(Boolean).join(' · ') || 'no especificada';
  const selectRegion = (nextRegion: BodyRegion | null) => {
    if (nextRegion !== region) {
      setLaterality('');
      setSubRegion('');
    }
    regionRef.current = nextRegion;
    onRegionChange(nextRegion);
    syncFastTrackData([anamnesis.que, anamnesis.porque, anamnesis.desde].join(' '));
  };

  const updateSelectedRegions = (nextSelections: BodyMapSelection[]) => {
    selectedRegionsRef.current = nextSelections;
    setSelectedRegions(nextSelections);
    const selected = nextSelections[nextSelections.length - 1];
    const primaryRegion = selected ? FAST_TRACK_BODY_REGION[selected.regionId] ?? null : null;
    regionRef.current = primaryRegion;
    onRegionChange(primaryRegion);
    setLaterality(selected?.laterality ?? '');
    setSubRegion(selected?.subZones[selected.subZones.length - 1] ?? '');
    syncFastTrackData(
      [anamnesisRef.current.que, anamnesisRef.current.porque, anamnesisRef.current.desde].join(' '),
      nextSelections,
    );
  };

  const updateAnamnesis = (nextAnamnesis: Anamnesis) => {
    anamnesisRef.current = nextAnamnesis;
    onAnamnesisChange(nextAnamnesis);
    syncFastTrackData(
      [nextAnamnesis.que, nextAnamnesis.porque, nextAnamnesis.desde].join(' '),
      selectedRegionsRef.current,
    );
  };

  const toggleRecording = () => {
    if (isRecording) {
      stopRecording();
      return;
    }
    startRecording();
  };

  const transcribeRecordedAudio = async (audioBlob: Blob) => {
    setIsProcessingDictation(true);
    setTranscriptError(null);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error('No se pudo leer el audio grabado.'));
        reader.onload = () => {
          if (typeof reader.result !== 'string') {
            reject(new Error('El audio grabado tiene un formato no válido.'));
            return;
          }
          resolve(reader.result);
        };
        reader.readAsDataURL(audioBlob);
      });
      const separator = dataUrl.indexOf(',');
      if (separator < 0) throw new Error('No se pudo codificar el audio grabado.');
      const audioBase64 = dataUrl.slice(separator + 1);
      const result = await transcribeClinicalAudio(
        audioBase64,
        audioBlob.type || 'audio/webm',
        geminiConfig,
      );

      if (isFollowUp) {
        setEvolucionTejido(result.rawTranscript);
        setNuevasSensaciones(result.followUpNotes || result.whatHappens || result.rawTranscript);
      } else {
        const previous = anamnesisRef.current;
        updateAnamnesis({
          que: result.whatHappens || result.rawTranscript || previous.que,
          porque: result.cause || previous.porque,
          desde: result.duration || previous.desde,
        });
      }
    } catch (err) {
      console.error('Error al transcribir audio clínico:', err);
      setTranscriptError(err instanceof Error ? err.message : 'Error desconocido al transcribir el audio.');
    } finally {
      setIsProcessingDictation(false);
    }
  };

  const startRecording = async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setTranscriptError('Este navegador no permite grabar audio. Comprueba que estás en localhost/HTTPS y usa un navegador compatible.');
      return;
    }
    try {
      setTranscriptError(null);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      audioChunksRef.current = [];
      const supportedMimeType = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/mp4',
      ].find((mimeType) => MediaRecorder.isTypeSupported(mimeType));
      const recorder = supportedMimeType
        ? new MediaRecorder(stream, { mimeType: supportedMimeType })
        : new MediaRecorder(stream);
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };
      recorder.onerror = () => {
        setTranscriptError('Se produjo un error al grabar el audio. Comprueba el micrófono e inténtalo de nuevo.');
        setIsRecording(false);
        mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
      };
      recorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, {
          type: recorder.mimeType || supportedMimeType || 'audio/webm',
        });
        audioChunksRef.current = [];
        mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
        mediaRecorderRef.current = null;
        setIsRecording(false);
        if (audioBlob.size > 0) void transcribeRecordedAudio(audioBlob);
        else setTranscriptError('La grabación no contiene audio. Vuelve a intentarlo.');
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
    } catch (err) {
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
      console.error('Error al iniciar la grabación de audio:', err);
      setTranscriptError(
        err instanceof DOMException && err.name === 'NotAllowedError'
          ? 'Permiso de micrófono denegado. Activa el acceso al micrófono en el navegador.'
          : err instanceof Error
            ? err.message
            : 'No se pudo iniciar la grabación de audio.',
      );
    }
  };

  const stopRecording = () => {
    const recorder = mediaRecorderRef.current;
    if (recorder?.state === 'recording') recorder.stop();
  };

  useEffect(() => () => {
    const recorder = mediaRecorderRef.current;
    if (recorder?.state === 'recording') recorder.stop();
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  // Reset comparable sign when region changes — unless it's a follow-up restoring prior data
  useEffect(() => {
    if (isFollowUp && previousComparable) {
      setComparable(previousComparable);
      setEvaActualPresesion(previousComparable.evaCurrent ?? previousComparable.eva);
    } else {
      setComparable({
        movement: '',
        eva: 0,
        rom: '',
        romPost: null,
        parameter: 'Dolor (EVA)',
        evaPost: null,
        forceGrade: null,
        forceGradePost: null,
        forceKg: null,
        forceKgPost: null,
        forceMode: null,
        instructions: '',
      });
    }
  }, [region, isFollowUp, previousComparable]);

  // Restore prior clinical state on follow-up
  useEffect(() => {
    if (!previousSession?.clinicalData) return;
    const cd = previousSession.clinicalData as ClinicalSessionData;
    setOpenQuestionsNotes(cd.openQuestionsNotes ?? '');
    setEvolucionTejido(cd.evolution?.tissueResponse ?? '');
    setNuevasSensaciones(cd.evolution?.perceivedChanges ?? '');
    setFunctionalLimitation(cd.evolution?.functionalLimitation ?? '');
    if (cd.equipmentSafety?.length) {
      const previousAnswers = cd.equipmentSafety.reduce<Record<string, boolean>>((answers, check) => {
        if (check.present !== null) answers[check.id] = check.present;
        return answers;
      }, {});
      setEquipmentSafetyAnswers((current) => ({ ...current, ...previousAnswers }));
    }
    if (cd.region) {
      const [storedRegion, ...storedDetails] = cd.region.split(' · ');
      const matchedRegion = BODY_REGIONS.find((item) =>
        normalizeText(item.label) === normalizeText(storedRegion) ||
        item.key === normalizeText(storedRegion),
      );
      if (matchedRegion && regionRef.current !== matchedRegion.key) {
        onRegionChange(matchedRegion.key);
      }
      const sides = ['derecho', 'izquierdo', 'bilateral', 'central'];
      setLaterality(storedDetails.find((detail) => sides.includes(normalizeText(detail))) ?? '');
      setSubRegion(storedDetails.find((detail) => !sides.includes(normalizeText(detail))) ?? '');
    }
    setAnamnesisCollapsed(true);
    if (cd.dynamicQuestions?.length) setAiDynamicQuestions(cd.dynamicQuestions);
    if (cd.redFlags?.length > 0) {
      setRedFlags(cd.redFlags.map((rf, i) => ({
        label: rf.label,
        detail: '',
        discardLabel: 'Descartar',
        id: `prev-rf-${i}`,
        status: rf.status as RedFlag['status'],
      })));
    }
    if (cd.yellowFlags?.length > 0) {
      setYellowFlags(cd.yellowFlags.map((yf, i) => ({
        label: yf.label,
        id: `prev-yf-${i}`,
        checked: yf.checked,
      })));
    }
    if (cd.dichotomousFindings?.length > 0) {
      setDichotomousFindings(cd.dichotomousFindings.map((f, i) => ({
        id: `prev-df-${i}`,
        label: f.label,
        answer: toDichotomousAnswer(f.answer),
        note: f.note ?? '',
        needsReevaluation: f.needsReevaluation,
        reevaluationReason: f.reevaluationReason,
        evolutionStatus: f.evolutionStatus,
        previousAnswer: f.previousAnswer,
      })));
    }
    if (cd.tests?.length > 0) {
      setTests(cd.tests.map((t, i) => ({
        id: `prev-test-${i}`,
        name: t.name,
        region: regionRef.current || '',
        description: '', position: '', maneuver: '', positiveCriteria: '',
        sensitivity: '', specificity: '',
        result: toTestResult(t.result),
        needsRetest: t.needsRetest,
        retestReason: t.retestReason,
        evolutionStatus: t.evolutionStatus,
        previousResult: t.previousResult,
      })));
    }
    if (cd.hypotheses?.length > 0) {
      setHypotheses(cd.hypotheses);
    }
  }, [previousSession, onRegionChange]);

  const dynamicQuestions = useMemo(
    () => isFollowUp
      ? aiDynamicQuestions ?? (region
        ? DYNAMIC_QUESTIONS[region] || DYNAMIC_QUESTIONS.default
        : DYNAMIC_QUESTIONS.default)
      : aiDynamicQuestions ?? [],
    [aiDynamicQuestions, isFollowUp, region],
  );
  const equipmentSafety = useMemo<EquipmentSafetyCheck[]>(() => {
    const safetyQuestions = [
      {
        id: 'electronic_implant',
        label: '¿Portador de marcapasos o implante electrónico activo?',
        contraindicatedTechniques: [
          'Radiofrecuencia (Diatermia)',
          'Sistema Superinductivo (SIS)',
          'Neuromodulación Percutánea con corriente (NMP)',
          'Electroterapia',
        ],
        allowedTechniques: [
          'Punción Seca (sin paso de corriente eléctrica)',
          'Terapia Manual',
          'Ejercicio Terapéutico',
        ],
      },
      {
        id: 'pregnancy',
        label: '¿Embarazo en curso?',
        contraindicatedTechniques: [
          'Radiofrecuencia / Diatermia (especialmente región lumbopélvica o abdominal)',
          'Sistema Superinductivo (SIS)',
          'Técnicas sobre puntos de estimulación uterina',
        ],
        allowedTechniques: [
          'Terapia Manual adaptada',
          'Ejercicio guiado de baja carga',
        ],
      },
      {
        id: 'oncology',
        label: '¿Proceso oncológico / tumoral activo en la zona?',
        contraindicatedTechniques: [
          'Radiofrecuencia (Diatermia)',
          'Ondas de Choque',
          'Sistema Superinductivo (SIS)',
          'Abordajes invasivos directos sobre el tejido patológico',
        ],
        allowedTechniques: [],
      },
      {
        id: 'metal_implant',
        label: '¿Implantes metálicos / osteosíntesis ferromagnética en la diana?',
        contraindicatedTechniques: [
          'Sistema Superinductivo (SIS; confirmar compatibilidad del implante y protocolo del fabricante)',
          'Radiofrecuencia (valorar material y recomendaciones del fabricante)',
        ],
        allowedTechniques: ['Terapia Manual adaptada', 'Ejercicio Terapéutico'],
      },
      {
        id: 'anticoagulants',
        label: '¿Tratamiento con anticoagulantes o trastorno severo de coagulación?',
        contraindicatedTechniques: [
          'Técnicas invasivas profundas con aguja (EPI, NMP profunda, Punción Seca profunda)',
          'Ondas de Choque a alta energía',
        ],
        allowedTechniques: [
          'Radiofrecuencia atérmica / resistiva superficial',
          'Sistema Superinductivo (SIS)',
          'Terapia Manual suave',
        ],
      },
      {
        id: 'needle_phobia_infection',
        label: '¿Fobia extrema a las agujas / infección cutánea local?',
        contraindicatedTechniques: [
          'Punción Seca',
          'EPI / EPTE',
          'Neuromodulación Percutánea (NMP)',
        ],
        allowedTechniques: [
          'Radiofrecuencia',
          'Sistema Superinductivo (SIS)',
          'Ondas de Choque',
          'Terapia Manual',
          'Ejercicio Terapéutico',
        ],
      },
    ];
    return safetyQuestions.map((question) => ({
      id: question.id,
      label: question.label,
      present: equipmentSafetyAnswers[question.id] ?? null,
      contraindicatedTechniques: question.contraindicatedTechniques,
      allowedTechniques: question.allowedTechniques,
    }));
  }, [equipmentSafetyAnswers]);
  const consolidatedFindingLabels = new Set(
    (previousSession?.clinicalData?.dichotomousFindings ?? [])
      .filter((finding) => ['yes', 'no', 'si'].includes(normalizeText(finding.answer)))
      .map((finding) => normalizeText(finding.label)),
  );
  const consolidatedTestNames = new Set(
    (previousSession?.clinicalData?.tests ?? [])
      .filter((test) => ['positivo', 'negativo', '+', '-'].includes(normalizeText(test.result)))
      .map((test) => normalizeText(test.name)),
  );
  const hasAiGradePrognosis = !!(
    aiPrognosis?.grade1 || aiPrognosis?.grade2 || aiPrognosis?.grade3
  );

  const setFindingAnswer = (id: string, answer: DichotomousAnswer) => {
    setDichotomousFindings((prev) =>
      prev.map((f) => (f.id === id ? { ...f, answer: f.answer === answer ? null : answer } : f)),
    );
  };

  const setFindingEvolution = (id: string, status: 'unchanged' | 'improved' | 'resolved') => {
    setDichotomousFindings((prev) => prev.map((finding) => {
      if (finding.id !== id) return finding;
      const previousAnswer = finding.previousAnswer ?? (finding.answer ?? 'sin responder');
      return {
        ...finding,
        previousAnswer,
        answer: status === 'resolved' ? 'no' : finding.answer,
        evolutionStatus: status,
        needsReevaluation: false,
      };
    }));
  };

  const setFindingNote = (id: string, note: string) => {
    setDichotomousFindings((prev) =>
      prev.map((f) => (f.id === id ? { ...f, note } : f)),
    );
  };

  // Lift clinical data to parent for report generation
  useEffect(() => {
    onDataChange({
      isLiteMode,
      anamnesis,
      manualClinicalDiagnosis,
      manualTreatmentPlan,
      manualSonoFindings,
      region: clinicalRegion,
      dynamicQuestions,
      openQuestionsNotes,
      dichotomousFindings: dichotomousFindings.map((f) => ({
        label: f.label,
        answer: f.answer ?? 'sin responder',
        note: f.note,
        needsReevaluation: f.needsReevaluation,
        reevaluationReason: f.reevaluationReason,
        evolutionStatus: f.evolutionStatus,
        previousAnswer: f.previousAnswer,
      })),
      redFlags: redFlags.map((rf) => ({ label: rf.label, status: rf.status })),
      yellowFlags: yellowFlags.map((yf) => ({ label: yf.label, checked: yf.checked })),
      complementary,
      tests: tests.map((t) => ({
        name: t.name,
        region: t.region,
        description: t.description,
        position: t.position,
        maneuver: t.maneuver,
        positiveCriteria: t.positiveCriteria,
        sensitivity: t.sensitivity,
        specificity: t.specificity,
        result: t.result || 'sin valorar',
        needsRetest: t.needsRetest,
        retestReason: t.retestReason,
        evolutionStatus: t.evolutionStatus,
        previousResult: t.previousResult,
      })),
      sonoFindings: sonoTargets.map((t) => ({
        structure: t.name,
        findings: t.findings,
        notes: t.notes,
      })),
      freeExploration,
      hypotheses,
      comparable: {
        ...comparable,
        eva: isFollowUp && previousComparable ? previousComparable.eva : comparable.eva,
        evaCurrent: isFollowUp ? evaActualPresesion ?? comparable.eva : undefined,
      },
      aiPrognosis,
      aiTreatment,
      equipment,
      equipmentSafety,
      previousHypotheses: previousSession?.clinicalData?.hypotheses,
      evolution: isFollowUp
        ? {
            tissueResponse: evolucionTejido,
            perceivedChanges: nuevasSensaciones,
            functionalLimitation,
          }
        : undefined,
    });
  }, [isLiteMode, anamnesis, manualClinicalDiagnosis, manualTreatmentPlan, manualSonoFindings, clinicalRegion, dynamicQuestions, openQuestionsNotes, dichotomousFindings, redFlags, yellowFlags, complementary, tests, sonoTargets, freeExploration, hypotheses, comparable, evaActualPresesion, aiPrognosis, aiTreatment, equipment, equipmentSafety, previousSession, isFollowUp, previousComparable, evolucionTejido, nuevasSensaciones, functionalLimitation, onDataChange]);

  useEffect(() => {
    if (!onEpisodeContextChange || !activeEpisode?.id) return;
    const timeout = window.setTimeout(() => {
      const primaryHypothesis = hypotheses.find((hypothesis) => hypothesis.isPrimary && hypothesis.compatibility > 0)?.label;
      void onEpisodeContextChange(region, anamnesis.que, clinicalRegion, primaryHypothesis)
        .then(() => setEpisodeContextError(null))
        .catch((error: unknown) => {
          console.error('No se pudo actualizar el contexto del episodio:', error);
          setEpisodeContextError(error instanceof Error ? error.message : 'No se pudo actualizar el episodio.');
        });
    }, 500);
    return () => window.clearTimeout(timeout);
  }, [region, clinicalRegion, anamnesis.que, hypotheses, activeEpisode?.id, onEpisodeContextChange]);



  const discardRedFlag = (id: string) => {
    setRedFlags((prev) =>
      prev.map((rf) => (rf.id === id ? { ...rf, status: 'discarded' } : rf)),
    );
  };

  const toggleYellow = (id: string) => {
    setYellowFlags((prev) =>
      prev.map((yf) => (yf.id === id ? { ...yf, checked: !yf.checked } : yf)),
    );
  };

  const handleTestResult = (id: string, result: TestResult) => {
    setTests((prev) =>
      prev.map((t) => (t.id === id ? { ...t, result: t.result === result ? null : result } : t)),
    );
  };

  const setTestEvolution = (id: string, status: 'unchanged' | 'improved' | 'resolved') => {
    setTests((prev) => prev.map((test) => {
      if (test.id !== id) return test;
      return {
        ...test,
        previousResult: test.previousResult ?? test.result ?? 'sin valorar',
        result: status === 'resolved' ? 'negativo' : 'positivo',
        evolutionStatus: status,
        needsRetest: false,
      };
    }));
  };

  const handleSuggestSonoTargets = async () => {
    if (!geminiConfig.apiKey) return;
    setSonoTargetsLoading(true);
    setSonoTargetsError(null);
    try {
      const testResults = tests
        .map((t) => `${t.name}: ${t.result || 'sin valorar'}`)
        .join(', ');
      const prompt = buildSonoTargetsPrompt({
        region: clinicalRegion,
        anamnesis,
        testResults,
        openQuestionsNotes,
      });
      const raw = await callGemini(prompt, geminiConfig);
      const result = parseSonoTargetsResult(raw);
      const newTargets: SonoTargetEntry[] = result.structures.map((s: SonoTargetSuggestion, i: number) => ({
        id: `sono-${i}`,
        name: s.name,
        rationale: s.rationale,
        probeOrientation: s.probeOrientation,
        findings: [],
        notes: '',
      }));
      setSonoTargets(newTargets);
    } catch (err) {
      setSonoTargetsError(err instanceof Error ? err.message : 'Error al sugerir dianas ecográficas.');
    } finally {
      setSonoTargetsLoading(false);
    }
  };

  const toggleSonoFinding = (targetId: string, finding: string) => {
    setSonoTargets((prev) =>
      prev.map((t) => {
        if (t.id !== targetId) return t;
        if (finding === 'Sin alteraciones / Ecoestructura normal') {
          return { ...t, findings: t.findings.includes(finding) ? [] : [finding] };
        }
        const without = t.findings.filter((f) => f !== 'Sin alteraciones / Ecoestructura normal');
        return {
          ...t,
          findings: without.includes(finding) ? without.filter((f) => f !== finding) : [...without, finding],
        };
      }),
    );
  };

  const setSonoNotes = (targetId: string, notes: string) => {
    setSonoTargets((prev) =>
      prev.map((t) => (t.id === targetId ? { ...t, notes } : t)),
    );
  };

  const recalculateWithAI = async () => {
    if (!geminiConfig.apiKey) {
      setAiError('No hay API key configurada. Configúrala en Ajustes para usar la IA.');
      return;
    }
    setAiLoading(true);
    setAiError(null);
    setAiPrognosis(null);
    try {
      const testResults = tests
        .map((t) => `${t.name}: ${t.result || 'sin valorar'}`)
        .join(', ');
      const rfStatus = redFlags
        .map((rf) => `${rf.label}: ${rf.status === 'discarded' ? 'descartada' : 'pendiente'}`)
        .join(', ');

      const positiveFindings = dichotomousFindings.filter((f) => f.answer === 'yes').map((f) => f.label);
      const negativeFindings = dichotomousFindings.filter((f) => f.answer === 'no').map((f) => f.label);

      const activeEquipmentLabels = EQUIPMENT.filter((e) => equipment[e.key]).map((e) => e.label).join(', ');

      const sonoFindingsStr = sonoTargets.length > 0
        ? sonoTargets.map((t) => `${t.name}: ${t.findings.length > 0 ? t.findings.join(', ') : 'sin valorar'}${t.notes ? ` (${t.notes})` : ''}`).join('; ')
        : 'no realizado';

      const prompt = buildHypothesisPrompt({
        anamnesis,
        region: clinicalRegion,
        testResults,
        redFlags: rfStatus,
        freeExploration,
        comparableSign: isFollowUp
          ? `SIGNO ASTERISCO DE REFERENCIA INMUTABLE: "${previousComparable?.movement || comparable.movement}". EVA basal: ${previousComparable?.eva ?? comparable.eva}/10. EVA actual en el mismo gesto: ${evaActualPresesion ?? previousComparable?.eva ?? comparable.eva}/10. Limitación funcional actual: ${functionalLimitation || 'no descrita'}.`
          : `${comparable.movement} — EVA ${comparable.eva}/10`,
        equipment: activeEquipmentLabels,
        dichotomousFindings: { positive: positiveFindings, negative: negativeFindings },
        sonoFindings: sonoFindingsStr,
        isFollowUp,
        priorTreatment: isFollowUp ? previousSession?.summary : '',
        evolucionTejido,
        nuevasSensaciones,
        priorHypotheses: previousSession?.clinicalData?.hypotheses
          ?.map((hypothesis) => `${hypothesis.label}${hypothesis.isPrimary ? ' (principal)' : ''}`)
          .join('; '),
        evolutionFindings: [
          ...dichotomousFindings.filter((finding) => finding.evolutionStatus)
            .map((finding) => `${finding.label}: ${finding.previousAnswer} → ${finding.evolutionStatus}`),
          ...tests.filter((test) => test.evolutionStatus)
            .map((test) => `${test.name}: ${test.previousResult} → ${test.evolutionStatus}`),
        ].join('; '),
        equipmentSafety,
        openQuestionsNotes,
      });

      const raw = await callGemini(prompt, geminiConfig, {
        maxOutputTokens: HYPOTHESIS_MAX_OUTPUT_TOKENS,
        responseSchema: HYPOTHESIS_RESPONSE_SCHEMA,
      });
      const result = parseHypothesisResult(raw);
      console.log("VALOR RECIBIDO PARA GESTO DIANA:", result.targetFunctionalGesture, result.signoAsterisco);

      const prioritizedHypotheses = result.hypotheses.length > 0
        ? result.hypotheses.slice(0, 3)
        : [result.primaryHypothesis.name].filter(Boolean);
      const newHypotheses: DiagnosticHypothesis[] = prioritizedHypotheses.map((label, index) => {
        const legacyPrimary = index === 0 ? result.primaryHypothesis : undefined;
        const legacyDifferential = index > 0
          ? result.differentialHypotheses.find((item) => item.name === label)
          : undefined;
        const differentialReason = index > 0
          ? result.differentialDiagnosis[index - 1]
          : undefined;
        return {
          id: index === 0 ? 'ai-primary' : `ai-hypothesis-${index}`,
          label,
          compatibility: legacyPrimary?.percentage ?? legacyDifferential?.percentage ?? 0,
          isPrimary: index === 0,
          justification: legacyPrimary?.justification,
          differentialTest: index === 0 ? undefined : (
            legacyDifferential?.differentialTest || differentialReason || label
          ),
          painPhenotype: legacyPrimary?.painPhenotype ?? legacyDifferential?.painPhenotype,
        };
      });
      const representedHypotheses = new Set(
        newHypotheses.map((hypothesis) => hypothesis.label.toLocaleLowerCase('es')),
      );
      const additionalDifferentials = result.differentialDiagnosis
        .filter((diagnosis) => !representedHypotheses.has(diagnosis.toLocaleLowerCase('es')))
        .map((diagnosis, index) => ({
          id: `ai-differential-${index}`,
          label: diagnosis,
          compatibility: 0,
          isPrimary: false,
          differentialTest: diagnosis,
        }));
      newHypotheses.push(...additionalDifferentials);

      console.log('HIPÓTESIS ACTUALIZADAS EN VALORACIÓN:', {
        hypotheses: result.hypotheses,
        differentialDiagnosis: result.differentialDiagnosis,
        renderedHypotheses: newHypotheses,
      });
      setHypotheses(newHypotheses);
      setAiPrognosis({
        text: result.prognosisText,
        grade1: '',
        grade2: '',
        grade3: '',
        recoveryTime: result.recoveryTime,
      });
      setAiTreatment(result.treatmentGuidelines);

      const targetFunctionalGesture = isFollowUp
        ? previousComparable?.movement || comparable.movement
        : result.targetFunctionalGesture || result.signoAsterisco?.gestoFuncional || null;
      setComparable((prev) => ({
        ...prev,
        movement: targetFunctionalGesture || prev.movement,
      }));
      if (!targetFunctionalGesture) {
        console.warn('Gemini no devolvió el gesto funcional diana en el recálculo.');
      }
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'Error desconocido al llamar a Gemini.');
    } finally {
      setAiLoading(false);
    }
  };

  const handleTriaje = async () => {
    if (!geminiConfig.apiKey) return;
    setTriajeLoading(true);
    setTriajeError(null);
    try {
      const priorFindings = isFollowUp
        ? dichotomousFindings.map((f) => `${f.label}: ${f.answer ?? 'sin responder'}`).join('; ')
        : '';
      const priorTests = isFollowUp
        ? tests.map((t) => `${t.name}: ${t.result || 'sin valorar'}`).join('; ')
        : '';
      const reevaluationCandidates = isFollowUp
        ? dichotomousFindings
            .filter((finding) => finding.answer !== null)
            .map((finding) => `${finding.label}: ${finding.answer}`)
            .join('; ')
        : '';
      const prompt = buildTriajePrompt(anamnesis, clinicalRegion, isFollowUp, priorFindings, priorTests, evolucionTejido, nuevasSensaciones, reevaluationCandidates, openQuestionsNotes);
      const raw = await callGemini(prompt, geminiConfig, {
        responseSchema: TRIAJE_RESPONSE_SCHEMA,
        maxOutputTokens: TRIAJE_MAX_OUTPUT_TOKENS,
      });
      console.log('RESPUESTA BRUTA DE GEMINI:', raw);
      const result = parseTriajeResult(raw);
      if (isFollowUp && result.questionsToReevaluate) {
        setDichotomousFindings((previous) => previous.map((finding) => {
          const recommendation = result.questionsToReevaluate?.find((item) =>
            recommendationMatches(item.questionText, finding.label),
          );
          return {
            ...finding,
            needsReevaluation: Boolean(recommendation),
            reevaluationReason: recommendation?.reason ?? undefined,
          };
        }));
      }
      if (result.dynamicQuestions.length > 0) {
        setAiDynamicQuestions((previous) => {
          const current = isFollowUp ? previous ?? dynamicQuestions : previous ?? [];
          const existingLabels = new Set(
            [
              ...(isFollowUp ? [] : activeFastTrackRegions.flatMap((item) => item.questions.map((question) => question.text))),
              ...current,
            ]
              .map((question) => normalizeText(question)),
          );
          const additions = result.dynamicQuestions.filter((question) => {
            const normalized = normalizeText(question);
            if (existingLabels.has(normalized)) return false;
            existingLabels.add(normalized);
            return true;
          });
          return isFollowUp ? [...current, ...additions] : [...(previous ?? []), ...additions];
        });
      }
      const suggestedFindings = result.dichotomousFindings.length > 0
        ? result.dichotomousFindings
        : result.dynamicQuestions.map((label, index) => ({ id: `ai-dynamic-${index}`, label }));
      if (suggestedFindings.length > 0) {
        if (isFollowUp) {
          // Merge: keep previous answered findings, add new ones
          const existingLabels = new Set(dichotomousFindings.map((f) => normalizeText(f.label)));
          const newFindings = suggestedFindings
            .filter((finding) => {
              const normalized = normalizeText(finding.label);
              if (existingLabels.has(normalized)) return false;
              existingLabels.add(normalized);
              return true;
            })
            .map((f) => ({ ...f, answer: null as DichotomousAnswer, note: '' }));
          setDichotomousFindings((prev) => [...prev, ...newFindings]);
        } else {
          setDichotomousFindings((previous) => {
            const existingLabels = new Set(previous.map((finding) => normalizeText(finding.label)));
            const newFindings = suggestedFindings
              .filter((finding) => {
                const normalized = normalizeText(finding.label);
                if (existingLabels.has(normalized)) return false;
                existingLabels.add(normalized);
                return true;
              })
              .map((finding, index) => ({
                ...finding,
                id: `${finding.id}-${Date.now()}-${index}`,
                answer: null as DichotomousAnswer,
                note: '',
              }));
            return [...previous, ...newFindings];
          });
        }
      }
      if (result.redFlags.length > 0 && !isFollowUp) setRedFlags(result.redFlags as RedFlag[]);
      if (result.yellowFlags.length > 0 && !isFollowUp) setYellowFlags(result.yellowFlags as YellowFlag[]);
    } catch (err) {
      setTriajeError(err instanceof Error ? err.message : 'Error al generar triaje con IA.');
    } finally {
      setTriajeLoading(false);
    }
  };

  const handleSuggestTests = async () => {
    if (!geminiConfig.apiKey) return;
    setTestsLoading(true);
    setTestsError(null);
    setTestsNotice(null);
    try {
      const positiveFindings = dichotomousFindings.filter((f) => f.answer === 'yes').map((f) => f.label);
      const negativeFindings = dichotomousFindings.filter((f) => f.answer === 'no').map((f) => f.label);
      const priorTests = isFollowUp
        ? tests.map((t) => `${t.name}: ${t.result || 'sin valorar'}`).join('; ')
        : '';
      const retestCandidates = isFollowUp
        ? tests.map((test) => `${test.name}: ${test.result || 'sin valorar'}`).join('; ')
        : '';
      const prompt = buildTestsPrompt({
        anamnesis,
        region: isFollowUp
          ? clinicalRegion
          : [...new Set(tests.map((test) => test.region).filter(Boolean))].join('; ') || clinicalRegion,
        positiveFindings,
        negativeFindings,
        candidateTests: isFollowUp ? [] : tests.map((test) => ({
          name: test.name,
          region: test.region,
          description: test.description,
          sensitivity: test.sensitivity,
          specificity: test.specificity,
        })),
        isFollowUp,
        priorTests,
        evolucionTejido,
        nuevasSensaciones,
        reevaluationCandidates: retestCandidates,
        openQuestionsNotes,
      });
      const raw = await callGemini(prompt, geminiConfig, {
        responseSchema: isFollowUp ? TESTS_FOLLOW_UP_RESPONSE_SCHEMA : TESTS_RESPONSE_SCHEMA,
        maxOutputTokens: TESTS_MAX_OUTPUT_TOKENS,
      });
      console.log('RESPUESTA BRUTA DE GEMINI (tests):', raw);
      const result = parseTestsResult(raw);
      if (isFollowUp && result.testsToRetest) {
        setTests((previous) => previous.map((test) => {
          const recommendation = result.testsToRetest?.find((item) =>
            recommendationMatches(item.testName, test.name),
          );
          return {
            ...test,
            needsRetest: Boolean(recommendation),
            retestReason: recommendation?.reason ?? undefined,
          };
        }));
      }
      if (result.orthopedicTests.length > 0) {
        const uniqueSuggestedTests = result.orthopedicTests.filter((test, index, all) =>
          all.findIndex((candidate) => normalizeText(candidate.name) === normalizeText(test.name)) === index,
        );
        const suggestedTests = uniqueSuggestedTests.slice(0, isFollowUp ? 3 : 6).map((test, index) => ({
          ...test,
          id: test.id || `ai-test-${Date.now()}-${index}`,
          result: null as TestResult,
        }));
        if (isFollowUp) {
          const existingNames = new Set(tests.map((t) => normalizeText(t.name)));
          const newTests = suggestedTests
            .filter((test) => {
              const normalized = normalizeText(test.name);
              if (existingNames.has(normalized)) return false;
              existingNames.add(normalized);
              return true;
            })
            .slice(0, 2);
          if (newTests.length > 0) {
            setTests((prev) => [...prev, ...newTests]);
          } else {
            setTestsNotice('Exploración basal consolidada; monitorizar mediante Signo Asterisco.');
          }
        } else {
          setTests((previous) => {
            const existingByName = new Map(previous.map((test) => [normalizeText(test.name), test]));
            const mergedSuggestions = suggestedTests.map((suggestion) => {
              const existing = existingByName.get(normalizeText(suggestion.name));
              if (!existing) return suggestion;
              if (existing.result !== null) return existing;
              return {
                ...existing,
                ...suggestion,
                id: existing.id,
                isStatic: existing.isStatic,
                regionId: existing.regionId,
                result: existing.result,
                description: suggestion.description || existing.description,
                position: suggestion.position || existing.position,
                maneuver: suggestion.maneuver || existing.maneuver,
                positiveCriteria: suggestion.positiveCriteria || existing.positiveCriteria,
                sensitivity: existing.isStatic ? existing.sensitivity : suggestion.sensitivity || existing.sensitivity,
                specificity: existing.isStatic ? existing.specificity : suggestion.specificity || existing.specificity,
              };
            });
            const selectedNames = new Set(mergedSuggestions.map((test) => normalizeText(test.name)));
            const evaluatedTestsNotSelected = previous.filter((test) =>
              test.result !== null && !selectedNames.has(normalizeText(test.name)),
            );
            return [...evaluatedTestsNotSelected, ...mergedSuggestions];
          });
        }
      } else if (isFollowUp) {
        setTestsNotice('Exploración basal consolidada; monitorizar mediante Signo Asterisco.');
      } else {
        setTestsNotice('Gemini no devolvió tests legibles. Puedes volver a intentarlo.');
      }
    } catch (err) {
      setTestsError(err instanceof Error ? err.message : 'Error al sugerir tests con IA.');
    } finally {
      setTestsLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-[1400px] space-y-6 px-4 py-6 lg:px-6">
      {/* Patient/Episode header bar */}
      {activePatient && (
        <div className="flex items-center justify-between rounded-2xl border border-primary-200 bg-gradient-to-r from-primary-50 to-white px-5 py-3 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-600 text-white">
              <Stethoscope className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-800">{activePatient.name}</h2>
              <p className="text-xs text-slate-500">
                {calculateAge(activePatient.birthDate) !== null
                  ? `${calculateAge(activePatient.birthDate)} años`
                  : activePatient.birthDate || 'Edad no disponible'}
                {activePatient.phone ? ` · 📞 ${activePatient.phone}` : ''}
              </p>
              {activeEpisode && (
                <p className="text-xs text-slate-500">
                  {activeEpisode.title}
                  {activeEpisode.region && normalizeText(activeEpisode.title) !== normalizeText(BODY_REGIONS.find((item) => item.key === activeEpisode.region)?.label ?? activeEpisode.region)
                    ? ` · ${BODY_REGIONS.find((item) => item.key === activeEpisode.region)?.label ?? activeEpisode.region}`
                    : ''}
                </p>
              )}
            </div>
          </div>
          {onBackToExpediente && (
            <button
              type="button"
              onClick={onBackToExpediente}
              className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
            >
              <X className="h-4 w-4" /> Volver al Expediente
            </button>
          )}
        </div>
      )}
      {episodeContextError && (
        <p role="alert" className="rounded-lg border border-error-200 bg-error-50 px-4 py-2 text-sm text-error-700">
          No se pudo actualizar el nombre o la región del episodio: {episodeContextError}
        </p>
      )}
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-800">Modo de valoración inicial</h2>
          <p className="mt-1 text-xs text-slate-500">
            {isLiteMode
              ? 'Historia clínica manual con FastTrack, banderas y dictado activos.'
              : 'Valoración completa con sugerencias y análisis de IA.'}
          </p>
        </div>
        <div className="inline-flex rounded-xl bg-slate-100 p-1" role="group" aria-label="Modo clínico">
          <button
            type="button"
            aria-pressed={!isLiteMode}
            onClick={() => setIsLiteMode(false)}
            className={`rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
              !isLiteMode ? 'bg-white text-primary-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Modo Completo (IA Activa)
          </button>
          <button
            type="button"
            aria-pressed={isLiteMode}
            onClick={() => setIsLiteMode(true)}
            className={`rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
              isLiteMode ? 'bg-white text-primary-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Modo Lite (Solo Historia)
          </button>
        </div>
      </div>
      {/* Step 1: Anamnesis + Body Map */}
      <Card>
        <CardHeader
          step={1}
          title="Anamnesis Básica y Mapa Anatómico"
          description="Recogida inicial del motivo de consulta y localización del síntoma"
        />
        <div className="grid gap-6 p-5 lg:grid-cols-[1fr_340px]">
          <div className="space-y-4">
            {/* Voice transcription + AI extraction */}
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={toggleRecording}
                  className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold shadow-sm transition-all ${
                    isRecording
                      ? 'bg-error-600 text-white animate-pulse'
                      : 'bg-primary-600 text-white hover:bg-primary-700 hover:shadow-md'
                  }`}
                >
                  {isRecording ? (
                    <>
                      <MicOff className="h-4 w-4" /> Detener y Procesar Dictado (Grabando...)
                    </>
                  ) : (
                    <>
                      <Mic className="h-4 w-4" /> Iniciar Dictado/Entrevista
                    </>
                  )}
                </button>
                {isProcessingDictation && (
                  <span className="flex items-center gap-1.5 text-xs text-primary-600">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Transcribiendo audio con IA...
                  </span>
                )}
                {transcriptError && (
                  <span className="text-xs text-error-600">{transcriptError}</span>
                )}
              </div>
            </div>

            {/* Follow-up badge */}
            {isFollowUp && (
              <div className="flex items-center gap-2 rounded-xl border border-secondary-200 bg-secondary-50 px-4 py-2.5">
                <History className="h-4 w-4 text-secondary-600" />
                <span className="text-sm font-medium text-secondary-800">
                  Sesión de seguimiento — valoración previa cargada
                </span>
              </div>
            )}

            {/* Collapsible anamnesis */}
            {isFollowUp && (
              <button
                type="button"
                onClick={() => setAnamnesisCollapsed(!anamnesisCollapsed)}
                className="flex w-full items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100"
              >
                <ChevronDown className={`h-4 w-4 transition-transform ${anamnesisCollapsed ? '' : 'rotate-180'}`} />
                Anamnesis basal {anamnesisCollapsed ? '(mostrar)' : '(ocultar)'}
              </button>
            )}
            {(!isFollowUp || !anamnesisCollapsed) && (
              <>
                <SpeechBubble
                  label="¿Qué te ocurre?"
                  placeholder="Describe el síntoma principal y su localización…"
                  value={anamnesis.que}
                  onChange={(v) => updateAnamnesis({ ...anamnesis, que: v })}
                />
                <SpeechBubble
                  label="¿A qué lo achacas?"
                  placeholder="Mecanismo de lesión, trauma o forma de inicio…"
                  value={anamnesis.porque}
                  onChange={(v) => updateAnamnesis({ ...anamnesis, porque: v })}
                />
                <SpeechBubble
                  label="¿Desde cuándo?"
                  placeholder="Temporalidad: agudo (<6 sem), subagudo (6-12 sem), crónico (>12 sem)…"
                  value={anamnesis.desde}
                  onChange={(v) => updateAnamnesis({ ...anamnesis, desde: v })}
                />
              </>
            )}

            {/* Follow-up: Evolution module */}
            {isFollowUp && (
              <div className="space-y-4 rounded-xl border-2 border-secondary-200 bg-secondary-50/40 p-4">
                <div className="flex items-center gap-2">
                  <RefreshCw className="h-4 w-4 text-secondary-600" />
                  <h4 className="text-sm font-bold text-secondary-800">
                    Evolución y Novedades desde la última sesión
                  </h4>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Respuesta del tejido a las 24-48h
                  </label>
                  <textarea
                    value={evolucionTejido}
                    onChange={(e) => setEvolucionTejido(e.target.value)}
                    rows={2}
                    placeholder="Ej: Tolerancia a la carga mejorada, rigidez matutina disminuida, dolor post-ejercicio 2h…"
                    className="w-full resize-y rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-700 outline-none focus:border-secondary-400 focus:ring-2 focus:ring-secondary-100"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Cambios percibidos / Nuevas sensaciones
                  </label>
                  <textarea
                    value={nuevasSensaciones}
                    onChange={(e) => setNuevasSensaciones(e.target.value)}
                    rows={2}
                    placeholder="Ej: Aparece parestesia nocturna, dolor se desplaza lateralmente, mejora con frío…"
                    className="w-full resize-y rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-700 outline-none focus:border-secondary-400 focus:ring-2 focus:ring-secondary-100"
                  />
                </div>
                {/* Re-test of Signo Asterisco */}
                {comparable.movement && (
                  <div className="rounded-xl border border-primary-200 bg-primary-50/50 p-3">
                    <div className="mb-2 flex items-center gap-2">
                      <Target className="h-4 w-4 text-primary-600" />
                      <span className="text-xs font-bold uppercase tracking-wide text-primary-700">
                        Re-test del Signo Asterisco
                      </span>
                    </div>
                    <div className="mb-3 flex items-center gap-2 text-sm text-slate-600">
                      <span className="font-medium">{comparable.movement}</span>
                      <span className="rounded-lg bg-slate-100 px-2 py-0.5 text-xs">
                        {comparable.parameter === 'Dolor (EVA)' && `EVA previa: ${comparable.eva}/10`}
                        {comparable.parameter === 'Rango articular (ROM)' && `ROM previo: ${comparable.rom || '—'}°`}
                        {comparable.parameter === 'Déficit de fuerza / Inhibición' && comparable.forceMode === 'daniels' && `Daniels previo: ${comparable.forceGrade ?? '—'}`}
                        {comparable.parameter === 'Déficit de fuerza / Inhibición' && comparable.forceMode === 'dinamometro' && `Fuerza previa: ${comparable.forceKg ?? '—'} kg`}
                        {comparable.parameter === 'Aparición de parestesias' && 'Parestesias previas registradas'}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Mapa Corporal Interactivo
            </p>
            <BodyMap
              selected={region}
              onSelect={selectRegion}
              allowDeselect={!isFollowUp}
              multiSelect={!isFollowUp}
              selectedRegions={selectedRegions}
              onSelectedRegionsChange={updateSelectedRegions}
              laterality={laterality}
              onLateralityChange={setLaterality}
              subRegion={subRegion}
              onSubRegionChange={setSubRegion}
            />
          </div>
        </div>
        {/* Button 1: Suggest clinical questions + triaje */}
        {!isLiteMode && <div className="flex flex-col items-start gap-3 border-t border-slate-100 p-5 pt-4">
          <div className="flex items-center gap-3">
            <Button
              onClick={handleTriaje}
              disabled={triajeLoading || !geminiConfig.apiKey}
              size="lg"
            >
              {triajeLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Generando triaje…
                </>
              ) : (
                <>
                  <Brain className="h-4 w-4" /> Sugerir Preguntas Clínicas y Triaje
                </>
              )}
            </Button>
            {triajeError && (
              <p className="text-xs text-error-600">{triajeError}</p>
            )}
            {!geminiConfig.apiKey && !triajeError && (
              <p className="text-xs text-slate-400">
                Sin API key configurada — usa el botón de Ajustes para activarla.
              </p>
            )}
          </div>
          <p className="text-xs text-slate-400">
            Envía la anamnesis y región a Gemini para generar banderas rojas/amarillas y preguntas Sí/No de sospecha fenotípica.
          </p>
        </div>}
      </Card>
      <Card>
        <CardHeader
          step={2}
          title="Preguntas Dinámicas y Triaje de Seguridad"
          description="Preguntas guiadas + descarte de banderas rojas y evaluación psicosocial"
          icon={<MessageSquareText className="h-5 w-5" />}
        />
        <div className="space-y-6 p-5">
          {!isLiteMode && !isFollowUp && dynamicQuestions.length > 0 && (
            <div>
              <h4 className="mb-2 text-sm font-semibold text-slate-800">Preguntas sugeridas</h4>
              <div className="flex flex-wrap gap-2">
                {dynamicQuestions.map((question) => (
                  <span
                    key={question}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-500"
                  >
                    {question}
                  </span>
                ))}
              </div>
            </div>
          )}
          <div>
            <label htmlFor="open-questions-notes" className="mb-2 block text-sm font-semibold text-slate-800">
              Respuestas a preguntas abiertas y notas de la entrevista
            </label>
            <textarea
              id="open-questions-notes"
              value={openQuestionsNotes}
              onChange={(event) => setOpenQuestionsNotes(event.target.value)}
              rows={4}
              placeholder="Anota aquí lo que responda el paciente a las preguntas abiertas (patrón horario, tipo de dolor, gestos que alivian/empeoran) o cualquier matiz adicional..."
              className="w-full resize-y rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition-colors focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
            />
          </div>
          {/* Dichotomous Findings (Yes/No affirmations) */}
          <div className="mt-3 rounded-lg border border-primary-200 bg-white px-3 py-2 text-xs text-primary-800">
            Signo Asterisco de referencia (fijo): <strong>{previousComparable?.movement || comparable.movement}</strong>
          </div>
          <div>
            <div className="mb-1 flex items-center justify-between">
              <h4 className="text-sm font-semibold text-slate-800">Afirmaciones Dicótomicas (Sí / No)</h4>
              {dichotomousFindings.length > 0 && (
                <span className="text-xs text-slate-400">
                  {dichotomousFindings.filter((f) => f.answer === 'yes').length} Sí · {' '}
                  {dichotomousFindings.filter((f) => f.answer === 'no').length} No · {' '}
                  {dichotomousFindings.filter((f) => f.answer === null).length} sin responder
                </span>
              )}
            </div>
            {dichotomousFindings.length > 0 ? (
              <div className="space-y-2">
                {dichotomousFindings.map((f) => {
                  const consolidated = consolidatedFindingLabels.has(normalizeText(f.label));
                  return (
                    <div key={f.id}>
                      {isFollowUp && consolidated && (
                        <span className="mb-1 inline-block rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                          Consolidado en valoración inicial
                        </span>
                      )}
                      <DichotomousChip
                        finding={f}
                        expanded={expandedNoteId === f.id}
                        onAnswer={(ans) => setFindingAnswer(f.id, ans)}
                        onToggleExpand={() => setExpandedNoteId(expandedNoteId === f.id ? null : f.id)}
                        onNoteChange={(note) => setFindingNote(f.id, note)}
                      />
                      {f.needsReevaluation && !f.evolutionStatus && (
                        <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 p-3">
                          <p className="text-xs font-semibold text-amber-900">
                            🔄 IA recomienda re-preguntar según evolución: “{f.reevaluationReason}”
                          </p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {([
                              ['unchanged', 'Sigue igual'],
                              ['improved', 'Ha mejorado / Menos intenso'],
                              ['resolved', 'Resuelto (Ahora No)'],
                            ] as const).map(([status, label]) => (
                              <button
                                type="button"
                                key={status}
                                onClick={() => setFindingEvolution(f.id, status)}
                                className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-medium text-amber-900 hover:bg-amber-100"
                              >
                                {label}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                      {f.evolutionStatus && (
                        <p className="mt-2 text-xs text-slate-600">
                          Reevaluación: Inicial {answerLabel(f.previousAnswer)} → Hoy {evolutionLabel(f.evolutionStatus)}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : isLiteMode ? null : isFollowUp ? (
              <div className="flex flex-wrap gap-2">
                {dynamicQuestions.map((q) => (
                  <span
                    key={q}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-500"
                  >
                    {q}
                  </span>
                ))}
                <p className="w-full text-xs text-slate-400">
                  Pulsa “Sugerir Preguntas Clínicas y Triaje” para generar afirmaciones interactivas Sí/No.
                </p>
              </div>
            ) : (
              <p className="text-xs text-slate-400">
                Pulsa “Sugerir Preguntas Clínicas y Triaje” para generar afirmaciones interactivas Sí/No.
              </p>
            )}
          </div>

          {/* Red & Yellow Flags */}
          <div className="grid gap-6 md:grid-cols-2">
            {/* Red Flags */}
            <div>
              <div className="mb-3 flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-error-500" />
                <h4 className="text-sm font-semibold text-slate-800">Banderas Rojas</h4>
              </div>
              <div className="space-y-3">
                {redFlags.map((rf) => (
                  <div
                    key={rf.id}
                    className={`rounded-xl border p-4 transition-colors ${
                      rf.status === 'discarded'
                        ? 'border-success-200 bg-success-50'
                        : 'border-error-200 bg-error-50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2">
                        {rf.status === 'discarded' ? (
                          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-success-600" />
                        ) : (
                          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-error-500" />
                        )}
                        <div>
                          <p
                            className={`text-sm font-medium ${
                              rf.status === 'discarded' ? 'text-success-800' : 'text-error-800'
                            }`}
                          >
                            {rf.label}
                          </p>
                          <p className="mt-0.5 text-xs text-slate-500">{rf.detail}</p>
                        </div>
                      </div>
                      {rf.status === 'discarded' && (
                        <Badge variant="success">
                          <Check className="h-3 w-3" /> Descartada
                        </Badge>
                      )}
                    </div>
                    {rf.status === 'pending' && (
                      <button
                        type="button"
                        onClick={() => discardRedFlag(rf.id)}
                        className="mt-3 w-full rounded-lg border border-error-300 bg-white px-3 py-2 text-xs font-medium text-error-700 transition-colors hover:bg-error-100"
                      >
                        {rf.discardLabel}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Yellow Flags */}
            <div>
              <div className="mb-3 flex items-center gap-2">
                <Lightbulb className="h-5 w-5 text-warning-500" />
                <h4 className="text-sm font-semibold text-slate-800">Banderas Amarillas</h4>
              </div>
              <div className="space-y-2">
                {yellowFlags.map((yf) => (
                  <button
                    type="button"
                    key={yf.id}
                    onClick={() => toggleYellow(yf.id)}
                    className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-all ${
                      yf.checked
                        ? 'border-warning-300 bg-warning-50'
                        : 'border-slate-200 bg-white hover:border-warning-200'
                    }`}
                  >
                    <div
                      className={`flex h-5 w-5 items-center justify-center rounded border transition-colors ${
                        yf.checked
                          ? 'border-warning-500 bg-warning-500 text-white'
                          : 'border-slate-300 bg-white'
                      }`}
                    >
                      {yf.checked && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                    </div>
                    <span className={`text-sm ${yf.checked ? 'text-warning-800' : 'text-slate-600'}`}>
                      {yf.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>
            {equipmentSafety.length > 0 && (
              <section className="rounded-xl border border-amber-200 bg-amber-50/50 p-4">
                <div className="mb-3 flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-amber-700" />
                  <div>
                    <h4 className="text-sm font-semibold text-slate-800">Seguridad de Aparatología y Contraindicaciones</h4>
                    <p className="text-xs text-slate-500">Marca las condiciones presentes para ver restricciones concretas y alternativas terapéuticas.</p>
                  </div>
                </div>
                <div className="space-y-2">
                  {equipmentSafety.map((check) => (
                    <div key={check.id} className="flex flex-col gap-2 rounded-lg border border-white bg-white p-3">
                      <span className="w-full text-sm text-slate-700">{check.label}</span>
                      <div className="flex items-center justify-between gap-2">
                        <span className={`text-[10px] font-medium ${check.present === null ? 'text-amber-700' : 'text-slate-500'}`}>
                          {check.present === null ? 'Pendiente de valorar' : 'Revisado'}
                        </span>
                        <div className="flex shrink-0 gap-1.5">
                          {[false, true].map((present) => (
                            <button
                              type="button"
                              key={String(present)}
                              aria-pressed={check.present === present}
                              onClick={() => setEquipmentSafetyAnswers((current) => ({ ...current, [check.id]: present }))}
                              className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${
                                check.present === present
                                  ? present ? 'border-error-500 bg-error-600 text-white' : 'border-success-500 bg-success-600 text-white'
                                  : 'border-slate-200 bg-white text-slate-500'
                              }`}
                            >
                              {present ? 'Presente / Sí' : 'Descartado'}
                            </button>
                          ))}
                        </div>
                      </div>
                      {check.present && (
                        <div role="alert" className="grid w-full gap-2 sm:grid-cols-2">
                          <div className="rounded-lg border border-error-300 bg-error-50 px-3 py-2">
                            <p className="mb-1 text-xs font-bold text-error-800">⛔ CONTRAINDICADO</p>
                            <ul className="space-y-1 text-xs text-error-800">
                              {check.contraindicatedTechniques.map((technique) => (
                                <li key={technique}>• {technique}</li>
                              ))}
                            </ul>
                          </div>
                          <div className="rounded-lg border border-success-300 bg-success-50 px-3 py-2">
                            <p className="mb-1 text-xs font-bold text-success-800">✅ PERMITIDO / ALTERNATIVAS SEGURAS</p>
                            {check.allowedTechniques.length > 0 ? (
                              <ul className="space-y-1 text-xs text-success-800">
                                {check.allowedTechniques.map((technique) => (
                                  <li key={technique}>• {technique}</li>
                                ))}
                              </ul>
                            ) : (
                              <p className="text-xs text-success-800">
                                No hay alternativas preautorizadas para la zona afectada; requiere valoración/coordinación médica antes de tratarla.
                              </p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        </div>
      </Card>

      {/* Step 3: Physical Exploration & Tests */}
      <Card>
        <CardHeader
          step={3}
          title="Exploración Física y Tests"
          description="Tests ortopédicos, pruebas complementarias, ecografía y anotaciones manuales"
          icon={<Stethoscope className="h-5 w-5" />}
        />
        <div className="space-y-6 p-5">
          {!isLiteMode && <div className="flex flex-col items-start gap-3 rounded-xl bg-gradient-to-r from-primary-50 to-secondary-50 p-4">
            <div className="flex flex-wrap items-center gap-3">
              <Button
                onClick={handleSuggestTests}
                disabled={testsLoading || !geminiConfig.apiKey || dichotomousFindings.length === 0}
                size="lg"
              >
                {testsLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Generando tests…
                  </>
                ) : (
                  <>
                    <Stethoscope className="h-4 w-4" /> Sugerir Tests Ortopédicos y Funcionales
                  </>
                )}
              </Button>
              {testsError && <p className="text-xs text-error-600">{testsError}</p>}
              {!geminiConfig.apiKey && !testsError && (
                <p className="text-xs text-slate-400">Sin API key configurada.</p>
              )}
              {geminiConfig.apiKey && dichotomousFindings.length === 0 && !testsError && (
                <p className="text-xs text-slate-400">Responde primero las preguntas Sí/No para activar este paso.</p>
              )}
              {testsNotice && (
                <div className="flex items-center gap-2 rounded-lg border border-secondary-100 bg-secondary-50 px-3 py-2">
                  <Stethoscope className="h-3.5 w-3.5 shrink-0 text-secondary-500" />
                  <p className="text-xs font-medium text-secondary-700">{testsNotice}</p>
                </div>
              )}
            </div>
            <p className="text-xs text-slate-400">
              Usa las respuestas Sí/No y las notas de la entrevista para sugerir tests físicos dirigidos a la sospecha clínica.
            </p>
          </div>}
          {/* Complementary Tests */}
          <div>
            <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-800">
              <FileText className="h-4 w-4 text-slate-500" />
              Pruebas Complementarias / Radiodiagnóstico
            </h4>
            <textarea
              value={complementary}
              onChange={(e) => setComplementary(e.target.value)}
              rows={3}
              placeholder="Ej: RM de rodilla: tendón rotuliano con señal intratendínea…"
              className="w-full resize-y rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-700 outline-none transition-colors focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
            />
          </div>

          {/* Orthopedic Tests */}
          <div>
            <h4 className="mb-3 text-sm font-semibold text-slate-800">
              {isLiteMode ? 'Tests Ortopédicos Rápidos' : 'Tests Ortopédicos Sugeridos'}
            </h4>
            {isFollowUp && consolidatedTestNames.size > 0 && (
              <p className="mb-2 text-xs text-secondary-700">
                Los tests con resultado de la valoración inicial se conservan; se añaden hasta dos propuestas nuevas.
              </p>
            )}
            <OrthopedicTests
              tests={tests}
              onResultChange={handleTestResult}
              onEvolutionChange={setTestEvolution}
            />
          </div>

          {/* Dynamic Ultrasound / Sonoanatomical Exploration */}
          {equipment.ecografo && (
            <div className="rounded-xl border border-secondary-100 bg-secondary-50/50 p-4">
              <div className="mb-3 flex items-center gap-2">
                <Microscope className="h-5 w-5 text-secondary-600" />
                <h4 className="text-sm font-semibold text-slate-800">
                  Ecografía Clínica Musculoesquelética
                </h4>
                <Badge variant="primary">Ecógrafo activo</Badge>
              </div>

              {!isLiteMode ? (
                <>
              <button
                type="button"
                onClick={handleSuggestSonoTargets}
                disabled={sonoTargetsLoading || !geminiConfig.apiKey || !region}
                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-secondary-600 to-secondary-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:shadow-md disabled:cursor-not-allowed disabled:opacity-40"
              >
                {sonoTargetsLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Sugiriendo dianas…
                  </>
                ) : (
                  <>
                    <Microscope className="h-4 w-4" /> Sugerir Dianas Ecográficas
                  </>
                )}
              </button>
              {sonoTargetsError && (
                <p className="mt-2 text-xs text-error-600">{sonoTargetsError}</p>
              )}
              {!region && !sonoTargets.length && (
                <p className="mt-2 text-xs text-slate-400">Selecciona una región anatómica para sugerir dianas ecográficas.</p>
              )}

              {sonoTargets.length > 0 && (
                <div className="mt-4 space-y-3">
                  {sonoTargets.map((target) => (
                    <div key={target.id} className="rounded-xl border border-slate-200 bg-white p-4">
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <h5 className="text-sm font-bold text-slate-800">{target.name}</h5>
                        {target.findings.length > 0 && (
                          <Badge variant={target.findings.includes('Sin alteraciones / Ecoestructura normal') ? 'success' : 'warning'}>
                            {target.findings.length} hallazgo{target.findings.length > 1 ? 's' : ''}
                          </Badge>
                        )}
                      </div>
                      {target.rationale && (
                        <p className="mb-2 text-xs leading-relaxed text-slate-500">{target.rationale}</p>
                      )}
                      {target.probeOrientation && (
                        <p className="mb-2 text-xs text-secondary-600">
                          <span className="font-semibold">Orientación de sonda:</span> {target.probeOrientation}
                        </p>
                      )}
                      <div className="flex flex-wrap gap-1.5">
                        {SONO_FINDING_OPTIONS.map((option) => {
                          const active = target.findings.includes(option);
                          const isNormal = option === 'Sin alteraciones / Ecoestructura normal';
                          return (
                            <button
                              type="button"
                              key={option}
                              onClick={() => toggleSonoFinding(target.id, option)}
                              className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition-all ${
                                active
                                  ? isNormal
                                    ? 'border-success-400 bg-success-50 text-success-700'
                                    : 'border-secondary-400 bg-secondary-50 text-secondary-700'
                                  : 'border-slate-200 bg-white text-slate-500 hover:border-secondary-200 hover:text-slate-600'
                              }`}
                            >
                              {active && <Check className="mr-1 inline h-3 w-3" strokeWidth={3} />}
                              {option}
                            </button>
                          );
                        })}
                      </div>
                      <input
                        type="text"
                        value={target.notes}
                        onChange={(e) => setSonoNotes(target.id, e.target.value)}
                        placeholder="Grosor / Medición (mm) u observaciones ecográficas…"
                        className="mt-2.5 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-700 outline-none focus:border-secondary-400 focus:ring-2 focus:ring-secondary-100"
                      />
                    </div>
                  ))}
                </div>
              )}
                </>
              ) : (
                <div>
                  <label htmlFor="manual-sono-findings" className="mb-2 block text-sm font-semibold text-slate-800">
                    Hallazgos ecográficos y sonoanatomía
                  </label>
                  <textarea
                    id="manual-sono-findings"
                    value={manualSonoFindings}
                    onChange={(event) => setManualSonoFindings(event.target.value)}
                    rows={4}
                    placeholder="Describe la sonoanatomía observada, las estructuras exploradas y los hallazgos ecográficos."
                    className="w-full resize-y rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition-colors focus:border-secondary-400 focus:ring-2 focus:ring-secondary-100"
                  />
                </div>
              )}
            </div>
          )}

          {/* Free Exploration */}
          <div>
            <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-800">
              <ClipboardList className="h-4 w-4 text-slate-500" />
              Exploración Libre / Tests Adicionales
            </h4>
            <textarea
              value={freeExploration}
              onChange={(e) => setFreeExploration(e.target.value)}
              rows={3}
              placeholder={isLiteMode
                ? 'Anota otros hallazgos observados durante la exploración física.'
                : 'Registra cualquier test o hallazgo manual no contemplado por la IA…'}
              className="w-full resize-y rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-700 outline-none transition-colors focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
            />
          </div>
        </div>
      </Card>

      {/* Step 4: Resolution — AI Recalculate + Hypotheses + Comparable + Prognosis + Treatment */}
      <Card>
        <CardHeader
          step={4}
          title={isLiteMode ? 'Diagnóstico y Plan de Tratamiento' : 'Resolución: Hipótesis, Signo Comparable y Pronóstico'}
          description={isLiteMode
            ? 'Registro manual del diagnóstico, Signo Asterisco y técnicas aplicadas'
            : 'Recálculo con IA, diagnóstico, test-retest y propuesta de tratamiento'}
          icon={isLiteMode ? <Stethoscope className="h-5 w-5" /> : <Brain className="h-5 w-5" />}
        />
        <div className="space-y-6 p-5">
          {!isLiteMode && <>
          {/* AI Recalculate Button */}
          <div className="flex flex-col items-start gap-3 rounded-xl bg-gradient-to-r from-primary-50 to-secondary-50 p-4">
            <div className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-primary-600" />
              <p className="text-sm font-medium text-slate-700">
                Recalcular hipótesis y diagnóstico con IA en base a los datos marcados
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Button
                onClick={recalculateWithAI}
                disabled={aiLoading || !geminiConfig.apiKey}
                size="lg"
              >
                {aiLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Analizando…
                  </>
                ) : (
                  <>
                    <Zap className="h-4 w-4" /> Recalcular Hipótesis y Diagnóstico
                  </>
                )}
              </Button>
              {aiError && (
                <p className="text-xs text-error-600">{aiError}</p>
              )}
              {!geminiConfig.apiKey && !aiError && (
                <p className="text-xs text-slate-400">
                  Sin API key configurada — usa el botón de Ajustes para activarla.
                </p>
              )}
            </div>
          </div>
          </>}

          {isLiteMode && (
            <div className="grid gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div>
                <label htmlFor="manual-clinical-diagnosis" className="mb-2 block text-sm font-semibold text-slate-800">
                  Diagnóstico Fisioterápico
                </label>
                <textarea
                  id="manual-clinical-diagnosis"
                  value={manualClinicalDiagnosis}
                  onChange={(event) => setManualClinicalDiagnosis(event.target.value)}
                  rows={3}
                  placeholder="Escribe el diagnóstico fisioterápico valorado."
                  className="w-full resize-y rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition-colors focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
                />
              </div>
              <div>
                <label htmlFor="manual-treatment-plan" className="mb-2 block text-sm font-semibold text-slate-800">
                  Plan de Tratamiento / Técnicas Aplicadas
                </label>
                <textarea
                  id="manual-treatment-plan"
                  value={manualTreatmentPlan}
                  onChange={(event) => setManualTreatmentPlan(event.target.value)}
                  rows={4}
                  placeholder="Registra el plan acordado o las técnicas aplicadas."
                  className="w-full resize-y rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition-colors focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
                />
              </div>
            </div>
          )}

          {/* Hypotheses */}
          {!isLiteMode && <>
          <div>
            <h4 className="mb-3 text-sm font-semibold text-slate-800">Hipótesis Diagnósticas</h4>
            {hypotheses.length === 0 ? (
              <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
                Pendiente de valoración clínica y generación.
              </p>
            ) : (
              <div className="grid gap-4 md:grid-cols-3">
              {[...hypotheses]
                .sort((a, b) => (b.isPrimary ? 1 : 0) - (a.isPrimary ? 1 : 0))
                .map((h) => (
                  <div
                    key={h.id}
                    className={`rounded-xl border-2 p-4 transition-all ${
                      h.isPrimary
                        ? 'border-primary-300 bg-primary-50/50'
                        : 'border-slate-200 bg-white'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        {h.isPrimary && (
                          <Badge variant="primary">
                            <span className="h-1.5 w-1.5 rounded-full bg-primary-500" /> Hipótesis Principal
                          </Badge>
                        )}
                        <h4
                          className={`mt-1.5 text-sm font-semibold ${
                            h.isPrimary ? 'text-primary-800' : 'text-slate-700'
                          }`}
                        >
                          {h.label}
                        </h4>
                        {h.painPhenotype && (
                          <span className="mt-1.5 inline-block rounded-full bg-secondary-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-secondary-700">
                            {h.painPhenotype}
                          </span>
                        )}
                      </div>
                    </div>
                    {h.justification && (
                      <p className="mt-3 text-xs leading-relaxed text-slate-500">{h.justification}</p>
                    )}
                    {!h.isPrimary && h.differentialTest && (
                      <button
                        type="button"
                        onClick={() => setDifferentialModal(h)}
                        className="mt-3 flex items-center gap-1 text-xs font-medium text-secondary-600 hover:text-secondary-700"
                      >
                        Ver test diferencial <ChevronRight className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
          </>}

          {/* Comparable Sign / Asterisk */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
            <div className="mb-3 flex items-center gap-2">
              <Target className="h-5 w-5 text-primary-600" />
              <h4 className="text-sm font-semibold text-slate-800">
                Signo Asterisco / Signo Comparable (Test-Retest)
              </h4>
              {!isLiteMode && comparable.instructions && (
                <Badge variant="primary">
                  <Brain className="h-3 w-3" /> Auto-generado por IA
                </Badge>
              )}
            </div>
            {isFollowUp && (
              <div className="mb-4 rounded-lg border border-primary-200 bg-primary-50 px-3 py-2 text-sm text-primary-800">
                Signo Asterisco de referencia (fijo durante todo el episodio): <strong>{previousComparable?.movement || comparable.movement || 'sin gesto basal registrado'}</strong>
              </div>
            )}
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">
                  {isLiteMode ? 'Signo Asterisco de Referencia' : 'Gesto Funcional Diana'}
                </label>
                <input
                  value={comparable.movement}
                  readOnly={isFollowUp}
                  onChange={(e) => setComparable({ ...comparable, movement: e.target.value })}
                  className={`w-full rounded-xl border px-4 py-2.5 text-sm text-slate-700 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100 ${
                    isFollowUp ? 'cursor-not-allowed border-slate-200 bg-slate-100' : 'border-slate-200'
                  }`}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Parámetro Evaluado
                </label>
                <div className="flex flex-wrap gap-2">
                  {['Dolor (EVA)', 'Rango articular (ROM)', 'Déficit de fuerza / Inhibición', 'Aparición de parestesias'].map((p) => (
                    <button
                      type="button"
                      key={p}
                      onClick={() => setComparable({ ...comparable, parameter: p })}
                      className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-all ${
                        comparable.parameter === p
                          ? 'border-primary-400 bg-primary-50 text-primary-700'
                          : 'border-slate-200 bg-white text-slate-500 hover:border-primary-200'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              {/* Dynamic measurement controls based on parameter */}
              {comparable.parameter === 'Dolor (EVA)' && (
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">
                      {isFollowUp ? 'EVA PRE-TRATAMIENTO / ACTUAL (0–10)' : 'EVA Pre-tratamiento (0–10)'}
                    </label>
                    <div className="flex items-center gap-3">
                      <input
                        type="range"
                        min={0}
                        max={10}
                        value={isFollowUp ? evaActualPresesion ?? comparable.eva : comparable.eva}
                        onChange={(e) => isFollowUp
                          ? setEvaActualPresesion(Number(e.target.value))
                          : setComparable({ ...comparable, eva: Number(e.target.value) })}
                        className="flex-1 accent-primary-600"
                      />
                      <span className="flex h-10 w-12 items-center justify-center rounded-lg bg-primary-600 text-lg font-bold text-white">
                        {isFollowUp ? evaActualPresesion ?? comparable.eva : comparable.eva}
                      </span>
                    </div>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">
                      EVA Post-tratamiento (Test-Retest)
                    </label>
                    <div className="flex items-center gap-3">
                      <input
                        type="range"
                        min={0}
                        max={10}
                        value={comparable.evaPost ?? 0}
                        onChange={(e) => setComparable({ ...comparable, evaPost: Number(e.target.value) })}
                        className="flex-1 accent-emerald-600"
                      />
                      <span className={`flex h-10 w-12 items-center justify-center rounded-lg text-lg font-bold text-white ${
                        comparable.evaPost === null ? 'bg-slate-300' : 'bg-emerald-600'
                      }`}>
                        {comparable.evaPost ?? '—'}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {isFollowUp && (
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Respuesta funcional / rango alcanzado
                  </label>
                  <input
                    value={functionalLimitation}
                    onChange={(e) => setFunctionalLimitation(e.target.value)}
                    placeholder="Rango alcanzado / respuesta mecánica (ej. llega a tercio medio de tibia sin dolor)"
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
                  />
                </div>
              )}

              {comparable.parameter === 'Rango articular (ROM)' && (
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">
                      ROM Pre-tratamiento (grados)
                    </label>
                    <GoniometerDial
                      value={comparable.rom ? parseInt(comparable.rom) || 0 : 0}
                      onChange={(v) => setComparable({ ...comparable, rom: String(v) })}
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">
                      ROM Post-tratamiento (grados)
                    </label>
                    <GoniometerDial
                      value={comparable.romPost ? parseInt(comparable.romPost) || 0 : 0}
                      onChange={(v) => setComparable({ ...comparable, romPost: String(v) })}
                      color="emerald"
                    />
                  </div>
                </div>
              )}

              {comparable.parameter === 'Déficit de fuerza / Inhibición' && (
                <div className="space-y-4">
                  {/* Force mode selector */}
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Modalidad de registro
                    </label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setComparable({ ...comparable, forceMode: 'daniels' })}
                        className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-all ${
                          comparable.forceMode === 'daniels'
                            ? 'border-primary-400 bg-primary-50 text-primary-700'
                            : 'border-slate-200 bg-white text-slate-500 hover:border-primary-200'
                        }`}
                      >
                        Escala Daniels (0–5)
                      </button>
                      <button
                        type="button"
                        onClick={() => setComparable({ ...comparable, forceMode: 'dinamometro' })}
                        className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-all ${
                          comparable.forceMode === 'dinamometro'
                            ? 'border-primary-400 bg-primary-50 text-primary-700'
                            : 'border-slate-200 bg-white text-slate-500 hover:border-primary-200'
                        }`}
                      >
                        Dinamometría (kg)
                      </button>
                    </div>
                  </div>

                  {/* Daniels scale */}
                  {comparable.forceMode === 'daniels' && (
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">
                          Grado Daniels Pre-tratamiento
                        </label>
                        <div className="flex gap-1.5">
                          {[0, 1, 2, 3, 4, 5].map((g) => (
                            <button
                              type="button"
                              key={g}
                              onClick={() => setComparable({ ...comparable, forceGrade: g })}
                              title={DANIELS_LEGEND[g]}
                              className={`flex h-10 w-10 items-center justify-center rounded-lg text-sm font-bold transition-all ${
                                comparable.forceGrade === g
                                  ? 'bg-primary-600 text-white shadow-sm'
                                  : 'border border-slate-200 bg-white text-slate-600 hover:border-primary-300'
                              }`}
                            >
                              {g}
                            </button>
                          ))}
                        </div>
                        {comparable.forceGrade !== null && (
                          <p className="mt-1.5 text-xs text-slate-500">{DANIELS_LEGEND[comparable.forceGrade]}</p>
                        )}
                      </div>
                      <div>
                        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">
                          Grado Daniels Post-tratamiento
                        </label>
                        <div className="flex gap-1.5">
                          {[0, 1, 2, 3, 4, 5].map((g) => (
                            <button
                              type="button"
                              key={g}
                              onClick={() => setComparable({ ...comparable, forceGradePost: g })}
                              title={DANIELS_LEGEND[g]}
                              className={`flex h-10 w-10 items-center justify-center rounded-lg text-sm font-bold transition-all ${
                                comparable.forceGradePost === g
                                  ? 'bg-emerald-600 text-white shadow-sm'
                                  : 'border border-slate-200 bg-white text-slate-600 hover:border-emerald-300'
                              }`}
                            >
                              {g}
                            </button>
                          ))}
                        </div>
                        {comparable.forceGradePost !== null && (
                          <p className="mt-1.5 text-xs text-slate-500">{DANIELS_LEGEND[comparable.forceGradePost]}</p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Dynamometer */}
                  {comparable.forceMode === 'dinamometro' && (
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">
                          Fuerza Pre-tratamiento (kg)
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            value={comparable.forceKg ?? ''}
                            onChange={(e) => setComparable({ ...comparable, forceKg: e.target.value ? Number(e.target.value) : null })}
                            placeholder="Ej: 18.5"
                            className="w-24 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
                          />
                          <span className="text-sm text-slate-500">kg</span>
                        </div>
                      </div>
                      <div>
                        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">
                          Fuerza Post-tratamiento (kg)
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            value={comparable.forceKgPost ?? ''}
                            onChange={(e) => setComparable({ ...comparable, forceKgPost: e.target.value ? Number(e.target.value) : null })}
                            placeholder="Ej: 22.0"
                            className="w-24 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                          />
                          <span className="text-sm text-slate-500">kg</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {!comparable.forceMode && (
                    <p className="text-xs text-slate-400">Selecciona una modalidad de registro de fuerza.</p>
                  )}
                </div>
              )}

              {comparable.parameter === 'Aparición de parestesias' && (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">
                    Registra la aparición o variación de parestesias en el campo de instrucciones Test-Retest.
                  </p>
                </div>
              )}

              {/* Instructions */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Instrucciones Test-Retest
                </label>
                <input
                  value={comparable.instructions}
                  onChange={(e) => setComparable({ ...comparable, instructions: e.target.value })}
                  placeholder={isFollowUp
                    ? 'Detalles del retest (mismo gesto basal, posición o respuesta observada)'
                    : 'Ej: Medir dolor EVA tras intervención en la misma angulación'}
                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-700 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
                />
              </div>

              {/* Improvement summary — dynamic per parameter */}
              {comparable.parameter === 'Dolor (EVA)' && comparable.evaPost !== null && (
                <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                  <TrendingUp className="h-4 w-4 text-emerald-600" />
                  <span className="text-sm font-medium text-emerald-800">
                    Mejoría: {(isFollowUp ? evaActualPresesion ?? comparable.eva : comparable.eva) - comparable.evaPost} puntos EVA
                    ({(isFollowUp ? evaActualPresesion ?? comparable.eva : comparable.eva) > 0
                      ? Math.round((((isFollowUp ? evaActualPresesion ?? comparable.eva : comparable.eva) - comparable.evaPost) /
                        (isFollowUp ? evaActualPresesion ?? comparable.eva : comparable.eva)) * 100)
                      : 0}%)
                  </span>
                </div>
              )}
              {comparable.parameter === 'Rango articular (ROM)' && comparable.romPost && (
                <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                  <TrendingUp className="h-4 w-4 text-emerald-600" />
                  <span className="text-sm font-medium text-emerald-800">
                    Ganancia de ROM: {comparable.rom}° → {comparable.romPost}° (+{parseInt(comparable.romPost) - parseInt(comparable.rom)}°)
                  </span>
                </div>
              )}
              {comparable.parameter === 'Déficit de fuerza / Inhibición' && comparable.forceMode === 'daniels' && comparable.forceGradePost !== null && comparable.forceGrade !== null && (
                <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                  <TrendingUp className="h-4 w-4 text-emerald-600" />
                  <span className="text-sm font-medium text-emerald-800">
                    Mejoría: Grado {comparable.forceGrade} → {comparable.forceGradePost} (+{comparable.forceGradePost - comparable.forceGrade} grado{comparable.forceGradePost - comparable.forceGrade !== 1 ? 's' : ''})
                  </span>
                </div>
              )}
              {comparable.parameter === 'Déficit de fuerza / Inhibición' && comparable.forceMode === 'dinamometro' && comparable.forceKgPost !== null && comparable.forceKg !== null && (
                <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                  <TrendingUp className="h-4 w-4 text-emerald-600" />
                  <span className="text-sm font-medium text-emerald-800">
                    Mejoría: {comparable.forceKg} kg → {comparable.forceKgPost} kg (+{(comparable.forceKgPost - comparable.forceKg).toFixed(1)} kg)
                  </span>
                </div>
              )}
            </div>
          </div>

          {!isLiteMode && <>
          {/* Prognosis */}
          <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-5">
            <div className="mb-4 flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-secondary-600" />
              <h4 className="text-sm font-semibold text-slate-800">
                Pronóstico y Tiempos Biológicos de Recuperación
              </h4>
              {aiPrognosis && (
                <Badge variant="primary">
                  <Brain className="h-3 w-3" /> Actualizado por IA
                </Badge>
              )}
            </div>
            {aiPrognosis?.text && (
              <div className="mb-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-primary-100 bg-primary-50/50 p-3">
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-primary-700">Pronóstico</p>
                  <p className="text-sm text-slate-700">{aiPrognosis.text}</p>
                </div>
                {aiPrognosis.recoveryTime && (
                  <div className="rounded-lg border border-secondary-100 bg-secondary-50/60 p-3">
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-secondary-700">Recuperación funcional estimada</p>
                    <p className="text-sm font-semibold text-slate-700">{aiPrognosis.recoveryTime}</p>
                  </div>
                )}
              </div>
            )}
            {hasAiGradePrognosis && aiPrognosis && (
              <div className="grid gap-3 md:grid-cols-3">
                {[
                { grade: 'Grado I', timeline: '', title: aiPrognosis.grade1, explanation: '' },
                { grade: 'Grado II', timeline: '', title: aiPrognosis.grade2, explanation: '' },
                { grade: 'Grado III', timeline: '', title: aiPrognosis.grade3, explanation: '' },
              ].filter((grade) => grade.title).map((g, idx) => (
                <div key={g.grade + idx} className="rounded-lg border border-slate-200 bg-white p-4">
                  <div className="flex items-center justify-between">
                    <span className="rounded-full bg-secondary-100 px-2.5 py-0.5 text-xs font-bold text-secondary-700">
                      {g.grade}
                    </span>
                  </div>
                  <h5 className="mt-2 text-sm font-semibold text-slate-700">
                    {g.title.split(':')[0]}
                  </h5>
                  <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
                    {g.title}
                  </p>
                </div>
              ))}
              </div>
            )}
            {!aiPrognosis?.text && !aiPrognosis?.recoveryTime && !hasAiGradePrognosis && (
              <p className="rounded-lg border border-dashed border-slate-200 bg-white/70 px-4 py-5 text-sm text-slate-500">
                Pendiente de generación tras la valoración clínica.
              </p>
            )}
          </div>

          {/* Treatment Proposal */}
          {aiTreatment && (
            <div className="rounded-xl border border-secondary-100 bg-secondary-50/40 p-4">
              <div className="mb-2 flex items-center gap-2">
                <ClipboardList className="h-4 w-4 text-secondary-600" />
                <h4 className="text-sm font-semibold text-slate-800">Propuesta de Tratamiento</h4>
                <Badge variant="primary">
                  <Brain className="h-3 w-3" /> IA
                </Badge>
              </div>
              <p className="text-sm leading-relaxed text-slate-600">{aiTreatment}</p>
            </div>
          )}
          </>}
        </div>
      </Card>

      {/* Differential Test Modal */}
      <Modal
        open={!!differentialModal}
        onClose={() => setDifferentialModal(null)}
        title="Test Diferencial"
        subtitle={differentialModal?.label}
        size="md"
      >
        <div className="space-y-3">
          <div className="rounded-lg bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Criterio de diferenciación
            </p>
            <p className="mt-2 text-sm text-slate-700">{differentialModal?.differentialTest}</p>
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-secondary-100 bg-secondary-50 p-3">
            <Brain className="h-4 w-4 text-secondary-600" />
            <p className="text-xs text-secondary-700">
              Compara el resultado de los tests ortopédicos para distinguir entre hipótesis.
            </p>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function DichotomousChip({
  finding,
  expanded,
  onAnswer,
  onToggleExpand,
  onNoteChange,
}: {
  finding: DichotomousFinding;
  expanded: boolean;
  onAnswer: (answer: DichotomousAnswer) => void;
  onToggleExpand: () => void;
  onNoteChange: (note: string) => void;
}) {
  const isYes = finding.answer === 'yes';
  const isNo = finding.answer === 'no';

  return (
    <div
      className={`rounded-xl border p-3 transition-all ${
        isYes
          ? 'border-emerald-300 bg-emerald-50'
          : isNo
            ? 'border-rose-300 bg-rose-50'
            : 'border-slate-200 bg-white'
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {isYes && <Check className="h-4 w-4 shrink-0 text-emerald-600" strokeWidth={3} />}
          {isNo && <X className="h-4 w-4 shrink-0 text-rose-500" strokeWidth={3} />}
          <span
            className={`text-sm font-medium ${
              isYes ? 'text-emerald-800' : isNo ? 'text-rose-700 line-through' : 'text-slate-700'
            }`}
          >
            {finding.label}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => onAnswer('yes')}
            className={`flex h-8 min-w-12 items-center justify-center gap-1 rounded-lg px-2 text-xs font-bold transition-all ${
              isYes
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'border border-slate-200 bg-white text-slate-500 hover:border-emerald-400 hover:text-emerald-600'
            }`}
          >
            {finding.isStatic && <Check className="h-3.5 w-3.5" aria-hidden="true" />}
            Sí
          </button>
          <button
            type="button"
            onClick={() => onAnswer('no')}
            className={`flex h-8 min-w-12 items-center justify-center gap-1 rounded-lg px-2 text-xs font-bold transition-all ${
              isNo
                ? 'bg-rose-600 text-white shadow-sm'
                : 'border border-slate-200 bg-white text-slate-500 hover:border-rose-400 hover:text-rose-600'
            }`}
          >
            {finding.isStatic && <X className="h-3.5 w-3.5" aria-hidden="true" />}
            No
          </button>
          <button
            type="button"
            onClick={onToggleExpand}
            className={`flex h-8 w-8 items-center justify-center rounded-lg transition-all ${
              finding.note
                ? 'text-primary-600'
                : 'text-slate-300 hover:text-slate-500'
            }`}
            title="Añadir nota"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      {expanded && (
        <textarea
          value={finding.note}
          onChange={(e) => onNoteChange(e.target.value)}
          placeholder="Nota rápida (opcional)…"
          rows={2}
          className="mt-2.5 w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-600 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
        />
      )}
    </div>
  );
}

function toDichotomousAnswer(answer: string): DichotomousAnswer {
  const normalized = normalizeText(answer);
  if (normalized === 'yes' || normalized === 'si') return 'yes';
  if (normalized === 'no') return 'no';
  return null;
}

function toTestResult(result: string): TestResult {
  const normalized = normalizeText(result);
  if (normalized === 'positivo' || normalized === '+') return 'positivo';
  if (normalized === 'negativo' || normalized === '-') return 'negativo';
  if (normalized === 'dudoso') return 'dudoso';
  return null;
}

function SpeechBubble({
  label,
  placeholder,
  value,
  onChange,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="relative">
      <div className="relative rounded-2xl rounded-bl-sm border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-2 flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary-100 text-primary-600">
            <MessageSquareText className="h-4 w-4" />
          </div>
          <span className="text-sm font-semibold text-slate-700">{label}</span>
        </div>
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={2}
          className="w-full resize-none border-0 bg-transparent text-sm text-slate-600 outline-none placeholder:text-slate-300"
        />
      </div>
    </div>
  );
}

const DANIELS_LEGEND: Record<number, string> = {
  0: 'Parálisis completa / Sin contracción visible ni palpable.',
  1: 'Contracción palpable o visible sin desplazamiento del segmento articular.',
  2: 'Movimiento activo completo anulando la gravedad.',
  3: 'Movimiento activo completo contra la gravedad, sin resistencia externa.',
  4: 'Movimiento activo completo contra gravedad y resistencia moderada.',
  5: 'Fuerza normal / Movimiento completo contra resistencia máxima.',
};

function GoniometerDial({
  value,
  onChange,
  color = 'primary',
}: {
  value: number;
  onChange: (v: number) => void;
  color?: 'primary' | 'emerald';
}) {
  const size = 160;
  const radius = 65;
  const center = size / 2;
  const max = 360;
  const clamped = Math.max(0, Math.min(max, value));
  const angle = (clamped / max) * 360 - 90;
  const rad = (angle * Math.PI) / 180;
  const dotX = center + radius * Math.cos(rad);
  const dotY = center + radius * Math.sin(rad);
  const accentColor = color === 'emerald' ? '#10b981' : '#3b82f6';
  const trackColor = color === 'emerald' ? '#d1fae5' : '#dbeafe';

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const dx = e.clientX - rect.left - center;
    const dy = e.clientY - rect.top - center;
    let deg = Math.atan2(dy, dx) * (180 / Math.PI) + 90;
    if (deg < 0) deg += 360;
    onChange(Math.round(deg));
  };

  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    handlePointerMove(e);
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <svg
        width={size}
        height={size}
        onPointerDown={handlePointerDown}
        onPointerMove={(e) => {
          if (e.buttons === 1) handlePointerMove(e);
        }}
        className="cursor-pointer touch-none select-none"
      >
        {/* Track */}
        <circle cx={center} cy={center} r={radius} fill="none" stroke={trackColor} strokeWidth={12} />
        {/* Arc from 0 to value */}
        <path
          d={describeArc(center, center, radius, 0, clamped)}
          fill="none"
          stroke={accentColor}
          strokeWidth={12}
          strokeLinecap="round"
        />
        {/* Tick marks every 30° */}
        {Array.from({ length: 12 }, (_, i) => {
          const tickAngle = (i * 30 - 90) * (Math.PI / 180);
          const x1 = center + (radius - 8) * Math.cos(tickAngle);
          const y1 = center + (radius - 8) * Math.sin(tickAngle);
          const x2 = center + (radius + 8) * Math.cos(tickAngle);
          const y2 = center + (radius + 8) * Math.sin(tickAngle);
          return (
            <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#94a3b8" strokeWidth={1.5} />
          );
        })}
        {/* Draggable dot */}
        <circle cx={dotX} cy={dotY} r={8} fill={accentColor} stroke="white" strokeWidth={2} className="cursor-grab" />
        {/* Center readout */}
        <text x={center} y={center - 4} textAnchor="middle" className="fill-slate-800 text-2xl font-bold" style={{ fontSize: 28 }}>
          {clamped}°
        </text>
        <text x={center} y={center + 16} textAnchor="middle" className="fill-slate-400" style={{ fontSize: 10 }}>
          grados
        </text>
      </svg>
      <div className="flex items-center gap-2">
        <input
          type="number"
          min={0}
          max={360}
          value={clamped}
          onChange={(e) => onChange(Math.max(0, Math.min(360, Number(e.target.value) || 0)))}
          className="w-20 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-700 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
        />
        <span className="text-xs text-slate-400">°</span>
      </div>
    </div>
  );
}

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number): string {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`;
}
