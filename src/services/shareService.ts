import { Share, ShareFormData, PublicShareData, ShareListItem } from '../types/guitar';
import { authService } from './authService';
import { authenticatedRequest, API_URL } from '../utils/api';

// Helper to get authenticated token
const getToken = () => {
  const token = authService.getToken();
  if (!token) {
    throw new Error('Not authenticated');
  }
  return token;
};

export const shareService = {
  // Create a new share
  async createShare(data: ShareFormData): Promise<Share> {
    const response = await authenticatedRequest('/shares', getToken(), {
      method: 'POST',
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create share');
    }

    const result = await response.json();
    return result.share;
  },

  // Get all shares for the current user
  async getShares(): Promise<ShareListItem[]> {
    const response = await authenticatedRequest('/shares', getToken(), {
      method: 'GET',
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to fetch shares');
    }

    const result = await response.json();
    return result.shares || [];
  },

  // Get a specific share by ID
  async getShare(shareId: string): Promise<Share> {
    const response = await authenticatedRequest(`/shares/${shareId}`, getToken(), {
      method: 'GET',
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to fetch share');
    }

    const result = await response.json();
    return result.share;
  },

  // Update a share
  async updateShare(shareId: string, data: Partial<ShareFormData> & { isActive?: boolean }): Promise<Share> {
    const response = await authenticatedRequest(`/shares/${shareId}`, getToken(), {
      method: 'PATCH',
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to update share');
    }

    const result = await response.json();
    return result.share;
  },

  // Delete a share
  async deleteShare(shareId: string): Promise<void> {
    const response = await authenticatedRequest(`/shares/${shareId}`, getToken(), {
      method: 'DELETE',
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to delete share');
    }
  },

  // Get public share data (no authentication required)
  async getPublicShare(shareId: string): Promise<PublicShareData> {
    try {
      const response = await fetch(`${API_URL}/public/shares/${shareId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Share not found');
        }
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch share');
      }

      return response.json();
    } catch (error) {
      console.error('Error fetching public share:', error);
      throw error;
    }
  },

  // Copy share URL to clipboard
  async copyShareUrl(shareUrl: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(shareUrl);
    } catch (error) {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = shareUrl;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
    }
  },
};
