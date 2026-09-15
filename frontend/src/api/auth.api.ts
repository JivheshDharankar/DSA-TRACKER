import { apiClient } from './client';
import { ApiResponse, User, RegisterCredentials, LoginCredentials } from '../types';

export const registerUser = async (credentials: RegisterCredentials): Promise<User> => {
  const response = await apiClient.post<ApiResponse<{ user: User }>>('/auth/register', credentials);
  if (!response.data.success || !response.data.data) {
    throw new Error(response.data.message || 'Registration failed');
  }
  return response.data.data.user;
};

export const loginUser = async (credentials: LoginCredentials): Promise<User> => {
  const response = await apiClient.post<ApiResponse<{ user: User }>>('/auth/login', credentials);
  if (!response.data.success || !response.data.data) {
    throw new Error(response.data.message || 'Login failed');
  }
  return response.data.data.user;
};

export const logoutUser = async (): Promise<void> => {
  await apiClient.post<ApiResponse<null>>('/auth/logout');
};

export const fetchCurrentUser = async (): Promise<User> => {
  const response = await apiClient.get<ApiResponse<{ user: User }>>('/auth/me');
  if (!response.data.success || !response.data.data) {
    throw new Error(response.data.message || 'Authentication check failed');
  }
  return response.data.data.user;
};
