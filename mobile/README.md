# HSC Skating · iOS / Android internal-test source

React Native / Expo SDK 58 application, not a WebView. Uses the same HSC server as the web portal. Includes email/username/password sign-in, name-list registration with immediate shared schedules, English/Chinese and optional approved private roles for notifications, acknowledgements, coach instructions and preparation reminders.

**Latest login policy:** the sign-in form comes first, uses email or username plus password, and requires no ChatGPT account. Registration checks only that the supplied skater name exists in the current roster (base list plus club-edited names), not admission/training/identity approval flags. A match immediately creates a `club-viewer` account with shared official schedule access and pinned name preferences, but no verified private relationships or coach/admin privileges. Duplicate names can qualify for shared schedules; they never prove which person is registering. Ordinary email ownership is not marked verified.

## Run locally

Use the Node version required by Expo, then run from `mobile/`:

```text
npm ci
npm run typecheck
npm start
```

Open the development project on an iPhone or Android device using the supported Expo development workflow. There is no claim of device testing or store approval merely because JavaScript bundles export successfully. iOS native builds require macOS/Xcode or an approved cloud-build account; Android builds require Android tooling or an approved cloud-build account.

## Authentication and privacy

The fixed API origin is the existing HSC site. No hosting bypass key, password, signing secret or privileged API credential is embedded. Library-signed session tokens use Expo SecureStore and expire server-side. Web login cookies are not copied into the app. Invalid/revoked sessions clear local data and cancel this device's scheduled HSC alerts. Name-list registration enables shared schedules immediately. Private role/relationship access still needs club verification and an email-bound invitation; existing privileged accounts are never merged by self-reported email alone.

**The hosted site remains owner-private until internal testing is accepted and the owner explicitly approves opening its login/registration entry point. Mobile API requests cannot bypass that hosting gate.** A successful source export is not a live member release. Do not put the owner-only hosting bypass token into this application.

## Alerts

Approved, verified members can read the whole club's official schedules and public competition records. Their linked skaters are pinned first; teammates follow for club support. Shared schedule rows do not include another skater's private coach plans. Message, receipt, reminder, relationship and write permissions remain scoped. The app's instruction/automatic-reminder selectors use server-authorized private skater IDs, not the shared roster.

Registration requires username, password, requested role (skater/parent/coach), a skater name found in the current list and the user's email. The server rejects an absent name before creating the password account. Admission and training/identity review flags do not block shared-schedule registration. Private relationships are never inferred from the match.

Unresolved starting-number ranges are alternative official time slots, not extra sessions. The shared API combines Carson's alternatives into Short and Free entries with blank start/end and `uncertain=true`; the app displays “Time to be confirmed” and the possible official slots separately. Only the corresponding program's published starting order can resolve a range. Device/server preparation reminders exclude uncertain sessions.

Personal rules are stored on the server. Arrival lead must be at least 60 minutes, and reminder lead at least another 60 minutes before arrival. The current server automation checks hourly. Only confirmed official group starts are eligible; uncertain groups and ambiguous/nonexistent DST clock times are excluded, and individual times/warm-up groups are never inferred.

The user explicitly opts into phone notification permission. The app reconciles up to 50 upcoming local alerts when refreshed or foregrounded. Packing and arrival details are hidden on the lock screen unless separately enabled. Sign-out cancels local HSC alerts. Local alerts depend on the last refreshed schedule; an offline phone cannot learn subsequent official changes. APNs/FCM remote push and email delivery are not configured. OS permission, device power management, notification limits and device settings may affect delivery. Verify permission, offline behaviour, revisions and sign-out on real iOS and Android phones before distribution.

## Distribution gate

`app.json` contains draft bundle identifiers; confirm club ownership, final identifiers, icon assets and distribution accounts before signing. `eas.json` defines development, internal preview (Android APK) and production profiles only; it does not create an EAS project, pay for a plan, upload code, produce a signed binary or submit to either store.

Before TestFlight/Play distribution: obtain owner-controlled Apple/Google/Expo accounts via official login, confirm any fees directly with the owner, complete privacy/child-user and account-deletion requirements, configure account recovery and any approved remote notification service, review dependency advisories, perform real-device acceptance, and obtain explicit release approval. Never ask the user to paste account passwords or signing keys into chat.
