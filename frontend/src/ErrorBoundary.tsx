import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = { children: ReactNode };

type State = { error: Error | null };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("DealFlow UI error:", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            minHeight: "100vh",
            padding: "2rem",
            fontFamily: "system-ui, sans-serif",
            background: "#0a0e14",
            color: "#e8edf4",
          }}
        >
          <h1 style={{ fontSize: "1.25rem", marginBottom: "0.5rem" }}>
            Something went wrong
          </h1>
          <pre
            style={{
              whiteSpace: "pre-wrap",
              fontSize: "0.875rem",
              color: "#fca5a5",
              maxWidth: "48rem",
            }}
          >
            {this.state.error.message}
          </pre>
          <p style={{ marginTop: "1rem", fontSize: "0.875rem", color: "#94a3b8" }}>
            Open the browser developer console (F12) for the full stack trace. If
            your project path contains spaces, try moving the folder or disable
            ad-blockers for localhost.
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}
