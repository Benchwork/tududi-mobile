import { ApiError } from './errors';
import type { LoginResponse } from '../types/tududi';

export interface LoginResult {
    user: LoginResponse['user'];
    token?: string;
    cookie?: string;
    csrfToken?: string;
}

function normalizeBase(serverUrl: string): string {
    return serverUrl.replace(/\/+$/, '');
}

/**
 * RN fetch on Android may merge multiple Set-Cookie headers into one comma-separated
 * string. We extract the `connect.sid=...` session cookie (the primary express session
 * cookie tududi sets) and return it as a single `name=value` string suitable for the
 * `Cookie` request header.
 */
function extractSessionCookie(setCookie: string | null | undefined): string | undefined {
    if (!setCookie) return undefined;
    // Match common express session cookies; fall back to first name=value pair.
    const preferred = setCookie.match(/(connect\.sid|tududi\.sid|session|sid)=[^;,]+/i);
    if (preferred?.[0]) return preferred[0];
    const first = setCookie.match(/^([^=]+)=([^;,]+)/);
    return first ? first[0] : undefined;
}

/**
 * Log in via email/password against the CSRF-exempt `/api/login` path.
 * Tududi's CSRF exemption in `backend/app.js` is an exact-match check that
 * includes only `/api/login`, not `/api/v1/login`, so we must use the
 * unversioned path here to avoid the lusca CSRF middleware.
 */
export async function performLogin(
    serverUrl: string,
    email: string,
    password: string
): Promise<LoginResult> {
    const base = normalizeBase(serverUrl);
    let res: Response;
    try {
        res = await fetch(`${base}/api/login`, {
            method: 'POST',
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify({ email, password }),
        });
    } catch (err) {
        const msg = err instanceof Error ? err.message : 'Network error';
        throw new ApiError(msg, 0, 'network');
    }

    if (!res.ok) {
        let body: unknown = null;
        try {
            body = await res.json();
        } catch {
            body = null;
        }
        // Tududi returns `{ errors: [msg] }` on 401, `{ error: msg }` on 400/403.
        const msgFromBody =
            (typeof body === 'object' && body
                ? ((body as { message?: string }).message ??
                  (body as { error?: string }).error ??
                  (Array.isArray((body as { errors?: unknown }).errors)
                      ? ((body as { errors: unknown[] }).errors[0] as string | undefined)
                      : undefined))
                : undefined) ?? undefined;
        const fallback =
            res.status === 401
                ? 'Invalid email or password'
                : res.status === 403
                  ? 'Access denied'
                  : `Login failed (${res.status})`;
        throw new ApiError(msgFromBody || fallback, res.status, 'login_failed', body);
    }

    const data = (await res.json()) as LoginResponse;
    const cookie = extractSessionCookie(res.headers.get('set-cookie'));
    // We don't expect a CSRF token from the login response itself; we fetch one
    // separately via getCsrfToken() before performing state-changing requests.
    return {
        user: data.user,
        token: data.token,
        cookie,
    };
}

/** Fetch a CSRF token for the authenticated session (cookie mode). */
export async function getCsrfToken(
    serverUrl: string,
    cookie: string
): Promise<string | undefined> {
    const base = normalizeBase(serverUrl);
    for (const path of ['/api/csrf-token', '/api/v1/csrf-token']) {
        try {
            const res = await fetch(`${base}${path}`, {
                headers: {
                    Accept: 'application/json',
                    Cookie: cookie,
                },
                credentials: 'include',
            });
            if (!res.ok) continue;
            const data = (await res.json()) as { csrfToken?: string };
            if (data.csrfToken) return data.csrfToken;
        } catch {
            // try next path
        }
    }
    return undefined;
}

/**
 * Verify an API key by hitting an authenticated endpoint. Bearer auth does not
 * send session cookies, so Tududi's session CSRF middleware is not applied.
 */
export async function verifyApiKey(serverUrl: string, token: string): Promise<void> {
    const base = normalizeBase(serverUrl);
    let res: Response;
    try {
        res = await fetch(`${base}/api/v1/current_user`, {
            headers: {
                Accept: 'application/json',
                Authorization: `Bearer ${token}`,
            },
        });
    } catch (err) {
        const msg = err instanceof Error ? err.message : 'Network error';
        throw new ApiError(msg, 0, 'network');
    }
    if (!res.ok) {
        throw new ApiError(
            res.status === 401 ? 'Invalid API key' : `Verification failed (${res.status})`,
            res.status
        );
    }
}

/**
 * Try to create a Bearer-compatible API key for the logged-in user so subsequent
 * requests can use Bearer auth (which bypasses CSRF on the server). Requires the
 * session cookie *and* a CSRF token. Returns null on any failure; callers should
 * fall back to cookie+CSRF session mode.
 */
export async function tryCreateApiKey(
    serverUrl: string,
    cookie: string,
    csrfToken: string | undefined,
    name: string
): Promise<string | null> {
    if (!csrfToken) return null;
    const base = normalizeBase(serverUrl);
    for (const path of ['/api/profile/api-keys', '/api/v1/profile/api-keys']) {
        try {
            const res = await fetch(`${base}${path}`, {
                method: 'POST',
                headers: {
                    Accept: 'application/json',
                    'Content-Type': 'application/json',
                    Cookie: cookie,
                    'X-CSRF-Token': csrfToken,
                },
                credentials: 'include',
                body: JSON.stringify({ name }),
            });
            if (!res.ok) continue;
            const data = (await res.json()) as {
                key?: string;
                token?: string;
                api_key?: { token?: string; key?: string };
            };
            const apiToken =
                data.token ?? data.key ?? data.api_key?.token ?? data.api_key?.key ?? null;
            if (apiToken) return apiToken;
        } catch {
            // try next path
        }
    }
    return null;
}
