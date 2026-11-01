import { Component, type ReactNode } from "react";
import { Button } from "../ui/button";

export class ScreenErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="mx-auto max-w-lg space-y-4 p-6 pt-20">
        <h1 className="text-xl font-semibold">This screen could not open</h1>
        <p role="alert" className="text-sm">
          Reload to get the current app files. Saved records are kept; unsaved
          edits on this screen may need to be entered again.
        </p>
        <Button onClick={() => window.location.reload()}>Reload screen</Button>
        <a className="ml-4 text-sm text-primary underline" href="/">
          Go to overview
        </a>
      </main>
    );
  }
}
