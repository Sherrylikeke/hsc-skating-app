# Email verification setup

New self-service accounts require a listed skater name and a verified email address. They receive no session until verification succeeds and they sign in. The verification flow uses Better Auth signed links with a one-hour expiry and a rate-limited resend endpoint. Matching a name, choosing homepage skaters and verifying an email do not grant membership roles, private notes, messages or administrator access.

The mail adapter is prepared for Resend's HTTPS API. No provider account, domain, payment or real delivery has been configured or performed. Until setup is complete, new self-service registration returns a clear setup-pending response before creating an account. Existing accounts retain sign-in, and the existing owner can continue using their current administrator session and verified identity. Existing administrator credential linking remains available. No existing user is marked verified by deployment.

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
