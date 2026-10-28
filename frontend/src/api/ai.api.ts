import { apiClient } from './client';
import {
  AiFeature,
  AiGenerationResponse,
  AiHintLevel,
  AiStatus,
  ApiResponse,
} from '../types';

/**
 * DSA Tracker — AI assistance API (Phase 2B)
 * =========================================
 * The browser never talks to Gemini: these calls go to our backend, which owns the key.
 *
 * The AI endpoints need a longer budget than the 10s default, because a hard problem with
 * structured output can take a while. 45s sits above the backend's own provider timeout,
 * so the user normally sees the backend's clear error rather than a client abort.
 */
const AI_REQUEST_TIMEOUT_MS = 45_000;

export interface GenerateAiInput {
  feature: AiFeature;
  level?: AiHintLevel;
  /** The user's own saved notes/code — only accepted for complexity analysis. */
  code?: string;
}

export const fetchAiStatus = async (): Promise<AiStatus> => {
  const response = await apiClient.get<ApiResponse<AiStatus>>('/ai/status');
  if (!response.data.success || !response.data.data) {
    throw new Error(response.data.message || 'Failed to read AI availability');
  }
  return response.data.data;
};

export const generateAiAssistance = async (
  problemId: string,
  input: GenerateAiInput
): Promise<AiGenerationResponse> => {
  const response = await apiClient.post<ApiResponse<AiGenerationResponse>>(
    `/ai/problems/${problemId}/generate`,
    input,
    { timeout: AI_REQUEST_TIMEOUT_MS }
  );

  if (!response.data.success || !response.data.data) {
    throw new Error(response.data.message || 'AI assistance is unavailable');
  }

  return response.data.data;
};
