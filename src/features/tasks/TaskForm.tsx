import React, { useState } from 'react';
import {
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { TextField } from '../../components/TextField';
import { Button } from '../../components/Button';
import { useTheme } from '../../theme/theme';
import { priorityColor } from '../../theme/colors';
import { useProjects } from '../projects/queries';
import type { Priority, RecurringPattern, Task } from '../../types/tududi';

export interface TaskFormValues {
    name: string;
    note: string;
    priority: Priority | null;
    due_date: string | null;
    project_id: number | null;
    recurring_pattern: RecurringPattern | null;
    recurring_interval: number | null;
    recurring_end_date: string | null;
    recurrence_completion_based: boolean;
}

export function toFormValues(t: Task | null | undefined): TaskFormValues {
    return {
        name: t?.name ?? '',
        note: t?.note ?? '',
        priority: t?.priority ?? null,
        due_date: t?.due_date ?? null,
        project_id: t?.project_id ?? null,
        recurring_pattern: t?.recurring_pattern ?? null,
        recurring_interval: t?.recurring_interval ?? null,
        recurring_end_date: t?.recurring_end_date ?? null,
        recurrence_completion_based: t?.recurrence_completion_based ?? false,
    };
}

export interface TaskFormProps {
    initial?: TaskFormValues;
    submitting?: boolean;
    submitLabel?: string;
    onSubmit: (values: TaskFormValues) => void | Promise<void>;
    onDelete?: () => void;
}

const PRIORITIES: Array<{ id: Priority | null; label: string }> = [
    { id: null, label: 'None' },
    { id: 'low', label: 'Low' },
    { id: 'medium', label: 'Medium' },
    { id: 'high', label: 'High' },
];

const RECURRENCES: Array<{ id: RecurringPattern | null; label: string }> = [
    { id: null, label: 'Off' },
    { id: 'daily', label: 'Daily' },
    { id: 'weekly', label: 'Weekly' },
    { id: 'monthly', label: 'Monthly' },
    { id: 'monthly_weekday', label: 'Monthly weekday' },
    { id: 'monthly_last_day', label: 'Last day of month' },
    { id: 'yearly', label: 'Yearly' },
];

export function TaskForm({
    initial,
    onSubmit,
    onDelete,
    submitting,
    submitLabel = 'Save',
}: TaskFormProps) {
    const { palette, radius } = useTheme();
    const [values, setValues] = useState<TaskFormValues>(
        initial ?? toFormValues(null)
    );
    const [showDate, setShowDate] = useState(false);
    const [showEndDate, setShowEndDate] = useState(false);
    const { data: projects = [] } = useProjects();

    const update = <K extends keyof TaskFormValues>(
        key: K,
        value: TaskFormValues[K]
    ) => setValues((prev) => ({ ...prev, [key]: value }));

    return (
        <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
            <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 120 }}>
                <TextField
                    label="Name"
                    value={values.name}
                    onChangeText={(v) => update('name', v)}
                    placeholder="What needs doing?"
                    autoFocus={!initial?.name}
                />

                <TextField
                    label="Notes (Markdown supported)"
                    value={values.note}
                    onChangeText={(v) => update('note', v)}
                    placeholder="Additional details…"
                    multiline
                    numberOfLines={4}
                    style={{ minHeight: 100, textAlignVertical: 'top' }}
                />

                <Text style={[styles.label, { color: palette.textMuted }]}>Priority</Text>
                <View style={styles.row}>
                    {PRIORITIES.map((p) => {
                        const active = values.priority === p.id;
                        const dot = p.id ? priorityColor[p.id] : palette.textFaint;
                        return (
                            <Pressable
                                key={String(p.id)}
                                onPress={() => update('priority', p.id)}
                                style={[
                                    styles.chip,
                                    {
                                        backgroundColor: active ? palette.bgMuted : palette.bgElevated,
                                        borderColor: active ? palette.primary : palette.border,
                                        borderRadius: radius.pill,
                                    },
                                ]}
                            >
                                <View
                                    style={{
                                        width: 8,
                                        height: 8,
                                        borderRadius: 4,
                                        backgroundColor: dot,
                                        marginRight: 6,
                                    }}
                                />
                                <Text style={{ color: palette.text, fontSize: 13 }}>{p.label}</Text>
                            </Pressable>
                        );
                    })}
                </View>

                <Text style={[styles.label, { color: palette.textMuted }]}>Due date</Text>
                <View style={styles.row}>
                    <Pressable
                        onPress={() => setShowDate(true)}
                        style={[
                            styles.chip,
                            {
                                backgroundColor: palette.bgElevated,
                                borderColor: palette.border,
                                borderRadius: radius.md,
                            },
                        ]}
                    >
                        <Text style={{ color: palette.text, fontSize: 13 }}>
                            {values.due_date
                                ? new Date(values.due_date).toLocaleString()
                                : 'Set due date'}
                        </Text>
                    </Pressable>
                    {values.due_date ? (
                        <Pressable
                            onPress={() => update('due_date', null)}
                            style={[
                                styles.chip,
                                {
                                    backgroundColor: palette.bgElevated,
                                    borderColor: palette.border,
                                    borderRadius: radius.md,
                                },
                            ]}
                        >
                            <Text style={{ color: palette.danger, fontSize: 13 }}>Clear</Text>
                        </Pressable>
                    ) : null}
                </View>
                {showDate ? (
                    <DateTimePicker
                        value={values.due_date ? new Date(values.due_date) : new Date()}
                        mode="datetime"
                        onChange={(_, d) => {
                            setShowDate(Platform.OS === 'ios');
                            if (d) update('due_date', d.toISOString());
                        }}
                    />
                ) : null}

                <Text style={[styles.label, { color: palette.textMuted }]}>Project</Text>
                <View style={styles.row}>
                    <Pressable
                        onPress={() => update('project_id', null)}
                        style={[
                            styles.chip,
                            {
                                backgroundColor:
                                    values.project_id === null
                                        ? palette.bgMuted
                                        : palette.bgElevated,
                                borderColor:
                                    values.project_id === null ? palette.primary : palette.border,
                                borderRadius: radius.pill,
                            },
                        ]}
                    >
                        <Text style={{ color: palette.text, fontSize: 13 }}>None</Text>
                    </Pressable>
                    {projects.map((p) => {
                        const active = values.project_id === p.id;
                        return (
                            <Pressable
                                key={p.uid ?? p.id}
                                onPress={() => update('project_id', p.id)}
                                style={[
                                    styles.chip,
                                    {
                                        backgroundColor: active
                                            ? palette.bgMuted
                                            : palette.bgElevated,
                                        borderColor: active ? palette.primary : palette.border,
                                        borderRadius: radius.pill,
                                    },
                                ]}
                            >
                                <Text
                                    style={{ color: palette.text, fontSize: 13 }}
                                    numberOfLines={1}
                                >
                                    {p.name}
                                </Text>
                            </Pressable>
                        );
                    })}
                </View>

                <Text style={[styles.label, { color: palette.textMuted }]}>Recurrence</Text>
                <View style={styles.row}>
                    {RECURRENCES.map((r) => {
                        const active = values.recurring_pattern === r.id;
                        return (
                            <Pressable
                                key={String(r.id)}
                                onPress={() => update('recurring_pattern', r.id)}
                                style={[
                                    styles.chip,
                                    {
                                        backgroundColor: active
                                            ? palette.bgMuted
                                            : palette.bgElevated,
                                        borderColor: active ? palette.primary : palette.border,
                                        borderRadius: radius.pill,
                                    },
                                ]}
                            >
                                <Text style={{ color: palette.text, fontSize: 13 }}>{r.label}</Text>
                            </Pressable>
                        );
                    })}
                </View>

                {values.recurring_pattern ? (
                    <>
                        <TextField
                            label="Interval"
                            keyboardType="number-pad"
                            value={String(values.recurring_interval ?? 1)}
                            onChangeText={(v) => {
                                const n = parseInt(v, 10);
                                update('recurring_interval', isNaN(n) ? null : n);
                            }}
                            hint="Every N periods (e.g. 2 for every 2 weeks)"
                        />
                        <Pressable
                            onPress={() => setShowEndDate(true)}
                            style={[
                                styles.chip,
                                {
                                    backgroundColor: palette.bgElevated,
                                    borderColor: palette.border,
                                    borderRadius: radius.md,
                                    alignSelf: 'flex-start',
                                    marginBottom: 12,
                                },
                            ]}
                        >
                            <Text style={{ color: palette.text, fontSize: 13 }}>
                                {values.recurring_end_date
                                    ? `Ends ${new Date(values.recurring_end_date).toLocaleDateString()}`
                                    : 'Set end date (optional)'}
                            </Text>
                        </Pressable>
                        {showEndDate ? (
                            <DateTimePicker
                                value={
                                    values.recurring_end_date
                                        ? new Date(values.recurring_end_date)
                                        : new Date()
                                }
                                mode="date"
                                onChange={(_, d) => {
                                    setShowEndDate(Platform.OS === 'ios');
                                    if (d) update('recurring_end_date', d.toISOString());
                                }}
                            />
                        ) : null}
                        <Pressable
                            onPress={() =>
                                update(
                                    'recurrence_completion_based',
                                    !values.recurrence_completion_based
                                )
                            }
                            style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}
                        >
                            <View
                                style={{
                                    width: 18,
                                    height: 18,
                                    borderWidth: 2,
                                    borderColor: values.recurrence_completion_based
                                        ? palette.primary
                                        : palette.border,
                                    backgroundColor: values.recurrence_completion_based
                                        ? palette.primary
                                        : 'transparent',
                                    borderRadius: 4,
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                }}
                            >
                                {values.recurrence_completion_based ? (
                                    <Text style={{ color: '#fff', fontSize: 11 }}>✓</Text>
                                ) : null}
                            </View>
                            <Text style={{ color: palette.text, fontSize: 13 }}>
                                Repeat based on completion date
                            </Text>
                        </Pressable>
                    </>
                ) : null}

                <Button
                    title={submitLabel}
                    onPress={() => onSubmit(values)}
                    loading={submitting}
                    full
                    style={{ marginTop: 8 }}
                />
                {onDelete ? (
                    <Button
                        title="Delete task"
                        variant="danger"
                        onPress={onDelete}
                        full
                        style={{ marginTop: 8 }}
                    />
                ) : null}
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    label: { fontSize: 13, fontWeight: '500', marginTop: 8, marginBottom: 6 },
    row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 6 },
    chip: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        paddingHorizontal: 12,
        paddingVertical: 8,
    },
});
