import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/index.css';

const root = document.getElementById('root')!;
const app = (
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Pre-rendered pages record the route they were rendered for. Hydrate only
// when it matches this URL; otherwise (HTML served for another path) render fresh.
const renderedFor = root.dataset.route;
if (root.hasChildNodes() && renderedFor && (renderedFor === window.location.pathname || renderedFor === '*')) {
  ReactDOM.hydrateRoot(root, app, {
    // Surface hydration mismatches (React otherwise recovers silently in production)
    onRecoverableError: (error) => console.error('Hydration error:', error),
  });
} else {
  root.replaceChildren();
  ReactDOM.createRoot(root).render(app);
}
