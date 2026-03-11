import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Global unhandled promise rejection handler - prevents [object Object] overlay
window.addEventListener('unhandledrejection', (event) => {
  event.preventDefault();
  const reason = event.reason;
  // Only log, don't show error overlay for API errors
  if (reason?.message || reason?.success === false) {
    console.warn('API error (handled):', reason?.message || JSON.stringify(reason));
  } else {
    console.error('Unhandled rejection:', reason);
  }
});

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<React.StrictMode><App /></React.StrictMode>);