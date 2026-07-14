import { toServerTaskPayload } from '../api/taskMaps';
import { endpoints } from '../api/endpoints';
import { isApiError } from '../api/errors';
import {
    areasRepo,
    inboxRepo,
    notesRepo,
    projectsRepo,
    tasksRepo,
} from '../db/repositories';
import { markFailure, markSuccess, pending, retargetResourceUid, type OutboxEntry, type SyncEntity } from './outbox';
import { resolveResourceKey } from './resourceKey';

export interface PushResult {
    succeeded: number;
    failed: number;
    errors: string[];
}

type ServerEntity = { id?: number; uid?: string };

function normalizePayload(entity: SyncEntity, payload: Record<string, unknown>): Record<string, unknown> {
    if (entity === 'tasks') return toServerTaskPayload(payload);
    return payload;
}

async function applyServerResult(
    entity: SyncEntity,
    clientUid: string,
    server: ServerEntity | null
): Promise<void> {
    if (!server) return;
    const serverId = typeof server.id === 'number' ? server.id : undefined;
    const serverUid = server.uid?.trim();
    const shouldReplaceUid = !!(
        serverUid &&
        serverUid.length > 0 &&
        serverUid !== clientUid &&
        serverId
    );

    switch (entity) {
        case 'tasks':
            if (shouldReplaceUid) {
                await tasksRepo.replaceUid(clientUid, serverUid!, serverId!);
                await retargetResourceUid('tasks', clientUid, serverUid!);
            } else {
                await tasksRepo.clearDirty(clientUid, serverId, serverUid);
            }
            break;
        case 'projects':
            if (shouldReplaceUid) {
                await projectsRepo.replaceUid(clientUid, serverUid!, serverId!);
                await retargetResourceUid('projects', clientUid, serverUid!);
            } else {
                await projectsRepo.clearDirty(clientUid, serverId, serverUid);
            }
            break;
        case 'areas':
            if (shouldReplaceUid) {
                await areasRepo.replaceUid(clientUid, serverUid!, serverId!);
                await retargetResourceUid('areas', clientUid, serverUid!);
            } else {
                await areasRepo.clearDirty(clientUid, serverId, serverUid);
            }
            break;
        case 'notes':
            if (shouldReplaceUid) {
                await notesRepo.replaceUid(clientUid, serverUid!, serverId!);
                await retargetResourceUid('notes', clientUid, serverUid!);
            } else {
                await notesRepo.clearDirty(clientUid, serverId, serverUid);
            }
            break;
        case 'inbox_items':
            if (shouldReplaceUid) {
                await inboxRepo.replaceUid(clientUid, serverUid!, serverId!);
                await retargetResourceUid('inbox_items', clientUid, serverUid!);
            } else {
                await inboxRepo.clearDirty(clientUid, serverId, serverUid);
            }
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
    const rawPayload = entry.payload ? (JSON.parse(entry.payload) as Record<string, unknown>) : {};
    const payload = normalizePayload(entry.entity, rawPayload);
    const apiKey = await resolveResourceKey(
        entry.entity,
        entry.resource_uid,
        entry.resource_id
    );

    switch (entry.entity) {
        case 'tasks': {
            if (entry.op === 'create') {
                const created = (await endpoints.tasks.create(payload)) as ServerEntity;
                await applyServerResult('tasks', entry.resource_uid, created);
            } else if (entry.op === 'update') {
                const updated = (await endpoints.tasks.update(apiKey, payload)) as ServerEntity;
                await applyServerResult('tasks', entry.resource_uid, updated);
            } else {
                await endpoints.tasks.delete(apiKey);
                await purgeAfterDelete('tasks', entry.resource_uid);
            }
            return;
        }
        case 'projects': {
            if (entry.op === 'create') {
                const created = (await endpoints.projects.create(payload)) as ServerEntity;
                await applyServerResult('projects', entry.resource_uid, created);
            } else if (entry.op === 'update') {
                const updated = (await endpoints.projects.update(apiKey, payload)) as ServerEntity;
                await applyServerResult('projects', entry.resource_uid, updated);
            } else {
                await endpoints.projects.delete(apiKey);
                await purgeAfterDelete('projects', entry.resource_uid);
            }
            return;
        }
        case 'areas': {
            if (entry.op === 'create') {
                const created = (await endpoints.areas.create(payload)) as ServerEntity;
                await applyServerResult('areas', entry.resource_uid, created);
            } else if (entry.op === 'update') {
                const updated = (await endpoints.areas.update(apiKey, payload)) as ServerEntity;
                await applyServerResult('areas', entry.resource_uid, updated);
            } else {
                await endpoints.areas.delete(apiKey);
                await purgeAfterDelete('areas', entry.resource_uid);
            }
            return;
        }
        case 'notes': {
            if (entry.op === 'create') {
                const created = (await endpoints.notes.create(payload)) as ServerEntity;
                await applyServerResult('notes', entry.resource_uid, created);
            } else if (entry.op === 'update') {
                const updated = (await endpoints.notes.update(apiKey, payload)) as ServerEntity;
                await applyServerResult('notes', entry.resource_uid, updated);
            } else {
                await endpoints.notes.delete(apiKey);
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
                const updated = (await endpoints.inbox.update(apiKey, payload)) as ServerEntity;
                await applyServerResult('inbox_items', entry.resource_uid, updated);
            } else {
                await endpoints.inbox.delete(apiKey);
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
