import React from 'react';
import {
    ActivityIndicator,
    Pressable,
    StyleSheet,
    Text,
    View,
    type PressableProps,
    type ViewStyle,
} from 'react-native';
import { useTheme } from '../theme/theme';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

export interface ButtonProps extends Omit<PressableProps, 'children' | 'style'> {
    title: string;
    variant?: ButtonVariant;
    loading?: boolean;
    leftIcon?: React.ReactNode;
    rightIcon?: React.ReactNode;
    full?: boolean;
    style?: ViewStyle;
}

export function Button({
    title,
    variant = 'primary',
    loading,
    leftIcon,
    rightIcon,
    full,
    disabled,
    style,
    ...rest
}: ButtonProps) {
    const { palette, radius } = useTheme();

    const bg =
        variant === 'primary'
            ? palette.primary
            : variant === 'danger'
              ? palette.danger
              : variant === 'secondary'
                ? palette.bgMuted
                : 'transparent';
    const fg =
        variant === 'primary' || variant === 'danger'
            ? palette.primaryText
            : variant === 'ghost'
              ? palette.primary
              : palette.text;
    const borderColor = variant === 'ghost' ? 'transparent' : palette.border;

    return (
        <Pressable
            {...rest}
            disabled={disabled || loading}
            style={({ pressed }) => [
                styles.base,
                {
                    backgroundColor: bg,
                    borderColor,
                    borderRadius: radius.md,
                    opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
                    width: full ? '100%' : undefined,
                },
                style,
            ]}
        >
            <View style={styles.row}>
                {loading ? (
                    <ActivityIndicator color={fg} />
                ) : (
                    <>
                        {leftIcon}
                        <Text style={[styles.text, { color: fg }]}>{title}</Text>
                        {rightIcon}
                    </>
                )}
            </View>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    base: {
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderWidth: 1,
        minHeight: 44,
        justifyContent: 'center',
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    text: {
        fontSize: 15,
        fontWeight: '600',
    },
});
