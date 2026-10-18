import { useState, useRef, useEffect } from 'react';
import {
  Activity, Settings, ChevronDown, UserPlus, Check, Waves, Calendar,
  Bed, Gauge, Syringe, Dumbbell, Radio, Stethoscope, Users, Zap,
  Contact,
} from 'lucide-react';
import type { TabKey, EquipmentKey, GeminiConfig } from '../types';
import { EQUIPMENT } from '../mockData';
import { Badge } from './ui/Badge';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';

interface HeaderProps {
  activeTab: TabKey;
  onTabChange: (tab: TabKey) => void;
  professionals: string[];
  selectedPhysio: string;
  onPhysioChange: (p: string) => void;
  onAddProfessional: (name: string) => void;
  equipment: Record<EquipmentKey, boolean>;
  onEquipmentToggle: (key: EquipmentKey) => void;
  geminiConfig: GeminiConfig;
  onGeminiConfigSave: (config: GeminiConfig) => void;
  activePatientName: string | null;
  hasActivePatient: boolean;
}

const EQUIPMENT_ICONS: Record<string, typeof Waves> = {
  ecografo: Waves,
  camilla: Bed,
  dinamometro: Gauge,
  invasivas: Syringe,
  gimnasio: Dumbbell,
  radiofrecuencia: Radio,
  superinductive: Waves,
  shockwaves_radial: Zap,
  shockwaves_focal: Zap,
};



export function Header({
  activeTab,
  onTabChange,
  professionals,
  selectedPhysio,
  onPhysioChange,
  onAddProfessional,
  equipment,
  onEquipmentToggle,
  geminiConfig,
  onGeminiConfigSave,
  activePatientName,
  hasActivePatient,
}: HeaderProps) {
  const [physioOpen, setPhysioOpen] = useState(false);
  const [equipOpen, setEquipOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [addingPhysio, setAddingPhysio] = useState(false);
  const [newPhysioName, setNewPhysioName] = useState('');
  const [configDraft, setConfigDraft] = useState<GeminiConfig>(geminiConfig);

  const physioRef = useRef<HTMLDivElement>(null);
  const equipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (physioRef.current && !physioRef.current.contains(e.target as Node)) setPhysioOpen(false);
      if (equipRef.current && !equipRef.current.contains(e.target as Node)) setEquipOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    setConfigDraft(geminiConfig);
  }, [geminiConfig, settingsOpen]);

  const activeEquipmentCount = Object.values(equipment).filter(Boolean).length;
  const shortPhysio = selectedPhysio.replace('Fisio: ', '');

  const handleAddPhysio = () => {
    const name = newPhysioName.trim();
    if (name) {
      onAddProfessional(name);
      setNewPhysioName('');
      setAddingPhysio(false);
    }
  };

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur-md">
        <div className="mx-auto max-w-[1400px] px-4 lg:px-6">
          {/* Top row */}
          <div className="flex h-16 items-center justify-between gap-4">
            {/* Logo + Badge */}
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 shadow-sm">
                <Activity className="h-6 w-6 text-white" strokeWidth={2.5} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-bold text-slate-900">FisioCopilot</h1>
                  <Badge variant="success" pulse>
                    <span className="h-1.5 w-1.5 rounded-full bg-success-500" />
                    Asistente Clínico Activo
                  </Badge>
                </div>
                <p className="hidden text-xs text-slate-400 sm:block">
                  Razonamiento clínico · Documentación en tiempo real
                </p>
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-2 lg:gap-3">
              {/* Professional Selector */}
              <div className="relative" ref={physioRef}>
                <button
                  type="button"
                  onClick={() => setPhysioOpen((v) => !v)}
                  className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
                >
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-secondary-100 text-xs font-bold text-secondary-700">
                    {shortPhysio.charAt(0).toUpperCase()}
                  </div>
                  <span className="hidden sm:inline">{selectedPhysio}</span>
                  <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${physioOpen ? 'rotate-180' : ''}`} />
                </button>
                {physioOpen && (
                  <div className="absolute right-0 mt-2 w-56 rounded-xl border border-slate-200 bg-white py-2 shadow-modal animate-slide-up">
                    {professionals.map((p) => (
                      <button
                        type="button"
                        key={p}
                        onClick={() => {
                          onPhysioChange(p);
                          setPhysioOpen(false);
                        }}
                        className="flex w-full items-center justify-between px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                      >
                        <span>{p}</span>
                        {p === selectedPhysio && <Check className="h-4 w-4 text-primary-600" />}
                      </button>
                    ))}
                    {addingPhysio ? (
                      <div className="border-t border-slate-100 px-3 pt-2">
                        <input
                          autoFocus
                          value={newPhysioName}
                          onChange={(e) => setNewPhysioName(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleAddPhysio()}
                          placeholder="Nombre del profesional"
                          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary-400"
                        />
                        <div className="mt-2 flex gap-2">
                          <Button size="sm" type="button" onClick={handleAddPhysio}>Añadir</Button>
                          <Button size="sm" type="button" variant="ghost" onClick={() => setAddingPhysio(false)}>Cancelar</Button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setAddingPhysio(true)}
                        className="flex w-full items-center gap-2 border-t border-slate-100 px-4 py-2 text-sm font-medium text-primary-600 hover:bg-primary-50"
                      >
                        <UserPlus className="h-4 w-4" /> Añadir profesional
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Equipment Popover */}
              <div className="relative" ref={equipRef}>
                <button
                  type="button"
                  onClick={() => setEquipOpen((v) => !v)}
                  className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
                >
                  <Stethoscope className="h-4 w-4 text-slate-500" />
                  <span className="hidden md:inline">Equipamiento</span>
                  <Badge variant="primary">{activeEquipmentCount}</Badge>
                  <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${equipOpen ? 'rotate-180' : ''}`} />
                </button>
                {equipOpen && (
                  <div className="absolute right-0 mt-2 w-80 rounded-xl border border-slate-200 bg-white py-3 shadow-modal animate-slide-up">
                    <p className="px-4 pb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Material y Equipamiento de la Clínica
                    </p>
                    {EQUIPMENT.map((eq) => {
                      const Icon = EQUIPMENT_ICONS[eq.key] || Waves;
                      const isActive = equipment[eq.key];
                      return (
                        <button
                          type="button"
                          key={eq.key}
                          onClick={() => onEquipmentToggle(eq.key)}
                          className="flex w-full items-center gap-3 px-4 py-2 text-left hover:bg-slate-50"
                        >
                          <div
                            className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
                              isActive ? 'bg-primary-100 text-primary-700' : 'bg-slate-100 text-slate-400'
                            }`}
                          >
                            <Icon className="h-4 w-4" />
                          </div>
                          <span className={`flex-1 text-sm ${isActive ? 'text-slate-800' : 'text-slate-500'}`}>
                            {eq.label}
                          </span>
                          <div
                            className={`flex h-5 w-5 items-center justify-center rounded border transition-colors ${
                              isActive
                                ? 'border-primary-600 bg-primary-600 text-white'
                                : 'border-slate-300 bg-white'
                            }`}
                          >
                            {isActive && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Settings */}
              <button
                type="button"
                onClick={() => setSettingsOpen(true)}
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-700"
                title="Ajustes"
              >
                <Settings className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Tab Navigation */}
          <nav className="flex flex-wrap items-center gap-1">
            <TabButton
              active={activeTab === 'agenda'}
              onClick={() => onTabChange('agenda')}
              icon={<Calendar className="h-4 w-4" />}
              label="Agenda"
            />
            <TabButton
              active={activeTab === 'pacientes'}
              onClick={() => onTabChange('pacientes')}
              icon={<Users className="h-4 w-4" />}
              label="Pacientes"
            />
            <div className="mx-2 h-5 w-px self-center bg-slate-200" />
            <span className="inline-flex shrink-0 items-center gap-1.5 self-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
              {hasActivePatient ? `👤 ${activePatientName}` : 'Sin paciente seleccionado'}
            </span>
            <TabButton
              active={activeTab === 'valoracion'}
              onClick={() => hasActivePatient ? onTabChange('valoracion') : undefined}
              icon={<Stethoscope className="h-4 w-4" />}
              label="Valoración"
              disabled={!hasActivePatient}
            />
            <TabButton
              active={activeTab === 'expediente'}
              onClick={() => hasActivePatient ? onTabChange('expediente') : undefined}
              icon={<Activity className="h-4 w-4" />}
              label="Expediente"
              disabled={!hasActivePatient}
            />
            <TabButton
              active={activeTab === 'informacion'}
              onClick={() => hasActivePatient ? onTabChange('informacion') : undefined}
              icon={<Contact className="h-4 w-4" />}
              label="Información"
              disabled={!hasActivePatient}
            />
          </nav>
        </div>
      </header>

      {/* Settings Modal */}
      <Modal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        title="Ajustes de FisioCopilot"
        subtitle="Configuración de la API de Google Gemini"
        footer={
          <>
            <Button variant="ghost" onClick={() => setSettingsOpen(false)}>Cancelar</Button>
            <Button
              onClick={() => {
                onGeminiConfigSave(configDraft);
                setSettingsOpen(false);
              }}
            >
              Guardar configuración
            </Button>
          </>
        }
      >
        <div className="space-y-5">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              API Key de Google Gemini
            </label>
            <input
              type="password"
              value={configDraft.apiKey}
              onChange={(e) => setConfigDraft({ ...configDraft, apiKey: e.target.value })}
              placeholder="Introduce tu API key de Google AI Studio"
              className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none transition-colors focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
            />
            <p className="mt-1.5 text-xs text-slate-400">
              La clave se guarda localmente en tu navegador (localStorage) y no se comparte.
            </p>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Modelo activo
            </label>
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-600">
              <span className="h-2 w-2 rounded-full bg-success-500" />
              Modelo activo: Gemini 3.8 Flash
            </div>
            <p className="mt-1.5 text-xs text-slate-400">
              El modelo está fijado automáticamente. Solo necesitas introducir tu API key.
            </p>
          </div>
          <div className="rounded-lg bg-slate-50 p-3">
            <p className="text-xs text-slate-500">
              Sin una API key configurada, el botón "Recalcular Hipótesis con IA" usará las hipótesis
              precargadas del caso de ejemplo. Configura tu clave para activar el razonamiento en tiempo real.
            </p>
          </div>
        </div>
      </Modal>
    </>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  label,
  disabled,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
        disabled
          ? 'cursor-not-allowed border-transparent text-slate-300'
          : active
            ? 'border-primary-600 text-primary-700'
            : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700'
      }`
    }>
      {icon}
      {label}
    </button>
  );
}
