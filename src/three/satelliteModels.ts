import * as THREE from 'three';
import type { SatelliteInfo } from '../data/satelliteData';

export function buildCompositeSatelliteMesh(info: SatelliteInfo): THREE.Group {
  const root = new THREE.Group();

  // Shared calibrated PBR materials (varied metalness & roughness >= 0.25 contrast)
  const goldFoilMat = new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    metalness: 0.9,
    roughness: 0.22,
  });
  const titaniumMat = new THREE.MeshStandardMaterial({
    color: 0xcbd5e1,
    metalness: 0.78,
    roughness: 0.32,
  });
  const solarPanelMat = new THREE.MeshStandardMaterial({
    color: 0x0f2b5c,
    metalness: 0.35,
    roughness: 0.42,
    emissive: 0x082f49,
    emissiveIntensity: 0.35,
  });
  const radiatorMat = new THREE.MeshStandardMaterial({
    color: 0xf1f5f9,
    metalness: 0.15,
    roughness: 0.65,
  });
  const sensorLensMat = new THREE.MeshStandardMaterial({
    color: 0x22d3ee,
    metalness: 0.85,
    roughness: 0.12,
    emissive: 0x06b6d4,
    emissiveIntensity: 0.65,
  });

  if (info.modelStyle === 'iss') {
    // 1. Main integrated truss spine
    const truss = new THREE.Mesh(new THREE.BoxGeometry(0.068, 0.004, 0.004), titaniumMat);
    root.add(truss);

    // 2. Pressurized habitation modules (cross axis)
    const habCore = new THREE.Mesh(new THREE.CylinderGeometry(0.0045, 0.0045, 0.032, 10), radiatorMat);
    habCore.rotation.x = Math.PI / 2;
    root.add(habCore);

    const nodeCupola = new THREE.Mesh(new THREE.CylinderGeometry(0.0035, 0.004, 0.012, 8), goldFoilMat);
    nodeCupola.position.set(0.008, 0, 0.003);
    root.add(nodeCupola);

    // 3. 4 pairs of huge photovoltaic solar wings
    const wingPositions = [-0.028, -0.019, 0.019, 0.028];
    for (const wx of wingPositions) {
      const wingTop = new THREE.Mesh(new THREE.BoxGeometry(0.007, 0.001, 0.028), solarPanelMat);
      wingTop.position.set(wx, 0, 0.018);
      root.add(wingTop);

      const wingBot = new THREE.Mesh(new THREE.BoxGeometry(0.007, 0.001, 0.028), solarPanelMat);
      wingBot.position.set(wx, 0, -0.018);
      root.add(wingBot);
    }

    // 4. Thermal radiator fins
    const radL = new THREE.Mesh(new THREE.BoxGeometry(0.005, 0.014, 0.0012), radiatorMat);
    radL.position.set(-0.009, 0.007, -0.006);
    root.add(radL);
    const radR = new THREE.Mesh(new THREE.BoxGeometry(0.005, 0.014, 0.0012), radiatorMat);
    radR.position.set(0.009, 0.007, -0.006);
    root.add(radR);
  } else if (info.modelStyle === 'jwst') {
    // 1. Kite-shaped 5-layer Kapton sunshield
    const shieldGeo = new THREE.ConeGeometry(0.022, 0.002, 4);
    shieldGeo.scale(1.35, 1, 0.85);
    const shield = new THREE.Mesh(shieldGeo, titaniumMat);
    shield.position.y = -0.004;
    root.add(shield);

    const shieldLower = new THREE.Mesh(shieldGeo, goldFoilMat);
    shieldLower.position.y = -0.007;
    shieldLower.scale.setScalar(0.92);
    root.add(shieldLower);

    // 2. 6.5m Gold Primary Mirror Array (hexagonal disc)
    const mirror = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.0025, 6), goldFoilMat);
    mirror.rotation.x = Math.PI / 2;
    mirror.position.set(0, 0.007, 0);
    root.add(mirror);

    // 3. Secondary mirror & tripod boom
    const secMirror = new THREE.Mesh(new THREE.CylinderGeometry(0.0025, 0.0025, 0.002, 12), titaniumMat);
    secMirror.rotation.x = Math.PI / 2;
    secMirror.position.set(0, 0.007, 0.014);
    root.add(secMirror);

    const boom = new THREE.Mesh(new THREE.CylinderGeometry(0.0008, 0.0008, 0.015, 6), titaniumMat);
    boom.rotation.x = Math.PI / 2;
    boom.position.set(0, 0.008, 0.007);
    root.add(boom);

    // 4. Aft spacecraft bus
    const bus = new THREE.Mesh(new THREE.BoxGeometry(0.009, 0.006, 0.008), goldFoilMat);
    bus.position.set(0, -0.009, -0.004);
    root.add(bus);
  } else if (info.modelStyle === 'observatory') {
    // 1. Cylindrical telescope optical tube
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.0065, 0.0065, 0.028, 16), titaniumMat);
    barrel.rotation.z = Math.PI / 2;
    root.add(barrel);

    // 2. Aft gold foil instrument bay
    const aftBay = new THREE.Mesh(new THREE.CylinderGeometry(0.0075, 0.0075, 0.01, 12), goldFoilMat);
    aftBay.rotation.z = Math.PI / 2;
    aftBay.position.x = -0.012;
    root.add(aftBay);

    // 3. Forward optical sensor ring
    const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.0052, 0.0052, 0.002, 16), sensorLensMat);
    lens.rotation.z = Math.PI / 2;
    lens.position.x = 0.014;
    root.add(lens);

    // 4. Dual solar wings
    const wingL = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.001, 0.026), solarPanelMat);
    wingL.position.set(-0.002, 0, 0.018);
    root.add(wingL);

    const wingR = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.001, 0.026), solarPanelMat);
    wingR.position.set(-0.002, 0, -0.018);
    root.add(wingR);

    // 5. High-gain dish mast
    const dish = new THREE.Mesh(new THREE.ConeGeometry(0.0045, 0.0025, 14), radiatorMat);
    dish.position.set(-0.008, 0.01, 0);
    root.add(dish);
  } else {
    // Weather / Navigation ('weather')
    // 1. Octagonal gold foil spacecraft bus
    const bus = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.014, 8), goldFoilMat);
    root.add(bus);

    // 2. Parabolic communications dish
    const dish = new THREE.Mesh(new THREE.ConeGeometry(0.007, 0.003, 16), radiatorMat);
    dish.position.set(0, -0.009, 0);
    dish.rotation.x = Math.PI;
    root.add(dish);

    // 3. Optical earth-imager aperture
    const sensor = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.006, 0.007), sensorLensMat);
    sensor.position.set(0, -0.006, 0.007);
    root.add(sensor);

    // 4. Asymmetric/dual solar wings
    const wingL = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.008, 0.0012), solarPanelMat);
    wingL.position.set(0.022, 0, 0);
    root.add(wingL);

    const wingR = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.008, 0.0012), solarPanelMat);
    wingR.position.set(-0.022, 0, 0);
    root.add(wingR);
  }

  // Subtle status beacon at core
  const beacon = new THREE.Mesh(
    new THREE.SphereGeometry(0.0032, 10, 10),
    new THREE.MeshBasicMaterial({ color: 0x22d3ee })
  );
  beacon.position.set(0, 0.011, 0);
  root.add(beacon);

  // Invisible larger hit sphere for effortless raycast clicking
  const hitProxy = new THREE.Mesh(
    new THREE.SphereGeometry(0.042, 10, 10),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  hitProxy.userData.satellite = info;
  root.add(hitProxy);

  return root;
}
