import { CSSProperties } from 'react';

/**
 * Global Studio Aesthetic Switch (In-Code Toggle)
 * 
 * - 'hardware': Precision Teenage Engineering OP-1 Field & Nothing Tech Optic 1-Bit Hardware
 * - 'arcade-neo-pop': 90s Cyberpunk / Neo-Pop Arcade (Hot-pink shadows, cyan borders, purple grid)
 * 
 * 🎛️ TO SWITCH: Change ACTIVE_STUDIO_AESTHETIC to 'arcade-neo-pop' or 'hardware'
 */
export type StudioAesthetic = 'hardware' | 'arcade-neo-pop';

export const ACTIVE_STUDIO_AESTHETIC: StudioAesthetic = 'hardware';

export interface AestheticThemeTokens {
  id: StudioAesthetic;
  name: string;
  sectionBg: (isDark: boolean) => string;
  sectionBorder: (isDark: boolean) => string;
  gridStyle: (isDark: boolean) => CSSProperties;
  cardBg: (isDark: boolean) => string;
  cardBorder: (isDark: boolean) => string;
  cardShadow: (isDark: boolean) => string;
  accentTitle: (isDark: boolean) => string;
  accentSub: (isDark: boolean) => string;
  previewBox: (isDark: boolean) => string;
  stickyNote: (isDark: boolean) => string;
  panelHeader: (isDark: boolean) => string;
  tabActive: (isDark: boolean) => string;
  tabInactive: (isDark: boolean) => string;
  signalDot: (isDark: boolean) => string;
  showStickyNote: boolean;
}

/**
 * 🕹️ ARCADE NEO POP (Preserved legacy aesthetic)
 * Vaporwave purple, cyan double borders, hot-pink hard offset drop shadows.
 */
export const ARCADE_NEO_POP_THEME: AestheticThemeTokens = {
  id: 'arcade-neo-pop',
  name: 'Arcade Neo-Pop Cyberpunk',
  sectionBg: (isDark) => (isDark ? 'bg-[#100D1C]' : 'bg-[#F5F0EB]'),
  sectionBorder: (isDark) => (isDark ? 'border-[#2D2344]' : 'border-[#1A1A1A]/20'),
  gridStyle: (isDark) => ({
    backgroundImage: isDark
      ? `repeating-linear-gradient(0deg, rgba(0, 240, 255, 0.06) 0 1px, transparent 1px 40px),
         repeating-linear-gradient(90deg, rgba(255, 42, 133, 0.06) 0 1px, transparent 1px 40px)`
      : `repeating-linear-gradient(0deg, #e0dbd5 0 1px, transparent 1px 40px),
         repeating-linear-gradient(90deg, #e0dbd5 0 1px, transparent 1px 40px)`,
  }),
  cardBg: (isDark) => (isDark ? 'bg-[#0A0713]' : 'bg-[#080808]'),
  cardBorder: (isDark) => (isDark ? 'border-[#00F0FF]/60' : 'border-[#1A1A1A]'),
  cardShadow: (isDark) => (isDark ? 'shadow-[4px_4px_0_0_#FF2A85]' : 'shadow-[4px_4px_0_0_#1A1A1A]'),
  accentTitle: (isDark) => (isDark ? 'text-[#00F0FF]' : 'text-[#1A1A1A]'),
  accentSub: (isDark) => (isDark ? 'text-[#7E7694]' : 'text-[#6B6B6B]'),
  previewBox: (isDark) =>
    isDark
      ? 'bg-[#0A0713] border-[#00F0FF]/60 shadow-[4px_4px_0_0_#FF2A85]'
      : 'bg-[#080808] border-[#1A1A1A] shadow-[4px_4px_0_0_#1A1A1A]',
  stickyNote: (isDark) =>
    isDark
      ? 'bg-[#1E1735] text-[#00F0FF] border border-[#00F0FF]/40 shadow-[3px_3px_0_#FF2A85]'
      : 'bg-[#FFD485] text-[#1A1A1A] shadow-lg',
  panelHeader: (isDark) => (isDark ? 'bg-[#140F24] border-[#2D2344] text-[#A59CB8]' : 'bg-transparent border-[#1A1A1A] text-[#6B6B6B]'),
  tabActive: (isDark) => (isDark ? 'text-[#00F0FF] border-b-2 border-[#00F0FF] bg-[#1A142C]' : 'text-[#1A1A1A] border-b-2 border-[#E85D2A] bg-white'),
  tabInactive: (isDark) => (isDark ? 'text-[#7E7694] hover:text-[#00F0FF]' : 'text-[#6B6B6B] hover:text-[#1A1A1A]'),
  signalDot: (isDark) => (isDark ? 'bg-[#00F0FF]' : 'bg-[#E85D2A]'),
  showStickyNote: true,
};

/**
 * 🎛️ PRECISION HARDWARE (Teenage Engineering OP-1 Field & Nothing Tech Optic)
 * True Optic Black (#000000), Matte Ceramic (#F6F6F4), precision technical hairlines,
 * phosphor bloom, machined metal bezels, and diffused specular glow fields.
 */
export const PRECISION_HARDWARE_THEME: AestheticThemeTokens = {
  id: 'hardware',
  name: 'Teenage Engineering OP-1 Field & Nothing Tech Optic',
  sectionBg: (isDark) => (isDark ? 'bg-[#000000]' : 'bg-[#F6F6F4]'),
  sectionBorder: (isDark) => (isDark ? 'border-white/10' : 'border-[#1A1A1A]/15'),
  gridStyle: (isDark) => ({
    backgroundImage: isDark
      ? `radial-gradient(circle at 50% 0%, rgba(0, 255, 102, 0.03) 0%, transparent 70%),
         repeating-linear-gradient(0deg, rgba(255, 255, 255, 0.02) 0 1px, transparent 1px 40px),
         repeating-linear-gradient(90deg, rgba(255, 255, 255, 0.02) 0 1px, transparent 1px 40px)`
      : `repeating-linear-gradient(0deg, #E0DBD5 0 1px, transparent 1px 40px),
         repeating-linear-gradient(90deg, #E0DBD5 0 1px, transparent 1px 40px)`,
  }),
  cardBg: (isDark) => (isDark ? 'bg-[#08080A]' : 'bg-[#FFFFFF]'),
  cardBorder: (isDark) => (isDark ? 'border-white/10' : 'border-[#1A1A1A]'),
  cardShadow: (isDark) =>
    isDark
      ? 'shadow-[0_8px_32px_rgba(0,0,0,0.85),inset_0_1px_0_rgba(255,255,255,0.08)]'
      : 'shadow-[0_4px_20px_rgba(0,0,0,0.06),inset_0_1px_0_rgba(255,255,255,0.95)]',
  accentTitle: (isDark) => (isDark ? 'text-[#00FF66]' : 'text-[#1A1A1A]'),
  accentSub: (isDark) => (isDark ? 'text-[#71717A]' : 'text-[#5E5D59]'),
  previewBox: (isDark) =>
    isDark
      ? 'bg-[#08080A] border-white/15 shadow-[0_12px_40px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.12)]'
      : 'bg-[#FFFFFF] border-[#1A1A1A] shadow-[0_6px_24px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.95)]',
  stickyNote: (isDark) =>
    isDark
      ? 'bg-[#121214] text-[#00FF66] border border-white/10 shadow-[0_4px_16px_rgba(0,0,0,0.6)]'
      : 'bg-[#EAE8E3] text-[#1A1A1A] border border-[#1A1A1A]/30 shadow-sm',
  panelHeader: (isDark) =>
    isDark
      ? 'bg-[#0D0D10] border-white/10 text-[#A1A1AA]'
      : 'bg-[#F2F1EE] border-[#1A1A1A] text-[#1A1A1A]',
  tabActive: (isDark) =>
    isDark
      ? 'text-[#00FF66] border-b-2 border-[#00FF66] bg-[#141418]'
      : 'text-[#1A1A1A] border-b-2 border-[#E85D2A] bg-white',
  tabInactive: (isDark) =>
    isDark
      ? 'text-[#71717A] hover:text-[#00FF66]'
      : 'text-[#5E5D59] hover:text-[#1A1A1A]',
  signalDot: (isDark) => (isDark ? 'bg-[#00FF66]' : 'bg-[#E85D2A]'),
  showStickyNote: false, // Replaced with clean technical calibration readout
};

/**
 * Returns the currently active theme tokens based on ACTIVE_STUDIO_AESTHETIC
 */
export function getActiveTheme(): AestheticThemeTokens {
  return ACTIVE_STUDIO_AESTHETIC === 'arcade-neo-pop'
    ? ARCADE_NEO_POP_THEME
    : PRECISION_HARDWARE_THEME;
}
