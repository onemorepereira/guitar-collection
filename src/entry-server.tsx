import { renderToString } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom/server';
import { ThemeProvider } from './context/ThemeContext';
import { AppRoutes } from './App';

/** Render one public route to HTML at build time. */
export function render(url: string): string {
  return renderToString(
    <ThemeProvider>
      <StaticRouter location={url}>
        <AppRoutes />
      </StaticRouter>
    </ThemeProvider>
  );
}
