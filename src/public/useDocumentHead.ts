import { useEffect } from 'react';
import { SITE_URL, pageFor } from './pages';

const setMeta = (selector: string, attr: 'content' | 'href', value: string) => {
  const el = document.head.querySelector(selector);
  if (el) el.setAttribute(attr, value);
};

/**
 * Keep title, description and canonical in step on client-side navigation
 * between public pages (the pre-rendered HTML already has them for the first load).
 */
export function useDocumentHead(path: string) {
  useEffect(() => {
    const page = pageFor(path);
    if (!page) return;
    document.title = page.title;
    setMeta('meta[name="description"]', 'content', page.description);
    setMeta('link[rel="canonical"]', 'href', `${SITE_URL}${page.path}`);
    setMeta('meta[property="og:title"]', 'content', page.title);
    setMeta('meta[property="og:description"]', 'content', page.description);
    setMeta('meta[property="og:url"]', 'content', `${SITE_URL}${page.path}`);
  }, [path]);
}

/** Tab title for app screens: "<Screen> | GuitarHelp". */
export function usePageTitle(screen: string) {
  useEffect(() => {
    document.title = `${screen} | GuitarHelp`;
  }, [screen]);
}
