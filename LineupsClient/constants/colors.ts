// ── Semantic color tokens ──────────────────────────────────
//
// Every color in the app should come from one of these two theme
// objects (or from `brand` for colors that never change).
//
// When migrating a screen:
//   1. Replace hardcoded hex strings with tokens from the theme.
//   2. Call `const { theme } = useTheme()` at the top of the component.
//   3. Pass `theme` into a `getStyles(theme)` function instead of
//      a static `StyleSheet.create({...})`.

export const darkTheme = {
  // Backgrounds
  background:       '#0B2230',
  cardBackground:   '#0F2838',
  inputBackground:  '#0B2230',
  overlayBackground: 'rgba(0, 0, 0, 0.55)',

  // Text
  titleText:    '#E8D5B8',
  bodyText:     '#E8D5B8',
  subtext:      '#4A7A87',
  placeholder:  '#4A7A87',
  sectionLabel: '#4A7A87',
  hintText:     '#4A7A87',

  // Borders
  borderPrimary: '#E8D5B8',
  borderSubtle:  'rgba(74, 122, 135, 0.4)',
  borderDim:     'rgba(74, 122, 135, 0.25)',
  rowSeparator:  'rgba(74, 122, 135, 0.25)',

  // Buttons
  ctaBackground:      '#1B7A87',
  ctaText:            '#E8D5B8',
  ghostBorderColor:   'rgba(197, 168, 130, 0.4)',
  ghostText:          '#C5A882',

  // Follow button
  followBorder: '#3CC4C4',
  followText:   '#3CC4C4',

  // Break type / direction pills
  typePillBackground: 'rgba(83, 74, 183, 0.2)',
  typePillText:       '#9B95E8',
  dirPillBackground:  'rgba(15, 110, 86, 0.2)',
  dirPillText:        '#3CC4C4',

  // Progress dots
  dotInactive: '#1B5A6A',
  dotActive:   '#E8D5B8',
  dotDone:     '#3CC4C4',
} as const

export const lightTheme = {
  // Backgrounds
  background:       '#F5EDE0',
  cardBackground:   '#EDE0CC',
  inputBackground:  '#EDE0CC',
  overlayBackground: 'rgba(0, 0, 0, 0.4)',

  // Text
  titleText:    '#2A1A08',
  bodyText:     '#2A1A08',
  subtext:      '#A8845A',
  placeholder:  '#C5A882',
  sectionLabel: '#A8845A',
  hintText:     '#A8845A',

  // Borders
  borderPrimary: '#C5A882',
  borderSubtle:  'rgba(197, 168, 130, 0.4)',
  borderDim:     'rgba(197, 168, 130, 0.25)',
  rowSeparator:  '#F0E4D0',

  // Buttons
  ctaBackground:    '#1B7A87',
  ctaText:          '#E8D5B8',
  ghostBorderColor: 'rgba(197, 168, 130, 0.4)',
  ghostText:        '#A8845A',

  // Follow button
  followBorder: '#1B7A87',
  followText:   '#1B7A87',

  // Break type / direction pills
  typePillBackground: '#EEEDFE',
  typePillText:       '#534AB7',
  dirPillBackground:  '#E1F5EE',
  dirPillText:        '#0F6E56',

  // Progress dots
  dotInactive: '#D8C8B0',
  dotActive:   '#1B7A87',
  dotDone:     '#3CC4C4',
} as const

// Brand colors — identical in both themes, never swap
export const brand = {
  teal:      '#1B7A87',
  deepTeal:  '#0F5A65',
  aqua:      '#3CC4C4',
  cream:     '#E8D5B8',
  sand:      '#C5A882',
  navy:      '#0B2230',
  purple:    '#7F77DD',
  error:     '#E07070',
} as const

export type Theme = typeof darkTheme
export type ThemeType = 'light' | 'dark'
