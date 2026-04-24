export interface Palette {
    bg: string;
    bgElevated: string;
    bgMuted: string;
    border: string;
    text: string;
    textMuted: string;
    textFaint: string;
    primary: string;
    primaryText: string;
    danger: string;
    success: string;
    warning: string;
    accent: string;
    overlay: string;
}

export const lightPalette: Palette = {
    bg: '#f8fafc',
    bgElevated: '#ffffff',
    bgMuted: '#f1f5f9',
    border: '#e2e8f0',
    text: '#0f172a',
    textMuted: '#475569',
    textFaint: '#94a3b8',
    primary: '#4f46e5',
    primaryText: '#ffffff',
    danger: '#ef4444',
    success: '#16a34a',
    warning: '#f59e0b',
    accent: '#0ea5e9',
    overlay: 'rgba(15, 23, 42, 0.45)',
};

export const darkPalette: Palette = {
    bg: '#0b1220',
    bgElevated: '#121a2b',
    bgMuted: '#1a2440',
    border: '#1f2a44',
    text: '#e2e8f0',
    textMuted: '#94a3b8',
    textFaint: '#64748b',
    primary: '#818cf8',
    primaryText: '#0b1220',
    danger: '#f87171',
    success: '#4ade80',
    warning: '#fbbf24',
    accent: '#38bdf8',
    overlay: 'rgba(0, 0, 0, 0.6)',
};

export const priorityColor: Record<'low' | 'medium' | 'high', string> = {
    low: '#64748b',
    medium: '#f59e0b',
    high: '#ef4444',
};
