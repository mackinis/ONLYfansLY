
// src/lib/config.ts

export interface ColorSetting {
  id: string;
  labelKey: string;
  cssVar: string;
  defaultValueHex: string;
  value: string; // Current color in HEX, e.g., "#D4AF37"
}

// Default HSL values from ShadCN dark theme as a reference for default HEX.
// This is now the single source of truth for default theme colors.
export const defaultThemeColorsHex: ColorSetting[] = [
  // Key Colors
  { id: 'background', labelKey: 'adminAppearancePage.colorLabels.background', cssVar: '--background', defaultValueHex: '#1A1A1A', value: '#1A1A1A' },
  { id: 'foreground', labelKey: 'adminAppearancePage.colorLabels.foreground', cssVar: '--foreground', defaultValueHex: '#EEEEEE', value: '#EEEEEE' },
  { id: 'primary', labelKey: 'adminAppearancePage.colorLabels.primary', cssVar: '--primary', defaultValueHex: '#D4AF37', value: '#D4AF37' },
  { id: 'primary-foreground', labelKey: 'adminAppearancePage.colorLabels.primary_foreground', cssVar: '--primary-foreground', defaultValueHex: '#1A1A1A', value: '#1A1A1A' },

  // Card
  { id: 'card', labelKey: 'adminAppearancePage.colorLabels.card', cssVar: '--card', defaultValueHex: '#1F1F1F', value: '#1F1F1F' },
  { id: 'card-foreground', labelKey: 'adminAppearancePage.colorLabels.card_foreground', cssVar: '--card-foreground', defaultValueHex: '#EEEEEE', value: '#EEEEEE' },

  // Popover
  { id: 'popover', labelKey: 'adminAppearancePage.colorLabels.popover', cssVar: '--popover', defaultValueHex: '#141414', value: '#141414' },
  { id: 'popover-foreground', labelKey: 'adminAppearancePage.colorLabels.popover_foreground', cssVar: '--popover-foreground', defaultValueHex: '#EEEEEE', value: '#EEEEEE' },

  // Secondary
  { id: 'secondary', labelKey: 'adminAppearancePage.colorLabels.secondary', cssVar: '--secondary', defaultValueHex: '#262626', value: '#262626' },
  { id: 'secondary-foreground', labelKey: 'adminAppearancePage.colorLabels.secondary_foreground', cssVar: '--secondary-foreground', defaultValueHex: '#EEEEEE', value: '#EEEEEE' },

  // Muted
  { id: 'muted', labelKey: 'adminAppearancePage.colorLabels.muted', cssVar: '--muted', defaultValueHex: '#262626', value: '#262626' },
  { id: 'muted-foreground', labelKey: 'adminAppearancePage.colorLabels.muted_foreground', cssVar: '--muted-foreground', defaultValueHex: '#999999', value: '#999999' },

  // Accent
  { id: 'accent', labelKey: 'adminAppearancePage.colorLabels.accent', cssVar: '--accent', defaultValueHex: '#333333', value: '#333333' },
  { id: 'accent-foreground', labelKey: 'adminAppearancePage.colorLabels.accent_foreground', cssVar: '--accent-foreground', defaultValueHex: '#EEEEEE', value: '#EEEEEE' },

  // Destructive
  { id: 'destructive', labelKey: 'adminAppearancePage.colorLabels.destructive', cssVar: '--destructive', defaultValueHex: '#B91C1C', value: '#B91C1C' },
  { id: 'destructive-foreground', labelKey: 'adminAppearancePage.colorLabels.destructive_foreground', cssVar: '--destructive-foreground', defaultValueHex: '#EEEEEE', value: '#EEEEEE' },

  // Border, Input, Ring
  { id: 'border', labelKey: 'adminAppearancePage.colorLabels.border', cssVar: '--border', defaultValueHex: '#333333', value: '#333333' },
  { id: 'input', labelKey: 'adminAppearancePage.colorLabels.input', cssVar: '--input', defaultValueHex: '#333333', value: '#333333' },
  { id: 'ring', labelKey: 'adminAppearancePage.colorLabels.ring', cssVar: '--ring', defaultValueHex: '#D4AF37', value: '#D4AF37' },
];
