import React from 'react';

interface Props {
  children: React.ReactNode;
}
interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ 
          display: 'flex', flexDirection: 'column', alignItems: 'center', 
          justifyContent: 'center', height: '100vh', fontFamily: 'sans-serif',
          background: '#0f172a', color: '#f8fafc', gap: '16px', padding: '24px', textAlign: 'center'
        }}>
          <div style={{ fontSize: '48px' }}>⚠️</div>
          <h1 style={{ fontSize: '24px', fontWeight: 'bold' }}>Something went wrong</h1>
          <p style={{ color: '#94a3b8', maxWidth: '500px' }}>{this.state.error?.message}</p>
          <button 
            onClick={() => window.location.href = '/'}
            style={{ 
              background: '#6366f1', color: 'white', border: 'none', 
              padding: '12px 24px', borderRadius: '8px', cursor: 'pointer', fontSize: '16px' 
            }}
          >
            Go to Home
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
