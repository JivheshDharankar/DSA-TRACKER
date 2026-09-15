import { apiClient } from './client';
import { ApiResponse, DashboardData } from '../types';

export const fetchDashboardData = async (): Promise<DashboardData> => {
  const response = await apiClient.get<ApiResponse<DashboardData>>('/dashboard');
  if (!response.data.success || !response.data.data) {
    throw new Error(response.data.message || 'Failed to fetch dashboard analytics');
  }
  return response.data.data;
};
