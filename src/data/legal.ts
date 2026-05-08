export const CURRENT_LEGAL_ACKNOWLEDGMENT = {
  termsVersion: 'terms-2026-05-08',
  privacyVersion: 'privacy-2026-05-08',
  effectiveLabel: 'May 8, 2026',
};

export type LegalAcknowledgment = {
  termsVersion: string;
  privacyVersion: string;
  acceptedAt: string;
};

export function hasAcceptedCurrentLegalDocuments(ack?: Partial<LegalAcknowledgment> | null) {
  return (
    ack?.termsVersion === CURRENT_LEGAL_ACKNOWLEDGMENT.termsVersion &&
    ack?.privacyVersion === CURRENT_LEGAL_ACKNOWLEDGMENT.privacyVersion
  );
}
