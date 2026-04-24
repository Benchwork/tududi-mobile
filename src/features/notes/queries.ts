import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notesRepo } from '../../db/repositories';
import type { Note } from '../../types/tududi';
import { enqueue } from '../../sync/outbox';
import { useSyncStore } from '../../sync/scheduler';

export const noteKeys = {
    all: ['notes'] as const,
    list: () => ['notes', 'list'] as const,
    detail: (id: number) => ['notes', 'detail', id] as const,
    byProject: (projectId: number) => ['notes', 'project', projectId] as const,
};

export function useNotes() {
    return useQuery({
        queryKey: noteKeys.list(),
        queryFn: () => notesRepo.list(),
    });
}

export function useNotesByProject(projectId: number | undefined) {
    return useQuery({
        queryKey: projectId ? noteKeys.byProject(projectId) : ['notes', 'none'],
        queryFn: () => (projectId ? notesRepo.byProject(projectId) : []),
        enabled: !!projectId,
    });
}

export function useNote(id: number | undefined) {
    return useQuery({
        queryKey: id ? noteKeys.detail(id) : ['notes', 'detail', 'none'],
        queryFn: () => (id ? notesRepo.getById(id) : null),
        enabled: !!id,
    });
}

function buildPayload(n: Note) {
    return {
        title: n.title ?? null,
        content: n.content ?? null,
        color: n.color ?? null,
        project_id: n.project_id ?? null,
    };
}

export function useCreateNote() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (input: Partial<Note>) => notesRepo.insertLocal(input),
        onSuccess: async (n) => {
            await enqueue('notes', 'create', n.uid!, buildPayload(n));
            void qc.invalidateQueries({ queryKey: noteKeys.all });
            void useSyncStore.getState().run({ silent: true });
        },
    });
}

export function useUpdateNote() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async ({ uid, patch }: { uid: string; patch: Partial<Note> }) => {
            await notesRepo.patchLocal(uid, patch);
            const list = await notesRepo.list();
            return list.find((x) => x.uid === uid) ?? null;
        },
        onSuccess: async (n) => {
            if (!n) return;
            await enqueue(
                'notes',
                'update',
                n.uid!,
                buildPayload(n),
                n.id && n.id > 0 ? n.id : undefined
            );
            void qc.invalidateQueries({ queryKey: noteKeys.all });
            void useSyncStore.getState().run({ silent: true });
        },
    });
}

export function useDeleteNote() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async (uid: string) => {
            const list = await notesRepo.list();
            const existing = list.find((x) => x.uid === uid);
            const result = await notesRepo.markDeleted(uid);
            return { existing, result };
        },
        onSuccess: async ({ existing, result }) => {
            if (result === 'tombstoned' && existing) {
                await enqueue(
                    'notes',
                    'delete',
                    existing.uid!,
                    null,
                    existing.id && existing.id > 0 ? existing.id : undefined
                );
            }
            void qc.invalidateQueries({ queryKey: noteKeys.all });
            void useSyncStore.getState().run({ silent: true });
        },
    });
}
