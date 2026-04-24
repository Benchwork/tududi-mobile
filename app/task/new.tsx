import React from 'react';
import { Stack, useRouter } from 'expo-router';
import { Alert } from 'react-native';
import { Screen } from '@/components/Screen';
import { TaskForm, toFormValues, type TaskFormValues } from '@/features/tasks/TaskForm';
import { useCreateTask } from '@/features/tasks/queries';

export default function NewTaskScreen() {
    const router = useRouter();
    const create = useCreateTask();

    const onSubmit = async (values: TaskFormValues) => {
        if (!values.name.trim()) {
            Alert.alert('Task needs a name');
            return;
        }
        try {
            await create.mutateAsync({
                name: values.name.trim(),
                note: values.note || null,
                priority: values.priority,
                due_date: values.due_date,
                project_id: values.project_id,
                recurring_pattern: values.recurring_pattern,
                recurring_interval: values.recurring_interval,
                recurring_end_date: values.recurring_end_date,
                recurrence_completion_based: values.recurrence_completion_based,
            });
            router.back();
        } catch (err) {
            Alert.alert('Failed', err instanceof Error ? err.message : 'Unknown error');
        }
    };

    return (
        <Screen padded={false}>
            <Stack.Screen options={{ title: 'New task', headerShown: true }} />
            <TaskForm
                initial={toFormValues(null)}
                submitLabel="Create task"
                submitting={create.isPending}
                onSubmit={onSubmit}
            />
        </Screen>
    );
}
