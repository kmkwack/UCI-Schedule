import { getSchoolConfig } from './schools';

function aliasNounForSchool(school?: string) {
  if (!school) return 'Classmate';
  return getSchoolConfig(school).welcomeName || 'Classmate';
}

export function campusAliasForId(id: string, school?: string) {
  const normalized = (id || 'classmate').replace(/[^a-fA-F0-9]/g, '');
  const seed = normalized.slice(0, 8) || '1';
  const value = parseInt(seed, 16);
  const suffix = Number.isFinite(value) ? (value % 9999) + 1 : 1;
  return `${aliasNounForSchool(school)} ${suffix}`;
}

export function randomCampusAlias(school?: string) {
  return `${aliasNounForSchool(school)} ${Math.floor(Math.random() * 9999) + 1}`;
}
