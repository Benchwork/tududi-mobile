import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { areasRepo } from '../../db/repositories';
import type { Area } from '../../types/tududi';
import { enqueue } from '../../sync/outbox';
import { useSyncStore } from '../../sync/scheduler';

export const areaKeys = {
    all: ['areas'] as const,
    list: () => ['areas', 'list'] as const,
    detail: (id: number) => ['areas', 'detail', id] as const,
};

export function useAreas() {
    return useQuery({
        queryKey: areaKeys.list(),
        queryFn: () => areasRepo.list(),
    });
}

export function useArea(id: number | undefined) {
    return useQuery({
        queryKey: id ? areaKeys.detail(id) : ['areas', 'detail', 'none'],
        queryFn: () => (id ? areasRepo.getById(id) : null),
        enabled: !!id,
    });
}

export function useCreateArea() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (input: Partial<Area>) => areasRepo.insertLocal(input),
        onSuccess: async (a) => {
            await enqueue('areas', 'create', a.uid!, {
                name: a.name,
                description: a.description ?? null,
            });
            void qc.invalidateQueries({ queryKey: areaKeys.all });
            void useSyncStore.getState().run({ silent: true });
        },
    });
}

export function useUpdateArea() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async ({ uid, patch }: { uid: string; patch: Partial<Area> }) => {
            await areasRepo.patchLocal(uid, patch);
            const list = await areasRepo.list();
            return list.find((x) => x.uid === uid) ?? null;
        },
        onSuccess: async (a) => {
            if (!a) return;
            await enqueue(
                'areas',
                'update',
                a.uid!,
                { name: a.name, description: a.description ?? null },
                a.id && a.id > 0 ? a.id : undefined
            );
            void qc.invalidateQueries({ queryKey: areaKeys.all });
            void useSyncStore.getState().run({ silent: true });
        },
    });
}

export function useDeleteArea() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async (uid: string) => {
            const list = await areasRepo.list();
            const existing = list.find((x) => x.uid === uid);
            const result = await areasRepo.markDeleted(uid);
            return { existing, result };
        },
        onSuccess: async ({ existing, result }) => {
            if (result === 'tombstoned' && existing) {
                await enqueue(
                    'areas',
                    'delete',
                    existing.uid!,
                    null,
                    existing.id && existing.id > 0 ? existing.id : undefined
                );
            }
            void qc.invalidateQueries({ queryKey: areaKeys.all });
            void useSyncStore.getState().run({ silent: true });
        },
    });
}
