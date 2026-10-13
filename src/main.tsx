import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

const rootElement = document.getElementById('root');
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}

// Register PWA Service Worker for offline resilience
if ('serviceWorker' in navigator && (import.meta.env.PROD || window.location.search.includes('sw=true'))) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        if (registration.installing) {
          console.log('[Tracer] Service worker installing');
        } else if (registration.active) {
          console.log('[Tracer] Service worker active and offline-ready');
        }
      })
      .catch((error) => {
        console.warn('[Tracer] Service worker registration failed:', error);
      });
  });
}
