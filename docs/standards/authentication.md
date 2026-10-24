# Authentication and user management

Applies to private webapps and the authenticated part of combined projects using the [project baseline](../sops/project-instantiation.md). Site-only projects do not need accounts or auth secrets. Public pages remain public; their protected actions still require server-side authorisation. The Express API owns Better Auth in combined projects; do not create a second session system in Next.js.

## Standard implementation

Use Better Auth with its passkey plugin and Prisma/PostgreSQL persistence. Better Auth owns authentication ceremonies, credentials and sessions; application services own bootstrap, invitation lifecycle and business permissions. Do not build a second authentication/session system alongside it.

Default to passkey sign-in, with no public sign-up, password login, magic-link fallback or required outbound email service. Required client SSO/OAuth may be added as a documented project exception. Keep email as account identity/contact information; possessing an admin-shared invite link does not independently prove mailbox ownership.

Pin compatible Better Auth, passkey plugin and Prisma versions. Use the Prisma adapter and include all auth/plugin tables in reviewed Prisma migrations. Follow the installed version's supported APIs; generating auth schema is a development step, not a runtime schema-sync mechanism. The [Better Auth passkey documentation](https://better-auth.com/docs/plugins/passkey) describes session-based and authorised pre-authentication registration. Registration hooks are not a substitute for enforcing the lifecycle rules below.

Use HTTPS in production, secure HTTP-only session cookies, appropriate SameSite behaviour and explicit trusted origins. Prefer one browser origin with API routes under `/api` and a Vite development proxy. Derive the passkey relying-party ID from the configured canonical hostname unless a documented multi-subdomain requirement needs a distinct value. Do not derive trust from arbitrary Host or forwarded headers.

Check sessions and permissions on every protected API operation, including direct Better Auth administrative endpoints. Role controls in the UI are not enforcement. Disable unneeded plugin capabilities such as impersonation; map any internal default role to the application role `member`, and never accept role fields from unauthorised clients.

## First-user bootstrap

The sign-in screen exposes **Create first admin** only when the server reports that bootstrap is available: there are no completed users and setup has never been completed. It asks for **name**, **email**, and **first-user token**, then walks the person through creating their passkey.

- Configure a cryptographically random `FIRST_USER_TOKEN` as a server-only environment secret. Do not preconfigure the first user's name/email or expose the token to frontend bundles, telemetry, logs or URLs.
- Validate name/email and the token on the server. Require the token before issuing a registration grant. Rate-limit bootstrap attempts and use safe token comparisons and nonrevealing error messages.
- Issue a short-lived, purpose-bound registration grant for the selected identity. It authorises only passkey registration, not normal application access or arbitrary user creation.
- After successful passkey verification, atomically activate the first **admin**, save the credential, consume the grant and record durable bootstrap completion. A singleton setup record plus a database transaction/lock must enforce at most one completed bootstrap across simultaneous requests and application instances.
- If the library requires a provisional user before registration, keep it explicitly pending and without a normal session. A cancelled or failed ceremony must remain retryable with valid credentials; stale pending rows must not permanently block setup or allow a second active admin to bootstrap.
- Recheck bootstrap eligibility and grant validity during final verification, not only when options are issued. A transaction or equivalent proven concurrency strategy must cover the library writes and application lifecycle changes. Do not assume independent callback writes are atomic.
- Create the regular session only after successful activation. Invalid, expired, cancelled or replayed ceremonies do not consume the successful-use opportunity or grant access.
- Once completed, bootstrap stays disabled across restarts, redeployments, token changes and user deletions. Removing `FIRST_USER_TOKEN` afterward is recommended; a completed installation must start without it. An unused token is required only while setup is incomplete.

No additional sole-admin recovery feature or recovery CLI is required by this baseline. Operators own exceptional manual recovery. A redeploy using the same database preserves bootstrap completion and does not restore lost passkeys or reopen setup.

## Invitations

Admins add users in **Settings → Users** by entering name and email, with role defaulting to `member`. The result is an invited account and a prominently displayed invite link with a **Copy invite link** action and clear copy-success/failure feedback. Manual sharing is sufficient; email delivery is optional project scope.

Use high-entropy, single-use invite tokens bound to one user, purpose and expiry. Store only a hash; show plaintext only when generating a link. Default expiry is seven days, defined in code rather than an environment variable. Display the expiry to the admin. Once a link is no longer available in the UI, generating another replaces it rather than retrieving the secret from storage.

Opening a link shows the intended identity and starts passkey enrolment. Merely loading the link must not consume it, including when a link-preview service visits it. The recipient cannot change the invited email, user ID or role. After successful credential verification, atomically activate the user and consume the invite before issuing a normal session. Enforce the same concurrency and pending-registration protections used for bootstrap.

Expired, revoked, used and malformed links show a useful message directing the person to an admin. Keep bearer tokens out of logs/referrers/analytics; avoid third-party content on enrolment screens and remove the token from the browser URL after exchanging it for a constrained grant. Do not cache token-bearing responses.

## Settings → Users actions

| Action | Required behaviour |
| --- | --- |
| Add user | Name, email, role (`member` by default); create invite and copyable link |
| Change role | Switch between `member` and `admin`; enforce permission on server |
| Re-invite pending user | Replace invite; invalidate older links and in-progress grants |
| Reset passkey access | Confirm impact; revoke all passkeys, sessions and previous enrolment grants; issue a replacement invite for the same identity |
| Delete user | Confirm impact; revoke sessions, credentials and invitations; remove access while preserving required historical business/audit records |

Do not allow deletion or demotion of the last active admin, including racing requests. Do not let an admin reset their own only authentication path through Users; ordinary signed-in passkey management can add replacements. Permission changes must take effect on subsequent protected requests; invalidate cached sessions/roles when necessary. A deleted or recovering account cannot continue using a stale session.

Re-inviting a pending user and resetting an active user's lost passkeys are distinct actions, with different confirmation wording. An ordinary re-invite must not silently revoke an active person's credentials. Recovery maintains the existing user's identity and business history.

Provide every signed-in user with a user coin/account menu, ideally near the bottom of navigation, linking to passkey creation/management and logout as defined by the [UI standard](application-ui.md#user-coin-and-account-actions). Use Better Auth for these credential/session operations. Require a valid session for self-service and enforce credential ownership on the server. Prevent removing the last usable passkey without a replacement, including concurrent removal requests. Logout must invalidate the current server session and clear client authentication state; navigating back must not restore access.

Record who performed administrative access changes, which account was affected, the action and time. Never include raw tokens, credentials or session secrets in audit events. User deletion semantics and retention of attributed business records must be documented per project.

## Acceptance coverage

Cover the complete happy paths for bootstrap, sign-in, invite enrolment, role changes, re-invitation, lost-passkey reset, deletion, self-service passkey management and logout. Test unauthorised direct API access, role escalation attempts, mismatched identity, expired/used/revoked tokens, session revocation, last-admin protection, attempts to manage another user’s credentials, last-passkey protection and post-logout access rejection.

Use database-backed integration tests for concurrent bootstrap/invite consumption, cancelled ceremonies, stale grants, restart persistence and role/deletion races. Browser fake clocks do not advance backend token expiry: use controlled server time or isolated expired records for those tests. Preserve real WebAuthn verification coverage with supported virtual authenticators or a documented integration harness; do not replace it entirely with mocked sessions.
