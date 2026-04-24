import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { format, isToday, isTomorrow, isYesterday, parseISO } from 'date-fns';
import { useTheme } from '../../theme/theme';
import { priorityColor } from '../../theme/colors';
import type { Task } from '../../types/tududi';

export interface TaskRowProps {
    task: Task;
    onPress?: () => void;
    onToggle?: () => void;
    compact?: boolean;
}

function formatDueDate(iso: string): string {
    try {
        const d = parseISO(iso);
        if (isToday(d)) return `Today, ${format(d, 'HH:mm')}`;
        if (isTomorrow(d)) return `Tomorrow, ${format(d, 'HH:mm')}`;
        if (isYesterday(d)) return `Yesterday, ${format(d, 'HH:mm')}`;
        return format(d, 'EEE d MMM');
    } catch {
        return iso;
    }
}

function isOverdue(iso: string | null | undefined, status: Task['status']): boolean {
    if (!iso || status === 'completed') return false;
    try {
        return parseISO(iso).getTime() < Date.now();
    } catch {
        return false;
    }
}

export function TaskRow({ task, onPress, onToggle, compact }: TaskRowProps) {
    const { palette, radius } = useTheme();
    const completed = task.status === 'completed';
    const overdue = isOverdue(task.due_date, task.status);

    return (
        <Pressable
            onPress={onPress}
            style={({ pressed }) => [
                styles.row,
                {
                    backgroundColor: palette.bgElevated,
                    borderColor: palette.border,
                    borderRadius: radius.md,
                    opacity: pressed ? 0.85 : 1,
                },
                compact && styles.compact,
            ]}
        >
            <Pressable
                onPress={onToggle}
                hitSlop={10}
                style={[
                    styles.check,
                    {
                        borderColor: completed ? palette.success : palette.border,
                        backgroundColor: completed ? palette.success : 'transparent',
                    },
                ]}
                accessibilityLabel={completed ? 'Mark incomplete' : 'Mark complete'}
            >
                {completed ? <Text style={styles.checkMark}>✓</Text> : null}
            </Pressable>

            <View style={styles.body}>
                <Text
                    numberOfLines={2}
                    style={[
                        styles.name,
                        {
                            color: palette.text,
                            textDecorationLine: completed ? 'line-through' : 'none',
                            opacity: completed ? 0.6 : 1,
                        },
                    ]}
                >
                    {task.name}
                </Text>
                <View style={styles.meta}>
                    {task.priority ? (
                        <View style={styles.metaChip}>
                            <View
                                style={[
                                    styles.priorityDot,
                                    {
                                        backgroundColor:
                                            priorityColor[task.priority] ?? palette.textFaint,
                                    },
                                ]}
                            />
                            <Text style={[styles.metaText, { color: palette.textMuted }]}>
                                {task.priority}
                            </Text>
                        </View>
                    ) : null}
                    {task.due_date ? (
                        <Text
                            style={[
                                styles.metaText,
                                { color: overdue ? palette.danger : palette.textMuted },
                            ]}
                        >
                            {formatDueDate(task.due_date)}
                        </Text>
                    ) : null}
                    {task.recurring_pattern ? (
                        <Text style={[styles.metaText, { color: palette.accent }]}>
                            ↻ {task.recurring_pattern}
                        </Text>
                    ) : null}
                </View>
            </View>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    row: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        padding: 12,
        borderWidth: 1,
        gap: 12,
    },
    compact: { padding: 10 },
    check: {
        width: 22,
        height: 22,
        borderRadius: 11,
        borderWidth: 2,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 2,
    },
    checkMark: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '700',
        lineHeight: 16,
    },
    body: { flex: 1, gap: 4 },
    name: { fontSize: 15, fontWeight: '500' },
    meta: { flexDirection: 'row', gap: 10, alignItems: 'center', flexWrap: 'wrap' },
    metaChip: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    priorityDot: { width: 6, height: 6, borderRadius: 3 },
    metaText: { fontSize: 12 },
});
