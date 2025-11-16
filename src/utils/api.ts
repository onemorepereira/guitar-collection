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
  const headers = {
    'Content-Type': 'application/json',
    ...SECURITY_HEADERS,
    ...options.headers,
  };

  return fetch(fullUrl, {
    ...options,
    headers,
  });
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

  return apiRequest(url, {
    ...options,
    headers,
  });
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
