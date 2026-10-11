/** Palette and fonts shared by the exported PNG images (Emission design tokens). */

/** Emission palette for the exported PNG — mirrors the tokens in app/globals.css. */
export const EXPORT_IMAGE_COLORS = {
  void: '#0E0A14',
  dust: '#18121F',
  dustAlt: '#1C1524',
  veil: '#221A2D',
  filament: '#342843',
  ink: '#EEE8F4',
  ink2: '#B8AEC8',
  ink3: '#9489A6',
  halpha: '#F2508C',
  halphaGlow: 'rgba(242, 80, 140, 0.16)',
  halphaLine: 'rgba(242, 80, 140, 0.35)',
  danger: '#FF7A7A',
} as const;

export type ExportImageFontRole = 'title' | 'meta' | 'header' | 'body' | 'footer' | 'small' | 'label';

const EXPORT_IMAGE_FONT_SPECS: Record<ExportImageFontRole, string> = {
  title: '700 28px',
  meta: '500 14px',
  header: '700 13px',
  body: '600 15px',
  footer: 'italic 500 12px',
  small: '500 11px',
  label: '700 11px',
};

/** Canvas needs the concrete family name; next/font exposes it through the --font-sans variable. */
export function exportImageFont(role: ExportImageFontRole): string {
  const family = typeof document === 'undefined'
    ? ''
    : getComputedStyle(document.documentElement).getPropertyValue('--font-sans').trim();
  return `${EXPORT_IMAGE_FONT_SPECS[role]} ${family ? `${family}, ` : ''}system-ui, -apple-system, Segoe UI, sans-serif`;
}
