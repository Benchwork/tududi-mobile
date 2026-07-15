/** Local calendar date as YYYY-MM-DD. */
export function localTodayDate(): string {
    return formatDateOnly(new Date());
}

export function formatDateOnly(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

/** Extract YYYY-MM-DD from a due date string (date-only or ISO datetime). */
export function dueDay(value: string | null | undefined): string | null {
    if (!value) return null;
    const match = value.match(/^(\d{4}-\d{2}-\d{2})/);
    return match?.[1] ?? null;
}

export function isDueBeforeToday(dueDate: string | null | undefined): boolean {
    const due = dueDay(dueDate);
    if (!due) return false;
    return due < localTodayDate();
}

export function isDueToday(dueDate: string | null | undefined): boolean {
    const due = dueDay(dueDate);
    if (!due) return false;
    return due === localTodayDate();
}
