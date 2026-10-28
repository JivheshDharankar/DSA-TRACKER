import { apiClient } from './client';
import {
  ApiResponse,
  Problem,
  PaginatedProblems,
  ProblemQueryParams,
  CreateProblemInput,
  UpdateProblemInput,
  LeetcodeImportPreview,
} from '../types';

export const fetchProblems = async (params: ProblemQueryParams): Promise<PaginatedProblems> => {
  const response = await apiClient.get<ApiResponse<PaginatedProblems>>('/problems', {
    params,
  });
  if (!response.data.success || !response.data.data) {
    throw new Error(response.data.message || 'Failed to fetch problems');
  }
  return response.data.data;
};

export const fetchProblemById = async (id: string): Promise<Problem> => {
  const response = await apiClient.get<ApiResponse<{ problem: Problem }>>(`/problems/${id}`);
  if (!response.data.success || !response.data.data) {
    throw new Error(response.data.message || 'Problem not found');
  }
  return response.data.data.problem;
};

/**
 * Asks the backend for LeetCode metadata for a pasted problem URL.
 * A 200 response with `status: 'UNAVAILABLE'` is the supported fallback, not an error.
 */
export const importLeetcodeProblem = async (url: string): Promise<LeetcodeImportPreview> => {
  const response = await apiClient.post<ApiResponse<LeetcodeImportPreview>>(
    '/problems/import/leetcode',
    { url }
  );
  if (!response.data.success || !response.data.data) {
    throw new Error(response.data.message || 'Failed to import LeetCode problem');
  }
  return response.data.data;
};

export const createProblem = async (data: CreateProblemInput): Promise<Problem> => {
  const response = await apiClient.post<ApiResponse<{ problem: Problem }>>('/problems', data);
  if (!response.data.success || !response.data.data) {
    throw new Error(response.data.message || 'Failed to create problem');
  }
  return response.data.data.problem;
};

export const updateProblem = async (id: string, data: UpdateProblemInput): Promise<Problem> => {
  const response = await apiClient.patch<ApiResponse<{ problem: Problem }>>(`/problems/${id}`, data);
  if (!response.data.success || !response.data.data) {
    throw new Error(response.data.message || 'Failed to update problem');
  }
  return response.data.data.problem;
};

export const deleteProblem = async (id: string): Promise<void> => {
  const response = await apiClient.delete<ApiResponse<null>>(`/problems/${id}`);
  if (!response.data.success) {
    throw new Error(response.data.message || 'Failed to delete problem');
  }
};
