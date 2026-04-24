import React from 'react';
import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { useTheme } from '../theme/theme';

export interface TextFieldProps extends TextInputProps {
    label?: string;
    hint?: string;
    error?: string;
}

export function TextField({ label, hint, error, style, ...rest }: TextFieldProps) {
    const { palette, radius } = useTheme();
    return (
        <View style={styles.wrap}>
            {label ? <Text style={[styles.label, { color: palette.textMuted }]}>{label}</Text> : null}
            <TextInput
                placeholderTextColor={palette.textFaint}
                {...rest}
                style={[
                    styles.input,
                    {
                        color: palette.text,
                        borderColor: error ? palette.danger : palette.border,
                        backgroundColor: palette.bgElevated,
                        borderRadius: radius.md,
                    },
                    style,
                ]}
            />
            {error ? (
                <Text style={[styles.hint, { color: palette.danger }]}>{error}</Text>
            ) : hint ? (
                <Text style={[styles.hint, { color: palette.textFaint }]}>{hint}</Text>
            ) : null}
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: { marginBottom: 12, width: '100%' },
    label: { fontSize: 13, marginBottom: 6, fontWeight: '500' },
    input: {
        borderWidth: 1,
        paddingVertical: 12,
        paddingHorizontal: 14,
        fontSize: 15,
        minHeight: 44,
    },
    hint: { fontSize: 12, marginTop: 4 },
});
