/**
 * App route prefixes served by the SPA shell (app.html). The CloudFront URL
 * router in frontend-infrastructure.yaml carries the same list; a test checks
 * they match. A path is an app route when it equals a prefix or starts with
 * prefix + '/'.
 */
export const APP_ROUTE_PREFIXES = [
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/collection',
  '/account',
  '/add',
  '/documents',
  '/timeline',
  '/guitar',
  '/edit',
  '/s',
] as const;

export const isAppRoute = (pathname: string) =>
  APP_ROUTE_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
