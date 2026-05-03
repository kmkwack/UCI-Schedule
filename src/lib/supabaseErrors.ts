export function isMissingSchoolColumnError(error: any) {
  const code = String(error?.code ?? '');
  const message = String(error?.message ?? '').toLowerCase();
  const details = String(error?.details ?? '').toLowerCase();
  const hint = String(error?.hint ?? '').toLowerCase();
  const text = `${message} ${details} ${hint}`;

  return code === '42703' ||
    code === 'PGRST204' ||
    text.includes('school') ||
    text.includes('schema cache');
}

