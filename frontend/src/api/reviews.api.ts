import { apiClient } from './client';
import {
  ApiResponse,
  PaginatedProblems,
  PaginatedHistory,
  DueQueryParams,
  SubmitReviewPayload,
  ReviewSubmissionResult,
} from '../types';

export const fetchDueReviews = async (params?: DueQueryParams): Promise<PaginatedProblems> => {
  const response = await apiClient.get<ApiResponse<PaginatedProblems>>('/reviews/due', {
    params,
  });
  if (!response.data.success || !response.data.data) {
    throw new Error(response.data.message || 'Failed to fetch due reviews');
  }
  return response.data.data;
};

export const submitReview = async (
  payload: SubmitReviewPayload
): Promise<ReviewSubmissionResult> => {
  const response = await apiClient.post<ApiResponse<ReviewSubmissionResult>>('/reviews', payload);
  if (!response.data.success || !response.data.data) {
    throw new Error(response.data.message || 'Failed to submit revision');
  }
  return response.data.data;
};

export const fetchProblemHistory = async (
  problemId: string,
  page: number = 1,
  limit: number = 50
): Promise<PaginatedHistory> => {
  const response = await apiClient.get<ApiResponse<PaginatedHistory>>(
    `/reviews/problem/${problemId}`,
    { params: { page, limit } }
  );
  if (!response.data.success || !response.data.data) {
    throw new Error(response.data.message || 'Failed to fetch revision history');
  }
  return response.data.data;
};

export const fetchUserReviewHistory = async (
  page: number = 1,
  limit: number = 20
): Promise<PaginatedHistory> => {
  const response = await apiClient.get<ApiResponse<PaginatedHistory>>('/reviews/history', {
    params: { page, limit },
  });
  if (!response.data.success || !response.data.data) {
    throw new Error(response.data.message || 'Failed to fetch user review history');
  }
  return response.data.data;
};
