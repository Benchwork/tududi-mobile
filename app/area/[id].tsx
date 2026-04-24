import React from 'react';
import {
    Alert,
    FlatList,
    Pressable,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Screen } from '@/components/Screen';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { useArea, useUpdateArea, useDeleteArea } from '@/features/areas/queries';
import { useProjects } from '@/features/projects/queries';
import { useTheme } from '@/theme/theme';

export default function AreaDetailScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const router = useRouter();
    const { palette } = useTheme();
    const idNum = Number(id);
    const { data: area } = useArea(Number.isFinite(idNum) ? idNum : undefined);
    const { data: projects = [] } = useProjects();
    const update = useUpdateArea();
    const del = useDeleteArea();

    if (!area) {
        return (
            <Screen>
                <Stack.Screen options={{ title: 'Area' }} />
                <Text style={{ color: palette.textMuted }}>Loading…</Text>
            </Screen>
        );
    }

    const areaProjects = projects.filter((p) => p.area_id === area.id);

    const onDelete = () => {
        Alert.alert('Delete area?', area.name, [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete',
                style: 'destructive',
                onPress: async () => {
                    await del.mutateAsync(area.uid!);
                    router.back();
                },
            },
        ]);
    };

    return (
        <Screen padded={false}>
            <Stack.Screen options={{ title: area.name, headerShown: true }} />
            <FlatList
                data={areaProjects}
                keyExtractor={(p) => p.uid ?? String(p.id)}
                ListHeaderComponent={
                    <View style={{ padding: 16, gap: 12 }}>
                        <TextField
                            label="Name"
                            value={area.name}
                            onChangeText={(v) =>
                                update.mutate({ uid: area.uid!, patch: { name: v } })
                            }
                        />
                        <TextField
                            label="Description"
                            value={area.description ?? ''}
                            onChangeText={(v) =>
                                update.mutate({
                                    uid: area.uid!,
                                    patch: { description: v },
                                })
                            }
                            multiline
                            style={{ minHeight: 80, textAlignVertical: 'top' }}
                        />
                        <Text style={[styles.section, { color: palette.textMuted }]}>
                            PROJECTS ({areaProjects.length})
                        </Text>
                    </View>
                }
                renderItem={({ item: p }) => (
                    <View style={{ paddingHorizontal: 16, marginBottom: 8 }}>
                        <Pressable
                            onPress={() =>
                                router.push({
                                    pathname: '/project/[id]',
                                    params: { id: String(p.id || p.uid) },
                                })
                            }
                        >
                            <Card>
                                <Text style={{ color: palette.text, fontWeight: '600' }}>
                                    {p.name}
                                </Text>
                                {p.description ? (
                                    <Text
                                        style={{ color: palette.textMuted, marginTop: 4 }}
                                        numberOfLines={2}
                                    >
                                        {p.description}
                                    </Text>
                                ) : null}
                            </Card>
                        </Pressable>
                    </View>
                )}
                ListFooterComponent={
                    <View style={{ padding: 16 }}>
                        <Button title="Delete area" variant="danger" onPress={onDelete} full />
                    </View>
                }
            />
        </Screen>
    );
}

const styles = StyleSheet.create({
    section: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5, marginTop: 8 },
});
