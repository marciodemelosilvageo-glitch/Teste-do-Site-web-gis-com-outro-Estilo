/**
 * Tokens visuais escopados ao Painel de Controle WebGIS no padrão Apple iOS / iPadOS / macOS.
 * Sistema sóbrio, monocromático e focado em conteúdo com UMA cor de destaque do sistema (#007AFF / #0A84FF).
 */

export const ADMIN_TOKENS = {
  colors: {
    // Fundos agrupados e cartões
    bgGroupedLight: '#F2F2F7',
    bgGroupedDark: '#000000',
    bgCardLight: '#FFFFFF',
    bgCardDark: '#1C1C1E',
    bgElevatedLight: '#FFFFFF',
    bgElevatedDark: '#2C2C2E',
    bgSubtleLight: 'rgba(118, 118, 128, 0.12)',
    bgSubtleDark: 'rgba(118, 118, 128, 0.24)',

    // Divisores hairline Apple
    separatorLight: 'rgba(60, 60, 67, 0.12)',
    separatorDark: 'rgba(84, 84, 88, 0.35)',

    // Textos do sistema
    textPrimaryLight: '#000000',
    textPrimaryDark: '#FFFFFF',
    textSecondaryLight: '#6C6C70',
    textSecondaryDark: '#98989D',
    textTertiaryLight: '#8E8E93',
    textTertiaryDark: '#8E8E93',

    // Destaque único do sistema (System Blue)
    accentLight: '#007AFF',
    accentDark: '#0A84FF',

    // Cores semânticas restritas (Apenas texto destrutivo e pequenos pontos de status)
    destructiveLight: '#FF3B30',
    destructiveDark: '#FF453A',
    statusGreenLight: '#34C759',
    statusGreenDark: '#30D158',
    statusAmberLight: '#FF9500',
    statusAmberDark: '#FF9F0A',
    statusGrayLight: '#8E8E93',
    statusGrayDark: '#636366'
  },
  typography: {
    caption: 'text-xs leading-4', // 12px (piso absoluto)
    body: 'text-[15px] leading-5', // 15px
    subhead: 'text-sm leading-5', // 14px
    sectionTitle: 'text-[17px] font-semibold leading-6', // 17px
    largeTitle: 'text-[28px] font-semibold tracking-tight leading-8' // 28px
  },
  touchTarget: 'min-h-[44px] min-w-[44px]',
  transition: 'transition-all duration-200 ease-out'
} as const;
