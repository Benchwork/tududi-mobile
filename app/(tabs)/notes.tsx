import React, { useState } from 'react';
import {
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
import { Button } from '@/components/Button';
import { OfflineBanner } from '@/components/OfflineBanner';
import { EmptyState } from '@/components/EmptyState';
import { TextField } from '@/components/TextField';
import { useNotes, useCreateNote } from '@/features/notes/queries';
import { useSyncStore } from '@/sync/scheduler';
import { useTheme } from '@/theme/theme';

export default function NotesScreen() {
    const router = useRouter();
    const { palette } = useTheme();
    const { data: notes = [] } = useNotes();
    const [search, setSearch] = useState('');
    const syncing = useSyncStore((s) => s.running);
    const runSync = useSyncStore((s) => s.run);
    const create = useCreateNote();

    const filtered = search
        ? notes.filter(
              (n) =>
                  n.title?.toLowerCase().includes(search.toLowerCase()) ||
                  n.content?.toLowerCase().includes(search.toLowerCase())
          )
        : notes;

    const onNew = async () => {
        const created = await create.mutateAsync({ title: 'Untitled note', content: '' });
        router.push({
            pathname: '/note/[id]',
            params: { id: created.uid! },
        });
    };

    return (
        <Screen padded={false}>
            <OfflineBanner />
            <View style={styles.header}>
                <Text style={[styles.title, { color: palette.text }]}>Notes</Text>
                <TextField
                    placeholder="Search notes..."
                    value={search}
                    onChangeText={setSearch}
                    autoCapitalize="none"
                    style={{ marginBottom: 0 }}
                />
            </View>
            <FlatList
                data={filtered}
                keyExtractor={(n) => n.uid ?? String(n.id)}
                renderItem={({ item }) => (
                    <Pressable
                        onPress={() =>
                            router.push({
                                pathname: '/note/[id]',
                                params: { id: String(item.id || item.uid) },
                            })
                        }
                    >
                        <Card
                            style={{
                                marginBottom: 8,
                                borderLeftWidth: 4,
                                borderLeftColor: item.color ?? palette.accent,
                            }}
                        >
                            {item.title ? (
                                <Text
                                    style={{ color: palette.text, fontSize: 16, fontWeight: '600' }}
                                >
                                    {item.title}
                                </Text>
                            ) : null}
                            {item.content ? (
                                <Text
                                    style={{
                                        color: palette.textMuted,
                                        fontSize: 13,
                                        marginTop: item.title ? 4 : 0,
                                    }}
                                    numberOfLines={3}
                                >
                                    {item.content}
                                </Text>
                            ) : null}
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
                        title="No notes"
                        message="Capture ideas, references, or long-form notes here."
                    />
                }
            />
            <View style={styles.fabWrap}>
                <Button title="+ New note" onPress={onNew} style={{ borderRadius: 999 }} />
            </View>
        </Screen>
    );
}

const styles = StyleSheet.create({
    header: { paddingHorizontal: 16, paddingTop: 12, gap: 12 },
    title: { fontSize: 28, fontWeight: '700' },
    listContent: { padding: 16, paddingBottom: 100 },
    fabWrap: { position: 'absolute', bottom: 16, right: 16, left: 16 },
});
