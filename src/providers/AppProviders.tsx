import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSessionStore } from '../stores/session';
import { useUiStore } from '../stores/ui';
import { useTheme } from '../theme/theme';
import { ensureDatabaseReady } from '../db/database';
import { initSyncScheduler } from '../sync/scheduler';

export function AppProviders({ children }: { children: React.ReactNode }) {
    const queryClient = useMemo(
        () =>
            new QueryClient({
                defaultOptions: {
                    queries: {
                        retry: (failureCount, err) => {
                            const status = (err as { status?: number })?.status ?? 0;
                            if (status === 401 || status === 403 || status === 404) return false;
                            return failureCount < 3;
                        },
                        staleTime: 30_000,
                        refetchOnWindowFocus: false,
                    },
                },
            }),
        []
    );

    const hydrateSession = useSessionStore((s) => s.hydrate);
    const sessionHydrated = useSessionStore((s) => s.hydrated);
    const hydrateUi = useUiStore((s) => s.hydrate);
    const uiHydrated = useUiStore((s) => s.hydrated);
    const [dbReady, setDbReady] = useState(false);

    useEffect(() => {
        void hydrateSession();
        void hydrateUi();
        void (async () => {
            try {
                await ensureDatabaseReady();
            } finally {
                setDbReady(true);
            }
        })();
        initSyncScheduler();
    }, [hydrateSession, hydrateUi]);

    const ready = sessionHydrated && uiHydrated && dbReady;

    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <SafeAreaProvider>
                <QueryClientProvider client={queryClient}>
                    {ready ? children : <Splash />}
                </QueryClientProvider>
            </SafeAreaProvider>
        </GestureHandlerRootView>
    );
}

function Splash() {
    const { palette } = useTheme();
    return (
        <View
            style={{
                flex: 1,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: palette.bg,
            }}
        >
            <ActivityIndicator color={palette.primary} size="large" />
        </View>
    );
}
