import React, { useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Screen } from '@/components/Screen';
import { Card } from '@/components/Card';
import { Badge } from '@/components/Badge';
import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { TaskRow } from '@/features/tasks/TaskRow';
import {
    useProject,
    useUpdateProject,
    useDeleteProject,
} from '@/features/projects/queries';
import { useAreas } from '@/features/areas/queries';
import {
    useTasks,
    useToggleTask,
    useCreateTask,
} from '@/features/tasks/queries';
import { useNotesByProject, useCreateNote } from '@/features/notes/queries';
import { projectsRepo } from '@/db/repositories';
import { useTheme } from '@/theme/theme';
import type { Project, ProjectStatus } from '@/types/tududi';

const STATUS_OPTIONS: ProjectStatus[] = [
    'not_started',
    'planned',
    'in_progress',
    'waiting',
    'done',
    'cancelled',
];

export default function ProjectDetailScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const router = useRouter();
    const { palette, radius } = useTheme();

    const idNum = Number(id);
    const { data: fetchedProject } = useProject(Number.isFinite(idNum) && idNum > 0 ? idNum : undefined);
    const [localProject, setLocalProject] = useState<Project | null>(null);
    useEffect(() => {
        if (fetchedProject || !id) return;
        void (async () => {
            const byUid = await projectsRepo.getByUid(String(id));
            if (byUid) setLocalProject(byUid);
        })();
    }, [id, fetchedProject]);
    const project = fetchedProject ?? localProject;
    const { data: tasks = [] } = useTasks({ projectId: project?.id, sort: 'due_date' });
    const { data: notes = [] } = useNotesByProject(project?.id);
    const { data: areas = [] } = useAreas();
    const update = useUpdateProject();
    const del = useDeleteProject();
    const toggle = useToggleTask();
    const createTask = useCreateTask();
    const createNote = useCreateNote();

    const area = useMemo(
        () => (project?.area_id ? areas.find((a) => a.id === project.area_id) : null),
        [areas, project]
    );

    if (!project) {
        return (
            <Screen>
                <Stack.Screen options={{ title: 'Project' }} />
                <Text style={{ color: palette.textMuted }}>Loading…</Text>
            </Screen>
        );
    }

    const onRename = () => {
        Alert.prompt?.('Rename project', 'New name', async (name?: string) => {
            if (name?.trim()) {
                await update.mutateAsync({
                    uid: project.uid!,
                    patch: { name: name.trim() },
                });
            }
        });
    };

    const onAddTask = () => {
        Alert.prompt?.('Add task', 'Name', async (name?: string) => {
            if (name?.trim()) {
                await createTask.mutateAsync({
                    name: name.trim(),
                    project_id: project.id,
                });
            }
        });
    };

    const onAddNote = async () => {
        const n = await createNote.mutateAsync({
            title: 'New note',
            content: '',
            project_id: project.id,
        });
        router.push({ pathname: '/note/[id]', params: { id: String(n.id || n.uid) } });
    };

    const onDelete = () => {
        Alert.alert('Delete project?', project.name, [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete',
                style: 'destructive',
                onPress: async () => {
                    await del.mutateAsync(project.uid!);
                    router.back();
                },
            },
        ]);
    };

    return (
        <Screen padded={false}>
            <Stack.Screen options={{ title: project.name, headerShown: true }} />
            <FlatList
                data={tasks}
                keyExtractor={(t) => t.uid ?? String(t.id)}
                ListHeaderComponent={
                    <View style={{ padding: 16, gap: 12 }}>
                        <Pressable onPress={onRename}>
                            <Text style={[styles.title, { color: palette.text }]}>{project.name}</Text>
                        </Pressable>
                        <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                            {project.status ? (
                                <Badge label={project.status.replace('_', ' ')} variant="soft" />
                            ) : null}
                            {project.priority ? (
                                <Badge label={`priority: ${project.priority}`} variant="outline" />
                            ) : null}
                            {area ? <Badge label={`area: ${area.name}`} variant="outline" /> : null}
                        </View>
                        {project.description ? (
                            <Text style={{ color: palette.textMuted, fontSize: 14 }}>
                                {project.description}
                            </Text>
                        ) : null}

                        <Text style={[styles.section, { color: palette.textMuted }]}>STATUS</Text>
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                            {STATUS_OPTIONS.map((s) => {
                                const active = project.status === s;
                                return (
                                    <Pressable
                                        key={s}
                                        onPress={() =>
                                            update.mutate({
                                                uid: project.uid!,
                                                patch: { status: s },
                                            })
                                        }
                                        style={[
                                            styles.chip,
                                            {
                                                borderRadius: radius.pill,
                                                backgroundColor: active
                                                    ? palette.bgMuted
                                                    : palette.bgElevated,
                                                borderColor: active ? palette.primary : palette.border,
                                            },
                                        ]}
                                    >
                                        <Text style={{ color: palette.text, fontSize: 12 }}>
                                            {s.replace('_', ' ')}
                                        </Text>
                                    </Pressable>
                                );
                            })}
                        </View>

                        <Text style={[styles.section, { color: palette.textMuted }]}>
                            DESCRIPTION
                        </Text>
                        <TextField
                            value={project.description ?? ''}
                            onChangeText={(v) =>
                                update.mutate({ uid: project.uid!, patch: { description: v } })
                            }
                            placeholder="Add a description…"
                            multiline
                            style={{ minHeight: 80, textAlignVertical: 'top' }}
                        />

                        <View style={styles.rowBetween}>
                            <Text style={[styles.section, { color: palette.textMuted }]}>
                                TASKS ({tasks.length})
                            </Text>
                            <Pressable onPress={onAddTask}>
                                <Text style={{ color: palette.primary, fontWeight: '600' }}>
                                    + Add
                                </Text>
                            </Pressable>
                        </View>
                    </View>
                }
                renderItem={({ item }) => (
                    <View style={{ paddingHorizontal: 16, marginBottom: 8 }}>
                        <TaskRow
                            task={item}
                            compact
                            onPress={() =>
                                router.push({
                                    pathname: '/task/[uid]',
                                    params: { uid: item.uid! },
                                })
                            }
                            onToggle={() =>
                                toggle.mutate({
                                    uid: item.uid!,
                                    completed: item.status !== 'completed',
                                })
                            }
                        />
                    </View>
                )}
                ListFooterComponent={
                    <View style={{ padding: 16, gap: 12 }}>
                        <View style={styles.rowBetween}>
                            <Text style={[styles.section, { color: palette.textMuted }]}>
                                NOTES ({notes.length})
                            </Text>
                            <Pressable onPress={onAddNote}>
                                <Text style={{ color: palette.primary, fontWeight: '600' }}>
                                    + Add
                                </Text>
                            </Pressable>
                        </View>
                        {notes.map((n) => (
                            <Pressable
                                key={n.uid ?? n.id}
                                onPress={() =>
                                    router.push({
                                        pathname: '/note/[id]',
                                        params: { id: String(n.id || n.uid) },
                                    })
                                }
                            >
                                <Card style={{ marginBottom: 6 }}>
                                    <Text style={{ color: palette.text, fontWeight: '600' }}>
                                        {n.title || 'Untitled'}
                                    </Text>
                                    {n.content ? (
                                        <Text
                                            style={{ color: palette.textMuted, marginTop: 4 }}
                                            numberOfLines={2}
                                        >
                                            {n.content}
                                        </Text>
                                    ) : null}
                                </Card>
                            </Pressable>
                        ))}
                        <Button
                            title="Delete project"
                            variant="danger"
                            onPress={onDelete}
                            style={{ marginTop: 12 }}
                            full
                        />
                    </View>
                }
            />
        </Screen>
    );
}

const styles = StyleSheet.create({
    title: { fontSize: 26, fontWeight: '700' },
    section: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5, marginTop: 8 },
    chip: { borderWidth: 1, paddingHorizontal: 10, paddingVertical: 6 },
    rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
