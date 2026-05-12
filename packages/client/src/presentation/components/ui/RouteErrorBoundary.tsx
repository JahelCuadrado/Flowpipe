import { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";

interface Props {
  readonly children: ReactNode;
}

interface State {
  readonly hasError: boolean;
  readonly errorMessage: string | null;
}

/**
 * Route-level error boundary that catches render errors in lazy-loaded pages.
 * Provides a recovery UI instead of crashing the entire application.
 */
export class RouteErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, errorMessage: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, errorMessage: error.message };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("[RouteErrorBoundary] Unhandled render error:", error, info.componentStack);
  }

  private handleReset = (): void => {
    this.setState({ hasError: false, errorMessage: null });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-[60dvh] flex-col items-center justify-center gap-4 px-6 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#272727]">
            <svg viewBox="0 0 24 24" width={32} height={32} fill="none" stroke="#e53935" strokeWidth={2}>
              <circle cx={12} cy={12} r={10} />
              <line x1={12} y1={8} x2={12} y2={12} />
              <line x1={12} y1={16} x2={12.01} y2={16} />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-[#f1f1f1]">Something went wrong</h2>
          <p className="max-w-sm text-sm text-[#aaa]">
            {this.state.errorMessage ?? "An unexpected error occurred while rendering this page."}
          </p>
          <button
            type="button"
            onClick={this.handleReset}
            className="mt-2 rounded-full bg-[#272727] px-5 py-2 text-sm font-medium text-white transition-colors active:bg-[#3a3a3a]"
          >
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
