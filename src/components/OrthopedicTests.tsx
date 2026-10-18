import { useState } from 'react';
import { Plus, Minus, HelpCircle, Info } from 'lucide-react';
import type { OrthopedicTest, TestResult } from '../types';
import { Modal } from './ui/Modal';

interface OrthopedicTestsProps {
  tests: OrthopedicTest[];
  onResultChange: (id: string, result: TestResult) => void;
  onEvolutionChange: (id: string, status: 'unchanged' | 'improved' | 'resolved') => void;
}

export function OrthopedicTests({ tests, onResultChange, onEvolutionChange }: OrthopedicTestsProps) {
  return (
    <div className="space-y-3">
      {tests.map((test) => (
        <TestRow key={test.id} test={test} onResultChange={onResultChange} onEvolutionChange={onEvolutionChange} />
      ))}
    </div>
  );
}

function TestRow({
  test,
  onResultChange,
  onEvolutionChange,
}: {
  test: OrthopedicTest;
  onResultChange: (id: string, result: TestResult) => void;
  onEvolutionChange: (id: string, status: 'unchanged' | 'improved' | 'resolved') => void;
}) {
  const [modalOpen, setModalOpen] = useState(false);

  const resultConfig = {
    positivo: { color: 'bg-error-100 text-error-700 border-error-300', label: 'Positivo' },
    negativo: { color: 'bg-success-100 text-success-700 border-success-300', label: 'Negativo' },
    dudoso: { color: 'bg-warning-100 text-warning-700 border-warning-300', label: 'Dudoso' },
  };

  return (
    <>
      <div className="rounded-xl border border-slate-200 bg-white p-3 transition-colors hover:border-slate-300">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="flex flex-1 items-center gap-2 text-left"
          >
            <Info className="h-4 w-4 shrink-0 text-slate-400" />
            <span className="text-sm font-medium text-slate-800 hover:text-primary-600">{test.name}</span>
            {test.result && (
              <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${resultConfig[test.result].color}`}>
                {resultConfig[test.result].label}
              </span>
            )}
          </button>
          <div className="flex items-center gap-1.5">
            <ResultButton
              active={test.result === 'positivo'}
              onClick={() => onResultChange(test.id, 'positivo')}
              variant="positivo"
            />
            <ResultButton
              active={test.result === 'negativo'}
              onClick={() => onResultChange(test.id, 'negativo')}
              variant="negativo"
            />
            <ResultButton
              active={test.result === 'dudoso'}
              onClick={() => onResultChange(test.id, 'dudoso')}
              variant="dudoso"
            />
          </div>
        </div>
        {test.needsRetest && !test.evolutionStatus && (
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
            <p className="text-xs font-semibold text-amber-900">
              🔄 IA recomienda Re-test en camilla: “{test.retestReason}”
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {([
                ['unchanged', 'Sigue Positivo'],
                ['improved', 'Positivo pero mejor / Mayor rango'],
                ['resolved', 'Negativizado (Resuelto ✓)'],
              ] as const).map(([status, label]) => (
                <button
                  type="button"
                  key={status}
                  onClick={() => onEvolutionChange(test.id, status)}
                  className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-medium text-amber-900 hover:bg-amber-100"
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}
        {test.evolutionStatus && (
          <p className="mt-2 text-xs text-slate-600">
            Re-test registrado: Inicial {test.previousResult || 'sin dato'} → Hoy {{
              unchanged: 'Sigue Positivo',
              improved: 'Positivo pero mejor / Mayor rango',
              resolved: 'Negativizado (Resuelto)',
            }[test.evolutionStatus]}
          </p>
        )}
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={test.name}
        subtitle={`Test ortopédico · Región: ${test.region}`}
        size="lg"
      >
        <div className="space-y-4">
          <div className="rounded-lg bg-slate-50 p-4">
            <p className="text-sm text-slate-600">{test.description}</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <DetailField label="Posición del paciente / fisio" value={test.position} />
            <DetailField label="Maniobra" value={test.maneuver} />
            <DetailField label="Criterio de positividad" value={test.positiveCriteria} />
            <div className="grid grid-cols-2 gap-3">
              <StatCard
                label="Sensibilidad"
                value={formatPercentage(test.sensitivity)}
              />
              <StatCard
                label="Especificidad"
                value={formatPercentage(test.specificity)}
              />
            </div>
          </div>
        </div>
      </Modal>
    </>
  );
}

function ResultButton({
  active,
  onClick,
  variant,
}: {
  active: boolean;
  onClick: () => void;
  variant: 'positivo' | 'negativo' | 'dudoso';
}) {
  const config = {
    positivo: {
      icon: Plus,
      activeColor: 'bg-error-600 text-white border-error-600',
      inactiveColor: 'text-error-600 border-slate-200 hover:border-error-300',
    },
    negativo: {
      icon: Minus,
      activeColor: 'bg-success-600 text-white border-success-600',
      inactiveColor: 'text-success-600 border-slate-200 hover:border-success-300',
    },
    dudoso: {
      icon: HelpCircle,
      activeColor: 'bg-warning-500 text-white border-warning-500',
      inactiveColor: 'text-warning-600 border-slate-200 hover:border-warning-300',
    },
  }[variant];

  const Icon = config.icon;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-9 w-9 items-center justify-center rounded-lg border transition-all ${
        active ? config.activeColor : `bg-white ${config.inactiveColor}`
      }`}
      title={variant === 'positivo' ? 'Positivo' : variant === 'negativo' ? 'Negativo' : 'Dudoso'}
    >
      <Icon className="h-4 w-4" strokeWidth={2.5} />
    </button>
  );
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="text-sm text-slate-700">{value}</p>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 p-3 text-center">
      <p className="text-xs font-medium text-slate-400">{label}</p>
      <p className="mt-1 text-lg font-bold text-secondary-600">{value}</p>
    </div>
  );
}

function formatPercentage(...values: unknown[]): string {
  const value = values.find((candidate) =>
    candidate !== undefined && candidate !== null && String(candidate).trim() !== '',
  );
  if (value === undefined || value === null) return '-';

  const text = String(value).trim();
  const hasPercentSign = text.endsWith('%');
  const numericValue = Number(hasPercentSign ? text.slice(0, -1).trim() : text);
  if (!Number.isFinite(numericValue)) return text;

  const percentage = !hasPercentSign && numericValue >= 0 && numericValue <= 1
    ? numericValue * 100
    : numericValue;
  return `${Number(percentage.toFixed(2))}%`;
}
