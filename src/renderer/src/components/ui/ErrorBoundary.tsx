import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  /** Shown instead of the children after a render error; gets a reset callback. */
  fallback: (reset: () => void) => ReactNode;
}

interface State {
  failed: boolean;
}

/**
 * Keeps one broken view (say, unexpected data from the gateway) from blanking
 * the whole window. Give it a `key` that changes on navigation so it resets.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('View crashed', error, info.componentStack);
  }

  reset = () => this.setState({ failed: false });

  render() {
    return this.state.failed ? this.props.fallback(this.reset) : this.props.children;
  }
}
