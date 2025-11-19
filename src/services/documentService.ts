/**
 * Document Service
 * Handles all document-related API calls
 */

import { Document } from '../types/guitar';
import { authenticatedRequest, API_URL } from '../utils/api';
import { authService } from './authService';
import { guitarService } from './guitarService';

const getToken = () => {
  const token = authService.getToken();
  if (!token) {
    throw new Error('No authentication token found');
  }
  return token;
};

export const documentService = {
  /**
   * Get all documents for the current user
   */
  async list(): Promise<Document[]> {
    const response = await authenticatedRequest(`${API_URL}/documents`, getToken());

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to fetch documents');
    }

    const data = await response.json();
    return data.documents;
  },

  /**
   * Get a single document by ID
   */
  async get(id: string): Promise<Document> {
    const response = await authenticatedRequest(`${API_URL}/documents/${id}`, getToken());

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to fetch document');
    }

    const data = await response.json();
    return data.document;
  },

  /**
   * Upload a new document (PDF or image)
   * Returns the created document record
   */
  async upload(file: File): Promise<Document> {
    // Step 1: Upload file to S3 using existing guitar service method
    const url = await guitarService.uploadDocument(file);

    // Step 2: Create document record
    const response = await authenticatedRequest(`${API_URL}/documents`, getToken(), {
      method: 'POST',
      body: JSON.stringify({
        name: file.name,
        url,
        type: file.type === 'application/pdf' ? 'pdf' : 'image',
        contentType: file.type,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create document');
    }

    const data = await response.json();
    return data.document;
  },

  /**
   * Update document metadata (name, tags, notes)
   */
  async update(id: string, updates: { name?: string; tags?: string[]; notes?: string }): Promise<Document> {
    const response = await authenticatedRequest(`${API_URL}/documents/${id}`, getToken(), {
      method: 'PUT',
      body: JSON.stringify(updates),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to update document');
    }

    const data = await response.json();
    return data.document;
  },

  /**
   * Delete a document
   * Will also unassign it from all guitars
   */
  async delete(id: string): Promise<void> {
    const response = await authenticatedRequest(`${API_URL}/documents/${id}`, getToken(), {
      method: 'DELETE',
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to delete document');
    }
  },

  /**
   * Assign a document to a guitar
   */
  async assignToGuitar(guitarId: string, documentId: string): Promise<void> {
    const response = await authenticatedRequest(
      `${API_URL}/guitars/${guitarId}/documents/${documentId}`,
      getToken(),
      {
        method: 'POST',
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to assign document to guitar');
    }
  },

  /**
   * Unassign a document from a guitar
   */
  async unassignFromGuitar(guitarId: string, documentId: string): Promise<void> {
    const response = await authenticatedRequest(
      `${API_URL}/guitars/${guitarId}/documents/${documentId}`,
      getToken(),
      {
        method: 'DELETE',
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to unassign document from guitar');
    }
  },

  /**
   * Assign multiple documents to a guitar at once
   */
  async assignMultipleToGuitar(guitarId: string, documentIds: string[]): Promise<void> {
    for (const documentId of documentIds) {
      await this.assignToGuitar(guitarId, documentId);
    }
  },

  /**
   * Unassign multiple documents from a guitar at once
   */
  async unassignMultipleFromGuitar(guitarId: string, documentIds: string[]): Promise<void> {
    for (const documentId of documentIds) {
      await this.unassignFromGuitar(guitarId, documentId);
    }
  },

  /**
   * Trigger content extraction for a document
   */
  async triggerExtraction(id: string): Promise<void> {
    const response = await authenticatedRequest(
      `${API_URL}/documents/${id}/extract`,
      getToken(),
      {
        method: 'POST',
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to trigger extraction');
    }
  },
};
