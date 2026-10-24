# Application logging

Applies to every deployed application service across private webapp, site-only and combined profiles, including request middleware and framework/auth-library logging. Expected application behaviour **must not generate warning/error noise**. Keep this standard authoritative; checklists and project documentation reference it and record implementation/evidence.

## Severity and expected behaviour

- Routine unauthenticated or unauthorised requests rejected with **401/403**, including bot requests, must produce **no warning, error or stack trace**. Handle expected denials deliberately, including denials represented internally as exceptions.
- Expected request validation failures and ordinary missing routes must not become application warnings/errors solely because they return a **4xx** response.
- Routine health/readiness polling must avoid repetitive application logs, including expected not-ready responses during initialisation. Report an actionable abnormal state or transition when useful, rather than logging every poll.
- **HTTP status codes alone must not determine application log severity.** Classify the underlying condition; a generic request/error handler must not turn every rejected response into a warning or error.
- Warnings identify **actionable abnormal conditions** requiring investigation or intervention. Errors identify **genuine unexpected failures**. Include sanitised context sufficient to diagnose them; do not suppress genuine failures to achieve quiet logs.

Expected access denials remain distinct from a **detected security incident requiring attention**. A denied request, bot user agent or missing route alone is not an incident. Where incident detection exists, define its abnormal signal and record an actionable, sanitised event at the appropriate severity; do not downgrade that event merely because its response is 401/403. This does not require adding a new incident-detection subsystem.

## Investigation and redaction

Optional debug/access logging must remain available for investigation, with its enable/disable method documented. It must not promote routine responses to warning/error severity, emit denial stack traces or restore repetitive health/readiness logs. Keep default production request logging quiet; ordinary business/startup events may still use appropriate informational logs.

Redact secrets, tokens and credentials at every enabled level and sink, including third-party logger output, exception details, request headers/cookies, query strings and bodies. Do not log raw environment objects, database connection strings, bootstrap/invitation links, session/access tokens or passkey credentials. Prefer safe event names, request identifiers and limited diagnostic fields. Diagnostic controls must follow the [minimal configuration policy](environment-and-deployment.md#minimal-application-configuration); this standard does not mandate another environment variable or a logging service.

## Pre-deployment verification

Verify logging by repository inspection and isolated checks of every actual production application image before deployment. Locally built production images are sufficient; reuse passing evidence when it covers the same candidate and requirement. **No registry publication, live production deployment, production credentials or production data are required.** Use disposable accounts/services and controlled fixtures.

1. Inspect logger configuration, severity mapping, request/error middleware and framework/auth-library settings. Trace expected denial/validation/not-found paths, poll handling, genuine failure paths, diagnostic controls and redaction. Include every application-owned output/sink; a quiet HTTP handler does not prove a library logger is quiet.
2. With default production logging, capture application logs (including stdout/stderr) while exercising unauthenticated protected access, authenticated-but-forbidden access where applicable, representative bot requests, invalid requests, ordinary missing routes and repeated health/readiness polls. Assert the expected HTTP behaviour **and** absence of prohibited warnings/errors, denial stack traces and repetitive poll entries. A site without protected operations marks only those cases inapplicable and still checks its routes/polls.
3. Use safe controlled fault fixtures to exercise implemented actionable warning conditions and a genuine unexpected failure; confirm the intended warning/error and useful sanitised context still appear. If no warning condition exists, record that inspection outcome rather than inventing one. If incident detection is implemented, simulate its defined signal separately from routine denials and confirm the actionable event. Keep fault injection confined to the test harness, not an exposed production diagnostic endpoint.
4. Enable the supported optional debug/access logging and use safe dummy secret/token/credential markers to verify redaction in all captured output. Recheck denial/poll handling. Record the investigation controls and verify disabling them restores default behaviour.

Wait for request completion and logger flush/drain before asserting log absence; do not rely on an immediate empty buffer or arbitrary sleeps. Record selected cases, applicability, commands, results, candidate/build identity and sanitised evidence. A source-only review or status-code assertion is insufficient. Use scoped [assessment check R19](../checklists/ready-to-deploy.md#authoritative-checks), retaining genuine migration/startup failure reporting required by the deployment standard.
