import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { TaskFilter, TaskSort } from '../types/tududi';

const PREFS_KEY = 'tududi.ui.prefs';

export type ThemePreference = 'system' | 'light' | 'dark';

export interface UiPrefs {
    theme: ThemePreference;
    taskFilter: TaskFilter;
    taskSort: TaskSort;
    taskSortDir: 'asc' | 'desc';
    locale: string;
}

const defaultPrefs: UiPrefs = {
    theme: 'system',
    taskFilter: 'today',
    taskSort: 'due_date',
    taskSortDir: 'asc',
    locale: 'en',
};

interface UiStore extends UiPrefs {
    hydrated: boolean;
    set: (patch: Partial<UiPrefs>) => Promise<void>;
    hydrate: () => Promise<void>;
}

async function readPrefs(): Promise<UiPrefs> {
    try {
        const raw = await AsyncStorage.getItem(PREFS_KEY);
        if (!raw) return defaultPrefs;
        const parsed = JSON.parse(raw) as Partial<UiPrefs>;
        return { ...defaultPrefs, ...parsed };
    } catch {
        return defaultPrefs;
    }
}

async function writePrefs(p: UiPrefs): Promise<void> {
    await AsyncStorage.setItem(PREFS_KEY, JSON.stringify(p));
}

export const useUiStore = create<UiStore>((set, get) => ({
    ...defaultPrefs,
    hydrated: false,
    hydrate: async () => {
        const p = await readPrefs();
        set({ ...p, hydrated: true });
    },
    set: async (patch) => {
        const next = { ...get(), ...patch };
        const { hydrated: _h, set: _s, hydrate: _hy, ...toPersist } = next;
        await writePrefs(toPersist);
        set(patch);
    },
}));
