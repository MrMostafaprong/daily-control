import { Component } from 'react';

export default class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('UI error:', error, info?.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="card empty-state" role="alert" style={{ margin: '40px auto', maxWidth: 520 }}>
        <h3>حصل خطأ غير متوقع في الواجهة</h3>
        <p className="text-muted" dir="ltr" style={{ margin: '10px 0 16px' }}>{String(this.state.error?.message || this.state.error)}</p>
        <button onClick={() => { this.setState({ error: null }); window.location.reload(); }}>إعادة تحميل</button>
      </div>
    );
  }
}
