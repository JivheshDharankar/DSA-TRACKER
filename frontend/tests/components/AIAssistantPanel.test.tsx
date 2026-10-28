import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AIAssistantPanel } from '../../src/components/ai/AIAssistantPanel';
import { createMockProblem } from '../fixtures/problem.fixture';
import * as aiApi from '../../src/api/ai.api';
import * as problemsApi from '../../src/api/problems.api';
import {
  AiComplexityAnalysis,
  AiExplanation,
  AiGenerationResponse,
  AiHint,
  AiRecall,
  AiRevisionNotes,
  AiStatus,
} from '../../src/types';

vi.mock('../../src/api/ai.api', () => ({
  fetchAiStatus: vi.fn(),
  generateAiAssistance: vi.fn(),
}));

vi.mock('../../src/api/problems.api', () => ({
  updateProblem: vi.fn(),
}));

const EXPLANATION: AiExplanation = {
  summary: 'Find two indices whose values add to the target.',
  observations: ['You only need to remember what you have already seen.'],
  constraints: ['Exactly one valid answer exists.'],
  intuition: 'A hash map answers the complement question in constant time.',
  approach: ['Create a map.', 'Look up the complement, then store the value.'],
  correctness: 'The map always holds every earlier element.',
  complexity: { time: 'O(n)', space: 'O(n)' },
  edgeCases: ['Duplicate values'],
};

const HINT: AiHint = {
  level: 1,
  title: 'What have you already seen?',
  hint: 'Think about the information you wish you had at each index.',
  nextStep: 'Write down what a single pass would need to remember.',
};

const COMPLEXITY: AiComplexityAnalysis = {
  subject: 'user-code',
  time: 'O(n²)',
  space: 'O(1)',
  reasoning: 'The nested loop compares every pair, so the running time grows quadratically.',
  bottlenecks: ['Nested iteration'],
  caveats: ['A hash map would remove the inner loop.'],
};

const RECALL: AiRecall = {
  questions: [
    { question: 'Why does a map remove the nested loop?', category: 'core-idea', answer: 'It answers the complement query in O(1).' },
    { question: 'Which pattern is this?', category: 'pattern-recognition', answer: 'Hashing.' },
    { question: 'What invariant makes it correct?', category: 'why-it-works', answer: 'The map holds every earlier element.' },
    { question: 'What breaks with duplicates?', category: 'edge-cases', answer: 'Inserting before checking.' },
  ],
};

const REVISION_NOTES: AiRevisionNotes = {
  trigger: 'Asked to find a pair summing to a target.',
  keyInsight: 'Trade space for time with a complement map.',
  algorithm: ['Create a map.', 'Look for the complement.', 'Store the value.'],
  edgeCases: ['Duplicate values'],
  complexity: { time: 'O(n)', space: 'O(n)' },
  commonMistake: 'Inserting before checking.',
  recallQuestion: 'Why check before inserting?',
};

const ENABLED_STATUS: AiStatus = {
  enabled: true,
  model: 'gemini-3.8-flash',
  features: ['explain', 'hint', 'complexity', 'recall', 'revision-notes'],
};

const problem = createMockProblem({
  id: 'prob-ai-1',
  title: 'Two Sum',
  topic: 'Arrays',
  difficulty: 'Easy',
  notes: 'function twoSum(nums, target) { /* brute force */ }',
});

const renderPanel = (onNotesSaved = vi.fn()) =>
  render(<AIAssistantPanel problem={problem} onNotesSaved={onNotesSaved} />);

describe('AIAssistantPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(aiApi.fetchAiStatus).mockResolvedValue(ENABLED_STATUS);
  });

  it('renders the five explicit AI actions plus the privacy note', async () => {
    renderPanel();

    expect(await screen.findByRole('button', { name: /Explain Problem/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Give me a Hint/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Analyze Complexity/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Generate Recall Questions/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Create Revision Notes/i })).toBeInTheDocument();

    expect(screen.getByText(/send this problem’s title, topic, difficulty/i)).toBeInTheDocument();
    expect(screen.getByText(/Nothing here changes your mastery/i)).toBeInTheDocument();
  });

  it('shows a loading state while a request is in flight', async () => {
    const user = userEvent.setup();
    let resolveRequest: (value: AiGenerationResponse) => void = () => {};
    vi.mocked(aiApi.generateAiAssistance).mockImplementation(
      () =>
        new Promise<AiGenerationResponse>((resolve) => {
          resolveRequest = resolve;
        })
    );

    renderPanel();
    await user.click(await screen.findByRole('button', { name: /Explain Problem/i }));

    expect(screen.getByRole('status')).toHaveTextContent(/Generating an explanation/i);

    resolveRequest({
      feature: 'explain',
      model: 'gemini-3.8-flash',
      cached: false,
      content: EXPLANATION,
      meta: { promptVersion: 'v1', generatedAt: new Date().toISOString() },
    });

    await waitFor(() => {
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });
  });

  it('prevents duplicate or concurrent requests while an AI request is in-flight', async () => {
    const user = userEvent.setup();
    let resolveRequest: (value: AiGenerationResponse) => void = () => {};
    vi.mocked(aiApi.generateAiAssistance).mockImplementation(
      () =>
        new Promise<AiGenerationResponse>((resolve) => {
          resolveRequest = resolve;
        })
    );

    renderPanel();
    const explainBtn = await screen.findByRole('button', { name: /Explain Problem/i });
    const hintBtn = screen.getByRole('button', { name: /Give me a Hint/i });

    // First click initiates request
    await user.click(explainBtn);
    expect(aiApi.generateAiAssistance).toHaveBeenCalledTimes(1);

    // Concurrent / rapid second click on the same or another action is blocked
    await user.click(explainBtn);
    await user.click(hintBtn);
    expect(aiApi.generateAiAssistance).toHaveBeenCalledTimes(1);

    // Resolve in-flight request
    resolveRequest({
      feature: 'explain',
      model: 'gemini-3.8-flash',
      cached: false,
      content: EXPLANATION,
      meta: { promptVersion: 'v1', generatedAt: new Date().toISOString() },
    });

    await waitFor(() => {
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });
  });

  it('renders a structured explanation', async () => {
    const user = userEvent.setup();
    vi.mocked(aiApi.generateAiAssistance).mockResolvedValue({
      feature: 'explain',
      model: 'gemini-3.8-flash',
      cached: false,
      content: EXPLANATION,
      meta: { promptVersion: 'v1', generatedAt: new Date().toISOString() },
    });

    renderPanel();
    await user.click(await screen.findByRole('button', { name: /Explain Problem/i }));

    const result = await screen.findByLabelText(/Explain Problem result/i);
    expect(within(result).getByText(EXPLANATION.summary)).toBeInTheDocument();
    expect(within(result).getByText(/What to notice/i)).toBeInTheDocument();
    expect(within(result).getAllByText('O(n)').length).toBeGreaterThan(0);
    expect(within(result).getByText(/A hash map answers the complement/i)).toBeInTheDocument();
  });

  it('renders a hint with its level and never as a full solution', async () => {
    const user = userEvent.setup();
    vi.mocked(aiApi.generateAiAssistance).mockResolvedValue({
      feature: 'hint',
      model: 'gemini-3.8-flash',
      cached: false,
      content: HINT,
      meta: { promptVersion: 'v1', generatedAt: new Date().toISOString(), level: 1 },
    });

    renderPanel();
    await user.click(await screen.findByRole('button', { name: /Give me a Hint/i }));

    expect(aiApi.generateAiAssistance).toHaveBeenCalledWith('prob-ai-1', {
      feature: 'hint',
      level: 1,
    });
    expect(await screen.findByText(/Hint 1 of 3/i)).toBeInTheDocument();
    expect(screen.getByText(HINT.hint)).toBeInTheDocument();
    expect(screen.getByText(/Try next:/i)).toBeInTheDocument();
  });

  it('escalates the hint level when another level is chosen', async () => {
    const user = userEvent.setup();
    vi.mocked(aiApi.generateAiAssistance).mockResolvedValue({
      feature: 'hint',
      model: 'gemini-3.8-flash',
      cached: false,
      content: { ...HINT, level: 2, hint: 'Consider a hash map keyed by value.' },
      meta: { promptVersion: 'v1', generatedAt: new Date().toISOString(), level: 2 },
    });

    renderPanel();
    await user.click(await screen.findByRole('button', { name: /Give me a Hint/i }));

    const levelGroup = await screen.findByRole('group', { name: /Hint level/i });
    await user.click(within(levelGroup).getByRole('button', { name: '2' }));

    expect(aiApi.generateAiAssistance).toHaveBeenLastCalledWith('prob-ai-1', {
      feature: 'hint',
      level: 2,
    });
    expect(await screen.findByText(/Hint 2 of 3/i)).toBeInTheDocument();
  });

  it('sends the user’s saved notes for complexity analysis and labels it as their approach', async () => {
    const user = userEvent.setup();
    vi.mocked(aiApi.generateAiAssistance).mockResolvedValue({
      feature: 'complexity',
      model: 'gemini-3.8-flash',
      cached: false,
      content: COMPLEXITY,
      meta: { promptVersion: 'v1', generatedAt: new Date().toISOString() },
    });

    renderPanel();
    await user.click(await screen.findByRole('button', { name: /Analyze Complexity/i }));

    expect(aiApi.generateAiAssistance).toHaveBeenCalledWith('prob-ai-1', {
      feature: 'complexity',
      code: problem.notes,
    });
    expect(await screen.findByText(/Analyzing your current approach/i)).toBeInTheDocument();
    expect(screen.getByText('O(n²)')).toBeInTheDocument();
  });

  it('renders recall questions with each answer collapsed behind a disclosure', async () => {
    const user = userEvent.setup();
    vi.mocked(aiApi.generateAiAssistance).mockResolvedValue({
      feature: 'recall',
      model: 'gemini-3.8-flash',
      cached: false,
      content: RECALL,
      meta: { promptVersion: 'v1', generatedAt: new Date().toISOString() },
    });

    renderPanel();
    await user.click(await screen.findByRole('button', { name: /Generate Recall Questions/i }));

    expect(await screen.findByText(RECALL.questions[0]!.question)).toBeInTheDocument();
    expect(screen.getAllByText(/Show model answer/i)).toHaveLength(RECALL.questions.length);

    // The answer is present but collapsed: it is only shown when the student chooses to look.
    const answer = screen.getByText(RECALL.questions[0]!.answer);
    const disclosure = answer.closest('details');
    expect(disclosure).not.toBeNull();
    expect(disclosure).not.toHaveAttribute('open');
  });

  it('renders revision notes and lets the user edit them before saving', async () => {
    const user = userEvent.setup();
    vi.mocked(aiApi.generateAiAssistance).mockResolvedValue({
      feature: 'revision-notes',
      model: 'gemini-3.8-flash',
      cached: false,
      content: REVISION_NOTES,
      meta: { promptVersion: 'v1', generatedAt: new Date().toISOString() },
    });

    renderPanel();
    await user.click(await screen.findByRole('button', { name: /Create Revision Notes/i }));

    const editor = (await screen.findByLabelText(/Edit before saving/i)) as HTMLTextAreaElement;
    expect(editor.value).toContain('Key insight: Trade space for time with a complement map.');

    await user.clear(editor);
    await user.type(editor, 'My own condensed note.');

    expect(editor).toHaveValue('My own condensed note.');
    // Editing alone must never persist anything.
    expect(problemsApi.updateProblem).not.toHaveBeenCalled();
  });

  it('saves nothing until the user explicitly clicks save, then appends to existing notes', async () => {
    const user = userEvent.setup();
    const onNotesSaved = vi.fn();
    vi.mocked(aiApi.generateAiAssistance).mockResolvedValue({
      feature: 'revision-notes',
      model: 'gemini-3.8-flash',
      cached: false,
      content: REVISION_NOTES,
      meta: { promptVersion: 'v1', generatedAt: new Date().toISOString() },
    });
    vi.mocked(problemsApi.updateProblem).mockImplementation(async (_id, data) => ({
      ...problem,
      notes: data.notes,
    }));

    renderPanel(onNotesSaved);
    await user.click(await screen.findByRole('button', { name: /Create Revision Notes/i }));
    await screen.findByLabelText(/Edit before saving/i);

    expect(problemsApi.updateProblem).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: /Save to problem notes/i }));

    await waitFor(() => {
      expect(problemsApi.updateProblem).toHaveBeenCalledTimes(1);
    });

    const [problemId, payload] = vi.mocked(problemsApi.updateProblem).mock.calls[0]!;
    expect(problemId).toBe('prob-ai-1');
    expect(payload.notes).toContain('function twoSum');
    expect(payload.notes).toContain('AI revision notes');
    expect(payload.notes).toContain('Key insight: Trade space for time');
    // No other field may change: mastery and scheduling stay untouched.
    expect(Object.keys(payload)).toEqual(['notes']);
    expect(onNotesSaved).toHaveBeenCalledTimes(1);
    expect(await screen.findByText(/Saved to this problem’s notes/i)).toBeInTheDocument();
  });

  it('shows an error with a working retry', async () => {
    const user = userEvent.setup();
    vi.mocked(aiApi.generateAiAssistance)
      .mockRejectedValueOnce({
        message: 'AI assistance is temporarily unavailable. Your DSA Tracker remains fully usable.',
        code: 'AI_UNAVAILABLE',
      })
      .mockResolvedValueOnce({
        feature: 'explain',
        model: 'gemini-3.8-flash',
        cached: false,
        content: EXPLANATION,
        meta: { promptVersion: 'v1', generatedAt: new Date().toISOString() },
      });

    renderPanel();
    await user.click(await screen.findByRole('button', { name: /Explain Problem/i }));

    expect(await screen.findByText(/temporarily unavailable/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Retry/i }));

    expect(await screen.findByText(EXPLANATION.summary)).toBeInTheDocument();
  });

  it('explains a disabled AI configuration instead of showing broken actions', async () => {
    vi.mocked(aiApi.fetchAiStatus).mockResolvedValue({
      enabled: false,
      model: null,
      features: [],
    });

    renderPanel();

    expect(
      await screen.findByText(/AI assistance is not configured on this server/i)
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Explain Problem/i })).not.toBeInTheDocument();
    expect(aiApi.generateAiAssistance).not.toHaveBeenCalled();
  });
});
