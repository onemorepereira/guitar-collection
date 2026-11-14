import { renderToString } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom/server';
import { ThemeProvider } from './context/ThemeContext';
import { AppRoutes } from './App';

export { PUBLIC_PAGES, SITE_URL, SITE_NAME, OG_IMAGE, OG_IMAGE_ALT } from './public/pages';

/** Render one route to HTML at build time (scripts/prerender.mjs). */
export function render(url: string): string {
  return renderToString(
    <ThemeProvider>
      <StaticRouter location={url}>
        <AppRoutes />
      </StaticRouter>
    </ThemeProvider>
  );
}
