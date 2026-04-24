import { endpoints } from '../api/endpoints';
import {
    areasRepo,
    inboxRepo,
    metaRepo,
    notesRepo,
    projectsRepo,
    tagsRepo,
    tasksRepo,
} from '../db/repositories';

export interface PullResult {
    tasks: number;
    projects: number;
    areas: number;
    notes: number;
    tags: number;
    inbox: number;
    errors: string[];
}

async function runSafe<T>(fn: () => Promise<T[]>, errors: string[], label: string): Promise<T[]> {
    try {
        return await fn();
    } catch (err) {
        errors.push(`${label}: ${err instanceof Error ? err.message : String(err)}`);
        return [];
    }
}

export async function pullAll(): Promise<PullResult> {
    const errors: string[] = [];
    const lastSync = (await metaRepo.get('last_sync_at')) ?? undefined;

    const [tasks, projects, areas, notes, tags, inbox] = await Promise.all([
        runSafe(() => endpoints.tasks.list({ status: 'all', updated_since: lastSync }), errors, 'tasks'),
        runSafe(() => endpoints.projects.list({ updated_since: lastSync }), errors, 'projects'),
        runSafe(() => endpoints.areas.list(), errors, 'areas'),
        runSafe(() => endpoints.notes.list(), errors, 'notes'),
        runSafe(() => endpoints.tags.list(), errors, 'tags'),
        runSafe(() => endpoints.inbox.list(), errors, 'inbox'),
    ]);

    for (const a of areas) await areasRepo.upsertServer(a);
    for (const p of projects) await projectsRepo.upsertServer(p);
    for (const t of tasks) await tasksRepo.upsertServer(t);
    for (const n of notes) await notesRepo.upsertServer(n);
    for (const tg of tags) await tagsRepo.upsertServer(tg);
    for (const i of inbox) await inboxRepo.upsertServer(i);

    if (errors.length === 0) {
        await metaRepo.set('last_sync_at', new Date().toISOString());
    }

    return {
        tasks: tasks.length,
        projects: projects.length,
        areas: areas.length,
        notes: notes.length,
        tags: tags.length,
        inbox: inbox.length,
        errors,
    };
}
