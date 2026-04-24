import { runDb, withDb } from '../db/database';

export type SyncEntity = 'tasks' | 'projects' | 'areas' | 'notes' | 'inbox_items';
export type SyncOp = 'create' | 'update' | 'delete';

export interface OutboxEntry {
    id: number;
    entity: SyncEntity;
    op: SyncOp;
    resource_uid: string;
    resource_id: number | null;
    payload: string | null;
    created_at: number;
    attempts: number;
    last_error: string | null;
    next_attempt_at: number;
}

export async function enqueue(
    entity: SyncEntity,
    op: SyncOp,
    resourceUid: string,
    payload: unknown,
    resourceId?: number | null
): Promise<void> {
    return runDb((db) =>
        db.runAsync(
            `INSERT INTO outbox (entity, op, resource_uid, resource_id, payload, created_at, attempts, next_attempt_at)
             VALUES (?, ?, ?, ?, ?, ?, 0, 0)`,
            [
                entity,
                op,
                resourceUid,
                resourceId ?? null,
                payload ? JSON.stringify(payload) : null,
                Date.now(),
            ]
        )
    );
}

export async function pending(limit = 50): Promise<OutboxEntry[]> {
    return withDb((db) =>
        db.getAllAsync<OutboxEntry>(
            `SELECT * FROM outbox WHERE next_attempt_at <= ? ORDER BY created_at ASC LIMIT ?`,
            [Date.now(), limit]
        )
    );
}

export async function markSuccess(id: number): Promise<void> {
    return runDb((db) => db.runAsync('DELETE FROM outbox WHERE id = ?', [id]));
}

export async function markFailure(id: number, error: string): Promise<void> {
    return withDb(async (db) => {
        const row = await db.getFirstAsync<{ attempts: number }>(
            'SELECT attempts FROM outbox WHERE id = ?',
            [id]
        );
        const attempts = (row?.attempts ?? 0) + 1;
        const backoffMs = Math.min(2 ** attempts * 1000, 5 * 60_000);
        const next = Date.now() + backoffMs;
        await db.runAsync(
            'UPDATE outbox SET attempts = ?, last_error = ?, next_attempt_at = ? WHERE id = ?',
            [attempts, error.slice(0, 500), next, id]
        );
    });
}

export async function countPending(): Promise<number> {
    return withDb(async (db) => {
        const row = await db.getFirstAsync<{ c: number }>(
            'SELECT COUNT(*) as c FROM outbox'
        );
        return row?.c ?? 0;
    });
}

export async function entryByResource(
    entity: SyncEntity,
    resourceUid: string
): Promise<OutboxEntry | null> {
    return withDb((db) =>
        db.getFirstAsync<OutboxEntry>(
            'SELECT * FROM outbox WHERE entity = ? AND resource_uid = ? ORDER BY created_at DESC LIMIT 1',
            [entity, resourceUid]
        )
    );
}
