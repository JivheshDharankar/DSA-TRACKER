import { z } from 'zod';
import mongoose from 'mongoose';

const objectIdValidator = z
  .string()
  .trim()
  .refine((val) => mongoose.Types.ObjectId.isValid(val), {
    message: 'Invalid ID format',
  });

export const attachPatternSchema = z.object({
  patternId: objectIdValidator,
  confidence: z.enum(['LOW', 'MEDIUM', 'HIGH']).optional().default('MEDIUM'),
  isPrimary: z.boolean().optional().default(false),
});

export const syncPatternsSchema = z.object({
  patterns: z.array(
    z.object({
      patternId: objectIdValidator,
      confidence: z.enum(['LOW', 'MEDIUM', 'HIGH']).optional().default('MEDIUM'),
      isPrimary: z.boolean().optional().default(false),
    })
  ),
});

export const listPatternsQuerySchema = z.object({
  search: z.string().trim().optional(),
});

export type AttachPatternInput = z.infer<typeof attachPatternSchema>;
export type SyncPatternsInput = z.infer<typeof syncPatternsSchema>;
export type ListPatternsQuery = z.infer<typeof listPatternsQuerySchema>;
