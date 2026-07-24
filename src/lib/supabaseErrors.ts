/** Column does not exist — legacy schema missing 'school' column */
export function isMissingSchoolColumnError(error: any) {
  const code = String(error?.code ?? '');
  const message = String(error?.message ?? '').toLowerCase();
  const details = String(error?.details ?? '').toLowerCase();
  const hint = String(error?.hint ?? '').toLowerCase();

  // 42703 = undefined_column, PGRST204 = column not found in PostgREST
  if (code === '42703' || code === 'PGRST204') return true;

  // Check specifically for 'school' column in the error details (not just any mention)
  const combinedDetails = `${details} ${hint}`;
  if (combinedDetails.includes('school') && combinedDetails.includes('column')) return true;

  const combinedAll = `${message} ${details} ${hint}`;
  if (combinedAll.includes('schema cache')) return true;

  return false;
}

/** Row-level security violation */
export function isRlsError(error: any) {
  const code = String(error?.code ?? '');
  return code === '42501';
}

/** Network or fetch-level error (no response from Supabase) */
export function isNetworkError(error: any) {
  // React Native / Hermes throws `TypeError: Network request failed`; browsers
  // throw "Failed to fetch". Match both plus aborted requests.
  const message = String(error?.message ?? '').toLowerCase();
  return (
    message.includes('network request failed') ||
    message.includes('failed to fetch') ||
    message.includes('fetch failed') ||
    (error instanceof TypeError && message.includes('fetch')) ||
    error?.name === 'AbortError'
  );
}
