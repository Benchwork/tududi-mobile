import React, { useMemo, useState } from 'react';
import {
    FlatList,
    Keyboard,
    Pressable,
    RefreshControl,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { format } from 'date-fns';
import { Screen } from '@/components/Screen';
import { OfflineBanner } from '@/components/OfflineBanner';
import { EmptyState } from '@/components/EmptyState';
import { Button } from '@/components/Button';
import { TaskRow } from '@/features/tasks/TaskRow';
import { useCreateTask, useTasks, useToggleTask } from '@/features/tasks/queries';
import { useSyncStore } from '@/sync/scheduler';
import { useTheme } from '@/theme/theme';

export default function TodayScreen() {
    const router = useRouter();
    const { palette, radius } = useTheme();
    const today = useTasks({ filter: 'today', sort: 'due_date' });
    const overdue = useTasks({ filter: 'upcoming', sort: 'due_date' });
    const syncing = useSyncStore((s) => s.running);
    const runSync = useSyncStore((s) => s.run);
    const toggle = useToggleTask();
    const create = useCreateTask();
    const [quick, setQuick] = useState('');

    const submitQuick = async () => {
        const name = quick.trim();
        if (!name) return;
        setQuick('');
        Keyboard.dismiss();
        const todayIso = new Date();
        todayIso.setHours(23, 59, 0, 0);
        await create.mutateAsync({
            name,
            due_date: todayIso.toISOString(),
            status: 'pending',
        });
    };

    const sections = useMemo(() => {
        const todayItems = today.data ?? [];
        const overdueItems = (overdue.data ?? []).filter((t) => {
            if (!t.due_date) return false;
            return new Date(t.due_date).getTime() < Date.now();
        });
        return { todayItems, overdueItems };
    }, [today.data, overdue.data]);

    const allEmpty = sections.todayItems.length === 0 && sections.overdueItems.length === 0;

    return (
        <Screen padded={false}>
            <OfflineBanner />
            <View style={styles.header}>
                <Text style={[styles.date, { color: palette.textMuted }]}>
                    {format(new Date(), 'EEEE, d MMMM')}
                </Text>
                <Text style={[styles.title, { color: palette.text }]}>Today</Text>
            </View>
            <View style={styles.quickCaptureWrap}>
                <View
                    style={[
                        styles.quickCapture,
                        {
                            backgroundColor: palette.bgElevated,
                            borderColor: palette.border,
                            borderRadius: radius.md,
                        },
                    ]}
                >
                    <TextInput
                        value={quick}
                        onChangeText={setQuick}
                        onSubmitEditing={submitQuick}
                        placeholder="Add a task for today…"
                        placeholderTextColor={palette.textFaint}
                        returnKeyType="done"
                        blurOnSubmit={false}
                        style={[styles.quickInput, { color: palette.text }]}
                    />
                    <Pressable
                        onPress={submitQuick}
                        disabled={!quick.trim() || create.isPending}
                        hitSlop={8}
                        style={({ pressed }) => [
                            styles.quickBtn,
                            {
                                backgroundColor: quick.trim() ? palette.primary : palette.bgMuted,
                                opacity: pressed ? 0.8 : 1,
                            },
                        ]}
                    >
                        <Text style={styles.quickBtnText}>Add</Text>
                    </Pressable>
                </View>
            </View>
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
                ListHeaderComponent={
                    sections.overdueItems.length > 0 ? (
                        <Text style={[styles.sectionLabel, { color: palette.danger }]}>
                            Overdue ({sections.overdueItems.length})
                        </Text>
                    ) : null
                }
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
    quickCaptureWrap: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8 },
    quickCapture: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        paddingLeft: 12,
        paddingRight: 4,
    },
    quickInput: {
        flex: 1,
        fontSize: 15,
        paddingVertical: 10,
    },
    quickBtn: {
        marginLeft: 8,
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 8,
    },
    quickBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
});
