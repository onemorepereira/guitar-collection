/**
 * API utilities for making secure HTTP requests
 */

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

/**
 * Security headers added to all requests
 * X-Requested-With: CSRF protection - prevents cross-origin requests without explicit JavaScript
 */
const SECURITY_HEADERS = {
  'X-Requested-With': 'XMLHttpRequest',
};

/**
 * Make a secure API request with CSRF protection headers
 *
 * @param url - Full URL or path (will be prefixed with API_URL if relative)
 * @param options - Fetch options
 * @returns Fetch response
 */
export async function apiRequest(url: string, options: RequestInit = {}): Promise<Response> {
  // Add API_URL prefix if URL is relative
  const fullUrl = url.startsWith('http') ? url : `${API_URL}${url}`;

  // Merge headers with security headers
  // Don't set Content-Type if body is FormData - browser will set it with boundary
  const headers = {
    ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
    ...SECURITY_HEADERS,
    ...options.headers,
  };

  return fetch(fullUrl, {
    ...options,
    headers,
  });
}

/** Error code the API returns (401/403) once an account deletion is in progress. */
export const ACCOUNT_DELETION_CODE = 'ACCOUNT_DELETION_IN_PROGRESS';

let onAccountDeleting: (() => void) | null = null;

/** Register the app-wide reaction to a deleting account (set by authService). */
export function setOnAccountDeleting(handler: (() => void) | null): void {
  onAccountDeleting = handler;
}

/** True if the response says this account is being deleted (body not consumed). */
export async function isAccountDeletingResponse(response: Response): Promise<boolean> {
  if (response.status !== 401 && response.status !== 403) return false;
  try {
    const body = await response.clone().json();
    return body?.code === ACCOUNT_DELETION_CODE;
  } catch {
    return false;
  }
}

/**
 * Make an authenticated API request
 *
 * @param url - Full URL or path
 * @param token - JWT token
 * @param options - Fetch options
 * @returns Fetch response
 */
export async function authenticatedRequest(
  url: string,
  token: string,
  options: RequestInit = {}
): Promise<Response> {
  const headers = {
    Authorization: `Bearer ${token}`,
    ...options.headers,
  };

  const response = await apiRequest(url, {
    ...options,
    headers,
  });

  // Single detection point for every authenticated call: once the account is
  // being deleted, clear local data and leave (handler set by authService).
  if (onAccountDeleting && (await isAccountDeletingResponse(response))) {
    onAccountDeleting();
  }

  return response;
}

/**
 * Handle API errors consistently
 *
 * @param response - Fetch response
 * @returns Parsed JSON data
 * @throws Error with message from API
 */
export async function handleApiError(response: Response): Promise<never> {
  let errorMessage = 'An error occurred';

  try {
    const error = await response.json();
    errorMessage = error.error || error.message || errorMessage;
  } catch {
    // Response might not be JSON
    errorMessage = response.statusText || errorMessage;
  }

  throw new Error(errorMessage);
}

/**
 * Make an API request and parse JSON response
 *
 * @param url - Full URL or path
 * @param options - Fetch options
 * @returns Parsed JSON response
 */
export async function apiJson<T>(url: string, options: RequestInit = {}): Promise<T> {
  const response = await apiRequest(url, options);

  if (!response.ok) {
    await handleApiError(response);
  }

  return response.json();
}

/**
 * Make an authenticated API request and parse JSON response
 *
 * @param url - Full URL or path
 * @param token - JWT token
 * @param options - Fetch options
 * @returns Parsed JSON response
 */
export async function authenticatedJson<T>(
  url: string,
  token: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await authenticatedRequest(url, token, options);

  if (!response.ok) {
    await handleApiError(response);
  }

  return response.json();
}

export { API_URL };
