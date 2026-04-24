import React, { useEffect, useState } from 'react';
import {
    Alert,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import Markdown from 'react-native-markdown-display';
import { Screen } from '@/components/Screen';
import { TextField } from '@/components/TextField';
import { Button } from '@/components/Button';
import { useNote, useUpdateNote, useDeleteNote } from '@/features/notes/queries';
import { notesRepo } from '@/db/repositories';
import { useTheme } from '@/theme/theme';
import type { Note } from '@/types/tududi';

const COLORS = [null, '#ef4444', '#f59e0b', '#eab308', '#16a34a', '#0ea5e9', '#8b5cf6'];

export default function NoteDetailScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const router = useRouter();
    const { palette, radius } = useTheme();
    const [local, setLocal] = useState<Note | null>(null);
    const [preview, setPreview] = useState(false);
    const update = useUpdateNote();
    const del = useDeleteNote();

    const idNum = Number(id);
    const { data: note } = useNote(Number.isFinite(idNum) ? idNum : undefined);

    useEffect(() => {
        if (note) {
            setLocal(note);
            return;
        }
        if (!id) return;
        // Fallback: look up by uid for locally created notes.
        void (async () => {
            const list = await notesRepo.list();
            const match = list.find((x) => x.uid === id);
            if (match) setLocal(match);
        })();
    }, [note, id]);

    if (!local) {
        return (
            <Screen>
                <Stack.Screen options={{ title: 'Note' }} />
                <Text style={{ color: palette.textMuted }}>Loading…</Text>
            </Screen>
        );
    }

    const onSave = async () => {
        await update.mutateAsync({
            uid: local.uid!,
            patch: {
                title: local.title ?? '',
                content: local.content ?? '',
                color: local.color ?? null,
            },
        });
        router.back();
    };

    const onDelete = () => {
        Alert.alert('Delete note?', undefined, [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete',
                style: 'destructive',
                onPress: async () => {
                    await del.mutateAsync(local.uid!);
                    router.back();
                },
            },
        ]);
    };

    return (
        <Screen padded={false}>
            <Stack.Screen
                options={{
                    title: local.title || 'Note',
                    headerShown: true,
                    headerRight: () => (
                        <Pressable onPress={() => setPreview((p) => !p)} hitSlop={10}>
                            <Text style={{ color: palette.primary, fontWeight: '600' }}>
                                {preview ? 'Edit' : 'Preview'}
                            </Text>
                        </Pressable>
                    ),
                }}
            />
            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
                <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
                    <TextField
                        value={local.title ?? ''}
                        onChangeText={(v) => setLocal({ ...local, title: v })}
                        placeholder="Title"
                        style={{ fontSize: 18, fontWeight: '600' }}
                    />
                    <View style={styles.colors}>
                        {COLORS.map((c, i) => {
                            const active = (local.color ?? null) === c;
                            return (
                                <Pressable
                                    key={String(c ?? 'none')}
                                    onPress={() => setLocal({ ...local, color: c })}
                                    style={[
                                        styles.colorDot,
                                        {
                                            borderRadius: radius.pill,
                                            backgroundColor: c ?? 'transparent',
                                            borderColor: active ? palette.primary : palette.border,
                                            borderWidth: active ? 3 : 1,
                                        },
                                    ]}
                                >
                                    {c === null ? (
                                        <Text style={{ color: palette.textFaint, fontSize: 11 }}>
                                            ∅
                                        </Text>
                                    ) : null}
                                </Pressable>
                            );
                        })}
                    </View>
                    {preview ? (
                        <View
                            style={{
                                padding: 12,
                                backgroundColor: palette.bgElevated,
                                borderColor: palette.border,
                                borderWidth: 1,
                                borderRadius: radius.md,
                                minHeight: 200,
                            }}
                        >
                            <Markdown
                                style={{
                                    body: { color: palette.text, fontSize: 15 },
                                    code_inline: { backgroundColor: palette.bgMuted, color: palette.accent },
                                    code_block: { backgroundColor: palette.bgMuted },
                                    heading1: { color: palette.text },
                                    heading2: { color: palette.text },
                                    heading3: { color: palette.text },
                                    link: { color: palette.primary },
                                }}
                            >
                                {local.content ?? ''}
                            </Markdown>
                        </View>
                    ) : (
                        <TextField
                            value={local.content ?? ''}
                            onChangeText={(v) => setLocal({ ...local, content: v })}
                            placeholder="Start writing…"
                            multiline
                            style={{ minHeight: 260, textAlignVertical: 'top' }}
                        />
                    )}

                    <Button
                        title="Save"
                        onPress={onSave}
                        loading={update.isPending}
                        full
                        style={{ marginTop: 8 }}
                    />
                    <Button
                        title="Delete"
                        variant="danger"
                        onPress={onDelete}
                        full
                        style={{ marginTop: 8 }}
                    />
                </ScrollView>
            </KeyboardAvoidingView>
        </Screen>
    );
}

const styles = StyleSheet.create({
    colors: { flexDirection: 'row', gap: 8, marginBottom: 12 },
    colorDot: {
        width: 28,
        height: 28,
        alignItems: 'center',
        justifyContent: 'center',
    },
});
