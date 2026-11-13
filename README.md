# Orbital Gesture Earth

Interactive 3D Earth globe controlled in real time via webcam AI hand gesture recognition (MediaPipe Hands), mouse, and touch.

## Project Structure

- `src/App.tsx` — Root application orchestrating the WebGL globe, MediaPipe gesture tracking, location search, and telemetry HUD
- `src/three/EarthScene.ts` — Three.js 3D planetary renderer with day/night terminator shader, city lights, clouds, Fresnel atmosphere, country borders, starfield, raycasting, and inertial 360° quaternion controls
- `src/three/earthTextures.ts` — Procedural 4K equirectangular texture synthesizer aligned with Natural Earth coastlines and major city clusters
- `src/vision/HandGestureEngine.ts` — Real-time MediaPipe `HandLandmarker` pipeline with EMA smoothing, skeleton overlay, calibration, and 12 hand gestures
- `src/data/worldGeoData.ts` — World country polygons (`world-atlas`), continents, oceans, major cities, search, and point-in-polygon lookup
- `src/components/` — `TopTelemetryBar`, `WebcamGesturePanel`, `BottomControlDock`, `LocationDossier`, and `GestureHelpModal`
- `public/mediapipe/` — Local MediaPipe WASM runtime and `hand_landmarker.task` model

## Installation & Running

```bash
npm install
npm run dev
```

Open the app in a modern desktop or mobile browser and click **Gestures ON** (or **Enable Camera**) to grant webcam access.

## Production Build

```bash
npm run build
npm run preview
```
