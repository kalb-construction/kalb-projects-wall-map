import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}
interface State {
  error: Error | null;
}

/**
 * Last line of defence for the lobby wall.
 *
 * Without this, any throw during render — a malformed data row, a map
 * library error — unmounts the whole tree and leaves a black screen that
 * nobody in the office can diagnose. A readable panel with the actual error
 * is worth far more than a blank display, and it satisfies the standing
 * rule that the app must never show a blank screen.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[Kalb Atlas] Render failed:', error, info.componentStack);
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
            Check data/projects.json, then reload the page. Full details are in
            the browser console.
          </span>
          <button className="g-error-btn" onClick={() => window.location.reload()}>
            Reload
          </button>
        </div>
      </div>
    );
  }
}
