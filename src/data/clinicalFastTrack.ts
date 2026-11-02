export interface FastTrackQuestion {
  id: string;
  text: string;
  subZones?: string[];
}

export interface FastTrackTest {
  id: string;
  name: string;
  description: string;
  patientPosition: string;
  maneuver: string;
  positivityCriteria: string;
  sensitivity: string;
  specificity: string;
  subZones?: string[];
}

export interface FastTrackRegion {
  id: string;
  name: string;
  keywords: string[];
  subZones: string[];
  questions: FastTrackQuestion[];
  tests: FastTrackTest[];
}

type FastTrackTestSource = Omit<FastTrackTest, 'patientPosition' | 'maneuver' | 'positivityCriteria'>;
type FastTrackRegionSource = Omit<FastTrackRegion, 'tests'> & { tests: FastTrackTestSource[] };

const FAST_TRACK_TEST_DETAILS: Record<string, Pick<FastTrackTest, 'description' | 'patientPosition' | 'maneuver' | 'positivityCriteria' | 'sensitivity' | 'specificity'> & { name?: string }> = {
  cerv_t1: {
    description: 'Valora el compromiso radicular cervical mediante el estrechamiento mecánico del foramen intervertebral.',
    patientPosition: 'Paciente en sedestación erguida; fisioterapeuta de pie detrás del paciente.',
    maneuver: 'Se guía la cabeza hacia extensión e inclinación lateral hacia el lado afecto y se aplica una compresión axial suave sobre el cráneo.',
    positivityCriteria: 'Reproducción o irradiación del dolor radicular o parestesias hacia el miembro superior homolateral.',
    sensitivity: '58%', specificity: '93%',
  },
  cerv_t2: {
    description: 'Evalúa el alivio sintomático radicular al descomprimir el foramen intervertebral y las carillas articulares.',
    patientPosition: 'Paciente en decúbito supino relajado; fisioterapeuta en el cabecero de la camilla.',
    maneuver: 'El examinador sujeta bajo el occipucio y el mentón (o mastoides) y realiza una tracción axial lenta y mantenida en dirección craneal (aprox. 10-14 kg).',
    positivityCriteria: 'Disminución significativa o desaparición del dolor cervical o braquial durante la tracción.',
    sensitivity: '44%', specificity: '97%',
  },
  cerv_t3: {
    description: 'Valora la disfunción articular y restricción de movilidad del segmento C1-C2, principal origen biomecánico de cefaleas cervicogénicas.',
    patientPosition: 'Paciente en decúbito supino con el cuello completamente relajado; fisioterapeuta en el cabecero.',
    maneuver: 'El examinador flexiona pasivamente la columna cervical al rango final para bloquear C3-C7 y luego rota suavemente la cabeza hacia la izquierda y hacia la derecha.',
    positivityCriteria: 'Restricción de la rotación pasiva superior a 10° respecto al lado contralateral (o menor a 32° absolutos) o reproducción de la cefalea.',
    sensitivity: '91%', specificity: '90%',
  },
  cerv_t4: {
    description: 'Evalúa la mecanosensibilidad del plexo braquial y tronco nervioso mediano.',
    patientPosition: 'Paciente en decúbito supino sin almohada, cerca del borde lateral de la camilla.',
    maneuver: 'Secuencia progresiva: depresión escapular, abducción de hombro a 110°, rotación externa, supinación del antebrazo, extensión de muñeca y dedos, y extensión lenta del codo.',
    positivityCriteria: 'Reproducción de los síntomas neuropáticos familiares del paciente que se modifican con la diferenciación estructural (inclinación cervical) o asimetría >10° de codo.',
    sensitivity: '97%', specificity: '22%',
  },
  dors_t1: {
    description: 'Valora la movilidad segmentaria dorsal y la provocación mecánica de dolor facetario o costovertebral.',
    patientPosition: 'Paciente en sedestación con pies apoyados y brazos cruzados abrazando los hombros.',
    maneuver: 'Se solicita rotación activa máxima hacia ambos lados y el fisioterapeuta aplica una sobrepresión suave al final del rango.',
    positivityCriteria: 'Reproducción del dolor dorsal/interescapular familiar o asimetría marcada del rango rotacional.',
    sensitivity: '75%', specificity: '81%',
  },
  dors_t2: {
    description: 'Identifica hipomovilidad o reactividad nociceptiva en uniones cigapofisarias dorsales y articulaciones costotransversas.',
    patientPosition: 'Paciente en decúbito prono con los brazos a lo largo del cuerpo; fisioterapeuta lateral a la camilla.',
    maneuver: 'Presión posteroanterior gradual con el pisiforme sobre las apófisis espinosas, transversas y ángulos costales.',
    positivityCriteria: 'Reproducción exacta del dolor local o referido del paciente frente a los niveles adyacentes.',
    sensitivity: '82%', specificity: '79%',
  },
  dors_t3: {
    description: 'Evalúa la integridad costal, articulaciones condrocostales y disfunciones mecánicas de la parrilla costal.',
    patientPosition: 'Paciente en decúbito supino o sedestación; fisioterapeuta frente o lateral al paciente.',
    maneuver: 'Se aplica una compresión suave bimanual en sentido anteroposterior (esternón-columna) y luego laterolateral sobre las costillas.',
    positivityCriteria: 'Aparición de dolor agudo o punzante localizado en el arco costal o unión condroesternal.',
    sensitivity: '68%', specificity: '88%',
  },
  dors_t4: {
    description: 'Valora la mecanosensibilidad del neuroeje torácico y raíces dorsales/intercostales.',
    patientPosition: 'Paciente sentado al borde de la camilla con manos detrás de la espalda.',
    maneuver: 'Se solicita flexión dorsal y lumbar máxima ("dejarse caer"), flexión cervical y extensión de rodilla, valorando cambios al liberar la flexión cervical.',
    positivityCriteria: 'Reproducción del dolor interescapular o dorsal que disminuye al extender el cuello.',
    sensitivity: '80%', specificity: '78%',
  },
  lumb_t1: {
    description: 'Evalúa la mecanosensibilidad radicular lumbosacra (L4-S1) y el compromiso del nervio ciático.',
    patientPosition: 'Paciente en decúbito supino completamente relajado.',
    maneuver: 'El fisioterapeuta eleva pasivamente el miembro inferior con la rodilla en extensión completa hasta la aparición de síntomas, añadiendo dorsiflexión de tobillo (Bragard) para confirmar.',
    positivityCriteria: 'Reproducción del dolor radicular irradiado por debajo de la rodilla entre los 30° y 70° de flexión de cadera.',
    sensitivity: '91%', specificity: '26%',
  },
  lumb_t2: {
    description: 'Pone en tensión máxima el tejido neural neuromeníngeo desde el segmento cervical hasta el ciático.',
    patientPosition: 'Paciente en sedestación al borde de la camilla con muslos apoyados y manos entrelazadas detrás de la espalda.',
    maneuver: 'Flexión toracolumbar, seguida de flexión cervical máxima, extensión activa/pasiva de rodilla y dorsiflexión de tobillo; luego se pide extensión cervical para diferenciación estructural.',
    positivityCriteria: 'Reproducción del dolor lumbar/ciático familiar que se alivia o modifica al extender el cuello.',
    sensitivity: '84%', specificity: '83%',
  },
  lumb_t3: {
    description: 'Somete a máxima carga compresiva las carillas articulares facetarias y estrecha el foramen homolateral.',
    patientPosition: 'Paciente en bipedestación o sedestación; fisioterapeuta detrás sujetando los hombros y pelvis.',
    maneuver: 'Se guía al paciente a una extensión lumbar combinada con inclinación lateral y rotación hacia el lado doloroso aplicando ligera compresión caudal.',
    positivityCriteria: 'Reproducción del dolor lumbar paravertebral local (origen facetario) o irradiado (compromiso foraminal).',
    sensitivity: '70%', specificity: '45%',
  },
  lumb_t4: {
    description: 'Identifica inestabilidad lumbar clínica y déficit de control motor estabilizador segmentario.',
    patientPosition: 'Paciente en decúbito prono con el tronco sobre la camilla y los pies apoyados en el suelo.',
    maneuver: 'Paso 1: Presión posteroanterior (PA) sobre las espinosas lumbares buscando el segmento doloroso. Paso 2: El paciente eleva ambos pies del suelo (contracción extensora) y se repite la misma presión PA.',
    positivityCriteria: 'El dolor provocado por la presión PA en el Paso 1 desaparece o disminuye drásticamente al activar la musculatura en el Paso 2.',
    sensitivity: '61%', specificity: '57%',
  },
  cad_t1: {
    description: 'Cribado principal de patología intraarticular de cadera, choque femoroacetabular (CFA) y lesión del labrum anterior.',
    patientPosition: 'Paciente en decúbito supino; fisioterapeuta en el lado a evaluar.',
    maneuver: 'Se lleva pasivamente la cadera a 90° de flexión, seguida de aducción combinada con rotación interna máxima.',
    positivityCriteria: 'Reproducción del dolor profundo en la ingle (signo de la "C") o chasquido doloroso intraarticular.',
    sensitivity: '99%', specificity: '25%',
  },
  cad_t2: {
    description: 'Valora de forma combinada la articulación coxofemoral, el complejo iliopsoas y la articulación sacroilíaca.',
    patientPosition: 'Paciente en decúbito supino; el fisioterapeuta coloca el maléolo lateral del lado afecto justo por encima de la rodilla contralateral (posición en "4").',
    maneuver: 'Estabilizando la espina ilíaca anterosuperior (EIAS) contraria, se aplica un descenso suave y progresivo sobre la rodilla flexionada hacia la camilla.',
    positivityCriteria: 'Dolor inguinal (patología intraarticular/psoas) o dolor posterior en la interlínea sacroilíaca.',
    sensitivity: '82%', specificity: '71%',
  },
  cad_t3: {
    description: 'Alta especificidad para confirmar tendinopatía glútea (glúteo medio/menor) y síndrome doloroso del trocánter mayor (GTPS).',
    patientPosition: 'Paciente en bipedestación junto a la camilla; el fisioterapeuta da soporte suave en las manos para el equilibrio.',
    maneuver: 'El paciente se mantiene en apoyo monopodal sobre la pierna afecta durante 30 segundos manteniendo la pelvis nivelada sin compensar con el tronco.',
    positivityCriteria: 'Reproducción del dolor lateral espontáneo sobre el trocánter mayor entre los 0 y 30 segundos o caída pélvica (Trendelenburg).',
    sensitivity: '38%', specificity: '100%',
  },
  cad_t4: {
    description: 'Somete a tensión el músculo piramidal/pelvitrocantéreos evaluando el atrapamiento dinámico del nervio ciático.',
    patientPosition: 'Paciente en decúbito lateral sobre el lado sano, con la cadera superior flexionada a 60° y rodilla a 90°.',
    maneuver: 'El fisioterapeuta estabiliza la pelvis y aplica máxima aducción (bajando la rodilla hacia la camilla) combinada con rotación interna pasiva de cadera.',
    positivityCriteria: 'Reproducción del dolor glúteo profundo o irradiación ciática por compresión en la escotadura ciática.',
    sensitivity: '88%', specificity: '83%',
  },
  cad_t5: {
    description: 'Valora la tendinopatía isquiosural proximal (inserción en tuberosidad isquiática) mediante compresión y estiramiento activo.',
    patientPosition: 'Paciente en bipedestación apoyando el talón de la pierna afecta sobre un taburete o camilla con la cadera a unos 90° de flexión.',
    maneuver: 'Con la rodilla totalmente extendida, el paciente inclina activamente el tronco hacia delante buscando tocar el pie.',
    positivityCriteria: 'Aparición de dolor localizado justo en la tuberosidad isquiática (inserción proximal isquiosural).',
    sensitivity: '76%', specificity: '82%',
  },
  hom_t1: {
    description: 'Comprime el tendón del supraespinoso y la bursa subacromial contra el ligamento coracoacromial.',
    patientPosition: 'Paciente en sedestación o bipedestación con el brazo relajado.',
    maneuver: 'El fisioterapeuta eleva el hombro a 90° de flexión anterior con el codo a 90° y realiza una rotación interna pasiva forzada del húmero.',
    positivityCriteria: 'Reproducción del dolor subacromial anterolateral familiar del paciente.',
    sensitivity: '80%', specificity: '56%',
  },
  hom_t2: {
    description: 'Evalúa la capacidad contráctil y reactividad dolorosa del tendón del supraespinoso.',
    patientPosition: 'Paciente en bipedestación o sedestación con ambos brazos elevados a 90° en el plano de la escápula (30° de aducción horizontal).',
    maneuver: 'Se solicita rotación interna completa (pulgares apuntando al suelo) y el fisioterapeuta aplica resistencia hacia abajo en el tercio distal del antebrazo.',
    positivityCriteria: 'Dolor localizado en la región subacromial/deltoidea o claudicación por pérdida de fuerza.',
    sensitivity: '86%', specificity: '74%',
  },
  hom_t3: {
    description: 'Determina la presencia de compromiso mecánico subacromial dinámico durante la elevación activa.',
    patientPosition: 'Paciente en bipedestación.',
    maneuver: 'Se pide al paciente que eleve activamente el brazo en el plano coronal/escapular desde 0° hasta 180° y descienda lentamente.',
    positivityCriteria: 'Aparición de dolor entre los 60° y 120° de abducción que se alivia por debajo de 60° o al superar los 120°.',
    sensitivity: '53%', specificity: '76%',
  },
  hom_t4: {
    description: 'Comprime selectivamente la articulación acromioclavicular para detectar artropatía o esguince A-C.',
    patientPosition: 'Paciente en sedestación o bipedestación.',
    maneuver: 'Se lleva el hombro a 90° de flexión y se empuja pasivamente el codo en aducción horizontal máxima cruzándolo hacia el hombro contralateral.',
    positivityCriteria: 'Dolor agudo y bien localizado exactamente en la parte superior sobre la articulación acromioclavicular.',
    sensitivity: '77%', specificity: '79%',
  },
  hom_t5: {
    description: 'Valora la porción larga del bíceps braquial en la corredera (Speed) y el tendón del infraespinoso (RE resistida).',
    patientPosition: 'Paciente en bipedestación o sedestación.',
    maneuver: '1) Speed: hombro a 60-90° de flexión, codo extendido y supinación resistiendo presión hacia abajo. 2) RE: codo pegado al costado a 90° resistiendo rotación externa isométrica.',
    positivityCriteria: 'Dolor en corredera bicipital anterior (Speed) o dolor/debilidad posterolateral (Infraespinoso).',
    sensitivity: '84%', specificity: '78%',
  },
  cod_t1: {
    description: 'Provoca estrés tensil contráctil sobre el origen extensor común (especialmente extensor radial corto del carpo) en el epicóndilo lateral.',
    patientPosition: 'Paciente en sedestación con el antebrazo pronado y apoyado; el fisioterapeuta palpa el epicóndilo lateral con el pulgar.',
    maneuver: 'Se pide al paciente que cierre el puño y realice extensión dorsal y desviación radial de la muñeca mientras el fisioterapeuta aplica resistencia.',
    positivityCriteria: 'Reproducción súbita del dolor punzante sobre el epicóndilo lateral del húmero.',
    sensitivity: '91%', specificity: '50%',
  },
  cod_t2: {
    description: 'Evalúa la mecanosensibilidad pasiva por estiramiento de la musculatura epicondílea lateral.',
    patientPosition: 'Paciente en bipedestación o sedestación; el fisioterapeuta sujeta el codo palpando el epicóndilo lateral.',
    maneuver: 'El examinador prona completamente el antebrazo del paciente, flexiona pasivamente la muñeca y los dedos al máximo, y extiende progresivamente el codo.',
    positivityCriteria: 'Aparición de dolor agudo localizado en la inserción epicondílea lateral al acercarse a la extensión completa del codo.',
    sensitivity: '53%', specificity: '100%',
  },
  cod_t3: {
    description: 'Valora la tendinopatía de la masa flexora-pronadora común en el epicóndilo medial (epitróclea).',
    patientPosition: 'Paciente en sedestación; fisioterapeuta palpando la epitróclea medial.',
    maneuver: 'Se realiza supinación del antebrazo combinada con extensión pasiva de muñeca y codo (estiramiento), seguida de flexión palmar y pronación contra resistencia.',
    positivityCriteria: 'Reproducción del dolor localizado sobre la epitróclea humeral.',
    sensitivity: '88%', specificity: '65%',
  },
  cod_t4: {
    description: 'Comprueba la integridad anatómica y reactividad del tendón distal del bíceps braquial en la fosa cubital.',
    patientPosition: 'Paciente en sedestación con el hombro abducido, codo flexionado activamente a 90° y antebrazo en supinación máxima.',
    maneuver: 'El fisioterapeuta introduce su dedo índice desde la cara lateral de la fosa antecubital intentando "enganchar" el cordón del tendón del bíceps y traccionar suavemente.',
    positivityCriteria: 'Ausencia de cuerda tendinosa palpable (rotura distal) o reproducción de dolor intenso en el tendón (tendinopatía/rotura parcial).',
    sensitivity: '100%', specificity: '100%',
  },
  mun_t1: {
    description: 'Valora la tenosinovitis estenosante de la primera corredera dorsal (abductor largo y extensor corto del pulgar - De Quervain).',
    patientPosition: 'Paciente en sedestación con el antebrazo en posición neutra apoyado sobre el borde cubital.',
    maneuver: 'El fisioterapeuta estabiliza el antebrazo, toma el pulgar del paciente y aplica una desviación cubital pasiva de la muñeca (o con el pulgar dentro del puño en Eichhoff).',
    positivityCriteria: 'Dolor intenso y selectivo sobre la estiloides radial y trayecto del primer compartimento dorsal.',
    sensitivity: '89%', specificity: '86%',
  },
  mun_t2: {
    description: 'Aumenta la presión hidrostática dentro del túnel carpiano para evaluar la compresión del nervio mediano.',
    patientPosition: 'Paciente en sedestación o bipedestación con los codos elevados.',
    maneuver: 'Se pide al paciente que enfrente el dorso de ambas manos manteniendo una flexión palmar máxima de muñecas a 90° de forma ininterrumpida durante 60 segundos.',
    positivityCriteria: 'Aparición o exacerbación de parestesias, hormigueo o adormecimiento en el territorio del nervio mediano (1º, 2º, 3º dedo y mitad radial del 4º).',
    sensitivity: '68%', specificity: '73%',
  },
  mun_t3: {
    description: 'Identifica lesiones del complejo del fibrocartílago triangular (FCT) o alteraciones de los ligamentos ulnocarpianos.',
    patientPosition: 'Paciente en sedestación con el codo flexionado a 90° apoyado en la mesa y antebrazo en rotación neutra.',
    maneuver: 'El examinador presiona con la yema de su pulgar profundamente en la "fóvea" blanda situada entre la apófisis estiloides cubital, el tendón cubital anterior (FCU) y el pisiforme.',
    positivityCriteria: 'Reproducción exquisita del dolor cubital que el paciente reconoce como su molestia habitual al apoyar o girar la muñeca.',
    sensitivity: '95%', specificity: '87%',
  },
  mun_t4: {
    description: 'Evalúa la degeneración condral e inestabilidad de la articulación trapeciometacarpiana de la base del pulgar.',
    patientPosition: 'Paciente en sedestación con la mano relajada; el fisioterapeuta estabiliza el carpo y el trapecio con una mano.',
    maneuver: 'Con la otra mano se sujeta la diáfisis del primer metacarpiano aplicando compresión axial hacia el trapecio combinada con movimientos de circunducción/rotación.',
    positivityCriteria: 'Dolor agudo en la base del pulgar acompañado frecuentemente de crepitación articular palpable.',
    sensitivity: '64%', specificity: '96%',
  },
  mus_t1: {
    description: 'Posición de máxima activación electromiográfica del aductor largo para detectar dolor inguinal relacionado con aductores y pubalgia.',
    patientPosition: 'Paciente en decúbito supino con las caderas flexionadas a 45°, rodillas a 90° y pies apoyados en la camilla.',
    maneuver: 'El fisioterapeuta coloca sus dos puños (o un esfigmomanómetro inflado a 40 mmHg) entre los cóndilos femorales y solicita una contracción isométrica máxima de aducción durante 5 segundos.',
    positivityCriteria: 'Reproducción del dolor en la región medial del muslo o inserción púbica y/o déficit de fuerza respecto a valores normativos.',
    sensitivity: '85%', specificity: '81%',
  },
  mus_t2: {
    description: 'Maniobra funcional de altísima sensibilidad y especificidad para lesión muscular aguda o subaguda de los isquiosurales.',
    patientPosition: 'Paciente en bipedestación apoyado ligeramente en la camilla o pared para no perder el equilibrio.',
    maneuver: 'Se pide al paciente que se descalce el zapato del miembro afecto presionando el talón contra el suelo del pie sano mientras realiza una flexión activa de rodilla y rotación externa de cadera.',
    positivityCriteria: 'Aparición inmediata de dolor agudo o pinchazo en el vientre muscular posterior del muslo.',
    sensitivity: '100%', specificity: '100%',
  },
  mus_t3: {
    description: 'Evalúa la extensibilidad y la provocación de dolor por estiramiento pasivo del recto femoral del cuádriceps.',
    patientPosition: 'Paciente en decúbito prono completamente relajado; el fisioterapeuta estabiliza la pelvis sobre el sacro.',
    maneuver: 'Se realiza una flexión pasiva progresiva de la rodilla llevando el talón hacia el glúteo homolateral.',
    positivityCriteria: 'Elevación prematura de la hemipelvis/cadera de la camilla o reproducción del dolor en la cara anterior del muslo.',
    sensitivity: '63%', specificity: '85%',
  },
  mus_t4: {
    description: 'Valora el grado de tensión y reactividad del tensor de la fascia lata (TFL) y la cintilla iliotibial.',
    patientPosition: 'Paciente en decúbito lateral sobre el lado sano con cadera y rodilla inferiores flexionadas para aplanar la columna lumbar.',
    maneuver: 'El fisioterapeuta estabiliza la cresta ilíaca, lleva la cadera superior a extensión neutra con ligera abducción, y deja descender pasivamente el muslo en aducción hacia la camilla.',
    positivityCriteria: 'Incapacidad del muslo para descender más allá de la horizontal o reproducción de tirantez/dolor en la banda iliotibial.',
    sensitivity: '41%', specificity: '95%',
  },
  rod_t1: {
    description: 'Reproduce la carga axial dinámica y cizallamiento rotacional sobre los meniscos medial y lateral en bipedestación.',
    patientPosition: 'Paciente en apoyo monopodal sobre la pierna afecta; el fisioterapeuta sujeta sus manos para darle estabilidad.',
    maneuver: 'El paciente flexiona la rodilla a 20° y realiza 3 giros completos de rotación interna y externa del tronco y fémur sobre la tibia fija.',
    positivityCriteria: 'Dolor en la interlínea articular medial o lateral, acompañado o no de sensación de chasquido o bloqueo mecánico.',
    sensitivity: '89%', specificity: '97%',
  },
  rod_t2: {
    description: 'Prueba clínica de referencia (Gold Standard) para evaluar la integridad mecánica del ligamento cruzado anterior (LCA).',
    patientPosition: 'Paciente en decúbito supino con el muslo completamente relajado.',
    maneuver: 'El fisioterapeuta coloca la rodilla en 20-30° de flexión, fija el fémur distal con su mano craneal y aplica una traslación tibial anterior firme con su mano caudal desde la cara posterior de la tibia proximal.',
    positivityCriteria: 'Traslación tibial anterior excesiva comparada con el lado sano y ausencia de un tope final firme ("end-feel" blando).',
    sensitivity: '87%', specificity: '94%',
  },
  rod_t3: {
    description: 'Evalúa los cuernos posteriores y cuerpo de ambos meniscos mediante flexo-extensión combinada con rotación tibial.',
    patientPosition: 'Paciente en decúbito supino; el fisioterapeuta sujeta el talón con una mano y palpa la interlínea articular con la otra.',
    maneuver: 'Partiendo de flexión máxima de rodilla: 1) Rotación externa tibial + estrés valgo llevando a extensión (menisco interno). 2) Rotación interna tibial + estrés varo llevando a extensión (menisco externo).',
    positivityCriteria: 'Chasquido o resalte palpable/audible acompañado de reproducción del dolor en la interlínea correspondiente.',
    sensitivity: '70%', specificity: '84%',
  },
  rod_t4: {
    description: 'Carga selectiva el tendón rotuliano y articulación femoropatelar (Decline Squat) o el roce de la cintilla iliotibial en el cóndilo lateral (Noble).',
    patientPosition: 'Bipedestación monopodal sobre cuña de 25° (Decline Squat) o decúbito supino con rodilla a 90° (Noble).',
    maneuver: '1) Sentadilla monopodal lenta hasta 60° de flexión. 2) En Noble: presión con el pulgar sobre el epicóndilo femoral lateral mientras se extiende la rodilla pasando por los 30°.',
    positivityCriteria: 'Dolor localizado en el polo inferior rotuliano (tendinopatía) o dolor punzante lateral a los 30° de flexión (síndrome de la cintilla).',
    sensitivity: '82%', specificity: '80%',
  },
  tob_t1: {
    description: 'Evalúa la laxitud e integridad del ligamento peroneoastragalino anterior (LPAA) tras esguinces laterales.',
    patientPosition: 'Paciente en decúbito supino o sedestación con la rodilla flexionada a 90° para relajar el tríceps sural.',
    maneuver: 'El fisioterapeuta estabiliza la tibia y peroné distales con una mano y, manteniendo el tobillo en 10-20° de flexión plantar, envuelve el calcáneo traccionando hacia anterior e internamente.',
    positivityCriteria: 'Desplazamiento anterior excesivo del astrágalo respecto a la mortaja tibioperonea (signo de succión anterolateral) o dolor selectivo en el LPAA.',
    sensitivity: '86%', specificity: '89%',
  },
  tob_t2: {
    description: 'Diferencia y confirma la tendinopatía del cuerpo del Aquiles (Royal London) y descarta rotura completa (Thompson).',
    patientPosition: 'Paciente en decúbito prono con ambos pies colgando fuera del borde de la camilla.',
    maneuver: '1) Royal London: se pellizca el punto más doloroso del tendón en reposo y se vuelve a presionar manteniendo el tobillo en dorsiflexión máxima. 2) Thompson: compresión manual del vientre gemelar.',
    positivityCriteria: 'En Royal London: el dolor a la palpación disminuye notablemente al poner el tobillo en dorsiflexión. En Thompson: ausencia de flexión plantar (rotura).',
    sensitivity: '96%', specificity: '93%',
  },
  tob_t3: {
    name: 'Test de Rotación Externa (Kleiger) / Squeeze Test',
    description: 'Detecta lesiones de la sindesmosis tibioperonea distal ("esguince alto de tobillo").',
    patientPosition: 'Paciente en sedestación al borde de la camilla con rodilla a 90°.',
    maneuver: '1) Rotación Externa: fijando la pierna, se lleva el pie a dorsiflexión y rotación externa pasiva. 2) Squeeze: compresión manual de tibia y peroné entre sí en el tercio medio de la pantorrilla.',
    positivityCriteria: 'Reproducción de dolor agudo en la región anterolateral alta del tobillo (ligamento tibioperoneo anteroinferior).',
    sensitivity: '68%', specificity: '93%',
  },
  tob_t4: {
    description: 'Evalúa la suficiencia funcional y dolor del tendón del tibial posterior como sostén dinámico del arco medial.',
    patientPosition: 'Paciente en bipedestación monopodal frente a la pared (apoyando las yemas de los dedos solo para equilibrio).',
    maneuver: 'Se solicita al paciente que realice elevaciones repetidas de talón (ponerse de puntillas) sobre el pie afecto observando desde atrás el movimiento del retropié.',
    positivityCriteria: 'Incapacidad para elevar el talón, reproducción de dolor retromaleolar medial o ausencia de la inversión fisiológica del calcáneo al subir.',
    sensitivity: '92%', specificity: '88%',
  },
  pie_t1: {
    description: 'Somete a tensión mecánica directa la aponeurosis plantar mediante el mecanismo de cabrestante del primer radio.',
    patientPosition: 'Paciente en bipedestación en carga bipodal (mayor sensibilidad que en descarga).',
    maneuver: 'Manteniendo el talón y la cabeza del primer metatarsiano apoyados en el suelo, el fisioterapeuta realiza una extensión dorsal pasiva máxima de la falange proximal del hallux.',
    positivityCriteria: 'Reproducción exacta del dolor en el tubérculo medial del calcáneo o a lo largo de la banda central de la fascia plantar.',
    sensitivity: '32%', specificity: '100%',
  },
  pie_t2: {
    description: 'Comprime el espacio intermetatarsiano para detectar neuroma interdigital (Morton) o bursitis intermetatarsiana.',
    patientPosition: 'Paciente en decúbito supino o sedestación con el pie relajado en descarga.',
    maneuver: 'El fisioterapeuta abraza el antepié comprimiendo transversalmente las cabezas del 1º al 5º metatarsiano mientras presiona con el pulgar de la otra mano el 2º-3º o 3º-4º espacio intermetatarsiano plantar.',
    positivityCriteria: 'Reproducción del dolor lancinante/eléctrico irradiado a los dedos acompañado frecuentemente de un "clic" palpable (clic de Mulder).',
    sensitivity: '94%', specificity: '88%',
  },
  pie_t3: {
    name: 'Extensión 1ª MTF en Carga (Test de Jacks / Hallux Limitus)',
    description: 'Valora el bloqueo funcional o estructural de la primera articulación metatarsofalángica (Hallux Limitus / Rigidus).',
    patientPosition: 'Paciente en bipedestación con carga simétrica en ambos pies.',
    maneuver: 'El fisioterapeuta intenta elevar pasivamente el primer dedo (dorsiflexión de la 1ª MTF) comparando la resistencia, el ángulo alcanzado y la elevación del arco interno respecto a la prueba en descarga.',
    positivityCriteria: 'Bloqueo rígido que impide superar los 20-30° de extensión en carga o reproducción del dolor articular dorsal/sesamoideo.',
    sensitivity: '88%', specificity: '90%',
  },
  pie_t4: {
    name: 'Test de Estrés de Mediopié (Piano Key / Navicular Drop)',
    description: 'Evalúa la estabilidad tarsometatarsiana (complejo de Lisfranc) y la sobrecarga mecánica de la columna medial.',
    patientPosition: 'Paciente en sedestación (para Piano Key) y luego en bipedestación (para Navicular Drop).',
    maneuver: '1) Se estabiliza el retropié/mediopié y se movilizan las bases del 1º y 2º metatarsiano en sentido dorsal y plantar como teclas de piano. 2) Se mide el descenso del tubérculo navicular entre descarga y apoyo monopodal.',
    positivityCriteria: 'Dolor dorsal/plantar en la interlínea de Lisfranc al cizallamiento o caída navicular >10 mm con reproducción del dolor en el arco.',
    sensitivity: '82%', specificity: '85%',
  },
};

const FAST_TRACK_REGION_DATA: Record<string, FastTrackRegionSource> = {
  cervical: {
    id: 'cervical',
    name: 'Cervical',
    keywords: ['cervical', 'cervicales', 'cuello', 'nuca', 'cervico', 'trapecio', 'torticolis', 'cefalea'],
    subZones: ['Cervical alta (C0-C3)', 'Cervical baja (C4-C7)', 'Paravertebral / Facetario', 'Trapecio superior', 'Irradiación interescapular'],
    questions: [
      { id: 'cerv_q1', text: '¿El dolor se acompaña de dolor de cabeza, mareo o inestabilidad al mover el cuello?', subZones: ['Cervical alta (C0-C3)'] },
      { id: 'cerv_q2', text: '¿Sientes que el dolor baja hacia el brazo o notas hormigueo en los dedos de la mano?', subZones: ['Cervical baja (C4-C7)', 'Irradiación interescapular'] },
      { id: 'cerv_q3', text: '¿Aumenta el dolor al girar la cabeza o al inclinar el cuello hacia atrás?', subZones: ['Paravertebral / Facetario', 'Cervical baja (C4-C7)'] },
      { id: 'cerv_q4', text: '¿Empeora la molestia al mantener posturas fijas frente al ordenador o el móvil?', subZones: ['Trapecio superior', 'Irradiación interescapular'] },
      { id: 'cerv_q5', text: '¿El dolor te despierta por la noche o te impide encontrar postura en la almohada?' },
    ],
    tests: [
      { id: 'cerv_t1', name: 'Test de Spurling', description: 'Extensión e inclinación homolateral cervical con compresión axial suave para reproducir dolor radicular.', sensitivity: '58%', specificity: '93%', subZones: ['Cervical baja (C4-C7)', 'Paravertebral / Facetario'] },
      { id: 'cerv_t2', name: 'Test de Distracción Cervical', description: 'Tracción axial suave hacia craneal en supino; positivo si alivia el dolor irradiado o cervical.', sensitivity: '44%', specificity: '97%', subZones: ['Cervical baja (C4-C7)', 'Irradiación interescapular'] },
      { id: 'cerv_t3', name: 'Test de Flexión-Rotación (C1-C2)', description: 'Flexión cervical máxima en supino aplicando rotación pasiva a ambos lados buscando restricción o cefalea.', sensitivity: '91%', specificity: '90%', subZones: ['Cervical alta (C0-C3)'] },
      { id: 'cerv_t4', name: 'ULTT1 (Neurodinamia Nervio Mediano)', description: 'Depresión escapular, ABD 110°, rotación externa, supinación y extensión progresiva de muñeca y codo.', sensitivity: '97%', specificity: '22%', subZones: ['Cervical baja (C4-C7)', 'Trapecio superior'] },
    ],
  },
  dorsal: {
    id: 'dorsal',
    name: 'Dorsal',
    keywords: ['dorsal', 'dorsales', 'interescapular', 'omoplato', 'escapula', 'costilla', 'costillas', 'costal', 'toracico'],
    subZones: ['Interescapular', 'Dorsal media', 'Charneca dorsolumbar', 'Parrilla costal'],
    questions: [
      { id: 'dors_q1', text: '¿Aumenta el dolor al coger aire profundamente, toser o estornudar?', subZones: ['Parrilla costal', 'Interescapular'] },
      { id: 'dors_q2', text: '¿Se reproduce la molestia al rotar el tronco en la silla o al girar en la cama?', subZones: ['Dorsal media', 'Charneca dorsolumbar'] },
      { id: 'dors_q3', text: '¿Sientes el dolor como una punzada entre las escápulas tras estar sentado mucho tiempo?', subZones: ['Interescapular', 'Dorsal media'] },
      { id: 'dors_q4', text: '¿Notas que la molestia se refleja hacia la zona lumbar alta o el costado?', subZones: ['Charneca dorsolumbar', 'Parrilla costal'] },
    ],
    tests: [
      { id: 'dors_t1', name: 'Rotación Torácica en Sedestación', description: 'Brazos cruzados al pecho en sedestación rotando activamente y aplicando sobrepresión pasiva al final del rango.', sensitivity: '75%', specificity: '81%', subZones: ['Interescapular', 'Dorsal media'] },
      { id: 'dors_t2', name: 'Springing Test (PA Costovertebral)', description: 'Presión posteroanterior sobre apófisis espinosas y ángulos costales con el paciente en decúbito prono.', sensitivity: '82%', specificity: '79%', subZones: ['Dorsal media', 'Charneca dorsolumbar'] },
      { id: 'dors_t3', name: 'Test de Compresión Costal', description: 'Compresión anteroposterior y laterolateral suave de la caja torácica para valorar dolor costal o condral.', sensitivity: '68%', specificity: '88%', subZones: ['Parrilla costal'] },
      { id: 'dors_t4', name: 'Slump Test con Énfasis Dorsal', description: 'Flexión toracolumbar y cervical en sedestación añadiendo extensión de rodilla para valorar mecanosensibilidad neural.', sensitivity: '80%', specificity: '78%', subZones: ['Interescapular', 'Charneca dorsolumbar'] },
    ],
  },
  lumbar: {
    id: 'lumbar',
    name: 'Lumbar',
    keywords: ['lumbar', 'lumbares', 'lumbago', 'ciatica', 'ciatico', 'rinones', 'sacro', 'l5', 's1'],
    subZones: ['Central / Axial', 'Paravertebral / Facetario', 'Charneca lumbosacra (L5-S1)', 'Glúteo / Sacroilíaca', 'Irradiación ciática'],
    questions: [
      { id: 'lumb_q1', text: '¿El dolor baja por la parte posterior o lateral de la pierna pasando de la rodilla?', subZones: ['Irradiación ciática', 'Charneca lumbosacra (L5-S1)'] },
      { id: 'lumb_q2', text: '¿Empeora claramente al agacharte hacia delante o al pasar mucho rato sentado?', subZones: ['Central / Axial', 'Charneca lumbosacra (L5-S1)'] },
      { id: 'lumb_q3', text: '¿Te molesta más al estar de pie quieto o al arquear la espalda hacia atrás?', subZones: ['Paravertebral / Facetario', 'Glúteo / Sacroilíaca'] },
      { id: 'lumb_q4', text: '¿Aumenta el dolor lumbar al toser, estornudar o hacer fuerza abdominal?', subZones: ['Central / Axial', 'Irradiación ciática'] },
      { id: 'lumb_q5', text: '¿Sientes mucha rigidez matutina durante los primeros 30 minutos tras levantarte?' },
    ],
    tests: [
      { id: 'lumb_t1', name: 'Test de Lasègue (SLR)', description: 'Elevación pasiva de la pierna extendida en supino buscando dolor radicular entre los 30° y 70°.', sensitivity: '91%', specificity: '26%', subZones: ['Irradiación ciática', 'Charneca lumbosacra (L5-S1)'] },
      { id: 'lumb_t2', name: 'Slump Test', description: 'Sedestación en flexión raquídea + flexión cervical + extensión de rodilla + dorsiflexión de tobillo.', sensitivity: '84%', specificity: '83%', subZones: ['Irradiación ciática', 'Central / Axial'] },
      { id: 'lumb_t3', name: 'Test de Kemp (Cuadrante Lumbar)', description: 'Extensión combinada con inclinación lateral y rotación homolateral para estresar carillas facetarias.', sensitivity: '70%', specificity: '45%', subZones: ['Paravertebral / Facetario', 'Charneca lumbosacra (L5-S1)'] },
      { id: 'lumb_t4', name: 'Test de Inestabilidad en Prono', description: 'Presión PA lumbar en prono con pies en el suelo frente a la misma presión con piernas elevadas activamente.', sensitivity: '61%', specificity: '57%', subZones: ['Central / Axial', 'Charneca lumbosacra (L5-S1)'] },
    ],
  },
  pelvis_cadera: {
    id: 'pelvis_cadera',
    name: 'Pelvis / Cadera',
    keywords: ['cadera', 'caderas', 'pelvis', 'ingle', 'trocanter', 'gluteo', 'piramidal', 'sacroiliaca', 'isquio'],
    subZones: ['Ingle / Anterior', 'Trocánter / Lateral', 'Glúteo profundo / Piramidal', 'Sacroilíaca', 'Isquiosural proximal'],
    questions: [
      { id: 'cad_q1', text: '¿Sientes un dolor profundo en forma de "C" en la ingle al flexionar la cadera o salir del coche?', subZones: ['Ingle / Anterior'] },
      { id: 'cad_q2', text: '¿Te duele la cara lateral de la cadera al dormir apoyado sobre ese lado o al subir escaleras?', subZones: ['Trocánter / Lateral'] },
      { id: 'cad_q3', text: '¿Aparece dolor justo en el hueso del glúteo al sentarte en superficies duras o al acelerar el paso?', subZones: ['Isquiosural proximal', 'Glúteo profundo / Piramidal'] },
      { id: 'cad_q4', text: '¿Notas molestia al cruzar las piernas, ponerte los calcetines o darte la vuelta en la cama?', subZones: ['Ingle / Anterior', 'Sacroilíaca'] },
    ],
    tests: [
      { id: 'cad_t1', name: 'Test FADIR', description: 'Flexión de cadera a 90°, aducción y rotación interna pasiva en supino (cribado de choque femoroacetabular/labrum).', sensitivity: '99%', specificity: '25%', subZones: ['Ingle / Anterior'] },
      { id: 'cad_t2', name: 'Test FABER (Patrick)', description: 'Flexión, abducción y rotación externa apoyando el maléolo sobre la rodilla opuesta aplicando presión suave.', sensitivity: '82%', specificity: '71%', subZones: ['Ingle / Anterior', 'Sacroilíaca'] },
      { id: 'cad_t3', name: 'Test de Apoyo Monopodal 30s', description: 'Bipedestación sobre la pierna afecta durante 30 segundos; positivo si reproduce dolor trocantéreo lateral.', sensitivity: '38%', specificity: '100%', subZones: ['Trocánter / Lateral'] },
      { id: 'cad_t4', name: 'Test FAIR (Piramidal)', description: 'Decúbito lateral con flexión de 60°, aducción y rotación interna de cadera buscando dolor glúteo profundo o ciático.', sensitivity: '88%', specificity: '83%', subZones: ['Glúteo profundo / Piramidal'] },
      { id: 'cad_t5', name: 'Test de Puranen-Orava', description: 'Estiramiento activo de isquiosurales de pie con el talón apoyado en un escalón a 90° e inclinación anterior de tronco.', sensitivity: '76%', specificity: '82%', subZones: ['Isquiosural proximal'] },
    ],
  },
  hombro: {
    id: 'hombro',
    name: 'Hombro',
    keywords: ['hombro', 'hombros', 'manguito', 'subacromial', 'supraespinoso', 'infraespinoso', 'bicipital', 'acromioclavicular', 'clavicula'],
    subZones: ['Subacromial / Lateral', 'Anterior / Corredera bicipital', 'Superior / Acromioclavicular', 'Posterior / Infraespinoso', 'Escapular'],
    questions: [
      { id: 'hom_q1', text: '¿Te despierta el dolor por la noche cuando te apoyas sobre ese hombro?', subZones: ['Subacromial / Lateral', 'Posterior / Infraespinoso'] },
      { id: 'hom_q2', text: '¿Duele al levantar el brazo lateralmente entre la mitad del recorrido y la altura de la cabeza?', subZones: ['Subacromial / Lateral'] },
      { id: 'hom_q3', text: '¿Te molesta en la parte superior o anterior al cruzar el brazo hacia el hombro contrario?', subZones: ['Superior / Acromioclavicular', 'Anterior / Corredera bicipital'] },
      { id: 'hom_q4', text: '¿Tienes dolor o limitación al llevar la mano detrás de la espalda?', subZones: ['Posterior / Infraespinoso', 'Anterior / Corredera bicipital'] },
      { id: 'hom_q5', text: '¿Notas sensación de chasquido, inestabilidad o pérdida de fuerza al sujetar peso?' },
    ],
    tests: [
      { id: 'hom_t1', name: 'Test de Hawkins-Kennedy', description: 'Flexión de hombro y codo a 90° aplicando rotación interna pasiva para compromiso subacromial.', sensitivity: '80%', specificity: '56%', subZones: ['Subacromial / Lateral'] },
      { id: 'hom_t2', name: 'Test de Jobe (Empty Can)', description: 'Elevación a 90° en plano escapular con rotación interna resistiendo presión hacia abajo (supraespinoso).', sensitivity: '86%', specificity: '74%', subZones: ['Subacromial / Lateral'] },
      { id: 'hom_t3', name: 'Signo del Arco Doloroso', description: 'Abducción activa completa valorando si aparece dolor específico entre los 60° y 120°.', sensitivity: '53%', specificity: '76%', subZones: ['Subacromial / Lateral', 'Escapular'] },
      { id: 'hom_t4', name: 'Cross-Body Adduction Test', description: 'Flexión de hombro a 90° llevando el brazo en aducción horizontal máxima hacia el hombro opuesto (articulación A-C).', sensitivity: '77%', specificity: '79%', subZones: ['Superior / Acromioclavicular'] },
      { id: 'hom_t5', name: 'Test de Speed / Rotación Externa Resistida', description: 'Flexión anterior resistida con codo extendido y supinación + rotación externa resistida a 0°.', sensitivity: '84%', specificity: '78%', subZones: ['Anterior / Corredera bicipital', 'Posterior / Infraespinoso'] },
    ],
  },
  codo: {
    id: 'codo',
    name: 'Codo',
    keywords: ['codo', 'codos', 'epicondilo', 'epicondilitis', 'epitroclea', 'epitrocleitis', 'olecranon'],
    subZones: ['Lateral (Epicóndilo)', 'Medial (Epitróclea)', 'Posterior (Olécranon)', 'Anterior / Fosa cubital'],
    questions: [
      { id: 'cod_q1', text: '¿Duele la cara externa del codo al agarrar peso, usar el ratón o levantar una botella?', subZones: ['Lateral (Epicóndilo)'] },
      { id: 'cod_q2', text: '¿Aparece dolor en la cara interna del codo al cerrar fuerte el puño o flexionar la muñeca?', subZones: ['Medial (Epitróclea)'] },
      { id: 'cod_q3', text: '¿Te duele al estirar el brazo por completo o al apoyar la punta del codo sobre una mesa?', subZones: ['Posterior (Olécranon)'] },
      { id: 'cod_q4', text: '¿Notas dolor en el pliegue anterior del codo al cargar bolsas o girar una llave con fuerza?', subZones: ['Anterior / Fosa cubital'] },
    ],
    tests: [
      { id: 'cod_t1', name: 'Test de Cozen', description: 'Codo en flexión de 90° y pronación, solicitando extensión radial de muñeca contra resistencia.', sensitivity: '91%', specificity: '50%', subZones: ['Lateral (Epicóndilo)'] },
      { id: 'cod_t2', name: 'Test de Mill', description: 'Pronación completa, flexión pasiva de muñeca y extensión progresiva del codo estirando los epicondíleos.', sensitivity: '53%', specificity: '100%', subZones: ['Lateral (Epicóndilo)'] },
      { id: 'cod_t3', name: 'Test de Epitroclealgia (Codo de Golfista)', description: 'Supinación de antebrazo con extensión pasiva de codo y muñeca o flexión palmar resistida.', sensitivity: '88%', specificity: '65%', subZones: ['Medial (Epitróclea)'] },
      { id: 'cod_t4', name: 'Hook Test (Bíceps Distal)', description: 'Flexión activa de codo a 90° en supinación intentando enganchar lateralmente el tendón distal del bíceps.', sensitivity: '100%', specificity: '100%', subZones: ['Anterior / Fosa cubital'] },
    ],
  },
  muneca_mano: {
    id: 'muneca_mano',
    name: 'Muñeca / Mano',
    keywords: ['muneca', 'mano', 'dedo', 'dedos', 'pulgar', 'carpiano', 'quervain', 'escafoides', 'cubital'],
    subZones: ['Radial / De Quervain', 'Cubital / FCT', 'Carpiana / Volar', 'Dorsal', 'Dedos / Pulgar'],
    questions: [
      { id: 'mun_q1', text: '¿Duele la base del pulgar al hacer pinza, abrir un bote o escribir con el móvil?', subZones: ['Radial / De Quervain', 'Dedos / Pulgar'] },
      { id: 'mun_q2', text: '¿Notas hormigueo o adormecimiento en los tres primeros dedos, sobre todo por la noche?', subZones: ['Carpiana / Volar', 'Dedos / Pulgar'] },
      { id: 'mun_q3', text: '¿Sientes dolor en el borde cubital de la muñeca al girar el pomo o apoyarte sobre la mano?', subZones: ['Cubital / FCT', 'Dorsal'] },
      { id: 'mun_q4', text: '¿Se te queda algún dedo enganchado o notas pérdida de fuerza al cerrar la mano?', subZones: ['Dedos / Pulgar', 'Carpiana / Volar'] },
    ],
    tests: [
      { id: 'mun_t1', name: 'Test de Finkelstein / Eichhoff', description: 'Desviación cubital de la muñeca con el pulgar flexionado para valorar la primera corredera extensora.', sensitivity: '89%', specificity: '86%', subZones: ['Radial / De Quervain'] },
      { id: 'mun_t2', name: 'Test de Phalen', description: 'Flexión palmar máxima enfrentando el dorso de ambas manos durante 60 segundos buscando parestesias en territorio mediano.', sensitivity: '68%', specificity: '73%', subZones: ['Carpiana / Volar'] },
      { id: 'mun_t3', name: 'Signo de la Fóvea Cubital (FCT)', description: 'Presión directa en la fóvea entre estiloides cubital y tendón cubital anterior.', sensitivity: '95%', specificity: '87%', subZones: ['Cubital / FCT'] },
      { id: 'mun_t4', name: 'Test de Grind (Rizartrosis)', description: 'Compresión axial y rotación pasiva del primer metacarpiano sobre el trapecio buscando dolor o crepitación.', sensitivity: '64%', specificity: '96%', subZones: ['Dedos / Pulgar', 'Radial / De Quervain'] },
    ],
  },
  muslo: {
    id: 'muslo',
    name: 'Muslo',
    keywords: ['muslo', 'cuadriceps', 'isquios', 'isquiosurales', 'isquiotibiales', 'aductor', 'aductores', 'cintilla', 'recto anterior'],
    subZones: ['Anterior (Cuádriceps)', 'Posterior (Isquiosurales)', 'Medial (Aductores)', 'Lateral (Cintilla iliotibial)'],
    questions: [
      { id: 'mus_q1', text: '¿Sentiste un pinchazo brusco durante un sprint, golpeo o cambio de ritmo?', subZones: ['Anterior (Cuádriceps)', 'Posterior (Isquiosurales)'] },
      { id: 'mus_q2', text: '¿Te duele la cara interna del muslo al juntar las piernas con fuerza o cambiar de dirección?', subZones: ['Medial (Aductores)'] },
      { id: 'mus_q3', text: '¿Aumenta el dolor posterior al inclinar el tronco con la rodilla estirada?', subZones: ['Posterior (Isquiosurales)'] },
      { id: 'mus_q4', text: '¿Notas tensión o quemazón en la banda lateral del muslo al correr o bajar cuestas?', subZones: ['Lateral (Cintilla iliotibial)'] },
    ],
    tests: [
      { id: 'mus_t1', name: 'Adductor Squeeze Test (a 45°)', description: 'Paciente en supino con caderas a 45° apretando resistencia entre las rodillas.', sensitivity: '85%', specificity: '81%', subZones: ['Medial (Aductores)'] },
      { id: 'mus_t2', name: 'Taking Off the Shoe Test (Isquiosurales)', description: 'El paciente intenta descalzarse el zapato del lado afecto ayudándose con el pie opuesto.', sensitivity: '100%', specificity: '100%', subZones: ['Posterior (Isquiosurales)'] },
      { id: 'mus_t3', name: 'Test de Ely', description: 'En prono, flexión pasiva máxima de rodilla observando elevación pélvica o dolor del recto femoral.', sensitivity: '63%', specificity: '85%', subZones: ['Anterior (Cuádriceps)'] },
      { id: 'mus_t4', name: 'Test de Ober', description: 'Decúbito lateral con cadera en extensión dejando caer la pierna en aducción.', sensitivity: '41%', specificity: '95%', subZones: ['Lateral (Cintilla iliotibial)'] },
    ],
  },
  rodilla: {
    id: 'rodilla',
    name: 'Rodilla',
    keywords: ['rodilla', 'rodillas', 'rotula', 'rotuliano', 'menisco', 'cruzado', 'pata de ganso', 'popliteo'],
    subZones: ['Anterior / Rotuliana', 'Medial (LLI / Pata de ganso)', 'Lateral (LLE / Cintilla)', 'Posterior (Hueco poplíteo)', 'Interlínea articular'],
    questions: [
      { id: 'rod_q1', text: '¿Aumenta el dolor anterior al bajar escaleras, saltar o ponerte en cuclillas?', subZones: ['Anterior / Rotuliana'] },
      { id: 'rod_q2', text: '¿Sientes que la rodilla se bloquea, se engancha o te falla al girar sobre el pie apoyado?', subZones: ['Interlínea articular', 'Medial (LLI / Pata de ganso)'] },
      { id: 'rod_q3', text: '¿Se ha hinchado la articulación tras hacer actividad o tras el episodio inicial?', subZones: ['Interlínea articular', 'Posterior (Hueco poplíteo)'] },
      { id: 'rod_q4', text: '¿Aparece dolor punzante externo al correr o pedalear?', subZones: ['Lateral (LLE / Cintilla)'] },
    ],
    tests: [
      { id: 'rod_t1', name: 'Test de Thessaly (a 20°)', description: 'Apoyo monopodal con 20° de flexión realizando rotaciones internas y externas del cuerpo.', sensitivity: '89%', specificity: '97%', subZones: ['Interlínea articular', 'Medial (LLI / Pata de ganso)'] },
      { id: 'rod_t2', name: 'Test de Lachman', description: 'Rodilla a 20-30° de flexión trasladando la tibia hacia anterior respecto al fémur para valorar LCA.', sensitivity: '87%', specificity: '94%', subZones: ['Interlínea articular', 'Anterior / Rotuliana'] },
      { id: 'rod_t3', name: 'Test de McMurray', description: 'Flexión máxima con rotación tibial interna/externa llevando hacia extensión.', sensitivity: '70%', specificity: '84%', subZones: ['Interlínea articular', 'Posterior (Hueco poplíteo)'] },
      { id: 'rod_t4', name: 'Single Leg Decline Squat / Noble', description: 'Sentadilla monopodal excéntrica para tendón rotuliano y compresión del epicóndilo lateral.', sensitivity: '82%', specificity: '80%', subZones: ['Anterior / Rotuliana', 'Lateral (LLE / Cintilla)'] },
    ],
  },
  tobillo: {
    id: 'tobillo',
    name: 'Tobillo',
    keywords: ['tobillo', 'tobillos', 'esguince', 'aquiles', 'peroneo', 'peroneos', 'maleolo', 'sindesmosis'],
    subZones: ['Lateral (LPAa / Peroneos)', 'Medial (Deltoideo / Tibial post.)', 'Posterior (Aquiles)', 'Anterior (Sindesmosis)'],
    questions: [
      { id: 'tob_q1', text: '¿Comenzó el dolor a raíz de una torcedura o un mal apoyo reciente?', subZones: ['Lateral (LPAa / Peroneos)', 'Anterior (Sindesmosis)'] },
      { id: 'tob_q2', text: '¿Notas dolor y rigidez en el tendón de Aquiles al dar los primeros pasos?', subZones: ['Posterior (Aquiles)'] },
      { id: 'tob_q3', text: '¿Duele la zona anterior/alta al forzar la flexión hacia delante?', subZones: ['Anterior (Sindesmosis)'] },
      { id: 'tob_q4', text: '¿Sientes que el tobillo cede al caminar por terreno irregular?', subZones: ['Lateral (LPAa / Peroneos)', 'Medial (Deltoideo / Tibial post.)'] },
    ],
    tests: [
      { id: 'tob_t1', name: 'Cajón Anterior de Tobillo', description: 'Fijación de tibia distal y tracción anterior del calcáneo/astrágalo en ligera flexión plantar.', sensitivity: '86%', specificity: '89%', subZones: ['Lateral (LPAa / Peroneos)'] },
      { id: 'tob_t2', name: 'Signo de Royal London / Thompson (Aquiles)', description: 'Palpación del nódulo doloroso en neutro vs dorsiflexión y compresión gemelar.', sensitivity: '96%', specificity: '93%', subZones: ['Posterior (Aquiles)'] },
      { id: 'tob_t3', name: 'Test de Rotación Externa / Squeeze Test', description: 'Dorsiflexión y rotación externa pasiva del pie respecto a la tibia más compresión tibioperonea.', sensitivity: '68%', specificity: '93%', subZones: ['Anterior (Sindesmosis)'] },
      { id: 'tob_t4', name: 'Single Heel Raise Test (Tibial Posterior)', description: 'Elevación monopodal del talón valorando dolor medial y correcta inversión del calcáneo.', sensitivity: '92%', specificity: '88%', subZones: ['Medial (Deltoideo / Tibial post.)'] },
    ],
  },
  pie: {
    id: 'pie',
    name: 'Pie',
    keywords: ['pie', 'pies', 'planta', 'plantar', 'fascia', 'fascitis', 'talon', 'metatarso', 'hallux', 'juanete', 'arco', 'empeine'],
    subZones: ['Plantar / Fascia / Talón', 'Mediopié / Arco', 'Antepié / Metatarsos', 'Primer radio / Hallux'],
    questions: [
      { id: 'pie_q1', text: '¿Sientes dolor punzante en talón o planta al dar los primeros pasos al levantarte?', subZones: ['Plantar / Fascia / Talón'] },
      { id: 'pie_q2', text: '¿Aumenta el dolor bajo los dedos o notas calambre/hormigueo con calzado estrecho?', subZones: ['Antepié / Metatarsos'] },
      { id: 'pie_q3', text: '¿Te duele la articulación del dedo gordo al impulsarte o ponerte de puntillas?', subZones: ['Primer radio / Hallux'] },
      { id: 'pie_q4', text: '¿Se fatiga o duele el arco interno tras pasar mucho tiempo de pie?', subZones: ['Mediopié / Arco', 'Plantar / Fascia / Talón'] },
    ],
    tests: [
      { id: 'pie_t1', name: 'Test de Windlass', description: 'Extensión dorsal pasiva de la primera articulación metatarsofalángica en carga buscando dolor fascial.', sensitivity: '32%', specificity: '100%', subZones: ['Plantar / Fascia / Talón'] },
      { id: 'pie_t2', name: 'Signo de Mulder (Metatarsalgia / Morton)', description: 'Compresión transversal de cabezas metatarsianas con presión plantar en espacio intermetatarsiano.', sensitivity: '94%', specificity: '88%', subZones: ['Antepié / Metatarsos'] },
      { id: 'pie_t3', name: 'Extensión 1ª MTF en Carga (Hallux Limitus Funcional)', description: 'Comprobación de dorsiflexión pasiva de primera metatarsofalángica en carga y descarga.', sensitivity: '88%', specificity: '90%', subZones: ['Primer radio / Hallux'] },
      { id: 'pie_t4', name: 'Test de Estrés de Mediopié / Navicular Drop', description: 'Movilización dorsoventral de radios medios y valoración de caída del escafoides en carga.', sensitivity: '82%', specificity: '85%', subZones: ['Mediopié / Arco'] },
    ],
  },
};

export const CLINICAL_FAST_TRACK: Record<string, FastTrackRegion> = Object.entries(FAST_TRACK_REGION_DATA)
  .reduce<Record<string, FastTrackRegion>>((regions, [regionId, region]) => {
    regions[regionId] = {
      ...region,
      tests: region.tests.map((test) => {
        const details = FAST_TRACK_TEST_DETAILS[test.id];
        return {
          ...test,
          ...details,
          name: details.name ?? test.name,
        };
      }),
    };
    return regions;
  }, {});
