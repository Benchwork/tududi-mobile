import { format, parseISO } from 'date-fns';
import * as Notifications from 'expo-notifications';
import { tasksRepo } from '../db/repositories';
import type { Task } from '../types/tududi';
import { dueDay, isDueBeforeToday, isDueToday, localTodayDate } from '../utils/dates';
import { useUiStore } from '../stores/ui';
import { getNotificationPermissionStatus } from './permissions';
import {
    ANDROID_CHANNEL_ID,
    MAX_TASK_NOTIFICATIONS,
    TASK_NOTIFICATION_PREFIX,
    taskNotificationId,
} from './types';

function isRemindable(task: Task): boolean {
    if (!task.due_date || !task.uid) return false;
    if (task.status === 'completed' || task.status === 'archived') return false;
    return true;
}

function reminderAt(
    dueDate: string,
    defaultHour: number,
    defaultMinute: number
): Date | null {
    const day = dueDay(dueDate);
    if (!day) return null;

    const hasTime = /T\d{2}:/.test(dueDate);
    if (hasTime) {
        const parsed = parseISO(dueDate);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
    }

    const [year, month, date] = day.split('-').map((part) => Number.parseInt(part, 10));
    if (!year || !month || !date) return null;
    let reminder = new Date(year, month - 1, date, defaultHour, defaultMinute, 0, 0);

    const today = localTodayDate();
    if (day < today) {
        const [ty, tm, td] = today.split('-').map((part) => Number.parseInt(part, 10));
        if (!ty || !tm || !td) return null;
        reminder = new Date(ty, tm - 1, td, defaultHour, defaultMinute, 0, 0);
    }

    return reminder;
}

function notificationBody(dueDate: string): string {
    if (isDueBeforeToday(dueDate)) return 'This task is overdue';
    if (isDueToday(dueDate)) return 'Due today';
    const day = dueDay(dueDate);
    if (!day) return 'Task reminder';
    try {
        return `Due ${format(parseISO(day), 'EEE d MMM')}`;
    } catch {
        return 'Task reminder';
    }
}

export async function cancelAllTaskNotifications(): Promise<void> {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(
        scheduled
            .filter((entry) => entry.identifier.startsWith(TASK_NOTIFICATION_PREFIX))
            .map((entry) => Notifications.cancelScheduledNotificationAsync(entry.identifier))
    );
}

export async function rescheduleTaskNotifications(): Promise<void> {
    const prefs = useUiStore.getState();
    if (!prefs.notificationsEnabled) {
        await cancelAllTaskNotifications();
        return;
    }

    const permitted = await getNotificationPermissionStatus();
    if (!permitted) return;

    const tasks = await tasksRepo.list({ filter: 'all' });
    const candidates = tasks
        .filter(isRemindable)
        .map((task) => {
            const at = reminderAt(task.due_date!, prefs.reminderHour, prefs.reminderMinute);
            return at ? { task, at } : null;
        })
        .filter((entry): entry is { task: Task; at: Date } => entry !== null)
        .filter((entry) => entry.at.getTime() > Date.now())
        .sort((a, b) => a.at.getTime() - b.at.getTime())
        .slice(0, MAX_TASK_NOTIFICATIONS);

    await cancelAllTaskNotifications();

    await Promise.all(
        candidates.map(({ task, at }) =>
            Notifications.scheduleNotificationAsync({
                identifier: taskNotificationId(task.uid!),
                content: {
                    title: task.name,
                    body: notificationBody(task.due_date!),
                    data: { taskUid: task.uid },
                    sound: true,
                },
                trigger: {
                    type: Notifications.SchedulableTriggerInputTypes.DATE,
                    date: at,
                    channelId: ANDROID_CHANNEL_ID,
                },
            })
        )
    );
}

let rescheduleTimer: ReturnType<typeof setTimeout> | null = null;

export function queueRescheduleTaskNotifications(): void {
    if (rescheduleTimer) clearTimeout(rescheduleTimer);
    rescheduleTimer = setTimeout(() => {
        rescheduleTimer = null;
        void rescheduleTaskNotifications();
    }, 500);
}
