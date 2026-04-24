import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { inboxRepo } from '../../db/repositories';
import { enqueue } from '../../sync/outbox';
import { useSyncStore } from '../../sync/scheduler';

export const inboxKeys = {
    list: () => ['inbox', 'list'] as const,
};

export function useInbox() {
    return useQuery({
        queryKey: inboxKeys.list(),
        queryFn: () => inboxRepo.list(),
    });
}

export function useCreateInboxItem() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (content: string) => inboxRepo.insertLocal(content),
        onSuccess: async (item) => {
            await enqueue('inbox_items', 'create', item.uid!, { content: item.content });
            void qc.invalidateQueries({ queryKey: inboxKeys.list() });
            void useSyncStore.getState().run({ silent: true });
        },
    });
}

export function useDeleteInboxItem() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async (uid: string) => {
            const list = await inboxRepo.list();
            const existing = list.find((x) => x.uid === uid);
            const result = await inboxRepo.markDeleted(uid);
            return { existing, result };
        },
        onSuccess: async ({ existing, result }) => {
            if (result === 'tombstoned' && existing) {
                await enqueue(
                    'inbox_items',
                    'delete',
                    existing.uid!,
                    null,
                    existing.id && existing.id > 0 ? existing.id : undefined
                );
            }
            void qc.invalidateQueries({ queryKey: inboxKeys.list() });
            void useSyncStore.getState().run({ silent: true });
        },
    });
}

export function useMarkInboxProcessed() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async (uid: string) => {
            await inboxRepo.markProcessed(uid);
            const list = await inboxRepo.list();
            return list.find((x) => x.uid === uid);
        },
        onSuccess: async (item) => {
            if (item) {
                await enqueue(
                    'inbox_items',
                    'update',
                    item.uid!,
                    { status: 'processed' },
                    item.id && item.id > 0 ? item.id : undefined
                );
            }
            void qc.invalidateQueries({ queryKey: inboxKeys.list() });
            void useSyncStore.getState().run({ silent: true });
        },
    });
}
