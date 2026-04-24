import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme/theme';

export interface BadgeProps {
    label: string;
    color?: string;
    variant?: 'solid' | 'soft' | 'outline';
}

export function Badge({ label, color, variant = 'soft' }: BadgeProps) {
    const { palette, radius } = useTheme();
    const accent = color ?? palette.accent;
    const bg =
        variant === 'solid' ? accent : variant === 'soft' ? `${accent}22` : 'transparent';
    const fg = variant === 'solid' ? '#fff' : accent;
    const border = variant === 'outline' ? accent : 'transparent';
    return (
        <View
            style={[
                styles.badge,
                { backgroundColor: bg, borderRadius: radius.pill, borderColor: border },
            ]}
        >
            <Text style={[styles.text, { color: fg }]} numberOfLines={1}>
                {label}
            </Text>
        </View>
    );
}

const styles = StyleSheet.create({
    badge: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderWidth: 1,
        alignSelf: 'flex-start',
    },
    text: { fontSize: 11, fontWeight: '600' },
});
