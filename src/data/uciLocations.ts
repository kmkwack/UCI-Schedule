export type UciMapLocation = {
  code: string;
  name: string;
  latitude: number;
  longitude: number;
};

const UCI_LOCATION_MAP: Record<string, UciMapLocation> = {
  ALP: { code: 'ALP', name: 'Aldrich Park', latitude: 33.646358, longitude: -117.842751 },
  BS3: { code: 'BS3', name: 'Biological Sciences III', latitude: 33.645302, longitude: -117.846061 },
  DBH: { code: 'DBH', name: 'Donald Bren Hall', latitude: 33.643418, longitude: -117.841692 },
  ELH: { code: 'ELH', name: 'Engineering Lecture Hall', latitude: 33.643811, longitude: -117.841057 },
  EH: { code: 'EH', name: 'Engineering Hall', latitude: 33.643256, longitude: -117.840714 },
  HIB: { code: 'HIB', name: 'Humanities Instructional Building', latitude: 33.647548, longitude: -117.842358 },
  HH: { code: 'HH', name: 'Humanities Hall', latitude: 33.647027, longitude: -117.842025 },
  HSLH: { code: 'HSLH', name: 'Humanities & Social Sciences Lecture Hall', latitude: 33.647094, longitude: -117.844214 },
  ICS: { code: 'ICS', name: 'Information & Computer Science', latitude: 33.644088, longitude: -117.841307 },
  ISEB: { code: 'ISEB', name: 'Interdisciplinary Science & Engineering Building', latitude: 33.644834, longitude: -117.843043 },
  MSTB: { code: 'MSTB', name: 'Multipurpose Science & Technology Building', latitude: 33.643511, longitude: -117.844311 },
  NS1: { code: 'NS1', name: 'Natural Sciences I', latitude: 33.644295, longitude: -117.846699 },
  NS2: { code: 'NS2', name: 'Natural Sciences II', latitude: 33.644938, longitude: -117.846414 },
  PCB: { code: 'PCB', name: 'Parkview Classroom Building', latitude: 33.64698, longitude: -117.848469 },
  PSLH: { code: 'PSLH', name: 'Physical Sciences Lecture Hall', latitude: 33.644529, longitude: -117.845621 },
  RH: { code: 'RH', name: 'Rowland Hall', latitude: 33.644123, longitude: -117.844938 },
  SH: { code: 'SH', name: 'Steinhaus Hall', latitude: 33.645882, longitude: -117.844959 },
  SSL: { code: 'SSL', name: 'Social Science Lecture Hall', latitude: 33.648099, longitude: -117.844949 },
  SST: { code: 'SST', name: 'Social Science Tower', latitude: 33.649214, longitude: -117.844709 },
  SSTR: { code: 'SSTR', name: 'Social Science Tower', latitude: 33.649214, longitude: -117.844709 },
};

function normalizeToken(value: string) {
  return value.trim().toUpperCase().replace(/[^A-Z0-9 ]/g, ' ');
}

export function getUciMapLocation(rawLocation?: string | null): UciMapLocation | null {
  if (!rawLocation) return null;
  const normalized = normalizeToken(rawLocation);
  if (!normalized || normalized.includes('ONLINE') || normalized.includes('REMOTE') || normalized === 'TBA') return null;

  const [firstToken] = normalized.split(/\s+/).filter(Boolean);
  if (firstToken && UCI_LOCATION_MAP[firstToken]) return UCI_LOCATION_MAP[firstToken];

  for (const location of Object.values(UCI_LOCATION_MAP)) {
    if (normalized.includes(location.name.toUpperCase())) return location;
  }

  return null;
}
