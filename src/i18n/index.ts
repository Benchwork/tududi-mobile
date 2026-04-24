/**
 * Lightweight i18n helper — intentionally minimal so we can reuse tududi's
 * server-hosted locale files later via `${serverUrl}/locales/<lang>.json`.
 *
 * For now we bundle English and provide a translation function that falls
 * back to the key when missing.
 */
import { useUiStore } from '../stores/ui';

type Dict = Record<string, string>;

const en: Dict = {
    'common.cancel': 'Cancel',
    'common.save': 'Save',
    'common.delete': 'Delete',
    'common.create': 'Create',
    'common.loading': 'Loading…',
    'tasks.today': 'Today',
    'tasks.upcoming': 'Upcoming',
    'tasks.someday': 'Someday',
    'tasks.completed': 'Completed',
    'tasks.all': 'All',
    'tasks.new': 'New task',
    'tasks.empty.title': 'No tasks',
    'projects.title': 'Projects',
    'projects.new': 'New project',
    'notes.title': 'Notes',
    'notes.new': 'New note',
    'inbox.title': 'Inbox',
    'inbox.placeholder': 'Jot something down...',
    'auth.signIn': 'Sign in',
    'auth.serverUrl': 'Server URL',
    'auth.apiKey': 'API key',
    'sync.offline': 'Offline',
    'sync.syncing': 'Syncing…',
    'sync.now': 'Sync now',
};

const catalogs: Record<string, Dict> = { en };

let activeLocale = 'en';

export function setLocale(locale: string): void {
    activeLocale = catalogs[locale] ? locale : 'en';
}

export function t(key: string, fallback?: string): string {
    const cat = catalogs[activeLocale] ?? en;
    return cat[key] ?? fallback ?? key;
}

export function useT(): (key: string, fallback?: string) => string {
    const locale = useUiStore((s) => s.locale);
    setLocale(locale);
    return t;
}

export function registerCatalog(locale: string, dict: Dict): void {
    catalogs[locale] = { ...(catalogs[locale] ?? {}), ...dict };
}

/**
 * Fetch a catalog from the user's tududi server (`/locales/<lang>.json`) and
 * register it. Fails silently if the server doesn't expose locales.
 */
export async function tryLoadRemoteCatalog(
    serverUrl: string,
    locale: string
): Promise<void> {
    if (!serverUrl || locale === 'en') return;
    try {
        const res = await fetch(
            `${serverUrl.replace(/\/+$/, '')}/locales/${locale}/translation.json`
        );
        if (!res.ok) return;
        const data = (await res.json()) as Dict;
        registerCatalog(locale, data);
    } catch {
        // ignore
    }
}
