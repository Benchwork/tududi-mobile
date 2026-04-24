import * as SQLite from 'expo-sqlite';
import { DDL_STATEMENTS, SCHEMA_VERSION } from './schema';

const DB_NAME = 'tududi.db';

let dbInstance: SQLite.SQLiteDatabase | null = null;
let readyPromise: Promise<SQLite.SQLiteDatabase> | null = null;

async function openDatabase(): Promise<SQLite.SQLiteDatabase> {
    const db = await SQLite.openDatabaseAsync(DB_NAME);
    await db.execAsync('PRAGMA journal_mode = WAL;');
    await db.execAsync('PRAGMA foreign_keys = ON;');

    for (const ddl of DDL_STATEMENTS) {
        await db.execAsync(ddl);
    }

    const version = await db.getFirstAsync<{ value: string }>(
        'SELECT value FROM meta WHERE key = ?',
        ['schema_version']
    );
    const current = version ? parseInt(version.value, 10) : 0;
    if (current !== SCHEMA_VERSION) {
        await db.runAsync(
            'INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)',
            ['schema_version', String(SCHEMA_VERSION)]
        );
    }
    return db;
}

export async function ensureDatabaseReady(): Promise<SQLite.SQLiteDatabase> {
    if (dbInstance) return dbInstance;
    if (!readyPromise) {
        readyPromise = openDatabase().then((db) => {
            dbInstance = db;
            return db;
        });
    }
    return readyPromise;
}

export function getDb(): SQLite.SQLiteDatabase {
    if (!dbInstance) {
        throw new Error('Database not ready. Call ensureDatabaseReady() first.');
    }
    return dbInstance;
}

export async function withDb<T>(
    fn: (db: SQLite.SQLiteDatabase) => Promise<T>
): Promise<T> {
    const db = await ensureDatabaseReady();
    return fn(db);
}

/** Run a DB function and discard the result (useful for runAsync calls). */
export async function runDb(
    fn: (db: SQLite.SQLiteDatabase) => Promise<unknown>
): Promise<void> {
    const db = await ensureDatabaseReady();
    await fn(db);
}

export async function wipeDatabase(): Promise<void> {
    const db = await ensureDatabaseReady();
    const tables = [
        'tasks',
        'projects',
        'areas',
        'notes',
        'tags',
        'inbox_items',
        'task_tags',
        'note_tags',
        'project_tags',
        'outbox',
        'meta',
    ];
    for (const table of tables) {
        await db.execAsync(`DELETE FROM ${table}`);
    }
}
