/**
 * Account data export and deletion (GTR-14).
 *
 * Uses authenticatedRequest directly (not authService.authFetch): a wrong
 * password is a 401 here, which authFetch would mistake for an expired token
 * and "recover" by refreshing and retrying the same password.
 */

import { authenticatedRequest } from '../utils/api';
import { authService } from './authService';

export type ExportStatus = 'none' | 'pending' | 'processing' | 'ready' | 'failed' | 'expired';

export interface ExportJob {
  status: ExportStatus;
  jobId?: string;
  createdAt?: string;
  completedAt?: string;
  sizeBytes?: number;
  availableUntil?: string;
  downloadUrl?: string;
  reason?: 'too_large' | 'timeout' | 'cancelled' | 'error' | string;
}

/** Error returned by the account endpoints, with the API's machine-readable code. */
export class AccountApiError extends Error {
  code?: string;
  status: number;
  job?: ExportJob;
  retryAfter?: string;

  constructor(message: string, status: number, body: Record<string, unknown> = {}) {
    super(message);
    this.name = 'AccountApiError';
    this.status = status;
    this.code = body.code as string | undefined;
    this.job = body.job as ExportJob | undefined;
    this.retryAfter = body.retryAfter as string | undefined;
  }
}

async function call(path: string, init: RequestInit = {}): Promise<{ status: number; body: Record<string, unknown> }> {
  const token = authService.getToken();
  if (!token) {
    throw new AccountApiError('Not signed in', 401, { code: 'NOT_AUTHENTICATED' });
  }
  const response = await authenticatedRequest(path, token, init);
  let body: Record<string, unknown> = {};
  try {
    body = await response.json();
  } catch {
    body = {};
  }
  return { status: response.status, body };
}

export const accountService = {
  /** Start an export. Throws AccountApiError (WRONG_PASSWORD, TOO_MANY_ATTEMPTS, EXPORT_RATE_LIMITED, …). */
  async startExport(password: string): Promise<ExportJob> {
    const { status, body } = await call('/user/export', {
      method: 'POST',
      body: JSON.stringify({ password }),
    });
    if (status !== 202) {
      throw new AccountApiError((body.error as string) || 'Could not start the export', status, body);
    }
    return body as unknown as ExportJob;
  },

  /** Latest export for the signed-in user ({status: 'none'} if there is none). */
  async getExportStatus(): Promise<ExportJob> {
    const { status, body } = await call('/user/export', { method: 'GET' });
    if (status === 404) return { status: 'none' };
    if (status !== 200) {
      throw new AccountApiError((body.error as string) || 'Could not load the export status', status, body);
    }
    return body as unknown as ExportJob;
  },

  /** Request account deletion. Throws AccountApiError on a wrong password or lockout. */
  async requestDeletion(password: string): Promise<void> {
    const { status, body } = await call('/user/deletion', {
      method: 'POST',
      body: JSON.stringify({ password }),
    });
    if (status !== 202) {
      throw new AccountApiError((body.error as string) || 'Could not delete the account', status, body);
    }
  },
};
