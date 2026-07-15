import React, { useMemo } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { format } from 'date-fns';
import { Screen } from '@/components/Screen';
import { Badge } from '@/components/Badge';
import { Card } from '@/components/Card';
import { OfflineBanner } from '@/components/OfflineBanner';
import { EmptyState } from '@/components/EmptyState';
import { Button } from '@/components/Button';
import { InboxQuickCaptureBar } from '@/features/inbox/InboxQuickCaptureBar';
import { useInbox } from '@/features/inbox/queries';
import { TaskRow } from '@/features/tasks/TaskRow';
import { useTasks, useToggleTask } from '@/features/tasks/queries';
import { useSyncStore } from '@/sync/scheduler';
import { useTheme } from '@/theme/theme';

export default function TodayScreen() {
    const router = useRouter();
    const { palette } = useTheme();
    const today = useTasks({ filter: 'today', sort: 'due_date' });
    const overdue = useTasks({ filter: 'overdue', sort: 'due_date' });
    const { data: inboxItems = [] } = useInbox();
    const syncing = useSyncStore((s) => s.running);
    const runSync = useSyncStore((s) => s.run);
    const toggle = useToggleTask();

    const sections = useMemo(() => {
        return {
            todayItems: today.data ?? [],
            overdueItems: overdue.data ?? [],
        };
    }, [today.data, overdue.data]);

    const allEmpty = sections.todayItems.length === 0 && sections.overdueItems.length === 0;
    const inboxCount = inboxItems.length;

    const listHeader = (
        <View style={{ marginBottom: 8 }}>
            {inboxCount > 0 ? (
                <Pressable
                    onPress={() => router.push('/inbox')}
                    style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1, marginBottom: 8 })}
                >
                    <Card style={{ marginBottom: 0, paddingVertical: 12 }}>
                        <View style={styles.inboxRow}>
                            <Text style={[styles.inboxTitle, { color: palette.text }]}>Inbox</Text>
                            <View style={styles.inboxRight}>
                                <Badge label={String(inboxCount)} variant="soft" />
                                <Text style={[styles.inboxChevron, { color: palette.textFaint }]}>
                                    ›
                                </Text>
                            </View>
                        </View>
                    </Card>
                </Pressable>
            ) : null}
            {sections.overdueItems.length > 0 ? (
                <Text style={[styles.sectionLabel, { color: palette.danger }]}>
                    Overdue ({sections.overdueItems.length})
                </Text>
            ) : null}
        </View>
    );

    return (
        <Screen padded={false}>
            <OfflineBanner />
            <View style={styles.header}>
                <Text style={[styles.date, { color: palette.textMuted }]}>
                    {format(new Date(), 'EEEE, d MMMM')}
                </Text>
                <Text style={[styles.title, { color: palette.text }]}>Today</Text>
            </View>
            <InboxQuickCaptureBar />
            <FlatList
                data={[...sections.overdueItems, ...sections.todayItems]}
                keyExtractor={(t) => t.uid ?? String(t.id)}
                renderItem={({ item }) => (
                    <TaskRow
                        task={item}
                        onPress={() =>
                            router.push({ pathname: '/task/[uid]', params: { uid: item.uid! } })
                        }
                        onToggle={() =>
                            toggle.mutate({
                                uid: item.uid!,
                                completed: item.status !== 'completed',
                            })
                        }
                    />
                )}
                ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
                contentContainerStyle={styles.listContent}
                refreshControl={
                    <RefreshControl
                        refreshing={syncing}
                        onRefresh={() => runSync()}
                        tintColor={palette.primary}
                    />
                }
                ListEmptyComponent={
                    allEmpty ? (
                        <EmptyState
                            title="Nothing due today"
                            message="You're all caught up. Add a task or review upcoming items."
                            action={
                                <Button
                                    title="New task"
                                    onPress={() => router.push('/task/new')}
                                    style={{ marginTop: 12 }}
                                />
                            }
                        />
                    ) : null
                }
                ListHeaderComponent={listHeader}
            />
        </Screen>
    );
}

const styles = StyleSheet.create({
    header: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 },
    date: { fontSize: 13, fontWeight: '500' },
    title: { fontSize: 32, fontWeight: '700' },
    listContent: { padding: 16, paddingBottom: 24 },
    sectionLabel: { fontSize: 12, fontWeight: '700', marginBottom: 8, letterSpacing: 0.5 },
    inboxRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    inboxTitle: { fontSize: 16, fontWeight: '600' },
    inboxRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    inboxChevron: { fontSize: 22, fontWeight: '300', marginTop: -2 },
});
