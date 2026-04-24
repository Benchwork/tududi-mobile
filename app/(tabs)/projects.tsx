import React, { useMemo, useState } from 'react';
import {
    Alert,
    FlatList,
    Pressable,
    RefreshControl,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Screen } from '@/components/Screen';
import { Card } from '@/components/Card';
import { Badge } from '@/components/Badge';
import { Button } from '@/components/Button';
import { OfflineBanner } from '@/components/OfflineBanner';
import { EmptyState } from '@/components/EmptyState';
import { TextField } from '@/components/TextField';
import { useProjects, useCreateProject } from '@/features/projects/queries';
import { useAreas } from '@/features/areas/queries';
import { useSyncStore } from '@/sync/scheduler';
import { useTheme } from '@/theme/theme';
import type { Project, ProjectStatus } from '@/types/tududi';

const STATUS_COLOR: Record<ProjectStatus, string> = {
    not_started: '#64748b',
    planned: '#0ea5e9',
    in_progress: '#6366f1',
    waiting: '#f59e0b',
    done: '#16a34a',
    cancelled: '#94a3b8',
};

export default function ProjectsScreen() {
    const router = useRouter();
    const { palette } = useTheme();
    const { data: projects = [], refetch } = useProjects();
    const { data: areas = [] } = useAreas();
    const [search, setSearch] = useState('');
    const syncing = useSyncStore((s) => s.running);
    const runSync = useSyncStore((s) => s.run);
    const create = useCreateProject();

    const grouped = useMemo(() => {
        const q = search.trim().toLowerCase();
        const filtered = q
            ? projects.filter((p) => p.name.toLowerCase().includes(q))
            : projects;
        const byArea = new Map<number | null, Project[]>();
        for (const p of filtered) {
            const key = p.area_id ?? null;
            const arr = byArea.get(key) ?? [];
            arr.push(p);
            byArea.set(key, arr);
        }
        const sections = Array.from(byArea.entries()).map(([areaId, items]) => {
            const areaName =
                areaId === null
                    ? 'No area'
                    : areas.find((a) => a.id === areaId)?.name ?? 'Unknown';
            return { areaId, areaName, items };
        });
        sections.sort((a, b) => a.areaName.localeCompare(b.areaName));
        return sections;
    }, [projects, areas, search]);

    const flat = useMemo(
        () =>
            grouped.flatMap((section) => [
                { kind: 'header' as const, ...section },
                ...section.items.map((item) => ({ kind: 'item' as const, item })),
            ]),
        [grouped]
    );

    const onNewProject = () => {
        Alert.prompt?.(
            'New project',
            'Name your project',
            async (name?: string) => {
                if (!name || !name.trim()) return;
                await create.mutateAsync({ name: name.trim() });
                refetch();
            }
        );
    };

    return (
        <Screen padded={false}>
            <OfflineBanner />
            <View style={styles.header}>
                <Text style={[styles.title, { color: palette.text }]}>Projects</Text>
                <TextField
                    placeholder="Search projects..."
                    value={search}
                    onChangeText={setSearch}
                    autoCapitalize="none"
                    autoCorrect={false}
                    style={{ marginBottom: 0 }}
                />
            </View>
            <FlatList
                data={flat}
                keyExtractor={(row, idx) =>
                    row.kind === 'header'
                        ? `h-${row.areaId ?? 'none'}`
                        : row.item.uid ?? String(row.item.id) + idx
                }
                renderItem={({ item: row }) => {
                    if (row.kind === 'header') {
                        return (
                            <Text
                                style={[styles.sectionLabel, { color: palette.textMuted }]}
                            >
                                {row.areaName.toUpperCase()}
                            </Text>
                        );
                    }
                    const p = row.item;
                    const statusColor = p.status ? STATUS_COLOR[p.status] : palette.textFaint;
                    return (
                        <Pressable
                            onPress={() =>
                                router.push({
                                    pathname: '/project/[id]',
                                    params: { id: String(p.id || p.uid) },
                                })
                            }
                        >
                            <Card style={{ marginBottom: 8 }}>
                                <Text
                                    style={{ color: palette.text, fontSize: 16, fontWeight: '600' }}
                                >
                                    {p.name}
                                </Text>
                                {p.description ? (
                                    <Text
                                        style={{ color: palette.textMuted, fontSize: 13, marginTop: 4 }}
                                        numberOfLines={2}
                                    >
                                        {p.description}
                                    </Text>
                                ) : null}
                                <View style={{ flexDirection: 'row', gap: 6, marginTop: 8 }}>
                                    {p.status ? (
                                        <Badge label={p.status.replace('_', ' ')} color={statusColor} />
                                    ) : null}
                                    {p.priority ? (
                                        <Badge label={p.priority} variant="outline" />
                                    ) : null}
                                </View>
                            </Card>
                        </Pressable>
                    );
                }}
                contentContainerStyle={styles.listContent}
                refreshControl={
                    <RefreshControl
                        refreshing={syncing}
                        onRefresh={() => runSync()}
                        tintColor={palette.primary}
                    />
                }
                ListEmptyComponent={
                    <EmptyState
                        title="No projects"
                        message="Organize related tasks and notes under a project."
                    />
                }
            />
            <View style={styles.fabWrap}>
                <Button title="+ New project" onPress={onNewProject} style={{ borderRadius: 999 }} />
            </View>
        </Screen>
    );
}

const styles = StyleSheet.create({
    header: { paddingHorizontal: 16, paddingTop: 12, gap: 12 },
    title: { fontSize: 28, fontWeight: '700' },
    listContent: { padding: 16, paddingBottom: 100 },
    sectionLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5, marginTop: 12, marginBottom: 6 },
    fabWrap: { position: 'absolute', bottom: 16, right: 16, left: 16 },
});
