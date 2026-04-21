import { Text } from 'react-native';
import type { LegalDocumentType } from './LegalDocumentModal';

type Props = {
  onOpenDocument: (document: LegalDocumentType) => void;
  color?: string;
  linkColor?: string;
  centered?: boolean;
  fontSize?: number;
  lineHeight?: number;
};

export default function LegalConsentText({
  onOpenDocument,
  color = '#9ca3af',
  linkColor = '#4169E1',
  centered = true,
  fontSize = 12,
  lineHeight = 18,
}: Props) {
  return (
    <Text
      style={{
        fontSize,
        color,
        textAlign: centered ? 'center' : 'left',
        lineHeight,
      }}
    >
      By continuing, you agree to our{' '}
      <Text style={{ color: linkColor, fontWeight: '600' }} onPress={() => onOpenDocument('terms')}>
        Terms of Service
      </Text>{' '}
      and{' '}
      <Text style={{ color: linkColor, fontWeight: '600' }} onPress={() => onOpenDocument('privacy')}>
        Privacy Policy
      </Text>
      .
    </Text>
  );
}
