# Application UI

Every authenticated webapp, including the private part of a combined project, includes Settings, a user coin, Documentation and Codename attribution. Site-only projects use public navigation and footer attribution; do not add private app controls without authenticated features. Use the [standard frontend stack](../sops/project-instantiation.md#frontend-architecture), with accessible desktop and mobile layouts.

## Settings navigation

Settings must include the sections below. The layout is project-specific; make the sections accessible on desktop/mobile and support keyboard navigation and direct links.

Required sections:

- **Users:** admin-only user administration from the [authentication standard](authentication.md#settings--users-actions).
- **System:** read-only information identifying the running build.

Use stable routes such as `/settings/users` and `/settings/system`, beneath the private app base (`/admin` in the default combined topology). Members can view System but must not see Users controls or access its protected API. Other sections are added only for implemented project features; do not scaffold unrelated integrations, workspace preferences or empty settings panels.

### Users

Present each user's name, email, role and state (invited, active, or awaiting renewed passkey enrolment). Provide add-user, role-change, copy-invite, re-invite, reset-passkey and delete actions with clear loading, empty, error and success states. Explain consequential actions before confirmation. Enforce access rules on the server and keep the view usable on mobile.

### System

Show exactly these baseline fields in a read-only details table:

| Detail | Meaning | Example |
| --- | --- | --- |
| Version | Application semantic version | `1.4.2` |
| Release Tag | Git tag used for the release | `v1.4.2` |
| Build Commit | Source commit used to build the artefact | Full SHA, optionally shortened visually with copy support |
| Build Time | Time the artefact was built | ISO timestamp in UTC, optionally with a labelled local display |

Generate these values during the build and embed them in the image/application. The shared workflow supplies `RELEASE_VERSION`, `RELEASE_TAG`, `GIT_SHA` and `BUILD_TIME` as build arguments; map them to the four fields. They are not runtime settings and do not belong in the manually maintained `.env` file.

Use one authoritative metadata artefact so API and UI agree. Production release builds must validate version/tag consistency, a full commit SHA and a valid timestamp. Local builds may show `development`, `unreleased` or `unknown` honestly; never invent a release tag or use process start time as build time. Redeploying the same image must preserve its build information.

## User coin and account actions

Provide a visible **user coin** (avatar or initials account button) for every signed-in user, ideally near the bottom of the sidebar/navigation. Include an equivalent control on mobile. It opens an accessible account menu or panel showing the signed-in identity and offering:

- **Passkeys:** create additional passkeys and manage existing ones using Better Auth. Show recognisable credential labels and support removing a passkey with confirmation; preserve the last usable passkey until a replacement exists.
- **Log out:** end the current server session, clear client auth state and return to sign-in. Protected pages and API calls must require authentication afterward.

Use an accessible name such as “Account menu”, keyboard activation, visible focus and predictable focus return when dismissed. Account actions belong to every member/admin, independent of admin-only Users settings. Placement near the bottom is preferred; no specific surrounding panel layout or three-button arrangement is required.

## Produced by Codename

Place a compact **Produced by Codename** attribution at the bottom of the application sidebar, below navigation and any account area that exists. Include it in the mobile navigation surface as well. It must remain in normal sidebar layout, not float over content or obscure controls on short screens. Public pages without a sidebar may use their normal footer.

Use the bundled [Codename wordmark](https://github.com/codename-systems/codename-project-sops/blob/9335fad26de93124a891f6c6544bb388aa366084/assets/branding/codename-logo-acid-dark.svg), copied into the application's static assets. The presentation is a dark charcoal card with a subtle border and rounded corners, small muted uppercase “Produced by” text on the left and the light/acid Codename wordmark on the right. Keep the wordmark's aspect ratio and original colours. Approximate baseline: 12 px horizontal padding, 10 px vertical padding and a wordmark width of 104 px, capped to fit its container.

Link to [Codename](https://codename.au/) in a new tab using `rel="noopener noreferrer"`, with the accessible name “Produced by Codename”. Provide clear hover/focus states, adequate text contrast and a visible keyboard focus indicator. Do not load the logo from a remote application or require another repository to implement this component.

The [React component template](https://github.com/codename-systems/codename-project-sops/blob/9335fad26de93124a891f6c6544bb388aa366084/templates/project/CodenameAttribution.tsx) implements this treatment. Copy it and the asset locally, then integrate it into the project's layout. Keep the required user coin/account actions above the attribution when they share a sidebar; the remaining panel design is project-specific.

## Documentation navigation

Include a visible **Documentation** item in the main sidebar and mobile navigation. It opens the current application's user guides, under the [user documentation standard](user-documentation.md), with role-appropriate admin guidance.

## UI acceptance

Test the user coin on desktop/mobile, additional passkey creation/removal and last-passkey protection, session-invalidating logout, Users authorisation and actions, System metadata against the built artefact, Documentation navigation/content, and the attribution link/asset. Verify keyboard access, focus behaviour, small-screen layout and scrolling. Keep existing desktop/mobile E2E projects and meaningful assertions when refining the UI.
