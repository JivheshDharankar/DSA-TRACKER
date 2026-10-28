import { z } from 'zod';

/**
 * DSA Tracker — AI assistance (Phase 2B)
 * =====================================
 * Feature contracts.
 *
 * Every feature has TWO representations that must stay in sync:
 *   - `jsonSchema` — the OpenAPI-subset schema handed to Gemini as a structured-output
 *     constraint (`response_format.schema`). Gemini can only use a restricted subset
 *     (type / properties / required / items / enum / description), so keywords such as
 *     `minLength` are deliberately absent here.
 *   - `schema` — the Zod schema the backend validates the parsed response with before it
 *     is ever returned to the browser. This is the authoritative shape; the JSON schema is
 *     only a generation hint.
 *
 * Adding a feature means adding one descriptor to `AI_FEATURE_DEFINITIONS`; nothing else
 * in the pipeline is feature-aware.
 */

export const AI_FEATURES = ['explain', 'hint', 'complexity', 'recall', 'revision-notes'] as const;
export type AiFeature = (typeof AI_FEATURES)[number];

export const HINT_LEVELS = [1, 2, 3] as const;
export type HintLevel = (typeof HINT_LEVELS)[number];

const text = (max: number) => z.string().trim().min(1).max(max);
const textList = (max: number, count: number) =>
  z.array(text(max)).min(1).max(count);

const complexityPair = z
  .object({
    time: text(120),
    space: text(120),
  })
  .strip();

// ------------------------------------------------------------------ explanation

export const explanationSchema = z
  .object({
    summary: text(1200),
    observations: textList(400, 8),
    constraints: textList(300, 8),
    intuition: text(1600),
    approach: textList(500, 10),
    correctness: text(1200),
    complexity: complexityPair,
    edgeCases: textList(300, 10),
  })
  .strip();

export type AiExplanation = z.infer<typeof explanationSchema>;

// ------------------------------------------------------------------------- hint

export const hintSchema = z
  .object({
    level: z.number().int().min(1).max(3),
    title: text(120),
    hint: text(1400),
    nextStep: text(300),
  })
  .strip();

export type AiHint = z.infer<typeof hintSchema>;

// ------------------------------------------------------------------- complexity

export const complexitySchema = z
  .object({
    subject: z.enum(['user-code', 'recommended-approach']),
    time: text(120),
    space: text(120),
    reasoning: text(1600),
    bottlenecks: textList(300, 8),
    caveats: textList(300, 8),
  })
  .strip();

export type AiComplexity = z.infer<typeof complexitySchema>;

// --------------------------------------------------------------- recall questions

export const RECALL_CATEGORIES = [
  'core-idea',
  'pattern-recognition',
  'why-it-works',
  'edge-cases',
  'complexity',
  'common-mistake',
  'what-would-change-if',
] as const;

export const recallSchema = z
  .object({
    questions: z
      .array(
        z
          .object({
            question: text(400),
            category: z.enum(RECALL_CATEGORIES),
            answer: text(900),
          })
          .strip()
      )
      .min(4)
      .max(8),
  })
  .strip();

export type AiRecall = z.infer<typeof recallSchema>;

// ---------------------------------------------------------------- revision notes

export const revisionNotesSchema = z
  .object({
    trigger: text(400),
    keyInsight: text(900),
    algorithm: textList(400, 10),
    edgeCases: textList(300, 8),
    complexity: complexityPair,
    commonMistake: text(600),
    recallQuestion: text(400),
  })
  .strip();

export type AiRevisionNotes = z.infer<typeof revisionNotesSchema>;

// ------------------------------------------------------------- JSON schemas

const stringArray = (description: string) => ({
  type: 'array',
  description,
  items: { type: 'string' },
});

const stringField = (description: string) => ({ type: 'string', description });

export const AI_JSON_SCHEMAS = {
  explain: {
    type: 'object',
    properties: {
      summary: stringField('Two to four sentence plain-language summary of what the problem asks.'),
      observations: stringArray('Key facts and observations that unlock the problem.'),
      constraints: stringArray('Constraints and input guarantees that shape the solution.'),
      intuition: stringField('The core intuition, in the mentor’s own words.'),
      approach: stringArray('Ordered step-by-step approach. No complete code.'),
      correctness: stringField('Why the approach is correct, including the invariant it maintains.'),
      complexity: {
        type: 'object',
        properties: {
          time: stringField('Time complexity with the dominant term.'),
          space: stringField('Space complexity with the dominant term.'),
        },
        required: ['time', 'space'],
      },
      edgeCases: stringArray('Edge cases and inputs that break a naive implementation.'),
    },
    required: [
      'summary',
      'observations',
      'constraints',
      'intuition',
      'approach',
      'correctness',
      'complexity',
      'edgeCases',
    ],
  },
  hint: {
    type: 'object',
    properties: {
      level: { type: 'integer', description: 'The hint level that was requested (1, 2 or 3).' },
      title: stringField('A short label for the nudge, e.g. "Think about what you have already seen".'),
      hint: stringField('The hint itself. Never the full solution or complete code.'),
      nextStep: stringField('What the student should try next, without revealing the answer.'),
    },
    required: ['level', 'title', 'hint', 'nextStep'],
  },
  complexity: {
    type: 'object',
    properties: {
      subject: {
        type: 'string',
        enum: ['user-code', 'recommended-approach'],
        description:
          'user-code when the analysis is about the supplied code, otherwise recommended-approach.',
      },
      time: stringField('Time complexity.'),
      space: stringField('Space complexity.'),
      reasoning: stringField('Why the complexities are what they are, term by term.'),
      bottlenecks: stringArray('The operations that dominate the running time.'),
      caveats: stringArray('Assumptions or situations where the analysis would change.'),
    },
    required: ['subject', 'time', 'space', 'reasoning', 'bottlenecks', 'caveats'],
  },
  recall: {
    type: 'object',
    properties: {
      questions: {
        type: 'array',
        description: 'Four to eight active-recall questions.',
        items: {
          type: 'object',
          properties: {
            question: stringField('A question that tests understanding, not restatement.'),
            category: {
              type: 'string',
              enum: [...RECALL_CATEGORIES],
            },
            answer: stringField('A concise model answer the student can check against.'),
          },
          required: ['question', 'category', 'answer'],
        },
      },
    },
    required: ['questions'],
  },
  'revision-notes': {
    type: 'object',
    properties: {
      trigger: stringField('The cue that should make the student recall this pattern.'),
      keyInsight: stringField('The single insight that makes the problem click.'),
      algorithm: stringArray('The algorithm skeleton as short ordered steps.'),
      edgeCases: stringArray('Edge cases worth re-checking on revision.'),
      complexity: {
        type: 'object',
        properties: {
          time: stringField('Time complexity.'),
          space: stringField('Space complexity.'),
        },
        required: ['time', 'space'],
      },
      commonMistake: stringField('The mistake most students make here.'),
      recallQuestion: stringField('One question to answer from memory next revision.'),
    },
    required: [
      'trigger',
      'keyInsight',
      'algorithm',
      'edgeCases',
      'complexity',
      'commonMistake',
      'recallQuestion',
    ],
  },
} as const;

export interface AiFeatureDefinition {
  feature: AiFeature;
  /** Human label used in logs and the response envelope. */
  label: string;
  schema: z.ZodTypeAny;
  jsonSchema: Record<string, unknown>;
  /**
   * `true` when generation can include the user's private notes/code. Private features are
   * never stored in the cross-user cache.
   */
  usesPrivateContext: boolean;
  /** Upper bound on output tokens for this feature (keeps responses bounded). */
  maxOutputTokens: number;
}

export const AI_FEATURE_DEFINITIONS: Record<AiFeature, AiFeatureDefinition> = {
  explain: {
    feature: 'explain',
    label: 'Explain Problem',
    schema: explanationSchema,
    jsonSchema: AI_JSON_SCHEMAS.explain,
    usesPrivateContext: false,
    maxOutputTokens: 2400,
  },
  hint: {
    feature: 'hint',
    label: 'Give me a Hint',
    schema: hintSchema,
    jsonSchema: AI_JSON_SCHEMAS.hint,
    usesPrivateContext: false,
    maxOutputTokens: 900,
  },
  complexity: {
    feature: 'complexity',
    label: 'Analyze Complexity',
    schema: complexitySchema,
    jsonSchema: AI_JSON_SCHEMAS.complexity,
    usesPrivateContext: true,
    maxOutputTokens: 1600,
  },
  recall: {
    feature: 'recall',
    label: 'Generate Recall Questions',
    schema: recallSchema,
    jsonSchema: AI_JSON_SCHEMAS.recall,
    usesPrivateContext: false,
    maxOutputTokens: 1800,
  },
  'revision-notes': {
    feature: 'revision-notes',
    label: 'Create Revision Notes',
    schema: revisionNotesSchema,
    jsonSchema: AI_JSON_SCHEMAS['revision-notes'],
    usesPrivateContext: true,
    maxOutputTokens: 1500,
  },
};

export type AiFeatureContent =
  | AiExplanation
  | AiHint
  | AiComplexity
  | AiRecall
  | AiRevisionNotes;

export const isAiFeature = (value: unknown): value is AiFeature =>
  typeof value === 'string' && (AI_FEATURES as readonly string[]).includes(value);
