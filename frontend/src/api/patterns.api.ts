import { apiClient } from './client';
import {
  ApiResponse,
  PatternWithMastery,
  PatternDetailResponse,
  ProblemPatternAttachment,
  PatternConfidence,
} from '../types';

export const fetchPatterns = async (search?: string): Promise<PatternWithMastery[]> => {
  const response = await apiClient.get<ApiResponse<PatternWithMastery[]>>('/patterns', {
    params: search ? { search } : undefined,
  });
  if (!response.data.success || !response.data.data) {
    throw new Error(response.data.message || 'Failed to fetch patterns');
  }
  return response.data.data;
};

export const fetchPatternDetail = async (idOrSlug: string): Promise<PatternDetailResponse> => {
  const response = await apiClient.get<ApiResponse<PatternDetailResponse>>(`/patterns/${idOrSlug}`);
  if (!response.data.success || !response.data.data) {
    throw new Error(response.data.message || 'Failed to fetch pattern details');
  }
  return response.data.data;
};

export const fetchProblemPatterns = async (
  problemId: string
): Promise<ProblemPatternAttachment[]> => {
  const response = await apiClient.get<ApiResponse<ProblemPatternAttachment[]>>(
    `/problems/${problemId}/patterns`
  );
  if (!response.data.success || !response.data.data) {
    throw new Error(response.data.message || 'Failed to fetch problem patterns');
  }
  return response.data.data;
};

export const attachPatternToProblem = async (
  problemId: string,
  payload: {
    patternId: string;
    confidence?: PatternConfidence;
    isPrimary?: boolean;
  }
): Promise<unknown> => {
  const response = await apiClient.post<ApiResponse<unknown>>(
    `/problems/${problemId}/patterns`,
    payload
  );
  if (!response.data.success) {
    throw new Error(response.data.message || 'Failed to attach pattern');
  }
  return response.data.data;
};

export const detachPatternFromProblem = async (
  problemId: string,
  patternId: string
): Promise<void> => {
  const response = await apiClient.delete<ApiResponse<void>>(
    `/problems/${problemId}/patterns/${patternId}`
  );
  if (!response.data.success) {
    throw new Error(response.data.message || 'Failed to detach pattern');
  }
};

export const syncProblemPatterns = async (
  problemId: string,
  patterns: Array<{
    patternId: string;
    confidence?: PatternConfidence;
    isPrimary?: boolean;
  }>
): Promise<ProblemPatternAttachment[]> => {
  const response = await apiClient.put<ApiResponse<ProblemPatternAttachment[]>>(
    `/problems/${problemId}/patterns/sync`,
    { patterns }
  );
  if (!response.data.success || !response.data.data) {
    throw new Error(response.data.message || 'Failed to sync patterns');
  }
  return response.data.data;
};
