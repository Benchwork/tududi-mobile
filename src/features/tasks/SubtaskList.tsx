import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { TextField } from '../../components/TextField';
import { TaskRow } from './TaskRow';
import { useCreateTask, useTasks, useToggleTask } from './queries';
import { useTheme } from '../../theme/theme';

const styles = StyleSheet.create({
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    bar: {
        height: 6,
        overflow: 'hidden',
    },
    addRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginTop: 4,
    },
    addBtn: {
        width: 44,
        height: 44,
        alignItems: 'center',
        justifyContent: 'center',
    },
});

export interface SubtaskListProps {
    parentUid: string;
    parentTaskId?: number | null;
}

export function SubtaskList({ parentUid, parentTaskId }: SubtaskListProps) {
    const router = useRouter();
    const { palette, radius } = useTheme();
    const [draft, setDraft] = useState('');
    const { data: subtasks = [] } = useTasks({
        parentTaskId: parentTaskId ?? undefined,
    });
    const create = useCreateTask();
    const toggle = useToggleTask();

    const completed = subtasks.filter((s) => s.status === 'completed').length;
    const total = subtasks.length;
    const pct = total === 0 ? 0 : Math.round((completed / total) * 100);

    const onAdd = async () => {
        if (!draft.trim()) return;
        await create.mutateAsync({
            name: draft.trim(),
            parent_task_id: parentTaskId ?? null,
        });
        setDraft('');
    };

    return (
        <View style={{ gap: 8 }}>
            <View style={styles.header}>
                <Text style={{ color: palette.text, fontWeight: '700' }}>
                    Subtasks
                </Text>
                <Text style={{ color: palette.textMuted, fontSize: 12 }}>
                    {completed}/{total} complete
                </Text>
            </View>

            <View
                style={[
                    styles.bar,
                    { backgroundColor: palette.bgMuted, borderRadius: radius.pill },
                ]}
            >
                <View
                    style={{
                        width: `${pct}%`,
                        height: '100%',
                        backgroundColor: palette.success,
                        borderRadius: radius.pill,
                    }}
                />
            </View>

            {subtasks.map((s) => (
                <TaskRow
                    key={s.uid ?? String(s.id)}
                    task={s}
                    compact
                    onPress={() =>
                        router.push({
                            pathname: '/task/[uid]',
                            params: { uid: s.uid! },
                        })
                    }
                    onToggle={() =>
                        toggle.mutate({
                            uid: s.uid!,
                            completed: s.status !== 'completed',
                        })
                    }
                />
            ))}

            <View style={styles.addRow}>
                <TextField
                    value={draft}
                    onChangeText={setDraft}
                    placeholder="Add subtask"
                    style={{ marginBottom: 0, flex: 1 }}
                    returnKeyType="done"
                    onSubmitEditing={onAdd}
                />
                <Pressable
                    onPress={onAdd}
                    style={[
                        styles.addBtn,
                        { backgroundColor: palette.primary, borderRadius: radius.md },
                    ]}
                >
                    <Text style={{ color: palette.primaryText, fontWeight: '700' }}>+</Text>
                </Pressable>
            </View>
        </View>
    );
}

export function SubtaskParentLink({ parentTaskId }: { parentTaskId: number }) {
    const router = useRouter();
    const { palette } = useTheme();
    return (
        <Pressable
            onPress={() =>
                router.push({
                    pathname: '/task/[uid]',
                    params: { uid: `srv_${parentTaskId}` },
                })
            }
        >
            <Text style={{ color: palette.primary, fontSize: 13 }}>↥ Open parent task</Text>
        </Pressable>
    );
}
