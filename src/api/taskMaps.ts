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

/** Map local status values to Tududi 1.2+ API status strings. */
export function toServerTaskStatus(status: unknown): string {
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

    return {
        ...task,
        status: toLocalTaskStatus(task.status),
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

/** Map a local task payload to Tududi 1.2+ API field names and status values. */
export function toServerTaskPayload(payload: Record<string, unknown>): Record<string, unknown> {
    const out: Record<string, unknown> = { ...payload };

    if ('status' in out) {
        out.status = toServerTaskStatus(out.status);
    }
    if ('recurring_pattern' in out) {
        out.recurrence_type = out.recurring_pattern ?? 'none';
        delete out.recurring_pattern;
    }
    if ('recurring_interval' in out) {
        out.recurrence_interval = out.recurring_interval;
        delete out.recurring_interval;
    }
    if ('recurring_end_date' in out) {
        out.recurrence_end_date = out.recurring_end_date;
        delete out.recurring_end_date;
    }
    if ('recurring_weekday' in out) {
        out.recurrence_weekday = out.recurring_weekday;
        delete out.recurring_weekday;
    }
    if ('recurring_week_of_month' in out) {
        out.recurrence_week_of_month = out.recurring_week_of_month;
        delete out.recurring_week_of_month;
    }
    if ('recurrence_completion_based' in out) {
        out.completion_based = out.recurrence_completion_based;
        delete out.recurrence_completion_based;
    }

    return out;
}
