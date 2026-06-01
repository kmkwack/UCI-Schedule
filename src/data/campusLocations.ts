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
    { code: 'ALP', name: 'Anteater Learning Pavilion', latitude: 33.647800, longitude: -117.842600, aliases: ['ALP', 'ANTEATER LEARNING PAVILION'] },
    { code: 'ALH', name: 'Aldrich Hall', latitude: 33.647677, longitude: -117.841761, aliases: ['ALH', 'ALDRICH HALL'] },
    { code: 'ACT', name: 'Art Culture and Technology', latitude: 33.650562, longitude: -117.844849, aliases: ['ACT', 'ART CULTURE TECHNOLOGY'] },
    { code: 'AIRB', name: 'Anteater Instruction and Research Building', latitude: 33.642933, longitude: -117.838005, aliases: ['AIRB', 'ANTEATER INSTRUCTION RESEARCH BUILDING'] },
    { code: 'AITR', name: 'Arts Instruction and Technology Resource Center', latitude: 33.649803, longitude: -117.843956, aliases: ['AITR', 'ARTS INSTRUCTION TECHNOLOGY RESOURCE CENTER'] },
    { code: 'ART', name: 'Art Studio', latitude: 33.650131, longitude: -117.844856, aliases: ['ART', 'ART STUDIO'] },
    { code: 'BH', name: 'Berk Hall', latitude: 33.646236, longitude: -117.84951, aliases: ['BH', 'BERK HALL'] },
    { code: 'BS2', name: 'Biological Sciences II', latitude: 33.645522, longitude: -117.846372, aliases: ['BS2', 'BIOLOGICAL SCIENCES II'] },
    { code: 'BS3', name: 'Biological Sciences III', latitude: 33.645302, longitude: -117.846061, aliases: ['BS3', 'BIOLOGICAL SCIENCES III'] },
    { code: 'BSC', name: 'Bio Sci Classroom', latitude: 33.645018, longitude: -117.846009, aliases: ['BSC', 'BIO SCI CLASSROOM'] },
    { code: 'CAC', name: 'Contemporary Arts Center', latitude: 33.650055, longitude: -117.845291, aliases: ['CAC', 'CONTEMPORARY ARTS CENTER'] },
    { code: 'COHS', name: 'Susan and Henry Samueli College of Health Sciences Building', latitude: 33.640957, longitude: -117.85321, aliases: ['COHS', 'COLLEGE OF HEALTH SCIENCES', 'SAMUELI COLLEGE OF HEALTH SCIENCES'] },
    { code: 'CTT', name: 'Claire Trevor Theatre', latitude: 33.649506, longitude: -117.845291, aliases: ['CTT', 'CLAIRE TREVOR THEATRE', 'CLAIRE TREVOR THEATER'] },
    { code: 'CRCC', name: 'Cross-Cultural Center', latitude: 33.647804, longitude: -117.841896, aliases: ['CRCC', 'CROSS CULTURAL CENTER'] },
    { code: 'DBH', name: 'Donald Bren Hall', latitude: 33.643418, longitude: -117.841692, aliases: ['DBH', 'DONALD BREN HALL'] },
    { code: 'DRA', name: 'Drama Building', latitude: 33.649696, longitude: -117.845001, aliases: ['DRA', 'DRAMA BUILDING'] },
    { code: 'DS', name: 'Robert Cohen Theatre and Dance Studios', latitude: 33.649323, longitude: -117.845535, aliases: ['DS', 'DANCE STUDIOS', 'ROBERT COHEN THEATRE DANCE STUDIOS'] },
    { code: 'ECT', name: 'Engineering and Computing Trailer', latitude: 33.644024, longitude: -117.840172, aliases: ['ECT', 'ENGINEERING COMPUTING TRAILER'] },
    { code: 'EDUC', name: 'Education Building', latitude: 33.647293, longitude: -117.835915, aliases: ['EDUC', 'EDUCATION BUILDING'] },
    { code: 'EG', name: 'Engineering Gateway', latitude: 33.643341, longitude: -117.840141, aliases: ['EG', 'ENGINEERING GATEWAY'] },
    { code: 'ELH', name: 'Engineering Lecture Hall', latitude: 33.643811, longitude: -117.841057, aliases: ['ELH', 'ENGINEERING LECTURE HALL'] },
    { code: 'ELF', name: 'Engineering Laboratory Facility', latitude: 33.643787, longitude: -117.83963, aliases: ['ELF', 'ENGINEERING LABORATORY FACILITY'] },
    { code: 'EH', name: 'Engineering Hall', latitude: 33.643256, longitude: -117.840714, aliases: ['EH', 'ENGINEERING HALL'] },
    { code: 'ET', name: 'Engineering Tower', latitude: 33.644829, longitude: -117.841171, aliases: ['ET', 'ENGINEERING TOWER'] },
    { code: 'FRH', name: 'Frederick Reines Hall', latitude: 33.643872, longitude: -117.845312, aliases: ['FRH', 'FREDERICK REINES HALL'] },
    { code: 'GHEI', name: 'Gavin Herbert Eye Institute', latitude: 33.641796, longitude: -117.852249, aliases: ['GHEI', 'GAVIN HERBERT EYE INSTITUTE'] },
    { code: 'GNRF', name: 'Gillespie Neuroscience Research Facility', latitude: 33.644138, longitude: -117.85125, aliases: ['GNRF', 'GILLESPIE NEUROSCIENCE RESEARCH FACILITY'] },
    { code: 'HG', name: 'Humanities Gateway', latitude: 33.648094, longitude: -117.842768, aliases: ['HG', 'HUMANITIES GATEWAY'] },
    { code: 'HICF', name: 'Humanities Interim Classroom Facility', latitude: 33.646908, longitude: -117.84687, aliases: ['HICF', 'HUMANITIES INTERIM CLASSROOM FACILITY', 'STUDIO ART TRAILER'] },
    { code: 'HIB', name: 'Humanities Instructional Building', latitude: 33.647548, longitude: -117.842358, aliases: ['HIB', 'HUMANITIES INSTRUCTIONAL BUILDING'] },
    { code: 'HH', name: 'Humanities Hall', latitude: 33.647027, longitude: -117.842025, aliases: ['HH', 'HUMANITIES HALL'] },
    { code: 'HSLH', name: 'Humanities & Social Sciences Lecture Hall', latitude: 33.647094, longitude: -117.844214, aliases: ['HSLH', 'HUMANITIES SOCIAL SCIENCES LECTURE HALL'] },
    { code: 'IAB', name: 'Intercollegiate Athletics Building', latitude: 33.648182, longitude: -117.84552, aliases: ['IAB', 'INTERCOLLEGIATE ATHLETICS BUILDING'] },
    { code: 'ICS', name: 'Information & Computer Science', latitude: 33.644088, longitude: -117.841307, aliases: ['ICS', 'INFORMATION COMPUTER SCIENCE'] },
    { code: 'ISEB', name: 'Interdisciplinary Science & Engineering Building', latitude: 33.644834, longitude: -117.843043, aliases: ['ISEB'] },
    { code: 'KH', name: 'Murray Krieger Hall', latitude: 33.647694, longitude: -117.843506, aliases: ['KH', 'KRIEGER HALL', 'MURRAY KRIEGER HALL'] },
    { code: 'LAW', name: 'Law Building', latitude: 33.646832, longitude: -117.835915, aliases: ['LAW', 'LAW BUILDING'] },
    { code: 'MAB', name: 'Mesa Arts Building', latitude: 33.650223, longitude: -117.846375, aliases: ['MAB', 'MESA ARTS BUILDING'] },
    { code: 'MESA', name: 'Mesa Court', latitude: 33.651924, longitude: -117.844528, aliases: ['MESA', 'MESA COURT'] },
    { code: 'MDE', name: 'McDonnell Douglas Engineering Auditorium', latitude: 33.643936, longitude: -117.840706, aliases: ['MDE', 'MCDONNELL DOUGLAS ENGINEERING AUDITORIUM'] },
    { code: 'MH', name: 'McGaugh Hall', latitude: 33.645374, longitude: -117.844772, aliases: ['MH', 'MCGAUGH HALL'] },
    { code: 'MM', name: 'Music and Media Building', latitude: 33.649399, longitude: -117.844475, aliases: ['MM', 'MUSIC MEDIA BUILDING'] },
    { code: 'MOB', name: 'Mesa Office Building', latitude: 33.651302, longitude: -117.846367, aliases: ['MOB', 'MESA OFFICE BUILDING'] },
    { code: 'MPAA', name: 'Multipurpose Academic and Administrative Building', latitude: 33.647152, longitude: -117.837029, aliases: ['MPAA', 'MULTIPURPOSE ACADEMIC ADMINISTRATIVE BUILDING'] },
    { code: 'MS2', name: 'Medical Surge II', latitude: 33.646828, longitude: -117.850044, aliases: ['MS2', 'MEDICAL SURGE II'] },
    { code: 'MSTB', name: 'Multipurpose Science & Technology Building', latitude: 33.643511, longitude: -117.844311, aliases: ['MSTB'] },
    { code: 'NS1', name: 'Natural Sciences I', latitude: 33.644295, longitude: -117.846699, aliases: ['NS1', 'NATURAL SCIENCES I'] },
    { code: 'NS2', name: 'Natural Sciences II', latitude: 33.644938, longitude: -117.846414, aliases: ['NS2', 'NATURAL SCIENCES II'] },
    { code: 'PCB', name: 'Parkview Classroom Building', latitude: 33.64698, longitude: -117.848469, aliases: ['PCB', 'PARKVIEW CLASSROOM BUILDING'] },
    { code: 'PH', name: 'Plumwood House', latitude: 33.644901, longitude: -117.851181, aliases: ['PH', 'PLUMWOOD HOUSE'] },
    { code: 'PSCB', name: 'Physical Sciences Classroom Building', latitude: 33.643444, longitude: -117.843529, aliases: ['PSCB', 'PHYSICAL SCIENCES CLASSROOM BUILDING'] },
    { code: 'PSLH', name: 'Physical Sciences Lecture Hall', latitude: 33.644529, longitude: -117.845621, aliases: ['PSLH', 'PHYSICAL SCIENCES LECTURE HALL'] },
    { code: 'PSTU', name: 'William J. Gillespie Performance Studios', latitude: 33.650639, longitude: -117.845238, aliases: ['PSTU', 'PERFORMANCE STUDIOS', 'GILLESPIE PERFORMANCE STUDIOS'] },
    { code: 'REC', name: 'Rockwell Engineering Center', latitude: 33.643925, longitude: -117.840538, aliases: ['REC', 'ROCKWELL ENGINEERING CENTER'] },
    { code: 'RH', name: 'Rowland Hall', latitude: 33.644123, longitude: -117.844938, aliases: ['RH', 'ROWLAND HALL'] },
    { code: 'SB1', name: 'Student Center', latitude: 33.649868, longitude: -117.842352, aliases: ['SB1', 'STUDENT CENTER'] },
    { code: 'SB2', name: 'Student Center', latitude: 33.649868, longitude: -117.842352, aliases: ['SB2'] },
    { code: 'SBSG', name: 'Social and Behavioral Sciences Gateway', latitude: 33.647446, longitude: -117.839088, aliases: ['SBSG', 'SOCIAL BEHAVIORAL SCIENCES GATEWAY'] },
    { code: 'SCS', name: 'Sculpture and Ceramic Studios', latitude: 33.650318, longitude: -117.844467, aliases: ['SCS', 'SCULPTURE CERAMIC STUDIOS', 'NIXON THEATRE'] },
    { code: 'SE', name: 'Social Ecology I', latitude: 33.649212, longitude: -117.847174, aliases: ['SE', 'SEI', 'SOCIAL ECOLOGY I'] },
    { code: 'SE2', name: 'Social Ecology II', latitude: 33.649539, longitude: -117.847623, aliases: ['SE2', 'SEII', 'SOCIAL ECOLOGY II'] },
    { code: 'SH', name: 'Steinhaus Hall', latitude: 33.645882, longitude: -117.844959, aliases: ['SH', 'STEINHAUS HALL'] },
    { code: 'SPH', name: 'Sprague Hall', latitude: 33.644119, longitude: -117.852074, aliases: ['SPH', 'SPRAGUE HALL'] },
    { code: 'SSPA', name: 'Social Science Plaza A', latitude: 33.648516, longitude: -117.845457, aliases: ['SSPA', 'SOCIAL SCIENCE PLAZA A'] },
    { code: 'SSPB', name: 'Social Science Plaza B', latitude: 33.648801, longitude: -117.845222, aliases: ['SSPB', 'SOCIAL SCIENCE PLAZA B'] },
    { code: 'SS1', name: 'Student Services I & II', latitude: 33.64795, longitude: -117.84098, aliases: ['SS1', 'SS2', 'STUDENT SERVICES', 'STUDENT SERVICES I', 'STUDENT SERVICES II'] },
    { code: 'SSH', name: 'Social Science Hall', latitude: 33.64815, longitude: -117.84455, aliases: ['SSH', 'SOCIAL SCIENCE HALL'] },
    { code: 'SSL', name: 'Social Science Lab', latitude: 33.648099, longitude: -117.844949, aliases: ['SSL', 'SOCIAL SCIENCE LAB', 'SOCIAL SCIENCE LABORATORY'] },
    { code: 'SSLH', name: 'Social Science Lecture Hall', latitude: 33.64802, longitude: -117.84478, aliases: ['SSLH', 'SOCIAL SCIENCE LECTURE HALL'] },
    { code: 'SST', name: 'Social Science Tower', latitude: 33.649214, longitude: -117.844709, aliases: ['SST', 'SSTR', 'SOCIAL SCIENCE TOWER'] },
    { code: 'STU4', name: 'Studio Four', latitude: 33.650146, longitude: -117.845734, aliases: ['STU4', 'STUDIO FOUR'] },
    { code: 'TSLB', name: 'Tamkin Student Lecture Building', latitude: 33.645542, longitude: -117.85199, aliases: ['TSLB', 'TAMKIN STUDENT LECTURE BUILDING'] },
    { code: 'UEA', name: 'Undergraduate Education A', latitude: 33.646507, longitude: -117.837364, aliases: ['UEA', 'UNDERGRADUATE EDUCATION A'] },
  ],
  'University of Maryland, College Park': [
    { code: 'TWS', name: 'Tawes Hall', latitude: 38.98594, longitude: -76.94814, aliases: ['TWS', 'TAWES', 'TAWES HALL'] },
    { code: 'PAC', name: 'Clarice Smith Performing Arts Center', latitude: 38.9901, longitude: -76.9501, aliases: ['PAC', 'CLARICE SMITH PERFORMING ARTS CENTER', 'PERFORMING ARTS CENTER'] },
    { code: 'ASY', name: 'Art-Sociology Building', latitude: 38.9864, longitude: -76.9487, aliases: ['ASY', 'ART SOCIOLOGY', 'ART SOCIOLOGY BUILDING'] },
    { code: 'EGR', name: 'Glenn L. Martin Hall', latitude: 38.9901, longitude: -76.9388, aliases: ['EGR', 'ENGINEERING BUILDING', 'GLENN L MARTIN HALL', 'MARTIN HALL'] },
    { code: 'HJP', name: 'H. J. Patterson Hall', latitude: 38.9887, longitude: -76.9416, aliases: ['HJP', 'H J PATTERSON', 'HJ PATTERSON', 'PATTERSON HALL'] },
    { code: 'ARM', name: 'Reckord Armory', latitude: 38.9853, longitude: -76.9444, aliases: ['ARM', 'ARMORY', 'RECKORD ARMORY'] },
    { code: 'BRB', name: 'Bioscience Research Building', latitude: 38.9892, longitude: -76.9405, aliases: ['BRB', 'BIOSCIENCE RESEARCH BUILDING'] },
    { code: 'EDU', name: 'Benjamin Building', latitude: 38.9874, longitude: -76.9452, aliases: ['EDU', 'BENJAMIN BUILDING', 'EDUCATION BUILDING'] },
    { code: 'BPS', name: 'Biology-Psychology Building', latitude: 38.9886, longitude: -76.9428, aliases: ['BPS', 'BIOLOGY PSYCHOLOGY', 'BIOLOGY PSYCHOLOGY BUILDING'] },
    { code: 'ATL', name: 'Atlantic Building', latitude: 38.9909, longitude: -76.9362, aliases: ['ATL', 'ATLANTIC BUILDING'] },
    { code: 'MMH', name: 'Marie Mount Hall', latitude: 38.986, longitude: -76.9455, aliases: ['MMH', 'MARIE MOUNT', 'MARIE MOUNT HALL'] },
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
    { code: 'RCK', name: 'Rockefeller Hall', latitude: 42.448467, longitude: -76.482481, aliases: ['RCK', 'ROCKEFELLER', 'ROCKEFELLER HALL'] },
    { code: 'HOL', name: 'Hollister Hall', latitude: 42.4441, longitude: -76.4844, aliases: ['HOL', 'HOLLISTER', 'HOLLISTER HALL'] },
    { code: 'UPSON', name: 'Upson Hall', latitude: 42.4449, longitude: -76.4823, aliases: ['UPSON', 'UPSON HALL'] },
    { code: 'MCGRAW', name: 'McGraw Hall', latitude: 42.449, longitude: -76.4836, aliases: ['MCGRAW', 'MCGRAW HALL'] },
    { code: 'WHITE', name: 'White Hall', latitude: 42.4485, longitude: -76.4844, aliases: ['WHITE', 'WHITE HALL'] },
    { code: 'SAGE', name: 'Sage Hall', latitude: 42.445, longitude: -76.4838, aliases: ['SAGE', 'SAGE HALL', 'SAGE GRADUATE HALL'] },
    { code: 'MORRILL', name: 'Morrill Hall', latitude: 42.4488, longitude: -76.4849, aliases: ['MORRILL', 'MORRILL HALL'] },
    { code: 'CORNELLTECH', name: 'Cornell Tech Bloomberg Center', latitude: 40.7556, longitude: -73.9566, aliases: ['CORNELL TECH', 'BLOOMBERG CENTER', 'CORNELL TECH BLOOMBERG CENTER'] },
    { code: 'CLARK', name: 'Clark Hall', latitude: 42.4497, longitude: -76.4816, aliases: ['CLARK', 'CLARK HALL'] },
    { code: 'MYRON', name: 'Myron Taylor Hall', latitude: 42.4445, longitude: -76.486, aliases: ['MYRON TAYLOR', 'MYRON TAYLOR HALL'] },
    { code: 'MVR', name: 'Martha Van Rensselaer Hall', latitude: 42.4508, longitude: -76.4789, aliases: ['MVR', 'M VAN RENSSELAER', 'MARTHA VAN RENSSELAER', 'VAN RENSSELAER HALL'] },
    { code: 'PLANTSCI', name: 'Plant Science Building', latitude: 42.4484, longitude: -76.477, aliases: ['PLANT SCIENCE', 'PLANT SCIENCE BUILDING'] },
    { code: 'OLIN', name: 'Olin Hall', latitude: 42.4447, longitude: -76.4847, aliases: ['OLIN', 'OLIN HALL'] },
    { code: 'STIMSON', name: 'Stimson Hall', latitude: 42.4467, longitude: -76.4829, aliases: ['STIMSON', 'STIMSON HALL'] },
    { code: 'STOCKING', name: 'Stocking Hall', latitude: 42.4472, longitude: -76.4719, aliases: ['STOCKING', 'STOCKING HALL'] },
    { code: 'SNEE', name: 'Snee Hall', latitude: 42.4443, longitude: -76.4845, aliases: ['SNEE', 'SNEE HALL', 'SNEE HALL GEOLOGICAL SCI'] },
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
    { code: 'ARMS', name: 'Neil Armstrong Hall of Engineering', latitude: 40.431, longitude: -86.9146, aliases: ['ARMS', 'ARMSTRONG HALL', 'NEIL ARMSTRONG HALL'] },
    { code: 'PHYS', name: 'Physics Building', latitude: 40.4302, longitude: -86.9135, aliases: ['PHYS', 'PHYSICS BUILDING'] },
    { code: 'SC', name: 'Stanley Coulter Hall', latitude: 40.4258, longitude: -86.9145, aliases: ['SC', 'STANLEY COULTER', 'STANLEY COULTER HALL'] },
    { code: 'CHAS', name: 'Chaney-Hale Hall of Science', latitude: 40.4271, longitude: -86.9147, aliases: ['CHAS', 'CHANEY HALE', 'CHANEY HALE HALL OF SCIENCE'] },
    { code: 'LILY', name: 'Lilly Hall of Life Sciences', latitude: 40.4238, longitude: -86.9147, aliases: ['LILY', 'LILLY HALL', 'LILLY HALL OF LIFE SCIENCES'] },
    { code: 'HAMP', name: 'Hampton Hall of Civil Engineering', latitude: 40.4286, longitude: -86.9138, aliases: ['HAMP', 'HAMPTON HALL', 'HAMPTON HALL OF CIVIL ENGINEERING'] },
    { code: 'KNOY', name: 'Knoy Hall of Technology', latitude: 40.4277, longitude: -86.9191, aliases: ['KNOY', 'KNOY HALL', 'KNOY HALL OF TECHNOLOGY'] },
    { code: 'PAO', name: 'Yue-Kong Pao Hall of Visual and Performing Arts', latitude: 40.4282, longitude: -86.9187, aliases: ['PAO', 'PAO HALL', 'YUE KONG PAO HALL'] },
    { code: 'SCHM', name: 'Schleman Hall', latitude: 40.4263, longitude: -86.914, aliases: ['SCHM', 'SCHLEMAN', 'SCHLEMAN HALL'] },
    { code: 'BHEE', name: 'Brown Family Hall', latitude: 40.4279, longitude: -86.9137, aliases: ['BHEE', 'EE', 'BROWN FAMILY HALL', 'ELECTRICAL ENGINEERING BUILDING'] },
    { code: 'BRWN', name: 'Brown Laboratory of Chemistry', latitude: 40.4266, longitude: -86.9149, aliases: ['BRWN', 'BROWN LAB', 'BROWN LABORATORY OF CHEMISTRY'] },
    { code: 'UNIV', name: 'University Hall', latitude: 40.4249, longitude: -86.9147, aliases: ['UNIV', 'UNIVERSITY HALL'] },
    { code: 'REC', name: 'Recitation Building', latitude: 40.4256, longitude: -86.9165, aliases: ['REC', 'RECITATION BUILDING'] },
    { code: 'DUDL', name: 'Dudley Hall', latitude: 40.4276, longitude: -86.9123, aliases: ['DUDL', 'DUDLEY HALL'] },
    { code: 'NISW', name: 'Niswonger Aviation Technology Building', latitude: 40.4123, longitude: -86.9332, aliases: ['NISW', 'NISWONGER', 'NISWONGER AVIATION TECHNOLOGY'] },
    { code: 'POTR', name: 'Potter Engineering Center', latitude: 40.4277, longitude: -86.913, aliases: ['POTR', 'POTTER', 'POTTER ENGINEERING CENTER'] },
    { code: 'RHPH', name: 'Robert E. Heine Pharmacy Building', latitude: 40.4268, longitude: -86.918, aliases: ['RHPH', 'HEINE PHARMACY', 'PHARMACY BUILDING'] },
    { code: 'GRIS', name: 'Grissom Hall', latitude: 40.4273, longitude: -86.9203, aliases: ['GRIS', 'GRISSOM', 'GRISSOM HALL'] },
    { code: 'HAAS', name: 'Felix Haas Hall', latitude: 40.4259, longitude: -86.9155, aliases: ['HAAS', 'FELIX HAAS', 'FELIX HAAS HALL'] },
    { code: 'SHRV', name: 'Shreve Hall', latitude: 40.429, longitude: -86.9201, aliases: ['SHRV', 'SHREVE', 'SHREVE HALL'] },
    { code: 'SMTH', name: 'Smith Hall', latitude: 40.4235, longitude: -86.916, aliases: ['SMTH', 'SMITH HALL'] },
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
    { code: 'WOHLERS', name: 'Wohlers Hall', latitude: 40.1047, longitude: -88.2296, aliases: ['WOHLERS', 'WOHLERS HALL'] },
    { code: 'BURRILL', name: 'Burrill Hall', latitude: 40.106, longitude: -88.2249, aliases: ['BURRILL', 'BURRILL HALL'] },
    { code: 'CHEMANNEX', name: 'Chemistry Annex', latitude: 40.1075, longitude: -88.2256, aliases: ['CHEMISTRY ANNEX', 'CHEM ANNEX'] },
    { code: 'BEVIER', name: 'Bevier Hall', latitude: 40.1056, longitude: -88.2264, aliases: ['BEVIER', 'BEVIER HALL'] },
    { code: 'KRANNERTARTS', name: 'Krannert Center for the Performing Arts', latitude: 40.1079, longitude: -88.2229, aliases: ['KRANNERT CENTER FOR PERF ARTS', 'KRANNERT CENTER FOR PERFORMING ARTS'] },
    { code: 'HENRY', name: 'Henry Administration Building', latitude: 40.1085, longitude: -88.228, aliases: ['HENRY ADMINISTRATION BLDG', 'HENRY ADMINISTRATION BUILDING'] },
    { code: 'EVERITT', name: 'Everitt Laboratory', latitude: 40.11, longitude: -88.2272, aliases: ['EVERITT', 'EVERITT LABORATORY'] },
    { code: 'HUFF', name: 'Huff Hall', latitude: 40.1041, longitude: -88.2296, aliases: ['HUFF', 'HUFF HALL'] },
    { code: 'TRANSPORTATION', name: 'Transportation Building', latitude: 40.1128, longitude: -88.2283, aliases: ['TRANSPORTATION BUILDING'] },
    { code: 'MUMFORD', name: 'Mumford Hall', latitude: 40.1036, longitude: -88.2258, aliases: ['MUMFORD', 'MUMFORD HALL'] },
    { code: 'TALBOT', name: 'Talbot Laboratory', latitude: 40.1108, longitude: -88.2285, aliases: ['TALBOT', 'TALBOT LABORATORY'] },
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

export function isUnmappableLocation(rawLocation?: string | null) {
  const normalized = (rawLocation ?? '').trim().toLowerCase();
  return !normalized
    || normalized === 'tba'
    || normalized === 'tba tba'
    || normalized === 'away'
    || normalized === 'arr'
    || normalized === 'n/a'
    || normalized === 'no'
    || normalized === 'none'
    || normalized === 'null'
    || normalized === 'main'
    || normalized === 'na'
    || normalized === '*'
    || normalized === 'video'
    || normalized === 'language'
    || normalized === 'health sciences'
    || normalized === 'arrngd'
    || normalized === 'japan'
    || normalized === 'rome'
    || normalized === 'online'
    || normalized === 'on line'
    || normalized.startsWith('nappl')
    || normalized.startsWith('arrngd')
    || normalized.startsWith('japan ')
    || normalized.startsWith('no ')
    || normalized.includes('online')
    || normalized.includes('remote')
    || normalized.includes('studies abroad')
    || normalized.includes('to be assigned')
    || normalized.includes('location pending')
    || normalized.includes('main campus')
    || normalized.includes('offcmp')
    || normalized.includes('off-campus')
    || normalized.includes('off campus');
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
