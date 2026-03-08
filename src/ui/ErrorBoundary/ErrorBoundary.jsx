import { Component } from "react";
import "./ErrorBoundary.css";

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    console.error("[ErrorBoundary] Uncaught error:", error, errorInfo);
  }

  handleReload() {
    window.location.reload();
  }

  handleReset() {
    this.setState({ error: null, errorInfo: null });
  }

  render() {
    if (this.state.error) {
      const { fallback } = this.props;
      if (fallback) return fallback(this.state.error, () => this.handleReset());

      return (
        <div className="error-boundary">
          <div className="error-boundary__card">
            <div className="error-boundary__icon">💀</div>
            <h2 className="error-boundary__title">Something went wrong</h2>
            <p className="error-boundary__message">
              {this.state.error?.message || "An unexpected error occurred."}
            </p>
            <details className="error-boundary__details">
              <summary>Stack trace</summary>
              <pre className="error-boundary__stack">
                {this.state.error?.stack}
                {this.state.errorInfo?.componentStack}
              </pre>
            </details>
            <div className="error-boundary__actions">
              <button
                className="error-boundary__btn error-boundary__btn--primary"
                onClick={() => this.handleReload()}
              >
                Reload page
              </button>
              <button
                className="error-boundary__btn"
                onClick={() => this.handleReset()}
              >
                Try to recover
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
