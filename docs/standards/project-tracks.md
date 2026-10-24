# Project tracks and public websites

Select the track before choosing dependencies, templates or deployment services. Record the project type, track, mode and reason in README and `docs/sop-adoption.md`. These are standard paths, not stack exceptions.

The first build must fully implement the selected path and requested product scope under the [default first-build rule](../sops/project-instantiation.md#default-first-build-full-implementation). Choose the path that fits the request and carry it through implementation, validation and handover. A reduced build or different path requires a specific user request recorded in the adoption file; it is not an agent-selected shortcut.

## Choose the project type

| User-facing project type | Track and mode | Source workspaces | Production application images |
| --- | --- | --- | --- |
| Private webapp | Web Application Track | `apps/web` React/Vite; `apps/api` Express; shared schemas | One API image containing the compiled webapp |
| Public frontend website | Hybrid SEO Application Track, site-only mode | `apps/site` Next.js App Router; shared code only where useful | One site image |
| Public website and private webapp | Hybrid SEO Application Track, managed admin or advanced backend mode | `apps/site` Next.js; `apps/web` React/Vite; `apps/api` Express; shared schemas | `site` and `api-admin` images |

Choose Web Application for internal tools, client portals, dashboards and workflows whose primary experience requires authentication. A public sign-in page alone does not make an application a public website.

Choose Hybrid SEO when public content needs crawlable HTML, search metadata and shareable URLs. **Site-only** is a complete valid starting point; do not scaffold a speculative admin, API, database or authentication service. **Managed admin** adds content administration. **Advanced backend** adds CRM, integrations or business workflows; it uses the same topology as managed admin. A site can add those capabilities later without changing tracks.

A separate CMS, static-site framework or different topology requires a specific user request for that departure, plus a documented project reason and trade-off. Do not default a public content website to a Vite SPA. Do not assume every website needs a private application.

## Web Application Track

Use the [entry SOP's application stack](../sops/project-instantiation.md#3-standard-stack): React/Vite/TypeScript, Tailwind, shadcn/ui, Lucide, React Hook Form, Zod and TanStack Query; Express/TypeScript, PostgreSQL/Prisma and Better Auth passkeys.

The API owns authentication, business rules, migrations and storage access. Bundle the compiled `apps/web` into the production application image and serve it through Express alongside `/api/*`. Include health/readiness endpoints. Use a Vite API proxy in development.

The authenticated app has Settings → **Users** and **System**, a user coin for passkey management/logout, Documentation navigation and Codename attribution. Follow the [UI](application-ui.md), [authentication](authentication.md) and [user documentation](user-documentation.md) standards.

## Public website: site-only mode

Use Next.js App Router, React, TypeScript and Tailwind in `apps/site`. Add Zod for inputs/content validation and shared packages where there is real reuse. Use the common UI primitives for interactive controls as needed; do not install the admin's query/form stack for static content alone.

```text
apps/site/
  app/
    layout.tsx
    (site)/page.tsx
    (site)/<content-domain>/[slug]/page.tsx  # only when needed
    robots.ts
    sitemap.ts
  src/components/
  src/lib/
  src/content/                             # when content lives in the repo
  public/images/codename-logo-acid-dark.svg
  package.json
  next.config.ts
Dockerfile.site
```

Keep the common toolchain, tests, docs, quality gates and thin workflows. Site-only does not require `apps/web`, `apps/api`, Prisma, Better Auth, Users/System screens, a user coin or a sidebar. Include Codename attribution in the public footer. Provide visitor guidance when the website has workflows that need it; do not add an empty Documentation area to a simple brochure site.

Omit database/secret variables, migration scripts and local Compose when there are no corresponding services. Use the single-service root example under the [environment policy](environment-and-deployment.md#environment-examples-per-deployed-service), comments-only if there are no deployment inputs. If canonical origins vary, configure one validated public site origin as described in [deployment](environment-and-deployment.md). Static content belongs in the repository; external content sources are enabled deliberately.

## Combined website and private application

```text
apps/
  site/                 # Next.js public content and metadata
  web/                  # Vite private app/admin source
  api/
    src/modules/        # auth, content and business domains
    prisma/             # sole owner of schema and migrations
packages/shared/src/    # safe schemas/types; no server secrets
Dockerfile.site
Dockerfile.api          # builds API and includes compiled apps/web
docker/entrypoint.sh    # applies migrations, then starts API/admin
```

`apps/api` owns database access, authentication, uploads, integrations and business mutations. Public server rendering reads a deliberately public content API through a server-only adapter. Do not duplicate business logic or Prisma ownership in Next.js, import backend secrets into shared packages, or return draft/private fields from public endpoints.

`apps/web` uses the Web Application stack and all authenticated UI requirements. It calls the API for data and mutations. Keep its authentication, query providers and admin dependencies out of the public site's component tree and bundles.

Production has exactly two application services by default:

| Service | Routes on the default shared origin | Image |
| --- | --- | --- |
| `site` | Public routes, Next.js assets, robots and sitemap | `ghcr.io/codename-systems/<repo>-site:vMAJOR.MINOR.PATCH` |
| `api-admin` | `/api/*`, `/admin` and `/admin/*` | `ghcr.io/codename-systems/<repo>-api:vMAJOR.MINOR.PATCH` |

There is no separate admin production container. Configure both services and routing **manually in Dokploy, without production Compose**. Route `/api` and `/admin` before the public catch-all, handle prefix roots, and ensure asset/deep-link requests reach the correct service. Configure the Vite asset base and router basename for `/admin`; API misses must return API errors rather than the SPA HTML fallback.

Provide `apps/site/.env.example` and `apps/api/.env.example` under the authoritative [environment policy](environment-and-deployment.md#environment-examples-per-deployed-service), with distinct local development configuration. Apply the [logging standard](application-logging.md) to both services, including routine API denials and site missing routes.

Use subdomains only when they simplify the actual project. Document cookie scope, trusted origins, WebAuthn RP ID, CORS, redirects and asset paths for that choice. Authentication lives in `api-admin`; public pages stay public and cacheable where appropriate. Authenticated responses must not enter public shared caches. Private/admin routes are excluded from public sitemaps and carry noindex directives; indexing directives do not replace access control.

Reserve any site-owned revalidation handler explicitly in routing, for example a protected `/internal/revalidate` handler on the site service. Do not put it beneath an `/api/*` prefix routed entirely to Express without a deliberate routing exception. Protect it with authenticated service-to-service requests and validate the affected content identifiers. Keep revalidation secrets server-only.

## Public rendering and SEO

These requirements apply to both site-only and combined projects:

- Public layouts/pages use Server Components by default. Place browser interactivity in focused Client Components; document any need for a client boundary on a public layout/page. Deliver meaningful primary content in server HTML without requiring client-side data fetching. Follow Next.js [server/client component boundaries](https://nextjs.org/docs/app/getting-started/server-and-client-components).
- Give each indexable route an appropriate title, description, canonical URL and social-sharing metadata using static `metadata` or `generateMetadata`. Use a validated canonical origin, never arbitrary request headers. Follow the [metadata API](https://nextjs.org/docs/app/getting-started/metadata-and-og-images).
- Use stable public slugs. Unknown or unpublished content must return an actual HTTP 404 to direct requests, not only a “not found” screen with status 200. Resolve existence before response streaming when needed; Next.js documents different status behaviour for [streamed not-found responses](https://nextjs.org/docs/app/api-reference/file-conventions/not-found). Test the built server's response.
- Provide [robots](https://nextjs.org/docs/app/api-reference/file-conventions/metadata/robots) and [sitemap](https://nextjs.org/docs/app/api-reference/file-conventions/metadata/sitemap) output. Include published canonical pages; exclude admin, authentication, API, preview, draft and private routes. Protect previews and prevent staging from being indexed.
- Add accurate structured data where useful. Use meaningful image alt text, suitable dimensions and stable layout sizing; avoid shipping unnecessary client JavaScript or admin dependencies to public visitors.
- Document how content is fetched and cached, how publication/unpublication invalidates affected pages and listings, and how metadata/sitemaps remain current. Managed content changes must trigger authorised revalidation; failures must be visible and retryable. Repository content changes can rebuild/redeploy the site. Verify cache behaviour against the selected Next.js version and configuration, following its [revalidation](https://nextjs.org/docs/app/getting-started/revalidating) and [self-hosting](https://nextjs.org/docs/app/guides/self-hosting) guidance.
- Builds and smoke tests use controlled fixtures or isolated services; never require production database credentials or an existing production deployment. Document whether public content is rendered at build time or request time and how unavailable upstream content is handled.

Expose `check:seo` and `check:links` commands for these checks. Integrate them into the existing validation path using the same built output and test server; do not rebuild to run each check. Use the [testing standard](testing.md#coverage-by-project-type) for browser, HTTP and image coverage.

## Templates and acceptance

Select the matching [template profile](https://github.com/codename-systems/codename-project-sops/blob/9335fad26de93124a891f6c6544bb388aa366084/templates/README.md#select-a-project-profile) before copying files. Retain common rules; omit inapplicable services and record why rather than creating stub scripts or unused secrets. Use the [acceptance checklist](../checklists/project-instantiation.md) for the selected path. Every enabled production image must be built, smoke-tested, scanned and included in release evidence.

Broad migration of an existing consumer or installed plugin snapshot remains separately scoped. Changing this library does not automatically change those repositories or their adopted revision.
