import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { PUBLIC_PAGES } from './public/pages';
import { isAppRoute } from './routes';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@fontsource/righteous/400.css';
import './styles/index.css';

const root = document.getElementById('root')!;
const app = (
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Pre-rendered pages record the route they were rendered for ("*" = the 404
// page). Hydrate only HTML that was rendered for this URL; anything else (HTML
// served for another path during a deploy, a local fallback) renders fresh.
const pathname = window.location.pathname;
const renderedFor = root.dataset.route;
const isKnownRoute = PUBLIC_PAGES.some((p) => !p.static && p.path === pathname) || isAppRoute(pathname);
const canHydrate =
  root.hasChildNodes() && (renderedFor === pathname || (renderedFor === '*' && !isKnownRoute));

if (canHydrate) {
  ReactDOM.hydrateRoot(root, app, {
    // Surface hydration mismatches (React otherwise recovers silently in production)
    onRecoverableError: (error) => console.error('Hydration error:', error),
  });
} else {
  root.replaceChildren();
  ReactDOM.createRoot(root).render(app);
}
