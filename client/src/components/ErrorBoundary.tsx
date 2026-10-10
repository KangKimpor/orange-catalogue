import { AlertTriangle, RotateCcw } from "lucide-react";
import { Component, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <main id="main-content" className="page-state">
            <AlertTriangle
              size={48}
              aria-hidden="true"
            />

            <h1>We couldn’t open this page.</h1>
            <p>Reload the page to try again.</p>

            {import.meta.env.DEV && <details><summary>Error details</summary><pre>{this.state.error?.stack}</pre></details>}

            <button
              onClick={() => window.location.reload()}
              type="button"
            >
              <RotateCcw size={16} aria-hidden="true" />
              Reload Page
            </button>
        </main>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
