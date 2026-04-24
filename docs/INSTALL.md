# Installing the Tududi Mobile alpha APK (Android)

The alpha build is distributed as a signed debug APK via GitHub Releases. iOS
TestFlight distribution is not yet available.

## 1. Prerequisites

- An Android device running Android 7.0 (API 24) or newer, with an **arm64-v8a**
  CPU (virtually every phone from 2017 onward).
- A running tududi server reachable from the phone. The quickest option is
  Docker:

  ```bash
  docker run -d --name tududi -p 3002:3002 \
      -e TUDUDI_ALLOWED_ORIGINS="http://<your-lan-ip>:3002" \
      -e TUDUDI_SESSION_SECRET="$(openssl rand -hex 32)" \
      chrisvel/tududi:latest
  ```

  Replace `<your-lan-ip>` with the IP your phone will use to reach the host
  (e.g. `192.168.1.20`). If you run tududi behind HTTPS, remember the scheme
  when entering the URL in the app.

## 2. Download the APK

1. Open the [Releases page](https://github.com/Benchwork/tududi-mobile/releases)
   on your phone.
2. Download the `tududi-<version>-arm64.apk` asset from the latest `v0.0.x`
   release.

## 3. Enable "Install unknown apps"

Android blocks sideloading by default. Once, after you tap the downloaded APK:

- Android 12+: *Settings → Apps → Special app access → Install unknown apps*,
  pick the browser or file manager you'll use, and enable the toggle.
- Android 8–11: a prompt appears automatically the first time you try to
  install.

## 4. Install

Tap the downloaded file and confirm *Install*. Google Play Protect may warn
that the app wasn't scanned; choose *Install anyway*. This is expected for
sideloaded debug builds.

## 5. First-run setup

1. Launch **Tududi**.
2. Enter your server URL (including `http://` or `https://` and port, e.g.
   `http://192.168.1.20:3002`). The app pings `/api/health` and `/api/version`
   to verify the connection.
3. Sign in with either:
   - **Email + password** — the app will automatically try to create a long-lived
     API key under the hood for a smoother experience.
   - **Personal API key** — generate one from *Settings → API Keys* in the
     tududi web UI and paste it into the *Use API key instead* screen.

That's it — your data pulls in and you can use the app offline from then on.

## Uninstall / reinstall

Because this is an unsigned debug build, upgrading to a newer alpha sometimes
fails with a signature-mismatch error. If that happens:

1. Back up anything important (sync so changes reach the server).
2. Uninstall **Tududi** from Android settings.
3. Install the new APK.

You will have to re-enter your server URL and credentials; local cached data is
reset on uninstall (this is Android's behaviour, not the app's).

## Troubleshooting

| Symptom | Fix |
|---|---|
| *"App not installed"* on install | Delete any previous tududi install first; debug signatures change between builds. |
| *"Unable to load script"* on launch | You have an old pre-v0.0.1 APK. Uninstall and install the current release. |
| *"Network request failed"* after entering server URL | The device can't reach the server. Verify the URL from the phone's browser first. Self-signed HTTPS is not supported in alpha. |
| *"Invalid email or password"* with correct credentials | Make sure `TUDUDI_ALLOWED_ORIGINS` includes the URL you entered; the backend rejects cross-origin login otherwise. |
| Changes don't appear on the web UI | Pull-to-refresh on the Today screen to trigger a sync, or check the *More* tab for the outbox queue size. |

## Reporting issues

Please file bugs at
<https://github.com/Benchwork/tududi-mobile/issues> and include:

- Your Android version and device model.
- The app version from *More → About* (or the APK filename).
- The tududi server version (from `GET /api/version`).
- Steps to reproduce and, if possible, a screenshot.
