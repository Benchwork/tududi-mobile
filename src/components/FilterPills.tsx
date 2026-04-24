import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { useTheme } from '../theme/theme';

export interface FilterOption<T extends string> {
    id: T;
    label: string;
}

export interface FilterPillsProps<T extends string> {
    options: Array<FilterOption<T>>;
    value: T;
    onChange: (v: T) => void;
}

export function FilterPills<T extends string>({
    options,
    value,
    onChange,
}: FilterPillsProps<T>) {
    const { palette, radius } = useTheme();
    return (
        <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.container}
        >
            {options.map((opt) => {
                const selected = opt.id === value;
                return (
                    <Pressable
                        key={opt.id}
                        onPress={() => onChange(opt.id)}
                        style={({ pressed }) => [
                            styles.pill,
                            {
                                backgroundColor: selected ? palette.primary : palette.bgElevated,
                                borderColor: selected ? palette.primary : palette.border,
                                borderRadius: radius.pill,
                                opacity: pressed ? 0.85 : 1,
                            },
                        ]}
                    >
                        <Text
                            style={{
                                color: selected ? palette.primaryText : palette.textMuted,
                                fontSize: 13,
                                fontWeight: '600',
                            }}
                        >
                            {opt.label}
                        </Text>
                    </Pressable>
                );
            })}
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { gap: 8, paddingHorizontal: 4, paddingVertical: 8 },
    pill: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderWidth: 1,
    },
});
