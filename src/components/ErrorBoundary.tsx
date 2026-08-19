import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}
interface State {
  error: Error | null;
}

/**
 * How long the message stays up before the display rescues itself. Long
 * enough that anyone standing there can read what happened, short enough
 * that a wall nobody is watching does not stay broken.
 */
const AUTO_RELOAD_MS = 20_000;

/**
 * Last line of defence for the lobby wall.
 *
 * Without this, any throw during render — a malformed data row, a map
 * library error — unmounts the whole tree and leaves a black screen that
 * nobody in the office can diagnose. A readable panel with the actual error
 * is worth far more than a blank display, and it satisfies the standing
 * rule that the app must never show a blank screen.
 *
 * It also reloads itself. The panel offers a button, but the display this
 * runs on has no keyboard and often no one in front of it — a message that
 * waits for a tap is indistinguishable from a broken wall for however long
 * it takes someone to notice. Most render failures here are transient (a
 * half-written data file, a WebGL hiccup), so an unattended retry usually
 * is the fix.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };
  private reloadTimer: number | undefined;

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[Kalb Atlas] Render failed:', error, info.componentStack);
    window.clearTimeout(this.reloadTimer);
    this.reloadTimer = window.setTimeout(
      () => window.location.reload(),
      AUTO_RELOAD_MS
    );
  }

  componentWillUnmount(): void {
    window.clearTimeout(this.reloadTimer);
  }

  render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div className="app">
        <div className="g-error g-error-boundary">
          <strong>The atlas hit an error and stopped.</strong>
          <span className="g-error-detail">{error.message}</span>
          <span className="g-error-hint">
            Reloading automatically in a few seconds. Full details are in the
            browser console.
          </span>
          <button className="g-error-btn" onClick={() => window.location.reload()}>
            Reload
          </button>
        </div>
      </div>
    );
  }
}
