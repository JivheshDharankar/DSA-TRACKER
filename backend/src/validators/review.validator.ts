import { z } from 'zod';

const recallResultEnum = z.enum(['EASY', 'STRUGGLED', 'HINT', 'FORGOT'], {
  errorMap: () => ({
    message: 'recallResult must be one of: EASY, STRUGGLED, HINT, FORGOT',
  }),
});

const sectionEnum = z.enum(['COLLEGE', 'PERSONAL'], {
  errorMap: () => ({ message: 'Section must be either COLLEGE or PERSONAL' }),
});

export const submitReviewSchema = z
  .object({
    problemId: z
      .string({ required_error: 'problemId is required' })
      .trim()
      .min(1, 'problemId cannot be empty'),
    recallResult: recallResultEnum,
    timeSpentSeconds: z
      .number()
      .int('timeSpentSeconds must be an integer')
      .min(0, 'timeSpentSeconds cannot be negative')
      .max(86400, 'timeSpentSeconds cannot exceed 86400 seconds (24 hours)')
      .optional()
      .nullable(),
    coldSolve: z.boolean().optional().nullable(),
    // Strictly prohibit client manipulation of scheduling, identity, and timestamps
    userId: z.never({ invalid_type_error: 'userId cannot be supplied by client' }).optional(),
    scheduledReviewAt: z
      .never({ invalid_type_error: 'scheduledReviewAt is server-calculated' })
      .optional(),
    reviewedAt: z.never({ invalid_type_error: 'reviewedAt is server-generated' }).optional(),
    latenessDays: z.never({ invalid_type_error: 'latenessDays is server-calculated' }).optional(),
    timingStatus: z.never({ invalid_type_error: 'timingStatus is server-calculated' }).optional(),
    previousStage: z.never({ invalid_type_error: 'previousStage is server-derived' }).optional(),
    newStage: z.never({ invalid_type_error: 'newStage is server-derived' }).optional(),
    previousIntervalDays: z
      .never({ invalid_type_error: 'previousIntervalDays is server-derived' })
      .optional(),
    newIntervalDays: z
      .never({ invalid_type_error: 'newIntervalDays is server-derived' })
      .optional(),
    previousRetention: z
      .never({ invalid_type_error: 'previousRetention is server-derived' })
      .optional(),
    newRetention: z.never({ invalid_type_error: 'newRetention is server-derived' }).optional(),
    nextReviewDate: z
      .never({ invalid_type_error: 'nextReviewDate is server-calculated' })
      .optional(),
    previousNextReviewDate: z
      .never({ invalid_type_error: 'previousNextReviewDate is server-derived' })
      .optional(),
    newNextReviewDate: z
      .never({ invalid_type_error: 'newNextReviewDate is server-derived' })
      .optional(),
  })
  .strict();

export const listDueReviewsQuerySchema = z.object({
  section: sectionEnum.optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const listReviewHistoryQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export type SubmitReviewInput = z.infer<typeof submitReviewSchema>;
export type ListDueReviewsQuery = z.infer<typeof listDueReviewsQuerySchema>;
export type ListReviewHistoryQuery = z.infer<typeof listReviewHistoryQuerySchema>;
