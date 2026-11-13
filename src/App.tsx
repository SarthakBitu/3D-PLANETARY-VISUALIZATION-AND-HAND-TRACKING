/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  DEFAULT_CAMERA_DIST,
  EarthScene,
  type EarthLayerVisibility,
  type ProjectedCityLabel,
  type ProjectedCosmicLabel,
  type ProjectedSatelliteLabel,
  type TelemetrySnapshot,
} from './three/EarthScene';
import {
  HandGestureEngine,
  type GestureCalibration,
  type GestureOutput,
} from './vision/HandGestureEngine';
import {
  findCountryAtLatLng,
  getSuggestedZoomForCountry,
  type ContinentInfo,
  type SearchableLocation,
} from './data/worldGeoData';
import type { CelestialBodyInfo, CosmicScale } from './data/cosmosData';
import { TopTelemetryBar } from './components/TopTelemetryBar';
import { WebcamGesturePanel } from './components/WebcamGesturePanel';
import {
  LocationDossier,
  type SelectedLocationState,
} from './components/LocationDossier';
import { BottomControlDock } from './components/BottomControlDock';
import { GestureHelpModal } from './components/GestureHelpModal';

export default function App() {
  const globeContainerRef = useRef<HTMLDivElement | null>(null);
  const earthSceneRef = useRef<EarthScene | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const gestureEngineRef = useRef<HandGestureEngine | null>(null);

  const [cosmicScale, setCosmicScale] = useState<CosmicScale>('earth');
  const [satelliteMode, setSatelliteMode] = useState(false);
  const [trackedSatelliteId, setTrackedSatelliteId] = useState<string | null>(null);
  const [telemetry, setTelemetry] = useState<TelemetrySnapshot>({
    scale: 'earth',
    satelliteMode: false,
    trackedSatelliteName: null,
    lat: 28.0,
    lng: -32.0,
    zoomPercent: 162,
    zoomDistance: DEFAULT_CAMERA_DIST,
    locationName: 'Atlantic Ocean',
    locationRegion: 'International Waters',
    distanceReadout: '162%',
    isLand: false,
    hoveredCountry: null,
  });

  const [cityLabels, setCityLabels] = useState<ProjectedCityLabel[]>([]);
  const [cosmicLabels, setCosmicLabels] = useState<ProjectedCosmicLabel[]>([]);
  const [satelliteLabels, setSatelliteLabels] = useState<ProjectedSatelliteLabel[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<SelectedLocationState | null>(null);
  const [activeContinent, setActiveContinent] = useState<string | null>(null);
  const [orbitsPaused, setOrbitsPaused] = useState(false);

  const [layers, setLayers] = useState<EarthLayerVisibility>({
    borders: true,
    cities: true,
    clouds: true,
    dayNight: true,
    graticule: false,
    orbits: true,
  });

  const [gestureEnabled, setGestureEnabled] = useState(false);
  const [gestureOutput, setGestureOutput] = useState<GestureOutput>({
    status: 'off',
    gestureName: 'Gesture Control Off',
    gestureDetail: 'Mouse & touch controls active',
    handsCount: 0,
    confidence: 0,
  });
  const [calibration, setCalibration] = useState<GestureCalibration>({
    sensitivity: 1.0,
    deadzone: 0.006,
  });

  const [helpOpen, setHelpOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [webglLost, setWebglLost] = useState(false);

  useEffect(() => {
    const container = globeContainerRef.current;
    if (!container) return;

    const scene = new EarthScene(container, {
      onTelemetry: (snap) => {
        setTelemetry(snap);
        if (!snap.trackedSatelliteName) {
          setTrackedSatelliteId((prev) => (prev !== null ? null : prev));
        }
      },
      onCityLabelsUpdate: (labels) => setCityLabels(labels),
      onCosmicLabelsUpdate: (labels) => setCosmicLabels(labels),
      onSatelliteLabelsUpdate: (labels) => setSatelliteLabels(labels),
      onWebGLContextError: (lost) => setWebglLost(lost),
      onScaleChanged: (nextScale) => {
        setCosmicScale(nextScale);
        if (nextScale !== 'earth') {
          setActiveContinent(null);
          setTrackedSatelliteId(null);
        }
      },
      onSatelliteModeChanged: (enabled) => {
        setSatelliteMode(enabled);
        if (!enabled) {
          setTrackedSatelliteId(null);
        }
      },
      onSelectCountry: (country) => {
        if (country) {
          setActiveContinent(country.metadata.continent);
          setSelectedLocation({ kind: 'country', country });
        } else {
          setSelectedLocation(null);
        }
      },
      onSelectCity: (city) => {
        setActiveContinent(city.continent);
        setSelectedLocation({ kind: 'city', city });
      },
      onSelectCosmicBody: (body) => {
        setSelectedLocation({ kind: 'cosmic', cosmic: body });
      },
      onSelectSatellite: (sat) => {
        if (sat) {
          setTrackedSatelliteId(sat.id);
          setSelectedLocation({ kind: 'satellite', satellite: sat });
        } else {
          setTrackedSatelliteId(null);
        }
      },
    });

    earthSceneRef.current = scene;
    return () => {
      scene.dispose();
      earthSceneRef.current = null;
    };
  }, []);

  useEffect(() => {
    const videoEl = videoRef.current;
    const canvasEl = overlayCanvasRef.current;
    if (!videoEl || !canvasEl) return;

    const engine = new HandGestureEngine(
      videoEl,
      canvasEl,
      {
        applyDragRotate: (dy, dp) => earthSceneRef.current?.applyDragRotate(dy, dp),
        applySwipeImpulse: (vx, vy) => earthSceneRef.current?.applySwipeImpulse(vx, vy),
        setContinuousSpin: (s) => earthSceneRef.current?.setContinuousSpin(s),
        applyZoomDelta: (dz) => earthSceneRef.current?.applyZoomDelta(dz),
        stopMotion: () => earthSceneRef.current?.stopMotion(),
        setGesturePaused: (p) => earthSceneRef.current?.setGesturePaused(p),
      },
      (output) => {
        setGestureOutput(output);
        if (
          output.status === 'camera_denied' ||
          output.status === 'camera_unavailable' ||
          output.status === 'model_error'
        ) {
          setGestureEnabled(false);
        }
      }
    );

    gestureEngineRef.current = engine;
    return () => {
      engine.dispose();
      gestureEngineRef.current = null;
    };
  }, []);

  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  const handleToggleGesture = useCallback(async () => {
    const engine = gestureEngineRef.current;
    if (!engine) return;
    if (gestureEnabled) {
      engine.stop();
      setGestureEnabled(false);
      earthSceneRef.current?.setGesturePaused(false);
    } else {
      setGestureEnabled(true);
      await engine.start();
    }
  }, [gestureEnabled]);

  const handleChangeCalibration = useCallback((next: Partial<GestureCalibration>) => {
    setCalibration((prev) => {
      const merged = { ...prev, ...next };
      gestureEngineRef.current?.setCalibration(merged);
      return merged;
    });
  }, []);

  const handleRecalibrate = useCallback(() => {
    gestureEngineRef.current?.resetTrackingBuffers();
    earthSceneRef.current?.stopMotion();
  }, []);

  const handleToggleFullscreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {
      // Ignore fullscreen denial in restricted iframe contexts
    }
  }, []);

  const handleResetView = useCallback(() => {
    setActiveContinent(null);
    setTrackedSatelliteId(null);
    setSelectedLocation(null);
    earthSceneRef.current?.resetView();
  }, []);

  const handleChangeScale = useCallback((nextScale: CosmicScale) => {
    setCosmicScale(nextScale);
    setSelectedLocation(null);
    setActiveContinent(null);
    if (nextScale !== 'earth') {
      setTrackedSatelliteId(null);
    }
    earthSceneRef.current?.setCosmicScale(nextScale);
  }, []);

  const handleToggleSatelliteMode = useCallback(() => {
    const scene = earthSceneRef.current;
    if (!scene) return;
    const next = !satelliteMode;
    scene.setSatelliteMode(next);
    if (!next && selectedLocation?.kind === 'satellite') {
      setSelectedLocation(null);
    }
  }, [satelliteMode, selectedLocation]);

  const handleTrackSatellite = useCallback((satId: string | null) => {
    earthSceneRef.current?.trackSatellite(satId);
    if (!satId) {
      setTrackedSatelliteId(null);
    }
  }, []);

  const handleToggleLayer = useCallback((key: keyof EarthLayerVisibility) => {
    setLayers((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      earthSceneRef.current?.setLayers(next);
      return next;
    });
  }, []);

  const handleToggleOrbitsPaused = useCallback(() => {
    setOrbitsPaused((prev) => {
      const next = !prev;
      earthSceneRef.current?.setSolarOrbitsPaused(next);
      return next;
    });
  }, []);

  const handleSelectContinent = useCallback((continent: ContinentInfo | null) => {
    const scene = earthSceneRef.current;
    if (!scene) return;
    if (!continent) {
      setActiveContinent(null);
      setSelectedLocation(null);
      scene.highlightCountry(null);
      scene.highlightCity(null);
      scene.flyToLatLng(24, 10, DEFAULT_CAMERA_DIST);
      return;
    }
    setCosmicScale('earth');
    setActiveContinent(continent.id);
    setSelectedLocation({ kind: 'continent', continent });
    scene.highlightCountry(null);
    scene.highlightCity(null);
    scene.flyToLatLng(continent.lat, continent.lng, continent.zoomDistance);
  }, []);

  const handleSelectCosmicBody = useCallback((body: CelestialBodyInfo) => {
    setCosmicScale(body.scale);
    setSelectedLocation({ kind: 'cosmic', cosmic: body });
    earthSceneRef.current?.focusCosmicBody(body);
  }, []);

  const handleSelectSearchResult = useCallback(
    (item: SearchableLocation) => {
      const scene = earthSceneRef.current;
      if (!scene) return;

      if (item.type === 'satellite' && item.satelliteInfo) {
        scene.trackSatellite(item.satelliteInfo.id);
        return;
      }

      if (item.type === 'cosmic' && item.cosmicBody) {
        handleSelectCosmicBody(item.cosmicBody);
        return;
      }

      setCosmicScale('earth');
      if (item.type === 'country' && item.countryRecord) {
        setActiveContinent(item.countryRecord.metadata.continent);
        setSelectedLocation({ kind: 'country', country: item.countryRecord });
        scene.highlightCity(null);
        scene.highlightCountry(item.countryRecord);
        scene.flyToLatLng(item.lat, item.lng, item.zoomDistance);
      } else if (item.type === 'city' && item.cityInfo) {
        const country = findCountryAtLatLng(item.cityInfo.lat, item.cityInfo.lng);
        setActiveContinent(item.cityInfo.continent);
        setSelectedLocation({ kind: 'city', city: item.cityInfo });
        scene.highlightCountry(country);
        scene.highlightCity(item.cityInfo);
        scene.flyToLatLng(item.lat, item.lng, item.zoomDistance);
      } else if (item.type === 'continent' && item.continentInfo) {
        handleSelectContinent(item.continentInfo);
      } else {
        setActiveContinent(null);
        setSelectedLocation(null);
        scene.highlightCountry(null);
        scene.highlightCity(null);
        scene.flyToLatLng(item.lat, item.lng, item.zoomDistance);
      }
    },
    [handleSelectContinent, handleSelectCosmicBody]
  );

  const handleZoomToSelected = useCallback(() => {
    const scene = earthSceneRef.current;
    if (!scene || !selectedLocation) return;

    if (selectedLocation.kind === 'cosmic' && selectedLocation.cosmic) {
      scene.focusCosmicBody(selectedLocation.cosmic);
    } else if (selectedLocation.kind === 'city' && selectedLocation.city) {
      scene.flyToLatLng(selectedLocation.city.lat, selectedLocation.city.lng, 1.28);
    } else if (selectedLocation.kind === 'country' && selectedLocation.country) {
      const dist = Math.max(1.26, getSuggestedZoomForCountry(selectedLocation.country) - 0.25);
      scene.flyToLatLng(selectedLocation.country.lat, selectedLocation.country.lng, dist);
    } else if (selectedLocation.kind === 'continent' && selectedLocation.continent) {
      scene.flyToLatLng(
        selectedLocation.continent.lat,
        selectedLocation.continent.lng,
        Math.max(1.55, selectedLocation.continent.zoomDistance - 0.35)
      );
    }
  }, [selectedLocation]);

  const handleClearSelection = useCallback(() => {
    setSelectedLocation(null);
    setTrackedSatelliteId(null);
    earthSceneRef.current?.trackSatellite(null);
    earthSceneRef.current?.highlightCountry(null);
    earthSceneRef.current?.highlightCity(null);
  }, []);

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-[#03060e]">
      {/* Isolated Full-Viewport WebGL Container */}
      <div
        ref={globeContainerRef}
        className="absolute inset-0 w-full h-full cursor-grab active:cursor-grabbing"
        aria-label="Interactive 3D Earth, Solar System, and Milky Way Galaxy"
      />

      {webglLost && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-[#050811]/95 text-center p-6">
          <h2 className="font-display text-xl font-semibold text-cyan-300 mb-2">
            3D Graphics Context Suspended
          </h2>
          <p className="text-sm text-slate-300 max-w-md">
            Your browser temporarily reclaimed the WebGL context. Reload or restore graphics hardware acceleration to resume rendering.
          </p>
        </div>
      )}

      {/* Subtle Center Reticle in Earth Orbit mode */}
      {cosmicScale === 'earth' && (
        <div
          className="pointer-events-none fixed inset-0 flex items-center justify-center z-10"
          aria-hidden="true"
        >
          <div className="relative w-9 h-9">
            <span className="absolute top-0 left-1/2 -translate-x-1/2 w-[1px] h-2 bg-cyan-400/45" />
            <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[1px] h-2 bg-cyan-400/45" />
            <span className="absolute left-0 top-1/2 -translate-y-1/2 h-[1px] w-2 bg-cyan-400/45" />
            <span className="absolute right-0 top-1/2 -translate-y-1/2 h-[1px] w-2 bg-cyan-400/45" />
            <span className="absolute inset-3 rounded-full border border-cyan-400/30" />
          </div>
        </div>
      )}

      {/* Projected 3D Earth City Labels */}
      <div className="pointer-events-none fixed inset-0 z-10 overflow-hidden">
        {cityLabels.map(({ city, x, y, isSelected }) => (
          <button
            key={city.id}
            type="button"
            onClick={() => {
              const country = findCountryAtLatLng(city.lat, city.lng);
              setActiveContinent(city.continent);
              setSelectedLocation({ kind: 'city', city });
              earthSceneRef.current?.highlightCountry(country);
              earthSceneRef.current?.highlightCity(city);
              earthSceneRef.current?.flyToLatLng(city.lat, city.lng, 1.38);
            }}
            style={{
              transform: `translate3d(${Math.round(x)}px, ${Math.round(y)}px, 0) translate(8px, -50%)`,
            }}
            className={`pointer-events-auto absolute top-0 left-0 px-1.5 py-0.5 rounded text-[11px] font-medium whitespace-nowrap transition-colors ${
              isSelected
                ? 'bg-cyan-500/25 border border-cyan-300/60 text-cyan-100'
                : 'bg-[#070d1b]/75 border border-slate-700/70 text-slate-200 hover:border-cyan-400/60 hover:text-cyan-200'
            }`}
          >
            {city.name}
          </button>
        ))}

        {/* Projected Orbital Satellite Labels */}
        {satelliteLabels.map(({ satellite, x, y, isSelected }) => (
          <button
            key={satellite.id}
            type="button"
            onClick={() => handleTrackSatellite(satellite.id)}
            style={{
              transform: `translate3d(${Math.round(x)}px, ${Math.round(y)}px, 0) translate(10px, -50%)`,
            }}
            className={`pointer-events-auto absolute top-0 left-0 px-2 py-0.5 rounded text-[11px] font-medium whitespace-nowrap transition-colors ${
              isSelected
                ? 'bg-amber-500/30 border border-amber-300/75 text-amber-100'
                : 'bg-[#081124]/85 border border-amber-400/35 text-amber-200 hover:border-amber-300 hover:text-white'
            }`}
          >
            {satellite.shortName}
          </button>
        ))}

        {/* Projected Solar System & Milky Way Labels */}
        {cosmicLabels.map(({ body, x, y, isSelected }) => (
          <button
            key={body.id}
            type="button"
            onClick={() => handleSelectCosmicBody(body)}
            style={{
              transform: `translate3d(${Math.round(x)}px, ${Math.round(y)}px, 0) translate(-50%, -100%)`,
            }}
            className={`pointer-events-auto absolute top-0 left-0 px-2 py-0.5 rounded text-[11px] font-medium whitespace-nowrap transition-colors ${
              isSelected
                ? 'bg-cyan-500/30 border border-cyan-300/70 text-cyan-100'
                : 'bg-[#070d1b]/80 border border-slate-700/75 text-slate-200 hover:border-cyan-400/60 hover:text-cyan-200'
            }`}
          >
            {body.name.split(' · ')[0]}
          </button>
        ))}
      </div>

      {/* Top HUD Telemetry & Search Bar */}
      <TopTelemetryBar
        telemetry={telemetry}
        onChangeScale={handleChangeScale}
        satelliteMode={satelliteMode}
        onToggleSatelliteMode={handleToggleSatelliteMode}
        gestureEnabled={gestureEnabled}
        onToggleGesture={handleToggleGesture}
        onResetEarth={handleResetView}
        isFullscreen={isFullscreen}
        onToggleFullscreen={handleToggleFullscreen}
        onOpenHelp={() => setHelpOpen(true)}
        onSelectSearchResult={handleSelectSearchResult}
      />

      {/* Floating Webcam & AI Hand Gesture Panel */}
      <WebcamGesturePanel
        videoRef={videoRef}
        canvasRef={overlayCanvasRef}
        gestureEnabled={gestureEnabled}
        onToggleGesture={handleToggleGesture}
        gestureOutput={gestureOutput}
        calibration={calibration}
        onChangeCalibration={handleChangeCalibration}
        onRecalibrate={handleRecalibrate}
      />

      {/* Unified Collapsible Cosmic & Earth Explorer Dock */}
      <BottomControlDock
        cosmicScale={cosmicScale}
        onChangeScale={handleChangeScale}
        satelliteMode={satelliteMode}
        onToggleSatelliteMode={handleToggleSatelliteMode}
        trackedSatelliteId={trackedSatelliteId}
        onTrackSatellite={handleTrackSatellite}
        activeContinent={activeContinent}
        onSelectContinent={handleSelectContinent}
        onSelectCosmicBody={handleSelectCosmicBody}
        layers={layers}
        onToggleLayer={handleToggleLayer}
        orbitsPaused={orbitsPaused}
        onToggleOrbitsPaused={handleToggleOrbitsPaused}
        onZoomStep={(delta) => earthSceneRef.current?.applyZoomDelta(delta)}
      />

      {/* Selected Location / Planet / Galactic / Satellite Dossier */}
      <LocationDossier
        selected={selectedLocation}
        isTrackingSatellite={
          selectedLocation?.kind === 'satellite' &&
          trackedSatelliteId === selectedLocation.satellite?.id
        }
        onToggleTrackSatellite={() => {
          if (selectedLocation?.kind === 'satellite' && selectedLocation.satellite) {
            const isCurrentlyLocked = trackedSatelliteId === selectedLocation.satellite.id;
            handleTrackSatellite(isCurrentlyLocked ? null : selectedLocation.satellite.id);
          }
        }}
        onZoomIn={handleZoomToSelected}
        onEnterEarthOrbit={() => handleChangeScale('earth')}
        onEnterSolarSystem={() => handleChangeScale('solar')}
        onClear={handleClearSelection}
      />

      {/* Gesture Help Modal */}
      <GestureHelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />
    </main>
  );
}
