
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { AuthProvider } from './contexts/AuthContext';
import { I18nProvider } from './contexts/I18nContext';
import { ThemeProvider } from './contexts/ThemeContext';
import ErrorBoundary from './components/ErrorBoundary';

const rootElement = document.getElementById('root');

// 1. Global Error Handling (Safety Net)
window.onerror = function (message, source, lineno, colno, error) {
  console.error('[Global Error]:', { message, source, lineno, colno, error });
  // Prevent default handling if we want to show our own UI, but usually letting it bubble to ErrorBoundary is fine for React.
  // For non-React errors, we might want a toast or alert.
  return false;
};

window.addEventListener('unhandledrejection', (event) => {
  const err: any = event.reason;
  // AbortError = OK, suppress completely in production
  if (err?.name === 'AbortError' || err === null) {
    event.preventDefault(); // Prevent Safari from logging
    return;
  }
  console.error('[Unhandled Rejection]:', err);
});

if (!rootElement) {
  // Graceful degradation if root is missing (should never happen)
  console.error("Critical: Root element not found");
  document.body.innerHTML = '<div style="color:white; padding:20px;">Critical Error: App Root not found. Please reload.</div>';
} else {
  console.log('🚀 Starting MST App (Safe Mode)...');

  try {
    const root = ReactDOM.createRoot(rootElement);
    root.render(
      <React.StrictMode>
        <ErrorBoundary>
          <I18nProvider>
            <AuthProvider>
              <ThemeProvider>
                <App />
              </ThemeProvider>
            </AuthProvider>
          </I18nProvider>
        </ErrorBoundary>
      </React.StrictMode>
    );
  } catch (e) {
    console.error("Failed to mount app:", e);
    rootElement.innerHTML = '<div style="color:white; padding:20px; text-align:center;">Failed to start application.<br><button onclick="window.location.reload()" style="margin-top:20px; padding:10px 20px;">Reload</button></div>';
  }
}

// PWA Service Worker Registration
import { registerSW } from 'virtual:pwa-register';

if ('serviceWorker' in navigator) {
  const updateSW = registerSW({
    onNeedRefresh() {
      if (confirm('Nová verze aplikace je k dispozici. Aktualizovat nyní?')) {
        updateSW(true);
      }
    },
    onOfflineReady() {
      console.log('Aplikace je připravena pro režim offline.');
    },
  });
}