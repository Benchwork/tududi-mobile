# Tududi API integration notes

These notes document where the mobile app deviates from or probes the live tududi server (`chrisvel/tududi`, backend in `/backend`). Keep them up to date as findings change.

## Confirmed

- Base path: `/api/v1` (backwards-compatible alias `/api`). See `backend/app.js` `registerApiRoutes`.
- Public endpoints (no auth required): `POST /api/v1/login`, `GET /api/v1/health`, `GET /api/v1/version`, `/api/v1/oidc/*`, `/api/v1/feature-flags/*`.
- Authentication modes:
  - Session cookie (`connect.sid`) with 30-day expiry, with CSRF via `lusca` on state-changing methods.
  - Bearer token (`Authorization: Bearer <token>`), which **bypasses CSRF** (see `backend/app.js` `_csrfExempt` logic).
- CORS allows `Authorization`, `X-CSRF-Token`, etc., and credentials are permitted when origin is whitelisted via `TUDUDI_ALLOWED_ORIGINS`.
- Entity model matches `backend/config/swagger.js` — `Task`, `Project`, `Area`, `Note`, `Tag`, `InboxItem`, plus `ApiKey`.

## To verify on first run against a live server

The M1 spike should exercise these from the app and document actual responses:

1. **API-key creation after password login**. We call `POST /api/v1/api_keys` with the fresh session cookie + CSRF token. If the server returns a usable bearer token, we switch to bearer mode and discard the cookie. If the endpoint returns 404, we stay in cookie mode and send `X-CSRF-Token` on writes.
2. **Incremental pull via `updated_since`**. We send `?updated_since=<iso>` on list endpoints. If the server ignores it, we still get full lists (just slower) and diff locally on `updated_at`.
3. **Exact shape of `GET /tasks`**. The code tolerates `[]`, `{ items }`, `{ tasks }`, `{ data }`, `{ results }` (see `coerceList` in `src/api/endpoints.ts`). Narrow this down once confirmed.
4. **Create/update endpoints**: singular (`POST /task`) vs plural (`POST /tasks`). We currently POST to `/task` (singular) which matches the pattern seen in the README example (`POST /api/v1/task`). Confirm and adjust `src/api/endpoints.ts`.
5. **Subtasks**: whether they're returned inline on `GET /task/:id` or require `GET /task/:id/subtasks`. We assume the latter and also rely on `parent_task_id` on each task row.

## Known mismatches / fallbacks

- The swagger `RecurringPattern` enum lists `daily | weekly | monthly | yearly`, but the README mentions `monthly_weekday` and `monthly_last_day`. We accept all variants in our Zod schema (`src/types/tududi.ts`). If the server rejects the extended values, the outbox will show the error and we'll narrow the UI options.
- Search endpoint shape is not in `swagger.js`; we currently do a fully local search over cached data and skip hitting `/search` for the MVP. A network-backed search can be layered on later.
- OIDC login is intentionally deferred — the login screen only supports email/password and API-key paths.
