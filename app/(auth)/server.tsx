import React, { useState } from 'react';
import {
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Screen } from '@/components/Screen';
import { TextField } from '@/components/TextField';
import { Button } from '@/components/Button';
import { useTheme } from '@/theme/theme';
import { probeServer } from '@/api/client';

function normalize(input: string): string {
    const trimmed = input.trim();
    if (!trimmed) return trimmed;
    if (/^https?:\/\//i.test(trimmed)) return trimmed.replace(/\/+$/, '');
    return `https://${trimmed}`.replace(/\/+$/, '');
}

export default function ServerScreen() {
    const { palette } = useTheme();
    const router = useRouter();
    const [url, setUrl] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [info, setInfo] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    const onContinue = async () => {
        const normalized = normalize(url);
        if (!normalized) {
            setError('Enter your tududi server URL');
            return;
        }
        setError(null);
        setInfo(null);
        setBusy(true);
        const probe = await probeServer(normalized);
        setBusy(false);
        if (!probe.ok) {
            setError(probe.error ?? 'Could not reach server');
            return;
        }
        if (probe.version) setInfo(`Connected to tududi ${probe.version}`);
        router.push({ pathname: '/(auth)/login', params: { serverUrl: normalized } });
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
                        <Text style={[styles.title, { color: palette.text }]}>Tududi</Text>
                        <Text style={[styles.subtitle, { color: palette.textMuted }]}>
                            Connect to your tududi server
                        </Text>
                    </View>

                    <TextField
                        label="Server URL"
                        placeholder="https://tududi.example.com"
                        value={url}
                        onChangeText={setUrl}
                        autoCapitalize="none"
                        autoCorrect={false}
                        keyboardType="url"
                        textContentType="URL"
                        returnKeyType="go"
                        onSubmitEditing={onContinue}
                        error={error ?? undefined}
                        hint={info ?? 'Enter the address where your tududi instance is reachable.'}
                    />

                    <Button title="Continue" onPress={onContinue} loading={busy} full />

                    <View style={styles.help}>
                        <Text style={[styles.helpText, { color: palette.textFaint }]}>
                            Running tududi locally? Use your computer&apos;s IP (e.g. http://192.168.1.10:3002).
                            Make sure your phone and server are on the same network.
                        </Text>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </Screen>
    );
}

const styles = StyleSheet.create({
    scroll: { padding: 8, gap: 8 },
    header: { marginTop: 32, marginBottom: 24, gap: 8 },
    title: { fontSize: 32, fontWeight: '700' },
    subtitle: { fontSize: 15 },
    help: { marginTop: 24 },
    helpText: { fontSize: 13, lineHeight: 18 },
});
