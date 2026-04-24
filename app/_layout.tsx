import React, { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { AppProviders } from '@/providers/AppProviders';
import { useSessionStore } from '@/stores/session';
import { useShareIntent } from '@/share/linking';

function AuthGate({ children }: { children: React.ReactNode }) {
    useShareIntent();
    const session = useSessionStore((s) => s.session);
    const lastServerUrl = useSessionStore((s) => s.lastServerUrl);
    const hydrated = useSessionStore((s) => s.hydrated);
    const segments = useSegments();
    const router = useRouter();

    useEffect(() => {
        if (!hydrated) return;
        const inAuthGroup = segments[0] === '(auth)';
        if (!session && !inAuthGroup) {
            if (lastServerUrl) {
                router.replace({
                    pathname: '/(auth)/login',
                    params: { serverUrl: lastServerUrl },
                });
            } else {
                router.replace('/(auth)/server');
            }
        } else if (session && inAuthGroup) {
            router.replace('/(tabs)/today');
        }
    }, [session, lastServerUrl, hydrated, segments, router]);

    return <>{children}</>;
}

export default function RootLayout() {
    return (
        <AppProviders>
            <AuthGate>
                <Stack screenOptions={{ headerShown: false }}>
                    <Stack.Screen name="(auth)" />
                    <Stack.Screen name="(tabs)" />
                    <Stack.Screen
                        name="task/[uid]"
                        options={{ headerShown: true, title: 'Task' }}
                    />
                    <Stack.Screen
                        name="project/[id]"
                        options={{ headerShown: true, title: 'Project' }}
                    />
                    <Stack.Screen
                        name="note/[id]"
                        options={{ headerShown: true, title: 'Note' }}
                    />
                    <Stack.Screen
                        name="area/[id]"
                        options={{ headerShown: true, title: 'Area' }}
                    />
                    <Stack.Screen name="search" options={{ headerShown: true }} />
                </Stack>
            </AuthGate>
        </AppProviders>
    );
}
