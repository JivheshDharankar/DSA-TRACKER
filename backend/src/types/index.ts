export interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
  error?: {
    message: string;
    code: string;
    details?: unknown;
  };
}

export interface HealthCheckData {
  status: 'healthy' | 'unhealthy';
  uptimeSeconds: number;
  timestamp: string;
  environment: string;
  database: {
    connected: boolean;
    state: string;
  };
}

export interface AuthUser {
  userId: string;
  email: string;
  name: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}
