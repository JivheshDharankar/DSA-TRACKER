import { apiClient } from './client';
import {
  ApiResponse,
  ProblemMasteryDetails,
  MasteryEvaluateResponse,
  ProblemMasteryOverviewItem,
} from '../types';

/**
 * Fetches current mastery status and 4-gate qualification breakdown for a problem.
 */
export const fetchProblemMastery = async (
  problemId: string
): Promise<ProblemMasteryDetails> => {
  const response = await apiClient.get<ApiResponse<ProblemMasteryDetails>>(
    `/problems/${problemId}/mastery`
  );
  if (!response.data.success || !response.data.data) {
    throw new Error(response.data.error?.message || 'Failed to load mastery details');
  }
  return response.data.data;
};

/**
 * Triggers server-side evaluation of all 4 gates and transitions to LOCKED if eligible.
 */
export const evaluateProblemMastery = async (
  problemId: string
): Promise<MasteryEvaluateResponse> => {
  const response = await apiClient.post<ApiResponse<MasteryEvaluateResponse>>(
    `/problems/${problemId}/mastery/evaluate`
  );
  if (!response.data.success || !response.data.data) {
    throw new Error(response.data.error?.message || 'Failed to evaluate mastery');
  }
  return response.data.data;
};

/**
 * Bulk fetches all user problems with their 4-gate mastery qualification status (Zero N+1).
 */
export const fetchMasteryOverview = async (): Promise<ProblemMasteryOverviewItem[]> => {
  const response = await apiClient.get<ApiResponse<ProblemMasteryOverviewItem[]>>(
    '/mastery/overview'
  );
  if (!response.data.success || !response.data.data) {
    throw new Error(response.data.error?.message || 'Failed to load mastery overview');
  }
  return response.data.data;
};
