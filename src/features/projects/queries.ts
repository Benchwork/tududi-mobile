import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { projectsRepo } from '../../db/repositories';
import type { Project } from '../../types/tududi';
import { enqueue } from '../../sync/outbox';
import { useSyncStore } from '../../sync/scheduler';

export const projectKeys = {
    all: ['projects'] as const,
    list: () => ['projects', 'list'] as const,
    detail: (id: number | string) => ['projects', 'detail', id] as const,
};

export function useProjects() {
    return useQuery({
        queryKey: projectKeys.list(),
        queryFn: () => projectsRepo.list(),
    });
}

export function useProject(id: number | undefined) {
    return useQuery({
        queryKey: id ? projectKeys.detail(id) : ['projects', 'detail', 'none'],
        queryFn: () => (id ? projectsRepo.getById(id) : null),
        enabled: !!id,
    });
}

function buildPayload(p: Project): Partial<Project> {
    return {
        name: p.name,
        description: p.description ?? null,
        status: p.status ?? 'not_started',
        priority: p.priority ?? null,
        area_id: p.area_id ?? null,
        active: p.active ?? true,
        pin_to_sidebar: p.pin_to_sidebar ?? false,
    };
}

export function useCreateProject() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (input: Partial<Project>) => projectsRepo.insertLocal(input),
        onSuccess: async (p) => {
            await enqueue('projects', 'create', p.uid!, buildPayload(p));
            void qc.invalidateQueries({ queryKey: projectKeys.all });
            void useSyncStore.getState().run({ silent: true });
        },
    });
}

export function useUpdateProject() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async ({ uid, patch }: { uid: string; patch: Partial<Project> }) => {
            await projectsRepo.patchLocal(uid, patch);
            return projectsRepo.getByUid(uid);
        },
        onSuccess: async (p) => {
            if (!p) return;
            await enqueue(
                'projects',
                'update',
                p.uid!,
                buildPayload(p),
                p.id && p.id > 0 ? p.id : undefined
            );
            void qc.invalidateQueries({ queryKey: projectKeys.all });
            void useSyncStore.getState().run({ silent: true });
        },
    });
}

export function useDeleteProject() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async (uid: string) => {
            const existing = await projectsRepo.getByUid(uid);
            const result = await projectsRepo.markDeleted(uid);
            return { existing, result };
        },
        onSuccess: async ({ existing, result }) => {
            if (result === 'tombstoned' && existing) {
                await enqueue(
                    'projects',
                    'delete',
                    existing.uid!,
                    null,
                    existing.id && existing.id > 0 ? existing.id : undefined
                );
            }
            void qc.invalidateQueries({ queryKey: projectKeys.all });
            void useSyncStore.getState().run({ silent: true });
        },
    });
}
