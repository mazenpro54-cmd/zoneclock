import React, { StrictMode, Component } from 'react'
import { createRoot } from 'react-dom/client'
import { Capacitor } from '@capacitor/core'
import './styles/main.css'
import App from './App.jsx'

class GlobalErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    console.error("Global React Error caught:", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          background: '#0f0f13',
          color: '#e2e2f0',
          fontFamily: 'system-ui, sans-serif',
          textAlign: 'center'
        }}>
          <h2 style={{ fontSize: '1.4rem', marginBottom: '8px', color: '#ef4444' }}>Something went wrong</h2>
          <p style={{ color: '#8b8ba8', fontSize: '0.9rem', maxWidth: '400px', marginBottom: '16px' }}>
            {this.state.error?.message || "An unexpected error occurred while loading ZoneClock."}
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              background: '#6366f1',
              color: '#fff',
              border: 'none',
              padding: '10px 20px',
              borderRadius: '8px',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Reload ZoneClock
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// Clean up any stale service workers in native mobile apps
if (typeof window !== 'undefined' && Capacitor.isNativePlatform()) {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      for (const registration of registrations) {
        registration.unregister();
      }
    }).catch(() => {});
  }
}

// Only register PWA service worker in standard web browsers, never in native Capacitor APK
if (
  typeof window !== 'undefined' &&
  !Capacitor.isNativePlatform() &&
  !window.location.protocol.startsWith('capacitor') &&
  !window.location.protocol.startsWith('file') &&
  !window.location.pathname.endsWith('.html') &&
  'serviceWorker' in navigator &&
  (window.location.protocol === 'https:' || window.location.hostname === 'localhost')
) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.warn('PWA service worker registration skipped/failed:', err);
    });
  });
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <GlobalErrorBoundary>
      <App />
    </GlobalErrorBoundary>
  </StrictMode>,
);
window.__react_mounted = true;
