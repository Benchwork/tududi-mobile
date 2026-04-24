import React, { useMemo } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Screen } from '@/components/Screen';
import {
    TaskForm,
    toFormValues,
    type TaskFormValues,
} from '@/features/tasks/TaskForm';
import { SubtaskList } from '@/features/tasks/SubtaskList';
import {
    useDeleteTask,
    useTask,
    useUpdateTask,
} from '@/features/tasks/queries';
import { useTheme } from '@/theme/theme';

export default function TaskDetailScreen() {
    const { uid } = useLocalSearchParams<{ uid: string }>();
    const router = useRouter();
    const { palette } = useTheme();
    const { data: task, isLoading } = useTask(uid);
    const update = useUpdateTask();
    const del = useDeleteTask();

    const initial = useMemo(() => toFormValues(task ?? null), [task]);

    if (isLoading || !task) {
        return (
            <Screen>
                <Stack.Screen options={{ title: 'Task' }} />
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                    <ActivityIndicator color={palette.primary} />
                </View>
            </Screen>
        );
    }

    const onSubmit = async (values: TaskFormValues) => {
        if (!values.name.trim()) {
            Alert.alert('Task needs a name');
            return;
        }
        try {
            await update.mutateAsync({
                uid: task.uid!,
                patch: {
                    name: values.name.trim(),
                    note: values.note || null,
                    priority: values.priority,
                    due_date: values.due_date,
                    project_id: values.project_id,
                    recurring_pattern: values.recurring_pattern,
                    recurring_interval: values.recurring_interval,
                    recurring_end_date: values.recurring_end_date,
                    recurrence_completion_based: values.recurrence_completion_based,
                },
            });
            router.back();
        } catch (err) {
            Alert.alert('Failed', err instanceof Error ? err.message : 'Unknown error');
        }
    };

    const onDelete = () => {
        Alert.alert('Delete task?', 'This action cannot be undone.', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete',
                style: 'destructive',
                onPress: async () => {
                    await del.mutateAsync(task.uid!);
                    router.back();
                },
            },
        ]);
    };

    const hasParent = !!task.parent_task_id && task.parent_task_id > 0;

    return (
        <Screen padded={false}>
            <Stack.Screen options={{ title: task.name || 'Task', headerShown: true }} />
            <ScrollView contentContainerStyle={{ paddingBottom: 60 }}>
                {hasParent ? (
                    <View style={styles.parentBanner}>
                        <Pressable
                            onPress={() =>
                                router.push({
                                    pathname: '/task/[uid]',
                                    params: { uid: `srv_${task.parent_task_id}` },
                                })
                            }
                        >
                            <Text style={{ color: palette.primary, fontWeight: '600' }}>
                                ↥ Open parent task (edit recurrence)
                            </Text>
                            <Text style={{ color: palette.textMuted, fontSize: 12, marginTop: 2 }}>
                                This is a generated instance of a recurring task. Edit the parent to change how it repeats.
                            </Text>
                        </Pressable>
                    </View>
                ) : null}

                <TaskForm
                    initial={initial}
                    submitLabel="Save changes"
                    submitting={update.isPending}
                    onSubmit={onSubmit}
                    onDelete={onDelete}
                />

                {task.id && task.id > 0 && !hasParent ? (
                    <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
                        <SubtaskList parentUid={task.uid!} parentTaskId={task.id} />
                    </View>
                ) : null}
            </ScrollView>
        </Screen>
    );
}

const styles = StyleSheet.create({
    parentBanner: {
        margin: 16,
        padding: 12,
        borderWidth: 1,
        borderColor: 'rgba(99,102,241,0.3)',
        backgroundColor: 'rgba(99,102,241,0.08)',
        borderRadius: 10,
    },
});
