import type { Task } from '../types/tududi';

const SERVER_STATUS_BY_INDEX = [
    'not_started',
    'in_progress',
    'done',
    'archived',
    'waiting',
    'cancelled',
    'planned',
] as const;

/** Map Tududi 1.2+ status values to the mobile app's local status enum. */
export function toLocalTaskStatus(status: unknown): Task['status'] {
    if (typeof status === 'number' && status >= 0 && status < SERVER_STATUS_BY_INDEX.length) {
        status = SERVER_STATUS_BY_INDEX[status];
    }
    if (typeof status !== 'string') return 'pending';
    if (status === 'done' || status === 'completed') return 'completed';
    if (status === 'archived') return 'archived';
    return 'pending';
}

const LOCAL_PRIORITY_BY_INDEX = ['low', 'medium', 'high'] as const;

/** Map server/local priority values to Tududi API integers (0=low, 1=medium, 2=high). */
export function toServerTaskPriority(priority: unknown): number | undefined {
    if (priority == null || priority === '') return undefined;
    if (typeof priority === 'number' && priority >= 0 && priority <= 2) return priority;
    if (typeof priority === 'string') {
        const lower = priority.toLowerCase();
        if (lower === 'low' || lower === 'medium' || lower === 'high') {
            return LOCAL_PRIORITY_BY_INDEX.indexOf(lower);
        }
        const parsed = Number.parseInt(priority, 10);
        if (!Number.isNaN(parsed) && parsed >= 0 && parsed <= 2) return parsed;
    }
    return undefined;
}

/** Map server priority integers to local string labels. */
export function toLocalTaskPriority(priority: unknown): Task['priority'] | undefined {
    if (priority == null || priority === '') return undefined;
    if (typeof priority === 'number' && priority >= 0 && priority < LOCAL_PRIORITY_BY_INDEX.length) {
        return LOCAL_PRIORITY_BY_INDEX[priority];
    }
    if (typeof priority === 'string') {
        const lower = priority.toLowerCase();
        if (lower === 'low' || lower === 'medium' || lower === 'high') return lower;
        const parsed = Number.parseInt(priority, 10);
        if (!Number.isNaN(parsed) && parsed >= 0 && parsed < LOCAL_PRIORITY_BY_INDEX.length) {
            return LOCAL_PRIORITY_BY_INDEX[parsed];
        }
    }
    return undefined;
}

/** Tududi stores calendar dates as YYYY-MM-DD (not full ISO datetimes). */
export function toServerDateOnly(value: unknown): string | undefined {
    if (value == null || value === '') return undefined;
    if (typeof value !== 'string') return undefined;
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    const dateOnly = trimmed.match(/^(\d{4}-\d{2}-\d{2})/);
    if (dateOnly) return dateOnly[1];
    const parsed = new Date(trimmed);
    if (Number.isNaN(parsed.getTime())) return undefined;
    return parsed.toISOString().slice(0, 10);
}

/** Map local status values to Tududi 1.2+ API status strings. */
export function toServerTaskStatus(status: unknown): string {
    if (typeof status === 'number' && status >= 0 && status < SERVER_STATUS_BY_INDEX.length) {
        return SERVER_STATUS_BY_INDEX[status] ?? 'not_started';
    }
    if (status === 'completed') return 'done';
    if (status === 'pending') return 'not_started';
    if (typeof status === 'string') return status;
    return 'not_started';
}

/** Normalize a task row from the server before storing locally. */
export function normalizeTaskFromServer(task: Task): Task {
    const raw = task as Task & {
        recurrence_type?: string | null;
        recurrence_interval?: number | null;
        recurrence_end_date?: string | null;
        recurrence_weekday?: number | null;
        recurrence_week_of_month?: number | null;
        completion_based?: boolean;
    };

    const priority = toLocalTaskPriority(task.priority);

    return {
        ...task,
        status: toLocalTaskStatus(task.status),
        ...(priority ? { priority } : {}),
        recurring_pattern:
            raw.recurring_pattern ??
            (raw.recurrence_type && raw.recurrence_type !== 'none'
                ? (raw.recurrence_type as Task['recurring_pattern'])
                : null),
        recurring_interval: raw.recurring_interval ?? raw.recurrence_interval ?? null,
        recurring_end_date: raw.recurring_end_date ?? raw.recurrence_end_date ?? null,
        recurring_weekday: raw.recurring_weekday ?? raw.recurrence_weekday ?? null,
        recurring_week_of_month:
            raw.recurring_week_of_month ?? raw.recurrence_week_of_month ?? null,
        recurrence_completion_based:
            raw.recurrence_completion_based ?? raw.completion_based ?? false,
    };
}

/** Build a server-ready task body from a local task row. */
export function taskToServerPayload(task: Task): Record<string, unknown> {
    return toServerTaskPayload({
        name: task.name,
        note: task.note ?? undefined,
        status: task.status ?? 'pending',
        priority: task.priority ?? undefined,
        due_date: task.due_date ?? undefined,
        project_id: task.project_id ?? undefined,
        parent_task_id: task.parent_task_id ?? undefined,
        recurring_pattern: task.recurring_pattern ?? undefined,
        recurring_interval: task.recurring_interval ?? undefined,
        recurring_end_date: task.recurring_end_date ?? undefined,
        recurring_weekday: task.recurring_weekday ?? undefined,
        recurring_week_of_month: task.recurring_week_of_month ?? undefined,
        recurrence_completion_based: task.recurrence_completion_based ?? undefined,
    });
}

/**
 * Map a local task payload to Tududi 1.2+ API field names and status values.
 * Omits nulls and fields the server should own (e.g. completed_at).
 */
export function toServerTaskPayload(payload: Record<string, unknown>): Record<string, unknown> {
    const out: Record<string, unknown> = { ...payload };

    if ('status' in out) {
        out.status = toServerTaskStatus(out.status);
    }

    if ('due_date' in out) {
        const dueDate = toServerDateOnly(out.due_date);
        if (dueDate) out.due_date = dueDate;
        else delete out.due_date;
    }

    if ('priority' in out) {
        const priority = toServerTaskPriority(out.priority);
        if (priority !== undefined) out.priority = priority;
        else delete out.priority;
    }

    // Tududi derives completed_at from status changes.
    delete out.completed_at;
    delete out.uid;
    delete out.id;
    delete out.created_at;
    delete out.updated_at;
    delete out.tags;
    delete out.subtasks;

    const pattern = out.recurring_pattern;
    if ('recurring_pattern' in out) {
        delete out.recurring_pattern;
        const hasRecurrence =
            pattern != null && pattern !== '' && pattern !== 'none';
        if (hasRecurrence) {
            out.recurrence_type = pattern;
        }
    }

    if ('recurring_interval' in out) {
        const v = out.recurring_interval;
        delete out.recurring_interval;
        if (v != null && out.recurrence_type) {
            out.recurrence_interval = v;
        }
    }
    if ('recurring_end_date' in out) {
        const v = out.recurring_end_date;
        delete out.recurring_end_date;
        if (v != null && out.recurrence_type) {
            const endDate = toServerDateOnly(v);
            if (endDate) out.recurrence_end_date = endDate;
        }
    }
    if ('recurring_weekday' in out) {
        const v = out.recurring_weekday;
        delete out.recurring_weekday;
        if (v != null && out.recurrence_type) {
            out.recurrence_weekday = v;
        }
    }
    if ('recurring_week_of_month' in out) {
        const v = out.recurring_week_of_month;
        delete out.recurring_week_of_month;
        if (v != null && out.recurrence_type) {
            out.recurrence_week_of_month = v;
        }
    }
    if ('recurrence_completion_based' in out) {
        const v = out.recurrence_completion_based;
        delete out.recurrence_completion_based;
        if (out.recurrence_type) {
            out.completion_based = !!v;
        }
    }

    for (const key of Object.keys(out)) {
        if (out[key] === null || out[key] === undefined) {
            delete out[key];
        }
    }

    if (typeof out.name === 'string') {
        out.name = out.name.trim();
    }

    return out;
}
