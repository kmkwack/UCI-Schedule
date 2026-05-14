type Rgb = { r: number; g: number; b: number };

function parseHexColor(color: string): Rgb | null {
  const normalized = color.trim().replace(/^#/, '');
  if (!/^[0-9a-fA-F]{3}$|^[0-9a-fA-F]{6}$/.test(normalized)) return null;
  const expanded = normalized.length === 3
    ? normalized.split('').map((part) => `${part}${part}`).join('')
    : normalized;
  return {
    r: parseInt(expanded.slice(0, 2), 16),
    g: parseInt(expanded.slice(2, 4), 16),
    b: parseInt(expanded.slice(4, 6), 16),
  };
}

function rgbToHex({ r, g, b }: Rgb) {
  return `#${[r, g, b].map((value) => Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, '0')).join('')}`;
}

function mix(a: Rgb, b: Rgb, amount: number): Rgb {
  return {
    r: a.r + (b.r - a.r) * amount,
    g: a.g + (b.g - a.g) * amount,
    b: a.b + (b.b - a.b) * amount,
  };
}

export function rgbaFromHex(color: string, alpha: number, fallback: string) {
  const rgb = parseHexColor(color);
  if (!rgb) return fallback;
  return `rgba(${rgb.r},${rgb.g},${rgb.b},${alpha})`;
}

export function themedIconBackground(color: string, isDark: boolean, lightBackground?: string) {
  if (!isDark) return lightBackground ?? rgbaFromHex(color, 0.12, color);
  return rgbaFromHex(color, 0.22, 'rgba(255,255,255,0.08)');
}

export function themedIconBorder(color: string, isDark: boolean) {
  return rgbaFromHex(color, isDark ? 0.34 : 0.2, isDark ? 'rgba(255,255,255,0.08)' : 'rgba(188,199,221,0.25)');
}

export function themedIconColor(color: string, isDark: boolean) {
  if (!isDark) return color;
  const rgb = parseHexColor(color);
  if (!rgb) return color;
  return rgbToHex(mix(rgb, { r: 255, g: 255, b: 255 }, 0.18));
}
