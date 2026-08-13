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
      // Keep the consent line on one row and let iOS shrink the type when it
      // doesn't fit, rather than wrapping. The line is tuned to fit an iPhone at
      // the caller's fontSize, but narrower canvases — notably the ~380pt
      // iPhone-compatibility window an iPad runs this app in — wrapped it onto a
      // second line. minimumFontScale is deliberately generous: it is a floor
      // that prevents iOS from truncating (which would hide the Privacy Policy
      // link), not a target — the text only shrinks as far as it actually needs.
      numberOfLines={1}
      adjustsFontSizeToFit
      minimumFontScale={0.6}
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
