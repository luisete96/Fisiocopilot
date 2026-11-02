import type {
  Equipment, BodyRegionInfo,
  OrthopedicTest, RedFlag, YellowFlag,
  SessionEntry,
} from './types';

export const EQUIPMENT: Equipment[] = [
  { key: 'ecografo', label: 'Ecógrafo musculoesquelético', icon: 'waves' },
  { key: 'camilla', label: 'Camilla', icon: 'bed' },
  { key: 'dinamometro', label: 'Dinamómetro', icon: 'gauge' },
  { key: 'invasivas', label: 'Técnicas invasivas (EPI / EPTE / NMP)', icon: 'syringe' },
  { key: 'gimnasio', label: 'Gimnasio / Pesas / Poleas', icon: 'dumbbell' },
  { key: 'radiofrecuencia', label: 'Radiofrecuencia / Diatermia / Tecarterapia', icon: 'radio' },
  { key: 'superinductive', label: 'Sistema Superinductivo (SIS)', icon: 'waves' },
  { key: 'shockwaves_radial', label: 'Ondas de Choque Radiales (RSWT)', icon: 'zap' },
  { key: 'shockwaves_focal', label: 'Ondas de Choque Focales (FSWT)', icon: 'zap' },
];

export const BODY_REGIONS: BodyRegionInfo[] = [
  { key: 'cervical', label: 'Cervical' },
  { key: 'hombro', label: 'Hombro' },
  { key: 'codo', label: 'Codo' },
  { key: 'muneca', label: 'Muñeca / Mano' },
  { key: 'dorsal', label: 'Dorsal' },
  { key: 'lumbar', label: 'Lumbar' },
  { key: 'pelvis', label: 'Pelvis / Cadera' },
  { key: 'muslo', label: 'Muslo' },
  { key: 'rodilla', label: 'Rodilla' },
  { key: 'tobillo', label: 'Tobillo' },
  { key: 'pie', label: 'Pie' },
];

export const DYNAMIC_QUESTIONS: Record<string, string[]> = {
  default: [
    '¿Dónde te duele exactamente? Señala con un dedo la zona más dolorida.',
    '¿El dolor se irradia hacia alguna otra zona del cuerpo?',
    '¿Qué movimiento o gesto te reproduce el dolor con más facilidad?',
  ],
  cervical: [
    '¿El dolor se irradia hacia el brazo o los dedos de la mano?',
    '¿Tienes hormigueos o adormecimientos en el brazo?',
    '¿Girar la cabeza hacia el lado afecto reproduce el dolor?',
  ],
  hombro: [
    '¿El dolor aparece al elevar el brazo por encima de la cabeza?',
    '¿Tienes dolor nocturno al dormir sobre ese hombro?',
    '¿Tienes dificultad para reachar objetos detrás de la espalda?',
  ],
  lumbar: [
    '¿El dolor se irradia hacia la pierna o el pie?',
    '¿Tienes hormigueos o adormecimientos en la pierna?',
    '¿El dolor empeora al flexionar el tronco o al estar sentado mucho tiempo?',
  ],
  rodilla: [
    '¿El dolor aparece al subir o bajar escaleras?',
    '¿Sientes chasquidos, blocajes o sensación de fallo de la rodilla?',
    '¿Tienes hinchazón o derrame articular en la rodilla?',
  ],
};

export const INITIAL_RED_FLAGS: RedFlag[] = [
  {
    id: 'rf-1',
    label: 'Pérdida de peso inexplicada',
    detail: 'Sospecha de patología sistémica o neoplásica ante pérdida de peso significativa sin causa aparente.',
    discardLabel: 'Descartar — sin pérdida de peso',
    status: 'pending',
  },
  {
    id: 'rf-2',
    label: 'Dolor nocturno no mecánico',
    detail: 'Dolor que no mejora con el reposo ni cambia con la postura. Sugerente de patología inflamatoria o tumoral.',
    discardLabel: 'Descartar — dolor mecánico / postural',
    status: 'pending',
  },
  {
    id: 'rf-3',
    label: 'Déficit neurológico progresivo',
    detail: 'Pérdida de fuerza, sensibilidad o control esfinteriano progresivo. Sugerente de compresión neural grave.',
    discardLabel: 'Descartar — sin déficit neurológico',
    status: 'pending',
  },
  {
    id: 'rf-4',
    label: 'Trauma reciente significativo',
    detail: 'Caída, accidente o golpe de alta energía. Riesgo de fractura o lesión ligamentaria grave.',
    discardLabel: 'Descartar — sin trauma significativo',
    status: 'pending',
  },
];

export const YELLOW_FLAGS: YellowFlag[] = [
  { id: 'yf-1', label: 'Miedo al movimiento / catastrofización', checked: false },
  { id: 'yf-2', label: 'Expectativas negativas sobre la recuperación', checked: false },
  { id: 'yf-3', label: 'Baja autoeficacia en la gestión del dolor', checked: false },
  { id: 'yf-4', label: 'Problemas laborales, familiares o emocionales asociados', checked: false },
  { id: 'yf-5', label: 'Evitación del ejercicio por miedo al daño', checked: false },
  { id: 'yf-6', label: 'Historia de dolor crónico o multiple regiones', checked: false },
];

export const INITIAL_TESTS: OrthopedicTest[] = [
  {
    id: 'test-1',
    name: 'Test de_arc_doloroso (Painful Arc)',
    region: 'hombro',
    description: 'Evalúa la presencia de un pinzamiento subacromial durante la elevación del brazo.',
    position: 'Paciente de pie, brazo a lo largo del cuerpo.',
    maneuver: 'Elevación activa del brazo en el plano de la escápula (abducción) desde 0° hasta 180°.',
    positiveCriteria: 'Dolor entre 60° y 120° de abducción que desaparece al continuar la elevación.',
    sensitivity: '53%',
    specificity: '76%',
    result: null,
  },
  {
    id: 'test-2',
    name: 'Hawkins-Kennedy Test',
    region: 'hombro',
    description: 'Test de impingement subacromial por compresión del manguito rotador.',
    position: 'Paciente sentado o de pie. Fisio junto al lado afecto.',
    maneuver: 'Flexión del hombro a 90° y flexión de codo a 90°. El fisio rota internamente el hombro pasivamente.',
    positiveCriteria: 'Dolor en la cara anterior del hombro durante la rotación interna.',
    sensitivity: '79%',
    specificity: '59%',
    result: null,
  },
  {
    id: 'test-3',
    name: 'Test de Neer',
    region: 'hombro',
    description: 'Test de impingement subacromial por compresión del supraespinoso.',
    position: 'Paciente sentado. Fisio detrás del paciente.',
    maneuver: 'Estabilización de la escápula con una mano. Flexión pasiva completa del brazo en el plano de la escápula con pronación del antebrazo.',
    positiveCriteria: 'Dolor en la cara antero-lateral del hombro durante la flexión.',
    sensitivity: '79%',
    specificity: '53%',
    result: null,
  },
];

export const SONO_CHECKLIST: { id: string; label: string; checked: boolean }[] = [
  { id: 'sono-1', label: 'Tendón del supraespinoso: grosor, ecoestructura, calcificaciones', checked: false },
  { id: 'sono-2', label: 'Bursa subacromial-subdeltoidea: engrosamiento o líquido', checked: false },
  { id: 'sono-3', label: 'Tendón del infraespinoso / redondo menor', checked: false },
  { id: 'sono-4', label: 'Tendón de la porción larga del bíceps (vaina y luxación)', checked: false },
  { id: 'sono-5', label: 'Manguito rotador: integrity de las fibras y gap', checked: false },
  { id: 'sono-6', label: 'Articulación acromioclavicular: signos de artrosis / edema', checked: false },
  { id: 'sono-7', label: 'Dynamic impingement test ecoguiado', checked: false },
  { id: 'sono-8', label: 'Músculo serrato anterior / subescapular', checked: false },
];

export const INITIAL_SESSIONS: SessionEntry[] = [];
