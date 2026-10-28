import { z } from 'zod';
import { AI_FEATURES } from '../services/ai/ai.schemas.js';
import { MAX_CODE_CHARS } from '../services/ai/ai.prompts.js';

/**
 * DSA Tracker — AI assistance (Phase 2B)
 * =====================================
 * Request validation for `POST /api/v1/ai/problems/:problemId/generate`.
 *
 * The body is strict: an unknown field is a 400, not something quietly forwarded to the
 * provider. Context is deliberately narrow — the feature selects what may be sent, so
 * `code` is rejected outside `complexity` and `level` outside `hint`.
 */

const featureEnum = z.enum(AI_FEATURES, {
  errorMap: () => ({
    message: `Feature must be one of: ${AI_FEATURES.join(', ')}`,
  }),
});

export const aiGenerateSchema = z
  .object({
    feature: featureEnum,
    /** Progressive hint level; required for `hint`, rejected everywhere else. */
    level: z
      .union([z.literal(1), z.literal(2), z.literal(3)])
      .optional(),
    /** The user's own solution code, used only by `complexity` analysis. */
    code: z
      .string()
      .max(MAX_CODE_CHARS, `Code cannot exceed ${MAX_CODE_CHARS} characters`)
      .optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.level !== undefined && value.feature !== 'hint') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['level'],
        message: 'Hint level is only valid for the hint feature',
      });
    }

    if (value.code !== undefined && value.feature !== 'complexity') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['code'],
        message: 'Code can only be sent for complexity analysis',
      });
    }
  });

export type AiGenerateInput = z.infer<typeof aiGenerateSchema>;
