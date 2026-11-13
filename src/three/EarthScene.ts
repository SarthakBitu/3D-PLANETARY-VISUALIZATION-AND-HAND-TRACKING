import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  CountryRecord,
  CityInfo,
  MAJOR_CITIES,
  findCountryAtLatLng,
  findOceanAtLatLng,
  getCountries,
} from '../data/worldGeoData';
import {
  CelestialBodyInfo,
  CosmicScale,
  GALAXY_REGIONS,
  SOLAR_BODIES,
} from '../data/cosmosData';
import { SATELLITES, type SatelliteInfo } from '../data/satelliteData';
import { createEarthTextures, EarthTextureSet } from './earthTextures';
import { createCelestialTextures, CelestialTexturePack } from './celestialTextures';
import { buildCompositeSatelliteMesh } from './satelliteModels';

export interface ProjectedCityLabel {
  city: CityInfo;
  x: number;
  y: number;
  isSelected: boolean;
}

export interface ProjectedCosmicLabel {
  body: CelestialBodyInfo;
  x: number;
  y: number;
  isSelected: boolean;
}

export interface ProjectedSatelliteLabel {
  satellite: SatelliteInfo;
  x: number;
  y: number;
  isSelected: boolean;
}

export interface TelemetrySnapshot {
  scale: CosmicScale;
  satelliteMode: boolean;
  trackedSatelliteName: string | null;
  lat: number;
  lng: number;
  zoomPercent: number;
  zoomDistance: number;
  locationName: string;
  locationRegion: string;
  distanceReadout: string;
  isLand: boolean;
  hoveredCountry: CountryRecord | null;
}

export interface EarthLayerVisibility {
  borders: boolean;
  cities: boolean;
  clouds: boolean;
  dayNight: boolean;
  graticule: boolean;
  orbits: boolean;
}

export interface EarthSceneCallbacks {
  onTelemetry?: (snapshot: TelemetrySnapshot) => void;
  onSelectCountry?: (country: CountryRecord | null, lat: number, lng: number) => void;
  onSelectCity?: (city: CityInfo) => void;
  onSelectCosmicBody?: (body: CelestialBodyInfo) => void;
  onSelectSatellite?: (sat: SatelliteInfo | null) => void;
  onScaleChanged?: (scale: CosmicScale) => void;
  onSatelliteModeChanged?: (enabled: boolean) => void;
  onCityLabelsUpdate?: (labels: ProjectedCityLabel[]) => void;
  onCosmicLabelsUpdate?: (labels: ProjectedCosmicLabel[]) => void;
  onSatelliteLabelsUpdate?: (labels: ProjectedSatelliteLabel[]) => void;
  onWebGLContextError?: (lost: boolean) => void;
}

const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;

export const MIN_CAMERA_DIST = 1.22;
export const MAX_CAMERA_DIST = 3.85;
export const DEFAULT_CAMERA_DIST = 2.75;

const MIN_SOLAR_DIST = 1.1;
export const DEFAULT_SOLAR_DIST = 28.0;
const MAX_SOLAR_DIST = 66.0;

const MIN_GALAXY_DIST = 6.5;
export const DEFAULT_GALAXY_DIST = 24.0;
const MAX_GALAXY_DIST = 52.0;

const WORLD_UP = new THREE.Vector3(0, 1, 0);
const WORLD_RIGHT = new THREE.Vector3(1, 0, 0);
const FORWARD_Z = new THREE.Vector3(0, 0, 1);

const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _v3 = new THREE.Vector3();
const _q1 = new THREE.Quaternion();
const _q2 = new THREE.Quaternion();
const _m1 = new THREE.Matrix4();

export function latLngToVector3(lat: number, lng: number, radius = 1, out = new THREE.Vector3()): THREE.Vector3 {
  const phi = (90 - lat) * DEG2RAD;
  const theta = (lng + 180) * DEG2RAD;
  const sinPhi = Math.sin(phi);
  return out.set(
    -radius * sinPhi * Math.cos(theta),
    radius * Math.cos(phi),
    radius * sinPhi * Math.sin(theta)
  );
}

export function vector3ToLatLng(vec: THREE.Vector3): { lat: number; lng: number } {
  const p = _v3.copy(vec).normalize();
  const lat = 90 - Math.acos(THREE.MathUtils.clamp(p.y, -1, 1)) * RAD2DEG;
  let theta = Math.atan2(p.z, -p.x);
  if (theta < 0) theta += Math.PI * 2;
  const lng = theta * RAD2DEG - 180;
  return { lat, lng };
}

export function distanceToZoomPercent(dist: number): number {
  const t = (MAX_CAMERA_DIST - dist) / (MAX_CAMERA_DIST - MIN_CAMERA_DIST);
  const clamped = THREE.MathUtils.clamp(t, 0, 1);
  return Math.round(100 + Math.pow(clamped, 1.35) * 700);
}

export function detectSoftwareWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) || '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return false;
  }
}

interface SolarBodyRuntime {
  info: CelestialBodyInfo;
  group: THREE.Group;
  mesh: THREE.Mesh;
  angle: number;
}

interface GalaxyMarkerRuntime {
  info: CelestialBodyInfo;
  marker: THREE.Mesh;
  localPos: THREE.Vector3;
}

interface SatelliteRuntime {
  info: SatelliteInfo;
  planeGroup: THREE.Group;
  satGroup: THREE.Group;
  phase: number;
}

interface StarlinkRuntime {
  planeRot: THREE.Quaternion;
  radius: number;
  phase: number;
  speed: number;
}

export class EarthScene {
  private container: HTMLElement;
  private callbacks: EarthSceneCallbacks;
  private isSoftwareGl: boolean;

  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private starPoints!: THREE.Points;

  // Stage 1: Earth Orbit Stage + Satellite Constellation
  private earthStage!: THREE.Group;
  private earthGroup!: THREE.Group;
  private earthMesh!: THREE.Mesh;
  private cloudMesh!: THREE.Mesh;
  private atmosphereMesh!: THREE.Mesh;
  private earthOrbitMoonMesh!: THREE.Mesh;
  private bordersLines!: THREE.LineSegments;
  private graticuleLines!: THREE.LineSegments;
  private selectedCountryLines: THREE.LineSegments | null = null;
  private selectedBeaconMesh!: THREE.Mesh;
  private cityInstancedMesh!: THREE.InstancedMesh;
  private sunLight!: THREE.DirectionalLight;

  private satelliteGroup!: THREE.Group;
  private satellites = new Map<string, SatelliteRuntime>();
  private satelliteClickables: THREE.Object3D[] = [];
  private starlinkInstancedMesh!: THREE.InstancedMesh;
  private starlinkRuntimes: StarlinkRuntime[] = [];
  private satelliteMode = false;
  private trackedSatelliteId: string | null = null;

  // Stage 2: Solar System Stage
  private solarStage!: THREE.Group;
  private solarPivot!: THREE.Group;
  private solarContentGroup!: THREE.Group;
  private solarOrbitLinesGroup!: THREE.Group;
  private solarSunLight!: THREE.PointLight;
  private asteroidBeltMesh!: THREE.InstancedMesh;
  private solarBodies = new Map<string, SolarBodyRuntime>();
  private solarClickables: THREE.Mesh[] = [];
  private focusedSolarBodyId: string | null = null;
  private solarCurrentOffset = new THREE.Vector3();
  private solarOrbitsPaused = false;
  private solarOrbitSpeedMultiplier = 1.0;

  // Stage 3: Milky Way Galaxy Stage
  private galaxyStage!: THREE.Group;
  private galaxyPivot!: THREE.Group;
  private galaxyContentGroup!: THREE.Group;
  private galaxyMarkers: GalaxyMarkerRuntime[] = [];
  private galaxyClickables: THREE.Mesh[] = [];
  private focusedGalaxyRegionId: string | null = null;
  private galaxyCurrentOffset = new THREE.Vector3();

  private earthTextures!: EarthTextureSet;
  private celestialTextures!: CelestialTexturePack;

  private earthShaderUniforms = {
    uSunDir: { value: new THREE.Vector3(0.75, 0.25, 0.61).normalize() },
    uNightMap: { value: null as THREE.Texture | null },
    uNightMix: { value: 1.0 },
  };
  private atmosphereUniforms = {
    uSunDir: { value: new THREE.Vector3(0.75, 0.25, 0.61).normalize() },
    uDayNightMix: { value: 1.0 },
  };

  // Scale & Camera Physics
  private activeScale: CosmicScale = 'earth';
  private lastScaleSwitchMs = 0;
  private cameraDist = DEFAULT_CAMERA_DIST;
  private targetCameraDist = DEFAULT_CAMERA_DIST;
  private velYaw = 0;
  private velPitch = 0;
  private continuousSpinVel = 0;
  private autoRotateIdle = true;
  private gesturePaused = false;
  private lastUserInteractionMs = 0;

  private flyTargetQuat: THREE.Quaternion | null = null;
  private flyActive = false;

  // Pointer & touch
  private isPointerDown = false;
  private pointerStartX = 0;
  private pointerStartY = 0;
  private pointerPrevX = 0;
  private pointerPrevY = 0;
  private pointerMovedDist = 0;
  private activePinchDist = 0;

  private raycaster = new THREE.Raycaster();
  private pointerNDC = new THREE.Vector2();
  private selectedCountry: CountryRecord | null = null;
  private selectedCity: CityInfo | null = null;
  private layers: EarthLayerVisibility = {
    borders: true,
    cities: true,
    clouds: true,
    dayNight: true,
    graticule: false,
    orbits: true,
  };

  private frameId = 0;
  private clock = new THREE.Clock();
  private lastTelemetryMs = 0;
  private lastLabelMs = 0;
  private disposed = false;

  constructor(container: HTMLElement, callbacks: EarthSceneCallbacks = {}) {
    this.container = container;
    this.callbacks = callbacks;
    this.isSoftwareGl = detectSoftwareWebGL();
    this.init();
  }

  private init() {
    const width = Math.max(1, this.container.clientWidth);
    const height = Math.max(1, this.container.clientHeight);

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
      alpha: false,
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.renderer.setPixelRatio(this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(width, height);
    this.renderer.setClearColor(0x03060e, 1);

    const canvas = this.renderer.domElement;
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.display = 'block';
    canvas.style.touchAction = 'none';
    this.container.appendChild(canvas);

    canvas.addEventListener('webglcontextlost', this.handleContextLost);
    canvas.addEventListener('webglcontextrestored', this.handleContextRestored);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x03060e);

    const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.28;
    pmremGenerator.dispose();

    this.camera = new THREE.PerspectiveCamera(42, width / height, 0.05, 450);
    this.camera.position.set(0, 0, this.cameraDist);
    this.camera.lookAt(0, 0, 0);

    // Global Lights
    this.sunLight = new THREE.DirectionalLight(0xfff8ed, 2.7);
    this.sunLight.position.set(6, 2.0, 4.9);
    this.scene.add(this.sunLight);
    this.earthShaderUniforms.uSunDir.value.copy(this.sunLight.position).normalize();
    this.atmosphereUniforms.uSunDir.value.copy(this.sunLight.position).normalize();

    const hemiLight = new THREE.HemisphereLight(0x38bdf8, 0x091326, 0.34);
    this.scene.add(hemiLight);

    const rimLight = new THREE.DirectionalLight(0x0ea5e9, 0.48);
    rimLight.position.set(-5, -1.5, -4);
    this.scene.add(rimLight);

    this.buildStarfield();

    // Generate Procedural Texture Packs
    const maxAniso = this.renderer.capabilities.getMaxAnisotropy();
    this.earthTextures = createEarthTextures(maxAniso);
    this.celestialTextures = createCelestialTextures(maxAniso);
    this.earthShaderUniforms.uNightMap.value = this.earthTextures.nightMap;

    // Build all 3 Cosmic Stages
    this.buildEarthStage();
    this.buildSolarStage();
    this.buildGalaxyStage();

    // Start in Earth Orbit stage
    this.setStageVisibility('earth');
    this.setOrientationLatLng(28, -32);

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    this.bindEvents();
    this.clock.start();
    this.tick();
  }

  private buildStarfield() {
    const count = 4200;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const palette = [
      new THREE.Color(0xcbd5e1),
      new THREE.Color(0x93c5fd),
      new THREE.Color(0xfef3c7),
      new THREE.Color(0xe0f2fe),
    ];

    for (let i = 0; i < count; i++) {
      const u = Math.random();
      const v = Math.random();
      const theta = 2 * Math.PI * u;
      const phi = Math.acos(2 * v - 1);
      const r = 110 + Math.random() * 80;

      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.cos(phi);
      positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);

      const c = palette[i % palette.length];
      const brightness = 0.45 + Math.random() * 0.55;
      colors[i * 3] = c.r * brightness;
      colors[i * 3 + 1] = c.g * brightness;
      colors[i * 3 + 2] = c.b * brightness;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const mat = new THREE.PointsMaterial({
      size: 0.34,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      sizeAttenuation: true,
      depthWrite: false,
    });

    this.starPoints = new THREE.Points(geo, mat);
    this.scene.add(this.starPoints);
  }

  // ==================== STAGE 1: HIGH-RES EARTH GLOBE ====================

  private buildEarthStage() {
    this.earthStage = new THREE.Group();
    this.scene.add(this.earthStage);

    this.earthGroup = new THREE.Group();
    this.earthStage.add(this.earthGroup);

    // Earth Surface
    const geo = new THREE.SphereGeometry(1, 96, 64);
    const mat = new THREE.MeshStandardMaterial({
      map: this.earthTextures.dayMap,
      bumpMap: this.earthTextures.bumpMap,
      bumpScale: 0.018,
      roughnessMap: this.earthTextures.roughnessMap,
      roughness: 0.95,
      metalness: 0.05,
    });

    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uSunDir = this.earthShaderUniforms.uSunDir;
      shader.uniforms.uNightMap = this.earthShaderUniforms.uNightMap;
      shader.uniforms.uNightMix = this.earthShaderUniforms.uNightMix;

      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          `#include <common>
           varying vec3 vEarthWorldNormal;`
        )
        .replace(
          '#include <worldpos_vertex>',
          `#include <worldpos_vertex>
           vEarthWorldNormal = normalize(mat3(modelMatrix) * normal);`
        );

      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
           uniform vec3 uSunDir;
           uniform sampler2D uNightMap;
           uniform float uNightMix;
           varying vec3 vEarthWorldNormal;`
        )
        .replace(
          '#include <dithering_fragment>',
          `
           vec3 nWorld = normalize(vEarthWorldNormal);
           float sunDot = dot(nWorld, normalize(uSunDir));
           float dayFactor = smoothstep(-0.16, 0.22, sunDot);
           float twilightBand = smoothstep(-0.22, 0.02, sunDot) * (1.0 - smoothstep(0.02, 0.24, sunDot));
           vec3 nightLights = texture2D(uNightMap, vMapUv).rgb;

           vec3 litColor = gl_FragColor.rgb;
           vec3 nocturnalBase = litColor * 0.14 + nightLights * 1.45;
           vec3 blendedColor = mix(nocturnalBase, litColor + vec3(0.18, 0.08, 0.02) * twilightBand, dayFactor);
           gl_FragColor.rgb = mix(litColor * 1.05, blendedColor, uNightMix);
           #include <dithering_fragment>
          `
        );
    };

    this.earthMesh = new THREE.Mesh(geo, mat);
    this.earthGroup.add(this.earthMesh);

    // Cloud Shell
    const cloudGeo = new THREE.SphereGeometry(1.012, 72, 48);
    const cloudMat = new THREE.MeshStandardMaterial({
      map: this.earthTextures.cloudsMap,
      transparent: true,
      opacity: 0.72,
      roughness: 0.95,
      metalness: 0.0,
      depthWrite: false,
    });
    this.cloudMesh = new THREE.Mesh(cloudGeo, cloudMat);
    this.cloudMesh.renderOrder = 2;
    this.earthGroup.add(this.cloudMesh);

    // Atmosphere Glow
    const atmoGeo = new THREE.SphereGeometry(1.075, 64, 48);
    const atmoMat = new THREE.ShaderMaterial({
      uniforms: this.atmosphereUniforms,
      vertexShader: `
        varying vec3 vNormalWorld;
        varying vec3 vPosWorld;
        void main() {
          vNormalWorld = normalize(mat3(modelMatrix) * normal);
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vPosWorld = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: `
        uniform vec3 uSunDir;
        uniform float uDayNightMix;
        varying vec3 vNormalWorld;
        varying vec3 vPosWorld;
        void main() {
          vec3 viewDir = normalize(cameraPosition - vPosWorld);
          float rim = pow(clamp(0.62 - dot(vNormalWorld, -viewDir), 0.0, 1.0), 3.4);
          float sunSide = mix(1.0, smoothstep(-0.35, 0.55, dot(vNormalWorld, normalize(uSunDir))) * 0.85 + 0.15, uDayNightMix);
          vec3 glowColor = mix(vec3(0.05, 0.35, 0.85), vec3(0.22, 0.78, 1.0), rim);
          gl_FragColor = vec4(glowColor, rim * 0.78 * sunSide);
        }
      `,
      side: THREE.BackSide,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.atmosphereMesh = new THREE.Mesh(atmoGeo, atmoMat);
    this.atmosphereMesh.renderOrder = 3;
    this.earthStage.add(this.atmosphereMesh);

    // Background Moon in Earth Orbit view
    this.earthOrbitMoonMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 36, 24),
      new THREE.MeshStandardMaterial({
        map: this.celestialTextures.moonMap,
        roughness: 0.9,
        metalness: 0.02,
      })
    );
    this.earthOrbitMoonMesh.position.set(-2.6, 0.85, -3.2);
    this.earthStage.add(this.earthOrbitMoonMesh);

    this.buildCountryBorders();
    this.buildGraticule();
    this.buildCityBeacons();
    this.buildSelectionBeacon();
    this.buildSatelliteConstellation();
  }

  private buildSatelliteConstellation() {
    this.satelliteGroup = new THREE.Group();
    this.satelliteGroup.visible = false;
    this.earthGroup.add(this.satelliteGroup);

    for (const sat of SATELLITES) {
      const planeGroup = new THREE.Group();
      planeGroup.rotation.order = 'YXZ';
      planeGroup.rotation.y = sat.raanDeg * DEG2RAD;
      planeGroup.rotation.x = sat.inclinationDeg * DEG2RAD;
      this.satelliteGroup.add(planeGroup);

      // Orbital track ring
      const segs = 128;
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i < segs; i++) {
        const a = (i / segs) * Math.PI * 2;
        pts.push(new THREE.Vector3(Math.cos(a) * sat.orbitRadius, 0, Math.sin(a) * sat.orbitRadius));
      }
      const orbitGeo = new THREE.BufferGeometry().setFromPoints(pts);
      const orbitMat = new THREE.LineBasicMaterial({
        color: sat.id === 'iss' ? 0x22d3ee : sat.regime === 'L2' ? 0xfbbf24 : 0x38bdf8,
        transparent: true,
        opacity: sat.id === 'iss' ? 0.52 : 0.28,
        depthWrite: false,
      });
      planeGroup.add(new THREE.LineLoop(orbitGeo, orbitMat));

      // Composite 3D Spacecraft Group
      const satGroup = buildCompositeSatelliteMesh(sat);

      // Optional Nadir Ground-Track Scan Cone pointing toward Earth
      if (sat.hasNadirBeam) {
        const beamLen = Math.max(0.12, sat.orbitRadius - 1.005);
        const beamRadius = sat.regime === 'GEO' ? 0.11 : sat.regime === 'MEO' ? 0.08 : 0.045;
        const beamGeo = new THREE.ConeGeometry(beamRadius, beamLen, 20, 1, true);
        // Shift cone so apex sits at spacecraft (0,0,0) and base meets Earth surface along +Z
        beamGeo.rotateX(-Math.PI / 2);
        beamGeo.translate(0, 0, beamLen * 0.5);
        const beamMat = new THREE.MeshBasicMaterial({
          color: 0x22d3ee,
          transparent: true,
          opacity: 0.14,
          side: THREE.DoubleSide,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        });
        satGroup.add(new THREE.Mesh(beamGeo, beamMat));
      }

      planeGroup.add(satGroup);
      this.satelliteClickables.push(satGroup);
      this.satellites.set(sat.id, {
        info: sat,
        planeGroup,
        satGroup,
        phase: sat.initialPhase,
      });
    }

    // 48-Satellite Starlink LEO Walker-Delta Mesh Shell
    const starlinkCount = 48;
    const slGeo = new THREE.BoxGeometry(0.014, 0.003, 0.008);
    const slMat = new THREE.MeshBasicMaterial({
      color: 0x7dd3fc,
      transparent: true,
      opacity: 0.85,
    });
    this.starlinkInstancedMesh = new THREE.InstancedMesh(slGeo, slMat, starlinkCount);
    this.starlinkInstancedMesh.frustumCulled = false;

    const planes = 4;
    for (let i = 0; i < starlinkCount; i++) {
      const planeIdx = i % planes;
      const inPlaneIdx = Math.floor(i / planes);
      const euler = new THREE.Euler(53 * DEG2RAD, (planeIdx / planes) * Math.PI, 0, 'YXZ');
      this.starlinkRuntimes.push({
        planeRot: new THREE.Quaternion().setFromEuler(euler),
        radius: 1.215,
        phase: (inPlaneIdx / (starlinkCount / planes)) * Math.PI * 2 + planeIdx * 0.35,
        speed: 0.25,
      });
    }
    this.satelliteGroup.add(this.starlinkInstancedMesh);
    this.updateSatellites(0);
  }

  private updateSatellites(dt: number) {
    if (!this.satelliteGroup.visible && dt > 0) return;

    for (const rt of this.satellites.values()) {
      rt.phase += rt.info.orbitSpeed * dt;
      const r = rt.info.orbitRadius;
      rt.satGroup.position.set(Math.cos(rt.phase) * r, 0, Math.sin(rt.phase) * r);
      // Orient local +Z toward Earth center (0,0,0) so nadir beam points straight down!
      rt.satGroup.lookAt(0, 0, 0);
    }

    const dummy = new THREE.Object3D();
    for (let i = 0; i < this.starlinkRuntimes.length; i++) {
      const sl = this.starlinkRuntimes[i];
      sl.phase += sl.speed * dt;
      _v1.set(Math.cos(sl.phase) * sl.radius, 0, Math.sin(sl.phase) * sl.radius);
      _v1.applyQuaternion(sl.planeRot);
      dummy.position.copy(_v1);
      dummy.lookAt(0, 0, 0);
      dummy.updateMatrix();
      this.starlinkInstancedMesh.setMatrixAt(i, dummy.matrix);
    }
    this.starlinkInstancedMesh.instanceMatrix.needsUpdate = true;
  }

  private buildCountryBorders() {
    const countries = getCountries();
    const positions: number[] = [];
    const r = 1.0025;
    const p1 = new THREE.Vector3();
    const p2 = new THREE.Vector3();

    for (const country of countries) {
      for (const ring of country.rings) {
        for (let i = 0; i < ring.length - 1; i++) {
          const [lng1, lat1] = ring[i];
          const [lng2, lat2] = ring[i + 1];
          if (Math.abs(lng2 - lng1) > 180) continue;
          latLngToVector3(lat1, lng1, r, p1);
          latLngToVector3(lat2, lng2, r, p2);
          positions.push(p1.x, p1.y, p1.z, p2.x, p2.y, p2.z);
        }
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    const mat = new THREE.LineBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.32,
      depthWrite: false,
    });
    this.bordersLines = new THREE.LineSegments(geo, mat);
    this.bordersLines.renderOrder = 1;
    this.earthGroup.add(this.bordersLines);
  }

  private buildGraticule() {
    const positions: number[] = [];
    const r = 1.002;
    const p1 = new THREE.Vector3();
    const p2 = new THREE.Vector3();

    for (let lat = -60; lat <= 60; lat += 30) {
      for (let lng = -180; lng < 180; lng += 4) {
        latLngToVector3(lat, lng, r, p1);
        latLngToVector3(lat, lng + 4, r, p2);
        positions.push(p1.x, p1.y, p1.z, p2.x, p2.y, p2.z);
      }
    }
    for (let lng = -180; lng < 180; lng += 30) {
      for (let lat = -84; lat < 84; lat += 4) {
        latLngToVector3(lat, lng, r, p1);
        latLngToVector3(lat + 4, lng, r, p2);
        positions.push(p1.x, p1.y, p1.z, p2.x, p2.y, p2.z);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    const mat = new THREE.LineBasicMaterial({
      color: 0x67e8f9,
      transparent: true,
      opacity: 0.16,
      depthWrite: false,
    });
    this.graticuleLines = new THREE.LineSegments(geo, mat);
    this.graticuleLines.visible = this.layers.graticule;
    this.earthGroup.add(this.graticuleLines);
  }

  private buildCityBeacons() {
    const geo = new THREE.OctahedronGeometry(0.009, 0);
    const mat = new THREE.MeshBasicMaterial({
      color: 0x22d3ee,
      transparent: true,
      opacity: 0.92,
    });

    this.cityInstancedMesh = new THREE.InstancedMesh(geo, mat, MAJOR_CITIES.length);
    const dummy = new THREE.Object3D();
    const pos = new THREE.Vector3();

    for (let i = 0; i < MAJOR_CITIES.length; i++) {
      const city = MAJOR_CITIES[i];
      latLngToVector3(city.lat, city.lng, 1.006, pos);
      dummy.position.copy(pos);
      dummy.lookAt(0, 0, 0);
      dummy.scale.setScalar(city.isCapital ? 1.15 : 0.85);
      dummy.updateMatrix();
      this.cityInstancedMesh.setMatrixAt(i, dummy.matrix);
    }

    this.cityInstancedMesh.instanceMatrix.needsUpdate = true;
    this.cityInstancedMesh.computeBoundingSphere();
    this.earthGroup.add(this.cityInstancedMesh);
  }

  private buildSelectionBeacon() {
    const ringGeo = new THREE.RingGeometry(0.016, 0.024, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
    });
    this.selectedBeaconMesh = new THREE.Mesh(ringGeo, ringMat);
    this.selectedBeaconMesh.visible = false;
    this.selectedBeaconMesh.renderOrder = 4;
    this.earthGroup.add(this.selectedBeaconMesh);
  }

  // ==================== STAGE 2: SOLAR SYSTEM ====================

  private buildSolarStage() {
    this.solarStage = new THREE.Group();
    this.scene.add(this.solarStage);

    this.solarPivot = new THREE.Group();
    // Tilt solar plane ~20° initially so orbital rings read clearly in 3D
    this.solarPivot.quaternion.setFromEuler(new THREE.Euler(0.36, 0.25, 0));
    this.solarStage.add(this.solarPivot);

    this.solarContentGroup = new THREE.Group();
    this.solarPivot.add(this.solarContentGroup);

    this.solarOrbitLinesGroup = new THREE.Group();
    this.solarContentGroup.add(this.solarOrbitLinesGroup);

    // Central Solar Point Light illuminating all planets dynamically
    this.solarSunLight = new THREE.PointLight(0xfff4dc, 5.2, 200, 0.35);
    this.solarSunLight.position.set(0, 0, 0);
    this.solarContentGroup.add(this.solarSunLight);

    const texMap: Record<string, THREE.Texture> = {
      sun: this.celestialTextures.sunMap,
      mercury: this.celestialTextures.mercuryMap,
      venus: this.celestialTextures.venusMap,
      earth: this.earthTextures.dayMap,
      moon: this.celestialTextures.moonMap,
      mars: this.celestialTextures.marsMap,
      jupiter: this.celestialTextures.jupiterMap,
      saturn: this.celestialTextures.saturnMap,
      uranus: this.celestialTextures.uranusMap,
      neptune: this.celestialTextures.neptuneMap,
    };

    for (const info of SOLAR_BODIES) {
      const group = new THREE.Group();
      group.rotation.z = info.axialTiltDeg * DEG2RAD;

      let mesh: THREE.Mesh;
      if (info.id === 'sun') {
        const sunMat = new THREE.MeshBasicMaterial({ map: texMap.sun });
        mesh = new THREE.Mesh(new THREE.SphereGeometry(info.visualRadius, 64, 48), sunMat);
        group.add(mesh);

        // Solar corona halo
        const coronaGeo = new THREE.SphereGeometry(info.visualRadius * 1.24, 48, 36);
        const coronaMat = new THREE.ShaderMaterial({
          vertexShader: `
            varying vec3 vNormalWorld;
            varying vec3 vPosWorld;
            void main() {
              vNormalWorld = normalize(mat3(modelMatrix) * normal);
              vec4 wp = modelMatrix * vec4(position, 1.0);
              vPosWorld = wp.xyz;
              gl_Position = projectionMatrix * viewMatrix * wp;
            }
          `,
          fragmentShader: `
            varying vec3 vNormalWorld;
            varying vec3 vPosWorld;
            void main() {
              vec3 viewDir = normalize(cameraPosition - vPosWorld);
              float rim = pow(clamp(0.75 - dot(vNormalWorld, -viewDir), 0.0, 1.0), 2.6);
              vec3 col = mix(vec3(1.0, 0.45, 0.05), vec3(1.0, 0.88, 0.45), rim);
              gl_FragColor = vec4(col, rim * 0.85);
            }
          `,
          side: THREE.BackSide,
          transparent: true,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        });
        group.add(new THREE.Mesh(coronaGeo, coronaMat));
      } else {
        const mat = new THREE.MeshStandardMaterial({
          map: texMap[info.id],
          roughness: info.id === 'earth' ? 0.55 : 0.82,
          metalness: 0.04,
          emissive: new THREE.Color(0x0c1628),
          emissiveIntensity: 0.16,
        });
        mesh = new THREE.Mesh(new THREE.SphereGeometry(info.visualRadius, 48, 32), mat);
        group.add(mesh);

        // Subtle cloud & atmosphere on Solar System Earth
        if (info.id === 'earth') {
          const eCloud = new THREE.Mesh(
            new THREE.SphereGeometry(info.visualRadius * 1.015, 36, 24),
            new THREE.MeshStandardMaterial({
              map: this.earthTextures.cloudsMap,
              transparent: true,
              opacity: 0.6,
              depthWrite: false,
            })
          );
          group.add(eCloud);
        }

        // Saturn's Ring System (radial UVs mapped to Cassini texture)
        if (info.id === 'saturn') {
          const innerR = info.visualRadius * 1.32;
          const outerR = info.visualRadius * 2.38;
          const ringGeo = new THREE.RingGeometry(innerR, outerR, 96, 2);
          const posAttr = ringGeo.attributes.position;
          const uvAttr = ringGeo.attributes.uv;
          for (let i = 0; i < posAttr.count; i++) {
            const x = posAttr.getX(i);
            const y = posAttr.getY(i);
            const r = Math.hypot(x, y);
            const radialU = (r - innerR) / (outerR - innerR);
            uvAttr.setXY(i, radialU, 0.5);
          }
          const ringMat = new THREE.MeshStandardMaterial({
            map: this.celestialTextures.saturnRingMap,
            side: THREE.DoubleSide,
            transparent: true,
            roughness: 0.75,
            depthWrite: false,
          });
          const ringMesh = new THREE.Mesh(ringGeo, ringMat);
          ringMesh.rotation.x = Math.PI / 2;
          group.add(ringMesh);
        }

        // Faint Ring for Uranus
        if (info.id === 'uranus') {
          const uRingGeo = new THREE.RingGeometry(info.visualRadius * 1.35, info.visualRadius * 1.62, 64);
          const uRingMat = new THREE.MeshBasicMaterial({
            color: 0xbae6fd,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.24,
            depthWrite: false,
          });
          const uRing = new THREE.Mesh(uRingGeo, uRingMat);
          uRing.rotation.x = Math.PI / 2;
          group.add(uRing);
        }
      }

      // Click hit-target proxy slightly larger than planet for effortless picking
      mesh.userData.cosmicBody = info;
      this.solarClickables.push(mesh);

      if (info.id === 'moon') {
        const earthRuntime = this.solarBodies.get('earth');
        if (earthRuntime) {
          earthRuntime.group.add(group);
        } else {
          this.solarContentGroup.add(group);
        }
      } else {
        this.solarContentGroup.add(group);
      }

      // Build orbital ring line
      if (info.orbitRadius > 0 && info.id !== 'moon') {
        const segs = 128;
        const pts: THREE.Vector3[] = [];
        for (let s = 0; s < segs; s++) {
          const a = (s / segs) * Math.PI * 2;
          pts.push(new THREE.Vector3(Math.cos(a) * info.orbitRadius, 0, Math.sin(a) * info.orbitRadius));
        }
        const orbitGeo = new THREE.BufferGeometry().setFromPoints(pts);
        const orbitMat = new THREE.LineBasicMaterial({
          color: info.id === 'earth' ? 0x22d3ee : 0x38bdf8,
          transparent: true,
          opacity: info.id === 'earth' ? 0.42 : 0.2,
          depthWrite: false,
        });
        const orbitLoop = new THREE.LineLoop(orbitGeo, orbitMat);
        this.solarOrbitLinesGroup.add(orbitLoop);
      }

      this.solarBodies.set(info.id, {
        info,
        group,
        mesh,
        angle: info.initialAngle,
      });
    }

    // Main Asteroid Belt between Mars (11.4) and Jupiter (16.5)
    const asteroidCount = 1100;
    const astGeo = new THREE.DodecahedronGeometry(0.055, 0);
    const astMat = new THREE.MeshStandardMaterial({
      color: 0x94a3b8,
      roughness: 0.92,
      metalness: 0.12,
    });
    this.asteroidBeltMesh = new THREE.InstancedMesh(astGeo, astMat, asteroidCount);
    const dummy = new THREE.Object3D();
    for (let i = 0; i < asteroidCount; i++) {
      const ang = (i / asteroidCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.25;
      const rad = 13.0 + Math.random() * 2.1;
      const yOff = (Math.random() - 0.5) * 0.55;
      dummy.position.set(Math.cos(ang) * rad, yOff, Math.sin(ang) * rad);
      dummy.rotation.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
      dummy.scale.set(
        0.5 + Math.random() * 1.1,
        0.4 + Math.random() * 0.9,
        0.5 + Math.random() * 1.1
      );
      dummy.updateMatrix();
      this.asteroidBeltMesh.setMatrixAt(i, dummy.matrix);
    }
    this.asteroidBeltMesh.instanceMatrix.needsUpdate = true;
    this.asteroidBeltMesh.computeBoundingSphere();
    this.solarContentGroup.add(this.asteroidBeltMesh);

    this.updateSolarOrbitalPositions(0);
  }

  private updateSolarOrbitalPositions(dt: number) {
    const mult = this.solarOrbitsPaused ? 0 : this.solarOrbitSpeedMultiplier;
    for (const runtime of this.solarBodies.values()) {
      const { info, group, mesh } = runtime;
      if (info.orbitRadius > 0) {
        runtime.angle += info.orbitSpeed * mult * dt;
        group.position.set(
          Math.cos(runtime.angle) * info.orbitRadius,
          0,
          Math.sin(runtime.angle) * info.orbitRadius
        );
      }
      mesh.rotation.y += (info.id === 'sun' ? 0.12 : 0.45) * dt;
    }

    if (!this.solarOrbitsPaused) {
      this.asteroidBeltMesh.rotation.y += 0.03 * mult * dt;
    }

    // Smoothly track focused planet if one is selected
    if (this.focusedSolarBodyId) {
      const target = this.solarBodies.get(this.focusedSolarBodyId);
      if (target) {
        if (target.info.id === 'moon') {
          const earthRt = this.solarBodies.get('earth');
          if (earthRt) {
            _v1.copy(earthRt.group.position).add(target.group.position).negate();
          }
        } else {
          _v1.copy(target.group.position).negate();
        }
        this.solarCurrentOffset.lerp(_v1, 1 - Math.exp(-6.5 * Math.max(dt, 0.016)));
        this.solarContentGroup.position.copy(this.solarCurrentOffset);
      }
    } else {
      this.solarCurrentOffset.lerp(_v1.set(0, 0, 0), 1 - Math.exp(-6.5 * Math.max(dt, 0.016)));
      this.solarContentGroup.position.copy(this.solarCurrentOffset);
    }
  }

  // ==================== STAGE 3: MILKY WAY GALAXY ====================

  private buildGalaxyStage() {
    this.galaxyStage = new THREE.Group();
    this.scene.add(this.galaxyStage);

    this.galaxyPivot = new THREE.Group();
    this.galaxyPivot.quaternion.setFromEuler(new THREE.Euler(0.55, 0.2, 0.12));
    this.galaxyStage.add(this.galaxyPivot);

    this.galaxyContentGroup = new THREE.Group();
    this.galaxyPivot.add(this.galaxyContentGroup);

    // 22,000-Star 4-Arm Logarithmic Spiral Milky Way
    const starCount = 22000;
    const positions = new Float32Array(starCount * 3);
    const colors = new Float32Array(starCount * 3);

    const coreColor = new THREE.Color(0xffdfa8);
    const midArmColor = new THREE.Color(0x38bdf8);
    const outerArmColor = new THREE.Color(0x6366f1);
    const tmpColor = new THREE.Color();

    const branches = 4;
    const maxRadius = 21.0;

    for (let i = 0; i < starCount; i++) {
      // Concentrate stars more densely near core & along arms
      const rNorm = Math.pow(Math.random(), 1.55);
      const radius = rNorm * maxRadius;
      const spinAngle = radius * 0.42;
      const branchAngle = ((i % branches) / branches) * Math.PI * 2;

      const scatterFactor = 0.25 + rNorm * 1.15;
      const rx = (Math.random() - 0.5 + (Math.random() - 0.5)) * scatterFactor;
      const ry = (Math.random() - 0.5) * (0.65 * Math.exp(-radius * 0.16) + 0.18);
      const rz = (Math.random() - 0.5 + (Math.random() - 0.5)) * scatterFactor;

      // Subtle central galactic bar elongation
      const barBias = radius < 3.6 ? 1.38 : 1.0;

      positions[i * 3] = Math.cos(branchAngle + spinAngle) * radius * barBias + rx;
      positions[i * 3 + 1] = ry;
      positions[i * 3 + 2] = Math.sin(branchAngle + spinAngle) * radius + rz;

      if (rNorm < 0.22) {
        tmpColor.copy(coreColor).lerp(midArmColor, rNorm / 0.22 * 0.35);
      } else {
        tmpColor.copy(midArmColor).lerp(outerArmColor, (rNorm - 0.22) / 0.78);
      }
      const bright = 0.65 + Math.random() * 0.35;
      colors[i * 3] = tmpColor.r * bright;
      colors[i * 3 + 1] = tmpColor.g * bright;
      colors[i * 3 + 2] = tmpColor.b * bright;
    }

    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    starGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const starMat = new THREE.PointsMaterial({
      size: 0.24,
      map: this.celestialTextures.starSpriteMap,
      vertexColors: true,
      transparent: true,
      opacity: 0.92,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    });
    const galaxyStars = new THREE.Points(starGeo, starMat);
    this.galaxyContentGroup.add(galaxyStars);

    // Nebula Star-Forming Cloud Layer (320 larger luminous H-II regions)
    const nebCount = 320;
    const nebPos = new Float32Array(nebCount * 3);
    const nebCol = new Float32Array(nebCount * 3);
    for (let i = 0; i < nebCount; i++) {
      const rNorm = Math.pow(Math.random(), 1.2);
      const r = 1.5 + rNorm * 16.5;
      const angle = ((i % branches) / branches) * Math.PI * 2 + r * 0.42 + (Math.random() - 0.5) * 0.4;
      nebPos[i * 3] = Math.cos(angle) * r;
      nebPos[i * 3 + 1] = (Math.random() - 0.5) * 0.4;
      nebPos[i * 3 + 2] = Math.sin(angle) * r;

      const c = i % 3 === 0 ? new THREE.Color(0xf59e0b) : new THREE.Color(0x0ea5e9);
      nebCol[i * 3] = c.r * 0.45;
      nebCol[i * 3 + 1] = c.g * 0.45;
      nebCol[i * 3 + 2] = c.b * 0.55;
    }
    const nebGeo = new THREE.BufferGeometry();
    nebGeo.setAttribute('position', new THREE.BufferAttribute(nebPos, 3));
    nebGeo.setAttribute('color', new THREE.BufferAttribute(nebCol, 3));
    const nebMat = new THREE.PointsMaterial({
      size: 2.6,
      map: this.celestialTextures.starSpriteMap,
      vertexColors: true,
      transparent: true,
      opacity: 0.28,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.galaxyContentGroup.add(new THREE.Points(nebGeo, nebMat));

    // Galactic Core Luminous Bulge Sphere
    const coreGlow = new THREE.Mesh(
      new THREE.SphereGeometry(1.45, 32, 24),
      new THREE.MeshBasicMaterial({
        color: 0xffedd5,
        transparent: true,
        opacity: 0.55,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    this.galaxyContentGroup.add(coreGlow);

    // Interactive Galactic Region Markers (Orion Spur, Sagittarius A*, Perseus Arm, Carina Arm)
    for (const region of GALAXY_REGIONS) {
      const [gx, gy, gz] = region.galaxyPos ?? [0, 0, 0];
      const isHome = region.id === 'orion-spur';
      const markerGeo = new THREE.RingGeometry(isHome ? 0.34 : 0.24, isHome ? 0.48 : 0.34, 32);
      const markerMat = new THREE.MeshBasicMaterial({
        color: isHome ? 0x22d3ee : 0x7dd3fc,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: isHome ? 0.95 : 0.7,
        depthWrite: false,
      });
      const marker = new THREE.Mesh(markerGeo, markerMat);
      marker.position.set(gx, gy, gz);
      marker.rotation.x = Math.PI / 2;

      // Invisible clickable proxy sphere for easy raycasting
      const hitMesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.9, 12, 12),
        new THREE.MeshBasicMaterial({ visible: false })
      );
      hitMesh.position.set(gx, gy, gz);
      hitMesh.userData.cosmicBody = region;
      this.galaxyClickables.push(hitMesh);

      this.galaxyContentGroup.add(marker);
      this.galaxyContentGroup.add(hitMesh);
      this.galaxyMarkers.push({
        info: region,
        marker,
        localPos: new THREE.Vector3(gx, gy, gz),
      });
    }
  }

  // ==================== COSMIC SCALE & STAGE MANAGEMENT ====================

  private setStageVisibility(scale: CosmicScale) {
    this.activeScale = scale;
    this.earthStage.visible = scale === 'earth';
    this.solarStage.visible = scale === 'solar';
    this.galaxyStage.visible = scale === 'galaxy';
    this.sunLight.visible = scale === 'earth';
  }

  public getCosmicScale(): CosmicScale {
    return this.activeScale;
  }

  public setCosmicScale(scale: CosmicScale, focusBodyId?: string, notify = true) {
    this.lastScaleSwitchMs = performance.now();
    this.velYaw = 0;
    this.velPitch = 0;
    this.continuousSpinVel = 0;
    this.flyActive = false;

    if (scale === 'earth') {
      this.setStageVisibility('earth');
      this.focusedSolarBodyId = null;
      this.focusedGalaxyRegionId = null;
      this.targetCameraDist = DEFAULT_CAMERA_DIST;
      this.cameraDist = Math.min(this.cameraDist, MAX_CAMERA_DIST);
    } else if (scale === 'solar') {
      this.setStageVisibility('solar');
      this.focusedGalaxyRegionId = null;
      this.focusedSolarBodyId = focusBodyId || null;
      if (focusBodyId) {
        const body = SOLAR_BODIES.find((b) => b.id === focusBodyId);
        this.targetCameraDist = body ? body.defaultFocusDist : DEFAULT_SOLAR_DIST;
      } else {
        this.targetCameraDist = DEFAULT_SOLAR_DIST;
      }
      if (this.cameraDist < 1.2 || this.cameraDist > MAX_SOLAR_DIST) {
        this.cameraDist = this.targetCameraDist * 1.18;
      }
    } else if (scale === 'galaxy') {
      this.setStageVisibility('galaxy');
      this.focusedSolarBodyId = null;
      this.focusedGalaxyRegionId = focusBodyId || null;
      if (focusBodyId) {
        const reg = GALAXY_REGIONS.find((r) => r.id === focusBodyId);
        this.targetCameraDist = reg ? reg.defaultFocusDist : DEFAULT_GALAXY_DIST;
      } else {
        this.targetCameraDist = DEFAULT_GALAXY_DIST;
      }
      if (this.cameraDist < MIN_GALAXY_DIST || this.cameraDist > MAX_GALAXY_DIST) {
        this.cameraDist = this.targetCameraDist * 1.15;
      }
    }

    if (notify) {
      this.callbacks.onScaleChanged?.(scale);
    }
    this.emitTelemetry();
  }

  public focusCosmicBody(body: CelestialBodyInfo) {
    if (body.scale === 'solar') {
      this.setCosmicScale('solar', body.id);
    } else {
      this.setCosmicScale('galaxy', body.id);
    }
    this.callbacks.onSelectCosmicBody?.(body);
  }

  public setSolarOrbitsPaused(paused: boolean) {
    this.solarOrbitsPaused = paused;
  }

  public setSatelliteMode(enabled: boolean) {
    this.satelliteMode = enabled;
    this.satelliteGroup.visible = enabled;
    if (enabled) {
      if (this.activeScale !== 'earth') {
        this.setCosmicScale('earth');
      }
      if (this.targetCameraDist < 2.2) {
        this.targetCameraDist = 2.85;
      }
    } else {
      this.trackedSatelliteId = null;
      this.callbacks.onSatelliteLabelsUpdate?.([]);
    }
    this.callbacks.onSatelliteModeChanged?.(enabled);
    this.emitTelemetry();
  }

  public trackSatellite(satId: string | null) {
    if (satId && !this.satelliteMode) {
      this.setSatelliteMode(true);
    }
    this.trackedSatelliteId = satId;
    if (satId) {
      const rt = this.satellites.get(satId);
      if (rt) {
        this.targetCameraDist = rt.info.orbitRadius + 0.65;
        this.callbacks.onSelectSatellite?.(rt.info);
      }
    } else {
      this.callbacks.onSelectSatellite?.(null);
    }
    this.emitTelemetry();
  }

  // ==================== COUNTRY / CITY HIGHLIGHTING ====================

  public highlightCountry(country: CountryRecord | null) {
    this.selectedCountry = country;

    if (this.selectedCountryLines) {
      this.earthGroup.remove(this.selectedCountryLines);
      this.selectedCountryLines.geometry.dispose();
      (this.selectedCountryLines.material as THREE.Material).dispose();
      this.selectedCountryLines = null;
    }

    if (!country) {
      if (!this.selectedCity) {
        this.selectedBeaconMesh.visible = false;
      }
      return;
    }

    const positions: number[] = [];
    const r = 1.0045;
    const p1 = new THREE.Vector3();
    const p2 = new THREE.Vector3();

    for (const ring of country.rings) {
      for (let i = 0; i < ring.length - 1; i++) {
        const [lng1, lat1] = ring[i];
        const [lng2, lat2] = ring[i + 1];
        if (Math.abs(lng2 - lng1) > 180) continue;
        latLngToVector3(lat1, lng1, r, p1);
        latLngToVector3(lat2, lng2, r, p2);
        positions.push(p1.x, p1.y, p1.z, p2.x, p2.y, p2.z);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    const mat = new THREE.LineBasicMaterial({
      color: 0x67e8f9,
      transparent: true,
      opacity: 0.98,
      depthWrite: false,
    });
    this.selectedCountryLines = new THREE.LineSegments(geo, mat);
    this.selectedCountryLines.renderOrder = 4;
    this.earthGroup.add(this.selectedCountryLines);

    this.placeSelectionBeacon(country.lat, country.lng);
  }

  public highlightCity(city: CityInfo | null) {
    this.selectedCity = city;
    if (city) {
      this.placeSelectionBeacon(city.lat, city.lng);
    } else if (!this.selectedCountry) {
      this.selectedBeaconMesh.visible = false;
    }
  }

  private placeSelectionBeacon(lat: number, lng: number) {
    const pos = latLngToVector3(lat, lng, 1.007, new THREE.Vector3());
    this.selectedBeaconMesh.position.copy(pos);
    this.selectedBeaconMesh.lookAt(pos.clone().multiplyScalar(2));
    this.selectedBeaconMesh.visible = true;
  }

  private computeQuatForLatLng(lat: number, lng: number): THREE.Quaternion {
    const localTargetDir = latLngToVector3(lat, lng, 1, new THREE.Vector3()).normalize();
    const qAlign = new THREE.Quaternion().setFromUnitVectors(localTargetDir, FORWARD_Z);
    const transformedNorth = new THREE.Vector3(0, 1, 0).applyQuaternion(qAlign);
    const projNorth = new THREE.Vector3(transformedNorth.x, transformedNorth.y, 0);
    if (projNorth.lengthSq() > 1e-5) {
      projNorth.normalize();
      const angle = Math.atan2(projNorth.x, projNorth.y);
      const qRoll = new THREE.Quaternion().setFromAxisAngle(FORWARD_Z, angle);
      qAlign.premultiply(qRoll);
    }
    return qAlign;
  }

  public setOrientationLatLng(lat: number, lng: number) {
    this.earthGroup.quaternion.copy(this.computeQuatForLatLng(lat, lng));
  }

  public flyToLatLng(lat: number, lng: number, targetDist = 1.75) {
    if (this.activeScale !== 'earth') {
      this.setCosmicScale('earth');
    }
    this.flyTargetQuat = this.computeQuatForLatLng(lat, lng);
    this.flyActive = true;
    this.velYaw = 0;
    this.velPitch = 0;
    this.continuousSpinVel = 0;
    this.targetCameraDist = THREE.MathUtils.clamp(targetDist, MIN_CAMERA_DIST, MAX_CAMERA_DIST);
  }

  public resetView() {
    this.selectedCity = null;
    this.trackedSatelliteId = null;
    this.highlightCountry(null);
    this.callbacks.onSelectCountry?.(null, 28, -32);
    if (this.activeScale === 'solar') {
      this.focusedSolarBodyId = null;
      this.solarPivot.quaternion.setFromEuler(new THREE.Euler(0.36, 0.25, 0));
      this.targetCameraDist = DEFAULT_SOLAR_DIST;
    } else if (this.activeScale === 'galaxy') {
      this.focusedGalaxyRegionId = null;
      this.galaxyPivot.quaternion.setFromEuler(new THREE.Euler(0.55, 0.2, 0.12));
      this.targetCameraDist = DEFAULT_GALAXY_DIST;
    } else {
      this.flyToLatLng(28, -32, DEFAULT_CAMERA_DIST);
    }
  }

  // ==================== GESTURE & DIRECT CONTROL API ====================

  private getActivePivotGroup(): THREE.Group {
    if (this.activeScale === 'solar') return this.solarPivot;
    if (this.activeScale === 'galaxy') return this.galaxyPivot;
    return this.earthGroup;
  }

  public setGesturePaused(paused: boolean) {
    this.gesturePaused = paused;
    if (paused) {
      this.velYaw = 0;
      this.velPitch = 0;
      this.continuousSpinVel = 0;
    }
  }

  public stopMotion() {
    this.velYaw = 0;
    this.velPitch = 0;
    this.continuousSpinVel = 0;
    this.flyActive = false;
    this.lastUserInteractionMs = performance.now();
  }

  public applyDragRotate(deltaYaw: number, deltaPitch: number) {
    if (this.gesturePaused) return;
    this.flyActive = false;
    this.trackedSatelliteId = null;
    this.continuousSpinVel = 0;
    this.lastUserInteractionMs = performance.now();

    let zoomScale = 1.0;
    if (this.activeScale === 'earth') {
      zoomScale = THREE.MathUtils.clamp((this.cameraDist - 1.0) / 2.2, 0.18, 1.15);
    }
    const dy = deltaYaw * zoomScale;
    const dp = deltaPitch * zoomScale;

    _q1.setFromAxisAngle(WORLD_UP, dy);
    _q2.setFromAxisAngle(WORLD_RIGHT, dp);
    this.getActivePivotGroup().quaternion.premultiply(_q1).premultiply(_q2).normalize();

    this.velYaw = THREE.MathUtils.lerp(this.velYaw, dy * 14, 0.35);
    this.velPitch = THREE.MathUtils.lerp(this.velPitch, dp * 14, 0.35);
  }

  public applySwipeImpulse(vx: number, vy: number) {
    if (this.gesturePaused) return;
    this.flyActive = false;
    this.trackedSatelliteId = null;
    this.lastUserInteractionMs = performance.now();
    this.velYaw = THREE.MathUtils.clamp(vx, -5.5, 5.5);
    this.velPitch = THREE.MathUtils.clamp(vy, -3.5, 3.5);
  }

  public setContinuousSpin(spinVel: number) {
    if (this.gesturePaused) return;
    this.flyActive = false;
    this.trackedSatelliteId = null;
    this.lastUserInteractionMs = performance.now();
    this.continuousSpinVel = THREE.MathUtils.clamp(spinVel, -3.2, 3.2);
  }

  public applyZoomDelta(deltaDist: number) {
    if (this.gesturePaused) return;
    this.flyActive = false;
    this.lastUserInteractionMs = performance.now();
    const now = performance.now();
    const canBridge = now - this.lastScaleSwitchMs > 950;

    if (this.activeScale === 'earth') {
      const next = this.targetCameraDist + deltaDist;
      if (canBridge && next > MAX_CAMERA_DIST + 0.35 && deltaDist > 0) {
        // Seamless zoom out from Earth Orbit into Solar System!
        this.setCosmicScale('solar', 'earth');
        return;
      }
      this.targetCameraDist = THREE.MathUtils.clamp(next, MIN_CAMERA_DIST, MAX_CAMERA_DIST + 0.45);
    } else if (this.activeScale === 'solar') {
      const scaledDelta = deltaDist * Math.max(1.5, this.cameraDist * 0.28);
      const next = this.targetCameraDist + scaledDelta;
      if (canBridge && next > MAX_SOLAR_DIST + 3.5 && deltaDist > 0) {
        // Seamless zoom out from Solar System into Milky Way Galaxy!
        this.setCosmicScale('galaxy', 'orion-spur');
        return;
      }
      if (canBridge && next < MIN_SOLAR_DIST + 0.15 && deltaDist < 0 && this.focusedSolarBodyId === 'earth') {
        // Seamless zoom right back into Earth Surface Orbit!
        this.setCosmicScale('earth');
        return;
      }
      this.targetCameraDist = THREE.MathUtils.clamp(next, MIN_SOLAR_DIST, MAX_SOLAR_DIST + 5.0);
    } else if (this.activeScale === 'galaxy') {
      const scaledDelta = deltaDist * Math.max(2.0, this.cameraDist * 0.28);
      const next = this.targetCameraDist + scaledDelta;
      if (canBridge && next < MIN_GALAXY_DIST - 0.6 && deltaDist < 0) {
        // Seamless zoom in from Milky Way into Solar System!
        this.setCosmicScale('solar');
        return;
      }
      this.targetCameraDist = THREE.MathUtils.clamp(next, MIN_GALAXY_DIST - 1.0, MAX_GALAXY_DIST);
    }
  }

  public setLayers(next: Partial<EarthLayerVisibility>) {
    this.layers = { ...this.layers, ...next };
    this.bordersLines.visible = this.layers.borders;
    this.cityInstancedMesh.visible = this.layers.cities;
    this.cloudMesh.visible = this.layers.clouds;
    this.graticuleLines.visible = this.layers.graticule;
    this.solarOrbitLinesGroup.visible = this.layers.orbits;
    this.earthShaderUniforms.uNightMix.value = this.layers.dayNight ? 1.0 : 0.0;
    this.atmosphereUniforms.uDayNightMix.value = this.layers.dayNight ? 1.0 : 0.0;
  }

  // ==================== MOUSE & TOUCH EVENTS ====================

  private bindEvents() {
    const dom = this.renderer.domElement;
    dom.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
    dom.addEventListener('wheel', this.onWheel, { passive: false });
    dom.addEventListener('touchstart', this.onTouchStart, { passive: false });
    dom.addEventListener('touchmove', this.onTouchMove, { passive: false });
    dom.addEventListener('touchend', this.onTouchEnd);
    window.addEventListener('resize', this.onResize);
  }

  private onPointerDown = (e: PointerEvent) => {
    if (e.button !== 0) return;
    this.isPointerDown = true;
    this.pointerStartX = e.clientX;
    this.pointerStartY = e.clientY;
    this.pointerPrevX = e.clientX;
    this.pointerPrevY = e.clientY;
    this.pointerMovedDist = 0;
    this.flyActive = false;
    this.continuousSpinVel = 0;
    this.lastUserInteractionMs = performance.now();
  };

  private onPointerMove = (e: PointerEvent) => {
    if (!this.isPointerDown || this.activePinchDist > 0) return;
    const dx = e.clientX - this.pointerPrevX;
    const dy = e.clientY - this.pointerPrevY;
    this.pointerPrevX = e.clientX;
    this.pointerPrevY = e.clientY;
    this.pointerMovedDist += Math.hypot(dx, dy);

    this.applyDragRotate(dx * 0.0048, dy * 0.0048);
  };

  private onPointerUp = (e: PointerEvent) => {
    if (!this.isPointerDown) return;
    this.isPointerDown = false;
    if (this.pointerMovedDist < 6) {
      this.handleCanvasClick(e.clientX, e.clientY);
    }
  };

  private onWheel = (e: WheelEvent) => {
    e.preventDefault();
    this.applyZoomDelta(e.deltaY * 0.0014);
  };

  private onTouchStart = (e: TouchEvent) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      this.activePinchDist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      this.isPointerDown = false;
    }
  };

  private onTouchMove = (e: TouchEvent) => {
    if (e.touches.length === 2 && this.activePinchDist > 0) {
      e.preventDefault();
      const newDist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const delta = this.activePinchDist - newDist;
      this.activePinchDist = newDist;
      this.applyZoomDelta(delta * 0.0065);
    }
  };

  private onTouchEnd = (e: TouchEvent) => {
    if (e.touches.length < 2) {
      this.activePinchDist = 0;
    }
  };

  private handleCanvasClick(clientX: number, clientY: number) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointerNDC.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.pointerNDC.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointerNDC, this.camera);

    if (this.activeScale === 'solar') {
      const hits = this.raycaster.intersectObjects(this.solarClickables, false);
      if (hits.length > 0) {
        const body = hits[0].object.userData.cosmicBody as CelestialBodyInfo | undefined;
        if (body) {
          this.focusCosmicBody(body);
        }
      }
      return;
    }

    if (this.activeScale === 'galaxy') {
      const hits = this.raycaster.intersectObjects(this.galaxyClickables, false);
      if (hits.length > 0) {
        const body = hits[0].object.userData.cosmicBody as CelestialBodyInfo | undefined;
        if (body) {
          this.focusCosmicBody(body);
        }
      }
      return;
    }

    // Earth scale click handling: check satellites first in Satellite Mode
    if (this.satelliteMode) {
      const satHits = this.raycaster.intersectObjects(this.satelliteClickables, true);
      if (satHits.length > 0) {
        let obj: THREE.Object3D | null = satHits[0].object;
        while (obj && !obj.userData.satellite) {
          obj = obj.parent;
        }
        const sat = obj?.userData.satellite as SatelliteInfo | undefined;
        if (sat) {
          this.trackSatellite(sat.id);
          return;
        }
      }
    }

    if (this.layers.cities) {
      const cityHits = this.raycaster.intersectObject(this.cityInstancedMesh, false);
      if (cityHits.length > 0 && cityHits[0].instanceId !== undefined) {
        const city = MAJOR_CITIES[cityHits[0].instanceId];
        if (city) {
          this.selectedCity = city;
          const country = findCountryAtLatLng(city.lat, city.lng);
          this.highlightCountry(country);
          this.highlightCity(city);
          this.flyToLatLng(city.lat, city.lng, Math.min(this.cameraDist, 1.48));
          this.callbacks.onSelectCity?.(city);
          return;
        }
      }
    }

    const earthHits = this.raycaster.intersectObject(this.earthMesh, false);
    if (earthHits.length > 0) {
      const worldPoint = earthHits[0].point;
      const localPoint = this.earthGroup.worldToLocal(worldPoint.clone());
      const { lat, lng } = vector3ToLatLng(localPoint);
      const country = findCountryAtLatLng(lat, lng);
      this.selectedCity = null;
      this.highlightCountry(country);
      this.callbacks.onSelectCountry?.(country, lat, lng);
    }
  }

  public onResize = () => {
    if (this.disposed) return;
    const width = Math.max(1, this.container.clientWidth);
    const height = Math.max(1, this.container.clientHeight);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  };

  private handleContextLost = (e: Event) => {
    e.preventDefault();
    this.callbacks.onWebGLContextError?.(true);
  };

  private handleContextRestored = () => {
    this.callbacks.onWebGLContextError?.(false);
  };

  // ==================== MAIN RENDER LOOP ====================

  private afterDraw(cb: () => void) {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    if (!gl || typeof gl.fenceSync !== 'function') {
      this.frameId = window.setTimeout(cb, 80);
      return;
    }
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      if (this.disposed) return;
      const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (state === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        if (sync) gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 80);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  private tick = () => {
    if (this.disposed) return;
    const dt = Math.min(this.clock.getDelta(), 0.05);
    const now = performance.now();

    // Smooth camera zoom distance
    this.cameraDist = THREE.MathUtils.damp(this.cameraDist, this.targetCameraDist, 8.0, dt);
    this.camera.position.set(0, 0, this.cameraDist);

    const pivot = this.getActivePivotGroup();

    if (this.activeScale === 'earth' && this.flyActive && this.flyTargetQuat) {
      const slerpAlpha = 1 - Math.exp(-5.5 * dt);
      this.earthGroup.quaternion.slerp(this.flyTargetQuat, slerpAlpha);
      if (this.earthGroup.quaternion.angleTo(this.flyTargetQuat) < 0.002) {
        this.earthGroup.quaternion.copy(this.flyTargetQuat);
        this.flyActive = false;
      }
    } else if (!this.gesturePaused) {
      if (Math.abs(this.velYaw) > 0.0005 || Math.abs(this.velPitch) > 0.0005) {
        _q1.setFromAxisAngle(WORLD_UP, this.velYaw * dt);
        _q2.setFromAxisAngle(WORLD_RIGHT, this.velPitch * dt);
        pivot.quaternion.premultiply(_q1).premultiply(_q2).normalize();

        const damp = Math.exp(-4.2 * dt);
        this.velYaw *= damp;
        this.velPitch *= damp;
      }

      if (Math.abs(this.continuousSpinVel) > 0.001) {
        _q1.setFromAxisAngle(WORLD_UP, this.continuousSpinVel * dt);
        pivot.quaternion.premultiply(_q1).normalize();
        this.continuousSpinVel *= Math.exp(-1.4 * dt);
      } else if (
        this.autoRotateIdle &&
        !this.isPointerDown &&
        now - this.lastUserInteractionMs > 4500 &&
        Math.abs(this.velYaw) < 0.005
      ) {
        const idleSpeed = this.activeScale === 'galaxy' ? 0.032 : this.activeScale === 'solar' ? 0.014 : 0.025;
        _q1.setFromAxisAngle(WORLD_UP, idleSpeed * dt);
        pivot.quaternion.premultiply(_q1).normalize();
      }
    }

    // Per-stage animations
    if (this.activeScale === 'earth') {
      if (this.layers.clouds) {
        this.cloudMesh.rotation.y += 0.008 * dt;
      }
      if (this.selectedBeaconMesh.visible) {
        const s = 1 + 0.18 * Math.sin(now * 0.005);
        this.selectedBeaconMesh.scale.setScalar(s);
      }
      this.earthOrbitMoonMesh.rotation.y += 0.08 * dt;

      if (this.satelliteMode) {
        this.updateSatellites(dt);
        if (this.trackedSatelliteId && !this.isPointerDown) {
          const rt = this.satellites.get(this.trackedSatelliteId);
          if (rt) {
            // Compute satellite direction in earthGroup local frame and keep it centered toward +Z
            _v1.copy(rt.satGroup.position).applyQuaternion(rt.planeGroup.quaternion).normalize();
            const qAlign = _q1.setFromUnitVectors(_v1, FORWARD_Z);
            this.earthGroup.quaternion.slerp(qAlign, 1 - Math.exp(-5.0 * dt));
          }
        }
      }
    } else if (this.activeScale === 'solar') {
      this.updateSolarOrbitalPositions(dt);
    } else if (this.activeScale === 'galaxy') {
      this.galaxyContentGroup.rotation.y += 0.012 * dt;
      const focusedReg = this.focusedGalaxyRegionId
        ? GALAXY_REGIONS.find((r) => r.id === this.focusedGalaxyRegionId)
        : null;
      if (focusedReg && focusedReg.galaxyPos) {
        _v1.set(-focusedReg.galaxyPos[0], -focusedReg.galaxyPos[1], -focusedReg.galaxyPos[2]);
      } else {
        _v1.set(0, 0, 0);
      }
      this.galaxyCurrentOffset.lerp(_v1, 1 - Math.exp(-6.0 * dt));
      this.galaxyContentGroup.position.copy(this.galaxyCurrentOffset);
    }

    this.renderer.render(this.scene, this.camera);

    if (now - this.lastTelemetryMs > 80) {
      this.lastTelemetryMs = now;
      this.emitTelemetry();
    }

    if (now - this.lastLabelMs > 45) {
      this.lastLabelMs = now;
      this.emitProjectedLabels();
    }

    if (this.isSoftwareGl) {
      this.afterDraw(this.tick);
    } else {
      this.frameId = requestAnimationFrame(this.tick);
    }
  };

  private emitTelemetry() {
    if (!this.callbacks.onTelemetry) return;

    if (this.activeScale === 'solar') {
      const body = this.focusedSolarBodyId
        ? SOLAR_BODIES.find((b) => b.id === this.focusedSolarBodyId)
        : null;
      const zoomPct = Math.round(((MAX_SOLAR_DIST - this.cameraDist) / (MAX_SOLAR_DIST - MIN_SOLAR_DIST)) * 500 + 25);
      this.callbacks.onTelemetry({
        scale: 'solar',
        satelliteMode: this.satelliteMode,
        trackedSatelliteName: null,
        lat: 0,
        lng: 0,
        zoomPercent: Math.max(10, zoomPct),
        zoomDistance: this.cameraDist,
        locationName: body ? body.name : 'Solar System',
        locationRegion: body ? body.category : 'Heliosphere · 8 Planets',
        distanceReadout: body ? body.distanceLabel : `${(this.cameraDist * 1.1).toFixed(1)} AU View`,
        isLand: false,
        hoveredCountry: null,
      });
      return;
    }

    if (this.activeScale === 'galaxy') {
      const reg = this.focusedGalaxyRegionId
        ? GALAXY_REGIONS.find((r) => r.id === this.focusedGalaxyRegionId)
        : null;
      const zoomPct = Math.round(((MAX_GALAXY_DIST - this.cameraDist) / (MAX_GALAXY_DIST - MIN_GALAXY_DIST)) * 400 + 10);
      this.callbacks.onTelemetry({
        scale: 'galaxy',
        satelliteMode: this.satelliteMode,
        trackedSatelliteName: null,
        lat: 0,
        lng: 0,
        zoomPercent: Math.max(5, zoomPct),
        zoomDistance: this.cameraDist,
        locationName: reg ? reg.name : 'Milky Way Galaxy',
        locationRegion: reg ? 'Galactic Sector' : '105,700 ly Diameter',
        distanceReadout: reg ? reg.distanceLabel : `${Math.round(this.cameraDist * 3.2)}k ly Span`,
        isLand: false,
        hoveredCountry: null,
      });
      return;
    }

    let groundDir = _v1.copy(FORWARD_Z).applyQuaternion(_q1.copy(this.earthGroup.quaternion).invert());
    let trackedSatName: string | null = null;
    if (this.satelliteMode && this.trackedSatelliteId) {
      const rt = this.satellites.get(this.trackedSatelliteId);
      if (rt) {
        trackedSatName = rt.info.shortName;
        groundDir = _v2.copy(rt.satGroup.position).applyQuaternion(rt.planeGroup.quaternion).normalize();
      }
    }

    const { lat, lng } = vector3ToLatLng(groundDir);
    const country = findCountryAtLatLng(lat, lng);

    let locationName = '';
    let locationRegion = '';
    if (country) {
      locationName = country.name;
      locationRegion = country.metadata.continent;
    } else {
      const ocean = findOceanAtLatLng(lat, lng);
      locationName = ocean.name;
      locationRegion = 'International Waters';
    }

    const zoomPercent = distanceToZoomPercent(this.cameraDist);
    this.callbacks.onTelemetry({
      scale: 'earth',
      satelliteMode: this.satelliteMode,
      trackedSatelliteName: trackedSatName,
      lat,
      lng,
      zoomPercent,
      zoomDistance: this.cameraDist,
      locationName,
      locationRegion,
      distanceReadout: `${zoomPercent}%`,
      isLand: Boolean(country),
      hoveredCountry: country,
    });
  }

  private emitProjectedLabels() {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;

    if (this.activeScale === 'earth') {
      this.callbacks.onCosmicLabelsUpdate?.([]);

      // Emit Satellite Labels when Satellite Mode is active
      if (this.callbacks.onSatelliteLabelsUpdate) {
        if (!this.satelliteMode) {
          this.callbacks.onSatelliteLabelsUpdate([]);
        } else {
          const satLabels: ProjectedSatelliteLabel[] = [];
          this.earthGroup.updateMatrixWorld(true);
          for (const rt of this.satellites.values()) {
            rt.satGroup.getWorldPosition(_v1);
            if (_v2.copy(_v1).normalize().dot(FORWARD_Z) < -0.1) continue;
            _v1.project(this.camera);
            if (_v1.z > 1) continue;
            const sx = ((_v1.x + 1) / 2) * width;
            const sy = ((-_v1.y + 1) / 2) * height;
            if (sx < 30 || sx > width - 30 || sy < 55 || sy > height - 70) continue;
            satLabels.push({
              satellite: rt.info,
              x: sx,
              y: sy,
              isSelected: this.trackedSatelliteId === rt.info.id,
            });
          }
          this.callbacks.onSatelliteLabelsUpdate(satLabels);
        }
      }

      if (!this.callbacks.onCityLabelsUpdate) return;
      if (!this.layers.cities) {
        this.callbacks.onCityLabelsUpdate([]);
        return;
      }

      const labels: ProjectedCityLabel[] = [];
      this.earthGroup.updateMatrixWorld();
      _m1.copy(this.earthGroup.matrixWorld);
      const maxLabels = this.cameraDist < 1.65 ? 18 : this.cameraDist < 2.3 ? 10 : 5;

      for (const city of MAJOR_CITIES) {
        const isSelected = this.selectedCity?.id === city.id;
        if (!isSelected && labels.length >= maxLabels && !city.isCapital) continue;

        latLngToVector3(city.lat, city.lng, 1.012, _v1);
        _v1.applyMatrix4(_m1);

        const dotFront = _v2.copy(_v1).normalize().dot(FORWARD_Z);
        if (dotFront < (isSelected ? 0.15 : 0.48)) continue;

        _v1.project(this.camera);
        const sx = ((_v1.x + 1) / 2) * width;
        const sy = ((-_v1.y + 1) / 2) * height;
        if (sx < 40 || sx > width - 40 || sy < 60 || sy > height - 80) continue;

        labels.push({ city, x: sx, y: sy, isSelected });
        if (labels.length >= maxLabels + 2) break;
      }
      this.callbacks.onCityLabelsUpdate(labels);
      return;
    }

    // Clear Earth city & satellite labels in Solar/Galaxy scales
    this.callbacks.onCityLabelsUpdate?.([]);
    this.callbacks.onSatelliteLabelsUpdate?.([]);
    if (!this.callbacks.onCosmicLabelsUpdate) return;

    const cosmicLabels: ProjectedCosmicLabel[] = [];

    if (this.activeScale === 'solar') {
      this.solarStage.updateMatrixWorld(true);
      for (const rt of this.solarBodies.values()) {
        if (rt.info.id === 'moon' && this.focusedSolarBodyId !== 'earth' && this.focusedSolarBodyId !== 'moon') {
          continue;
        }
        rt.group.getWorldPosition(_v1);
        _v1.y += rt.info.visualRadius * 1.15;
        if (_v1.z > this.camera.position.z - 0.5) continue;
        _v1.project(this.camera);
        if (_v1.z > 1) continue;
        const sx = ((_v1.x + 1) / 2) * width;
        const sy = ((-_v1.y + 1) / 2) * height;
        if (sx < 30 || sx > width - 30 || sy < 55 || sy > height - 70) continue;
        cosmicLabels.push({
          body: rt.info,
          x: sx,
          y: sy,
          isSelected: this.focusedSolarBodyId === rt.info.id,
        });
      }
    } else if (this.activeScale === 'galaxy') {
      this.galaxyStage.updateMatrixWorld(true);
      for (const gm of this.galaxyMarkers) {
        gm.marker.getWorldPosition(_v1);
        if (_v1.z > this.camera.position.z - 0.8) continue;
        _v1.project(this.camera);
        if (_v1.z > 1) continue;
        const sx = ((_v1.x + 1) / 2) * width;
        const sy = ((-_v1.y + 1) / 2) * height;
        if (sx < 40 || sx > width - 40 || sy < 55 || sy > height - 70) continue;
        cosmicLabels.push({
          body: gm.info,
          x: sx,
          y: sy,
          isSelected: this.focusedGalaxyRegionId === gm.info.id,
        });
      }
    }

    this.callbacks.onCosmicLabelsUpdate(cosmicLabels);
  }

  public dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);

    const dom = this.renderer.domElement;
    dom.removeEventListener('pointerdown', this.onPointerDown);
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
    dom.removeEventListener('wheel', this.onWheel);
    dom.removeEventListener('touchstart', this.onTouchStart);
    dom.removeEventListener('touchmove', this.onTouchMove);
    dom.removeEventListener('touchend', this.onTouchEnd);
    window.removeEventListener('resize', this.onResize);
    dom.removeEventListener('webglcontextlost', this.handleContextLost);
    dom.removeEventListener('webglcontextrestored', this.handleContextRestored);

    this.earthTextures.dispose();
    this.celestialTextures.dispose();
    this.scene.traverse((obj) => {
      if ((obj as THREE.Mesh).geometry) {
        (obj as THREE.Mesh).geometry.dispose();
      }
      const mat = (obj as THREE.Mesh).material;
      if (Array.isArray(mat)) {
        mat.forEach((m) => m.dispose());
      } else if (mat) {
        mat.dispose();
      }
    });

    this.renderer.dispose();
    if (dom.parentElement) {
      dom.parentElement.removeChild(dom);
    }
  }
}
