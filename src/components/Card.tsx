import React from 'react';
import { StyleSheet, View, type ViewProps } from 'react-native';
import { useTheme } from '../theme/theme';

export function Card({ style, children, ...rest }: ViewProps) {
    const { palette, radius } = useTheme();
    return (
        <View
            {...rest}
            style={[
                styles.card,
                {
                    backgroundColor: palette.bgElevated,
                    borderColor: palette.border,
                    borderRadius: radius.md,
                },
                style,
            ]}
        >
            {children}
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        borderWidth: 1,
        padding: 14,
    },
});
