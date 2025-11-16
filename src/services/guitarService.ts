import { Guitar, GuitarFilters, GuitarFormData } from '../types/guitar';
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

export const guitarService = {
  // Get all guitars with optional filtering
  async getGuitars(filters?: GuitarFilters, userId?: string): Promise<Guitar[]> {
    const params = new URLSearchParams();

    if (filters?.search) params.append('search', filters.search);
    if (filters?.brand) params.append('brand', filters.brand);
    if (filters?.type) params.append('type', filters.type);
    if (filters?.yearMin) params.append('yearMin', filters.yearMin.toString());
    if (filters?.yearMax) params.append('yearMax', filters.yearMax.toString());

    const queryString = params.toString();
    const url = `/guitars${queryString ? `?${queryString}` : ''}`;

    const response = await authenticatedRequest(url, getToken(), {
      method: 'GET',
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to fetch guitars');
    }

    const data = await response.json();
    return data.guitars || [];
  },

  // Get single guitar by ID
  async getGuitar(id: string, userId?: string): Promise<Guitar | null> {
    const response = await authenticatedRequest(`/guitars/${id}`, getToken(), {
      method: 'GET',
    });

    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      const error = await response.json();
      throw new Error(error.error || 'Failed to fetch guitar');
    }

    const data = await response.json();
    return data.guitar;
  },

  // Create new guitar
  async createGuitar(data: GuitarFormData): Promise<Guitar> {
    const response = await authenticatedRequest('/guitars', getToken(), {
      method: 'POST',
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create guitar');
    }

    const result = await response.json();
    return result.guitar;
  },

  // Update existing guitar
  async updateGuitar(id: string, data: Partial<GuitarFormData>, userId?: string): Promise<Guitar> {
    const response = await authenticatedRequest(`/guitars/${id}`, getToken(), {
      method: 'PUT',
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to update guitar');
    }

    const result = await response.json();
    return result.guitar;
  },

  // Delete guitar
  async deleteGuitar(id: string, userId?: string): Promise<void> {
    const response = await authenticatedRequest(`/guitars/${id}`, getToken(), {
      method: 'DELETE',
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to delete guitar');
    }
  },

  // Get unique brands for filtering
  async getBrands(userId?: string): Promise<string[]> {
    const response = await authenticatedRequest('/guitars/brands', getToken(), {
      method: 'GET',
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to fetch brands');
    }

    const data = await response.json();
    return data.brands || [];
  },

  // Upload image to S3
  async uploadImage(
    file: File,
    onProgress?: (progress: number) => void
  ): Promise<string> {
    // Step 1: Get presigned upload URL
    const urlResponse = await authenticatedRequest('/images/upload-url', getToken(), {
      method: 'POST',
      body: JSON.stringify({
        fileName: file.name,
        fileType: file.type,
      }),
    });

    if (!urlResponse.ok) {
      const error = await urlResponse.json();
      throw new Error(error.error || 'Failed to get upload URL');
    }

    const { uploadUrl, imageKey } = await urlResponse.json();

    // Step 2: Upload file directly to S3 using XMLHttpRequest for progress tracking
    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      // Track upload progress
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable && onProgress) {
          const percentComplete = (e.loaded / e.total) * 100;
          onProgress(percentComplete);
        }
      });

      // Handle completion
      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve();
        } else {
          reject(new Error('Failed to upload image to S3'));
        }
      });

      // Handle errors
      xhr.addEventListener('error', () => {
        reject(new Error('Failed to upload image to S3'));
      });

      xhr.addEventListener('abort', () => {
        reject(new Error('Upload cancelled'));
      });

      // Start upload
      xhr.open('PUT', uploadUrl);
      xhr.setRequestHeader('Content-Type', file.type);
      xhr.send(file);
    });

    // Step 3: Notify backend that upload is complete
    const completeResponse = await authenticatedRequest('/images/upload-complete', getToken(), {
      method: 'POST',
      body: JSON.stringify({ imageKey }),
    });

    if (!completeResponse.ok) {
      const error = await completeResponse.json();
      throw new Error(error.error || 'Failed to complete image upload');
    }

    const { imageUrl } = await completeResponse.json();
    return imageUrl;
  },

  // Extract guitar specs from uploaded file (PDF or TXT)
  async extractSpecsFromFile(file: File): Promise<any> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await authenticatedRequest('/specs/extract', getToken(), {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to extract specifications');
    }

    return response.json();
  },

  // Extract guitar specs from pasted text
  async extractSpecsFromText(text: string): Promise<any> {
    const response = await authenticatedRequest('/specs/extract', getToken(), {
      method: 'POST',
      body: JSON.stringify({ text }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to extract specifications');
    }

    return response.json();
  },

  // Extract receipt information from uploaded file (PDF or TXT)
  async extractReceiptFromFile(file: File): Promise<any> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await authenticatedRequest('/receipts/extract', getToken(), {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to extract receipt information');
    }

    return response.json();
  },

  // Extract receipt information from pasted text
  async extractReceiptFromText(text: string): Promise<any> {
    const response = await authenticatedRequest('/receipts/extract', getToken(), {
      method: 'POST',
      body: JSON.stringify({ text }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to extract receipt information');
    }

    return response.json();
  },

  // Upload document (PDF or image) - uses same S3 upload flow as images
  async uploadDocument(file: File): Promise<string> {
    // Step 1: Get presigned upload URL
    const urlResponse = await authenticatedRequest('/images/upload-url', getToken(), {
      method: 'POST',
      body: JSON.stringify({
        fileName: file.name,
        fileType: file.type,
      }),
    });

    if (!urlResponse.ok) {
      const error = await urlResponse.json();
      throw new Error(error.error || 'Failed to get upload URL');
    }

    const { uploadUrl, imageKey } = await urlResponse.json();

    // Step 2: Upload file directly to S3
    const uploadResponse = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': file.type,
      },
      body: file,
    });

    if (!uploadResponse.ok) {
      throw new Error('Failed to upload document to S3');
    }

    // Step 3: Notify backend that upload is complete
    const completeResponse = await authenticatedRequest('/images/upload-complete', getToken(), {
      method: 'POST',
      body: JSON.stringify({ imageKey }),
    });

    if (!completeResponse.ok) {
      const error = await completeResponse.json();
      throw new Error(error.error || 'Failed to complete document upload');
    }

    const { imageUrl } = await completeResponse.json();
    return imageUrl;
  },

  // Get random public guitar (no authentication required)
  async getRandomPublicGuitar(): Promise<Guitar | null> {
    try {
      const response = await fetch(`${API_URL}/public/guitars/random`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 404) {
          return null;
        }
        throw new Error('Failed to fetch random guitar');
      }

      return response.json();
    } catch (error) {
      console.error('Error fetching random public guitar:', error);
      return null;
    }
  },
};
