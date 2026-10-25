/**
 * AnnaSaathi design tokens. Every colour, size and radius in the app comes from here.
 * Text colours are chosen for at least 4.5:1 contrast on `bg` and `surface`.
 */
export const color = {
  primary: '#1F4D3A', // deep forest green
  primaryPressed: '#173B2C',
  onPrimary: '#FFFFFF',
  onPrimaryMuted: '#C9DCCF',
  sage: '#DCE8DF', // soft sage
  sageStrong: '#BFD5C5',
  sageText: '#24533F',

  bg: '#F7F5EF', // warm ivory
  surface: '#FFFFFF',
  surfaceAlt: '#F0EDE4',
  border: '#E3DED1',
  borderStrong: '#CFC8B8',

  text: '#1B1F1C', // deep charcoal
  textMuted: '#555D57',
  textFaint: '#6E756F',

  accent: '#C98A1B', // turmeric, used for fills and icons, never as text on white
  accentSoft: '#FBF0D9',
  accentText: '#7A5310',

  danger: '#A63D36', // muted red, only for genuinely urgent states
  dangerSoft: '#F8E4E1',
  dangerText: '#8A2F29',

  overlay: 'rgba(20, 24, 21, 0.45)',
} as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 } as const;

export const radius = { sm: 10, md: 14, lg: 20, pill: 999 } as const;

/** Minimum touch target (Android guidance is 48 dp). */
export const touch = 48;

export const type = {
  display: { fontSize: 28, lineHeight: 34, fontWeight: '700' },
  title: { fontSize: 22, lineHeight: 28, fontWeight: '700' },
  heading: { fontSize: 18, lineHeight: 24, fontWeight: '600' },
  body: { fontSize: 16, lineHeight: 23, fontWeight: '400' },
  bodyStrong: { fontSize: 16, lineHeight: 23, fontWeight: '600' },
  label: { fontSize: 14, lineHeight: 20, fontWeight: '600' },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: '400' },
} as const;

export const shadow = {
  card: {
    shadowColor: '#1B1F1C',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  raised: {
    shadowColor: '#1B1F1C',
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
} as const;
