import { ApiError } from './errors';

export type AuthMode = 'bearer' | 'session';

export interface SessionState {
    serverUrl: string;
    token: string | null;
    authMode: AuthMode;
    csrfToken: string | null;
    cookie: string | null;
}

export interface RequestOptions {
    method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    query?: Record<string, string | number | boolean | null | undefined>;
    body?: unknown;
    signal?: AbortSignal;
    headers?: Record<string, string>;
    /** Bypass auth (for /health, /login, /version). */
    public?: boolean;
    /** Parse body as JSON (default true). */
    json?: boolean;
}

export type SessionProvider = () => SessionState | null;

export type UnauthorizedHandler = () => void | Promise<void>;

let sessionProvider: SessionProvider = () => null;
let onUnauthorized: UnauthorizedHandler = () => {};

export function configureApi(opts: {
    getSession: SessionProvider;
    onUnauthorized?: UnauthorizedHandler;
}): void {
    sessionProvider = opts.getSession;
    if (opts.onUnauthorized) onUnauthorized = opts.onUnauthorized;
}

function normalizeBaseUrl(url: string): string {
    return url.replace(/\/+$/, '');
}

function buildUrl(baseUrl: string, path: string, query?: RequestOptions['query']): string {
    const base = normalizeBaseUrl(baseUrl);
    const p = path.startsWith('/') ? path : `/${path}`;
    const url = new URL(`${base}${p}`);
    if (query) {
        for (const [k, v] of Object.entries(query)) {
            if (v === undefined || v === null) continue;
            url.searchParams.set(k, String(v));
        }
    }
    return url.toString();
}

async function parseBody(res: Response, expectJson: boolean): Promise<unknown> {
    if (res.status === 204) return null;
    const contentType = res.headers.get('content-type') ?? '';
    if (expectJson && contentType.includes('application/json')) {
        return res.json();
    }
    return res.text();
}

export async function request<T = unknown>(
    path: string,
    opts: RequestOptions = {}
): Promise<T> {
    const session = sessionProvider();
    if (!session && !opts.public) {
        throw new ApiError('Not authenticated', 401, 'no_session');
    }

    const serverUrl = session?.serverUrl;
    if (!serverUrl) {
        throw new ApiError('No server configured', 0, 'no_server');
    }

    // Prepend /api/v1 if the path starts with a plain /resource.
    const fullPath = path.startsWith('/api/') ? path : `/api/v1${path.startsWith('/') ? path : `/${path}`}`;
    const url = buildUrl(serverUrl, fullPath, opts.query);

    const method = opts.method ?? 'GET';
    const headers: Record<string, string> = {
        Accept: 'application/json',
        ...opts.headers,
    };

    if (!opts.public && session) {
        if (session.authMode === 'bearer' && session.token) {
            headers.Authorization = `Bearer ${session.token}`;
        } else if (session.authMode === 'session') {
            if (session.cookie) headers.Cookie = session.cookie;
            const stateful = method !== 'GET';
            if (stateful && session.csrfToken) {
                headers['X-CSRF-Token'] = session.csrfToken;
            }
        }
    }

    let body: BodyInit | undefined;
    if (opts.body !== undefined && opts.body !== null) {
        headers['Content-Type'] = 'application/json';
        body = JSON.stringify(opts.body);
    }

    let res: Response;
    try {
        res = await fetch(url, {
            method,
            headers,
            body,
            signal: opts.signal,
            credentials: session?.authMode === 'session' ? 'include' : 'omit',
        });
    } catch (err) {
        const msg = err instanceof Error ? err.message : 'Network request failed';
        throw new ApiError(msg, 0, 'network');
    }

    const expectJson = opts.json !== false;
    if (!res.ok) {
        let parsed: unknown = null;
        try {
            parsed = await parseBody(res, expectJson);
        } catch {
            parsed = null;
        }
        const message =
            (typeof parsed === 'object' &&
                parsed &&
                'message' in parsed &&
                typeof (parsed as { message: unknown }).message === 'string' &&
                (parsed as { message: string }).message) ||
            res.statusText ||
            `Request failed (${res.status})`;
        const apiErr = new ApiError(message, res.status, undefined, parsed);
        if (apiErr.isUnauthorized) {
            try {
                await onUnauthorized();
            } catch {
                // swallow
            }
        }
        throw apiErr;
    }

    const parsed = (await parseBody(res, expectJson)) as T;
    return parsed;
}

export const api = {
    get: <T>(path: string, opts?: Omit<RequestOptions, 'method' | 'body'>) =>
        request<T>(path, { ...opts, method: 'GET' }),
    post: <T>(path: string, body?: unknown, opts?: Omit<RequestOptions, 'method' | 'body'>) =>
        request<T>(path, { ...opts, method: 'POST', body }),
    put: <T>(path: string, body?: unknown, opts?: Omit<RequestOptions, 'method' | 'body'>) =>
        request<T>(path, { ...opts, method: 'PUT', body }),
    patch: <T>(path: string, body?: unknown, opts?: Omit<RequestOptions, 'method' | 'body'>) =>
        request<T>(path, { ...opts, method: 'PATCH', body }),
    delete: <T>(path: string, opts?: Omit<RequestOptions, 'method' | 'body'>) =>
        request<T>(path, { ...opts, method: 'DELETE' }),
};

export async function probeServer(
    serverUrl: string
): Promise<{ ok: boolean; version?: string; error?: string }> {
    const base = normalizeBaseUrl(serverUrl);
    try {
        const healthRes = await fetch(`${base}/api/v1/health`, {
            headers: { Accept: 'application/json' },
        });
        if (!healthRes.ok) {
            return { ok: false, error: `Server responded ${healthRes.status}` };
        }
        let version: string | undefined;
        try {
            const vRes = await fetch(`${base}/api/v1/version`, {
                headers: { Accept: 'application/json' },
            });
            if (vRes.ok) {
                const data = (await vRes.json()) as { version?: string };
                version = data?.version;
            }
        } catch {
            // version endpoint is optional for probing
        }
        return { ok: true, version };
    } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unable to reach server';
        return { ok: false, error: msg };
    }
}
