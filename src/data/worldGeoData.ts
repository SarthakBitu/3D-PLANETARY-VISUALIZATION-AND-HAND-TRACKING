import { feature } from 'topojson-client';
import type { Feature, FeatureCollection, Geometry, MultiPolygon, Polygon, Position } from 'geojson';
import countriesTopology from 'world-atlas/countries-50m.json';
import { searchCosmicEntities, type CelestialBodyInfo } from './cosmosData';
import { searchSatellites, type SatelliteInfo } from './satelliteData';

export type ContinentId =
  | 'North America'
  | 'South America'
  | 'Europe'
  | 'Africa'
  | 'Asia'
  | 'Oceania'
  | 'Antarctica';

export interface ContinentInfo {
  id: ContinentId;
  name: string;
  lat: number;
  lng: number;
  zoomDistance: number;
  areaKm2: string;
  population: string;
  countriesCount: number;
  highestPeak: string;
  summary: string;
}

export interface CityInfo {
  id: string;
  name: string;
  country: string;
  continent: ContinentId;
  lat: number;
  lng: number;
  population: string;
  elevation: string;
  summary: string;
  isCapital?: boolean;
}

export interface CountryMetadata {
  capital: string;
  continent: ContinentId;
  population: string;
  areaKm2: string;
  region: string;
  summary: string;
}

export interface CountryRecord {
  id: string;
  name: string;
  lat: number;
  lng: number;
  bbox: [number, number, number, number]; // [minLng, minLat, maxLng, maxLat]
  rings: Position[][];
  metadata: CountryMetadata;
}

export interface SearchableLocation {
  type: 'country' | 'city' | 'continent' | 'ocean' | 'cosmic' | 'satellite';
  id: string;
  name: string;
  subtitle: string;
  lat: number;
  lng: number;
  zoomDistance: number;
  countryRecord?: CountryRecord;
  cityInfo?: CityInfo;
  continentInfo?: ContinentInfo;
  cosmicBody?: CelestialBodyInfo;
  satelliteInfo?: SatelliteInfo;
}

export const CONTINENTS: ContinentInfo[] = [
  {
    id: 'North America',
    name: 'North America',
    lat: 44.0,
    lng: -100.0,
    zoomDistance: 2.35,
    areaKm2: '24,709,000 km²',
    population: '602 Million',
    countriesCount: 23,
    highestPeak: 'Denali (6,190 m)',
    summary: 'Spans from Arctic tundra and Canadian Shield lakes to the Rocky Mountains, Great Plains, and tropical Caribbean basin.',
  },
  {
    id: 'South America',
    name: 'South America',
    lat: -15.0,
    lng: -60.0,
    zoomDistance: 2.25,
    areaKm2: '17,840,000 km²',
    population: '439 Million',
    countriesCount: 12,
    highestPeak: 'Aconcagua (6,961 m)',
    summary: 'Home to the Amazon Basin rainforest, the 7,000 km Andes Cordillera, Atacama Desert, and Patagonian ice fields.',
  },
  {
    id: 'Europe',
    name: 'Europe',
    lat: 50.5,
    lng: 14.0,
    zoomDistance: 1.95,
    areaKm2: '10,180,000 km²',
    population: '742 Million',
    countriesCount: 44,
    highestPeak: 'Mount Elbrus (5,642 m)',
    summary: 'Peninsular continent bounded by the Arctic, Atlantic, and Mediterranean, shaped by the Alps, Pyrenees, and Danube basin.',
  },
  {
    id: 'Africa',
    name: 'Africa',
    lat: 4.0,
    lng: 21.0,
    zoomDistance: 2.35,
    areaKm2: '30,370,000 km²',
    population: '1.46 Billion',
    countriesCount: 54,
    highestPeak: 'Kilimanjaro (5,895 m)',
    summary: 'Encompasses the Sahara Desert, Nile River corridor, Congo rainforest, East African Rift Valley, and Kalahari plateau.',
  },
  {
    id: 'Asia',
    name: 'Asia',
    lat: 36.0,
    lng: 96.0,
    zoomDistance: 2.45,
    areaKm2: '44,579,000 km²',
    population: '4.75 Billion',
    countriesCount: 48,
    highestPeak: 'Mount Everest (8,849 m)',
    summary: 'Earth’s largest landmass, spanning Siberian steppe, the Tibetan Plateau and Himalayas, East Asian megacities, and Malay Archipelago.',
  },
  {
    id: 'Oceania',
    name: 'Oceania',
    lat: -23.0,
    lng: 138.0,
    zoomDistance: 2.25,
    areaKm2: '8,525,989 km²',
    population: '45 Million',
    countriesCount: 14,
    highestPeak: 'Puncak Jaya (4,884 m)',
    summary: 'Combines the Australian continent, New Zealand’s Southern Alps, New Guinea highlands, and thousands of Pacific volcanic & coral islands.',
  },
  {
    id: 'Antarctica',
    name: 'Antarctica',
    lat: -82.0,
    lng: 0.0,
    zoomDistance: 2.35,
    areaKm2: '14,200,000 km²',
    population: '~4,500 (Seasonal Research)',
    countriesCount: 0,
    highestPeak: 'Vinson Massif (4,892 m)',
    summary: 'Earth’s southernmost polar continent, covered by a 2.16 km average ice sheet holding ~60% of the planet’s fresh water.',
  },
];

export const MAJOR_OCEANS = [
  { name: 'Pacific Ocean', lat: 0, lng: -155, subtitle: 'Largest & deepest oceanic basin · 165.2M km²' },
  { name: 'Atlantic Ocean', lat: 15, lng: -38, subtitle: 'Separates Americas from Europe & Africa · 106.5M km²' },
  { name: 'Indian Ocean', lat: -18, lng: 76, subtitle: 'Bounded by Asia, Africa & Australia · 70.6M km²' },
  { name: 'Arctic Ocean', lat: 82, lng: 0, subtitle: 'Northernmost polar basin · 14.1M km²' },
  { name: 'Southern Ocean', lat: -63, lng: 45, subtitle: 'Circumpolar Antarctic waters · 21.9M km²' },
];

export const MAJOR_CITIES: CityInfo[] = [
  // North America
  { id: 'nyc', name: 'New York City', country: 'United States of America', continent: 'North America', lat: 40.7128, lng: -74.006, population: '8.3M (Metro 19.6M)', elevation: '10 m', summary: 'Global financial, maritime, and cultural metropolis on the Hudson River estuary.' },
  { id: 'wdc', name: 'Washington, D.C.', country: 'United States of America', continent: 'North America', lat: 38.9072, lng: -77.0369, population: '679K (Metro 6.3M)', elevation: '125 m', summary: 'Federal capital of the United States and headquarters of NASA.', isCapital: true },
  { id: 'lax', name: 'Los Angeles', country: 'United States of America', continent: 'North America', lat: 34.0522, lng: -118.2437, population: '3.8M (Metro 12.8M)', elevation: '89 m', summary: 'Pacific coastal basin anchored by aerospace, film, and trans-Pacific trade.' },
  { id: 'chi', name: 'Chicago', country: 'United States of America', continent: 'North America', lat: 41.8781, lng: -87.6298, population: '2.7M (Metro 9.4M)', elevation: '182 m', summary: 'Great Lakes architectural and rail hub on Lake Michigan.' },
  { id: 'tor', name: 'Toronto', country: 'Canada', continent: 'North America', lat: 43.6532, lng: -79.3832, population: '2.8M (Metro 6.7M)', elevation: '76 m', summary: 'Canada’s largest metropolis situated along the northwestern shore of Lake Ontario.' },
  { id: 'van', name: 'Vancouver', country: 'Canada', continent: 'North America', lat: 49.2827, lng: -123.1207, population: '662K (Metro 2.6M)', elevation: '70 m', summary: 'Deep-water Pacific seaport framed by the Coast Mountains.' },
  { id: 'mex', name: 'Mexico City', country: 'Mexico', continent: 'North America', lat: 19.4326, lng: -99.1332, population: '9.2M (Metro 22.1M)', elevation: '2,240 m', summary: 'High-altitude capital built in the Valley of Mexico.', isCapital: true },
  { id: 'hav', name: 'Havana', country: 'Cuba', continent: 'North America', lat: 23.1136, lng: -82.3666, population: '2.1M', elevation: '59 m', summary: 'Historic Caribbean port city guarding the Straits of Florida.', isCapital: true },

  // South America
  { id: 'rio', name: 'Rio de Janeiro', country: 'Brazil', continent: 'South America', lat: -22.9068, lng: -43.1729, population: '6.7M (Metro 13.7M)', elevation: '11 m', summary: 'Atlantic coastal metropolis set around Guanabara Bay and granite peaks.' },
  { id: 'sao', name: 'São Paulo', country: 'Brazil', continent: 'South America', lat: -23.5505, lng: -46.6333, population: '12.3M (Metro 22.4M)', elevation: '760 m', summary: 'Largest urban agglomeration in the Southern Hemisphere.' },
  { id: 'bra', name: 'Brasília', country: 'Brazil', continent: 'South America', lat: -15.7975, lng: -47.8919, population: '3.1M', elevation: '1,172 m', summary: 'Planned modernist capital on the Central Brazilian Plateau.', isCapital: true },
  { id: 'bue', name: 'Buenos Aires', country: 'Argentina', continent: 'South America', lat: -34.6037, lng: -58.3816, population: '3.1M (Metro 15.6M)', elevation: '25 m', summary: 'Port capital at the mouth of the Río de la Plata estuary.', isCapital: true },
  { id: 'scl', name: 'Santiago', country: 'Chile', continent: 'South America', lat: -33.4489, lng: -70.6693, population: '6.2M', elevation: '570 m', summary: 'Andean valley capital overlooked by snow-capped Cerro El Plomo.', isCapital: true },
  { id: 'lim', name: 'Lima', country: 'Peru', continent: 'South America', lat: -12.0464, lng: -77.0428, population: '10.1M', elevation: '154 m', summary: 'Arid Pacific coastal capital overlooking the Humboldt Current.', isCapital: true },
  { id: 'bog', name: 'Bogotá', country: 'Colombia', continent: 'South America', lat: 4.711, lng: -74.0721, population: '7.9M', elevation: '2,640 m', summary: 'High-Andean savanna capital in northern South America.', isCapital: true },

  // Europe
  { id: 'lon', name: 'London', country: 'United Kingdom', continent: 'Europe', lat: 51.5072, lng: -0.1276, population: '8.9M (Metro 14.8M)', elevation: '11 m', summary: 'Thames River capital straddling the Prime Meridian (0° longitude).', isCapital: true },
  { id: 'par', name: 'Paris', country: 'France', continent: 'Europe', lat: 48.8566, lng: 2.3522, population: '2.1M (Metro 11.2M)', elevation: '35 m', summary: 'Seine River capital of France and European aerospace hub.', isCapital: true },
  { id: 'ber', name: 'Berlin', country: 'Germany', continent: 'Europe', lat: 52.52, lng: 13.405, population: '3.7M', elevation: '34 m', summary: 'Federal capital of Germany on the Spree and Havel rivers.', isCapital: true },
  { id: 'mad', name: 'Madrid', country: 'Spain', continent: 'Europe', lat: 40.4168, lng: -3.7038, population: '3.3M', elevation: '650 m', summary: 'Iberian plateau capital near the geographic center of Spain.', isCapital: true },
  { id: 'rom', name: 'Rome', country: 'Italy', continent: 'Europe', lat: 41.9028, lng: 12.4964, population: '2.8M', elevation: '21 m', summary: 'Mediterranean capital along the Tiber River spanning three millennia.', isCapital: true },
  { id: 'ams', name: 'Amsterdam', country: 'Netherlands', continent: 'Europe', lat: 52.3676, lng: 4.9041, population: '921K', elevation: '2 m', summary: 'North Sea canal metropolis built below sea level across reclaimed polders.', isCapital: true },
  { id: 'zur', name: 'Zurich', country: 'Switzerland', continent: 'Europe', lat: 47.3769, lng: 8.5417, population: '428K', elevation: '408 m', summary: 'Alpine financial and scientific research hub on Lake Zurich.' },
  { id: 'ath', name: 'Athens', country: 'Greece', continent: 'Europe', lat: 37.9838, lng: 23.7275, population: '3.1M', elevation: '70 m', summary: 'Aegean basin capital framed by the Acropolis and Attica hills.', isCapital: true },
  { id: 'sto', name: 'Stockholm', country: 'Sweden', continent: 'Europe', lat: 59.3293, lng: 18.0686, population: '984K', elevation: '28 m', summary: 'Nordic capital spanning 14 islands between Lake Mälaren and the Baltic Sea.', isCapital: true },
  { id: 'mos', name: 'Moscow', country: 'Russia', continent: 'Europe', lat: 55.7558, lng: 37.6173, population: '13.1M', elevation: '156 m', summary: 'Eastern European capital centered on the Moskva River.', isCapital: true },
  { id: 'ist', name: 'Istanbul', country: 'Turkey', continent: 'Europe', lat: 41.0082, lng: 28.9784, population: '15.8M', elevation: '39 m', summary: 'Transcontinental strait metropolis bridging Europe and Asia across the Bosphorus.' },
  { id: 'kyv', name: 'Kyiv', country: 'Ukraine', continent: 'Europe', lat: 50.4501, lng: 30.5234, population: '2.9M', elevation: '179 m', summary: 'Historic Dnieper River capital of Ukraine.', isCapital: true },

  // Africa
  { id: 'cai', name: 'Cairo', country: 'Egypt', continent: 'Africa', lat: 30.0444, lng: 31.2357, population: '10.2M (Metro 22.1M)', elevation: '23 m', summary: 'Nile Delta apex metropolis adjacent to the Giza Plateau.', isCapital: true },
  { id: 'lag', name: 'Lagos', country: 'Nigeria', continent: 'Africa', lat: 6.5244, lng: 3.3792, population: '15.9M', elevation: '41 m', summary: 'Gulf of Guinea coastal megacity and West African commercial center.' },
  { id: 'nbo', name: 'Nairobi', country: 'Kenya', continent: 'Africa', lat: -1.2921, lng: 36.8219, population: '5.3M', elevation: '1,795 m', summary: 'Highland East African capital adjacent to the Great Rift Valley.', isCapital: true },
  { id: 'add', name: 'Addis Ababa', country: 'Ethiopia', continent: 'Africa', lat: 9.032, lng: 38.7469, population: '5.5M', elevation: '2,355 m', summary: 'Ethiopian Highlands capital and African Union headquarters.', isCapital: true },
  { id: 'cas', name: 'Casablanca', country: 'Morocco', continent: 'Africa', lat: 33.5731, lng: -7.5898, population: '3.8M', elevation: '27 m', summary: 'Atlantic seaport of northwestern Africa.' },
  { id: 'cpt', name: 'Cape Town', country: 'South Africa', continent: 'Africa', lat: -33.9249, lng: 18.4241, population: '4.9M', elevation: '25 m', summary: 'Southern tip port city beneath Table Mountain near Cape of Good Hope.' },
  { id: 'jnb', name: 'Johannesburg', country: 'South Africa', continent: 'Africa', lat: -26.2041, lng: 28.0473, population: '6.2M', elevation: '1,753 m', summary: 'Highveld economic hub situated on the mineral-rich Witwatersrand ridge.' },
  { id: 'kin', name: 'Kinshasa', country: 'Dem. Rep. Congo', continent: 'Africa', lat: -4.4419, lng: 15.2663, population: '16.3M', elevation: '240 m', summary: 'Congo River equatorial capital facing Brazzaville across Pool Malebo.', isCapital: true },

  // Asia
  { id: 'tok', name: 'Tokyo', country: 'Japan', continent: 'Asia', lat: 35.6762, lng: 139.6503, population: '14.0M (Metro 37.1M)', elevation: '40 m', summary: 'World’s most populous metropolitan region on Tokyo Bay.', isCapital: true },
  { id: 'seo', name: 'Seoul', country: 'South Korea', continent: 'Asia', lat: 37.5665, lng: 126.978, population: '9.6M (Metro 26.0M)', elevation: '38 m', summary: 'Han River capital encircled by granite mountains on the Korean Peninsula.', isCapital: true },
  { id: 'bei', name: 'Beijing', country: 'China', continent: 'Asia', lat: 39.9042, lng: 116.4074, population: '21.8M', elevation: '43 m', summary: 'Northern China Plain capital south of the Yanshan Mountains.', isCapital: true },
  { id: 'sha', name: 'Shanghai', country: 'China', continent: 'Asia', lat: 31.2304, lng: 121.4737, population: '24.8M', elevation: '4 m', summary: 'Yangtze River Delta deep-water port and East China Sea financial hub.' },
  { id: 'hkg', name: 'Hong Kong', country: 'China', continent: 'Asia', lat: 22.3193, lng: 114.1694, population: '7.5M', elevation: '32 m', summary: 'Pearl River Estuary deep-harbor metropolis.' },
  { id: 'tpe', name: 'Taipei', country: 'Taiwan', continent: 'Asia', lat: 25.033, lng: 121.5654, population: '2.5M (Metro 7.0M)', elevation: '10 m', summary: 'Northern basin city surrounded by Yangmingshan volcanic peaks.', isCapital: true },
  { id: 'del', name: 'New Delhi', country: 'India', continent: 'Asia', lat: 28.6139, lng: 77.209, population: '32.9M (NCR)', elevation: '216 m', summary: 'Indo-Gangetic plain capital along the Yamuna River.', isCapital: true },
  { id: 'bom', name: 'Mumbai', country: 'India', continent: 'Asia', lat: 19.076, lng: 72.8777, population: '21.3M', elevation: '14 m', summary: 'Arabian Sea island-peninsula metropolis and India’s maritime commercial hub.' },
  { id: 'blr', name: 'Bengaluru', country: 'India', continent: 'Asia', lat: 12.9716, lng: 77.5946, population: '13.6M', elevation: '920 m', summary: 'Deccan Plateau aerospace and technology center in southern India.' },
  { id: 'sin', name: 'Singapore', country: 'Singapore', continent: 'Asia', lat: 1.3521, lng: 103.8198, population: '5.9M', elevation: '15 m', summary: 'Equatorial island city-state at the southern tip of the Malay Peninsula.', isCapital: true },
  { id: 'bkk', name: 'Bangkok', country: 'Thailand', continent: 'Asia', lat: 13.7563, lng: 100.5018, population: '11.1M', elevation: '1.5 m', summary: 'Chao Phraya delta capital near the Gulf of Thailand.', isCapital: true },
  { id: 'jkt', name: 'Jakarta', country: 'Indonesia', continent: 'Asia', lat: -6.2088, lng: 106.8456, population: '11.2M (Metro 32M)', elevation: '8 m', summary: 'Java Sea coastal capital across the Indonesian archipelago.', isCapital: true },
  { id: 'mnl', name: 'Manila', country: 'Philippines', continent: 'Asia', lat: 14.5995, lng: 120.9842, population: '14.6M (Metro)', elevation: '16 m', summary: 'Luzon island capital situated on Manila Bay.', isCapital: true },
  { id: 'dxb', name: 'Dubai', country: 'United Arab Emirates', continent: 'Asia', lat: 25.2048, lng: 55.2708, population: '3.6M', elevation: '5 m', summary: 'Persian Gulf aviation and maritime crossroads on the Arabian Peninsula.' },
  { id: 'ruh', name: 'Riyadh', country: 'Saudi Arabia', continent: 'Asia', lat: 24.7136, lng: 46.6753, population: '7.6M', elevation: '612 m', summary: 'Central Arabian plateau capital surrounded by desert escarpments.', isCapital: true },
  { id: 'khi', name: 'Karachi', country: 'Pakistan', continent: 'Asia', lat: 24.8607, lng: 67.0011, population: '17.2M', elevation: '8 m', summary: 'Arabian Sea port city northwest of the Indus River delta.' },

  // Oceania
  { id: 'syd', name: 'Sydney', country: 'Australia', continent: 'Oceania', lat: -33.8688, lng: 151.2093, population: '5.4M', elevation: '19 m', summary: 'Tasman Sea harbor city framed by the Blue Mountains to the west.' },
  { id: 'mel', name: 'Melbourne', country: 'Australia', continent: 'Oceania', lat: -37.8136, lng: 144.9631, population: '5.2M', elevation: '31 m', summary: 'Port Phillip Bay metropolis on Australia’s southeastern coast.' },
  { id: 'per', name: 'Perth', country: 'Australia', continent: 'Oceania', lat: -31.9505, lng: 115.8605, population: '2.2M', elevation: '31 m', summary: 'Indian Ocean coastal city on the Swan River.' },
  { id: 'akl', name: 'Auckland', country: 'New Zealand', continent: 'Oceania', lat: -36.8509, lng: 174.7645, population: '1.7M', elevation: '26 m', summary: 'North Island volcanic isthmus city bridging Waitematā and Manukau harbors.' },
  { id: 'wlg', name: 'Wellington', country: 'New Zealand', continent: 'Oceania', lat: -41.2865, lng: 174.7762, population: '434K', elevation: '20 m', summary: 'Cook Strait capital—the world’s southernmost sovereign capital.', isCapital: true },

  // Polar / Spaceflight landmarks
  { id: 'rek', name: 'Reykjavik', country: 'Iceland', continent: 'Europe', lat: 64.1466, lng: -21.9426, population: '139K', elevation: '15 m', summary: 'World’s northernmost sovereign capital sitting atop the Mid-Atlantic Ridge.', isCapital: true },
  { id: 'mcm', name: 'McMurdo Station', country: 'Antarctica', continent: 'Antarctica', lat: -77.8419, lng: 166.6863, population: '~1,000 (Summer)', elevation: '10 m', summary: 'Primary Antarctic scientific logistics base on Ross Island.' },
];

// Curated detailed metadata for major countries; remaining territories infer continent accurately by centroid
const COUNTRY_METADATA_BY_NAME: Record<string, Partial<CountryMetadata>> = {
  'United States of America': { capital: 'Washington, D.C.', continent: 'North America', population: '334.9M', areaKm2: '9,833,520 km²', region: 'Northern America', summary: 'Transcontinental republic spanning Atlantic to Pacific coasts, Alaska, and Hawaii.' },
  'Canada': { capital: 'Ottawa', continent: 'North America', population: '40.1M', areaKm2: '9,984,670 km²', region: 'Northern America', summary: 'Second-largest country on Earth with the longest coastline and Boreal Shield.' },
  'Mexico': { capital: 'Mexico City', continent: 'North America', population: '128.5M', areaKm2: '1,964,375 km²', region: 'Central America', summary: 'Mountainous nation bridging North America and the Central American isthmus.' },
  'Brazil': { capital: 'Brasília', continent: 'South America', population: '216.4M', areaKm2: '8,515,767 km²', region: 'South America', summary: 'Largest South American nation, encompassing 60% of the Amazon rainforest.' },
  'Argentina': { capital: 'Buenos Aires', continent: 'South America', population: '46.2M', areaKm2: '2,780,400 km²', region: 'South America', summary: 'Extends from subtropical Gran Chaco through the Pampas to Tierra del Fuego.' },
  'Chile': { capital: 'Santiago', continent: 'South America', population: '19.6M', areaKm2: '756,102 km²', region: 'South America', summary: '4,300 km ribbon along the Andes and Pacific Coast from Atacama to Cape Horn.' },
  'Peru': { capital: 'Lima', continent: 'South America', population: '34.4M', areaKm2: '1,285,216 km²', region: 'South America', summary: 'Spans arid Pacific coast, high Andean Altiplano, and upper Amazon headwaters.' },
  'Colombia': { capital: 'Bogotá', continent: 'South America', population: '52.1M', areaKm2: '1,141,748 km²', region: 'South America', summary: 'Only South American country bordering both the Pacific Ocean and Caribbean Sea.' },
  'United Kingdom': { capital: 'London', continent: 'Europe', population: '67.7M', areaKm2: '242,495 km²', region: 'Northern Europe', summary: 'Island nation off northwestern Europe spanning Great Britain and Northern Ireland.' },
  'France': { capital: 'Paris', continent: 'Europe', population: '68.2M', areaKm2: '643,801 km²', region: 'Western Europe', summary: 'Extends from the English Channel and Atlantic to the Alps and Mediterranean.' },
  'Germany': { capital: 'Berlin', continent: 'Europe', population: '84.4M', areaKm2: '357,592 km²', region: 'Central Europe', summary: 'Central European nation bordered by the North Sea, Baltic Sea, and Bavarian Alps.' },
  'Italy': { capital: 'Rome', continent: 'Europe', population: '58.9M', areaKm2: '301,340 km²', region: 'Southern Europe', summary: 'Mediterranean peninsula extending from the Alps through the Apennines to Sicily.' },
  'Spain': { capital: 'Madrid', continent: 'Europe', population: '48.3M', areaKm2: '505,990 km²', region: 'Southern Europe', summary: 'Occupies most of the Iberian Peninsula alongside Balearic and Canary islands.' },
  'Ukraine': { capital: 'Kyiv', continent: 'Europe', population: '36.7M', areaKm2: '603,550 km²', region: 'Eastern Europe', summary: 'Largest country wholly within Europe, bisected by the Dnieper River.' },
  'Russia': { capital: 'Moscow', continent: 'Asia', population: '144.4M', areaKm2: '17,098,246 km²', region: 'Eurasia', summary: 'Earth’s largest country spanning 11 time zones from Eastern Europe to the Bering Strait.' },
  'Turkey': { capital: 'Ankara', continent: 'Asia', population: '85.8M', areaKm2: '783,562 km²', region: 'Western Asia / Europe', summary: 'Anatolian and Thracian bridge connecting the Black Sea and Mediterranean.' },
  'Egypt': { capital: 'Cairo', continent: 'Africa', population: '112.7M', areaKm2: '1,010,408 km²', region: 'Northern Africa', summary: 'Nile Valley and Sinai Peninsula nation linking Africa and Southwest Asia.' },
  'Nigeria': { capital: 'Abuja', continent: 'Africa', population: '223.8M', areaKm2: '923,768 km²', region: 'Western Africa', summary: 'Africa’s most populous nation situated along the Niger River and Gulf of Guinea.' },
  'South Africa': { capital: 'Pretoria / Cape Town', continent: 'Africa', population: '60.4M', areaKm2: '1,221,037 km²', region: 'Southern Africa', summary: 'Occupies the southern tip of Africa where the Atlantic and Indian oceans meet.' },
  'Kenya': { capital: 'Nairobi', continent: 'Africa', population: '55.1M', areaKm2: '580,367 km²', region: 'Eastern Africa', summary: 'Equatorial East African nation spanning Indian Ocean coral coast to Mount Kenya.' },
  'Morocco': { capital: 'Rabat', continent: 'Africa', population: '37.8M', areaKm2: '446,550 km²', region: 'Northern Africa', summary: 'Maghreb kingdom bordered by the Strait of Gibraltar, Atlas Mountains, and Sahara.' },
  'India': { capital: 'New Delhi', continent: 'Asia', population: '1.43B', areaKm2: '3,287,263 km²', region: 'Southern Asia', summary: 'South Asian subcontinent bounded by the Himalayas, Bay of Bengal, and Arabian Sea.' },
  'China': { capital: 'Beijing', continent: 'Asia', population: '1.41B', areaKm2: '9,596,961 km²', region: 'Eastern Asia', summary: 'Spans from the Tibetan Plateau and Gobi Desert to the Yellow and South China seas.' },
  'Japan': { capital: 'Tokyo', continent: 'Asia', population: '124.5M', areaKm2: '377,975 km²', region: 'Eastern Asia', summary: 'Pacific volcanic island arc stretching across Honshu, Hokkaido, Kyushu, and Shikoku.' },
  'South Korea': { capital: 'Seoul', continent: 'Asia', population: '51.7M', areaKm2: '100,210 km²', region: 'Eastern Asia', summary: 'Occupies the southern Korean Peninsula between the Yellow Sea and Sea of Japan.' },
  'Indonesia': { capital: 'Jakarta', continent: 'Asia', population: '277.5M', areaKm2: '1,904,569 km²', region: 'Southeast Asia', summary: 'World’s largest archipelagic state spanning over 17,000 equatorial islands.' },
  'Saudi Arabia': { capital: 'Riyadh', continent: 'Asia', population: '36.9M', areaKm2: '2,149,690 km²', region: 'Western Asia', summary: 'Covers most of the Arabian Peninsula between the Red Sea and Persian Gulf.' },
  'Australia': { capital: 'Canberra', continent: 'Oceania', population: '26.6M', areaKm2: '7,692,024 km²', region: 'Australia & New Zealand', summary: 'Continent-nation bounded by the Indian and Pacific oceans, home to the Great Barrier Reef.' },
  'New Zealand': { capital: 'Wellington', continent: 'Oceania', population: '5.2M', areaKm2: '268,021 km²', region: 'Australia & New Zealand', summary: 'Southwestern Pacific island nation defined by geothermal plateaus and Southern Alps.' },
  'Greenland': { capital: 'Nuuk', continent: 'North America', population: '56.6K', areaKm2: '2,166,086 km²', region: 'Arctic North America', summary: 'World’s largest island, 80% covered by the North Atlantic Arctic ice sheet.' },
  'Antarctica': { capital: 'N/A', continent: 'Antarctica', population: '~4,500 (Seasonal)', areaKm2: '14,200,000 km²', region: 'South Polar', summary: 'International scientific reserve governed under the Antarctic Treaty System.' },
  'Iceland': { capital: 'Reykjavik', continent: 'Europe', population: '393K', areaKm2: '103,000 km²', region: 'Northern Europe', summary: 'Subpolar volcanic island astride the divergent North American–Eurasian plate boundary.' },
};

function inferContinentFromCoords(lat: number, lng: number, name: string): ContinentId {
  if (lat < -60 || name === 'Antarctica') return 'Antarctica';
  if (lng < -30) {
    if (lat > 12.5 || (lat > 7 && lng < -77)) return 'North America';
    return 'South America';
  }
  if (lng >= -30 && lng <= 60) {
    if (lat > 35.5 && !(lng > 26 && lat < 42 && name !== 'Greece' && name !== 'Bulgaria')) {
      // Distinguish Europe vs Western Asia / North Africa
      if (lng > 44 && lat < 44) return 'Asia';
      return 'Europe';
    }
    if (lat >= 12 && lng > 34.5) return 'Asia';
    return 'Africa';
  }
  if (lat < -10 && lng > 110) return 'Oceania';
  if (lat < 5 && lng > 141) return 'Oceania';
  return 'Asia';
}

function extractRingsAndStats(geometry: Geometry): {
  rings: Position[][];
  bbox: [number, number, number, number];
  centroid: [number, number];
} {
  const rings: Position[][] = [];
  let minLng = 180;
  let maxLng = -180;
  let minLat = 90;
  let maxLat = -90;

  let bestRing: Position[] = [];
  let bestArea = -1;

  const processPolygon = (coords: Position[][]) => {
    if (!coords.length) return;
    const outer = coords[0];
    rings.push(outer);
    // Estimate signed area for primary landmass centroid
    let area = 0;
    for (let i = 0; i < outer.length; i++) {
      const [lng, lat] = outer[i];
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
      const [lng2, lat2] = outer[(i + 1) % outer.length];
      area += lng * lat2 - lng2 * lat;
    }
    const absArea = Math.abs(area);
    if (absArea > bestArea) {
      bestArea = absArea;
      bestRing = outer;
    }
  };

  if (geometry.type === 'Polygon') {
    processPolygon((geometry as Polygon).coordinates);
  } else if (geometry.type === 'MultiPolygon') {
    for (const poly of (geometry as MultiPolygon).coordinates) {
      processPolygon(poly);
    }
  }

  let cLng = (minLng + maxLng) / 2;
  let cLat = (minLat + maxLat) / 2;
  if (bestRing.length > 0) {
    let sumLng = 0;
    let sumLat = 0;
    for (const [lng, lat] of bestRing) {
      sumLng += lng;
      sumLat += lat;
    }
    cLng = sumLng / bestRing.length;
    cLat = sumLat / bestRing.length;
  }

  return {
    rings,
    bbox: [minLng, minLat, maxLng, maxLat],
    centroid: [cLat, cLng],
  };
}

let cachedCountries: CountryRecord[] | null = null;
let cachedGeoCollection: FeatureCollection | null = null;

export function getWorldGeoCollection(): FeatureCollection {
  if (!cachedGeoCollection) {
    cachedGeoCollection = feature(
      countriesTopology as unknown as Parameters<typeof feature>[0],
      countriesTopology.objects.countries as unknown as Parameters<typeof feature>[1]
    ) as unknown as FeatureCollection;
  }
  return cachedGeoCollection;
}

export function getLandGeoCollection(): FeatureCollection {
  return feature(
    countriesTopology as unknown as Parameters<typeof feature>[0],
    countriesTopology.objects.land as unknown as Parameters<typeof feature>[1]
  ) as unknown as FeatureCollection;
}

export function getCountries(): CountryRecord[] {
  if (cachedCountries) return cachedCountries;

  const fc = getWorldGeoCollection();
  const records: CountryRecord[] = [];

  for (const feat of fc.features as Feature[]) {
    if (!feat.geometry) continue;
    const name = (feat.properties?.name as string) || `Territory ${feat.id ?? ''}`;
    const id = String(feat.id ?? name);
    const { rings, bbox, centroid } = extractRingsAndStats(feat.geometry);
    if (rings.length === 0) continue;

    const custom = COUNTRY_METADATA_BY_NAME[name];
    const continent = custom?.continent ?? inferContinentFromCoords(centroid[0], centroid[1], name);
    const approxSpanDeg = Math.max(bbox[2] - bbox[0], bbox[3] - bbox[1]);

    records.push({
      id,
      name,
      lat: centroid[0],
      lng: centroid[1],
      bbox,
      rings,
      metadata: {
        capital: custom?.capital ?? 'See regional profile',
        continent,
        population: custom?.population ?? 'Sovereign / Territory',
        areaKm2: custom?.areaKm2 ?? (approxSpanDeg > 15 ? 'Large Continental Region' : 'Regional Territory'),
        region: custom?.region ?? continent,
        summary:
          custom?.summary ??
          `${name} is located in ${continent} centered near ${Math.abs(centroid[0]).toFixed(1)}°${centroid[0] >= 0 ? 'N' : 'S'}, ${Math.abs(centroid[1]).toFixed(1)}°${centroid[1] >= 0 ? 'E' : 'W'}.`,
      },
    });
  }

  cachedCountries = records.sort((a, b) => a.name.localeCompare(b.name));
  return cachedCountries;
}

function pointInRing(lng: number, lat: number, ring: Position[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];
    if (Math.abs(xi - xj) > 180) continue; // skip antimeridian wrap edge
    const intersect = yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi + 1e-12) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

export function findCountryAtLatLng(lat: number, lng: number): CountryRecord | null {
  const countries = getCountries();
  for (const country of countries) {
    const [minLng, minLat, maxLng, maxLat] = country.bbox;
    if (lat < minLat || lat > maxLat || lng < minLng || lng > maxLng) continue;
    for (const ring of country.rings) {
      if (pointInRing(lng, lat, ring)) {
        return country;
      }
    }
  }
  return null;
}

export function findOceanAtLatLng(lat: number, lng: number): { name: string; subtitle: string } {
  if (lat > 66.5) return MAJOR_OCEANS[3]; // Arctic Ocean
  if (lat < -60) return MAJOR_OCEANS[4]; // Southern Ocean
  if (lng >= 20 && lng <= 146 && lat < 30) return MAJOR_OCEANS[2]; // Indian Ocean
  if (lng > -70 && lng < 20) return MAJOR_OCEANS[1]; // Atlantic Ocean
  if (lng >= -100 && lng <= -70 && lat > 8 && lat < 31) {
    return { name: 'Gulf of Mexico / Caribbean', subtitle: 'Atlantic marginal basin' };
  }
  return MAJOR_OCEANS[0]; // Pacific Ocean
}

export function getSuggestedZoomForCountry(country: CountryRecord): number {
  const span = Math.max(country.bbox[2] - country.bbox[0], country.bbox[3] - country.bbox[1]);
  if (span > 60) return 2.35;
  if (span > 25) return 1.95;
  if (span > 10) return 1.68;
  if (span > 4) return 1.48;
  return 1.34;
}

export function searchAllLocations(query: string): SearchableLocation[] {
  const q = query.trim().toLowerCase();
  const results: SearchableLocation[] = [];

  for (const body of searchCosmicEntities(query)) {
    results.push({
      type: 'cosmic',
      id: `cosmic-${body.id}`,
      name: body.name,
      subtitle: `${body.category} · ${body.distanceLabel}`,
      lat: 0,
      lng: 0,
      zoomDistance: body.defaultFocusDist,
      cosmicBody: body,
    });
  }

  for (const sat of searchSatellites(query)) {
    results.push({
      type: 'satellite',
      id: `sat-${sat.id}`,
      name: sat.name,
      subtitle: `${sat.regime} Satellite · ${sat.altitudeKm}`,
      lat: 0,
      lng: 0,
      zoomDistance: sat.orbitRadius + 0.65,
      satelliteInfo: sat,
    });
  }

  for (const cont of CONTINENTS) {
    if (!q || cont.name.toLowerCase().includes(q)) {
      results.push({
        type: 'continent',
        id: `cont-${cont.id}`,
        name: cont.name,
        subtitle: `Continent · ${cont.areaKm2}`,
        lat: cont.lat,
        lng: cont.lng,
        zoomDistance: cont.zoomDistance,
        continentInfo: cont,
      });
    }
  }

  for (const city of MAJOR_CITIES) {
    if (
      !q ||
      city.name.toLowerCase().includes(q) ||
      city.country.toLowerCase().includes(q)
    ) {
      results.push({
        type: 'city',
        id: `city-${city.id}`,
        name: city.name,
        subtitle: `${city.country} · ${city.continent}`,
        lat: city.lat,
        lng: city.lng,
        zoomDistance: 1.36,
        cityInfo: city,
      });
    }
  }

  for (const country of getCountries()) {
    if (
      !q ||
      country.name.toLowerCase().includes(q) ||
      country.metadata.continent.toLowerCase().includes(q) ||
      country.metadata.capital.toLowerCase().includes(q)
    ) {
      results.push({
        type: 'country',
        id: `country-${country.id}`,
        name: country.name,
        subtitle: `Country · ${country.metadata.continent}`,
        lat: country.lat,
        lng: country.lng,
        zoomDistance: getSuggestedZoomForCountry(country),
        countryRecord: country,
      });
    }
  }

  for (const ocean of MAJOR_OCEANS) {
    if (!q || ocean.name.toLowerCase().includes(q)) {
      results.push({
        type: 'ocean',
        id: `ocean-${ocean.name}`,
        name: ocean.name,
        subtitle: ocean.subtitle,
        lat: ocean.lat,
        lng: ocean.lng,
        zoomDistance: 2.55,
      });
    }
  }

  if (!q) {
    // Default curated mix
    return results.slice(0, 24);
  }

  // Prioritize exact prefix matches
  results.sort((a, b) => {
    const aStarts = a.name.toLowerCase().startsWith(q) ? 0 : 1;
    const bStarts = b.name.toLowerCase().startsWith(q) ? 0 : 1;
    if (aStarts !== bStarts) return aStarts - bStarts;
    return a.name.localeCompare(b.name);
  });

  return results.slice(0, 32);
}
