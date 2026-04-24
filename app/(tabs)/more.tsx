import React from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen } from '@/components/Screen';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { OfflineBanner } from '@/components/OfflineBanner';
import { useAreas, useCreateArea } from '@/features/areas/queries';
import { useTags } from '@/features/tags/queries';
import { useSessionStore } from '@/stores/session';
import { useSyncStore } from '@/sync/scheduler';
import { useUiStore, type ThemePreference } from '@/stores/ui';
import { useTheme } from '@/theme/theme';

export default function MoreScreen() {
    const router = useRouter();
    const { palette } = useTheme();
    const session = useSessionStore((s) => s.session);
    const signOut = useSessionStore((s) => s.signOut);
    const sync = useSyncStore();
    const theme = useUiStore((s) => s.theme);
    const setPref = useUiStore((s) => s.set);

    const { data: areas = [] } = useAreas();
    const { data: tags = [] } = useTags();
    const createArea = useCreateArea();

    const onLogout = () => {
        Alert.alert('Sign out?', 'You can sign back in on this device at any time.', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Sign out',
                style: 'destructive',
                onPress: async () => {
                    await signOut();
                    // AuthGate will route back to /(auth)/login with the
                    // remembered server URL; local data stays intact.
                },
            },
        ]);
    };

    const onNewArea = () => {
        Alert.prompt?.('New area', 'Name', async (name?: string) => {
            if (name?.trim()) await createArea.mutateAsync({ name: name.trim() });
        });
    };

    const themeOptions: Array<{ id: ThemePreference; label: string }> = [
        { id: 'system', label: 'System' },
        { id: 'light', label: 'Light' },
        { id: 'dark', label: 'Dark' },
    ];

    return (
        <Screen padded={false}>
            <OfflineBanner />
            <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
                <View>
                    <Text style={[styles.title, { color: palette.text }]}>More</Text>
                    <Text style={{ color: palette.textMuted, fontSize: 13 }}>
                        {session?.userEmail || session?.userName || 'Signed in'} ·{' '}
                        {session?.serverUrl}
                    </Text>
                </View>

                <Pressable onPress={() => router.push('/search')}>
                    <Card>
                        <Text style={[styles.section, { color: palette.text }]}>Search</Text>
                        <Text style={{ color: palette.textMuted, fontSize: 13, marginTop: 4 }}>
                            Search across tasks, projects, notes and areas.
                        </Text>
                    </Card>
                </Pressable>

                <Card>
                    <View style={styles.rowBetween}>
                        <Text style={[styles.section, { color: palette.text }]}>Sync</Text>
                        <Pressable onPress={() => sync.run()} hitSlop={8}>
                            <Text style={{ color: palette.primary, fontWeight: '600' }}>
                                {sync.running ? 'Syncing…' : 'Sync now'}
                            </Text>
                        </Pressable>
                    </View>
                    <Text style={{ color: palette.textMuted, fontSize: 13, marginTop: 6 }}>
                        {sync.online ? 'Online' : 'Offline'} · {sync.pendingOps} pending
                    </Text>
                    {sync.error ? (
                        <Text style={{ color: palette.danger, fontSize: 12, marginTop: 4 }}>
                            {sync.error}
                        </Text>
                    ) : null}
                    {sync.lastRunAt ? (
                        <Text style={{ color: palette.textFaint, fontSize: 12, marginTop: 4 }}>
                            Last sync: {new Date(sync.lastRunAt).toLocaleTimeString()}
                        </Text>
                    ) : null}
                </Card>

                <Card>
                    <View style={styles.rowBetween}>
                        <Text style={[styles.section, { color: palette.text }]}>
                            Areas ({areas.length})
                        </Text>
                        <Pressable onPress={onNewArea} hitSlop={8}>
                            <Text style={{ color: palette.primary, fontWeight: '600' }}>+ New</Text>
                        </Pressable>
                    </View>
                    {areas.length === 0 ? (
                        <Text style={{ color: palette.textMuted, fontSize: 13, marginTop: 8 }}>
                            Group related projects into areas.
                        </Text>
                    ) : (
                        areas.map((a) => (
                            <Pressable
                                key={a.uid ?? a.id}
                                onPress={() =>
                                    router.push({
                                        pathname: '/area/[id]',
                                        params: { id: String(a.id || a.uid) },
                                    })
                                }
                                style={{ paddingVertical: 8 }}
                            >
                                <Text style={{ color: palette.text, fontSize: 15, fontWeight: '500' }}>
                                    {a.name}
                                </Text>
                                {a.description ? (
                                    <Text
                                        style={{ color: palette.textMuted, fontSize: 12 }}
                                        numberOfLines={1}
                                    >
                                        {a.description}
                                    </Text>
                                ) : null}
                            </Pressable>
                        ))
                    )}
                </Card>

                <Card>
                    <Text style={[styles.section, { color: palette.text }]}>
                        Tags ({tags.length})
                    </Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                        {tags.map((t) => (
                            <View
                                key={t.uid ?? t.id}
                                style={[
                                    styles.tag,
                                    { backgroundColor: palette.bgMuted, borderColor: palette.border },
                                ]}
                            >
                                <Text style={{ color: palette.text, fontSize: 12 }}>{t.name}</Text>
                            </View>
                        ))}
                        {tags.length === 0 ? (
                            <Text style={{ color: palette.textMuted, fontSize: 13 }}>
                                Tags will appear after your first sync.
                            </Text>
                        ) : null}
                    </View>
                </Card>

                <Card>
                    <Text style={[styles.section, { color: palette.text }]}>Appearance</Text>
                    <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                        {themeOptions.map((opt) => {
                            const active = theme === opt.id;
                            return (
                                <Pressable
                                    key={opt.id}
                                    onPress={() => setPref({ theme: opt.id })}
                                    style={[
                                        styles.tag,
                                        {
                                            backgroundColor: active ? palette.primary : palette.bgMuted,
                                            borderColor: active ? palette.primary : palette.border,
                                        },
                                    ]}
                                >
                                    <Text
                                        style={{
                                            color: active ? palette.primaryText : palette.text,
                                            fontSize: 12,
                                            fontWeight: '600',
                                        }}
                                    >
                                        {opt.label}
                                    </Text>
                                </Pressable>
                            );
                        })}
                    </View>
                </Card>

                <Button title="Sign out" variant="danger" onPress={onLogout} full />
            </ScrollView>
        </Screen>
    );
}

const styles = StyleSheet.create({
    title: { fontSize: 28, fontWeight: '700' },
    section: { fontSize: 15, fontWeight: '700' },
    rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    tag: { paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderRadius: 999 },
});
