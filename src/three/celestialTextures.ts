import * as THREE from 'three';

function hash2(x: number, y: number): number {
  let n = (x * 374761393 + y * 668265263) | 0;
  n = (n ^ (n >> 13)) * 1274126177;
  n = n ^ (n >> 16);
  return (n >>> 0) / 4294967295;
}

function vnoise(x: number, y: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const a = hash2(ix, iy);
  const b = hash2(ix + 1, iy);
  const c = hash2(ix, iy + 1);
  const d = hash2(ix + 1, iy + 1);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

function fbm2(x: number, y: number, octaves = 4): number {
  let val = 0;
  let amp = 0.5;
  let freq = 1;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    val += amp * vnoise(x * freq, y * freq);
    norm += amp;
    amp *= 0.5;
    freq *= 2.05;
  }
  return val / norm;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function makeCanvasTex(
  w: number,
  h: number,
  drawPixel: (u: number, v: number, px: number, py: number) => [number, number, number, number],
  maxAnisotropy: number,
  isColor = true
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(w, h);
  for (let py = 0; py < h; py++) {
    const v = py / h;
    for (let px = 0; px < w; px++) {
      const u = px / w;
      const [r, g, b, a] = drawPixel(u, v, px, py);
      const idx = (py * w + px) * 4;
      img.data[idx] = Math.max(0, Math.min(255, r));
      img.data[idx + 1] = Math.max(0, Math.min(255, g));
      img.data[idx + 2] = Math.max(0, Math.min(255, b));
      img.data[idx + 3] = Math.max(0, Math.min(255, a));
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  if (isColor) tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

export interface CelestialTexturePack {
  sunMap: THREE.CanvasTexture;
  mercuryMap: THREE.CanvasTexture;
  venusMap: THREE.CanvasTexture;
  moonMap: THREE.CanvasTexture;
  marsMap: THREE.CanvasTexture;
  jupiterMap: THREE.CanvasTexture;
  saturnMap: THREE.CanvasTexture;
  saturnRingMap: THREE.CanvasTexture;
  uranusMap: THREE.CanvasTexture;
  neptuneMap: THREE.CanvasTexture;
  starSpriteMap: THREE.CanvasTexture;
  dispose: () => void;
}

export function createCelestialTextures(maxAnisotropy: number): CelestialTexturePack {
  // Wrap u smoothly for spherical planets using cos/sin projection in noise space
  const sphereFbm = (u: number, v: number, scale: number, seed: number) => {
    const theta = u * Math.PI * 2;
    const phi = v * Math.PI;
    const nx = Math.cos(theta) * Math.sin(phi) * scale + seed;
    const ny = Math.cos(phi) * scale + seed * 0.7;
    const nz = Math.sin(theta) * Math.sin(phi) * scale;
    return (fbm2(nx + nz * 0.65, ny - nz * 0.45, 4) + fbm2(nx * 1.7 - nz, ny * 1.7 + nz, 3)) * 0.5;
  };

  // 1. Sun convective plasma
  const sunMap = makeCanvasTex(
    512,
    256,
    (u, v) => {
      const gran = sphereFbm(u, v, 8.5, 11.2);
      const flare = sphereFbm(u, v, 3.2, 4.7);
      const t = Math.min(1, Math.max(0, gran * 0.65 + flare * 0.35));
      return [
        lerp(235, 255, t),
        lerp(115, 232, Math.pow(t, 1.15)),
        lerp(18, 120, Math.pow(t, 2.2)),
        255,
      ];
    },
    maxAnisotropy
  );

  // 2. Mercury cratered silicate
  const mercuryMap = makeCanvasTex(
    512,
    256,
    (u, v) => {
      const n = sphereFbm(u, v, 7.5, 3.1);
      const crater = Math.abs(sphereFbm(u, v, 18.0, 9.4) - 0.5) * 2;
      const shade = lerp(88, 178, n * 0.7 + crater * 0.3);
      return [shade + 6, shade + 2, shade - 4, 255];
    },
    maxAnisotropy
  );

  // 3. Moon (maria + highlands)
  const moonMap = makeCanvasTex(
    512,
    256,
    (u, v) => {
      const maria = sphereFbm(u, v, 3.5, 19.3);
      const detail = sphereFbm(u, v, 14.0, 5.8);
      const base = maria < 0.48 ? lerp(78, 124, detail) : lerp(148, 212, detail);
      return [base, base + 2, base + 5, 255];
    },
    maxAnisotropy
  );

  // 4. Venus banded sulfuric atmosphere
  const venusMap = makeCanvasTex(
    512,
    256,
    (u, v) => {
      const swirl = sphereFbm(u, v, 4.2, 22.1);
      const band = Math.sin(v * Math.PI * 10 + swirl * 4.5) * 0.5 + 0.5;
      const t = band * 0.55 + swirl * 0.45;
      return [lerp(182, 238, t), lerp(136, 198, t), lerp(76, 134, t), 255];
    },
    maxAnisotropy
  );

  // 5. Mars iron-oxide surface + polar caps
  const marsMap = makeCanvasTex(
    512,
    256,
    (u, v) => {
      const lat = Math.abs(v - 0.5) * 2;
      const n = sphereFbm(u, v, 5.5, 31.4);
      const fine = sphereFbm(u, v, 15.0, 7.7);
      if (lat > 0.87 + (n - 0.5) * 0.08) {
        return [238, 235, 232, 255];
      }
      const darkBasalt = n < 0.44 ? 0.35 : 1.0;
      return [
        lerp(122, 212, fine) * darkBasalt + (1 - darkBasalt) * 95,
        lerp(56, 108, fine) * darkBasalt + (1 - darkBasalt) * 48,
        lerp(34, 64, fine) * darkBasalt + (1 - darkBasalt) * 32,
        255,
      ];
    },
    maxAnisotropy
  );

  // 6. Jupiter turbulent zonal belts + Great Red Spot
  const jupiterMap = makeCanvasTex(
    512,
    256,
    (u, v) => {
      const turb = sphereFbm(u, v, 8.0, 42.0);
      const bandCoord = v * Math.PI * 18 + (turb - 0.5) * 1.9;
      const belt = Math.sin(bandCoord) * 0.5 + 0.5;
      let r = lerp(164, 232, belt);
      let g = lerp(114, 206, belt);
      let b = lerp(82, 168, belt);

      // Great Red Spot around southern tropical zone
      const du = ((u - 0.38 + 1.5) % 1) - 0.5;
      const dv = v - 0.62;
      const spotDist = Math.hypot(du * 1.9, dv * 5.2);
      if (spotDist < 0.22) {
        const spotMix = Math.pow(1 - spotDist / 0.22, 1.4);
        r = lerp(r, 208, spotMix);
        g = lerp(g, 82, spotMix);
        b = lerp(b, 54, spotMix);
      }
      return [r, g, b, 255];
    },
    maxAnisotropy
  );

  // 7. Saturn pale gold atmospheric bands
  const saturnMap = makeCanvasTex(
    512,
    256,
    (u, v) => {
      const turb = sphereFbm(u, v, 6.0, 55.3);
      const belt = Math.sin(v * Math.PI * 16 + (turb - 0.5) * 0.7) * 0.5 + 0.5;
      return [lerp(186, 234, belt), lerp(162, 214, belt), lerp(116, 168, belt), 255];
    },
    maxAnisotropy
  );

  // 8. Saturn Ring radial texture (u = radial distance from inner to outer edge)
  const saturnRingMap = makeCanvasTex(
    512,
    32,
    (u) => {
      // Inner C ring -> B ring (bright) -> Cassini division (dark gap around 0.62) -> A ring
      const fine = vnoise(u * 95, 1.5);
      let alpha = 0;
      let bright = 0.75;
      if (u > 0.08 && u < 0.25) {
        alpha = 0.22;
        bright = 0.55;
      } else if (u >= 0.25 && u < 0.59) {
        alpha = 0.85 * (0.75 + fine * 0.25);
        bright = 0.92;
      } else if (u >= 0.59 && u < 0.65) {
        // Cassini Division
        alpha = 0.06;
        bright = 0.35;
      } else if (u >= 0.65 && u < 0.92) {
        alpha = 0.62 * (0.7 + fine * 0.3);
        bright = 0.78;
      }
      const c = bright * 235;
      return [c, c * 0.93, c * 0.8, alpha * 255];
    },
    maxAnisotropy
  );

  // 9. Uranus cyan ice giant
  const uranusMap = makeCanvasTex(
    256,
    128,
    (u, v) => {
      const n = sphereFbm(u, v, 4.0, 61.2);
      const band = Math.sin(v * Math.PI * 6 + n * 0.5) * 0.5 + 0.5;
      return [lerp(132, 178, band), lerp(212, 238, band), lerp(224, 245, band), 255];
    },
    maxAnisotropy
  );

  // 10. Neptune deep azure ice giant
  const neptuneMap = makeCanvasTex(
    256,
    128,
    (u, v) => {
      const n = sphereFbm(u, v, 5.5, 73.9);
      const band = Math.sin(v * Math.PI * 10 + n * 1.4) * 0.5 + 0.5;
      return [lerp(36, 76, band), lerp(82, 138, band), lerp(196, 245, band), 255];
    },
    maxAnisotropy
  );

  // 11. Soft radial star sprite for Milky Way spiral stars & nebula glow
  const spriteCanvas = document.createElement('canvas');
  spriteCanvas.width = 64;
  spriteCanvas.height = 64;
  const sCtx = spriteCanvas.getContext('2d')!;
  const grad = sCtx.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
  grad.addColorStop(0.22, 'rgba(230, 245, 255, 0.85)');
  grad.addColorStop(0.55, 'rgba(140, 210, 255, 0.25)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  sCtx.fillStyle = grad;
  sCtx.fillRect(0, 0, 64, 64);
  const starSpriteMap = new THREE.CanvasTexture(spriteCanvas);
  starSpriteMap.colorSpace = THREE.SRGBColorSpace;

  return {
    sunMap,
    mercuryMap,
    venusMap,
    moonMap,
    marsMap,
    jupiterMap,
    saturnMap,
    saturnRingMap,
    uranusMap,
    neptuneMap,
    starSpriteMap,
    dispose: () => {
      sunMap.dispose();
      mercuryMap.dispose();
      venusMap.dispose();
      moonMap.dispose();
      marsMap.dispose();
      jupiterMap.dispose();
      saturnMap.dispose();
      saturnRingMap.dispose();
      uranusMap.dispose();
      neptuneMap.dispose();
      starSpriteMap.dispose();
    },
  };
}
