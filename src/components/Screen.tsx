import React from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useTheme } from '../theme/theme';

export interface ScreenProps {
    children: React.ReactNode;
    padded?: boolean;
    style?: ViewStyle;
    edges?: Array<'top' | 'bottom' | 'left' | 'right'>;
}

export function Screen({ children, padded = true, style, edges }: ScreenProps) {
    const { palette, isDark } = useTheme();
    return (
        <SafeAreaView
            edges={edges}
            style={[styles.root, { backgroundColor: palette.bg }]}
        >
            <StatusBar style={isDark ? 'light' : 'dark'} />
            <View style={[styles.inner, padded && styles.padded, style]}>{children}</View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1 },
    inner: { flex: 1 },
    padded: { padding: 16 },
});
