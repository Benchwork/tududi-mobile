/**
 * SQLite schema for the offline cache + outbox.
 *
 * Conventions for every entity table:
 *   - id: server-assigned id (nullable before first sync of a locally-created row)
 *   - uid: stable identifier (server-provided, else a client-generated one)
 *   - _dirty: 1 if there are local changes not yet pushed
 *   - _deleted: 1 if locally tombstoned (push a DELETE, then purge)
 *   - _local_updated_at: unix ms of last local modification
 *   - _pending_op: 'create' | 'update' | 'delete' | null
 */

export const SCHEMA_VERSION = 1;

export const DDL_STATEMENTS: string[] = [
    `CREATE TABLE IF NOT EXISTS meta (
        key TEXT PRIMARY KEY,
        value TEXT
    )`,

    `CREATE TABLE IF NOT EXISTS tasks (
        id INTEGER,
        uid TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        note TEXT,
        status TEXT,
        priority TEXT,
        due_date TEXT,
        project_id INTEGER,
        parent_task_id INTEGER,
        recurring_pattern TEXT,
        recurring_interval INTEGER,
        recurring_end_date TEXT,
        recurring_weekday INTEGER,
        recurring_week_of_month INTEGER,
        recurrence_completion_based INTEGER,
        completed_at TEXT,
        created_at TEXT,
        updated_at TEXT,
        _dirty INTEGER NOT NULL DEFAULT 0,
        _deleted INTEGER NOT NULL DEFAULT 0,
        _local_updated_at INTEGER NOT NULL DEFAULT 0,
        _pending_op TEXT
    )`,
    `CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status)`,
    `CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date)`,
    `CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id)`,
    `CREATE INDEX IF NOT EXISTS idx_tasks_parent ON tasks(parent_task_id)`,
    `CREATE INDEX IF NOT EXISTS idx_tasks_id ON tasks(id)`,

    `CREATE TABLE IF NOT EXISTS projects (
        id INTEGER,
        uid TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        status TEXT,
        priority TEXT,
        area_id INTEGER,
        active INTEGER,
        pin_to_sidebar INTEGER,
        created_at TEXT,
        updated_at TEXT,
        _dirty INTEGER NOT NULL DEFAULT 0,
        _deleted INTEGER NOT NULL DEFAULT 0,
        _local_updated_at INTEGER NOT NULL DEFAULT 0,
        _pending_op TEXT
    )`,
    `CREATE INDEX IF NOT EXISTS idx_projects_area ON projects(area_id)`,
    `CREATE INDEX IF NOT EXISTS idx_projects_id ON projects(id)`,

    `CREATE TABLE IF NOT EXISTS areas (
        id INTEGER,
        uid TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        created_at TEXT,
        updated_at TEXT,
        _dirty INTEGER NOT NULL DEFAULT 0,
        _deleted INTEGER NOT NULL DEFAULT 0,
        _local_updated_at INTEGER NOT NULL DEFAULT 0,
        _pending_op TEXT
    )`,
    `CREATE INDEX IF NOT EXISTS idx_areas_id ON areas(id)`,

    `CREATE TABLE IF NOT EXISTS notes (
        id INTEGER,
        uid TEXT PRIMARY KEY,
        title TEXT,
        content TEXT,
        color TEXT,
        project_id INTEGER,
        created_at TEXT,
        updated_at TEXT,
        _dirty INTEGER NOT NULL DEFAULT 0,
        _deleted INTEGER NOT NULL DEFAULT 0,
        _local_updated_at INTEGER NOT NULL DEFAULT 0,
        _pending_op TEXT
    )`,
    `CREATE INDEX IF NOT EXISTS idx_notes_project ON notes(project_id)`,
    `CREATE INDEX IF NOT EXISTS idx_notes_id ON notes(id)`,

    `CREATE TABLE IF NOT EXISTS tags (
        id INTEGER,
        uid TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        created_at TEXT,
        updated_at TEXT,
        _dirty INTEGER NOT NULL DEFAULT 0,
        _deleted INTEGER NOT NULL DEFAULT 0,
        _local_updated_at INTEGER NOT NULL DEFAULT 0,
        _pending_op TEXT
    )`,
    `CREATE INDEX IF NOT EXISTS idx_tags_id ON tags(id)`,

    `CREATE TABLE IF NOT EXISTS inbox_items (
        id INTEGER,
        uid TEXT PRIMARY KEY,
        content TEXT NOT NULL,
        status TEXT,
        source TEXT,
        created_at TEXT,
        updated_at TEXT,
        _dirty INTEGER NOT NULL DEFAULT 0,
        _deleted INTEGER NOT NULL DEFAULT 0,
        _local_updated_at INTEGER NOT NULL DEFAULT 0,
        _pending_op TEXT
    )`,
    `CREATE INDEX IF NOT EXISTS idx_inbox_id ON inbox_items(id)`,

    `CREATE TABLE IF NOT EXISTS task_tags (
        task_uid TEXT NOT NULL,
        tag_uid TEXT NOT NULL,
        PRIMARY KEY (task_uid, tag_uid)
    )`,
    `CREATE TABLE IF NOT EXISTS note_tags (
        note_uid TEXT NOT NULL,
        tag_uid TEXT NOT NULL,
        PRIMARY KEY (note_uid, tag_uid)
    )`,
    `CREATE TABLE IF NOT EXISTS project_tags (
        project_uid TEXT NOT NULL,
        tag_uid TEXT NOT NULL,
        PRIMARY KEY (project_uid, tag_uid)
    )`,

    `CREATE TABLE IF NOT EXISTS outbox (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        entity TEXT NOT NULL,
        op TEXT NOT NULL,
        resource_uid TEXT NOT NULL,
        resource_id INTEGER,
        payload TEXT,
        created_at INTEGER NOT NULL,
        attempts INTEGER NOT NULL DEFAULT 0,
        last_error TEXT,
        next_attempt_at INTEGER NOT NULL DEFAULT 0
    )`,
    `CREATE INDEX IF NOT EXISTS idx_outbox_entity ON outbox(entity, created_at)`,
    `CREATE INDEX IF NOT EXISTS idx_outbox_next_attempt ON outbox(next_attempt_at)`,
];
