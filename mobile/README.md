# HSC Skating · iOS / Android internal-test source

React Native / Expo SDK 58 application, not a WebView. Uses the same HSC server, roles and skater relationships as the web portal. Includes username/password registration, pending membership and invitation redemption, scoped group schedules, notifications, version-specific acknowledgements, coach instruction creation, English/Chinese and personal packing/arrival reminders.

## Run locally

Use the Node version required by Expo, then run from `mobile/`:

```text
npm ci
npm run typecheck
npm start
```

Open the development project on an iPhone or Android device using the supported Expo development workflow. There is no claim of device testing or store approval merely because JavaScript bundles export successfully. iOS native builds require macOS/Xcode or an approved cloud-build account; Android builds require Android tooling or an approved cloud-build account.

## Authentication and privacy

The fixed API origin is the existing HSC site. No hosting bypass key, password, signing secret or privileged API credential is embedded. Library-signed session tokens use Expo SecureStore and expire server-side. Web login cookies are not copied into the app. Invalid/revoked sessions clear local data and cancel this device's scheduled HSC alerts. Registration never approves membership. Email/account ownership must be confirmed with an administrator-issued, email-bound invitation. Existing SSO accounts need explicit dual-session linking in the web portal.

**The hosted site remains owner-private until internal testing is accepted and the owner explicitly approves opening its login/registration entry point. Mobile API requests cannot bypass that hosting gate.** A successful source export is not a live member release. Do not put the owner-only hosting bypass token into this application.

## Alerts

Registration requires username, password, requested role (skater/parent/coach), an exact HSC skater full name and a verification email. The server rejects names outside the administrator-approved, training-confirmed, identity-resolved club list before creating a password account. A match creates only a pending membership request, never an approved relationship. Historic competition candidates are not automatically eligible.

Unresolved starting-number ranges are alternative official time slots, not extra sessions. The shared API combines Carson's alternatives into Short and Free entries with blank start/end and `uncertain=true`; the app displays “Time to be confirmed” and the possible official slots separately. Only the corresponding program's published starting order can resolve a range. Device/server preparation reminders exclude uncertain sessions.

Personal rules are stored on the server. Arrival lead must be at least 60 minutes, and reminder lead at least another 60 minutes before arrival. The current server automation checks hourly. Only confirmed official group starts are eligible; uncertain groups and ambiguous/nonexistent DST clock times are excluded, and individual times/warm-up groups are never inferred.

The user explicitly opts into phone notification permission. The app reconciles up to 50 upcoming local alerts when refreshed or foregrounded. Packing and arrival details are hidden on the lock screen unless separately enabled. Sign-out cancels local HSC alerts. Local alerts depend on the last refreshed schedule; an offline phone cannot learn subsequent official changes. APNs/FCM remote push and email delivery are not configured. OS permission, device power management, notification limits and device settings may affect delivery. Verify permission, offline behaviour, revisions and sign-out on real iOS and Android phones before distribution.

## Distribution gate

`app.json` contains draft bundle identifiers; confirm club ownership, final identifiers, icon assets and distribution accounts before signing. `eas.json` defines development, internal preview (Android APK) and production profiles only; it does not create an EAS project, pay for a plan, upload code, produce a signed binary or submit to either store.

Before TestFlight/Play distribution: obtain owner-controlled Apple/Google/Expo accounts via official login, confirm any fees directly with the owner, complete privacy/child-user and account-deletion requirements, configure account recovery and any approved remote notification service, review dependency advisories, perform real-device acceptance, and obtain explicit release approval. Never ask the user to paste account passwords or signing keys into chat.
