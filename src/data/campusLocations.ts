import { getSchoolConfig } from './schools';
import type { SportsEvent } from './sportsEvents';

export type CampusMapLocation = {
  code: string;
  name: string;
  latitude: number;
  longitude: number;
};

type LocationMatcher = CampusMapLocation & {
  aliases: string[];
};

export type SportsVenue = {
  name: string;
  latitude: number;
  longitude: number;
};

const CLASSROOM_LOCATIONS: Record<string, LocationMatcher[]> = {
  'UC Irvine': [
    { code: 'ALP', name: 'Aldrich Park', latitude: 33.646358, longitude: -117.842751, aliases: ['ALP', 'ALDRICH PARK'] },
    { code: 'ALH', name: 'Aldrich Hall', latitude: 33.647677, longitude: -117.841761, aliases: ['ALH', 'ALDRICH HALL'] },
    { code: 'BS2', name: 'Biological Sciences II', latitude: 33.645522, longitude: -117.846372, aliases: ['BS2', 'BIOLOGICAL SCIENCES II'] },
    { code: 'BS3', name: 'Biological Sciences III', latitude: 33.645302, longitude: -117.846061, aliases: ['BS3', 'BIOLOGICAL SCIENCES III'] },
    { code: 'BSC', name: 'Bio Sci Classroom', latitude: 33.645018, longitude: -117.846009, aliases: ['BSC', 'BIO SCI CLASSROOM'] },
    { code: 'DBH', name: 'Donald Bren Hall', latitude: 33.643418, longitude: -117.841692, aliases: ['DBH', 'DONALD BREN HALL'] },
    { code: 'ELH', name: 'Engineering Lecture Hall', latitude: 33.643811, longitude: -117.841057, aliases: ['ELH', 'ENGINEERING LECTURE HALL'] },
    { code: 'EH', name: 'Engineering Hall', latitude: 33.643256, longitude: -117.840714, aliases: ['EH', 'ENGINEERING HALL'] },
    { code: 'FRH', name: 'Frederick Reines Hall', latitude: 33.643872, longitude: -117.845312, aliases: ['FRH', 'FREDERICK REINES HALL'] },
    { code: 'HG', name: 'Humanities Gateway', latitude: 33.648094, longitude: -117.842768, aliases: ['HG', 'HUMANITIES GATEWAY'] },
    { code: 'HIB', name: 'Humanities Instructional Building', latitude: 33.647548, longitude: -117.842358, aliases: ['HIB', 'HUMANITIES INSTRUCTIONAL BUILDING'] },
    { code: 'HH', name: 'Humanities Hall', latitude: 33.647027, longitude: -117.842025, aliases: ['HH', 'HUMANITIES HALL'] },
    { code: 'HSLH', name: 'Humanities & Social Sciences Lecture Hall', latitude: 33.647094, longitude: -117.844214, aliases: ['HSLH', 'HUMANITIES SOCIAL SCIENCES LECTURE HALL'] },
    { code: 'ICS', name: 'Information & Computer Science', latitude: 33.644088, longitude: -117.841307, aliases: ['ICS', 'INFORMATION COMPUTER SCIENCE'] },
    { code: 'ISEB', name: 'Interdisciplinary Science & Engineering Building', latitude: 33.644834, longitude: -117.843043, aliases: ['ISEB'] },
    { code: 'MSTB', name: 'Multipurpose Science & Technology Building', latitude: 33.643511, longitude: -117.844311, aliases: ['MSTB'] },
    { code: 'NS1', name: 'Natural Sciences I', latitude: 33.644295, longitude: -117.846699, aliases: ['NS1', 'NATURAL SCIENCES I'] },
    { code: 'NS2', name: 'Natural Sciences II', latitude: 33.644938, longitude: -117.846414, aliases: ['NS2', 'NATURAL SCIENCES II'] },
    { code: 'PCB', name: 'Parkview Classroom Building', latitude: 33.64698, longitude: -117.848469, aliases: ['PCB', 'PARKVIEW CLASSROOM BUILDING'] },
    { code: 'PSLH', name: 'Physical Sciences Lecture Hall', latitude: 33.644529, longitude: -117.845621, aliases: ['PSLH', 'PHYSICAL SCIENCES LECTURE HALL'] },
    { code: 'RH', name: 'Rowland Hall', latitude: 33.644123, longitude: -117.844938, aliases: ['RH', 'ROWLAND HALL'] },
    { code: 'SB1', name: 'Student Center', latitude: 33.649868, longitude: -117.842352, aliases: ['SB1', 'STUDENT CENTER'] },
    { code: 'SB2', name: 'Student Center', latitude: 33.649868, longitude: -117.842352, aliases: ['SB2'] },
    { code: 'SE', name: 'Social Ecology I', latitude: 33.649212, longitude: -117.847174, aliases: ['SE', 'SEI', 'SOCIAL ECOLOGY I'] },
    { code: 'SE2', name: 'Social Ecology II', latitude: 33.649539, longitude: -117.847623, aliases: ['SE2', 'SEII', 'SOCIAL ECOLOGY II'] },
    { code: 'SH', name: 'Steinhaus Hall', latitude: 33.645882, longitude: -117.844959, aliases: ['SH', 'STEINHAUS HALL'] },
    { code: 'SSPA', name: 'Social Science Plaza A', latitude: 33.648516, longitude: -117.845457, aliases: ['SSPA', 'SOCIAL SCIENCE PLAZA A'] },
    { code: 'SSPB', name: 'Social Science Plaza B', latitude: 33.648801, longitude: -117.845222, aliases: ['SSPB', 'SOCIAL SCIENCE PLAZA B'] },
    { code: 'SSL', name: 'Social Science Lecture Hall', latitude: 33.648099, longitude: -117.844949, aliases: ['SSL', 'SSLH', 'SOCIAL SCIENCE LECTURE HALL'] },
    { code: 'SST', name: 'Social Science Tower', latitude: 33.649214, longitude: -117.844709, aliases: ['SST', 'SSTR', 'SOCIAL SCIENCE TOWER'] },
  ],
  'University of Maryland, College Park': [
    { code: 'ESJ', name: 'Edward St. John Learning and Teaching Center', latitude: 38.9866, longitude: -76.9447, aliases: ['ESJ', 'EDWARD ST JOHN'] },
    { code: 'CSI', name: 'Computer Science Instructional Center', latitude: 38.9909, longitude: -76.9367, aliases: ['CSI', 'COMPUTER SCIENCE INSTRUCTIONAL'] },
    { code: 'IRB', name: 'Iribe Center', latitude: 38.9897, longitude: -76.9365, aliases: ['IRB', 'IRIBE'] },
    { code: 'JMZ', name: 'Jimenez Hall', latitude: 38.9852, longitude: -76.9457, aliases: ['JMZ', 'JIMENEZ'] },
    { code: 'TYD', name: 'Tydings Hall', latitude: 38.9846, longitude: -76.9467, aliases: ['TYD', 'TYDINGS'] },
    { code: 'KEY', name: 'Francis Scott Key Hall', latitude: 38.9841, longitude: -76.9462, aliases: ['KEY', 'FRANCIS SCOTT KEY'] },
    { code: 'MTH', name: 'Mathematics Building', latitude: 38.9883, longitude: -76.9407, aliases: ['MTH', 'MATHEMATICS BUILDING'] },
    { code: 'PHY', name: 'Physics Building', latitude: 38.9885, longitude: -76.9418, aliases: ['PHY', 'PHYSICS BUILDING'] },
    { code: 'CHM', name: 'Chemistry Building', latitude: 38.9881, longitude: -76.941, aliases: ['CHM', 'CHEMISTRY BUILDING'] },
    { code: 'PLS', name: 'Plant Sciences Building', latitude: 38.987, longitude: -76.9412, aliases: ['PLS', 'PLANT SCIENCES'] },
    { code: 'SPH', name: 'School of Public Health Building', latitude: 38.9931, longitude: -76.9445, aliases: ['SPH', 'SCHOOL OF PUBLIC HEALTH'] },
    { code: 'VMH', name: 'Van Munching Hall', latitude: 38.9835, longitude: -76.9474, aliases: ['VMH', 'VAN MUNCHING'] },
  ],
  'Cornell University': [
    { code: 'GSH', name: 'Goldwin Smith Hall', latitude: 42.4495, longitude: -76.4831, aliases: ['GSH', 'GOLDWIN SMITH'] },
    { code: 'GATES', name: 'Gates Hall', latitude: 42.4448, longitude: -76.4828, aliases: ['GATES', 'GATES HALL'] },
    { code: 'STATLER', name: 'Statler Hall', latitude: 42.4451, longitude: -76.4821, aliases: ['STATLER', 'STATLER HALL'] },
    { code: 'URIS', name: 'Uris Hall', latitude: 42.4471, longitude: -76.4823, aliases: ['URIS', 'URIS HALL'] },
    { code: 'KENNEDY', name: 'Kennedy Hall', latitude: 42.4486, longitude: -76.4788, aliases: ['KENNEDY', 'KENNEDY HALL'] },
    { code: 'WARREN', name: 'Warren Hall', latitude: 42.449, longitude: -76.4787, aliases: ['WARREN', 'WARREN HALL'] },
    { code: 'DUFFIELD', name: 'Duffield Hall', latitude: 42.4449, longitude: -76.482, aliases: ['DUFFIELD', 'DUFFIELD HALL'] },
    { code: 'PHILLIPS', name: 'Phillips Hall', latitude: 42.4446, longitude: -76.4825, aliases: ['PHILLIPS', 'PHILLIPS HALL'] },
    { code: 'MALOTT', name: 'Malott Hall', latitude: 42.4488, longitude: -76.4782, aliases: ['MALOTT', 'MALOTT HALL'] },
    { code: 'IVES', name: 'Ives Hall', latitude: 42.4473, longitude: -76.4801, aliases: ['IVES', 'IVES HALL'] },
    { code: 'SIBLEY', name: 'Sibley Hall', latitude: 42.4507, longitude: -76.4823, aliases: ['SIBLEY', 'SIBLEY HALL'] },
    { code: 'BAKER', name: 'Baker Laboratory', latitude: 42.4502, longitude: -76.481, aliases: ['BAKER', 'BAKER LAB'] },
  ],
  'Purdue University': [
    { code: 'WALC', name: 'Wilmeth Active Learning Center', latitude: 40.4259, longitude: -86.9138, aliases: ['WALC', 'WILMETH'] },
    { code: 'LWSN', name: 'Lawson Computer Science Building', latitude: 40.4273, longitude: -86.9169, aliases: ['LWSN', 'LAWSON'] },
    { code: 'CL50', name: 'Class of 1950 Lecture Hall', latitude: 40.4251, longitude: -86.9141, aliases: ['CL50', 'CLASS OF 1950'] },
    { code: 'WTHR', name: 'Wetherill Laboratory of Chemistry', latitude: 40.4267, longitude: -86.9144, aliases: ['WTHR', 'WETHERILL'] },
    { code: 'BRNG', name: 'Beering Hall', latitude: 40.425, longitude: -86.9178, aliases: ['BRNG', 'BEERING'] },
    { code: 'ME', name: 'Mechanical Engineering Building', latitude: 40.4282, longitude: -86.9143, aliases: ['ME', 'MECHANICAL ENGINEERING'] },
    { code: 'MSEE', name: 'Materials and Electrical Engineering Building', latitude: 40.4279, longitude: -86.9137, aliases: ['MSEE', 'ELECTRICAL ENGINEERING'] },
    { code: 'FRNY', name: 'Forney Hall of Chemical Engineering', latitude: 40.4278, longitude: -86.915, aliases: ['FRNY', 'FORNEY'] },
    { code: 'RAWL', name: 'Rawls Hall', latitude: 40.4237, longitude: -86.9107, aliases: ['RAWL', 'RAWLS'] },
    { code: 'KRAN', name: 'Krannert Building', latitude: 40.4234, longitude: -86.9107, aliases: ['KRAN', 'KRANNERT'] },
    { code: 'HEAV', name: 'Heavilon Hall', latitude: 40.4241, longitude: -86.9149, aliases: ['HEAV', 'HEAVILON'] },
    { code: 'STEW', name: 'Stewart Center', latitude: 40.4251, longitude: -86.9123, aliases: ['STEW', 'STEWART'] },
  ],
  'University of Illinois Urbana-Champaign': [
    { code: 'CIF', name: 'Campus Instructional Facility', latitude: 40.1059, longitude: -88.2268, aliases: ['CIF', 'CAMPUS INSTRUCTIONAL FACILITY'] },
    { code: 'ECEB', name: 'Electrical and Computer Engineering Building', latitude: 40.1149, longitude: -88.2272, aliases: ['ECEB', 'ELECTRICAL COMPUTER ENGINEERING'] },
    { code: 'SIEBEL', name: 'Siebel Center for Computer Science', latitude: 40.1138, longitude: -88.2249, aliases: ['SIEBEL', 'SIEBEL CENTER'] },
    { code: 'LINCOLN', name: 'Lincoln Hall', latitude: 40.1069, longitude: -88.2291, aliases: ['LINCOLN', 'LINCOLN HALL'] },
    { code: 'GREGORY', name: 'Gregory Hall', latitude: 40.1057, longitude: -88.2286, aliases: ['GREGORY', 'GREGORY HALL'] },
    { code: 'LOOMIS', name: 'Loomis Laboratory', latitude: 40.1112, longitude: -88.2238, aliases: ['LOOMIS', 'LOOMIS LAB'] },
    { code: 'NOYES', name: 'Noyes Laboratory', latitude: 40.1077, longitude: -88.226, aliases: ['NOYES', 'NOYES LAB'] },
    { code: 'FOELLINGER', name: 'Foellinger Auditorium', latitude: 40.1058, longitude: -88.2272, aliases: ['FOELLINGER'] },
    { code: 'ALTGELD', name: 'Altgeld Hall', latitude: 40.1093, longitude: -88.2284, aliases: ['ALTGELD', 'ALTGELD HALL'] },
    { code: 'ARMORY', name: 'Armory', latitude: 40.1059, longitude: -88.2314, aliases: ['ARMORY'] },
    { code: 'BIF', name: 'Business Instructional Facility', latitude: 40.1046, longitude: -88.2285, aliases: ['BIF', 'BUSINESS INSTRUCTIONAL'] },
    { code: 'GRAINGER', name: 'Grainger Engineering Library', latitude: 40.1127, longitude: -88.2269, aliases: ['GRAINGER'] },
  ],
};

const SPORTS_VENUES: Record<string, Array<SportsVenue & { sports?: string[]; aliases: string[] }>> = {
  'UC Irvine': [
    { name: 'Bren Events Center', latitude: 33.64979, longitude: -117.84678, sports: ['basketball', 'volleyball'], aliases: ['bren'] },
    { name: 'Cicerone Field at Anteater Ballpark', latitude: 33.65087, longitude: -117.85047, sports: ['baseball'], aliases: ['ballpark', 'cicerone'] },
    { name: "Anteater Stadium & Vince O'Boyle Track", latitude: 33.64996, longitude: -117.84872, sports: ['soccer', 'track'], aliases: ['stadium', 'track'] },
    { name: 'Anteater Aquatics Complex', latitude: 33.65027, longitude: -117.84633, sports: ['water polo'], aliases: ['aquatics', 'pool'] },
    { name: 'Anteater Tennis Stadium', latitude: 33.65098, longitude: -117.84835, sports: ['tennis'], aliases: ['tennis'] },
    { name: 'Crawford Court', latitude: 33.65035, longitude: -117.84676, aliases: ['crawford'] },
  ],
  'University of Maryland, College Park': [
    { name: 'SECU Stadium', latitude: 38.9904, longitude: -76.9471, sports: ['football'], aliases: ['secu', 'stadium'] },
    { name: 'Xfinity Center', latitude: 38.9956, longitude: -76.941, sports: ['basketball', 'volleyball', 'gymnastics', 'wrestling'], aliases: ['xfinity'] },
    { name: 'Bob "Turtle" Smith Stadium', latitude: 38.9908, longitude: -76.9452, sports: ['baseball'], aliases: ['smith stadium', 'baseball'] },
    { name: 'Ludwig Field', latitude: 38.9894, longitude: -76.9492, sports: ['soccer'], aliases: ['ludwig'] },
    { name: 'Maryland Field Hockey & Lacrosse Complex', latitude: 38.9911, longitude: -76.9482, sports: ['field hockey', 'lacrosse'], aliases: ['field hockey', 'lacrosse complex'] },
    { name: 'Maryland Softball Stadium', latitude: 38.9907, longitude: -76.9461, sports: ['softball'], aliases: ['softball'] },
  ],
  'Cornell University': [
    { name: 'Schoellkopf Field', latitude: 42.4457, longitude: -76.4771, sports: ['football', 'lacrosse'], aliases: ['schoellkopf'] },
    { name: 'Newman Arena', latitude: 42.4457, longitude: -76.4787, sports: ['basketball', 'volleyball', 'wrestling'], aliases: ['newman', 'bartels'] },
    { name: 'Lynah Rink', latitude: 42.4451, longitude: -76.4779, sports: ['hockey'], aliases: ['lynah'] },
    { name: 'Hoy Field', latitude: 42.4475, longitude: -76.4783, sports: ['baseball'], aliases: ['hoy field'] },
    { name: 'Berman Field', latitude: 42.4466, longitude: -76.4756, sports: ['soccer'], aliases: ['berman'] },
    { name: 'Reis Tennis Center', latitude: 42.4473, longitude: -76.4757, sports: ['tennis'], aliases: ['reis', 'tennis'] },
    { name: 'Teagle Pool', latitude: 42.445, longitude: -76.4798, sports: ['swimming', 'diving'], aliases: ['teagle', 'pool'] },
  ],
  'Purdue University': [
    { name: 'Ross-Ade Stadium', latitude: 40.4352, longitude: -86.9185, sports: ['football'], aliases: ['ross ade', 'stadium'] },
    { name: 'Mackey Arena', latitude: 40.433, longitude: -86.9162, sports: ['basketball', 'volleyball', 'wrestling'], aliases: ['mackey'] },
    { name: 'Alexander Field', latitude: 40.4185, longitude: -86.9162, sports: ['baseball'], aliases: ['alexander'] },
    { name: 'Bittinger Stadium', latitude: 40.4184, longitude: -86.9147, sports: ['softball'], aliases: ['bittinger', 'softball'] },
    { name: 'Folk Field', latitude: 40.426, longitude: -86.9226, sports: ['soccer'], aliases: ['folk field'] },
    { name: 'Schwartz Tennis Center', latitude: 40.4216, longitude: -86.9213, sports: ['tennis'], aliases: ['schwartz', 'tennis'] },
    { name: 'Boilermaker Aquatic Center', latitude: 40.428, longitude: -86.9167, sports: ['swimming', 'diving'], aliases: ['aquatic', 'pool'] },
  ],
  'University of Illinois Urbana-Champaign': [
    { name: 'Memorial Stadium', latitude: 40.099, longitude: -88.2358, sports: ['football'], aliases: ['memorial stadium'] },
    { name: 'State Farm Center', latitude: 40.0966, longitude: -88.2359, sports: ['basketball', 'wrestling'], aliases: ['state farm'] },
    { name: 'Illinois Field', latitude: 40.1067, longitude: -88.2364, sports: ['baseball'], aliases: ['illinois field'] },
    { name: 'Eichelberger Field', latitude: 40.1039, longitude: -88.2386, sports: ['softball'], aliases: ['eichelberger', 'softball'] },
    { name: 'Demirjian Park', latitude: 40.1057, longitude: -88.2391, sports: ['soccer', 'track'], aliases: ['demirjian'] },
    { name: 'Huff Hall', latitude: 40.1041, longitude: -88.2296, sports: ['volleyball', 'gymnastics'], aliases: ['huff hall'] },
    { name: 'Atkins Tennis Center', latitude: 40.0959, longitude: -88.2452, sports: ['tennis'], aliases: ['atkins', 'tennis'] },
  ],
};

function normalize(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim();
}

function isUnmappableLocation(rawLocation?: string | null) {
  const normalized = (rawLocation ?? '').trim().toLowerCase();
  return !normalized || normalized === 'tba' || normalized === 'away' || normalized.includes('online') || normalized.includes('remote');
}

function stripRoomSuffix(value: string) {
  return value.replace(/\s+\d+[A-Z]?\s*$/i, '').trim();
}

export function getCampusCenter(school: string): CampusMapLocation {
  const config = getSchoolConfig(school);
  return {
    code: config.id,
    name: config.campus || config.name,
    latitude: config.coordinates.latitude,
    longitude: config.coordinates.longitude,
  };
}

export function getCampusMapLocation(school: string, rawLocation?: string | null): CampusMapLocation | null {
  if (isUnmappableLocation(rawLocation)) return null;
  const schoolLocations = CLASSROOM_LOCATIONS[school] ?? [];
  const normalized = normalize(rawLocation ?? '');
  const firstToken = normalized.split(/\s+/).filter(Boolean)[0] ?? '';
  const compact = normalized.replace(/\s+/g, '');
  const noRoom = normalize(stripRoomSuffix(rawLocation ?? ''));

  for (const location of schoolLocations) {
    const aliases = [location.code, location.name, ...location.aliases].map(normalize);
    if (aliases.some((alias) => firstToken === alias || normalized === alias || noRoom === alias || compact.startsWith(alias.replace(/\s+/g, '')) || normalized.includes(alias))) {
      const { aliases: _aliases, ...mapped } = location;
      return mapped;
    }
  }

  return null;
}

export function getSportsVenueForEvent(school: string, event: SportsEvent): SportsVenue | null {
  if (!event.isHome || isUnmappableLocation(event.location)) return null;

  const sport = event.sport.toLowerCase();
  const location = event.location.toLowerCase();
  const venues = SPORTS_VENUES[school] ?? [];

  const direct = venues.find((venue) => venue.aliases.some((alias) => location.includes(alias.toLowerCase())));
  if (direct) return { name: direct.name, latitude: direct.latitude, longitude: direct.longitude };

  const bySport = venues.find((venue) => venue.sports?.some((token) => sport.includes(token)));
  if (bySport) return { name: bySport.name, latitude: bySport.latitude, longitude: bySport.longitude };

  return null;
}

