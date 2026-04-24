import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Screen } from '@/components/Screen';
import { TextField } from '@/components/TextField';
import { Card } from '@/components/Card';
import { TaskRow } from '@/features/tasks/TaskRow';
import { useLocalSearch } from '@/features/search/useSearch';
import { useToggleTask } from '@/features/tasks/queries';
import { useTheme } from '@/theme/theme';

export default function SearchScreen() {
    const router = useRouter();
    const { palette } = useTheme();
    const [q, setQ] = useState('');
    const { results, loading } = useLocalSearch(q);
    const toggle = useToggleTask();

    return (
        <Screen padded={false}>
            <Stack.Screen options={{ title: 'Search', headerShown: true }} />
            <View style={{ padding: 16 }}>
                <TextField
                    placeholder="Search tasks, projects, notes…"
                    autoFocus
                    value={q}
                    onChangeText={setQ}
                    style={{ marginBottom: 0 }}
                />
            </View>
            <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}>
                {loading ? (
                    <Text style={{ color: palette.textMuted }}>Searching…</Text>
                ) : null}

                {results.tasks.length > 0 && (
                    <Section title={`Tasks (${results.tasks.length})`}>
                        {results.tasks.map((t) => (
                            <TaskRow
                                key={t.uid ?? String(t.id)}
                                task={t}
                                compact
                                onPress={() =>
                                    router.push({
                                        pathname: '/task/[uid]',
                                        params: { uid: t.uid! },
                                    })
                                }
                                onToggle={() =>
                                    toggle.mutate({
                                        uid: t.uid!,
                                        completed: t.status !== 'completed',
                                    })
                                }
                            />
                        ))}
                    </Section>
                )}

                {results.projects.length > 0 && (
                    <Section title={`Projects (${results.projects.length})`}>
                        {results.projects.map((p) => (
                            <Pressable
                                key={p.uid ?? p.id}
                                onPress={() =>
                                    router.push({
                                        pathname: '/project/[id]',
                                        params: { id: String(p.id || p.uid) },
                                    })
                                }
                            >
                                <Card style={{ marginBottom: 6 }}>
                                    <Text style={{ color: palette.text, fontWeight: '600' }}>
                                        {p.name}
                                    </Text>
                                </Card>
                            </Pressable>
                        ))}
                    </Section>
                )}

                {results.notes.length > 0 && (
                    <Section title={`Notes (${results.notes.length})`}>
                        {results.notes.map((n) => (
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
                                            style={{
                                                color: palette.textMuted,
                                                marginTop: 2,
                                                fontSize: 12,
                                            }}
                                            numberOfLines={1}
                                        >
                                            {n.content}
                                        </Text>
                                    ) : null}
                                </Card>
                            </Pressable>
                        ))}
                    </Section>
                )}

                {results.areas.length > 0 && (
                    <Section title={`Areas (${results.areas.length})`}>
                        {results.areas.map((a) => (
                            <Pressable
                                key={a.uid ?? a.id}
                                onPress={() =>
                                    router.push({
                                        pathname: '/area/[id]',
                                        params: { id: String(a.id || a.uid) },
                                    })
                                }
                            >
                                <Card style={{ marginBottom: 6 }}>
                                    <Text style={{ color: palette.text, fontWeight: '600' }}>
                                        {a.name}
                                    </Text>
                                </Card>
                            </Pressable>
                        ))}
                    </Section>
                )}

                {!loading &&
                q.trim().length >= 2 &&
                results.tasks.length === 0 &&
                results.projects.length === 0 &&
                results.notes.length === 0 &&
                results.areas.length === 0 ? (
                    <Text
                        style={{
                            color: palette.textMuted,
                            textAlign: 'center',
                            marginTop: 40,
                        }}
                    >
                        No matches.
                    </Text>
                ) : null}
            </ScrollView>
        </Screen>
    );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    const { palette } = useTheme();
    return (
        <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: palette.textMuted }]}>
                {title.toUpperCase()}
            </Text>
            <View style={{ gap: 8 }}>{children}</View>
        </View>
    );
}

const styles = StyleSheet.create({
    section: { marginTop: 16 },
    sectionLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5, marginBottom: 8 },
});
