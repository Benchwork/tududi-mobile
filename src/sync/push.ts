import { taskToServerPayload, toServerTaskPayload } from '../api/taskMaps';
import { endpoints } from '../api/endpoints';
import { isApiError } from '../api/errors';
import { withDb } from '../db/database';
import {
    areasRepo,
    collectDirty,
    inboxRepo,
    notesRepo,
    projectsRepo,
    tasksRepo,
} from '../db/repositories';
import { isLocalUid } from '../db/uid';
import {
    enqueue,
    entryByResource,
    markFailure,
    markSuccess,
    pending,
    retargetResourceUid,
    type OutboxEntry,
    type SyncEntity,
    type SyncOp,
} from './outbox';
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

async function resolveTaskPushPayload(entry: OutboxEntry): Promise<Record<string, unknown>> {
    const raw = entry.payload ? (JSON.parse(entry.payload) as Record<string, unknown>) : {};
    const local =
        (await tasksRepo.getByUid(entry.resource_uid)) ??
        (entry.resource_id ? await tasksRepo.getById(entry.resource_id) : null);

    if (entry.op === 'update' && local) {
        const rawKeys = Object.keys(raw);
        const statusOnly =
            rawKeys.length === 1 && rawKeys[0] === 'status'
                ? true
                : rawKeys.length <= 2 &&
                  rawKeys.every((k) => k === 'status' || k === 'completed_at');
        if (statusOnly) {
            return toServerTaskPayload({ status: local.status });
        }
        return taskToServerPayload(local);
    }

    if (entry.op === 'create' && local) {
        return taskToServerPayload(local);
    }

    return toServerTaskPayload(raw);
}

async function resolveTaskOp(entry: OutboxEntry): Promise<'create' | 'update' | 'delete'> {
    if (entry.op === 'delete') return 'delete';
    const local =
        (await tasksRepo.getByUid(entry.resource_uid)) ??
        (entry.resource_id ? await tasksRepo.getById(entry.resource_id) : null);
    if (local?.uid && !isLocalUid(local.uid)) return 'update';
    return 'create';
}

function stripRecurrenceFields(payload: Record<string, unknown>): Record<string, unknown> {
    const out = { ...payload };
    for (const key of Object.keys(out)) {
        if (key.startsWith('recurrence_') || key === 'completion_based') {
            delete out[key];
        }
    }
    return out;
}

async function replayDirtyToOutbox(): Promise<void> {
    await withDb(async (db) => {
        const dirtyTasks = await collectDirty(db, 'tasks');
        for (const row of dirtyTasks) {
            const uid = typeof row.uid === 'string' ? row.uid : '';
            if (!uid || (await entryByResource('tasks', uid))) continue;

            const op = (row._pending_op as SyncOp | null) ?? 'update';
            if (row._deleted === 1 || op === 'delete') {
                await enqueue(
                    'tasks',
                    'delete',
                    uid,
                    null,
                    typeof row.id === 'number' && row.id > 0 ? row.id : undefined
                );
                continue;
            }

            const task = await tasksRepo.getByUid(uid);
            if (!task) continue;
            const resolvedOp: SyncOp = op === 'create' || isLocalUid(uid) ? 'create' : 'update';
            await enqueue(
                'tasks',
                resolvedOp,
                uid,
                taskToServerPayload(task),
                task.id && task.id > 0 ? task.id : undefined
            );
        }

        const dirtyInbox = await collectDirty(db, 'inbox_items');
        for (const row of dirtyInbox) {
            const uid = typeof row.uid === 'string' ? row.uid : '';
            if (!uid || (await entryByResource('inbox_items', uid))) continue;
            const op = (row._pending_op as SyncOp | null) ?? 'update';
            if (row._deleted === 1 || op === 'delete') {
                await enqueue(
                    'inbox_items',
                    'delete',
                    uid,
                    null,
                    typeof row.id === 'number' && row.id > 0 ? row.id : undefined
                );
                continue;
            }
            if (op === 'create') {
                const content = typeof row.content === 'string' ? row.content : '';
                await enqueue('inbox_items', 'create', uid, { content });
            } else {
                await enqueue('inbox_items', 'update', uid, {
                    content: row.content,
                    status: row.status,
                });
            }
        }
    });
}

async function sanitizeTaskPayloadForApi(
    payload: Record<string, unknown>
): Promise<Record<string, unknown>> {
    const out = { ...payload };

    if (typeof out.project_id === 'number') {
        if (out.project_id <= 0) {
            delete out.project_id;
        } else {
            const project = await projectsRepo.getById(out.project_id);
            if (!project?.id || project.id <= 0 || !project.uid || isLocalUid(project.uid)) {
                delete out.project_id;
            } else {
                out.project_uid = project.uid;
                delete out.project_id;
            }
        }
    }

    if (typeof out.parent_task_id === 'number') {
        if (out.parent_task_id <= 0) {
            delete out.parent_task_id;
        } else {
            const parent = await tasksRepo.getById(out.parent_task_id);
            if (!parent?.id || parent.id <= 0) delete out.parent_task_id;
        }
    }

    return out;
}

function minimalTaskCreatePayload(payload: Record<string, unknown>): Record<string, unknown> {
    const out: Record<string, unknown> = { name: payload.name };
    if (payload.note) out.note = payload.note;
    if (payload.due_date) out.due_date = payload.due_date;
    return out;
}

function taskCreateAttempts(payload: Record<string, unknown>): Record<string, unknown>[] {
    const stripped = stripRecurrenceFields(payload);
    const withoutProject = { ...stripped };
    delete withoutProject.project_uid;
    delete withoutProject.project_id;
    delete withoutProject.parent_task_id;
    delete withoutProject.priority;
    delete withoutProject.status;

    return [
        { name: stripped.name },
        minimalTaskCreatePayload(stripped),
        withoutProject,
        stripped,
    ];
}

function minimalTaskUpdatePayload(payload: Record<string, unknown>): Record<string, unknown> {
    if ('status' in payload && Object.keys(payload).length === 1) {
        return { status: payload.status };
    }
    const out: Record<string, unknown> = {};
    for (const key of ['name', 'status', 'note', 'priority', 'due_date'] as const) {
        if (payload[key] != null && payload[key] !== '') {
            out[key] = payload[key];
        }
    }
    return out;
}

async function pushTaskCreate(payload: Record<string, unknown>): Promise<ServerEntity> {
    let lastErr: unknown;
    const seen = new Set<string>();

    for (const body of taskCreateAttempts(payload)) {
        const key = JSON.stringify(body);
        if (seen.has(key)) continue;
        seen.add(key);
        const name = typeof body.name === 'string' ? body.name.trim() : '';
        if (!name) continue;
        try {
            return (await endpoints.tasks.create(body)) as ServerEntity;
        } catch (err) {
            lastErr = err;
            if (!isApiError(err) || !err.isServerError) throw err;
        }
    }
    throw formatPushError(lastErr);
}

function formatPushError(err: unknown): Error {
    if (isApiError(err)) {
        const code =
            err.body && typeof err.body === 'object' && 'code' in err.body
                ? String((err.body as { code?: unknown }).code ?? '')
                : '';
        const suffix = code ? ` (HTTP ${err.status}; ${code})` : ` (HTTP ${err.status})`;
        return new Error(`${err.message}${suffix}`);
    }
    return err instanceof Error ? err : new Error(String(err));
}

async function resolveInboxOp(
    entry: OutboxEntry
): Promise<'create' | 'update' | 'delete' | 'skip'> {
    if (entry.op === 'delete') return 'delete';
    const local =
        (await inboxRepo.getByUid(entry.resource_uid)) ??
        (entry.resource_id ? await inboxRepo.getById(entry.resource_id) : null);
    if (local?.uid && !isLocalUid(local.uid)) {
        return entry.op === 'create' ? 'create' : 'update';
    }
    if (entry.op === 'update') {
        const raw = entry.payload ? (JSON.parse(entry.payload) as Record<string, unknown>) : {};
        const keys = Object.keys(raw);
        if (keys.length === 1 && raw.status === 'processed') {
            return 'skip';
        }
    }
    return 'create';
}

async function resolveInboxPushPayload(entry: OutboxEntry): Promise<Record<string, unknown>> {
    const raw = entry.payload ? (JSON.parse(entry.payload) as Record<string, unknown>) : {};
    const local =
        (await inboxRepo.getByUid(entry.resource_uid)) ??
        (entry.resource_id ? await inboxRepo.getById(entry.resource_id) : null);
    if (local?.content && (!raw.content || raw.content === '')) {
        return { ...raw, content: local.content };
    }
    return raw;
}

async function pushInboxCreate(content: string): Promise<ServerEntity> {
    const trimmed = content.trim();
    if (!trimmed) throw new Error('Inbox content is required');
    return (await endpoints.inbox.create(trimmed)) as ServerEntity;
}

async function pushInboxUpdate(
    apiKey: string,
    payload: Record<string, unknown>
): Promise<ServerEntity> {
    const keys = Object.keys(payload);
    if (keys.length === 1 && payload.status === 'processed') {
        return (await endpoints.inbox.markProcessed(apiKey)) as ServerEntity;
    }
    try {
        return (await endpoints.inbox.update(apiKey, payload)) as ServerEntity;
    } catch (err) {
        if (isApiError(err) && (err.isNotFound || err.isForbidden) && isLocalUid(apiKey)) {
            const content = typeof payload.content === 'string' ? payload.content : '';
            if (!content.trim()) throw err;
            return pushInboxCreate(content);
        }
        throw err;
    }
}

async function pushTaskUpdate(
    apiKey: string,
    payload: Record<string, unknown>
): Promise<ServerEntity> {
    try {
        return (await endpoints.tasks.update(apiKey, payload)) as ServerEntity;
    } catch (err) {
        if (isApiError(err) && (err.isNotFound || err.isForbidden) && isLocalUid(apiKey)) {
            return pushTaskCreate(payload);
        }
        if (!isApiError(err) || !err.isServerError) throw err;
        const minimal = minimalTaskUpdatePayload(payload);
        if (Object.keys(minimal).length === 0 || JSON.stringify(minimal) === JSON.stringify(payload)) {
            throw err;
        }
        try {
            return (await endpoints.tasks.update(apiKey, minimal)) as ServerEntity;
        } catch (retryErr) {
            if (
                isApiError(retryErr) &&
                (retryErr.isNotFound || retryErr.isForbidden) &&
                isLocalUid(apiKey)
            ) {
                return pushTaskCreate(payload);
            }
            throw retryErr;
        }
    }
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
    const apiKey = await resolveResourceKey(
        entry.entity,
        entry.resource_uid,
        entry.resource_id
    );

    switch (entry.entity) {
        case 'tasks': {
            const op = await resolveTaskOp(entry);
            let payload = await sanitizeTaskPayloadForApi(await resolveTaskPushPayload(entry));
            if (op === 'create') {
                payload = stripRecurrenceFields(payload);
            }
            const name = typeof payload.name === 'string' ? payload.name.trim() : '';
            if (op !== 'delete' && !name) {
                throw new Error('Task name is required');
            }
            const payloadHint = Object.keys(payload).join(',');
            try {
                if (op === 'create') {
                    const created = await pushTaskCreate(payload);
                    await applyServerResult('tasks', entry.resource_uid, created);
                } else if (op === 'update') {
                    const updated = await pushTaskUpdate(apiKey, payload);
                    await applyServerResult('tasks', entry.resource_uid, updated);
                } else {
                    await endpoints.tasks.delete(apiKey);
                    await purgeAfterDelete('tasks', entry.resource_uid);
                }
            } catch (err) {
                throw new Error(
                    `${formatPushError(err).message} [op=${op}; fields=${payloadHint}]`
                );
            }
            return;
        }
        case 'projects': {
            const rawPayload = entry.payload ? (JSON.parse(entry.payload) as Record<string, unknown>) : {};
            const payload = normalizePayload(entry.entity, rawPayload);
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
            const rawPayload = entry.payload ? (JSON.parse(entry.payload) as Record<string, unknown>) : {};
            const payload = normalizePayload(entry.entity, rawPayload);
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
            const rawPayload = entry.payload ? (JSON.parse(entry.payload) as Record<string, unknown>) : {};
            const payload = normalizePayload(entry.entity, rawPayload);
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
            const op = await resolveInboxOp(entry);
            const payload = await resolveInboxPushPayload(entry);
            if (op === 'skip') {
                await inboxRepo.clearDirty(entry.resource_uid);
                return;
            }
            if (op === 'create') {
                const content = typeof payload.content === 'string' ? payload.content : '';
                const created = await pushInboxCreate(content);
                await applyServerResult('inbox_items', entry.resource_uid, created);
            } else if (op === 'update') {
                const updated = await pushInboxUpdate(apiKey, payload);
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
    await replayDirtyToOutbox();
    const entries = await pending(max);
    const maxAttempts = 8;
    for (const entry of entries) {
        try {
            await executeEntry(entry);
            await markSuccess(entry.id);
            result.succeeded += 1;
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            const label = `${entry.entity}#${entry.id} (${entry.op})`;
            if (isApiError(err) && !err.isRetryable) {
                await markSuccess(entry.id);
                result.failed += 1;
                result.errors.push(`${label} (dropped): ${msg}`);
            } else {
                const attemptsAfter = entry.attempts + 1;
                await markFailure(entry.id, msg);
                result.failed += 1;
                if (attemptsAfter >= maxAttempts) {
                    await markSuccess(entry.id);
                    result.errors.push(`${label} (dropped after ${attemptsAfter} tries): ${msg}`);
                } else {
                    result.errors.push(`${label}: ${msg}`);
                }
            }
        }
    }
    return result;
}
