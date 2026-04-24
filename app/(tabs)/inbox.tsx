import React, { useState } from 'react';
import {
    Alert,
    FlatList,
    Pressable,
    RefreshControl,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { Screen } from '@/components/Screen';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { OfflineBanner } from '@/components/OfflineBanner';
import { EmptyState } from '@/components/EmptyState';
import { TextField } from '@/components/TextField';
import {
    useInbox,
    useCreateInboxItem,
    useDeleteInboxItem,
    useMarkInboxProcessed,
} from '@/features/inbox/queries';
import { useCreateTask } from '@/features/tasks/queries';
import { useCreateNote } from '@/features/notes/queries';
import { useSyncStore } from '@/sync/scheduler';
import { useTheme } from '@/theme/theme';

export default function InboxScreen() {
    const { palette } = useTheme();
    const { data: items = [] } = useInbox();
    const [content, setContent] = useState('');
    const syncing = useSyncStore((s) => s.running);
    const runSync = useSyncStore((s) => s.run);
    const create = useCreateInboxItem();
    const remove = useDeleteInboxItem();
    const markProcessed = useMarkInboxProcessed();
    const createTask = useCreateTask();
    const createNote = useCreateNote();

    const onCapture = async () => {
        const text = content.trim();
        if (!text) return;
        await create.mutateAsync(text);
        setContent('');
    };

    const onProcess = (uid: string, originalContent: string) => {
        Alert.alert('Process inbox item', 'Convert this to…', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Task',
                onPress: async () => {
                    await createTask.mutateAsync({ name: originalContent });
                    await markProcessed.mutateAsync(uid);
                },
            },
            {
                text: 'Note',
                onPress: async () => {
                    await createNote.mutateAsync({
                        title: originalContent.slice(0, 80),
                        content: originalContent,
                    });
                    await markProcessed.mutateAsync(uid);
                },
            },
            {
                text: 'Dismiss',
                style: 'destructive',
                onPress: () => remove.mutate(uid),
            },
        ]);
    };

    return (
        <Screen padded={false}>
            <OfflineBanner />
            <View style={styles.header}>
                <Text style={[styles.title, { color: palette.text }]}>Inbox</Text>
                <Text style={{ color: palette.textMuted, fontSize: 13 }}>
                    Quick capture — process later into tasks, notes, or projects.
                </Text>
            </View>

            <View style={styles.captureRow}>
                <TextField
                    placeholder="Jot something down..."
                    value={content}
                    onChangeText={setContent}
                    style={{ marginBottom: 0, flex: 1 }}
                    onSubmitEditing={onCapture}
                    returnKeyType="send"
                />
                <Button title="Add" onPress={onCapture} style={{ marginLeft: 8 }} />
            </View>

            <FlatList
                data={items}
                keyExtractor={(i) => i.uid ?? String(i.id)}
                renderItem={({ item }) => (
                    <Pressable onPress={() => onProcess(item.uid!, item.content)}>
                        <Card style={{ marginBottom: 8 }}>
                            <Text style={{ color: palette.text, fontSize: 15 }}>
                                {item.content}
                            </Text>
                        </Card>
                    </Pressable>
                )}
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
                        title="Inbox zero"
                        message="Nothing to process. Add quick thoughts using the field above."
                    />
                }
            />
        </Screen>
    );
}

const styles = StyleSheet.create({
    header: { paddingHorizontal: 16, paddingTop: 12, gap: 6 },
    title: { fontSize: 28, fontWeight: '700' },
    captureRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    listContent: { padding: 16 },
});
