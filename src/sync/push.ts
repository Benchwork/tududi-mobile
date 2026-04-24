import { endpoints } from '../api/endpoints';
import { isApiError } from '../api/errors';
import {
    areasRepo,
    inboxRepo,
    notesRepo,
    projectsRepo,
    tasksRepo,
} from '../db/repositories';
import { markFailure, markSuccess, pending, type OutboxEntry, type SyncEntity } from './outbox';

export interface PushResult {
    succeeded: number;
    failed: number;
    errors: string[];
}

type ServerEntity = { id?: number; uid?: string };

async function applyServerResult(
    entity: SyncEntity,
    clientUid: string,
    server: ServerEntity | null
): Promise<void> {
    if (!server) return;
    const serverId = typeof server.id === 'number' ? server.id : undefined;
    switch (entity) {
        case 'tasks':
            await tasksRepo.clearDirty(clientUid, serverId);
            break;
        case 'projects':
            await projectsRepo.clearDirty(clientUid, serverId);
            break;
        case 'areas':
            await areasRepo.clearDirty(clientUid, serverId);
            break;
        case 'notes':
            await notesRepo.clearDirty(clientUid, serverId);
            break;
        case 'inbox_items':
            await inboxRepo.clearDirty(clientUid, serverId);
            break;
    }
}

async function purgeAfterDelete(entity: SyncEntity, uid: string): Promise<void> {
    switch (entity) {
        case 'tasks':
            await tasksRepo.purge(uid);
            break;
        case 'projects':
            await projectsRepo.purge(uid);
            break;
        case 'areas':
            await areasRepo.purge(uid);
            break;
        case 'notes':
            await notesRepo.purge(uid);
            break;
        case 'inbox_items':
            await inboxRepo.purge(uid);
            break;
    }
}

async function executeEntry(entry: OutboxEntry): Promise<void> {
    const payload = entry.payload ? (JSON.parse(entry.payload) as Record<string, unknown>) : {};
    const resourceId = entry.resource_id;

    switch (entry.entity) {
        case 'tasks': {
            if (entry.op === 'create') {
                const created = (await endpoints.tasks.create(payload)) as ServerEntity;
                await applyServerResult('tasks', entry.resource_uid, created);
            } else if (entry.op === 'update') {
                if (!resourceId) throw new Error('Missing server id for task update');
                const updated = (await endpoints.tasks.update(resourceId, payload)) as ServerEntity;
                await applyServerResult('tasks', entry.resource_uid, updated);
            } else {
                if (resourceId) {
                    await endpoints.tasks.delete(resourceId);
                }
                await purgeAfterDelete('tasks', entry.resource_uid);
            }
            return;
        }
        case 'projects': {
            if (entry.op === 'create') {
                const created = (await endpoints.projects.create(payload)) as ServerEntity;
                await applyServerResult('projects', entry.resource_uid, created);
            } else if (entry.op === 'update') {
                if (!resourceId) throw new Error('Missing server id for project update');
                const updated = (await endpoints.projects.update(resourceId, payload)) as ServerEntity;
                await applyServerResult('projects', entry.resource_uid, updated);
            } else {
                if (resourceId) await endpoints.projects.delete(resourceId);
                await purgeAfterDelete('projects', entry.resource_uid);
            }
            return;
        }
        case 'areas': {
            if (entry.op === 'create') {
                const created = (await endpoints.areas.create(payload)) as ServerEntity;
                await applyServerResult('areas', entry.resource_uid, created);
            } else if (entry.op === 'update') {
                if (!resourceId) throw new Error('Missing server id for area update');
                const updated = (await endpoints.areas.update(resourceId, payload)) as ServerEntity;
                await applyServerResult('areas', entry.resource_uid, updated);
            } else {
                if (resourceId) await endpoints.areas.delete(resourceId);
                await purgeAfterDelete('areas', entry.resource_uid);
            }
            return;
        }
        case 'notes': {
            if (entry.op === 'create') {
                const created = (await endpoints.notes.create(payload)) as ServerEntity;
                await applyServerResult('notes', entry.resource_uid, created);
            } else if (entry.op === 'update') {
                if (!resourceId) throw new Error('Missing server id for note update');
                const updated = (await endpoints.notes.update(resourceId, payload)) as ServerEntity;
                await applyServerResult('notes', entry.resource_uid, updated);
            } else {
                if (resourceId) await endpoints.notes.delete(resourceId);
                await purgeAfterDelete('notes', entry.resource_uid);
            }
            return;
        }
        case 'inbox_items': {
            if (entry.op === 'create') {
                const content = typeof payload.content === 'string' ? payload.content : '';
                const created = (await endpoints.inbox.create(content)) as ServerEntity;
                await applyServerResult('inbox_items', entry.resource_uid, created);
            } else if (entry.op === 'update') {
                if (!resourceId) throw new Error('Missing server id for inbox update');
                const updated = (await endpoints.inbox.update(resourceId, payload)) as ServerEntity;
                await applyServerResult('inbox_items', entry.resource_uid, updated);
            } else {
                if (resourceId) await endpoints.inbox.delete(resourceId);
                await purgeAfterDelete('inbox_items', entry.resource_uid);
            }
            return;
        }
    }
}

export async function drainOutbox(max = 100): Promise<PushResult> {
    const result: PushResult = { succeeded: 0, failed: 0, errors: [] };
    const entries = await pending(max);
    for (const entry of entries) {
        try {
            await executeEntry(entry);
            await markSuccess(entry.id);
            result.succeeded += 1;
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            if (isApiError(err) && !err.isRetryable) {
                // Non-retryable failure - drop the entry to avoid infinite loop,
                // but keep the local row dirty so the user can inspect or retry manually.
                await markSuccess(entry.id);
                result.failed += 1;
                result.errors.push(`${entry.entity}#${entry.id} (dropped): ${msg}`);
            } else {
                await markFailure(entry.id, msg);
                result.failed += 1;
                result.errors.push(`${entry.entity}#${entry.id}: ${msg}`);
                break; // stop draining on transient error so we preserve order
            }
        }
    }
    return result;
}
