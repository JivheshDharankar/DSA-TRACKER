import { z } from 'zod';

const difficultyEnum = z.enum(['Easy', 'Medium', 'Hard'], {
  errorMap: () => ({ message: 'Difficulty must be one of: Easy, Medium, Hard' }),
});

const statusEnum = z.enum(['Not Started', 'Attempted', 'Solved'], {
  errorMap: () => ({ message: 'Status must be one of: Not Started, Attempted, Solved' }),
});

const retentionEnum = z.enum(['Learning', 'Familiar', 'Independent', 'Strong', 'Locked'], {
  errorMap: () => ({
    message: 'Retention level must be one of: Learning, Familiar, Independent, Strong, Locked',
  }),
});

const sectionEnum = z.enum(['COLLEGE', 'PERSONAL'], {
  errorMap: () => ({ message: 'Section must be either COLLEGE or PERSONAL' }),
});

// Helper for optional URLs that can be undefined, null, or empty string.
// Strictly requires valid web URLs with http:// or https:// protocol, rejecting javascript:, data:, and other executable schemes.
const optionalUrlSchema = z
  .string()
  .trim()
  .refine(
    (val) => {
      if (!val || val === '') return true;
      try {
        const parsed = new URL(val);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:';
      } catch {
        return false;
      }
    },
    { message: 'Must be a valid web URL starting with http:// or https://' }
  )
  .optional()
  .nullable()
  .or(z.literal(''))
  .transform((val) => (val && val.trim() !== '' ? val.trim() : null));

export const createProblemSchema = z.object({
  section: sectionEnum,
  title: z
    .string({ required_error: 'Problem title is required' })
    .trim()
    .min(1, 'Problem title cannot be empty')
    .max(200, 'Problem title cannot exceed 200 characters'),
  collegeLink: optionalUrlSchema.optional(),
  leetcodeLink: optionalUrlSchema.optional(),
  leetcodeNumber: z
    .number()
    .int('LeetCode number must be an integer')
    .positive('LeetCode number must be a positive integer')
    .optional()
    .nullable(),
  topic: z
    .string({ required_error: 'Topic is required' })
    .trim()
    .min(1, 'Topic cannot be empty')
    .max(80, 'Topic cannot exceed 80 characters'),
  difficulty: difficultyEnum,
  source: z
    .string({ required_error: 'Source is required' })
    .trim()
    .min(1, 'Source cannot be empty')
    .max(80, 'Source cannot exceed 80 characters'),
  dateLearned: z.coerce.date().optional(),
  status: statusEnum.default('Not Started'),
  retentionLevel: retentionEnum.default('Learning'),
  notes: z.string().max(10000, 'Notes cannot exceed 10,000 characters').optional().default(''),
});

export const updateProblemSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, 'Problem title cannot be empty')
      .max(200, 'Problem title cannot exceed 200 characters')
      .optional(),
    collegeLink: optionalUrlSchema.optional(),
    leetcodeLink: optionalUrlSchema.optional(),
    leetcodeNumber: z
      .number()
      .int('LeetCode number must be an integer')
      .positive('LeetCode number must be a positive integer')
      .optional()
      .nullable(),
    topic: z
      .string()
      .trim()
      .min(1, 'Topic cannot be empty')
      .max(80, 'Topic cannot exceed 80 characters')
      .optional(),
    difficulty: difficultyEnum.optional(),
    source: z
      .string()
      .trim()
      .min(1, 'Source cannot be empty')
      .max(80, 'Source cannot exceed 80 characters')
      .optional(),
    dateLearned: z.coerce.date().optional(),
    status: statusEnum.optional(),
    retentionLevel: retentionEnum.optional(),
    notes: z.string().max(10000, 'Notes cannot exceed 10,000 characters').optional(),
    // Explicitly reject system-controlled, ownership, and immutable fields
    section: z.never({ invalid_type_error: 'Changing problem section after creation is prohibited' }).optional(),
    userId: z.never({ invalid_type_error: 'userId cannot be supplied by client' }).optional(),
    _id: z.never({ invalid_type_error: '_id cannot be modified' }).optional(),
    sNo: z.never({ invalid_type_error: 'sNo is system-generated and cannot be modified' }).optional(),
    problemLink: z.never({ invalid_type_error: 'problemLink is deprecated; use collegeLink or leetcodeLink' }).optional(),
    repetitionStage: z.never({ invalid_type_error: 'repetitionStage is server-controlled' }).optional(),
    intervalDays: z.never({ invalid_type_error: 'intervalDays is server-controlled' }).optional(),
    nextReviewDate: z.never({ invalid_type_error: 'nextReviewDate is server-controlled' }).optional(),
    lastReviewedAt: z.never({ invalid_type_error: 'lastReviewedAt is server-controlled' }).optional(),
    recoveryStage: z.never({ invalid_type_error: 'recoveryStage is server-controlled' }).optional(),
    masteryStatus: z.never({ invalid_type_error: 'masteryStatus is server-evaluated and cannot be modified via problem update' }).optional(),
    lockedAt: z.never({ invalid_type_error: 'lockedAt is server-controlled' }).optional(),
    unlockedAt: z.never({ invalid_type_error: 'unlockedAt is server-controlled' }).optional(),
    lockVersion: z.never({ invalid_type_error: 'lockVersion is server-controlled' }).optional(),
  })
  .strict();

export const listProblemsQuerySchema = z.object({
  section: sectionEnum.optional(),
  topic: z.string().trim().max(200, 'Topic filter cannot exceed 200 characters').optional(),
  difficulty: difficultyEnum.optional(),
  source: z.string().trim().max(200, 'Source filter cannot exceed 200 characters').optional(),
  status: statusEnum.optional(),
  retentionLevel: retentionEnum.optional(),
  masteryStatus: z.enum(['UNLOCKED', 'LOCKED']).optional(),
  search: z.string().trim().max(200, 'Search query cannot exceed 200 characters').optional(),
  sortBy: z
    .enum(['dateLearned', 'sNo', 'createdAt', 'title', 'difficulty', 'status'])
    .default('sNo'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreateProblemInput = z.infer<typeof createProblemSchema>;
export type UpdateProblemInput = z.infer<typeof updateProblemSchema>;
export type ListProblemsQuery = z.infer<typeof listProblemsQuerySchema>;
