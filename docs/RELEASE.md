# Release guide

## Prerequisites

```bash
npm install -g eas-cli
eas login
```

Initialize the project (one-time):

```bash
eas init --id <uuid-from-expo-dashboard>
```

## Development build

```bash
eas build --profile development --platform all
```

Install the resulting build on your device to iterate with `npx expo start --dev-client`.

## Preview builds (internal testers)

- Android APK distributable:

  ```bash
  eas build --profile preview --platform android
  ```

- iOS for TestFlight internal testers:

  ```bash
  eas build --profile preview --platform ios
  ```

## Production

```bash
eas build --profile production --platform all
eas submit --profile production --platform ios
eas submit --profile production --platform android
```

`autoIncrement` is enabled for production, so version codes/build numbers are bumped automatically.

## Store metadata

Place the following in `/store/`:

- iOS: `Store description`, `Keywords`, `Privacy policy URL`, `Support URL`, screenshots (6.7", 5.5", iPad 12.9").
- Android: Short description, Full description, Privacy policy URL, feature graphic (1024x500), 1080x1920 screenshots.

## OTA updates

After the first binary release, publish JS-only updates with:

```bash
eas update --branch production --message "Bugfix"
```

## Testing checklist before release

- [ ] Cold start with no network → UI loads cached data, shows offline banner.
- [ ] Create / edit / complete / delete a task while offline, reconnect → changes push.
- [ ] Log out / log in with password against a real tududi Docker instance.
- [ ] Log in with API key.
- [ ] Create a task via the Share sheet from another app (Android).
- [ ] Background fetch runs (enable in dev via `expo-background-fetch` helper).
- [ ] Light and dark themes.
