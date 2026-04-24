import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSyncStore } from '../sync/scheduler';
import { useTheme } from '../theme/theme';

export function OfflineBanner() {
    const online = useSyncStore((s) => s.online);
    const pending = useSyncStore((s) => s.pendingOps);
    const { palette } = useTheme();

    if (online && pending === 0) return null;

    const text = !online
        ? pending > 0
            ? `Offline · ${pending} change${pending === 1 ? '' : 's'} queued`
            : 'Offline · changes will sync when back online'
        : `Syncing ${pending} pending change${pending === 1 ? '' : 's'}…`;

    return (
        <View
            style={[
                styles.banner,
                {
                    backgroundColor: !online ? palette.warning : palette.accent,
                },
            ]}
        >
            <Text style={styles.text}>{text}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    banner: {
        paddingVertical: 6,
        paddingHorizontal: 12,
        alignItems: 'center',
    },
    text: { color: '#fff', fontSize: 12, fontWeight: '600' },
});
