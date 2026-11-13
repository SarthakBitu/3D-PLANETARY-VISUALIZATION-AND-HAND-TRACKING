import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Search,
  Hand,
  RotateCcw,
  Maximize2,
  Minimize2,
  HelpCircle,
  X,
  MapPin,
  Globe2,
  Waves,
  Orbit,
  Sparkles,
  Satellite,
} from 'lucide-react';
import type { TelemetrySnapshot } from '../three/EarthScene';
import type { CosmicScale } from '../data/cosmosData';
import { searchAllLocations, type SearchableLocation } from '../data/worldGeoData';

interface TopTelemetryBarProps {
  telemetry: TelemetrySnapshot;
  onChangeScale: (scale: CosmicScale) => void;
  satelliteMode: boolean;
  onToggleSatelliteMode: () => void;
  gestureEnabled: boolean;
  onToggleGesture: () => void;
  onResetEarth: () => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  onOpenHelp: () => void;
  onSelectSearchResult: (item: SearchableLocation) => void;
}

function formatLat(lat: number): string {
  return `${Math.abs(lat).toFixed(2)}°${lat >= 0 ? 'N' : 'S'}`;
}

function formatLng(lng: number): string {
  return `${Math.abs(lng).toFixed(2)}°${lng >= 0 ? 'E' : 'W'}`;
}

export const TopTelemetryBar: React.FC<TopTelemetryBarProps> = ({
  telemetry,
  onChangeScale,
  satelliteMode,
  onToggleSatelliteMode,
  gestureEnabled,
  onToggleGesture,
  onResetEarth,
  isFullscreen,
  onToggleFullscreen,
  onOpenHelp,
  onSelectSearchResult,
}) => {
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const searchWrapRef = useRef<HTMLDivElement | null>(null);

  const results = useMemo(() => searchAllLocations(query), [query]);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (searchWrapRef.current && !searchWrapRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const handlePick = (item: SearchableLocation) => {
    onSelectSearchResult(item);
    setQuery(item.name);
    setSearchOpen(false);
  };

  const isEarthScale = telemetry.scale === 'earth';

  return (
    <header className="fixed top-0 left-0 right-0 z-40 px-3 md:px-5 pt-3 pointer-events-none">
      <div className="mx-auto max-w-[1440px] flex flex-wrap lg:flex-nowrap items-center justify-between gap-3 px-4 py-2.5 rounded-xl bg-[#080f1f]/90 border border-cyan-500/20 shadow-xl pointer-events-auto">
        {/* Brand Wordmark */}
        <div className="flex items-center gap-4 shrink-0">
          <span className="font-display text-base md:text-lg font-bold tracking-tight text-slate-100 whitespace-nowrap">
            Orbital Earth
          </span>
        </div>

        {/* Live Adaptive Cosmic / Earth Telemetry */}
        <div className="hidden md:flex items-center gap-4 text-xs border-x border-slate-800/90 px-4 min-w-0">
          <div className="flex items-center gap-2 whitespace-nowrap">
            <span className="text-slate-400">{isEarthScale ? 'Coord' : 'Scale'}</span>
            <span className="font-mono-tabular text-cyan-300 font-medium">
              {isEarthScale
                ? `${formatLat(telemetry.lat)} / ${formatLng(telemetry.lng)}`
                : telemetry.scale === 'solar'
                  ? 'Solar System'
                  : 'Milky Way'}
            </span>
          </div>

          <span className="text-slate-700" aria-hidden="true">·</span>

          <div className="flex items-center gap-2 min-w-0 max-w-[260px]">
            <span className="text-slate-400 shrink-0">
              {telemetry.trackedSatelliteName ? 'Ground Track' : 'Target'}
            </span>
            <span className="text-slate-100 font-medium truncate">
              {telemetry.trackedSatelliteName
                ? `${telemetry.trackedSatelliteName} · ${telemetry.locationName}`
                : telemetry.locationName}
            </span>
          </div>

          <span className="text-slate-700" aria-hidden="true">·</span>

          <div className="flex items-center gap-1.5 whitespace-nowrap">
            <span className="text-slate-400">{isEarthScale ? 'Zoom' : 'Span'}</span>
            <span className="font-mono-tabular text-cyan-300 font-semibold">
              {telemetry.distanceReadout}
            </span>
          </div>
        </div>

        {/* Search & Action Controls */}
        <div className="flex items-center gap-2 flex-1 lg:flex-initial justify-end min-w-0">
          <div ref={searchWrapRef} className="relative flex-1 max-w-[260px] min-w-[160px]">
            <div className="relative flex items-center">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 pointer-events-none" />
              <input
                type="text"
                value={query}
                onFocus={() => setSearchOpen(true)}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setSearchOpen(true);
                }}
                placeholder="Search satellites, planets, cities..."
                aria-label="Search satellites, planets, countries, cities, and galactic regions"
                className="w-full pl-8 pr-7 py-1.5 rounded-lg bg-[#050a15] border border-slate-700/80 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-cyan-400 transition-colors"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => {
                    setQuery('');
                    setSearchOpen(true);
                  }}
                  className="absolute right-2 text-slate-400 hover:text-slate-200"
                  aria-label="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {searchOpen && (
              <div className="absolute left-0 right-0 mt-2 max-h-72 overflow-y-auto custom-scrollbar rounded-xl bg-[#081022] border border-cyan-500/30 shadow-2xl py-1.5 z-50">
                {results.length === 0 ? (
                  <div className="px-3 py-4 text-xs text-slate-400 text-center">
                    No matching planets, countries, or cities
                  </div>
                ) : (
                  results.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handlePick(item)}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-cyan-500/15 transition-colors"
                    >
                      {item.type === 'satellite' ? (
                        <Satellite className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                      ) : item.type === 'city' ? (
                        <MapPin className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                      ) : item.type === 'ocean' ? (
                        <Waves className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                      ) : item.type === 'cosmic' ? (
                        item.cosmicBody?.scale === 'galaxy' ? (
                          <Sparkles className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                        ) : (
                          <Orbit className="w-3.5 h-3.5 text-cyan-300 shrink-0" />
                        )
                      ) : (
                        <Globe2 className="w-3.5 h-3.5 text-cyan-300 shrink-0" />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-medium text-slate-100 truncate">
                          {item.name}
                        </div>
                        <div className="text-[11px] text-slate-400 truncate">
                          {item.subtitle}
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={onToggleSatelliteMode}
            aria-pressed={satelliteMode}
            className={`hidden xl:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 ${
              satelliteMode
                ? 'bg-amber-500/20 border-amber-400/50 text-amber-200 hover:bg-amber-500/30'
                : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-700/80'
            }`}
            title="Toggle orbital satellite constellation"
          >
            <Satellite className="w-3.5 h-3.5" />
            <span>Satellites</span>
          </button>

          <button
            type="button"
            onClick={onToggleGesture}
            aria-pressed={gestureEnabled}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 ${
              gestureEnabled
                ? 'bg-cyan-500/20 border-cyan-400/50 text-cyan-200 hover:bg-cyan-500/30'
                : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-700/80'
            }`}
          >
            <Hand className="w-3.5 h-3.5" />
            <span>Gestures {gestureEnabled ? 'ON' : 'OFF'}</span>
          </button>

          <button
            type="button"
            onClick={onResetEarth}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700 text-slate-200 hover:bg-slate-700/80 text-xs font-medium transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
            title="Reset current view"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Reset</span>
          </button>

          <button
            type="button"
            onClick={onToggleFullscreen}
            className="p-2 rounded-lg bg-slate-800/80 border border-slate-700 text-slate-200 hover:bg-slate-700/80 transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
            title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
            aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>

          <button
            type="button"
            onClick={onOpenHelp}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700 text-slate-200 hover:bg-slate-700/80 text-xs font-medium transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
            title="Gesture & control guide"
          >
            <HelpCircle className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden sm:inline">Help</span>
          </button>
        </div>
      </div>

      {/* Mobile / Tablet Compact Scale & Telemetry Sub-line */}
      <div className="lg:hidden mx-auto mt-1.5 flex flex-wrap items-center justify-center gap-2 px-3 py-1.5 rounded-lg bg-[#080f1f]/90 border border-slate-800 text-[11px] pointer-events-auto">
        <div className="flex items-center gap-1">
          {(
            [
              { id: 'earth', label: 'Earth' },
              { id: 'solar', label: 'Solar System' },
              { id: 'galaxy', label: 'Milky Way' },
            ] as Array<{ id: CosmicScale; label: string }>
          ).map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => onChangeScale(s.id)}
              className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                telemetry.scale === s.id
                  ? 'bg-cyan-500/25 text-cyan-200 border border-cyan-400/40'
                  : 'text-slate-400 hover:text-slate-100'
              }`}
            >
              {s.label}
            </button>
          ))}
          <button
            type="button"
            onClick={onToggleSatelliteMode}
            aria-pressed={satelliteMode}
            className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
              satelliteMode
                ? 'bg-amber-500/25 text-amber-200 border border-amber-400/40'
                : 'text-slate-400 hover:text-slate-100'
            }`}
          >
            Satellites
          </button>
        </div>
        <span className="text-slate-700 md:hidden" aria-hidden="true">|</span>
        <div className="flex md:hidden items-center gap-2 font-mono-tabular">
          <span className="text-slate-200 truncate max-w-[120px]">{telemetry.locationName}</span>
          <span className="text-slate-600">·</span>
          <span className="text-cyan-300">{telemetry.distanceReadout}</span>
        </div>
      </div>
    </header>
  );
};
