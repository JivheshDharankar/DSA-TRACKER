import axios, { AxiosError } from 'axios';
import { ApiResponse } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api/v1';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true, // Enables sending/receiving secure HTTP-only cookies
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
});

// Response interceptor for consistent error extraction
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError<ApiResponse>) => {
    const errorPayload = error.response?.data?.error || {
      message: error.message || 'Network communication error',
      code: 'NETWORK_ERROR',
    };
    return Promise.reject(errorPayload);
  }
);
