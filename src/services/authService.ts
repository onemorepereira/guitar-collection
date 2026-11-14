import {
  User,
  LoginCredentials,
  RegisterData,
  PasswordResetRequest,
  AuthResponse,
} from '../types/auth';
import {
  apiRequest,
  authenticatedRequest,
  API_URL,
  isAccountDeletingResponse,
  setOnAccountDeleting,
} from '../utils/api';
import { closeImageDb, IMAGE_DB_NAME } from '../utils/imageStorage';

// Local storage keys
const TOKEN_KEY = 'guitar-collection-token';
const REFRESH_TOKEN_KEY = 'guitar-collection-refresh-token';
const USER_KEY = 'guitar-collection-user';

let handlingDeletion = false;

export const authService = {
  // Login
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    const response = await apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });

    if (!response.ok) {
      const error = await response.json();
      throw Object.assign(new Error(error.error || 'Login failed'), { code: error.code });
    }

    const data = await response.json();

    // Store tokens
    localStorage.setItem(TOKEN_KEY, data.tokens.idToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, data.tokens.refreshToken);

    // Get user profile
    const user = await this.getCurrentUser();
    if (!user) {
      throw new Error('Failed to fetch user profile');
    }

    return {
      user,
      token: data.tokens.idToken,
    };
  },

  // Register
  async register(data: RegisterData): Promise<AuthResponse> {
    const response = await apiRequest('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Registration failed');
    }

    const result = await response.json();

    // After registration, log the user in
    return await this.login({
      email: data.email,
      password: data.password,
    });
  },

  /**
   * Remove everything this app stored locally for the user: tokens, cached
   * profile, autocomplete history (recent-*), and the cached-image database.
   */
  async clearLocalUserData(): Promise<void> {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith('recent-')) localStorage.removeItem(key);
    }
    closeImageDb();
    if (typeof indexedDB !== 'undefined') {
      await new Promise<void>((resolve) => {
        const request = indexedDB.deleteDatabase(IMAGE_DB_NAME);
        request.onsuccess = () => resolve();
        request.onerror = () => resolve();
        request.onblocked = () => resolve();
      });
    }
  },

  /** Account deletion in progress (this or another device): clean up and leave. */
  async handleAccountDeleting(): Promise<void> {
    if (handlingDeletion) return;
    handlingDeletion = true;
    await this.clearLocalUserData();
    this.notifyLoggedOut();
    if (typeof window !== 'undefined') {
      window.location.assign('/?account=deleting');
    }
  },

  // Logout
  async logout(): Promise<void> {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  },

  // Get current user (from token)
  async getCurrentUser(retriesLeft = 1): Promise<User | null> {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      return null;
    }

    try {
      const response = await authenticatedRequest('/user/profile', token, {
        method: 'GET',
      });

      if (await isAccountDeletingResponse(response)) {
        return null; // handled app-wide; never fall back to the cached user
      }

      if (!response.ok) {
        // Only attempt a refresh+retry on auth failures, and only a bounded
        // number of times, so a persistently failing profile endpoint (5xx)
        // can't spin refresh→retry forever.
        if (response.status === 401 && retriesLeft > 0) {
          const refreshed = await this.refreshToken();
          if (refreshed) {
            return await this.getCurrentUser(retriesLeft - 1);
          }
        }
        throw new Error('Failed to fetch user');
      }

      const data = await response.json();
      const user: User = {
        id: data.user.userId,
        email: data.user.email,
        name: data.user.name,
        createdAt: data.user.createdAt,
      };

      // Cache user data
      localStorage.setItem(USER_KEY, JSON.stringify(user));

      return user;
    } catch (error) {
      console.error('Error fetching user:', error);
      // Try to return cached user
      const cachedUser = localStorage.getItem(USER_KEY);
      if (cachedUser) {
        try {
          return JSON.parse(cachedUser);
        } catch {
          return null;
        }
      }
      return null;
    }
  },

  // Refresh token
  async refreshToken(): Promise<boolean> {
    const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
    if (!refreshToken) {
      return false;
    }

    try {
      const response = await apiRequest('/auth/refresh', {
        method: 'POST',
        body: JSON.stringify({ refreshToken }),
      });

      if (!response.ok) {
        // Refresh token is invalid, log out
        await this.logout();
        return false;
      }

      const data = await response.json();
      localStorage.setItem(TOKEN_KEY, data.tokens.idToken);

      return true;
    } catch (error) {
      console.error('Error refreshing token:', error);
      await this.logout();
      return false;
    }
  },

  // Request password reset
  async requestPasswordReset(data: PasswordResetRequest): Promise<void> {
    const response = await apiRequest('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Password reset request failed');
    }
  },

  // Reset password
  async resetPassword(email: string, newPassword: string, code: string): Promise<void> {
    const response = await apiRequest('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({
        email,
        newPassword,
        code,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Password reset failed');
    }
  },

  // Check if authenticated
  isAuthenticated(): boolean {
    return !!localStorage.getItem(TOKEN_KEY);
  },

  // Get token
  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  },

  /**
   * Authenticated fetch with automatic 401 recovery.
   *
   * Attaches the stored JWT, and on a 401 attempts a single token refresh
   * and one retry. If the refresh fails (or the retry still 401s), the
   * session is cleared, an `auth:logout` event is dispatched (so the app
   * can redirect to /login), and the error is surfaced to the caller.
   */
  async authFetch(url: string, options: RequestInit = {}): Promise<Response> {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      this.notifyLoggedOut();
      throw new Error('Not authenticated');
    }

    let response = await authenticatedRequest(url, token, options);

    if (await isAccountDeletingResponse(response)) {
      throw new Error('Your account is being deleted.');
    }

    if (response.status === 401) {
      const refreshed = await this.refreshToken();
      if (!refreshed) {
        this.notifyLoggedOut();
        throw new Error('Session expired');
      }

      const newToken = localStorage.getItem(TOKEN_KEY);
      if (!newToken) {
        this.notifyLoggedOut();
        throw new Error('Session expired');
      }

      response = await authenticatedRequest(url, newToken, options);

      if (response.status === 401) {
        await this.logout();
        this.notifyLoggedOut();
        throw new Error('Session expired');
      }
    }

    return response;
  },

  // Notify the app that the session ended so it can redirect to login.
  notifyLoggedOut(): void {
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      window.dispatchEvent(new CustomEvent('auth:logout'));
    }
  },

  // Update user name
  async updateUserName(userId: string, newName: string): Promise<User> {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      throw new Error('Not authenticated');
    }

    const response = await authenticatedRequest('/user/name', token, {
      method: 'PUT',
      body: JSON.stringify({ name: newName }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to update name');
    }

    // Fetch updated user
    const user = await this.getCurrentUser();
    if (!user) {
      throw new Error('Failed to fetch updated user');
    }

    return user;
  },
};

// Any authenticated response saying the account is being deleted triggers cleanup
setOnAccountDeleting(() => {
  void authService.handleAccountDeleting();
});
