# Changelog

All notable changes to Tududi Mobile are documented here. The project follows
[Semantic Versioning](https://semver.org/); until 1.0 both features and
breaking changes can land in minor/patch bumps.

## [0.0.8] - 2026-07-15

### Added
- **Local task reminders** via `expo-notifications`: enable under **More →
  Notifications**, set a default reminder time, and get alerts for due/overdue
  tasks. Tapping a notification opens the task.
- **Mark complete** control on the task detail screen.

### Fixed
- **Sync with Tududi 1.2.4+ (session login)**: refresh CSRF before writes and
  auto-create a bearer API key after password login to avoid `CSRF token missing`
  500 errors on task/inbox push.
- **Task push/pull**: server UID reconciliation, progressive create fallback,
  correct inbox process endpoint, and date/status field mapping for Tududi 1.2.
- **Today screen** now shows overdue and due-today tasks correctly (date-only
  due dates from the server were excluded by the old filter).
- **Task detail screen**: subtask add button no longer clipped off-screen; form
  and subtasks share one scroll view.

### Changed
- Android `versionCode` is now **8**.

## [0.0.3-alpha] - 2026-07-14

### Fixed
- Sync with **Tududi server 1.2.4+**: push now uses server UIDs for
  update/delete routes, maps task status and recurrence fields correctly, and
  merges pulled rows by server id to avoid duplicates.
- Pull requests all tasks via `type=all&status=all` (required by the 1.2 API).
- Sync errors from push/pull now surface in **More → Sync**.

### Added
- Shared **Inbox quick-capture** bar on Inbox and Today screens.
- **Inbox summary row** on Today (badge + tap to open inbox).
- Cross-platform **TextPromptModal** for new/rename prompts on Android.

### Changed
- Android `versionCode` is now **3**.

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
