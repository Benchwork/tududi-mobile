export const TASK_NOTIFICATION_PREFIX = 'tududi-task-';

/** iOS allows 64 pending local notifications; stay safely under that. */
export const MAX_TASK_NOTIFICATIONS = 50;

export const ANDROID_CHANNEL_ID = 'task-reminders';

export function taskNotificationId(taskUid: string): string {
    return `${TASK_NOTIFICATION_PREFIX}${taskUid}`;
}
