import { ProvenanceReport, ProvenanceReportSummary } from '../types/guitar';
import { authService } from './authService';
import { authenticatedRequest } from '../utils/api';

// Helper to get authenticated token
const getToken = () => {
  const token = authService.getToken();
  if (!token) {
    throw new Error('Not authenticated');
  }
  return token;
};

export const provenanceService = {
  /**
   * Generate a new provenance report or sales ad for a guitar
   */
  async generateReport(
    guitarId: string,
    type: 'provenance' | 'sales_ad' = 'provenance'
  ): Promise<{ id: string; version: number; generatedAt: string; type: string }> {
    const response = await authenticatedRequest(
      `/guitars/${encodeURIComponent(guitarId)}/provenance`,
      getToken(),
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ type }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || `Failed to generate ${type === 'sales_ad' ? 'sales ad' : 'provenance report'}`);
    }

    const data = await response.json();
    return data.report;
  },

  /**
   * List all reports for a guitar, optionally filtered by type
   */
  async listReports(guitarId: string, type?: 'provenance' | 'sales_ad'): Promise<ProvenanceReportSummary[]> {
    const url = type
      ? `/guitars/${encodeURIComponent(guitarId)}/provenance?type=${type}`
      : `/guitars/${encodeURIComponent(guitarId)}/provenance`;

    const response = await authenticatedRequest(url, getToken(), {
      method: 'GET',
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to list reports');
    }

    const data = await response.json();
    return data.reports || [];
  },

  /**
   * Get a specific provenance report
   */
  async getReport(guitarId: string, reportId: string): Promise<ProvenanceReport> {
    const response = await authenticatedRequest(
      `/guitars/${encodeURIComponent(guitarId)}/provenance/${encodeURIComponent(reportId)}`,
      getToken(),
      {
        method: 'GET',
      }
    );

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('Provenance report not found');
      }
      const error = await response.json();
      throw new Error(error.error || 'Failed to fetch provenance report');
    }

    const data = await response.json();
    return data.report;
  },

  /**
   * Delete a specific report (provenance or sales ad)
   */
  async deleteReport(guitarId: string, reportId: string): Promise<void> {
    const response = await authenticatedRequest(
      `/guitars/${encodeURIComponent(guitarId)}/provenance/${encodeURIComponent(reportId)}`,
      getToken(),
      {
        method: 'DELETE',
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to delete report');
    }
  },
};
