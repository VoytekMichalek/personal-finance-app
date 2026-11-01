import releases from "../../../../../docs/releases.json";
import { Card, Pill } from "../common/primitives";

export function ReleaseNotes({ version }: { version?: string }) {
  return (
    <section
      aria-labelledby="release-notes-title"
      className="max-w-3xl space-y-4"
    >
      <div>
        <h2 id="release-notes-title" className="text-xl font-semibold">
          Release notes
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          What’s new in Michalek Finance, newest first.
        </p>
      </div>
      {releases.map((release) => (
        <Card key={release.version}>
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <h3 className="font-semibold">v{release.version}</h3>
            {release.version === version && (
              <Pill tone="positive">This version</Pill>
            )}
            <time
              dateTime={release.date}
              className="text-xs text-muted-foreground sm:ml-auto"
            >
              {new Intl.DateTimeFormat("en-AU", {
                dateStyle: "medium",
                timeZone: "UTC",
              }).format(new Date(release.date + "T00:00:00Z"))}
            </time>
          </div>
          <ul className="list-disc space-y-2 pl-5 text-sm leading-6">
            {release.highlights.map((highlight) => (
              <li key={highlight}>{highlight}</li>
            ))}
          </ul>
          <a
            className="mt-4 inline-flex min-h-11 items-center text-xs text-primary underline"
            href={
              "https://github.com/VoytekMichalek/personal-finance-app/releases/tag/v" +
              release.version
            }
            target="_blank"
            rel="noreferrer"
          >
            Release details on GitHub
          </a>
        </Card>
      ))}
    </section>
  );
}
