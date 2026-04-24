import type { SQLiteDatabase } from 'expo-sqlite';
import { runDb, withDb } from './database';
import { newClientUid } from './uid';
import type {
    Area,
    InboxItem,
    Note,
    Project,
    Tag,
    Task,
    TaskFilter,
    TaskSort,
} from '../types/tududi';

function now(): number {
    return Date.now();
}

function boolToInt(v: boolean | null | undefined): number | null {
    if (v === null || v === undefined) return null;
    return v ? 1 : 0;
}

function intToBool(v: number | null | undefined): boolean | undefined {
    if (v === null || v === undefined) return undefined;
    return !!v;
}

function todayBounds(): { start: string; end: string } {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    return { start: start.toISOString(), end: end.toISOString() };
}

interface TaskRow {
    id: number | null;
    uid: string;
    name: string;
    note: string | null;
    status: Task['status'] | null;
    priority: Task['priority'] | null;
    due_date: string | null;
    project_id: number | null;
    parent_task_id: number | null;
    recurring_pattern: Task['recurring_pattern'] | null;
    recurring_interval: number | null;
    recurring_end_date: string | null;
    recurring_weekday: number | null;
    recurring_week_of_month: number | null;
    recurrence_completion_based: number | null;
    completed_at: string | null;
    created_at: string | null;
    updated_at: string | null;
    _dirty: number;
    _deleted: number;
    _local_updated_at: number;
    _pending_op: string | null;
}

function rowToTask(row: TaskRow): Task {
    return {
        id: row.id ?? 0,
        uid: row.uid,
        name: row.name,
        note: row.note ?? undefined,
        status: row.status ?? undefined,
        priority: row.priority ?? undefined,
        due_date: row.due_date ?? undefined,
        project_id: row.project_id ?? undefined,
        parent_task_id: row.parent_task_id ?? undefined,
        recurring_pattern: row.recurring_pattern ?? undefined,
        recurring_interval: row.recurring_interval ?? undefined,
        recurring_end_date: row.recurring_end_date ?? undefined,
        recurring_weekday: row.recurring_weekday ?? undefined,
        recurring_week_of_month: row.recurring_week_of_month ?? undefined,
        recurrence_completion_based: intToBool(row.recurrence_completion_based),
        completed_at: row.completed_at ?? undefined,
        created_at: row.created_at ?? undefined,
        updated_at: row.updated_at ?? undefined,
    };
}

export interface TaskQuery {
    filter?: TaskFilter;
    projectId?: number;
    parentTaskId?: number | null;
    search?: string;
    sort?: TaskSort;
    dir?: 'asc' | 'desc';
}

export const tasksRepo = {
    async list(q: TaskQuery = {}): Promise<Task[]> {
        return withDb(async (db) => {
            const where: string[] = ['_deleted = 0'];
            const args: Array<string | number | null> = [];
            const sort = q.sort ?? 'due_date';
            const dir = (q.dir ?? 'asc').toUpperCase();

            switch (q.filter) {
                case 'today': {
                    const { start, end } = todayBounds();
                    where.push(
                        `(status IS NULL OR status != 'completed') AND (due_date IS NOT NULL AND due_date >= ? AND due_date <= ?)`
                    );
                    args.push(start, end);
                    break;
                }
                case 'upcoming': {
                    const { end } = todayBounds();
                    where.push(
                        `(status IS NULL OR status != 'completed') AND (due_date IS NOT NULL AND due_date > ?)`
                    );
                    args.push(end);
                    break;
                }
                case 'someday':
                    where.push(
                        `(status IS NULL OR status != 'completed') AND due_date IS NULL`
                    );
                    break;
                case 'completed':
                    where.push(`status = 'completed'`);
                    break;
                case 'all':
                default:
                    break;
            }

            if (q.projectId !== undefined) {
                where.push('project_id = ?');
                args.push(q.projectId);
            }
            if (q.parentTaskId !== undefined) {
                if (q.parentTaskId === null) {
                    where.push('parent_task_id IS NULL');
                } else {
                    where.push('parent_task_id = ?');
                    args.push(q.parentTaskId);
                }
            }
            if (q.search) {
                where.push('(name LIKE ? OR note LIKE ?)');
                args.push(`%${q.search}%`, `%${q.search}%`);
            }

            const orderCol =
                sort === 'name'
                    ? 'name COLLATE NOCASE'
                    : sort === 'priority'
                      ? `CASE priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 WHEN 'low' THEN 2 ELSE 3 END`
                      : sort === 'created_at'
                        ? 'created_at'
                        : 'due_date';
            const nullsLast =
                sort === 'due_date'
                    ? `CASE WHEN due_date IS NULL THEN 1 ELSE 0 END, `
                    : '';

            const sql = `SELECT * FROM tasks WHERE ${where.join(' AND ')} ORDER BY ${nullsLast}${orderCol} ${dir}`;
            const rows = await db.getAllAsync<TaskRow>(sql, args);
            return rows.map(rowToTask);
        });
    },

    async getByUid(uid: string): Promise<Task | null> {
        return withDb(async (db) => {
            const row = await db.getFirstAsync<TaskRow>(
                'SELECT * FROM tasks WHERE uid = ? LIMIT 1',
                [uid]
            );
            return row ? rowToTask(row) : null;
        });
    },

    async upsertServer(task: Task): Promise<void> {
        return withDb(async (db) => {
            const uid = task.uid ?? `srv_${task.id}`;
            await db.runAsync(
                `INSERT INTO tasks (
                    id, uid, name, note, status, priority, due_date, project_id,
                    parent_task_id, recurring_pattern, recurring_interval,
                    recurring_end_date, recurring_weekday, recurring_week_of_month,
                    recurrence_completion_based, completed_at, created_at, updated_at,
                    _dirty, _deleted, _local_updated_at, _pending_op
                ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,0,0,0,NULL)
                ON CONFLICT(uid) DO UPDATE SET
                    id = excluded.id,
                    name = excluded.name,
                    note = excluded.note,
                    status = excluded.status,
                    priority = excluded.priority,
                    due_date = excluded.due_date,
                    project_id = excluded.project_id,
                    parent_task_id = excluded.parent_task_id,
                    recurring_pattern = excluded.recurring_pattern,
                    recurring_interval = excluded.recurring_interval,
                    recurring_end_date = excluded.recurring_end_date,
                    recurring_weekday = excluded.recurring_weekday,
                    recurring_week_of_month = excluded.recurring_week_of_month,
                    recurrence_completion_based = excluded.recurrence_completion_based,
                    completed_at = excluded.completed_at,
                    created_at = excluded.created_at,
                    updated_at = excluded.updated_at
                WHERE _dirty = 0`,
                [
                    task.id ?? null,
                    uid,
                    task.name,
                    task.note ?? null,
                    task.status ?? null,
                    task.priority ?? null,
                    task.due_date ?? null,
                    task.project_id ?? null,
                    task.parent_task_id ?? null,
                    task.recurring_pattern ?? null,
                    task.recurring_interval ?? null,
                    task.recurring_end_date ?? null,
                    task.recurring_weekday ?? null,
                    task.recurring_week_of_month ?? null,
                    boolToInt(task.recurrence_completion_based ?? null),
                    task.completed_at ?? null,
                    task.created_at ?? null,
                    task.updated_at ?? null,
                ]
            );
        });
    },

    async insertLocal(input: Partial<Task>): Promise<Task> {
        return withDb(async (db) => {
            const uid = input.uid ?? newClientUid('task');
            const nowIso = new Date().toISOString();
            const t: Task = {
                id: 0,
                uid,
                name: input.name ?? '',
                note: input.note ?? null,
                status: input.status ?? 'pending',
                priority: input.priority ?? null,
                due_date: input.due_date ?? null,
                project_id: input.project_id ?? null,
                parent_task_id: input.parent_task_id ?? null,
                recurring_pattern: input.recurring_pattern ?? null,
                recurring_interval: input.recurring_interval ?? null,
                recurring_end_date: input.recurring_end_date ?? null,
                recurring_weekday: input.recurring_weekday ?? null,
                recurring_week_of_month: input.recurring_week_of_month ?? null,
                recurrence_completion_based: input.recurrence_completion_based ?? false,
                completed_at: input.completed_at ?? null,
                created_at: nowIso,
                updated_at: nowIso,
            };
            await db.runAsync(
                `INSERT INTO tasks (
                    id, uid, name, note, status, priority, due_date, project_id,
                    parent_task_id, recurring_pattern, recurring_interval,
                    recurring_end_date, recurring_weekday, recurring_week_of_month,
                    recurrence_completion_based, completed_at, created_at, updated_at,
                    _dirty, _deleted, _local_updated_at, _pending_op
                ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1,0,?, 'create')`,
                [
                    null,
                    uid,
                    t.name,
                    t.note ?? null,
                    t.status ?? null,
                    t.priority ?? null,
                    t.due_date ?? null,
                    t.project_id ?? null,
                    t.parent_task_id ?? null,
                    t.recurring_pattern ?? null,
                    t.recurring_interval ?? null,
                    t.recurring_end_date ?? null,
                    t.recurring_weekday ?? null,
                    t.recurring_week_of_month ?? null,
                    boolToInt(t.recurrence_completion_based ?? null),
                    t.completed_at ?? null,
                    t.created_at ?? null,
                    t.updated_at ?? null,
                    now(),
                ]
            );
            return t;
        });
    },

    async patchLocal(uid: string, patch: Partial<Task>): Promise<void> {
        return withDb(async (db) => {
            const existing = await db.getFirstAsync<TaskRow>(
                'SELECT * FROM tasks WHERE uid = ?',
                [uid]
            );
            if (!existing) return;
            const nowIso = new Date().toISOString();
            const nextOp = existing._pending_op === 'create' ? 'create' : 'update';
            const values = {
                name: patch.name ?? existing.name,
                note: patch.note ?? existing.note,
                status: patch.status ?? existing.status,
                priority: patch.priority ?? existing.priority,
                due_date: patch.due_date ?? existing.due_date,
                project_id: patch.project_id ?? existing.project_id,
                parent_task_id: patch.parent_task_id ?? existing.parent_task_id,
                recurring_pattern: patch.recurring_pattern ?? existing.recurring_pattern,
                recurring_interval: patch.recurring_interval ?? existing.recurring_interval,
                recurring_end_date:
                    patch.recurring_end_date ?? existing.recurring_end_date,
                recurring_weekday: patch.recurring_weekday ?? existing.recurring_weekday,
                recurring_week_of_month:
                    patch.recurring_week_of_month ?? existing.recurring_week_of_month,
                recurrence_completion_based:
                    patch.recurrence_completion_based !== undefined
                        ? boolToInt(patch.recurrence_completion_based)
                        : existing.recurrence_completion_based,
                completed_at: patch.completed_at ?? existing.completed_at,
            };
            await db.runAsync(
                `UPDATE tasks SET
                    name = ?, note = ?, status = ?, priority = ?, due_date = ?,
                    project_id = ?, parent_task_id = ?, recurring_pattern = ?,
                    recurring_interval = ?, recurring_end_date = ?, recurring_weekday = ?,
                    recurring_week_of_month = ?, recurrence_completion_based = ?,
                    completed_at = ?, updated_at = ?, _dirty = 1,
                    _local_updated_at = ?, _pending_op = ?
                WHERE uid = ?`,
                [
                    values.name,
                    values.note ?? null,
                    values.status ?? null,
                    values.priority ?? null,
                    values.due_date ?? null,
                    values.project_id ?? null,
                    values.parent_task_id ?? null,
                    values.recurring_pattern ?? null,
                    values.recurring_interval ?? null,
                    values.recurring_end_date ?? null,
                    values.recurring_weekday ?? null,
                    values.recurring_week_of_month ?? null,
                    values.recurrence_completion_based ?? null,
                    values.completed_at ?? null,
                    nowIso,
                    now(),
                    nextOp,
                    uid,
                ]
            );
        });
    },

    async markDeleted(uid: string): Promise<'purged' | 'tombstoned'> {
        return withDb(async (db) => {
            const row = await db.getFirstAsync<TaskRow>(
                'SELECT _pending_op FROM tasks WHERE uid = ?',
                [uid]
            );
            if (!row) return 'purged';
            if (row._pending_op === 'create') {
                await db.runAsync('DELETE FROM tasks WHERE uid = ?', [uid]);
                return 'purged';
            }
            await db.runAsync(
                'UPDATE tasks SET _deleted = 1, _dirty = 1, _pending_op = ?, _local_updated_at = ? WHERE uid = ?',
                ['delete', now(), uid]
            );
            return 'tombstoned';
        });
    },

    async purge(uid: string): Promise<void> {
        return runDb((db) => db.runAsync('DELETE FROM tasks WHERE uid = ?', [uid]));
    },

    async replaceUid(oldUid: string, serverUid: string, serverId: number): Promise<void> {
        return runDb((db) =>
            db.runAsync(
                'UPDATE tasks SET uid = ?, id = ?, _dirty = 0, _pending_op = NULL WHERE uid = ?',
                [serverUid, serverId, oldUid]
            )
        );
    },

    async clearDirty(uid: string, serverId?: number): Promise<void> {
        return runDb((db) =>
            db.runAsync(
                'UPDATE tasks SET _dirty = 0, _pending_op = NULL, id = COALESCE(?, id) WHERE uid = ?',
                [serverId ?? null, uid]
            )
        );
    },
};

interface ProjectRow {
    id: number | null;
    uid: string;
    name: string;
    description: string | null;
    status: string | null;
    priority: string | null;
    area_id: number | null;
    active: number | null;
    pin_to_sidebar: number | null;
    created_at: string | null;
    updated_at: string | null;
    _dirty: number;
    _deleted: number;
    _local_updated_at: number;
    _pending_op: string | null;
}

function rowToProject(row: ProjectRow): Project {
    return {
        id: row.id ?? 0,
        uid: row.uid,
        name: row.name,
        description: row.description ?? undefined,
        status: (row.status as Project['status']) ?? undefined,
        priority: (row.priority as Project['priority']) ?? undefined,
        area_id: row.area_id ?? undefined,
        active: intToBool(row.active),
        pin_to_sidebar: intToBool(row.pin_to_sidebar),
        created_at: row.created_at ?? undefined,
        updated_at: row.updated_at ?? undefined,
    };
}

export const projectsRepo = {
    async list(): Promise<Project[]> {
        return withDb(async (db) => {
            const rows = await db.getAllAsync<ProjectRow>(
                'SELECT * FROM projects WHERE _deleted = 0 ORDER BY name COLLATE NOCASE ASC'
            );
            return rows.map(rowToProject);
        });
    },
    async byArea(areaId: number | null): Promise<Project[]> {
        return withDb(async (db) => {
            const rows =
                areaId === null
                    ? await db.getAllAsync<ProjectRow>(
                          'SELECT * FROM projects WHERE _deleted = 0 AND area_id IS NULL ORDER BY name COLLATE NOCASE ASC'
                      )
                    : await db.getAllAsync<ProjectRow>(
                          'SELECT * FROM projects WHERE _deleted = 0 AND area_id = ? ORDER BY name COLLATE NOCASE ASC',
                          [areaId]
                      );
            return rows.map(rowToProject);
        });
    },
    async getByUid(uid: string): Promise<Project | null> {
        return withDb(async (db) => {
            const row = await db.getFirstAsync<ProjectRow>(
                'SELECT * FROM projects WHERE uid = ?',
                [uid]
            );
            return row ? rowToProject(row) : null;
        });
    },
    async getById(id: number): Promise<Project | null> {
        return withDb(async (db) => {
            const row = await db.getFirstAsync<ProjectRow>(
                'SELECT * FROM projects WHERE id = ?',
                [id]
            );
            return row ? rowToProject(row) : null;
        });
    },
    async upsertServer(p: Project): Promise<void> {
        return withDb(async (db) => {
            const uid = p.uid ?? `srv_${p.id}`;
            await db.runAsync(
                `INSERT INTO projects (
                    id, uid, name, description, status, priority, area_id, active,
                    pin_to_sidebar, created_at, updated_at, _dirty, _deleted,
                    _local_updated_at, _pending_op
                ) VALUES (?,?,?,?,?,?,?,?,?,?,?,0,0,0,NULL)
                ON CONFLICT(uid) DO UPDATE SET
                    id = excluded.id, name = excluded.name, description = excluded.description,
                    status = excluded.status, priority = excluded.priority,
                    area_id = excluded.area_id, active = excluded.active,
                    pin_to_sidebar = excluded.pin_to_sidebar,
                    created_at = excluded.created_at, updated_at = excluded.updated_at
                WHERE _dirty = 0`,
                [
                    p.id ?? null,
                    uid,
                    p.name,
                    p.description ?? null,
                    p.status ?? null,
                    p.priority ?? null,
                    p.area_id ?? null,
                    boolToInt(p.active ?? null),
                    boolToInt(p.pin_to_sidebar ?? null),
                    p.created_at ?? null,
                    p.updated_at ?? null,
                ]
            );
        });
    },
    async insertLocal(input: Partial<Project>): Promise<Project> {
        return withDb(async (db) => {
            const uid = input.uid ?? newClientUid('project');
            const nowIso = new Date().toISOString();
            const p: Project = {
                id: 0,
                uid,
                name: input.name ?? '',
                description: input.description ?? null,
                status: input.status ?? 'not_started',
                priority: input.priority ?? null,
                area_id: input.area_id ?? null,
                active: input.active ?? true,
                pin_to_sidebar: input.pin_to_sidebar ?? false,
                created_at: nowIso,
                updated_at: nowIso,
            };
            await db.runAsync(
                `INSERT INTO projects (
                    id, uid, name, description, status, priority, area_id, active,
                    pin_to_sidebar, created_at, updated_at, _dirty, _deleted,
                    _local_updated_at, _pending_op
                ) VALUES (NULL,?,?,?,?,?,?,?,?,?,?,1,0,?,'create')`,
                [
                    uid,
                    p.name,
                    p.description ?? null,
                    p.status ?? null,
                    p.priority ?? null,
                    p.area_id ?? null,
                    boolToInt(p.active ?? null),
                    boolToInt(p.pin_to_sidebar ?? null),
                    p.created_at ?? null,
                    p.updated_at ?? null,
                    now(),
                ]
            );
            return p;
        });
    },
    async patchLocal(uid: string, patch: Partial<Project>): Promise<void> {
        return withDb(async (db) => {
            const existing = await db.getFirstAsync<ProjectRow>(
                'SELECT * FROM projects WHERE uid = ?',
                [uid]
            );
            if (!existing) return;
            const nextOp = existing._pending_op === 'create' ? 'create' : 'update';
            const nowIso = new Date().toISOString();
            await db.runAsync(
                `UPDATE projects SET
                    name = ?, description = ?, status = ?, priority = ?, area_id = ?,
                    active = ?, pin_to_sidebar = ?, updated_at = ?, _dirty = 1,
                    _local_updated_at = ?, _pending_op = ?
                WHERE uid = ?`,
                [
                    patch.name ?? existing.name,
                    patch.description ?? existing.description,
                    patch.status ?? existing.status,
                    patch.priority ?? existing.priority,
                    patch.area_id ?? existing.area_id,
                    patch.active !== undefined ? boolToInt(patch.active) : existing.active,
                    patch.pin_to_sidebar !== undefined
                        ? boolToInt(patch.pin_to_sidebar)
                        : existing.pin_to_sidebar,
                    nowIso,
                    now(),
                    nextOp,
                    uid,
                ]
            );
        });
    },
    async markDeleted(uid: string): Promise<'purged' | 'tombstoned'> {
        return withDb(async (db) => {
            const row = await db.getFirstAsync<ProjectRow>(
                'SELECT _pending_op FROM projects WHERE uid = ?',
                [uid]
            );
            if (!row) return 'purged';
            if (row._pending_op === 'create') {
                await db.runAsync('DELETE FROM projects WHERE uid = ?', [uid]);
                return 'purged';
            }
            await db.runAsync(
                'UPDATE projects SET _deleted = 1, _dirty = 1, _pending_op = ?, _local_updated_at = ? WHERE uid = ?',
                ['delete', now(), uid]
            );
            return 'tombstoned';
        });
    },
    async purge(uid: string): Promise<void> {
        return runDb((db) => db.runAsync('DELETE FROM projects WHERE uid = ?', [uid]));
    },
    async clearDirty(uid: string, serverId?: number): Promise<void> {
        return runDb((db) =>
            db.runAsync(
                'UPDATE projects SET _dirty = 0, _pending_op = NULL, id = COALESCE(?, id) WHERE uid = ?',
                [serverId ?? null, uid]
            )
        );
    },
};

interface AreaRow {
    id: number | null;
    uid: string;
    name: string;
    description: string | null;
    created_at: string | null;
    updated_at: string | null;
    _dirty: number;
    _deleted: number;
    _local_updated_at: number;
    _pending_op: string | null;
}

export const areasRepo = {
    async list(): Promise<Area[]> {
        return withDb(async (db) => {
            const rows = await db.getAllAsync<AreaRow>(
                'SELECT * FROM areas WHERE _deleted = 0 ORDER BY name COLLATE NOCASE ASC'
            );
            return rows.map((r) => ({
                id: r.id ?? 0,
                uid: r.uid,
                name: r.name,
                description: r.description ?? undefined,
                created_at: r.created_at ?? undefined,
                updated_at: r.updated_at ?? undefined,
            }));
        });
    },
    async getById(id: number): Promise<Area | null> {
        return withDb(async (db) => {
            const r = await db.getFirstAsync<AreaRow>(
                'SELECT * FROM areas WHERE id = ?',
                [id]
            );
            if (!r) return null;
            return {
                id: r.id ?? 0,
                uid: r.uid,
                name: r.name,
                description: r.description ?? undefined,
                created_at: r.created_at ?? undefined,
                updated_at: r.updated_at ?? undefined,
            };
        });
    },
    async upsertServer(a: Area): Promise<void> {
        return withDb(async (db) => {
            const uid = a.uid ?? `srv_${a.id}`;
            await db.runAsync(
                `INSERT INTO areas (id, uid, name, description, created_at, updated_at, _dirty, _deleted, _local_updated_at, _pending_op)
                 VALUES (?,?,?,?,?,?,0,0,0,NULL)
                 ON CONFLICT(uid) DO UPDATE SET
                    id = excluded.id, name = excluded.name, description = excluded.description,
                    created_at = excluded.created_at, updated_at = excluded.updated_at
                 WHERE _dirty = 0`,
                [
                    a.id ?? null,
                    uid,
                    a.name,
                    a.description ?? null,
                    a.created_at ?? null,
                    a.updated_at ?? null,
                ]
            );
        });
    },
    async insertLocal(input: Partial<Area>): Promise<Area> {
        return withDb(async (db) => {
            const uid = input.uid ?? newClientUid('area');
            const nowIso = new Date().toISOString();
            await db.runAsync(
                `INSERT INTO areas (id, uid, name, description, created_at, updated_at, _dirty, _deleted, _local_updated_at, _pending_op)
                 VALUES (NULL,?,?,?,?,?,1,0,?,'create')`,
                [uid, input.name ?? '', input.description ?? null, nowIso, nowIso, now()]
            );
            return {
                id: 0,
                uid,
                name: input.name ?? '',
                description: input.description ?? undefined,
                created_at: nowIso,
                updated_at: nowIso,
            };
        });
    },
    async patchLocal(uid: string, patch: Partial<Area>): Promise<void> {
        return withDb(async (db) => {
            const existing = await db.getFirstAsync<AreaRow>(
                'SELECT * FROM areas WHERE uid = ?',
                [uid]
            );
            if (!existing) return;
            const nextOp = existing._pending_op === 'create' ? 'create' : 'update';
            await db.runAsync(
                `UPDATE areas SET name = ?, description = ?, updated_at = ?, _dirty = 1, _local_updated_at = ?, _pending_op = ? WHERE uid = ?`,
                [
                    patch.name ?? existing.name,
                    patch.description ?? existing.description,
                    new Date().toISOString(),
                    now(),
                    nextOp,
                    uid,
                ]
            );
        });
    },
    async markDeleted(uid: string): Promise<'purged' | 'tombstoned'> {
        return withDb(async (db) => {
            const row = await db.getFirstAsync<AreaRow>(
                'SELECT _pending_op FROM areas WHERE uid = ?',
                [uid]
            );
            if (!row) return 'purged';
            if (row._pending_op === 'create') {
                await db.runAsync('DELETE FROM areas WHERE uid = ?', [uid]);
                return 'purged';
            }
            await db.runAsync(
                'UPDATE areas SET _deleted = 1, _dirty = 1, _pending_op = ?, _local_updated_at = ? WHERE uid = ?',
                ['delete', now(), uid]
            );
            return 'tombstoned';
        });
    },
    async clearDirty(uid: string, serverId?: number): Promise<void> {
        return runDb((db) =>
            db.runAsync(
                'UPDATE areas SET _dirty = 0, _pending_op = NULL, id = COALESCE(?, id) WHERE uid = ?',
                [serverId ?? null, uid]
            )
        );
    },
    async purge(uid: string): Promise<void> {
        return runDb((db) => db.runAsync('DELETE FROM areas WHERE uid = ?', [uid]));
    },
};

interface NoteRow {
    id: number | null;
    uid: string;
    title: string | null;
    content: string | null;
    color: string | null;
    project_id: number | null;
    created_at: string | null;
    updated_at: string | null;
    _dirty: number;
    _deleted: number;
    _local_updated_at: number;
    _pending_op: string | null;
}

export const notesRepo = {
    async list(): Promise<Note[]> {
        return withDb(async (db) => {
            const rows = await db.getAllAsync<NoteRow>(
                'SELECT * FROM notes WHERE _deleted = 0 ORDER BY updated_at DESC'
            );
            return rows.map(
                (r): Note => ({
                    id: r.id ?? 0,
                    uid: r.uid,
                    title: r.title ?? undefined,
                    content: r.content ?? undefined,
                    color: r.color ?? undefined,
                    project_id: r.project_id ?? undefined,
                    created_at: r.created_at ?? undefined,
                    updated_at: r.updated_at ?? undefined,
                })
            );
        });
    },
    async byProject(projectId: number): Promise<Note[]> {
        return withDb(async (db) => {
            const rows = await db.getAllAsync<NoteRow>(
                'SELECT * FROM notes WHERE _deleted = 0 AND project_id = ? ORDER BY updated_at DESC',
                [projectId]
            );
            return rows.map(
                (r): Note => ({
                    id: r.id ?? 0,
                    uid: r.uid,
                    title: r.title ?? undefined,
                    content: r.content ?? undefined,
                    color: r.color ?? undefined,
                    project_id: r.project_id ?? undefined,
                })
            );
        });
    },
    async getById(id: number): Promise<Note | null> {
        return withDb(async (db) => {
            const r = await db.getFirstAsync<NoteRow>(
                'SELECT * FROM notes WHERE id = ?',
                [id]
            );
            if (!r) return null;
            return {
                id: r.id ?? 0,
                uid: r.uid,
                title: r.title ?? undefined,
                content: r.content ?? undefined,
                color: r.color ?? undefined,
                project_id: r.project_id ?? undefined,
                created_at: r.created_at ?? undefined,
                updated_at: r.updated_at ?? undefined,
            };
        });
    },
    async upsertServer(n: Note): Promise<void> {
        return withDb(async (db) => {
            const uid = n.uid ?? `srv_${n.id}`;
            await db.runAsync(
                `INSERT INTO notes (id, uid, title, content, color, project_id, created_at, updated_at, _dirty, _deleted, _local_updated_at, _pending_op)
                 VALUES (?,?,?,?,?,?,?,?,0,0,0,NULL)
                 ON CONFLICT(uid) DO UPDATE SET
                    id = excluded.id, title = excluded.title, content = excluded.content,
                    color = excluded.color, project_id = excluded.project_id,
                    created_at = excluded.created_at, updated_at = excluded.updated_at
                 WHERE _dirty = 0`,
                [
                    n.id ?? null,
                    uid,
                    n.title ?? null,
                    n.content ?? null,
                    n.color ?? null,
                    n.project_id ?? null,
                    n.created_at ?? null,
                    n.updated_at ?? null,
                ]
            );
        });
    },
    async insertLocal(input: Partial<Note>): Promise<Note> {
        return withDb(async (db) => {
            const uid = input.uid ?? newClientUid('note');
            const nowIso = new Date().toISOString();
            await db.runAsync(
                `INSERT INTO notes (id, uid, title, content, color, project_id, created_at, updated_at, _dirty, _deleted, _local_updated_at, _pending_op)
                 VALUES (NULL,?,?,?,?,?,?,?,1,0,?,'create')`,
                [
                    uid,
                    input.title ?? null,
                    input.content ?? null,
                    input.color ?? null,
                    input.project_id ?? null,
                    nowIso,
                    nowIso,
                    now(),
                ]
            );
            return {
                id: 0,
                uid,
                title: input.title,
                content: input.content,
                color: input.color,
                project_id: input.project_id,
                created_at: nowIso,
                updated_at: nowIso,
            };
        });
    },
    async patchLocal(uid: string, patch: Partial<Note>): Promise<void> {
        return withDb(async (db) => {
            const existing = await db.getFirstAsync<NoteRow>(
                'SELECT * FROM notes WHERE uid = ?',
                [uid]
            );
            if (!existing) return;
            const nextOp = existing._pending_op === 'create' ? 'create' : 'update';
            await db.runAsync(
                `UPDATE notes SET title = ?, content = ?, color = ?, project_id = ?, updated_at = ?, _dirty = 1, _local_updated_at = ?, _pending_op = ? WHERE uid = ?`,
                [
                    patch.title ?? existing.title,
                    patch.content ?? existing.content,
                    patch.color ?? existing.color,
                    patch.project_id ?? existing.project_id,
                    new Date().toISOString(),
                    now(),
                    nextOp,
                    uid,
                ]
            );
        });
    },
    async markDeleted(uid: string): Promise<'purged' | 'tombstoned'> {
        return withDb(async (db) => {
            const row = await db.getFirstAsync<NoteRow>(
                'SELECT _pending_op FROM notes WHERE uid = ?',
                [uid]
            );
            if (!row) return 'purged';
            if (row._pending_op === 'create') {
                await db.runAsync('DELETE FROM notes WHERE uid = ?', [uid]);
                return 'purged';
            }
            await db.runAsync(
                'UPDATE notes SET _deleted = 1, _dirty = 1, _pending_op = ?, _local_updated_at = ? WHERE uid = ?',
                ['delete', now(), uid]
            );
            return 'tombstoned';
        });
    },
    async clearDirty(uid: string, serverId?: number): Promise<void> {
        return runDb((db) =>
            db.runAsync(
                'UPDATE notes SET _dirty = 0, _pending_op = NULL, id = COALESCE(?, id) WHERE uid = ?',
                [serverId ?? null, uid]
            )
        );
    },
    async purge(uid: string): Promise<void> {
        return runDb((db) => db.runAsync('DELETE FROM notes WHERE uid = ?', [uid]));
    },
};

interface TagRow {
    id: number | null;
    uid: string;
    name: string;
    created_at: string | null;
    updated_at: string | null;
    _dirty: number;
    _deleted: number;
    _local_updated_at: number;
    _pending_op: string | null;
}

export const tagsRepo = {
    async list(): Promise<Tag[]> {
        return withDb(async (db) => {
            const rows = await db.getAllAsync<TagRow>(
                'SELECT * FROM tags WHERE _deleted = 0 ORDER BY name COLLATE NOCASE ASC'
            );
            return rows.map(
                (r): Tag => ({
                    id: r.id ?? 0,
                    uid: r.uid,
                    name: r.name,
                })
            );
        });
    },
    async upsertServer(t: Tag): Promise<void> {
        return withDb(async (db) => {
            const uid = t.uid ?? `srv_${t.id}`;
            await db.runAsync(
                `INSERT INTO tags (id, uid, name, created_at, updated_at, _dirty, _deleted, _local_updated_at, _pending_op)
                 VALUES (?,?,?,?,?,0,0,0,NULL)
                 ON CONFLICT(uid) DO UPDATE SET id = excluded.id, name = excluded.name WHERE _dirty = 0`,
                [t.id ?? null, uid, t.name, t.created_at ?? null, t.updated_at ?? null]
            );
        });
    },
};

interface InboxRow {
    id: number | null;
    uid: string;
    content: string;
    status: string | null;
    source: string | null;
    created_at: string | null;
    updated_at: string | null;
    _dirty: number;
    _deleted: number;
    _local_updated_at: number;
    _pending_op: string | null;
}

export const inboxRepo = {
    async list(): Promise<InboxItem[]> {
        return withDb(async (db) => {
            const rows = await db.getAllAsync<InboxRow>(
                `SELECT * FROM inbox_items WHERE _deleted = 0 AND (status IS NULL OR status != 'processed') ORDER BY created_at DESC`
            );
            return rows.map(
                (r): InboxItem => ({
                    id: r.id ?? 0,
                    uid: r.uid,
                    content: r.content,
                    status: (r.status as InboxItem['status']) ?? undefined,
                    source: r.source ?? undefined,
                    created_at: r.created_at ?? undefined,
                    updated_at: r.updated_at ?? undefined,
                })
            );
        });
    },
    async upsertServer(i: InboxItem): Promise<void> {
        return withDb(async (db) => {
            const uid = i.uid ?? `srv_${i.id}`;
            await db.runAsync(
                `INSERT INTO inbox_items (id, uid, content, status, source, created_at, updated_at, _dirty, _deleted, _local_updated_at, _pending_op)
                 VALUES (?,?,?,?,?,?,?,0,0,0,NULL)
                 ON CONFLICT(uid) DO UPDATE SET
                    id = excluded.id, content = excluded.content, status = excluded.status,
                    source = excluded.source, created_at = excluded.created_at, updated_at = excluded.updated_at
                 WHERE _dirty = 0`,
                [
                    i.id ?? null,
                    uid,
                    i.content,
                    i.status ?? null,
                    i.source ?? null,
                    i.created_at ?? null,
                    i.updated_at ?? null,
                ]
            );
        });
    },
    async insertLocal(content: string): Promise<InboxItem> {
        return withDb(async (db) => {
            const uid = newClientUid('inbox');
            const nowIso = new Date().toISOString();
            await db.runAsync(
                `INSERT INTO inbox_items (id, uid, content, status, source, created_at, updated_at, _dirty, _deleted, _local_updated_at, _pending_op)
                 VALUES (NULL, ?, ?, 'added', 'mobile', ?, ?, 1, 0, ?, 'create')`,
                [uid, content, nowIso, nowIso, now()]
            );
            return {
                id: 0,
                uid,
                content,
                status: 'added',
                source: 'mobile',
                created_at: nowIso,
                updated_at: nowIso,
            };
        });
    },
    async markProcessed(uid: string): Promise<void> {
        return runDb((db) =>
            db.runAsync(
                `UPDATE inbox_items SET status = 'processed', _dirty = 1, _local_updated_at = ?, _pending_op = 'update' WHERE uid = ?`,
                [now(), uid]
            )
        );
    },
    async markDeleted(uid: string): Promise<'purged' | 'tombstoned'> {
        return withDb(async (db) => {
            const row = await db.getFirstAsync<InboxRow>(
                'SELECT _pending_op FROM inbox_items WHERE uid = ?',
                [uid]
            );
            if (!row) return 'purged';
            if (row._pending_op === 'create') {
                await db.runAsync('DELETE FROM inbox_items WHERE uid = ?', [uid]);
                return 'purged';
            }
            await db.runAsync(
                `UPDATE inbox_items SET _deleted = 1, _dirty = 1, _pending_op = 'delete', _local_updated_at = ? WHERE uid = ?`,
                [now(), uid]
            );
            return 'tombstoned';
        });
    },
    async clearDirty(uid: string, serverId?: number): Promise<void> {
        return runDb((db) =>
            db.runAsync(
                'UPDATE inbox_items SET _dirty = 0, _pending_op = NULL, id = COALESCE(?, id) WHERE uid = ?',
                [serverId ?? null, uid]
            )
        );
    },
    async purge(uid: string): Promise<void> {
        return runDb((db) => db.runAsync('DELETE FROM inbox_items WHERE uid = ?', [uid]));
    },
};

export const metaRepo = {
    async get(key: string): Promise<string | null> {
        return withDb(async (db) => {
            const row = await db.getFirstAsync<{ value: string }>(
                'SELECT value FROM meta WHERE key = ?',
                [key]
            );
            return row?.value ?? null;
        });
    },
    async set(key: string, value: string): Promise<void> {
        return runDb((db) =>
            db.runAsync('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)', [key, value])
        );
    },
};

export async function collectDirty(
    db: SQLiteDatabase,
    entity: 'tasks' | 'projects' | 'areas' | 'notes' | 'inbox_items'
): Promise<Array<Record<string, unknown>>> {
    return db.getAllAsync(
        `SELECT * FROM ${entity} WHERE _dirty = 1 ORDER BY _local_updated_at ASC`
    );
}
