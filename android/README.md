# Spectra CRM for Android

One signed APK serves both admins and employees. It opens the live HTTPS CRM at `https://spectrapackmachines.com/admin/leads`; the existing server login and role checks determine access. The app contains no account passwords, Supabase credentials, or advertising tokens.

Android 8.0 or newer and an internet connection are required. An updated Android System WebView or Chrome should be installed. This is an online companion to the existing CRM, not an offline copy of customer records. Server UI updates appear without rebuilding the APK.

## Included

- Existing admin and employee sign-in, with normal logout and session cookies.
- Responsive CRM, lead details, notes, follow-ups, assignments and team management according to role.
- Phone dialler, WhatsApp and email links open the appropriate phone app.
- CSV/Excel import through Android's document picker. CSV/blob exports and authenticated downloads use Android's Save dialog.
- Back closes CRM dialogs/navigation before navigating away; reload, loading indicator and connection retry UI.
- HTTPS origin restrictions, cancelled SSL errors, no JavaScript interface, no third-party cookies, no Android backup, and no phone/storage/camera permissions. Export messaging is scoped to the live CRM's main-frame origin and a per-page nonce.

## Build on Windows

Install a JDK (tested with Java 21), PowerShell 7 and Node.js. From the repository root run:

```powershell
pwsh -File scripts/build-android.ps1
```

The script downloads checksum-verified official Android SDK platform 36 and build tools 36.0.0 into `.toolchains/` if missing. It runs navigation/export checks, compiles Java/resources, creates DEX, aligns, signs and verifies the APK. There are no Maven, Gradle or third-party app dependencies. Google's SDK licenses are included in the downloaded archives.

Output: `artifacts/android/Spectra-CRM-1.0.0.apk` and its SHA-256 checksum.

The private release identity is generated once in `.android-signing/` and is excluded from Git and the APK. Keep that directory private and backed up: updates to this installed app must reuse the same signing key and increase the manifest version code. Do not distribute its password file or keystore with the APK.

## Verification

Automated checks cover the allowed HTTPS origin, blocked lookalike/user-info/path-traversal URLs, external contact links, safe export names, CSV capture before immediate blob URL revocation, and export-channel isolation. The build verifies APK signatures and Android package metadata. Device testing, when a device/emulator is available, should cover login, logout, employee lead scope, call/WhatsApp links, import/export, keyboard/insets, back and reconnect. Synthetic tests do not replace testing on the user's phone.
