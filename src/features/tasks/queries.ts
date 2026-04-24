import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tasksRepo, type TaskQuery } from '../../db/repositories';
import type { Task } from '../../types/tududi';
import { enqueue } from '../../sync/outbox';
import { useSyncStore } from '../../sync/scheduler';

export const taskKeys = {
    all: ['tasks'] as const,
    list: (q: TaskQuery) => ['tasks', 'list', q] as const,
    detail: (uid: string) => ['tasks', 'detail', uid] as const,
    subtasks: (parentUid: string) => ['tasks', 'subtasks', parentUid] as const,
};

export function useTasks(query: TaskQuery) {
    return useQuery({
        queryKey: taskKeys.list(query),
        queryFn: () => tasksRepo.list(query),
    });
}

export function useTask(uid: string | undefined) {
    return useQuery({
        queryKey: uid ? taskKeys.detail(uid) : ['tasks', 'detail', 'none'],
        queryFn: () => (uid ? tasksRepo.getByUid(uid) : null),
        enabled: !!uid,
    });
}

function invalidateTasks(qc: ReturnType<typeof useQueryClient>) {
    void qc.invalidateQueries({ queryKey: taskKeys.all });
}

function runSync() {
    void useSyncStore.getState().run({ silent: true });
}

export function useCreateTask() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async (input: Partial<Task>) => tasksRepo.insertLocal(input),
        onSuccess: async (task) => {
            await enqueue('tasks', 'create', task.uid!, buildTaskPayload(task));
            invalidateTasks(qc);
            runSync();
        },
    });
}

export function useUpdateTask() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async ({ uid, patch }: { uid: string; patch: Partial<Task> }) => {
            await tasksRepo.patchLocal(uid, patch);
            return tasksRepo.getByUid(uid);
        },
        onSuccess: async (task) => {
            if (!task) return;
            await enqueue(
                'tasks',
                'update',
                task.uid!,
                buildTaskPayload(task),
                task.id && task.id > 0 ? task.id : undefined
            );
            invalidateTasks(qc);
            runSync();
        },
    });
}

export function useToggleTask() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async ({ uid, completed }: { uid: string; completed: boolean }) => {
            const status = completed ? 'completed' : 'pending';
            const completedAt = completed ? new Date().toISOString() : null;
            await tasksRepo.patchLocal(uid, { status, completed_at: completedAt });
            return tasksRepo.getByUid(uid);
        },
        onSuccess: async (task) => {
            if (!task) return;
            await enqueue(
                'tasks',
                'update',
                task.uid!,
                { status: task.status, completed_at: task.completed_at },
                task.id && task.id > 0 ? task.id : undefined
            );
            invalidateTasks(qc);
            runSync();
        },
    });
}

export function useDeleteTask() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async (uid: string) => {
            const existing = await tasksRepo.getByUid(uid);
            const result = await tasksRepo.markDeleted(uid);
            return { result, existing };
        },
        onSuccess: async ({ result, existing }) => {
            if (result === 'tombstoned' && existing) {
                await enqueue(
                    'tasks',
                    'delete',
                    existing.uid!,
                    null,
                    existing.id && existing.id > 0 ? existing.id : undefined
                );
            }
            invalidateTasks(qc);
            runSync();
        },
    });
}

function buildTaskPayload(t: Task): Partial<Task> {
    return {
        name: t.name,
        note: t.note ?? null,
        status: t.status ?? 'pending',
        priority: t.priority ?? null,
        due_date: t.due_date ?? null,
        project_id: t.project_id ?? null,
        parent_task_id: t.parent_task_id ?? null,
        recurring_pattern: t.recurring_pattern ?? null,
        recurring_interval: t.recurring_interval ?? null,
        recurring_end_date: t.recurring_end_date ?? null,
        recurring_weekday: t.recurring_weekday ?? null,
        recurring_week_of_month: t.recurring_week_of_month ?? null,
        recurrence_completion_based: t.recurrence_completion_based ?? false,
        completed_at: t.completed_at ?? null,
    };
}
