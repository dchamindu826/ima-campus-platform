import React from 'react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({
      error: error,
      errorInfo: errorInfo
    });
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '20px', backgroundColor: '#fee2e2', color: '#991b1b', minHeight: '100vh', fontFamily: 'sans-serif' }}>
          <h1 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '10px' }}>Something went wrong.</h1>
          <p style={{ fontWeight: 'bold' }}>Error:</p>
          <pre style={{ backgroundColor: '#fca5a5', padding: '10px', borderRadius: '5px', overflowX: 'auto', fontSize: '12px' }}>
            {this.state.error && this.state.error.toString()}
          </pre>
          <br/>
          <p style={{ fontWeight: 'bold' }}>Component Stack:</p>
          <pre style={{ backgroundColor: '#fca5a5', padding: '10px', borderRadius: '5px', overflowX: 'auto', fontSize: '12px' }}>
            {this.state.errorInfo && this.state.errorInfo.componentStack}
          </pre>
          <p style={{ marginTop: '20px', fontSize: '14px' }}>Please send a screenshot of this screen to the developer.</p>
        </div>
      );
    }

    return this.props.children; 
  }
}
