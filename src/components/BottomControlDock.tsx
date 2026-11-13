import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Plus, Minus, Play, Pause, Satellite } from 'lucide-react';
import { CONTINENTS, type ContinentInfo } from '../data/worldGeoData';
import {
  GALAXY_REGIONS,
  SOLAR_BODIES,
  type CelestialBodyInfo,
  type CosmicScale,
} from '../data/cosmosData';
import { SATELLITES } from '../data/satelliteData';
import type { EarthLayerVisibility } from '../three/EarthScene';

interface BottomControlDockProps {
  cosmicScale: CosmicScale;
  onChangeScale: (scale: CosmicScale) => void;
  satelliteMode: boolean;
  onToggleSatelliteMode: () => void;
  trackedSatelliteId: string | null;
  onTrackSatellite: (satId: string | null) => void;
  activeContinent: string | null;
  onSelectContinent: (continent: ContinentInfo | null) => void;
  onSelectCosmicBody: (body: CelestialBodyInfo) => void;
  layers: EarthLayerVisibility;
  onToggleLayer: (key: keyof EarthLayerVisibility) => void;
  orbitsPaused: boolean;
  onToggleOrbitsPaused: () => void;
  onZoomStep: (deltaDist: number) => void;
}

export const BottomControlDock: React.FC<BottomControlDockProps> = ({
  cosmicScale,
  onChangeScale,
  satelliteMode,
  onToggleSatelliteMode,
  trackedSatelliteId,
  onTrackSatellite,
  activeContinent,
  onSelectContinent,
  onSelectCosmicBody,
  layers,
  onToggleLayer,
  orbitsPaused,
  onToggleOrbitsPaused,
  onZoomStep,
}) => {
  const [collapsed, setCollapsed] = useState(false);

  const earthLayers: Array<{ key: keyof EarthLayerVisibility; label: string }> = [
    { key: 'borders', label: 'Borders' },
    { key: 'cities', label: 'Cities' },
    { key: 'clouds', label: 'Clouds' },
    { key: 'dayNight', label: 'Day/Night' },
    { key: 'graticule', label: 'Grid' },
  ];

  const solarQuickBodies = SOLAR_BODIES.filter((b) => b.id !== 'moon');

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-20 hidden lg:flex flex-col items-center max-w-[min(700px,calc(100vw-600px))]">
      {/* Collapse / Expand Handle */}
      <button
        type="button"
        onClick={() => setCollapsed((v) => !v)}
        className="flex items-center gap-1.5 px-3 py-1 rounded-t-lg bg-[#080f1f]/90 border border-b-0 border-cyan-500/20 text-[11px] font-medium text-slate-300 hover:text-cyan-300 transition-colors"
      >
        {collapsed ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        <span>{collapsed ? 'Show Explorer Dock' : 'Hide Controls'}</span>
      </button>

      {!collapsed && (
        <div className="w-full px-3 py-2.5 rounded-xl bg-[#080f1f]/92 border border-cyan-500/25 shadow-2xl space-y-2">
          {/* Cosmic Scale Switcher Row + Satellite Mode Toggle */}
          <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-slate-800/90">
            <div className="flex items-center gap-1.5 min-w-0">
              <div className="flex items-center gap-1 p-0.5 rounded-lg bg-[#050a15] border border-slate-800">
                {(
                  [
                    { id: 'earth', label: 'Earth Globe' },
                    { id: 'solar', label: 'Solar System' },
                    { id: 'galaxy', label: 'Milky Way' },
                  ] as Array<{ id: CosmicScale; label: string }>
                ).map((tab) => {
                  const active = cosmicScale === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => onChangeScale(tab.id)}
                      className={`px-2.5 py-1 rounded-md text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
                        active
                          ? 'bg-cyan-500/25 text-cyan-200 border border-cyan-400/40'
                          : 'text-slate-400 hover:text-slate-100 border border-transparent'
                      }`}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={onToggleSatelliteMode}
                aria-pressed={satelliteMode}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border whitespace-nowrap shrink-0 transition-colors ${
                  satelliteMode
                    ? 'bg-amber-500/20 text-amber-200 border-amber-400/45 hover:bg-amber-500/30'
                    : 'bg-[#050a15] text-slate-300 border-slate-800 hover:border-slate-700 hover:text-white'
                }`}
              >
                <Satellite className="w-3.5 h-3.5" />
                <span>Satellite Mode</span>
              </button>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => onZoomStep(0.35)}
                className="p-1.5 rounded-md bg-slate-800/90 hover:bg-slate-700 text-slate-200 transition-colors"
                title="Zoom out"
                aria-label="Zoom out"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => onZoomStep(-0.35)}
                className="p-1.5 rounded-md bg-slate-800/90 hover:bg-slate-700 text-slate-200 transition-colors"
                title="Zoom in"
                aria-label="Zoom in"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Scale-Specific Quick Explorer Strip */}
          {cosmicScale === 'earth' && (
            <>
              {satelliteMode ? (
                <div className="flex items-center gap-1 overflow-x-auto custom-scrollbar pb-0.5">
                  <button
                    type="button"
                    onClick={() => onTrackSatellite(null)}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
                      trackedSatelliteId === null
                        ? 'bg-amber-500/20 text-amber-200 border border-amber-400/40'
                        : 'text-slate-300 hover:text-white hover:bg-slate-800/80 border border-transparent'
                    }`}
                  >
                    Free Orbit
                  </button>
                  {SATELLITES.map((sat) => {
                    const active = trackedSatelliteId === sat.id;
                    return (
                      <button
                        key={sat.id}
                        type="button"
                        onClick={() => onTrackSatellite(sat.id)}
                        className={`px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
                          active
                            ? 'bg-amber-500/20 text-amber-200 border border-amber-400/40'
                            : 'text-slate-300 hover:text-white hover:bg-slate-800/80 border border-transparent'
                        }`}
                      >
                        {sat.shortName}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="flex items-center gap-1 overflow-x-auto custom-scrollbar pb-0.5">
                  <button
                    type="button"
                    onClick={() => onSelectContinent(null)}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
                      activeContinent === null
                        ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-400/35'
                        : 'text-slate-300 hover:text-white hover:bg-slate-800/80 border border-transparent'
                    }`}
                  >
                    Global
                  </button>
                  {CONTINENTS.map((c) => {
                    const shortLabel =
                      c.name === 'North America'
                        ? 'N. America'
                        : c.name === 'South America'
                          ? 'S. America'
                          : c.name;
                    const active = activeContinent === c.id;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => onSelectContinent(c)}
                        className={`px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
                          active
                            ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-400/35'
                            : 'text-slate-300 hover:text-white hover:bg-slate-800/80 border border-transparent'
                        }`}
                      >
                        {shortLabel}
                      </button>
                    );
                  })}
                </div>
              )}

              <div className="flex items-center gap-1 flex-wrap pt-1 border-t border-slate-800/80">
                {earthLayers.map((item) => {
                  const active = layers[item.key];
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => onToggleLayer(item.key)}
                      aria-pressed={active}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-medium whitespace-nowrap shrink-0 transition-colors ${
                        active
                          ? 'bg-slate-800 text-cyan-300 border border-cyan-500/35'
                          : 'text-slate-400 hover:text-slate-200 border border-transparent'
                      }`}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {cosmicScale === 'solar' && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1 overflow-x-auto custom-scrollbar pb-0.5">
                {solarQuickBodies.map((body) => (
                  <button
                    key={body.id}
                    type="button"
                    onClick={() => onSelectCosmicBody(body)}
                    className="px-2.5 py-1 rounded-md text-xs font-medium text-slate-300 hover:text-cyan-200 hover:bg-slate-800/80 whitespace-nowrap shrink-0 transition-colors"
                  >
                    {body.name}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2 pt-1 border-t border-slate-800/80">
                <button
                  type="button"
                  onClick={() => onToggleLayer('orbits')}
                  aria-pressed={layers.orbits}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-medium whitespace-nowrap transition-colors ${
                    layers.orbits
                      ? 'bg-slate-800 text-cyan-300 border border-cyan-500/35'
                      : 'text-slate-400 hover:text-slate-200 border border-transparent'
                  }`}
                >
                  Orbit Paths
                </button>
                <button
                  type="button"
                  onClick={onToggleOrbitsPaused}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium bg-slate-800/90 hover:bg-slate-700 text-slate-200 transition-colors whitespace-nowrap"
                >
                  {orbitsPaused ? <Play className="w-3 h-3 text-cyan-300" /> : <Pause className="w-3 h-3 text-cyan-300" />}
                  <span>{orbitsPaused ? 'Resume Orbits' : 'Pause Orbits'}</span>
                </button>
              </div>
            </div>
          )}

          {cosmicScale === 'galaxy' && (
            <div className="flex items-center gap-1 overflow-x-auto custom-scrollbar pb-0.5">
              {GALAXY_REGIONS.map((reg) => (
                <button
                  key={reg.id}
                  type="button"
                  onClick={() => onSelectCosmicBody(reg)}
                  className="px-2.5 py-1 rounded-md text-xs font-medium text-slate-300 hover:text-cyan-200 hover:bg-slate-800/80 whitespace-nowrap shrink-0 transition-colors"
                >
                  {reg.name.split(' · ')[0]}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
