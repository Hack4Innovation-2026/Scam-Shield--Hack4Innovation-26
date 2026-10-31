# Android app

The Android app is the same React frontend packaged with Capacitor, plus a native layer that scans incoming messages **in the background, even when the app is closed**.

## How background scanning works

```
Incoming WhatsApp / Telegram / Instagram / Gmail / SMS-app notification ─► NotificationListener ─┐
Incoming SMS broadcast ───────────────────────────────────────────────────► SmsReceiver ──────────┤
                                                                                                    ▼
                                                     MessageScanner (skip non-messages and duplicates)
                                                                                                    ▼
                                         ScanWorker (WorkManager: waits for network, retries)
                                                     │  POST /api/v1/analyze  (+ login token if signed in)
                                                     ▼
                                     risk ≥ 70 ─► high-priority "Possible scam" notification
                                                     │  tap ─► app opens on the full result
                                     app open ─► result appears in History + in-app banner
                                     app closed ─► kept on the device, added to History on next launch
```

| Component | File | Notes |
|---|---|---|
| Notification listener | `NotificationListener.java` | `NotificationListenerService`, kept bound by the system once the user grants **Notification access**. Scans known messaging apps, anything posted as a message or email, and third-party apps. Skips system apps (Android System, System UI, Settings…), ongoing/media/call/progress notifications, and the app's own alerts. |
| SMS receiver | `SmsReceiver.java` | `SMS_RECEIVED` broadcast (needs `RECEIVE_SMS`). Joins multi-part messages. Works even if the SMS app's notifications are muted. |
| De-duplication | `MessageScanner.java` | The same SMS usually arrives as a broadcast *and* a notification. Identical text within 2 minutes is scanned once. |
| Network call | `ScanWorker.java`, `ScanClient.java` | WorkManager job, so the request outlives the callback. Waits for connectivity, retries 3× with backoff, and allows 70 s for a sleeping free-tier server. On an expired login token it falls back to a guest scan. |
| Alert | `AlertNotifier.java` | `scam_alerts` channel, high importance. Each alert gets its own group, so Android never bundles them and every tap opens that alert's result. |
| Offline results | `BackgroundScanStore.java` | Results that finish while the app is closed are kept on the device (up to 100), and the app collects them into History on its next launch. |
| JS bridge | `ScamShieldPlugin.java` ↔ `src/native/nativeScanner.js` | `configure` (API URL + token), `getStatus`, permission requests, `scanResult` / `openResult` events. |

Background scans are sent with `metadata.channel = "background"` and the origin app, so the server stores `background: true` and `app`. **History** marks them with an **SMS · auto-scanned** or **Notification · auto-scanned** badge and has an *Auto-scanned* filter. The result screen shows the sender and original text. Signed-in users' background scans are saved to their account, so they also appear in the web app's history.

**Privacy.** Message text is sent only to the configured Scam Shield API. The server stores a PII-masked copy.

## Permissions

| Permission | Why | How it's granted |
|---|---|---|
| Notification access | read incoming message notifications | special access: the app opens *Settings → Notification access* |
| `RECEIVE_SMS` | scan SMS on arrival | runtime dialog |
| `POST_NOTIFICATIONS` (Android 13+) | show scam alerts | runtime dialog |
| `INTERNET` | call the API | automatic |

The permission screen shows the real state of each one and re-checks it when you return from Settings.

> **Google Play note:** apps that request SMS permissions must be the default SMS handler or qualify for an exception. For distribution through Play, drop `RECEIVE_SMS` and rely on notifications, which already cover SMS apps. For sideloaded or demo builds it works as is.

## Build

Prerequisites: Android Studio (for its JDK and the SDK), with the Android SDK Platform 36 and Build-Tools installed.

```powershell
cd frontend
# 1. Web assets, pointed at the API the device will use (see "Backend address")
$env:VITE_API_URL = "http://10.0.2.2:8000"; npx vite build
# 2. Copy them into the Android project
npx cap sync android
# 3. Build the APK (or open the project in Android Studio: npx cap open android)
cd android
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
.\gradlew assembleDebug
```
The APK is written to `frontend/android/app/build/outputs/apk/debug/app-debug.apk`.

`frontend/android/local.properties` must contain the SDK path. Write it with forward slashes, for example `sdk.dir=C:/Users/<you>/AppData/Local/Android/Sdk`: in this file a backslash is an escape character, so `D:\Claude` is read as `D:Claude`. Android Studio writes the file automatically when it opens the project; it is gitignored.

**Build fails with `Unable to establish loopback connection`:** Java can't use the Windows temp folder, usually because C: is full or the user name contains a space. Point Java at a short folder and build again:
```powershell
New-Item -ItemType Directory -Force D:\DevCache\tmp
$env:JAVA_TOOL_OPTIONS = "-Djdk.net.unixdomain.tmpdir=D:\DevCache\tmp -Djava.io.tmpdir=D:\DevCache\tmp"
```

## Backend address

The app calls the API at the address baked in at build time (`VITE_API_URL`), and the background scanner receives the same address through `configure`.

| Device | `VITE_API_URL` | Notes |
|---|---|---|
| Android emulator | `http://10.0.2.2:8000` (default) | `10.0.2.2` is the emulator's alias for the PC's localhost |
| Phone on the same Wi-Fi | `http://<PC's LAN IP>:8000` | start the backend with `--host 0.0.0.0` and allow port 8000 in Windows Firewall. Debug builds allow plain HTTP for this. |
| Anywhere | `https://<service>.onrender.com` | after deploying the backend ([DEPLOYMENT.md](DEPLOYMENT.md)) |

Release builds allow plain HTTP only to `10.0.2.2` and `localhost`; everything else must be HTTPS (`res/xml/network_security_config.xml`).

## Testing on the emulator

```powershell
$adb = "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe"   # or <your SDK folder>\platform-tools\adb.exe
& $adb install -r app\build\outputs\apk\debug\app-debug.apk

# grant everything without tapping through Settings
& $adb shell cmd notification allow_listener com.scam.shield/com.scam.shield.NotificationListener
& $adb shell pm grant com.scam.shield android.permission.RECEIVE_SMS
& $adb shell pm grant com.scam.shield android.permission.POST_NOTIFICATIONS

# simulate an incoming scam SMS (works with the app closed)
& $adb emu sms send 5551234 "URGENT: Your SBI account is blocked. Update KYC now at http://sbi-kyc-update.xyz"

# simulate a messaging-app notification
& $adb shell cmd notification post -S bigtext -t "VM-SBIBNK" scamtest "Your account will be suspended. Verify immediately at http://bit.ly/secure-acc"

# watch the scanner
& $adb logcat -s ScamShield
```
