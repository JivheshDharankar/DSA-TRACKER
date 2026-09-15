import { apiClient } from './client';
import { ApiResponse, HealthCheckData } from '../types';

export const checkApiHealth = async (): Promise<HealthCheckData> => {
  const response = await apiClient.get<ApiResponse<HealthCheckData>>('/health');
  if (!response.data.success || !response.data.data) {
    throw new Error(response.data.message || 'Health check failed');
  }
  return response.data.data;
};
