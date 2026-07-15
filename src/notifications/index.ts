import { configureNotificationHandler } from './handlers';
import { ensureAndroidChannel } from './permissions';
import { rescheduleTaskNotifications } from './scheduler';

let runtimeReady = false;

export async function initNotificationRuntime(): Promise<void> {
    if (runtimeReady) return;
    runtimeReady = true;
    configureNotificationHandler();
    await ensureAndroidChannel();
}

export async function rescheduleTaskNotificationsIfEnabled(): Promise<void> {
    await rescheduleTaskNotifications();
}

export {
    cancelAllTaskNotifications,
    queueRescheduleTaskNotifications,
    rescheduleTaskNotifications,
} from './scheduler';
export {
    getNotificationPermissionStatus,
    requestNotificationPermissions,
} from './permissions';
export { useNotificationNavigation } from './handlers';
