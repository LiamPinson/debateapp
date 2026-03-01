"use client";

import { Component } from "react";

/**
 * Generic error boundary for the app layout.
 * Catches uncaught errors in the component tree and shows a fallback UI
 * instead of a white screen.
 */
export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error("ErrorBoundary caught:", error, info?.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[60vh] flex items-center justify-center px-4">
          <div className="text-center max-w-md">
            <h2 className="text-xl font-bold text-arena-text mb-2">Something went wrong</h2>
            <p className="text-arena-muted mb-6">
              An unexpected error occurred. Please try refreshing the page.
            </p>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.reload();
              }}
              className="px-6 py-2 bg-arena-gold text-arena-bg rounded-lg font-medium hover:brightness-110 transition"
            >
              Refresh Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Specialized error boundary for the debate room.
 * Offers a "Go Home" option in addition to retry, since the debate
 * state may be unrecoverable.
 */
export class DebateErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error("DebateErrorBoundary caught:", error, info?.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[60vh] flex items-center justify-center px-4">
          <div className="text-center max-w-md">
            <h2 className="text-xl font-bold text-arena-text mb-2">Debate Error</h2>
            <p className="text-arena-muted mb-6">
              Something went wrong during the debate. The debate may have ended or
              encountered an issue.
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => {
                  this.setState({ hasError: false, error: null });
                  window.location.reload();
                }}
                className="px-6 py-2 bg-arena-gold text-arena-bg rounded-lg font-medium hover:brightness-110 transition"
              >
                Try Again
              </button>
              <a
                href="/"
                className="px-6 py-2 bg-arena-surface text-arena-text border border-arena-border rounded-lg font-medium hover:bg-arena-surface/80 transition"
              >
                Go Home
              </a>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
