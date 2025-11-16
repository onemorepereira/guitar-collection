import {
  User,
  LoginCredentials,
  RegisterData,
  PasswordResetRequest,
  AuthResponse,
} from '../types/auth';
import { apiRequest, authenticatedRequest, API_URL } from '../utils/api';

// Local storage keys
const TOKEN_KEY = 'guitar-collection-token';
const REFRESH_TOKEN_KEY = 'guitar-collection-refresh-token';
const USER_KEY = 'guitar-collection-user';

export const authService = {
  // Login
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    const response = await apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Login failed');
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

  // Logout
  async logout(): Promise<void> {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  },

  // Get current user (from token)
  async getCurrentUser(): Promise<User | null> {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      return null;
    }

    try {
      const response = await authenticatedRequest('/user/profile', token, {
        method: 'GET',
      });

      if (!response.ok) {
        // Token might be expired, try to refresh
        const refreshed = await this.refreshToken();
        if (refreshed) {
          // Retry with new token
          return await this.getCurrentUser();
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
