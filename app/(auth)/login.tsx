import React, { useState } from 'react';
import {
    KeyboardAvoidingView,
    Platform,
    Pressable,
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
import { getCsrfToken, performLogin, tryCreateApiKey } from '@/api/login';
import { useSessionStore } from '@/stores/session';
import { isApiError } from '@/api/errors';

export default function LoginScreen() {
    const { palette } = useTheme();
    const router = useRouter();
    const { serverUrl } = useLocalSearchParams<{ serverUrl: string }>();
    const setSession = useSessionStore((s) => s.setSession);

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    const onLogin = async () => {
        if (!serverUrl) {
            router.replace('/(auth)/server');
            return;
        }
        setError(null);
        setBusy(true);
        try {
            const result = await performLogin(serverUrl, email.trim(), password);
            let token: string | null = result.token ?? null;
            const cookie = result.cookie ?? null;
            let csrf: string | undefined;

            if (!token && cookie) {
                csrf = await getCsrfToken(serverUrl, cookie);
                token = await tryCreateApiKey(serverUrl, cookie, csrf, 'Tududi Mobile');
            }

            await setSession({
                serverUrl,
                token: token ?? null,
                authMode: token ? 'bearer' : 'session',
                cookie: token ? null : cookie,
                csrfToken: token ? null : (csrf ?? null),
                userEmail: result.user.email,
                userName: result.user.name ?? undefined,
            });
            router.replace('/(tabs)/today');
        } catch (err) {
            const msg = isApiError(err) ? err.message : 'Login failed';
            setError(msg);
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
                        <Text style={[styles.title, { color: palette.text }]}>Sign in</Text>
                        {serverUrl ? (
                            <Text style={[styles.subtitle, { color: palette.textMuted }]}>
                                {serverUrl}
                            </Text>
                        ) : null}
                    </View>

                    <TextField
                        label="Email"
                        placeholder="you@example.com"
                        value={email}
                        onChangeText={setEmail}
                        autoCapitalize="none"
                        autoCorrect={false}
                        keyboardType="email-address"
                        textContentType="emailAddress"
                        returnKeyType="next"
                    />
                    <TextField
                        label="Password"
                        placeholder="••••••••"
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry
                        textContentType="password"
                        returnKeyType="go"
                        onSubmitEditing={onLogin}
                        error={error ?? undefined}
                    />

                    <Button title="Sign in" onPress={onLogin} loading={busy} full />

                    <View style={styles.divider}>
                        <View style={[styles.hr, { backgroundColor: palette.border }]} />
                        <Text style={[styles.dividerText, { color: palette.textFaint }]}>OR</Text>
                        <View style={[styles.hr, { backgroundColor: palette.border }]} />
                    </View>

                    <Button
                        title="Use an API key"
                        variant="secondary"
                        full
                        onPress={() =>
                            router.push({
                                pathname: '/(auth)/api-key',
                                params: { serverUrl },
                            })
                        }
                    />

                    <Pressable onPress={() => router.back()} style={styles.back}>
                        <Text style={{ color: palette.primary, fontSize: 14 }}>
                            Change server
                        </Text>
                    </Pressable>
                </ScrollView>
            </KeyboardAvoidingView>
        </Screen>
    );
}

const styles = StyleSheet.create({
    scroll: { padding: 8, gap: 8 },
    header: { marginTop: 24, marginBottom: 24, gap: 6 },
    title: { fontSize: 28, fontWeight: '700' },
    subtitle: { fontSize: 13 },
    divider: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginVertical: 20,
    },
    hr: { flex: 1, height: 1 },
    dividerText: { fontSize: 12, fontWeight: '600' },
    back: { alignSelf: 'center', marginTop: 16, padding: 8 },
});
