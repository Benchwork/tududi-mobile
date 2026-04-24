import React, { useState } from 'react';
import {
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Screen } from '@/components/Screen';
import { TextField } from '@/components/TextField';
import { Button } from '@/components/Button';
import { useTheme } from '@/theme/theme';
import { verifyApiKey } from '@/api/login';
import { useSessionStore } from '@/stores/session';
import { isApiError } from '@/api/errors';

export default function ApiKeyScreen() {
    const { palette } = useTheme();
    const router = useRouter();
    const { serverUrl } = useLocalSearchParams<{ serverUrl: string }>();
    const setSession = useSessionStore((s) => s.setSession);

    const [token, setToken] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const onConnect = async () => {
        if (!serverUrl) {
            router.replace('/(auth)/server');
            return;
        }
        const t = token.trim();
        if (!t) {
            setError('Enter your personal API key');
            return;
        }
        setError(null);
        setBusy(true);
        try {
            await verifyApiKey(serverUrl, t);
            await setSession({
                serverUrl,
                token: t,
                authMode: 'bearer',
                cookie: null,
                csrfToken: null,
            });
            router.replace('/(tabs)/today');
        } catch (err) {
            setError(isApiError(err) ? err.message : 'Could not verify API key');
        } finally {
            setBusy(false);
        }
    };

    return (
        <Screen>
            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
                <ScrollView
                    contentContainerStyle={styles.scroll}
                    keyboardShouldPersistTaps="handled"
                >
                    <View style={styles.header}>
                        <Text style={[styles.title, { color: palette.text }]}>
                            Use an API key
                        </Text>
                        <Text style={[styles.subtitle, { color: palette.textMuted }]}>
                            Generate a key in the tududi web UI under Settings → API Keys, then
                            paste it here.
                        </Text>
                    </View>

                    <TextField
                        label="API key"
                        placeholder="tdd_..."
                        value={token}
                        onChangeText={setToken}
                        autoCapitalize="none"
                        autoCorrect={false}
                        secureTextEntry
                        multiline={false}
                        returnKeyType="go"
                        onSubmitEditing={onConnect}
                        error={error ?? undefined}
                    />

                    <Button title="Connect" onPress={onConnect} loading={busy} full />

                    <Button
                        title="Back"
                        variant="ghost"
                        full
                        onPress={() => router.back()}
                        style={{ marginTop: 8 }}
                    />
                </ScrollView>
            </KeyboardAvoidingView>
        </Screen>
    );
}

const styles = StyleSheet.create({
    scroll: { padding: 8, gap: 8 },
    header: { marginTop: 24, marginBottom: 24, gap: 6 },
    title: { fontSize: 28, fontWeight: '700' },
    subtitle: { fontSize: 14, lineHeight: 20 },
});
