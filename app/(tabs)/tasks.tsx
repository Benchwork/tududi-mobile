import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen } from '@/components/Screen';
import { OfflineBanner } from '@/components/OfflineBanner';
import { EmptyState } from '@/components/EmptyState';
import { FilterPills } from '@/components/FilterPills';
import { TextField } from '@/components/TextField';
import { Button } from '@/components/Button';
import { TaskRow } from '@/features/tasks/TaskRow';
import { useTasks, useToggleTask } from '@/features/tasks/queries';
import { useUiStore } from '@/stores/ui';
import { useSyncStore } from '@/sync/scheduler';
import { useTheme } from '@/theme/theme';
import type { TaskFilter, TaskSort } from '@/types/tududi';

const FILTERS: Array<{ id: TaskFilter; label: string }> = [
    { id: 'today', label: 'Today' },
    { id: 'upcoming', label: 'Upcoming' },
    { id: 'someday', label: 'Someday' },
    { id: 'completed', label: 'Completed' },
    { id: 'all', label: 'All' },
];

const SORTS: Array<{ id: TaskSort; label: string }> = [
    { id: 'due_date', label: 'Due date' },
    { id: 'priority', label: 'Priority' },
    { id: 'name', label: 'Name' },
    { id: 'created_at', label: 'Created' },
];

export default function TasksScreen() {
    const router = useRouter();
    const { palette } = useTheme();
    const filter = useUiStore((s) => s.taskFilter);
    const sort = useUiStore((s) => s.taskSort);
    const dir = useUiStore((s) => s.taskSortDir);
    const setPrefs = useUiStore((s) => s.set);
    const [search, setSearch] = useState('');
    const syncing = useSyncStore((s) => s.running);
    const runSync = useSyncStore((s) => s.run);
    const toggle = useToggleTask();

    const q = useMemo(
        () => ({ filter, sort, dir, search: search.trim() || undefined }),
        [filter, sort, dir, search]
    );
    const { data = [], isLoading } = useTasks(q);

    return (
        <Screen padded={false}>
            <OfflineBanner />
            <View style={styles.header}>
                <Text style={[styles.title, { color: palette.text }]}>Tasks</Text>
            </View>
            <View style={styles.controls}>
                <TextField
                    placeholder="Search tasks..."
                    value={search}
                    onChangeText={setSearch}
                    autoCapitalize="none"
                    autoCorrect={false}
                    returnKeyType="search"
                    style={{ marginBottom: 0 }}
                />
                <FilterPills
                    options={FILTERS}
                    value={filter}
                    onChange={(v) => setPrefs({ taskFilter: v })}
                />
                <View style={styles.sortRow}>
                    <Text style={{ color: palette.textMuted, fontSize: 12 }}>Sort:</Text>
                    {SORTS.map((s) => {
                        const active = sort === s.id;
                        return (
                            <Pressable
                                key={s.id}
                                onPress={() => setPrefs({ taskSort: s.id })}
                                hitSlop={8}
                            >
                                <Text
                                    style={{
                                        color: active ? palette.primary : palette.textMuted,
                                        fontWeight: active ? '700' : '500',
                                        fontSize: 12,
                                    }}
                                >
                                    {s.label}
                                </Text>
                            </Pressable>
                        );
                    })}
                    <Pressable
                        onPress={() =>
                            setPrefs({ taskSortDir: dir === 'asc' ? 'desc' : 'asc' })
                        }
                        hitSlop={8}
                    >
                        <Text style={{ color: palette.primary, fontSize: 12, fontWeight: '700' }}>
                            {dir === 'asc' ? '↑' : '↓'}
                        </Text>
                    </Pressable>
                </View>
            </View>
            <FlatList
                data={data}
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
                    !isLoading ? (
                        <EmptyState
                            title="No tasks"
                            message={
                                filter === 'completed'
                                    ? 'Completed tasks will show up here.'
                                    : 'Create a task to get started.'
                            }
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
            />
            <View style={styles.fabWrap}>
                <Button
                    title="+ New task"
                    onPress={() => router.push('/task/new')}
                    style={{ borderRadius: 999 }}
                />
            </View>
        </Screen>
    );
}

const styles = StyleSheet.create({
    header: { paddingHorizontal: 16, paddingTop: 12 },
    title: { fontSize: 28, fontWeight: '700' },
    controls: { paddingHorizontal: 16, gap: 4 },
    sortRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4 },
    listContent: { padding: 16, paddingBottom: 100 },
    fabWrap: { position: 'absolute', bottom: 16, right: 16, left: 16 },
});
