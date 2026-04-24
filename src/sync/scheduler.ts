import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import NetInfo from '@react-native-community/netinfo';
import { create } from 'zustand';
import { useSessionStore } from '../stores/session';
import { drainOutbox, type PushResult } from './push';
import { pullAll, type PullResult } from './pull';
import { countPending } from './outbox';

const BG_TASK = 'tududi-sync-bg';

export interface SyncStatus {
    online: boolean;
    running: boolean;
    lastRunAt: number | null;
    lastPull: PullResult | null;
    lastPush: PushResult | null;
    pendingOps: number;
    error: string | null;
}

interface SyncStore extends SyncStatus {
    setOnline: (online: boolean) => void;
    run: (opts?: { silent?: boolean }) => Promise<void>;
    refreshPending: () => Promise<void>;
}

export const useSyncStore = create<SyncStore>((set, get) => ({
    online: true,
    running: false,
    lastRunAt: null,
    lastPull: null,
    lastPush: null,
    pendingOps: 0,
    error: null,
    setOnline: (online) => set({ online }),
    refreshPending: async () => {
        const n = await countPending();
        set({ pendingOps: n });
    },
    run: async (opts = {}) => {
        const session = useSessionStore.getState().session;
        if (!session) return;
        if (get().running) return;
        if (!get().online) {
            await get().refreshPending();
            return;
        }

        set({ running: true, error: opts.silent ? get().error : null });
        let lastPush: PushResult | null = null;
        let lastPull: PullResult | null = null;
        let error: string | null = null;
        try {
            lastPush = await drainOutbox();
            lastPull = await pullAll();
        } catch (err) {
            error = err instanceof Error ? err.message : String(err);
        } finally {
            const pendingOps = await countPending();
            set({
                running: false,
                lastRunAt: Date.now(),
                lastPush,
                lastPull,
                pendingOps,
                error,
            });
        }
    },
}));

let schedulerStarted = false;
let netUnsub: (() => void) | null = null;

export function initSyncScheduler(): void {
    if (schedulerStarted) return;
    schedulerStarted = true;

    netUnsub = NetInfo.addEventListener((state) => {
        const online = !!(state.isConnected && state.isInternetReachable !== false);
        const prev = useSyncStore.getState().online;
        useSyncStore.getState().setOnline(online);
        if (online && !prev) {
            void useSyncStore.getState().run({ silent: true });
        }
    });

    if (!TaskManager.isTaskDefined(BG_TASK)) {
        TaskManager.defineTask(BG_TASK, async () => {
            try {
                await useSyncStore.getState().run({ silent: true });
                return BackgroundFetch.BackgroundFetchResult.NewData;
            } catch {
                return BackgroundFetch.BackgroundFetchResult.Failed;
            }
        });
    }

    BackgroundFetch.registerTaskAsync(BG_TASK, {
        minimumInterval: 15 * 60,
        stopOnTerminate: false,
        startOnBoot: true,
    }).catch(() => {
        // Background fetch may be unavailable in Expo Go or simulators.
    });

    useSessionStore.subscribe((state, prevState) => {
        if (state.session && !prevState.session) {
            void useSyncStore.getState().run({ silent: true });
        }
    });

    void useSyncStore.getState().refreshPending();
}

export function stopSyncScheduler(): void {
    netUnsub?.();
    netUnsub = null;
    schedulerStarted = false;
    BackgroundFetch.unregisterTaskAsync(BG_TASK).catch(() => {});
}
