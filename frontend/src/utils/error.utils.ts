/**
 * Error extraction utility to safely retrieve human-readable error messages
 * from Axios error payloads, standard Error instances, or unknown throwables.
 */
export const getErrorMessage = (
  err: unknown,
  fallback: string = 'An unexpected error occurred.'
): string => {
  if (!err) {
    return fallback;
  }

  if (typeof err === 'string') {
    return err;
  }

  if (err instanceof Error && err.message) {
    return err.message;
  }

  if (typeof err === 'object' && err !== null) {
    // Interceptor rejects errorPayload: { message: string, code?: string }
    const errorObj = err as Record<string, unknown>;
    if (typeof errorObj['message'] === 'string' && errorObj['message'].trim().length > 0) {
      return errorObj['message'];
    }
  }

  return fallback;
};
