export type UciMapLocation = {
  code: string;
  name: string;
  latitude: number;
  longitude: number;
};

const UCI_LOCATION_MAP: Record<string, UciMapLocation> = {
  ALP: { code: 'ALP', name: 'Aldrich Park', latitude: 33.646358, longitude: -117.842751 },
  ALH: { code: 'ALH', name: 'Aldrich Hall', latitude: 33.647677, longitude: -117.841761 },
  BS2: { code: 'BS2', name: 'Biological Sciences II', latitude: 33.645522, longitude: -117.846372 },
  BS3: { code: 'BS3', name: 'Biological Sciences III', latitude: 33.645302, longitude: -117.846061 },
  BSC: { code: 'BSC', name: 'Bio Sci Classroom', latitude: 33.645018, longitude: -117.846009 },
  DBH: { code: 'DBH', name: 'Donald Bren Hall', latitude: 33.643418, longitude: -117.841692 },
  ELH: { code: 'ELH', name: 'Engineering Lecture Hall', latitude: 33.643811, longitude: -117.841057 },
  EH: { code: 'EH', name: 'Engineering Hall', latitude: 33.643256, longitude: -117.840714 },
  FRH: { code: 'FRH', name: 'Frederick Reines Hall', latitude: 33.643872, longitude: -117.845312 },
  HG: { code: 'HG', name: 'Humanities Gateway', latitude: 33.648094, longitude: -117.842768 },
  HIB: { code: 'HIB', name: 'Humanities Instructional Building', latitude: 33.647548, longitude: -117.842358 },
  HH: { code: 'HH', name: 'Humanities Hall', latitude: 33.647027, longitude: -117.842025 },
  HSLH: { code: 'HSLH', name: 'Humanities & Social Sciences Lecture Hall', latitude: 33.647094, longitude: -117.844214 },
  ICF: { code: 'ICF', name: 'Intercollegiate Athletics Facility', latitude: 33.650697, longitude: -117.846916 },
  ICS: { code: 'ICS', name: 'Information & Computer Science', latitude: 33.644088, longitude: -117.841307 },
  ISEB: { code: 'ISEB', name: 'Interdisciplinary Science & Engineering Building', latitude: 33.644834, longitude: -117.843043 },
  MSTB: { code: 'MSTB', name: 'Multipurpose Science & Technology Building', latitude: 33.643511, longitude: -117.844311 },
  NS1: { code: 'NS1', name: 'Natural Sciences I', latitude: 33.644295, longitude: -117.846699 },
  NS2: { code: 'NS2', name: 'Natural Sciences II', latitude: 33.644938, longitude: -117.846414 },
  PCB: { code: 'PCB', name: 'Parkview Classroom Building', latitude: 33.64698, longitude: -117.848469 },
  PSLH: { code: 'PSLH', name: 'Physical Sciences Lecture Hall', latitude: 33.644529, longitude: -117.845621 },
  RH: { code: 'RH', name: 'Rowland Hall', latitude: 33.644123, longitude: -117.844938 },
  SB1: { code: 'SB1', name: 'Student Center', latitude: 33.649868, longitude: -117.842352 },
  SB2: { code: 'SB2', name: 'Student Center', latitude: 33.649868, longitude: -117.842352 },
  SE: { code: 'SE', name: 'Social Ecology I', latitude: 33.649212, longitude: -117.847174 },
  SE2: { code: 'SE2', name: 'Social Ecology II', latitude: 33.649539, longitude: -117.847623 },
  SH: { code: 'SH', name: 'Steinhaus Hall', latitude: 33.645882, longitude: -117.844959 },
  SSPA: { code: 'SSPA', name: 'Social Science Plaza A', latitude: 33.648516, longitude: -117.845457 },
  SSPB: { code: 'SSPB', name: 'Social Science Plaza B', latitude: 33.648801, longitude: -117.845222 },
  SSL: { code: 'SSL', name: 'Social Science Lecture Hall', latitude: 33.648099, longitude: -117.844949 },
  SSLH: { code: 'SSLH', name: 'Social Science Lecture Hall', latitude: 33.648099, longitude: -117.844949 },
  SST: { code: 'SST', name: 'Social Science Tower', latitude: 33.649214, longitude: -117.844709 },
  SSTR: { code: 'SSTR', name: 'Social Science Tower', latitude: 33.649214, longitude: -117.844709 },
};

const LOCATION_ALIASES: Record<string, string> = {
  SSLH: 'SSL',
  SSTR: 'SST',
  SSPA: 'SSPA',
  SSPB: 'SSPB',
  SEI: 'SE',
  SEII: 'SE2',
};

function normalizeToken(value: string) {
  return value.trim().toUpperCase().replace(/[^A-Z0-9 ]/g, ' ');
}

export function getUciMapLocation(rawLocation?: string | null): UciMapLocation | null {
  if (!rawLocation) return null;
  const normalized = normalizeToken(rawLocation);
  if (!normalized || normalized.includes('ONLINE') || normalized.includes('REMOTE') || normalized === 'TBA') return null;

  const [firstToken] = normalized.split(/\s+/).filter(Boolean);
  const canonicalToken = firstToken ? (LOCATION_ALIASES[firstToken] ?? firstToken) : null;
  if (canonicalToken && UCI_LOCATION_MAP[canonicalToken]) return UCI_LOCATION_MAP[canonicalToken];

  const compact = normalized.replace(/\s+/g, '');
  for (const [alias, canonical] of Object.entries(LOCATION_ALIASES)) {
    if (compact.startsWith(alias) && UCI_LOCATION_MAP[canonical]) return UCI_LOCATION_MAP[canonical];
  }
  for (const [code, location] of Object.entries(UCI_LOCATION_MAP)) {
    if (compact.startsWith(code)) return location;
  }

  for (const location of Object.values(UCI_LOCATION_MAP)) {
    if (normalized.includes(location.name.toUpperCase())) return location;
  }

  return null;
}
