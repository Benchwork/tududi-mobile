import type { SQLiteDatabase } from 'expo-sqlite';
import { withDb } from './database';

/** Tables that use `uid` as PRIMARY KEY and `id` as the server-assigned id. */
export type UidEntityTable = 'tasks' | 'projects' | 'areas' | 'notes' | 'inbox_items';

interface RowRef {
    rowid: number;
    uid: string;
    _dirty: number;
}

/**
 * When a locally-created row still uses a client uid but the server row was already
 * pulled under the canonical uid, merging via a plain `UPDATE uid = ?` hits UNIQUE.
 * This helper deletes the stale duplicate and keeps the authoritative row.
 */
export async function reconcileLocalToServerUid(
    table: UidEntityTable,
    localUid: string,
    serverUid: string,
    serverId: number
): Promise<void> {
    return withDb(async (db) => {
        await reconcileLocalToServerUidInDb(db, table, localUid, serverUid, serverId);
    });
}

export async function reconcileLocalToServerUidInDb(
    db: SQLiteDatabase,
    table: UidEntityTable,
    localUid: string,
    serverUid: string,
    serverId: number
): Promise<void> {
    const localRow = await db.getFirstAsync<RowRef>(
        `SELECT rowid, uid, _dirty FROM ${table} WHERE uid = ?`,
        [localUid]
    );
    const serverRow = await db.getFirstAsync<RowRef>(
        `SELECT rowid, uid, _dirty FROM ${table} WHERE uid = ?`,
        [serverUid]
    );

    if (!localRow) {
        if (serverRow) {
            await db.runAsync(
                `UPDATE ${table} SET id = ?, _dirty = 0, _pending_op = NULL WHERE uid = ?`,
                [serverId, serverUid]
            );
        }
        return;
    }

    if (serverRow && serverRow.rowid !== localRow.rowid) {
        if (localRow._dirty === 1) {
            await db.runAsync(`DELETE FROM ${table} WHERE rowid = ?`, [serverRow.rowid]);
            await db.runAsync(
                `UPDATE ${table} SET uid = ?, id = ?, _dirty = 0, _pending_op = NULL WHERE rowid = ?`,
                [serverUid, serverId, localRow.rowid]
            );
        } else {
            await db.runAsync(`DELETE FROM ${table} WHERE rowid = ?`, [localRow.rowid]);
            await db.runAsync(
                `UPDATE ${table} SET id = ?, _dirty = 0, _pending_op = NULL WHERE uid = ?`,
                [serverId, serverUid]
            );
        }
        return;
    }

    await db.runAsync(
        `UPDATE ${table} SET uid = ?, id = ?, _dirty = 0, _pending_op = NULL WHERE uid = ?`,
        [serverUid, serverId, localUid]
    );
}

/**
 * Before assigning `serverUid` to a row matched by server `id`, drop a stale row that
 * already holds that uid (common when pull ran before push reconciled the client uid).
 */
export async function dropConflictingUidRowInDb(
    db: SQLiteDatabase,
    table: UidEntityTable,
    serverUid: string,
    keepRowid: number
): Promise<void> {
    const conflict = await db.getFirstAsync<RowRef>(
        `SELECT rowid, uid, _dirty FROM ${table} WHERE uid = ?`,
        [serverUid]
    );
    if (!conflict || conflict.rowid === keepRowid) {
        return;
    }
    await db.runAsync(`DELETE FROM ${table} WHERE rowid = ?`, [conflict.rowid]);
}

/** Remove duplicate rows that share the same server `id`. */
export async function deduplicateByServerIdInDb(
    db: SQLiteDatabase,
    table: UidEntityTable
): Promise<void> {
    const groups = await db.getAllAsync<{ id: number }>(
        `SELECT id FROM ${table}
         WHERE _deleted = 0 AND id IS NOT NULL AND id > 0
         GROUP BY id
         HAVING COUNT(*) > 1`
    );
    for (const { id } of groups) {
        const rows = await db.getAllAsync<{ rowid: number; _dirty: number; uid: string }>(
            `SELECT rowid, _dirty, uid FROM ${table}
             WHERE id = ? AND _deleted = 0
             ORDER BY _dirty DESC, rowid ASC`,
            [id]
        );
        if (rows.length < 2) continue;
        const keeper = rows[0];
        if (!keeper) continue;
        for (const dup of rows.slice(1)) {
            await db.runAsync(`DELETE FROM ${table} WHERE rowid = ?`, [dup.rowid]);
        }
        await dropConflictingUidRowInDb(db, table, keeper.uid, keeper.rowid);
    }
}

/** Remove duplicate rows that share the same server `id`. */
export async function deduplicateByServerIdForTable(
    table: UidEntityTable
): Promise<void> {
    return withDb(async (db) => {
        await deduplicateByServerIdInDb(db, table);
    });
}
