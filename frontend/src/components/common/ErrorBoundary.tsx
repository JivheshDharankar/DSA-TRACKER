import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import styles from './ErrorBoundary.module.css';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * App-level recovery boundary (mounted in `main.tsx`).
 *
 * Same behaviour as before — it catches render failures, logs them, and offers a full
 * reload — but the presentation is now the shared `Card` + `Button` on
 * `styles/tokens.css` instead of a large block of inline styles mixing legacy variable
 * names. The technical message stays visible (it is the only diagnostic a user can hand
 * over), in a scrollable mono block that cannot push the card wider than the viewport.
 */
export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in UI component tree:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className={styles.shell}>
          <Card variant="raised" className={styles.card} role="alert">
            <span className={styles.iconTile} aria-hidden="true">
              <AlertCircle size={28} />
            </span>

            <h1 className={styles.title}>Something unexpected happened</h1>

            <p className={styles.message}>
              An unexpected error occurred while rendering this view. Your session and problem
              data remain completely safe.
            </p>

            {this.state.error ? (
              <pre className={styles.detail}>{this.state.error.message}</pre>
            ) : null}

            <Button iconLeft={<RefreshCw size={15} />} onClick={this.handleReset}>
              Reload Application
            </Button>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}
