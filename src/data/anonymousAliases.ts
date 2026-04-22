export function anteaterAliasForId(id: string) {
  const normalized = (id || 'anteater').replace(/[^a-fA-F0-9]/g, '');
  const seed = normalized.slice(0, 8) || '1';
  const value = parseInt(seed, 16);
  const suffix = Number.isFinite(value) ? (value % 9999) + 1 : 1;
  return `Anteater ${suffix}`;
}
