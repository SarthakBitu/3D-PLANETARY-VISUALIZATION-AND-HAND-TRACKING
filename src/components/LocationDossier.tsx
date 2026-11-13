import React from 'react';
import { X, Crosshair, Globe2, MapPin, Orbit, Sparkles, Satellite } from 'lucide-react';
import type { CityInfo, ContinentInfo, CountryRecord } from '../data/worldGeoData';
import type { CelestialBodyInfo } from '../data/cosmosData';
import type { SatelliteInfo } from '../data/satelliteData';

export interface SelectedLocationState {
  kind: 'country' | 'city' | 'continent' | 'cosmic' | 'satellite';
  country?: CountryRecord;
  city?: CityInfo;
  continent?: ContinentInfo;
  cosmic?: CelestialBodyInfo;
  satellite?: SatelliteInfo;
}

interface LocationDossierProps {
  selected: SelectedLocationState | null;
  isTrackingSatellite?: boolean;
  onToggleTrackSatellite?: () => void;
  onZoomIn: () => void;
  onEnterEarthOrbit?: () => void;
  onEnterSolarSystem?: () => void;
  onClear: () => void;
}

function formatCoord(val: number, pos: string, neg: string): string {
  return `${Math.abs(val).toFixed(2)}° ${val >= 0 ? pos : neg}`;
}

export const LocationDossier: React.FC<LocationDossierProps> = ({
  selected,
  isTrackingSatellite = false,
  onToggleTrackSatellite,
  onZoomIn,
  onEnterEarthOrbit,
  onEnterSolarSystem,
  onClear,
}) => {
  if (!selected) return null;

  let title = '';
  let subtitle = '';
  let coordText = '';
  let summary = '';
  let stats: Array<{ label: string; value: string }> = [];

  if (selected.kind === 'satellite' && selected.satellite) {
    const s = selected.satellite;
    title = s.name;
    subtitle = `${s.regime} Orbit · ${s.agency}`;
    coordText = `${s.altitudeKm} · ${s.velocityKms}`;
    summary = s.summary;
    stats = [
      { label: 'Orbital Period', value: s.periodLabel },
      { label: 'Inclination', value: `${s.inclinationDeg.toFixed(1)}°` },
      { label: 'Launched', value: s.launchedYear },
      { label: 'Regime', value: s.regime },
    ];
  } else if (selected.kind === 'cosmic' && selected.cosmic) {
    const c = selected.cosmic;
    title = c.name;
    subtitle = `${c.category} · ${c.scale === 'galaxy' ? 'Milky Way' : 'Solar System'}`;
    coordText = c.distanceLabel;
    summary = c.summary;
    stats = [
      { label: 'Diameter', value: c.diameter },
      { label: 'Orbital Period', value: c.orbitalPeriod },
      { label: 'Temperature', value: c.surfaceTemp },
      { label: 'Satellites / Scale', value: c.moonsCount },
    ];
  } else if (selected.kind === 'city' && selected.city) {
    const c = selected.city;
    title = c.name;
    subtitle = `${c.country} · ${c.continent}`;
    coordText = `${formatCoord(c.lat, 'N', 'S')} · ${formatCoord(c.lng, 'E', 'W')}`;
    summary = c.summary;
    stats = [
      { label: 'Population', value: c.population },
      { label: 'Elevation', value: c.elevation },
      { label: 'Classification', value: c.isCapital ? 'National Capital' : 'Major Metropolis' },
    ];
  } else if (selected.kind === 'country' && selected.country) {
    const c = selected.country;
    title = c.name;
    subtitle = `${c.metadata.continent} · ${c.metadata.region}`;
    coordText = `${formatCoord(c.lat, 'N', 'S')} · ${formatCoord(c.lng, 'E', 'W')}`;
    summary = c.metadata.summary;
    stats = [
      { label: 'Capital', value: c.metadata.capital },
      { label: 'Population', value: c.metadata.population },
      { label: 'Area', value: c.metadata.areaKm2 },
    ];
  } else if (selected.kind === 'continent' && selected.continent) {
    const c = selected.continent;
    title = c.name;
    subtitle = `Continent · ${c.countriesCount} Sovereign States`;
    coordText = `${formatCoord(c.lat, 'N', 'S')} · ${formatCoord(c.lng, 'E', 'W')}`;
    summary = c.summary;
    stats = [
      { label: 'Land Area', value: c.areaKm2 },
      { label: 'Population', value: c.population },
      { label: 'Highest Peak', value: c.highestPeak },
    ];
  }

  const isCosmicEarth = selected.kind === 'cosmic' && selected.cosmic?.id === 'earth';
  const isOrionSpur = selected.kind === 'cosmic' && selected.cosmic?.id === 'orion-spur';
  const isSatellite = selected.kind === 'satellite' && Boolean(selected.satellite);

  return (
    <aside
      className="fixed bottom-4 right-4 z-30 w-[312px] max-w-[calc(100vw-2rem)] rounded-xl bg-[#080f1f]/92 border border-cyan-500/25 shadow-2xl overflow-hidden"
      aria-label="Selected location details"
    >
      <div className="flex items-start justify-between gap-2 px-4 pt-3.5 pb-2.5 border-b border-slate-800/90">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-xs text-cyan-400">
            {selected.kind === 'satellite' ? (
              <Satellite className="w-3.5 h-3.5 shrink-0 text-amber-300" />
            ) : selected.kind === 'city' ? (
              <MapPin className="w-3.5 h-3.5 shrink-0" />
            ) : selected.kind === 'cosmic' ? (
              selected.cosmic?.scale === 'galaxy' ? (
                <Sparkles className="w-3.5 h-3.5 shrink-0" />
              ) : (
                <Orbit className="w-3.5 h-3.5 shrink-0" />
              )
            ) : (
              <Globe2 className="w-3.5 h-3.5 shrink-0" />
            )}
            <span className="truncate">{subtitle}</span>
          </div>
          <h3 className="font-display text-lg font-semibold text-slate-100 truncate mt-0.5">
            {title}
          </h3>
        </div>
        <button
          type="button"
          onClick={onClear}
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors shrink-0"
          aria-label="Close location details"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-4 space-y-3">
        <div className="flex items-center justify-between gap-2 text-xs py-1.5 px-2.5 rounded-lg bg-[#050a15] border border-slate-800/80 font-mono-tabular">
          <span className="text-slate-400 shrink-0">
            {selected.kind === 'satellite' ? 'Orbit' : selected.kind === 'cosmic' ? 'Position' : 'Coordinates'}
          </span>
          <span className="text-cyan-300 truncate text-right">{coordText}</span>
        </div>

        <div className="grid grid-cols-1 gap-1.5 text-xs">
          {stats.map((s) => (
            <div key={s.label} className="flex items-center justify-between gap-3 py-0.5">
              <span className="text-slate-400 shrink-0">{s.label}</span>
              <span className="text-slate-100 font-medium text-right truncate">{s.value}</span>
            </div>
          ))}
        </div>

        <p className="text-xs text-slate-300 leading-relaxed pt-1 border-t border-slate-800/80">
          {summary}
        </p>

        <div className="flex items-center gap-2 pt-1">
          {isSatellite && onToggleTrackSatellite ? (
            <button
              type="button"
              onClick={onToggleTrackSatellite}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border transition-colors whitespace-nowrap ${
                isTrackingSatellite
                  ? 'bg-amber-500/20 border-amber-400/50 text-amber-200 hover:bg-amber-500/30'
                  : 'bg-cyan-500/20 border-cyan-400/40 text-cyan-200 hover:bg-cyan-500/30'
              }`}
            >
              <Crosshair className="w-3.5 h-3.5" />
              <span>{isTrackingSatellite ? 'Release Lock' : 'Lock Orbit'}</span>
            </button>
          ) : isCosmicEarth && onEnterEarthOrbit ? (
            <button
              type="button"
              onClick={onEnterEarthOrbit}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-cyan-500/20 border border-cyan-400/40 text-cyan-200 text-xs font-semibold hover:bg-cyan-500/30 transition-colors whitespace-nowrap"
            >
              <Globe2 className="w-3.5 h-3.5" />
              <span>Enter Earth Orbit</span>
            </button>
          ) : isOrionSpur && onEnterSolarSystem ? (
            <button
              type="button"
              onClick={onEnterSolarSystem}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-cyan-500/20 border border-cyan-400/40 text-cyan-200 text-xs font-semibold hover:bg-cyan-500/30 transition-colors whitespace-nowrap"
            >
              <Orbit className="w-3.5 h-3.5" />
              <span>Enter Solar System</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onZoomIn}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-cyan-500/20 border border-cyan-400/40 text-cyan-200 text-xs font-semibold hover:bg-cyan-500/30 transition-colors whitespace-nowrap"
            >
              <Crosshair className="w-3.5 h-3.5" />
              <span>Focus & Zoom</span>
            </button>
          )}
          <button
            type="button"
            onClick={onClear}
            className="px-3 py-2 rounded-lg bg-slate-800/90 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors whitespace-nowrap"
          >
            Clear
          </button>
        </div>
      </div>
    </aside>
  );
};
