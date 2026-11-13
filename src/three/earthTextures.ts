import * as THREE from 'three';
import type { MultiPolygon, Polygon, Position } from 'geojson';
import { getLandGeoCollection, MAJOR_CITIES } from '../data/worldGeoData';

export interface EarthTextureSet {
  dayMap: THREE.CanvasTexture;
  nightMap: THREE.CanvasTexture;
  bumpMap: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
  cloudsMap: THREE.CanvasTexture;
  dispose: () => void;
}

// Fast deterministic 3D value noise on unit sphere (seam-free across ±180° longitude!)
function hash3(ix: number, iy: number, iz: number): number {
  let n = (ix * 374761393 + iy * 668265263 + iz * 1274126177) | 0;
  n = (n ^ (n >> 13)) * 1274126177;
  n = n ^ (n >> 16);
  return (n >>> 0) / 4294967295;
}

function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function noise3(x: number, y: number, z: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const iz = Math.floor(z);
  const fx = smoothstep(x - ix);
  const fy = smoothstep(y - iy);
  const fz = smoothstep(z - iz);

  const n000 = hash3(ix, iy, iz);
  const n100 = hash3(ix + 1, iy, iz);
  const n010 = hash3(ix, iy + 1, iz);
  const n110 = hash3(ix + 1, iy + 1, iz);
  const n001 = hash3(ix, iy, iz + 1);
  const n101 = hash3(ix + 1, iy, iz + 1);
  const n011 = hash3(ix, iy + 1, iz + 1);
  const n111 = hash3(ix + 1, iy + 1, iz + 1);

  const nx00 = lerp(n000, n100, fx);
  const nx10 = lerp(n010, n110, fx);
  const nx01 = lerp(n001, n101, fx);
  const nx11 = lerp(n011, n111, fx);

  const nxy0 = lerp(nx00, nx10, fy);
  const nxy1 = lerp(nx01, nx11, fy);

  return lerp(nxy0, nxy1, fz);
}

function fbm3(x: number, y: number, z: number, octaves = 4): number {
  let value = 0;
  let amplitude = 0.5;
  let freq = 1;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    value += amplitude * noise3(x * freq, y * freq, z * freq);
    norm += amplitude;
    amplitude *= 0.5;
    freq *= 2.04;
  }
  return value / norm;
}

function traceRingOnCanvas(ctx: CanvasRenderingContext2D, ring: Position[], width: number, height: number) {
  if (ring.length < 2) return;
  let prevLng = ring[0][0];
  ctx.moveTo(((prevLng + 180) / 360) * width, ((90 - ring[0][1]) / 180) * height);

  for (let i = 1; i < ring.length; i++) {
    const [lng, lat] = ring[i];
    // Handle antimeridian jump cleanly
    if (Math.abs(lng - prevLng) > 180) {
      ctx.moveTo(((lng + 180) / 360) * width, ((90 - lat) / 180) * height);
    } else {
      ctx.lineTo(((lng + 180) / 360) * width, ((90 - lat) / 180) * height);
    }
    prevLng = lng;
  }
}

function traceLandPaths(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const landFc = getLandGeoCollection();
  ctx.beginPath();
  for (const feat of landFc.features) {
    if (!feat.geometry) continue;
    if (feat.geometry.type === 'Polygon') {
      for (const ring of (feat.geometry as Polygon).coordinates) {
        traceRingOnCanvas(ctx, ring, width, height);
      }
    } else if (feat.geometry.type === 'MultiPolygon') {
      for (const poly of (feat.geometry as MultiPolygon).coordinates) {
        for (const ring of poly) {
          traceRingOnCanvas(ctx, ring, width, height);
        }
      }
    }
  }
}

// Compute regional aridity/biome hints so Sahara, Amazon, Tibet, Australia, Greenland look true-to-life
function getBiomeProfile(lat: number, lng: number, n1: number, n2: number) {
  const absLat = Math.abs(lat);
  // Desert belt boost (Sahara/Arabia, Central Asia, Australian Outback, SW USA, Atacama, Namib)
  let aridity = 0;
  if (lat > 14 && lat < 33 && lng > -17 && lng < 60) aridity += 0.85; // Sahara + Arabian
  if (lat > 36 && lat < 46 && lng > 55 && lng < 108) aridity += 0.65; // Central Asia / Gobi
  if (lat > -30 && lat < -18 && lng > 115 && lng < 142) aridity += 0.72; // Australian Outback
  if (lat > 23 && lat < 37 && lng > -118 && lng < -102) aridity += 0.58; // Sonoran / Mojave
  if (lat > -28 && lat < -17 && lng > -71 && lng < -66) aridity += 0.7; // Atacama
  if (lat > -27 && lat < -16 && lng > 12 && lng < 22) aridity += 0.55; // Namib / Kalahari

  // Major mountain highlands (Himalayas/Tibet, Andes, Rockies, Alps)
  let mountain = 0;
  if (lat > 27 && lat < 39 && lng > 72 && lng < 102) mountain += 0.85; // Himalayas & Tibetan Plateau
  if (lat > -50 && lat < 5 && lng > -78 && lng < -66) mountain += 0.72; // Andes
  if (lat > 33 && lat < 58 && lng > -124 && lng < -104) mountain += 0.62; // Rockies
  if (lat > 44 && lat < 48 && lng > 5 && lng < 16) mountain += 0.55; // Alps

  // Tropical rainforest boost
  let rainforest = 0;
  if (lat > -12 && lat < 7 && lng > -76 && lng < -48) rainforest += 0.85; // Amazon
  if (lat > -6 && lat < 6 && lng > 9 && lng < 30) rainforest += 0.8; // Congo
  if (lat > -9 && lat < 10 && lng > 95 && lng < 148) rainforest += 0.75; // Maritime SE Asia

  const polarIce =
    lat < -64 + n1 * 4 ||
    (lat > 61 && lat < 84 && lng > -58 && lng < -18 && n2 > 0.32) || // Greenland
    lat > 79 + n1 * 3;

  return { absLat, aridity, mountain, rainforest, polarIce };
}

export function createEarthTextures(maxAnisotropy: number): EarthTextureSet {
  // 1. Compute base biome & elevation field at 1024x512 (fast ~45ms) then composite onto 4096x2048 vector land mask
  const fieldW = 1024;
  const fieldH = 512;

  const oceanFieldCanvas = document.createElement('canvas');
  oceanFieldCanvas.width = fieldW;
  oceanFieldCanvas.height = fieldH;
  const oceanCtx = oceanFieldCanvas.getContext('2d')!;
  const oceanImg = oceanCtx.createImageData(fieldW, fieldH);

  const landFieldCanvas = document.createElement('canvas');
  landFieldCanvas.width = fieldW;
  landFieldCanvas.height = fieldH;
  const landCtx = landFieldCanvas.getContext('2d')!;
  const landImg = landCtx.createImageData(fieldW, fieldH);

  const bumpFieldCanvas = document.createElement('canvas');
  bumpFieldCanvas.width = fieldW;
  bumpFieldCanvas.height = fieldH;
  const bumpCtx = bumpFieldCanvas.getContext('2d')!;
  const bumpImg = bumpCtx.createImageData(fieldW, fieldH);

  const cloudFieldCanvas = document.createElement('canvas');
  cloudFieldCanvas.width = fieldW;
  cloudFieldCanvas.height = fieldH;
  const cloudCtx = cloudFieldCanvas.getContext('2d')!;
  const cloudImg = cloudCtx.createImageData(fieldW, fieldH);

  const deg2rad = Math.PI / 180;

  for (let py = 0; py < fieldH; py++) {
    const lat = 90 - ((py + 0.5) / fieldH) * 180;
    const phi = (90 - lat) * deg2rad;
    const sinPhi = Math.sin(phi);
    const cosPhi = Math.cos(phi);

    for (let px = 0; px < fieldW; px++) {
      const lng = ((px + 0.5) / fieldW) * 360 - 180;
      const theta = (lng + 180) * deg2rad;

      // Unit sphere coordinates (seamless across dateline & poles!)
      const sx = -sinPhi * Math.cos(theta);
      const sy = cosPhi;
      const sz = sinPhi * Math.sin(theta);

      const nMacro = fbm3(sx * 3.1 + 1.2, sy * 3.1 + 0.7, sz * 3.1 + 2.4, 4);
      const nDetail = fbm3(sx * 11.5 + 4.1, sy * 11.5 + 3.2, sz * 11.5 + 1.9, 3);
      const nFine = noise3(sx * 28.0, sy * 28.0, sz * 28.0);

      const idx = (py * fieldW + px) * 4;
      const { absLat, aridity, mountain, rainforest, polarIce } = getBiomeProfile(lat, lng, nMacro, nDetail);

      // --- Ocean Bathymetry ---
      const ridge = Math.abs(nMacro - 0.5) * 2.0;
      const depth = Math.min(1, Math.max(0, 0.35 + nDetail * 0.45 + (1 - ridge) * 0.25));
      let oR = lerp(5, 16, depth);
      let oG = lerp(21, 56, depth);
      let oB = lerp(48, 102, depth);
      // Subtle polar sea ice tint near high Arctic/Antarctic
      if (absLat > 74 + nMacro * 8) {
        const iceMix = Math.min(1, (absLat - (74 + nMacro * 8)) / 8);
        oR = lerp(oR, 198, iceMix * 0.85);
        oG = lerp(oG, 218, iceMix * 0.85);
        oB = lerp(oB, 236, iceMix * 0.85);
      }
      oceanImg.data[idx] = oR;
      oceanImg.data[idx + 1] = oG;
      oceanImg.data[idx + 2] = oB;
      oceanImg.data[idx + 3] = 255;

      // --- Land Biome Color ---
      const elev = Math.min(1, Math.max(0, nMacro * 0.48 + nDetail * 0.34 + mountain * 0.52 + (nFine - 0.5) * 0.12));
      const moisture = Math.min(1, Math.max(0, 0.48 + (nDetail - 0.5) * 0.5 + rainforest * 0.55 - aridity * 0.65));

      let lR = 54;
      let lG = 86;
      let lB = 46;

      if (polarIce) {
        // Ice sheet
        const shade = 218 + nFine * 30;
        lR = shade - 6;
        lG = shade;
        lB = Math.min(255, shade + 10);
      } else if (elev > 0.78) {
        // High alpine snow / rock
        const snow = Math.min(1, (elev - 0.78) / 0.16);
        lR = lerp(118, 224, snow);
        lG = lerp(112, 230, snow);
        lB = lerp(104, 236, snow);
      } else if (moisture < 0.34) {
        // Arid desert & steppe
        const aridFactor = Math.min(1, (0.34 - moisture) / 0.28);
        lR = lerp(142, 198, aridFactor) + (nFine - 0.5) * 22;
        lG = lerp(128, 166, aridFactor) + (nFine - 0.5) * 18;
        lB = lerp(92, 114, aridFactor) + (nFine - 0.5) * 14;
      } else if (absLat > 54) {
        // Boreal taiga & tundra
        const tundra = Math.min(1, (absLat - 54) / 18);
        lR = lerp(42, 108, tundra) + (nFine - 0.5) * 16;
        lG = lerp(74, 114, tundra) + (nFine - 0.5) * 16;
        lB = lerp(44, 88, tundra) + (nFine - 0.5) * 12;
      } else {
        // Temperate to tropical vegetation
        const lush = Math.min(1, moisture);
        lR = lerp(92, 26, lush) + (nFine - 0.5) * 18;
        lG = lerp(116, 78, lush) + (nFine - 0.5) * 20;
        lB = lerp(64, 34, lush) + (nFine - 0.5) * 12;
      }

      landImg.data[idx] = Math.max(0, Math.min(255, lR));
      landImg.data[idx + 1] = Math.max(0, Math.min(255, lG));
      landImg.data[idx + 2] = Math.max(0, Math.min(255, lB));
      landImg.data[idx + 3] = 255;

      // --- Land Elevation Bump ---
      const bVal = Math.max(0, Math.min(255, Math.round(90 + elev * 165)));
      bumpImg.data[idx] = bVal;
      bumpImg.data[idx + 1] = bVal;
      bumpImg.data[idx + 2] = bVal;
      bumpImg.data[idx + 3] = 255;

      // --- Atmospheric Cloud Swirls ---
      const warpX = sx + (nMacro - 0.5) * 0.45;
      const warpY = sy + (nDetail - 0.5) * 0.25;
      const warpZ = sz + (nMacro - 0.5) * 0.45;
      const cloudN = fbm3(warpX * 4.2 + 7.3, warpY * 6.0 + 1.8, warpZ * 4.2 + 5.1, 4);
      const cloudDetail = fbm3(warpX * 14.0, warpY * 16.0, warpZ * 14.0, 3);
      // Higher cloud density along ITCZ (equator) and 40°-60° storm tracks; clearer subtropics
      const latBand =
        0.12 * Math.exp(-Math.pow(lat / 10, 2)) +
        0.14 * Math.exp(-Math.pow((absLat - 50) / 14, 2)) -
        0.1 * Math.exp(-Math.pow((absLat - 24) / 10, 2));
      const cRaw = cloudN * 0.65 + cloudDetail * 0.35 + latBand;
      const cAlpha = Math.max(0, Math.min(1, (cRaw - 0.52) / 0.28));
      cloudImg.data[idx] = 242;
      cloudImg.data[idx + 1] = 248;
      cloudImg.data[idx + 2] = 255;
      cloudImg.data[idx + 3] = Math.round(Math.pow(cAlpha, 1.35) * 215);
    }
  }

  oceanCtx.putImageData(oceanImg, 0, 0);
  landCtx.putImageData(landImg, 0, 0);
  bumpCtx.putImageData(bumpImg, 0, 0);
  cloudCtx.putImageData(cloudImg, 0, 0);

  // 2. Composite Crisp High-Resolution Day Map (4096x2048) using real Natural Earth vector coastlines
  const dayW = 4096;
  const dayH = 2048;
  const dayCanvas = document.createElement('canvas');
  dayCanvas.width = dayW;
  dayCanvas.height = dayH;
  const dayCtx = dayCanvas.getContext('2d')!;

  // Base ocean layer
  dayCtx.imageSmoothingEnabled = true;
  dayCtx.imageSmoothingQuality = 'high';
  dayCtx.drawImage(oceanFieldCanvas, 0, 0, dayW, dayH);

  // Coastal shallow-water continental shelf turquoise glow
  dayCtx.save();
  traceLandPaths(dayCtx, dayW, dayH);
  dayCtx.lineJoin = 'round';
  dayCtx.lineCap = 'round';
  dayCtx.strokeStyle = 'rgba(18, 118, 168, 0.36)';
  dayCtx.lineWidth = 22;
  dayCtx.stroke();
  dayCtx.strokeStyle = 'rgba(34, 166, 208, 0.38)';
  dayCtx.lineWidth = 9;
  dayCtx.stroke();
  dayCtx.restore();

  // Clip & draw biome land texture strictly inside accurate land polygons
  dayCtx.save();
  traceLandPaths(dayCtx, dayW, dayH);
  dayCtx.clip('nonzero');
  dayCtx.drawImage(landFieldCanvas, 0, 0, dayW, dayH);
  dayCtx.restore();

  // Subtle shoreline rim definition
  dayCtx.save();
  traceLandPaths(dayCtx, dayW, dayH);
  dayCtx.strokeStyle = 'rgba(165, 224, 245, 0.22)';
  dayCtx.lineWidth = 1.4;
  dayCtx.stroke();
  dayCtx.restore();

  // 3. Bump Map (2048x1024)
  const mapW = 2048;
  const mapH = 1024;
  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = mapW;
  bumpCanvas.height = mapH;
  const bCtx = bumpCanvas.getContext('2d')!;
  bCtx.fillStyle = '#181818';
  bCtx.fillRect(0, 0, mapW, mapH);
  bCtx.save();
  traceLandPaths(bCtx, mapW, mapH);
  bCtx.clip('nonzero');
  bCtx.drawImage(bumpFieldCanvas, 0, 0, mapW, mapH);
  bCtx.restore();

  // 4. Roughness Map (2048x1024) - Ocean glossy (~0.26 = 66), Land matte (~0.84 = 214)
  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = mapW;
  roughCanvas.height = mapH;
  const rCtx = roughCanvas.getContext('2d')!;
  rCtx.fillStyle = 'rgb(68, 68, 68)';
  rCtx.fillRect(0, 0, mapW, mapH);
  rCtx.save();
  traceLandPaths(rCtx, mapW, mapH);
  rCtx.fillStyle = 'rgb(218, 218, 218)';
  rCtx.fill('nonzero');
  rCtx.restore();

  // 5. Night City Lights Map (2048x1024)
  const nightCanvas = document.createElement('canvas');
  nightCanvas.width = mapW;
  nightCanvas.height = mapH;
  const nCtx = nightCanvas.getContext('2d')!;
  nCtx.fillStyle = '#02040a';
  nCtx.fillRect(0, 0, mapW, mapH);

  // Plot real cities + organic metropolitan sprawl halos
  const drawCityCluster = (lat: number, lng: number, radiusPx: number, intensity: number) => {
    const cx = ((lng + 180) / 360) * mapW;
    const cy = ((90 - lat) / 180) * mapH;
    const grad = nCtx.createRadialGradient(cx, cy, 0, cx, cy, radiusPx);
    grad.addColorStop(0, `rgba(255, 224, 150, ${intensity})`);
    grad.addColorStop(0.28, `rgba(251, 176, 59, ${intensity * 0.72})`);
    grad.addColorStop(0.65, `rgba(217, 119, 6, ${intensity * 0.24})`);
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    nCtx.fillStyle = grad;
    nCtx.beginPath();
    nCtx.arc(cx, cy, radiusPx, 0, Math.PI * 2);
    nCtx.fill();

    // Deterministic micro-lights around the metro corridor
    const seed = Math.abs(Math.round(lat * 100 + lng * 100));
    for (let k = 0; k < 14; k++) {
      const ang = ((seed * (k + 3) * 97) % 360) * deg2rad;
      const dist = (((seed * (k + 7) * 53) % 100) / 100) * radiusPx * 0.85;
      const lx = cx + Math.cos(ang) * dist;
      const ly = cy + Math.sin(ang) * dist * 0.7;
      nCtx.fillStyle = `rgba(255, 214, 130, ${0.45 + (k % 3) * 0.18})`;
      nCtx.fillRect(lx, ly, 1.5, 1.5);
    }
  };

  for (const city of MAJOR_CITIES) {
    drawCityCluster(city.lat, city.lng, 11, 0.95);
  }

  // Regional populated corridors (Europe, US East/Midwest, Nile, Ganges, East China, Japan, Java, SE Brazil)
  const corridors: Array<[number, number, number]> = [
    [42.3, -71.0, 9], [39.9, -75.1, 9], [37.7, -122.4, 9], [29.7, -95.3, 8], [32.7, -96.8, 8],
    [25.7, -80.1, 8], [50.8, 4.3, 9], [51.2, 6.7, 10], [45.4, 9.1, 9], [41.3, 2.1, 8],
    [52.2, 21.0, 8], [59.9, 30.3, 8], [26.8, 31.1, 7], [24.0, 32.8, 6], [36.8, 10.1, 6],
    [25.5, 85.1, 9], [22.5, 88.3, 10], [26.9, 75.8, 8], [23.0, 72.5, 8], [13.0, 80.2, 8],
    [30.5, 114.3, 10], [23.1, 113.2, 11], [34.2, 108.9, 8], [30.6, 104.0, 9], [39.1, 117.2, 9],
    [34.6, 135.5, 10], [35.1, 136.9, 9], [10.8, 106.6, 8], [21.0, 105.8, 8], [3.1, 101.6, 8],
    [-7.2, 112.7, 8], [-19.9, -43.9, 8], [-25.4, -49.2, 7], [6.2, -75.5, 7],
  ];
  for (const [lat, lng, rad] of corridors) {
    drawCityCluster(lat, lng, rad, 0.72);
  }

  // 6. Clouds Canvas (2048x1024)
  const cloudsCanvas = document.createElement('canvas');
  cloudsCanvas.width = mapW;
  cloudsCanvas.height = mapH;
  const cCtx = cloudsCanvas.getContext('2d')!;
  cCtx.imageSmoothingEnabled = true;
  cCtx.imageSmoothingQuality = 'high';
  cCtx.drawImage(cloudFieldCanvas, 0, 0, mapW, mapH);

  // Build Three.js textures with proper color space & anisotropy
  const dayMap = new THREE.CanvasTexture(dayCanvas);
  dayMap.colorSpace = THREE.SRGBColorSpace;
  dayMap.anisotropy = maxAnisotropy;
  dayMap.wrapS = THREE.RepeatWrapping;
  dayMap.wrapT = THREE.ClampToEdgeWrapping;

  const nightMap = new THREE.CanvasTexture(nightCanvas);
  nightMap.colorSpace = THREE.SRGBColorSpace;
  nightMap.anisotropy = maxAnisotropy;
  nightMap.wrapS = THREE.RepeatWrapping;
  nightMap.wrapT = THREE.ClampToEdgeWrapping;

  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  bumpMap.anisotropy = maxAnisotropy;
  bumpMap.wrapS = THREE.RepeatWrapping;
  bumpMap.wrapT = THREE.ClampToEdgeWrapping;

  const roughnessMap = new THREE.CanvasTexture(roughCanvas);
  roughnessMap.anisotropy = maxAnisotropy;
  roughnessMap.wrapS = THREE.RepeatWrapping;
  roughnessMap.wrapT = THREE.ClampToEdgeWrapping;

  const cloudsMap = new THREE.CanvasTexture(cloudsCanvas);
  cloudsMap.colorSpace = THREE.SRGBColorSpace;
  cloudsMap.anisotropy = maxAnisotropy;
  cloudsMap.wrapS = THREE.RepeatWrapping;
  cloudsMap.wrapT = THREE.ClampToEdgeWrapping;

  return {
    dayMap,
    nightMap,
    bumpMap,
    roughnessMap,
    cloudsMap,
    dispose: () => {
      dayMap.dispose();
      nightMap.dispose();
      bumpMap.dispose();
      roughnessMap.dispose();
      cloudsMap.dispose();
    },
  };
}
