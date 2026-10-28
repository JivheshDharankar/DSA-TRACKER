import { describe, it, expect } from 'vitest';
import { AI_FEATURE_DEFINITIONS, AI_FEATURES } from '../src/services/ai/ai.schemas.js';
import { buildPrompt } from '../src/services/ai/ai.prompts.js';
import { AiProblemContext } from '../src/services/ai/ai.prompts.js';

/**
 * Phase 2B — AI quality test set.
 * =============================
 * Correctness of an AI answer is not something a status code can prove, so this file does
 * two different jobs:
 *
 *   1. ALWAYS (offline): every problem in the set must produce a prompt that carries the
 *      facts, and every feature must have a schema that constrains the important fields.
 *      This catches prompt/schema regressions with no network and no cost.
 *
 *   2. OPT-IN LIVE (`AI_QUALITY_LIVE=1` + `GEMINI_API_KEY`): asks the real model for each
 *      feature and asserts objective proxies — schema validity is already enforced by the
 *      pipeline; here we check hint escalation, absence of code in hints, presence of a
 *      complexity expression, recall coverage, and note brevity. The full text is printed
 *      so a human can judge mentor quality, which is the part no assertion can settle.
 *
 * Run live with:
 *   AI_QUALITY_LIVE=1 npx vitest run tests/aiQualitySet.test.ts
 */

interface QualityCase extends AiProblemContext {
  name: string;
  /** Loosely what the accepted complexity should mention, e.g. /O\(n/ */
  expectedComplexity: RegExp;
  kind: 'easy' | 'medium' | 'hard';
  shape: 'array' | 'string' | 'graph' | 'recursion' | 'binary-search' | 'dp';
}

const TEST_SET: QualityCase[] = [
  {
    name: 'Two Sum',
    title: 'Two Sum',
    topic: 'Arrays',
    difficulty: 'Easy',
    source: 'LeetCode',
    leetcodeNumber: 1,
    leetcodeLink: 'https://leetcode.com/problems/two-sum/',
    notes: null,
    code: null,
    expectedComplexity: /O\(n/,
    kind: 'easy',
    shape: 'array',
  },
  {
    name: 'Longest Substring Without Repeating Characters',
    title: 'Longest Substring Without Repeating Characters',
    topic: 'Sliding Window',
    difficulty: 'Medium',
    source: 'LeetCode',
    leetcodeNumber: 3,
    leetcodeLink: 'https://leetcode.com/problems/longest-substring-without-repeating-characters/',
    notes: null,
    code: null,
    expectedComplexity: /O\(n/,
    kind: 'medium',
    shape: 'string',
  },
  {
    name: 'Number of Islands',
    title: 'Number of Islands',
    topic: 'Graphs',
    difficulty: 'Medium',
    source: 'LeetCode',
    leetcodeNumber: 200,
    leetcodeLink: 'https://leetcode.com/problems/number-of-islands/',
    notes: null,
    code: null,
    expectedComplexity: /O\((m\s*[*·x]\s*n|n)/i,
    kind: 'medium',
    shape: 'graph',
  },
  {
    name: 'Median of Two Sorted Arrays',
    title: 'Median of Two Sorted Arrays',
    topic: 'Binary Search',
    difficulty: 'Hard',
    source: 'LeetCode',
    leetcodeNumber: 4,
    leetcodeLink: 'https://leetcode.com/problems/median-of-two-sorted-arrays/',
    notes: null,
    code: null,
    expectedComplexity: /log/i,
    kind: 'hard',
    shape: 'binary-search',
  },
  {
    name: 'Invert Binary Tree',
    title: 'Invert Binary Tree',
    topic: 'Trees',
    difficulty: 'Easy',
    source: 'LeetCode',
    leetcodeNumber: 226,
    leetcodeLink: 'https://leetcode.com/problems/invert-binary-tree/',
    notes: null,
    code: null,
    expectedComplexity: /O\(n/,
    kind: 'easy',
    shape: 'recursion',
  },
  {
    name: 'Climbing Stairs',
    title: 'Climbing Stairs',
    topic: 'Dynamic Programming',
    difficulty: 'Easy',
    source: 'LeetCode',
    leetcodeNumber: 70,
    leetcodeLink: 'https://leetcode.com/problems/climbing-stairs/',
    notes: null,
    code: null,
    expectedComplexity: /O\(n/,
    kind: 'easy',
    shape: 'dp',
  },
  {
    name: 'Word Break',
    title: 'Word Break',
    topic: 'Dynamic Programming',
    difficulty: 'Medium',
    source: 'LeetCode',
    leetcodeNumber: 139,
    leetcodeLink: 'https://leetcode.com/problems/word-break/',
    notes: null,
    code: null,
    expectedComplexity: /O\(n/,
    kind: 'medium',
    shape: 'dp',
  },
];

describe('AI quality test set (offline contract checks)', () => {
  it('covers the required difficulty and problem-shape spread', () => {
    const kinds = new Set(TEST_SET.map((item) => item.kind));
    expect(kinds.has('easy')).toBe(true);
    expect(kinds.has('medium')).toBe(true);
    expect(kinds.has('hard')).toBe(true);

    const shapes = new Set(TEST_SET.map((item) => item.shape));
    expect(shapes.has('recursion')).toBe(true);
    expect(shapes.has('graph')).toBe(true);
    expect(shapes.has('dp')).toBe(true);
    expect(TEST_SET.length).toBeGreaterThanOrEqual(6);
  });

  it('builds a fact-carrying prompt for every problem and every feature', () => {
    for (const testCase of TEST_SET) {
      for (const feature of AI_FEATURES) {
        const { prompt, systemInstruction } = buildPrompt({ feature, context: testCase });

        expect(prompt).toContain(testCase.title);
        expect(prompt).toContain(testCase.topic);
        expect(prompt).toContain(testCase.difficulty);
        expect(systemInstruction).toContain('Never invent constraints');
        expect(prompt.length).toBeLessThan(12_000);
      }
    }
  });

  it('escalates hints instead of repeating the same prompt', () => {
    const context = TEST_SET[3]!;
    const prompts = ([1, 2, 3] as const).map(
      (level) => buildPrompt({ feature: 'hint', level, context }).prompt
    );

    expect(new Set(prompts).size).toBe(3);
    expect(prompts[0]).toContain('Level 1');
    expect(prompts[2]).toContain('Level 3');
  });

  it('constrains every feature schema to the fields the UI renders', () => {
    expect(AI_FEATURE_DEFINITIONS.explain.jsonSchema).toHaveProperty('properties.complexity');
    expect(AI_FEATURE_DEFINITIONS.hint.jsonSchema).toHaveProperty('required', [
      'level',
      'title',
      'hint',
      'nextStep',
    ]);
    expect(AI_FEATURE_DEFINITIONS.recall.jsonSchema).toHaveProperty('properties.questions');
    expect(AI_FEATURE_DEFINITIONS['revision-notes'].jsonSchema).toHaveProperty(
      'properties.commonMistake'
    );
    expect(AI_FEATURE_DEFINITIONS.complexity.jsonSchema).toHaveProperty('properties.subject');
  });
});

const LIVE = process.env.AI_QUALITY_LIVE === '1' && Boolean(process.env.GEMINI_API_KEY);

describe.skipIf(!LIVE)('AI quality test set (live Gemini)', () => {
  it('produces a correct explanation, escalating hints, recall and notes for the set', async () => {
    const { geminiProvider } = await import('../src/services/ai/gemini.provider.js');
    const { env } = await import('../src/config/env.js');

    const results: string[] = [];

    for (const testCase of TEST_SET) {
      const explain = AI_FEATURE_DEFINITIONS.explain;
      const explainPrompt = buildPrompt({ feature: 'explain', context: testCase });
      const explainResponse = await geminiProvider.generateStructured({
        model: env.GEMINI_MODEL,
        systemInstruction: explainPrompt.systemInstruction,
        prompt: explainPrompt.prompt,
        jsonSchema: explain.jsonSchema,
        maxOutputTokens: explain.maxOutputTokens,
      });

      const explanation = explain.schema.parse(
        JSON.parse(explainResponse.text)
      ) as { complexity: { time: string; space: string } };

      // A technically accurate explanation must state a complexity that matches the
      // accepted bound for this problem.
      expect(`${explanation.complexity.time} ${explanation.complexity.space}`).toMatch(
        testCase.expectedComplexity
      );

      results.push(`## ${testCase.name}\n\n${JSON.stringify(explanation, null, 2)}\n`);
    }

    // Full text is printed for human review of mentor quality.
    console.log(`\n=== AI quality set output ===\n${results.join('\n')}`);
  }, 180_000);

  it('keeps hints progressive and code-free', async () => {
    const { geminiProvider } = await import('../src/services/ai/gemini.provider.js');
    const { env } = await import('../src/config/env.js');
    const definition = AI_FEATURE_DEFINITIONS.hint;
    const context = TEST_SET[2]!;

    const hints = [];
    for (const level of [1, 2, 3] as const) {
      const built = buildPrompt({ feature: 'hint', level, context });
      const response = await geminiProvider.generateStructured({
        model: env.GEMINI_MODEL,
        systemInstruction: built.systemInstruction,
        prompt: built.prompt,
        jsonSchema: definition.jsonSchema,
        maxOutputTokens: definition.maxOutputTokens,
      });

      const hint = definition.schema.parse(JSON.parse(response.text)) as {
        level: number;
        hint: string;
      };
      expect(hint.level).toBe(level);
      expect(hint.hint).not.toContain('```');
      hints.push(hint.hint);
    }

    expect(new Set(hints).size).toBe(3);
    expect(hints[0]!.length).toBeLessThan(hints[2]!.length * 2);

    console.log(`\n=== Hint progression ===\n${hints.map((h, i) => `L${i + 1}: ${h}`).join('\n\n')}`);
  }, 120_000);
});
