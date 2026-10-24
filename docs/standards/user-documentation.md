# User documentation

Every authenticated webapp, including the private part of a combined project, must include a **Documentation** item in the sidebar and equivalent mobile navigation from its initial usable baseline. It opens in-app user guides explaining the features that exist in the deployed version. Site-only projects do not need an application sidebar or account guides; provide visitor help for real public workflows where useful and do not scaffold empty guide pages.

## Content and audience

Use plain language for people using the application. Include getting started, passkey sign-in, the user coin's passkey creation/management and logout actions, common workflows, role differences, troubleshooting and relevant administrator tasks. Admin guidance covers Settings → Users invitations, role changes, re-invitation, access reset and deletion. For combined projects, explain publishing/unpublishing and when public content updates appear. Explain how users can report Version, Release Tag, Build Commit and Build Time from Settings → System when asking for support.

Match real labels and behaviour. Use useful examples and screenshots when they clarify a task. Do not expose infrastructure credentials, deployment internals, source-code instructions or developer-only setup in these guides. Keep engineering information in the repository README and developer documentation.

Show general guides to signed-in members and admins. Restrict sensitive admin-only guide content consistently with its intended audience; hiding a menu link alone is insufficient if restricted content is embedded in a public bundle. Pre-login help may expose only material deliberately intended to be public.

## Source and delivery

Keep guide source in `docs/user-guide/` as Markdown/MDX or an equivalent repository-managed format. Render/package that source into the application so the UI and guides ship together. Sanitise rendered content and disable untrusted executable MDX. Do not maintain a separate hand-copied UI version that can drift.

Provide a guide index and headings, direct links to individual topics, and usable mobile/keyboard navigation. An initial guide must explain the implemented baseline; an empty Documentation page or a link to an unrelated developer README does not satisfy the requirement.

## Maintenance is part of delivery

Every feature or behaviour change must update the affected guide in the same change, or record why no user-facing documentation is affected. Changes to labels, permissions, onboarding, settings and recovery instructions count. Remove obsolete instructions when a feature is removed.

This means agents update guides while building the project; it does not require a background documentation-writing service. Reviewers check the guide against the delivered UI and exercise the Documentation navigation. Guide rendering, broken links and missing required topics should be checked by the project's normal build/quality process.

Start from the [guide template](https://github.com/codename-systems/codename-project-sops/blob/9335fad26de93124a891f6c6544bb388aa366084/templates/project/docs/user-guide/index.md.tmpl) and replace its prompts with actual user instructions before handover.
