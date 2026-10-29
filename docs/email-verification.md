# Email verification setup

Ordinary self-service accounts require a listed skater name and a verified email address. They receive no session until verification succeeds and they sign in. The verification flow uses Better Auth signed links with a one-hour expiry and a rate-limited resend endpoint. Matching a name, choosing homepage skaters and verifying an email do not grant membership roles, private notes, messages or administrator access.

The mail adapter uses Resend's HTTPS API. The account and secret were configured on 2026-10-27, and one authorized self-addressed test was reported Delivered; a production sender domain is still pending. Until sender setup is complete, ordinary new self-service registration returns a clear setup-pending response before creating an account. Existing accounts retain sign-in, and the existing owner can continue using their current administrator session and verified identity. Existing administrator credential linking remains available. No existing user is marked verified by deployment.

## Invited pilot registration (2026-10-29)

The user authorized a public login page and self-registration through personal invitation links without ChatGPT/Sites login or HSC verification mail. Configure `HSC_PILOT_REGISTRATIONS` as a Sites secret containing `{email,role,invitationHash,expiresAt}` entries; accepted roles are parent, coach and skater. Generate each 32-byte random token outside source, store only its SHA-256 digest in runtime configuration, and deliver the raw token only in the private invitation link. Never put real entries or raw tokens in source, client bundles or Git. The link uses the URL fragment so the token is not included in the initial HTTP request or Referer; the form removes the fragment and checks the token with a same-origin, rate-limited POST.

This exception applies only while mail delivery is disabled, the link is unexpired and unused, and the requested email/role match the server grant. An email, spoofed identity header, role field or plain public URL is insufficient. Successful registration records the digest as used in existing `app_meta`; no database migration is needed. Failed form validation does not consume the link, and existing accounts cannot be overwritten through it. Anonymous GET configuration exposes no invitation recipient or digest. Before changing Site access to public, validate that club data, private plans, account administration, official sync and MCP remain protected by application authentication.

Invited users choose their own username and password and still provide a listed skater name. Registration creates a `club-viewer` with the configured requested role, no private role or relationships, and `email_verified=false`. The server returns a pilot-registration response header so the form can sign in after creation without requesting an already consumed invitation or showing an email-verification panel. Existing administrator linking is preserved. Removing the runtime list closes this registration exception; existing accounts remain subject to normal account/session controls. Turning on real verification later requires these unverified pilot accounts to verify before ordinary sign-in.

The isolated core regression covers the actual runtime callback with no platform identity, email and username login, no outgoing requests, unchanged unverified status, single use, failed-password retry, role/email mismatch, expiry, cross-site requests, anonymous protected endpoints, direct-header spoof attempts and removal of the list. Anonymous production checks must be performed again after changing the outer access policy; do not consume a real tester invitation merely to test.

## User actions before activation

1. Choose and register a mail provider account. If using this adapter, use Resend. Provider registration, any charges and domain purchase must be performed by the user.
2. Select a sender domain the user controls and complete the provider's DNS verification. The hosted `chatgpt.site` address is not a user-owned sender domain. Set an approved sender address.
3. Create a sending API key and configure it through the Sites secure runtime-variable interface. Do not paste secrets into chat, Git, source files or the hosting manifest.
4. Configure the existing Site's `RESEND_API_KEY` and `HSC_EMAIL_FROM`, then set `HSC_EMAIL_VERIFICATION_ENABLED=true` only after sender setup is complete. Partial configuration leaves delivery and new registration disabled. No settings are created automatically.
5. With explicit permission for real sending, test one controlled recipient: register, inspect inbox/spam, open the link, sign in, resend and test expiry. Confirm the original administrator can still sign in before inviting other users.

Web and Expo clients show verification/resend guidance. Verified links return to `/verify-email`; both email and username sign-in enforce verification once delivery is enabled. Pre-existing unverified non-administrator sessions also lose access until verified. Existing linked administrator accounts retain a recovery path. Email verification grants no private role or relationship.

The source regression suite uses only an in-memory D1 database and a capture-only delivery adapter. Provider success, failure, timeout configuration, signed links, invalid/expired links, resend throttling and old-account login are checked without contacting a provider. Real deliverability and provider DNS/account setup remain unverified.

If mail delivery fails after account creation, its schedule-only membership is retained so the user can retry the resend flow. The account remains unverified and cannot sign in while verification is required. Email is sent only on registration/resend, never by the existing official-source hourly sync.

References: [Better Auth email/password](https://better-auth.com/docs/authentication/email-password), [Resend send-email API](https://resend.com/docs/api-reference/emails/send-email).
