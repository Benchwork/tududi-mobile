import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme/theme';

export interface EmptyStateProps {
    title: string;
    message?: string;
    action?: React.ReactNode;
}

export function EmptyState({ title, message, action }: EmptyStateProps) {
    const { palette } = useTheme();
    return (
        <View style={styles.wrap}>
            <Text style={[styles.title, { color: palette.text }]}>{title}</Text>
            {message ? (
                <Text style={[styles.message, { color: palette.textMuted }]}>{message}</Text>
            ) : null}
            {action}
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: {
        alignItems: 'center',
        justifyContent: 'center',
        padding: 32,
        gap: 8,
    },
    title: { fontSize: 17, fontWeight: '600' },
    message: { fontSize: 14, textAlign: 'center' },
});
