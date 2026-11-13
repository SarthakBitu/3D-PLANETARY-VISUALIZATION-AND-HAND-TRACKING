export interface SatelliteInfo {
  id: string;
  name: string;
  shortName: string;
  agency: string;
  regime: 'LEO' | 'MEO' | 'GEO' | 'L2';
  orbitRadius: number;       // scene Earth radii (Earth = 1.0)
  inclinationDeg: number;    // orbital inclination
  raanDeg: number;           // right ascension of ascending node
  initialPhase: number;      // radians
  orbitSpeed: number;        // radians per second
  altitudeKm: string;
  velocityKms: string;
  periodLabel: string;
  launchedYear: string;
  modelStyle: 'iss' | 'jwst' | 'observatory' | 'weather';
  hasNadirBeam?: boolean;
  summary: string;
}

export const SATELLITES: SatelliteInfo[] = [
  {
    id: 'iss',
    name: 'International Space Station',
    shortName: 'ISS (Zarya)',
    agency: 'NASA · ESA · JAXA · CSA · Roscosmos',
    regime: 'LEO',
    orbitRadius: 1.19,
    inclinationDeg: 51.6,
    raanDeg: 25,
    initialPhase: 0.4,
    orbitSpeed: 0.22,
    altitudeKm: '408 km',
    velocityKms: '7.66 km/s',
    periodLabel: '92.9 min',
    launchedYear: '1998',
    modelStyle: 'iss',
    hasNadirBeam: true,
    summary: 'Modular low-Earth-orbit research laboratory completing 15.5 orbits daily across 51.6° inclination.',
  },
  {
    id: 'hubble',
    name: 'Hubble Space Telescope',
    shortName: 'Hubble (HST)',
    agency: 'NASA · ESA',
    regime: 'LEO',
    orbitRadius: 1.24,
    inclinationDeg: 28.5,
    raanDeg: 115,
    initialPhase: 2.1,
    orbitSpeed: 0.19,
    altitudeKm: '540 km',
    velocityKms: '7.59 km/s',
    periodLabel: '95.4 min',
    launchedYear: '1990',
    modelStyle: 'observatory',
    summary: '2.4-meter optical/ultraviolet space observatory responsible for the Hubble Deep Field and cosmic expansion measurements.',
  },
  {
    id: 'landsat-9',
    name: 'Landsat 9 Earth Observatory',
    shortName: 'Landsat 9',
    agency: 'NASA · USGS',
    regime: 'LEO',
    orbitRadius: 1.28,
    inclinationDeg: 98.2,
    raanDeg: 210,
    initialPhase: 4.0,
    orbitSpeed: 0.17,
    altitudeKm: '705 km',
    velocityKms: '7.50 km/s',
    periodLabel: '98.9 min',
    launchedYear: '2021',
    modelStyle: 'observatory',
    hasNadirBeam: true,
    summary: 'Sun-synchronous polar-orbiting multispectral imager monitoring global forests, glaciers, coastlines, and agriculture.',
  },
  {
    id: 'gps-iii',
    name: 'GPS III SV06 Navigation',
    shortName: 'GPS III',
    agency: 'USSF · Lockheed Martin',
    regime: 'MEO',
    orbitRadius: 1.48,
    inclinationDeg: 55.0,
    raanDeg: 300,
    initialPhase: 1.2,
    orbitSpeed: 0.09,
    altitudeKm: '20,200 km',
    velocityKms: '3.87 km/s',
    periodLabel: '11 hr 58 min',
    launchedYear: '2023',
    modelStyle: 'weather',
    hasNadirBeam: true,
    summary: 'Medium-Earth-orbit atomic-clock positioning satellite delivering global PNT timing and navigation signals.',
  },
  {
    id: 'goes-18',
    name: 'GOES-18 Weather Satellite',
    shortName: 'GOES-18',
    agency: 'NOAA · NASA',
    regime: 'GEO',
    orbitRadius: 1.62,
    inclinationDeg: 0.1,
    raanDeg: 0,
    initialPhase: 5.1,
    orbitSpeed: 0.045,
    altitudeKm: '35,786 km',
    velocityKms: '3.07 km/s',
    periodLabel: '23 hr 56 min',
    launchedYear: '2022',
    modelStyle: 'weather',
    hasNadirBeam: true,
    summary: 'Geostationary meteorological spacecraft continuously scanning Pacific storms, atmospheric rivers, and solar weather.',
  },
  {
    id: 'jwst',
    name: 'James Webb Space Telescope',
    shortName: 'JWST',
    agency: 'NASA · ESA · CSA',
    regime: 'L2',
    orbitRadius: 1.78,
    inclinationDeg: 18.0,
    raanDeg: 165,
    initialPhase: 3.1,
    orbitSpeed: 0.032,
    altitudeKm: '1,500,000 km (L2)',
    velocityKms: '1.02 km/s (Halo)',
    periodLabel: '6 Months (L2 Halo)',
    launchedYear: '2021',
    modelStyle: 'jwst',
    summary: '6.5-meter gold-coated segmented infrared observatory shielded by a 5-layer Kapton sunshield at Sun-Earth L2.',
  },
];

export function searchSatellites(query: string): SatelliteInfo[] {
  const q = query.trim().toLowerCase();
  if (!q) return SATELLITES;
  return SATELLITES.filter(
    (s) =>
      s.name.toLowerCase().includes(q) ||
      s.shortName.toLowerCase().includes(q) ||
      s.regime.toLowerCase().includes(q) ||
      s.agency.toLowerCase().includes(q)
  );
}
