import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { ANDROID_CHANNEL_ID } from './types';

export async function getNotificationPermissionStatus(): Promise<boolean> {
    const settings = await Notifications.getPermissionsAsync();
    return (
        settings.granted ||
        settings.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL
    );
}

export async function requestNotificationPermissions(): Promise<boolean> {
    const current = await Notifications.getPermissionsAsync();
    if (
        current.granted ||
        current.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL
    ) {
        return true;
    }

    const requested = await Notifications.requestPermissionsAsync({
        ios: {
            allowAlert: true,
            allowBadge: true,
            allowSound: true,
        },
    });

    return (
        requested.granted ||
        requested.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL
    );
}

export async function ensureAndroidChannel(): Promise<void> {
    if (Platform.OS !== 'android') return;

    await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
        name: 'Task reminders',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#0f172a',
    });
}
