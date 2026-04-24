import { useEffect } from 'react';
import * as Linking from 'expo-linking';
import { inboxRepo } from '../db/repositories';
import { enqueue } from '../sync/outbox';
import { useSyncStore } from '../sync/scheduler';
import { useSessionStore } from '../stores/session';

/**
 * Extract a usable snippet from an incoming URL or shared-text intent.
 * Examples:
 *   tududi://inbox?text=Buy%20milk
 *   https://tududi.example.com/share?text=...
 *   (Android SEND intent) → Linking.getInitialURL returns the raw text in some cases
 */
function extractShared(url: string): string | null {
    try {
        if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('tududi://')) {
            const parsed = Linking.parse(url);
            const text = parsed.queryParams?.text ?? parsed.queryParams?.content;
            if (typeof text === 'string') return text;
            if (Array.isArray(text) && text.length > 0) return text[0] ?? null;
            // For plain URLs we might want to save the URL itself.
            if (parsed.hostname) return url;
        }
        // Fallback: raw shared text (Android SEND intent pipes through Linking on some devices).
        if (url && !url.startsWith('exp') && !url.startsWith('/')) return url;
    } catch {
        return null;
    }
    return null;
}

async function captureShared(text: string): Promise<void> {
    const session = useSessionStore.getState().session;
    if (!session) return;
    const item = await inboxRepo.insertLocal(text);
    await enqueue('inbox_items', 'create', item.uid!, { content: item.content });
    void useSyncStore.getState().run({ silent: true });
}

export function useShareIntent(): void {
    useEffect(() => {
        let cancelled = false;
        void (async () => {
            try {
                const initial = await Linking.getInitialURL();
                if (!cancelled && initial) {
                    const text = extractShared(initial);
                    if (text) await captureShared(text);
                }
            } catch {
                // ignore
            }
        })();

        const sub = Linking.addEventListener('url', (event) => {
            const text = extractShared(event.url);
            if (text) void captureShared(text);
        });
        return () => {
            cancelled = true;
            sub.remove();
        };
    }, []);
}
