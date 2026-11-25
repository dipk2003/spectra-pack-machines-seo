# Spectra CRM for Android

One signed APK serves both admins and employees. It opens the live HTTPS CRM at `https://spectrapackmachines.com/admin/mobile`; the existing server login and role checks determine access. The app contains no account passwords, Supabase credentials, or advertising tokens.

Android 8.0 or newer and an internet connection are required. An updated Android System WebView or Chrome should be installed. This is an online companion to the existing CRM, not an offline copy of customer records. Server UI updates appear without rebuilding the APK.

## Included

- Existing admin and employee sign-in, with normal logout and session cookies.
- App-style mobile lead cards, search, follow-ups, work history and profile tabs; full-screen customer details, notes and assignments according to role. The full desktop workspace remains available.
- Phone dialler, WhatsApp and email links open the appropriate phone app.
- CSV/Excel import through Android's document picker. CSV/blob exports and authenticated downloads use Android's Save dialog.
- Back closes CRM dialogs/navigation before navigating away; reload, loading indicator and connection retry UI.
- HTTPS origin restrictions, cancelled SSL errors, no JavaScript interface, no third-party cookies, no Android backup, and no call-log/storage/camera permissions. Native messaging is scoped to the live CRM's main-frame origin and a per-page nonce.
- Optional coarse/fine location permission. Updates run only while the app is in the foreground and the employee has enabled sharing. Leaving the app removes location updates immediately; no service or background-location permission exists.
- Account activity and launch attempts are visible only to the exact developer owner after the existing PIN gate. Contact outcomes are clearly employee reported. No call recording, call-log reading, WhatsApp inbox reading or message-content monitoring is included.

Deploy `supabase/migrations/20261125_crm_work_visibility.sql` and the matching web release before distributing version 1.1. The server keeps only the latest location fix, hides it after two minutes or a background/disabled update, clears expired fixes on its daily maintenance run, and retains device events for 30 days. Lead work records follow the existing CRM history. GPS and client events are device reports, not proof of attendance or a completed conversation.

## Build on Windows

Install a JDK (tested with Java 21), PowerShell 7 and Node.js. From the repository root run:

```powershell
pwsh -File scripts/build-android.ps1
```

The script downloads checksum-verified official Android SDK platform 36 and build tools 36.0.0 into `.toolchains/` if missing. It runs navigation/export checks, compiles Java/resources, creates DEX, aligns, signs and verifies the APK. There are no Maven, Gradle or third-party app dependencies. Google's SDK licenses are included in the downloaded archives.

Output: `artifacts/android/Spectra-CRM-1.1.0.apk` and its SHA-256 checksum.

The private release identity is generated once in `.android-signing/` and is excluded from Git and the APK. Keep that directory private and backed up: updates to this installed app must reuse the same signing key and increase the manifest version code. Do not distribute its password file or keystore with the APK.

## Verification

Automated checks cover the allowed HTTPS origin, blocked lookalike/user-info/path-traversal URLs, external contact links, safe export names, CSV capture before immediate blob URL revocation, native channel isolation, foreground filtering and minimal Android permissions. `scripts/verify-work-visibility.ts` checks location validation; `scripts/verify-work-e2e.mjs` uses a privately supplied company test login to exercise authentication, scoped reporting, RLS, consent, pause races and duplicate requests. It deletes only its own synthetic device records. The build verifies APK signatures and Android package metadata. Device testing, when a device/emulator is available, should cover login, logout, employee lead scope, call/WhatsApp/email apps, permissions, foreground/background, import/export, keyboard/insets, back and reconnect. Synthetic tests do not replace testing on the user's phone.
