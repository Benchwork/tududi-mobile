import { useColorScheme } from 'react-native';
import { useUiStore } from '../stores/ui';
import { darkPalette, lightPalette, type Palette } from './colors';

export interface Theme {
    palette: Palette;
    isDark: boolean;
    spacing: (n: number) => number;
    radius: {
        sm: number;
        md: number;
        lg: number;
        pill: number;
    };
    typography: {
        title: number;
        heading: number;
        body: number;
        caption: number;
    };
}

export function useTheme(): Theme {
    const pref = useUiStore((s) => s.theme);
    const system = useColorScheme();
    const resolved = pref === 'system' ? (system ?? 'light') : pref;
    const isDark = resolved === 'dark';
    return {
        palette: isDark ? darkPalette : lightPalette,
        isDark,
        spacing: (n: number) => n * 4,
        radius: { sm: 6, md: 10, lg: 16, pill: 999 },
        typography: { title: 28, heading: 20, body: 15, caption: 12 },
    };
}
