import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { configureApi, type SessionState } from '../api/client';

const STORAGE_KEY = 'tududi.session';
const LAST_SERVER_KEY = 'tududi.lastServer';

export interface PersistedSession {
    serverUrl: string;
    token: string | null;
    authMode: 'bearer' | 'session';
    cookie: string | null;
    csrfToken: string | null;
    userEmail?: string;
    userName?: string;
    serverVersion?: string;
}

export interface SessionStore {
    hydrated: boolean;
    session: PersistedSession | null;
    /**
     * The most recent server URL the user signed in against. Preserved across
     * sign-out so the login screen can reuse it.
     */
    lastServerUrl: string | null;
    setSession: (s: PersistedSession) => Promise<void>;
    updateSession: (patch: Partial<PersistedSession>) => Promise<void>;
    /**
     * Sign out: drop credentials but keep the last server URL so the user can
     * land directly on the login page. Local SQLite data is NOT touched.
     */
    signOut: () => Promise<void>;
    /**
     * Full reset: clears credentials and forgets the last server URL. Used by
     * the API client's 401 handler so a stale server doesn't get auto-selected.
     */
    clear: () => Promise<void>;
    hydrate: () => Promise<void>;
}

async function readSecure(): Promise<PersistedSession | null> {
    try {
        const raw = await SecureStore.getItemAsync(STORAGE_KEY);
        if (!raw) return null;
        return JSON.parse(raw) as PersistedSession;
    } catch {
        return null;
    }
}

async function writeSecure(s: PersistedSession | null): Promise<void> {
    if (!s) {
        await SecureStore.deleteItemAsync(STORAGE_KEY);
        return;
    }
    await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(s));
}

export const useSessionStore = create<SessionStore>((set, get) => ({
    hydrated: false,
    session: null,
    lastServerUrl: null,
    hydrate: async () => {
        const s = await readSecure();
        let lastServerUrl: string | null = null;
        try {
            lastServerUrl = await SecureStore.getItemAsync(LAST_SERVER_KEY);
        } catch {
            lastServerUrl = null;
        }
        if (!lastServerUrl && s?.serverUrl) lastServerUrl = s.serverUrl;
        set({ session: s, lastServerUrl, hydrated: true });
    },
    setSession: async (s) => {
        await writeSecure(s);
        try {
            await SecureStore.setItemAsync(LAST_SERVER_KEY, s.serverUrl);
        } catch {
            // non-fatal
        }
        set({ session: s, lastServerUrl: s.serverUrl });
    },
    updateSession: async (patch) => {
        const existing = get().session;
        if (!existing) return;
        const next = { ...existing, ...patch };
        await writeSecure(next);
        if (patch.serverUrl) {
            try {
                await SecureStore.setItemAsync(LAST_SERVER_KEY, patch.serverUrl);
            } catch {
                // non-fatal
            }
        }
        set({
            session: next,
            lastServerUrl: patch.serverUrl ?? get().lastServerUrl,
        });
    },
    signOut: async () => {
        await writeSecure(null);
        set({ session: null });
    },
    clear: async () => {
        await writeSecure(null);
        try {
            await SecureStore.deleteItemAsync(LAST_SERVER_KEY);
        } catch {
            // non-fatal
        }
        set({ session: null, lastServerUrl: null });
    },
}));

export function getApiSession(): SessionState | null {
    const s = useSessionStore.getState().session;
    if (!s) return null;
    return {
        serverUrl: s.serverUrl,
        token: s.token,
        authMode: s.authMode,
        cookie: s.cookie,
        csrfToken: s.csrfToken,
    };
}

configureApi({
    getSession: getApiSession,
    onUnauthorized: async () => {
        const store = useSessionStore.getState();
        if (store.session) {
            await store.clear();
        }
    },
});
