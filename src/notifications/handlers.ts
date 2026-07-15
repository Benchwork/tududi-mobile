import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';

let handlerConfigured = false;

export function configureNotificationHandler(): void {
    if (handlerConfigured) return;
    handlerConfigured = true;

    Notifications.setNotificationHandler({
        handleNotification: async () => ({
            shouldShowAlert: true,
            shouldPlaySound: true,
            shouldSetBadge: true,
        }),
    });
}

function openTaskFromResponse(
    router: ReturnType<typeof useRouter>,
    response: Notifications.NotificationResponse
): void {
    const taskUid = response.notification.request.content.data?.taskUid;
    if (typeof taskUid === 'string' && taskUid.length > 0) {
        router.push({ pathname: '/task/[uid]', params: { uid: taskUid } });
    }
}

export function useNotificationNavigation(): void {
    const router = useRouter();

    useEffect(() => {
        const sub = Notifications.addNotificationResponseReceivedListener((response) => {
            openTaskFromResponse(router, response);
        });

        void Notifications.getLastNotificationResponseAsync().then((last) => {
            if (last) openTaskFromResponse(router, last);
        });

        return () => sub.remove();
    }, [router]);
}
