/**
 * Generate a reasonably unique, URL-safe client-side uid.
 * Prefixed so it's obvious the row was created offline before sync assigned
 * a server uid.
 */
export function newClientUid(entity: string): string {
    const ts = Date.now().toString(36);
    const rand = Math.random().toString(36).slice(2, 10);
    return `local_${entity}_${ts}_${rand}`;
}

export function isLocalUid(uid: string | null | undefined): boolean {
    return !!uid && uid.startsWith('local_');
}
