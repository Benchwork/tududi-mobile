# Changelog

All notable changes to Tududi Mobile are documented here. The project follows
[Semantic Versioning](https://semver.org/); until 1.0 both features and
breaking changes can land in minor/patch bumps.

## [0.0.1-alpha] - 2026-04-23

First public alpha of the Tududi mobile client. Android-only for now.

### Added
- Expo + TypeScript app with `expo-router` navigation and a light/dark theme.
- Typed API client with Bearer-token and session-cookie auth modes, CSRF
  handling, and automatic error mapping.
- Server-URL onboarding that probes `/api/health` and `/api/version` before
  accepting the URL.
- Email/password login plus personal API-key login; passwords are never
  persisted, the app upgrades to a bearer token under the hood when possible.
- Full offline-first local SQLite store for tasks, projects, areas, notes,
  tags, subtasks, and the inbox, plus a mutation outbox that retries on
  reconnect.
- Today screen with overdue + today grouping and an **inline quick-capture**
  input at the top.
- Tasks list with status/filter/sort, pull-to-refresh, and swipe actions.
- Full task editor with due date, priority, project, tags, subtasks, and a
  recurring-task editor (daily / weekly / monthly / yearly + weekday rules).
- Projects, Areas, Notes, Tags detail screens with relationship management.
- Global search over locally cached data.
- Inbox quick-capture plus share-to-inbox intent (Android SEND handler).
- Offline banner, background sync via `expo-background-fetch`, and outbox
  stats in *More → Sync*.
- i18n scaffolding, settings for theme preference.

### Notes
- `versionCode` is `1`; future releases will bump this by one for every
  Android build.
- Distributed as an **arm64-v8a debug APK** (~60 MB) because release builds
  currently trip a Windows MAX_PATH issue in `react-native-reanimated`'s CMake
  step. Release/EAS builds will follow.
- Logging out no longer wipes the local cache; it just returns you to the
  login screen with the server URL remembered.
