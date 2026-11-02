import type { BodyRegion } from '../types';
import { BODY_REGIONS } from '../mockData';

export interface BodyMapSelection {
  regionId: string;
  laterality: '' | 'Derecho' | 'Izquierdo' | 'Bilateral' | 'Central';
  subZones: string[];
}

interface BodyMapProps {
  selected: BodyRegion | null;
  onSelect: (region: BodyRegion | null) => void;
  allowDeselect?: boolean;
  multiSelect?: boolean;
  selectedRegions?: BodyMapSelection[];
  onSelectedRegionsChange?: (regions: BodyMapSelection[]) => void;
  laterality: string;
  onLateralityChange: (laterality: string) => void;
  subRegion: string;
  onSubRegionChange: (subRegion: string) => void;
}

const LATERALITIES = ['Derecho', 'Izquierdo', 'Bilateral', 'Central'] as const;

const FAST_TRACK_REGION_IDS: Partial<Record<BodyRegion, string>> = {
  cervical: 'cervical',
  dorsal: 'dorsal',
  lumbar: 'lumbar',
  pelvis: 'pelvis_cadera',
  hombro: 'hombro',
  codo: 'codo',
  muneca: 'muneca_mano',
  muslo: 'muslo',
  rodilla: 'rodilla',
  tobillo: 'tobillo',
  pie: 'pie',
};

const BODY_REGION_BY_FAST_TRACK_ID = Object.fromEntries(
  Object.entries(FAST_TRACK_REGION_IDS).map(([bodyRegion, regionId]) => [regionId, bodyRegion]),
) as Record<string, BodyRegion>;

const SUBREGIONS: Partial<Record<BodyRegion, string[]>> = {
  cervical: ['Cervical alta (C0-C3)', 'Cervical baja (C4-C7)', 'Paravertebral / Facetario', 'Trapecio superior', 'Irradiación interescapular'],
  dorsal: ['Interescapular', 'Dorsal media', 'Charneca dorsolumbar', 'Parrilla costal'],
  lumbar: ['Central / Axial', 'Paravertebral / Facetario', 'Charneca lumbosacra (L5-S1)', 'Glúteo / Sacroilíaca', 'Irradiación ciática'],
  pelvis: ['Ingle / Anterior', 'Trocánter / Lateral', 'Glúteo profundo / Piramidal', 'Sacroilíaca', 'Isquiosural proximal'],
  hombro: ['Subacromial / Lateral', 'Anterior / Corredera bicipital', 'Superior / Acromioclavicular', 'Posterior / Infraespinoso', 'Escapular'],
  codo: ['Lateral (Epicóndilo)', 'Medial (Epitróclea)', 'Posterior (Olécranon)', 'Anterior / Fosa cubital'],
  muneca: ['Radial / De Quervain', 'Cubital / FCT', 'Carpiana / Volar', 'Dorsal', 'Dedos / Pulgar'],
  muslo: ['Anterior (Cuádriceps)', 'Posterior (Isquiosurales)', 'Medial (Aductores)', 'Lateral (Cintilla iliotibial)'],
  rodilla: ['Anterior / Rotuliana', 'Medial (LLI / Pata de ganso)', 'Lateral (LLE / Cintilla)', 'Posterior (Hueco poplíteo)', 'Interlínea articular'],
  tobillo: ['Lateral (LPAa / Peroneos)', 'Medial (Deltoideo / Tibial post.)', 'Posterior (Aquiles)', 'Anterior (Sindesmosis)'],
  pie: ['Plantar / Fascia / Talón', 'Mediopié / Arco', 'Antepié / Metatarsos', 'Primer radio / Hallux'],
};

const PILL_GROUPS: { group: string; regions: { key: BodyRegion; label: string }[] }[] = [
  {
    group: 'Columna',
    regions: [
      { key: 'cervical', label: 'Cervical' },
      { key: 'dorsal', label: 'Dorsal' },
      { key: 'lumbar', label: 'Lumbar' },
      { key: 'pelvis', label: 'Pelvis/Cadera' },
    ],
  },
  {
    group: 'MMSS',
    regions: [
      { key: 'hombro', label: 'Hombro' },
      { key: 'codo', label: 'Codo' },
      { key: 'muneca', label: 'Muñeca/Mano' },
    ],
  },
  {
    group: 'MMII',
    regions: [
      { key: 'muslo', label: 'Muslo' },
      { key: 'rodilla', label: 'Rodilla' },
      { key: 'tobillo', label: 'Tobillo' },
      { key: 'pie', label: 'Pie' },
    ],
  },
];

export function BodyMap({
  selected,
  onSelect,
  allowDeselect = false,
  multiSelect = false,
  selectedRegions = [],
  onSelectedRegionsChange,
  laterality,
  onLateralityChange,
  subRegion,
  onSubRegionChange,
}: BodyMapProps) {
  const changeSelection = (region: BodyRegion) => {
    const regionId = FAST_TRACK_REGION_IDS[region];
    if (!regionId || !onSelectedRegionsChange) return;
    const isSelected = selectedRegions.some((item) => item.regionId === regionId);
    onSelectedRegionsChange(isSelected
      ? selectedRegions.filter((item) => item.regionId !== regionId)
      : [...selectedRegions, { regionId, laterality: '', subZones: [] }]);
  };
  const changeLaterality = (regionId: string, value: BodyMapSelection['laterality']) => {
    onSelectedRegionsChange?.(selectedRegions.map((item) => item.regionId === regionId
      ? { ...item, laterality: item.laterality === value ? '' : value }
      : item));
  };
  const changeSubZone = (regionId: string, value: string) => {
    onSelectedRegionsChange?.(selectedRegions.map((item) => {
      if (item.regionId !== regionId) return item;
      const subZones = item.subZones.includes(value)
        ? item.subZones.filter((zone) => zone !== value)
        : [...item.subZones, value];
      return { ...item, subZones };
    }));
  };
  const selectedLabel = selected
    ? BODY_REGIONS.find((r) => r.key === selected)?.label
    : null;
  const selectedSubregions = selected ? SUBREGIONS[selected] ?? [] : [];

  return (
    <div className="flex flex-col gap-4">
      <div className="aspect-[1/2] max-w-[280px] mx-auto relative">
        <svg
          viewBox="0 0 200 410"
          className="absolute inset-0 h-full w-full"
          fill="none"
          preserveAspectRatio="xMidYMid meet"
        >
          <circle cx="100" cy="30" r="22" className="fill-slate-100 stroke-slate-200" strokeWidth="1.5" />
          <rect x="90" y="50" width="20" height="16" rx="5" className="fill-slate-100 stroke-slate-200" strokeWidth="1.5" />
          <path
            d="M 65 66 Q 55 68 52 85 L 50 150 Q 50 165 58 175 L 72 185 L 72 195 Q 80 200 100 200 Q 120 200 128 195 L 128 185 L 142 175 Q 150 165 150 150 L 148 85 Q 145 68 135 66 Z"
            className="fill-slate-100 stroke-slate-200"
            strokeWidth="1.5"
          />
          <path d="M 55 74 Q 36 90 32 135 Q 30 155 28 170" className="fill-slate-100 stroke-slate-200" strokeWidth="1.5" />
          <path d="M 26 66 Q 14 85 12 125 Q 10 150 8 165" className="fill-slate-100 stroke-slate-200" strokeWidth="1.5" />
          <path d="M 145 74 Q 164 90 168 135 Q 170 155 172 170" className="fill-slate-100 stroke-slate-200" strokeWidth="1.5" />
          <path d="M 174 66 Q 186 85 188 125 Q 190 150 192 165" className="fill-slate-100 stroke-slate-200" strokeWidth="1.5" />
          <path d="M 72 195 Q 56 202 54 215 L 56 235" className="fill-slate-100 stroke-slate-200" strokeWidth="1.5" />
          <path d="M 128 195 Q 144 202 146 215 L 144 235" className="fill-slate-100 stroke-slate-200" strokeWidth="1.5" />
          <path d="M 60 235 Q 55 275 53 320 Q 51 355 49 385" className="fill-slate-100 stroke-slate-200" strokeWidth="1.5" />
          <path d="M 72 235 Q 70 275 68 320 Q 66 355 64 385" className="fill-slate-100 stroke-slate-200" strokeWidth="1.5" />
          <path d="M 128 235 Q 130 275 132 320 Q 134 355 136 385" className="fill-slate-100 stroke-slate-200" strokeWidth="1.5" />
          <path d="M 140 235 Q 145 275 147 320 Q 149 355 151 385" className="fill-slate-100 stroke-slate-200" strokeWidth="1.5" />
          <ellipse cx="50" cy="400" rx="14" ry="7" className="fill-slate-100 stroke-slate-200" strokeWidth="1.5" />
          <ellipse cx="150" cy="400" rx="14" ry="7" className="fill-slate-100 stroke-slate-200" strokeWidth="1.5" />
        </svg>

      </div>

      {multiSelect ? (
        <div className="space-y-3">
          {selectedRegions.map((selection) => {
            const bodyRegion = BODY_REGION_BY_FAST_TRACK_ID[selection.regionId];
            if (!bodyRegion) return null;
            const label = BODY_REGIONS.find((item) => item.key === bodyRegion)?.label ?? bodyRegion;
            return (
              <div key={selection.regionId} className="space-y-3 rounded-lg border border-primary-200 bg-primary-50 px-4 py-3 text-center animate-fade-in">
                <span className="block text-sm font-medium text-primary-700">
                  Región seleccionada: {[label, ...selection.subZones, selection.laterality].filter(Boolean).join(' · ')}
                </span>
                <div>
                  <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-primary-600">Lateralidad</p>
                  <div className="flex flex-wrap justify-center gap-1.5">
                    {LATERALITIES.map((side) => (
                      <button
                        type="button"
                        key={side}
                        aria-pressed={selection.laterality === side}
                        onClick={() => changeLaterality(selection.regionId, side)}
                        className={`rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
                          selection.laterality === side
                            ? 'bg-primary-600 text-white'
                            : 'border border-primary-200 bg-white text-primary-700 hover:bg-primary-100'
                        }`}
                      >
                        {side}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-primary-600">Sub-zonas anatómicas</p>
                  <div className="flex flex-wrap justify-center gap-1.5">
                    {(SUBREGIONS[bodyRegion] ?? []).map((zone) => (
                      <button
                        type="button"
                        key={zone}
                        aria-pressed={selection.subZones.includes(zone)}
                        onClick={() => changeSubZone(selection.regionId, zone)}
                        className={`rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
                          selection.subZones.includes(zone)
                            ? 'bg-primary-600 text-white'
                            : 'border border-primary-200 bg-white text-primary-700 hover:bg-primary-100'
                        }`}
                      >
                        {zone}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : selectedLabel && (
        <div className="space-y-3 rounded-lg border border-primary-200 bg-primary-50 px-4 py-3 text-center animate-fade-in">
          <span className="block text-sm font-medium text-primary-700">
            Región seleccionada: {[selectedLabel, subRegion, laterality].filter(Boolean).join(' · ')}
          </span>
          <div>
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-primary-600">Lateralidad</p>
            <div className="flex flex-wrap justify-center gap-1.5">
              {LATERALITIES.map((side) => (
                <button
                  type="button"
                  key={side}
                  aria-pressed={laterality === side}
                  onClick={() => onLateralityChange(laterality === side ? '' : side)}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
                    laterality === side
                      ? 'bg-primary-600 text-white'
                      : 'border border-primary-200 bg-white text-primary-700 hover:bg-primary-100'
                  }`}
                >
                  {side}
                </button>
              ))}
            </div>
          </div>
          {selectedSubregions.length > 0 && (
            <div>
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-primary-600">Sub-zona anatómica</p>
              <div className="flex flex-wrap justify-center gap-1.5">
                {selectedSubregions.map((zone) => (
                  <button
                    type="button"
                    key={zone}
                    aria-pressed={subRegion === zone}
                    onClick={() => onSubRegionChange(subRegion === zone ? '' : zone)}
                    className={`rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
                      subRegion === zone
                        ? 'bg-primary-600 text-white'
                        : 'border border-primary-200 bg-white text-primary-700 hover:bg-primary-100'
                    }`}
                  >
                    {zone}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="space-y-2">
        {PILL_GROUPS.map((group) => (
          <div key={group.group}>
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
              {group.group}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {group.regions.map((r) => {
                const isSelected = multiSelect
                  ? selectedRegions.some((item) => item.regionId === FAST_TRACK_REGION_IDS[r.key])
                  : selected === r.key;
                return (
                  <button
                    type="button"
                    key={r.key}
                    onClick={() => {
                      if (multiSelect) changeSelection(r.key);
                      else onSelect(allowDeselect && isSelected ? null : r.key);
                    }}
                    className={`rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
                      isSelected
                        ? 'bg-primary-600 text-white shadow-sm'
                        : 'border border-slate-200 bg-white text-slate-600 hover:border-primary-300 hover:bg-primary-50/50'
                    }`}
                  >
                    {r.label}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
