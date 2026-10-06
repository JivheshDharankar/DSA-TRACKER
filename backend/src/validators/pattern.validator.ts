import { z } from 'zod';
import mongoose from 'mongoose';

const objectIdValidator = z
  .string()
  .trim()
  .refine((val) => mongoose.Types.ObjectId.isValid(val), {
    message: 'Invalid ID format',
  });

export const attachPatternSchema = z
  .object({
    patternId: objectIdValidator,
    confidence: z.enum(['LOW', 'MEDIUM', 'HIGH']).optional().default('MEDIUM'),
    isPrimary: z.boolean().optional().default(false),
  })
  .strict();

export const syncPatternsSchema = z
  .object({
    patterns: z
      .array(
        z
          .object({
            patternId: objectIdValidator,
            confidence: z.enum(['LOW', 'MEDIUM', 'HIGH']).optional().default('MEDIUM'),
            isPrimary: z.boolean().optional().default(false),
          })
          .strict()
      )
      .refine(
        (patterns) => {
          const ids = patterns.map((p) => p.patternId);
          return new Set(ids).size === ids.length;
        },
        {
          message: 'Duplicate pattern IDs are not allowed in synchronization payload',
        }
      ),
  })
  .strict();

export const listPatternsQuerySchema = z
  .object({
    search: z.string().trim().max(200, 'Search query cannot exceed 200 characters').optional(),
  })
  .strict();

export type AttachPatternInput = z.infer<typeof attachPatternSchema>;
export type SyncPatternsInput = z.infer<typeof syncPatternsSchema>;
export type ListPatternsQuery = z.infer<typeof listPatternsQuerySchema>;
