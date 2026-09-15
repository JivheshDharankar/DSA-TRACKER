import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

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
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'var(--bg-app)',
            padding: '24px',
            color: 'var(--text-main)',
          }}
        >
          <div
            style={{
              maxWidth: '520px',
              width: '100%',
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-lg)',
              padding: '32px',
              textAlign: 'center',
              boxShadow: 'var(--shadow-card)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '16px',
            }}
          >
            <div
              style={{
                width: '56px',
                height: '56px',
                borderRadius: '50%',
                backgroundColor: 'rgba(239, 68, 68, 0.12)',
                border: '1px solid rgba(239, 68, 68, 0.25)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#f87171',
              }}
            >
              <AlertCircle size={28} />
            </div>

            <h2 style={{ fontSize: '1.3rem', fontWeight: 700, margin: 0 }}>
              Something unexpected happened
            </h2>

            <p
              style={{
                color: 'var(--text-muted)',
                fontSize: '0.9rem',
                lineHeight: 1.5,
                margin: 0,
              }}
            >
              An unexpected error occurred while rendering this view. Your session and problem data
              remain completely safe.
            </p>

            {this.state.error && (
              <pre
                style={{
                  backgroundColor: 'var(--bg-surface-elevated)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '10px 14px',
                  fontSize: '0.78rem',
                  color: 'var(--text-dim)',
                  fontFamily: 'var(--font-mono)',
                  maxWidth: '100%',
                  overflowX: 'auto',
                  textAlign: 'left',
                }}
              >
                {this.state.error.message}
              </pre>
            )}

            <button
              onClick={this.handleReset}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 20px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--accent-cyan)',
                color: '#000000',
                border: 'none',
                fontWeight: 600,
                fontSize: '0.9rem',
                cursor: 'pointer',
                marginTop: '8px',
              }}
            >
              <RefreshCw size={15} />
              <span>Reload Application</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
