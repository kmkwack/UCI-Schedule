export type Course = {
  id: number;
  code: string;
  title: string;
  professor: string;
  days: string;
  time: string;
  department: string;
  addedCount: number;
  rating: number;
  location?: string;
  units?: number;
};

export const courses: Course[] = [
  {
    id: 1,
    code: 'ECON 100A',
    title: 'Intermediate Microeconomics',
    professor: 'Smith',
    days: 'MWF',
    time: '10:00 - 10:50',
    department: 'ECON',
    addedCount: 91,
    rating: 4.5,
    location: 'SSPA 2112',
    units: 4,
  },
  {
    id: 2,
    code: 'MGMT 145',
    title: 'Corporate Finance',
    professor: 'Johnson',
    days: 'TuTh',
    time: '14:00 - 15:20',
    department: 'MGMT',
    addedCount: 100,
    rating: 3.8,
    location: 'SB1 5100',
    units: 4,
  },
  {
    id: 3,
    code: 'ECON 122A',
    title: 'Econometrics',
    professor: 'Lee',
    days: 'MWF',
    time: '11:00 - 11:50',
    department: 'ECON',
    addedCount: 78,
    rating: 4.3,
    location: 'SSPA 1100',
    units: 4,
  },
  {
    id: 4,
    code: 'MGMT 190',
    title: 'Special Topics in Finance',
    professor: 'Brown',
    days: 'TuTh',
    time: '18:00 - 19:20',
    department: 'MGMT',
    addedCount: 72,
    rating: 4.2,
    location: 'SB1 3200',
    units: 4,
  },
  {
    id: 5,
    code: 'ART 50',
    title: 'Weekend Studio',
    professor: 'Kim',
    days: 'Sa',
    time: '09:00 - 11:30',
    department: 'ART',
    addedCount: 47,
    rating: 4.6,
    location: 'ART 120',
    units: 4,
  },
  {
    id: 6,
    code: 'BIO 10',
    title: 'Sunday Lab',
    professor: 'Park',
    days: 'Su',
    time: '13:00 - 15:00',
    department: 'BIO',
    addedCount: 68,
    rating: 4.1,
    location: 'BS3 2200',
    units: 4,
  },
];