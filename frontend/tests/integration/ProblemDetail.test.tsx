import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ProblemDetailPage } from '../../src/pages/ProblemDetailPage';
import * as problemsApi from '../../src/api/problems.api';
import * as reviewsApi from '../../src/api/reviews.api';
import * as patternsApi from '../../src/api/patterns.api';
import * as masteryApi from '../../src/api/mastery.api';
import * as aiApi from '../../src/api/ai.api';
import { createMockProblem } from '../fixtures/problem.fixture';
import { createMockPattern } from '../fixtures/pattern.fixture';
import {
  AiComplexityAnalysis,
  AiExplanation,
  AiHint,
  AiRecall,
  AiRevisionNotes,
  ProblemMasteryDetails,
  ProblemPatternAttachment,
  RevisionHistoryItem,
} from '../../src/types';

vi.mock('../../src/api/problems.api', () => ({
  fetchProblemById: vi.fn(),
  createProblem: vi.fn(),
  updateProblem: vi.fn(),
  deleteProblem: vi.fn(),
}));

vi.mock('../../src/api/reviews.api', () => ({
  fetchDueReviews: vi.fn(),
  submitReview: vi.fn(),
  fetchProblemHistory: vi.fn(),
  fetchUserReviewHistory: vi.fn(),
}));

vi.mock('../../src/api/patterns.api', () => ({
  fetchPatterns: vi.fn(),
  fetchPatternDetail: vi.fn(),
  fetchProblemPatterns: vi.fn(),
  attachPatternToProblem: vi.fn(),
  detachPatternFromProblem: vi.fn(),
  syncProblemPatterns: vi.fn(),
}));

vi.mock('../../src/api/mastery.api', () => ({
  fetchProblemMastery: vi.fn(),
  evaluateProblemMastery: vi.fn(),
  fetchMasteryOverview: vi.fn(),
}));

vi.mock('../../src/api/ai.api', () => ({
  fetchAiStatus: vi.fn(),
  generateAiAssistance: vi.fn(),
}));

/**
 * DSA Tracker — Problem Detail integration tests (Phase 7)
 * ======================================================
 * Focused behaviour coverage for the redesigned page: the four data states (loading,
 * missing, failed, populated), the two accessibility-driven fixes (the mastery cell that
 * used to render empty, and the UTC calendar-day formatting of `dateLearned`), and the
 * behaviour that must survive the restyle (section separation, link gating, notes and
 * patterns empty states, and the delete flow).
 *
 * The responsive metadata layout is pure CSS (1-up / 2-up / 3-up plus the identity row
 * switch at 768px), so it is verified in a real browser at 390 / 768 / 1024 / 1440 rather
 * than in jsdom, which has no layout engine.
 */

const renderPage = (id = 'prob-1') =>
  render(
    <MemoryRouter initialEntries={[`/problems/${id}`]}>
      <Routes>
        <Route path="/problems/:id" element={<ProblemDetailPage />} />
        <Route path="/college-dsa" element={<div>COLLEGE_TRACKER_STUB</div>} />
        <Route path="/personal-dsa" element={<div>PERSONAL_TRACKER_STUB</div>} />
        <Route path="/dashboard" element={<div>DASHBOARD_STUB</div>} />
      </Routes>
    </MemoryRouter>
  );

/** The metadata `<dl>` lives in the section labelled "Problem Details"; scoping to that
 *  region keeps these assertions independent of the shared SRS stepper, whose own metric
 *  grid legitimately reuses some of the same label words. */
const detailsRegion = (): HTMLElement => screen.getByRole('region', { name: /Problem Details/ });

const metaCell = (label: string): HTMLElement =>
  within(detailsRegion()).getByText(label).parentElement as HTMLElement;

const createHistory = (): RevisionHistoryItem[] => [
  {
    id: 'hist-1',
    userId: 'user-1',
    problemId: 'prob-1',
    reviewedAt: '2026-09-02T00:00:00.000Z',
    scheduledReviewAt: '2026-09-02T00:00:00.000Z',
    recallResult: 'EASY',
    timingStatus: 'ON_TIME',
    latenessDays: 0,
    previousStage: 0,
    newStage: 1,
    previousIntervalDays: 0,
    newIntervalDays: 1,
    previousRetention: 'Learning',
    newRetention: 'Familiar',
    previousNextReviewDate: '2026-09-01T00:00:00.000Z',
    newNextReviewDate: '2026-09-02T00:00:00.000Z',
    timeSpentSeconds: 120,
    coldSolve: true,
    createdAt: '2026-09-02T00:00:00.000Z',
  },
];

const createAttachment = (
  overrides: Partial<ProblemPatternAttachment> = {}
): ProblemPatternAttachment => ({
  id: 'attach-1',
  pattern: createMockPattern(),
  confidence: 'HIGH',
  isPrimary: true,
  ...overrides,
});

const createMastery = (
  overrides: Partial<ProblemMasteryDetails> = {}
): ProblemMasteryDetails => ({
  problemId: 'prob-1',
  masteryStatus: 'UNLOCKED',
  isEligible: false,
  lockedAt: null,
  unlockedAt: null,
  lockVersion: 0,
  gates: {
    solved: { passed: true, status: 'Solved', requiredStatus: 'Solved' },
    srsEvidence: {
      passed: false,
      successfulReviewsCount: 1,
      requiredReviewsCount: 4,
      hasStageThreeMilestone: false,
      maxStageReached: 1,
    },
    coldRecall: {
      passed: false,
      qualifyingColdSolvesCount: 0,
      requiredColdSolvesCount: 2,
    },
    recentSuccess: {
      passed: true,
      latestOutcome: 'EASY',
      latestTimestamp: '2026-09-02T00:00:00.000Z',
    },
  },
  ...overrides,
});

describe('Problem Detail (Phase 7)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(problemsApi.fetchProblemById).mockResolvedValue(createMockProblem());
    vi.mocked(reviewsApi.fetchProblemHistory).mockResolvedValue({
      items: createHistory(),
      pagination: { page: 1, limit: 50, total: 1, totalPages: 1 },
    });
    vi.mocked(patternsApi.fetchProblemPatterns).mockResolvedValue([createAttachment()]);
    vi.mocked(patternsApi.fetchPatterns).mockResolvedValue([]);
    vi.mocked(masteryApi.fetchProblemMastery).mockResolvedValue(createMastery());
    vi.mocked(aiApi.fetchAiStatus).mockResolvedValue({
      enabled: true,
      model: 'gemini-3.8-flash',
      features: ['explain', 'hint', 'complexity', 'recall', 'revision-notes'],
    });
  });

  describe('data states', () => {
    it('announces a single loading status while the record is in flight', () => {
      vi.mocked(problemsApi.fetchProblemById).mockReturnValue(new Promise(() => {}));

      renderPage();

      const status = screen.getByRole('status');
      expect(within(status).getByText('Loading problem details')).toBeInTheDocument();
      expect(screen.queryByRole('heading', { level: 2 })).not.toBeInTheDocument();
    });

    it('renders the record, every metadata label and the four sections when loaded', async () => {
      renderPage();

      expect(
        await screen.findByRole('heading', { level: 2, name: 'Two Sum' })
      ).toBeInTheDocument();
      expect(screen.getByText('COLLEGE DSA #1')).toBeInTheDocument();

      for (const label of [
        'Topic',
        'Difficulty',
        'Source',
        'LeetCode #',
        'Status',
        'Retention Level',
        'Mastery Status',
        'Date Learned',
        'Stage & Interval',
        'Next Review',
        'Last Reviewed',
        'Created',
      ]) {
        expect(within(detailsRegion()).getByText(label)).toBeInTheDocument();
      }

      expect(screen.getByRole('heading', { level: 3, name: /Problem Details/ })).toBeInTheDocument();
      expect(
        screen.getByRole('heading', { level: 3, name: /Proof-of-Learning Mastery/ })
      ).toBeInTheDocument();
      expect(
        screen.getByRole('heading', { level: 3, name: /Algorithmic Patterns \(1\)/ })
      ).toBeInTheDocument();
      expect(
        screen.getByRole('heading', { level: 3, name: /Approach, Invariants & Notes/ })
      ).toBeInTheDocument();
      expect(
        screen.getByRole('heading', { level: 3, name: /Revision History \(1\)/ })
      ).toBeInTheDocument();

      // The previous values are unchanged.
      expect(within(metaCell('Stage & Interval')).getByText('Stage 1 (1d)')).toBeInTheDocument();
      expect(screen.getByText('Two Pointers')).toBeInTheDocument();

      expect(within(metaCell('Next Review')).getByText('Sep 2, 2026')).toBeInTheDocument();
    });

    it('shows the unlocked mastery status instead of the empty cell the audit reported', async () => {
      renderPage();

      await screen.findByRole('heading', { level: 2, name: 'Two Sum' });

      expect(within(metaCell('Mastery Status')).getByText('Unlocked')).toBeInTheDocument();
    });

    it('shows the locked mastery note with its lock version', async () => {
      vi.mocked(problemsApi.fetchProblemById).mockResolvedValue(
        createMockProblem({
          masteryStatus: 'LOCKED',
          lockedAt: '2026-09-20T00:00:00.000Z',
          lockVersion: 2,
        })
      );
      vi.mocked(masteryApi.fetchProblemMastery).mockResolvedValue(
        createMastery({ masteryStatus: 'LOCKED', lockedAt: '2026-09-20T10:00:00.000Z', lockVersion: 2 })
      );

      renderPage();

      await screen.findByRole('heading', { level: 2, name: 'Two Sum' });

      expect(within(metaCell('Mastery Status')).getByText('Locked')).toBeInTheDocument();
      expect(within(metaCell('Mastery Status')).getByText('Locked Sep 20, 2026 (v2)')).toBeInTheDocument();
      expect(screen.getByText(/Problem is LOCKED in mastery/)).toBeInTheDocument();
    });

    it('shows the not-found state, without a retry, when the API reports NOT_FOUND', async () => {
      vi.mocked(problemsApi.fetchProblemById).mockRejectedValue({
        message: 'Problem not found.',
        code: 'NOT_FOUND',
      });

      renderPage('missing-1');

      expect(
        await screen.findByRole('heading', { level: 2, name: 'Problem Not Found' })
      ).toBeInTheDocument();
      expect(screen.getByText('Problem not found.')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Return to Dashboard/ })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Retry/ })).not.toBeInTheDocument();
    });

    it('shows the failure state with a retry that recovers the record', async () => {
      const user = userEvent.setup();
      vi.mocked(problemsApi.fetchProblemById)
        .mockRejectedValueOnce({ message: 'Network communication error', code: 'NETWORK_ERROR' })
        .mockResolvedValueOnce(createMockProblem());

      renderPage();

      expect(await screen.findByRole('alert')).toBeInTheDocument();
      expect(screen.getByText("We couldn't load this problem.")).toBeInTheDocument();
      expect(screen.getByText('Network communication error')).toBeInTheDocument();
      expect(screen.queryByRole('heading', { level: 2, name: 'Two Sum' })).not.toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: /Retry/ }));

      expect(
        await screen.findByRole('heading', { level: 2, name: 'Two Sum' })
      ).toBeInTheDocument();
      expect(problemsApi.fetchProblemById).toHaveBeenCalledTimes(2);
    });
  });

  describe('preserved behaviour', () => {
    it('links back to the College tracker or the Personal tracker per section', async () => {
      const { unmount } = renderPage();
      expect(await screen.findByRole('link', { name: /Back to College DSA/ })).toHaveAttribute(
        'href',
        '/college-dsa'
      );
      unmount();

      vi.mocked(problemsApi.fetchProblemById).mockResolvedValue(
        createMockProblem({ section: 'PERSONAL' })
      );
      renderPage();
      expect(await screen.findByRole('link', { name: /Back to Personal DSA/ })).toHaveAttribute(
        'href',
        '/personal-dsa'
      );
    });

    it('drops unsafe external links while keeping the safe ones', async () => {
      vi.mocked(problemsApi.fetchProblemById).mockResolvedValue(
        createMockProblem({
          collegeLink: 'javascript:alert(1)',
          leetcodeLink: 'https://leetcode.com/problems/two-sum',
        })
      );

      renderPage();

      expect(await screen.findByRole('link', { name: /LeetCode Link/ })).toHaveAttribute(
        'href',
        'https://leetcode.com/problems/two-sum'
      );
      expect(screen.queryByRole('link', { name: /College Link/ })).not.toBeInTheDocument();
    });

    it('formats Date Learned as a UTC calendar day', async () => {
      renderPage();

      await screen.findByRole('heading', { level: 2, name: 'Two Sum' });

      // 2026-09-01T00:00:00.000Z must read as Sep 1 everywhere, not as Aug 31.
      expect(within(metaCell('Date Learned')).getByText('Sep 1, 2026')).toBeInTheDocument();
    });

    it('renders the notes and patterns empty states with a real button', async () => {
      const user = userEvent.setup();
      vi.mocked(problemsApi.fetchProblemById).mockResolvedValue(
        createMockProblem({ notes: '   ' })
      );
      vi.mocked(patternsApi.fetchProblemPatterns).mockResolvedValue([]);

      renderPage();

      expect(
        await screen.findByText(/No notes or invariants recorded for this problem yet/)
      ).toBeInTheDocument();
      expect(screen.getByText(/No algorithmic patterns tagged yet/)).toBeInTheDocument();

      const assignButton = screen.getByRole('button', { name: 'Assign patterns' });
      expect(assignButton).toHaveAttribute('type', 'button');

      // The action still opens the pattern picker for this problem.
      await user.click(screen.getByRole('button', { name: /Manage Patterns/ }));
      const picker = await screen.findByRole('dialog', { name: 'Assign Patterns' });
      expect(picker).toHaveAccessibleDescription('Two Sum');
    });

    it('opens the delete dialog and returns to the tracker after a confirmed delete', async () => {
      const user = userEvent.setup();
      vi.mocked(problemsApi.deleteProblem).mockResolvedValue(undefined);

      renderPage();

      await screen.findByRole('heading', { level: 2, name: 'Two Sum' });

      const deleteTrigger = screen.getByRole('button', { name: 'Delete Problem' });
      expect(deleteTrigger).toHaveAttribute('aria-haspopup', 'dialog');
      await user.click(deleteTrigger);

      expect(await screen.findByText('Delete Problem #1?')).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Delete Permanently' }));

      await waitFor(() => {
        expect(problemsApi.deleteProblem).toHaveBeenCalledWith('prob-1');
      });
      expect(await screen.findByText('COLLEGE_TRACKER_STUB')).toBeInTheDocument();
    });

    it('announces each mastery gate as passed or not passed, not by colour alone', async () => {
      renderPage();

      const gateA = (await screen.findByText('Gate A: Solved Status')).closest('li');
      const gateB = screen.getByText('Gate B: Spaced Reviews').closest('li');

      expect(gateA?.textContent).toContain('Passed.');
      expect(gateB?.textContent).toContain('Not passed.');
      expect(screen.getByRole('button', { name: 'Edit Problem' })).toHaveAttribute(
        'aria-haspopup',
        'dialog'
      );
    });
  });

  const MOCK_EXPLANATION: AiExplanation = {
    summary: 'Find two indices whose values add to the target.',
    observations: ['You only need to remember what you have already seen.'],
    constraints: ['Exactly one valid answer exists.'],
    intuition: 'A hash map answers the complement question in constant time.',
    approach: ['Create a map.', 'Look up the complement, then store the value.'],
    correctness: 'The map always holds every earlier element.',
    complexity: { time: 'O(n)', space: 'O(n)' },
    edgeCases: ['Duplicate values'],
  };

  const MOCK_HINT_L1: AiHint = {
    level: 1,
    title: 'What have you already seen?',
    hint: 'Think about the information you wish you had at each index.',
    nextStep: 'Write down what a single pass would need to remember.',
  };

  const MOCK_HINT_L2: AiHint = {
    level: 2,
    title: 'Complement lookup',
    hint: 'Consider a hash map keyed by value.',
    nextStep: 'Look up target - nums[i].',
  };

  const MOCK_COMPLEXITY: AiComplexityAnalysis = {
    subject: 'user-code',
    time: 'O(n)',
    space: 'O(n)',
    reasoning: 'Single pass with a hash map.',
    bottlenecks: ['Hash map lookups'],
    caveats: ['Requires additional memory for the map.'],
  };

  const MOCK_RECALL: AiRecall = {
    questions: [
      {
        question: 'Why does a map remove the nested loop?',
        category: 'core-idea',
        answer: 'It answers the complement query in O(1).',
      },
    ],
  };

  const MOCK_REVISION_NOTES: AiRevisionNotes = {
    trigger: 'Asked to find a pair summing to a target.',
    keyInsight: 'Trade space for time with a complement map.',
    algorithm: ['Create a map.', 'Look for the complement.', 'Store the value.'],
    edgeCases: ['Duplicate values'],
    complexity: { time: 'O(n)', space: 'O(n)' },
    commonMistake: 'Inserting before checking.',
    recallQuestion: 'Why check before inserting?',
  };

  describe('AI assistance integration (Phase 2B)', () => {
    it('adds the assistant without changing any existing Problem Detail action', async () => {
      renderPage();

      await screen.findByRole('heading', { level: 2, name: 'Two Sum' });

      expect(await screen.findByRole('button', { name: 'Explain Problem' })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /AI Study Assistant/i })).toBeInTheDocument();

      // The pre-existing page controls are untouched.
      expect(screen.getByRole('button', { name: 'Edit Problem' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Delete Problem' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Manage Patterns/ })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /Revision History/ })).toBeInTheDocument();

      // Nothing is generated until the student asks.
      expect(aiApi.generateAiAssistance).not.toHaveBeenCalled();
    });

    it('generates an explanation and renders structured sections without modifying problem state', async () => {
      const user = userEvent.setup();
      vi.mocked(aiApi.generateAiAssistance).mockResolvedValue({
        feature: 'explain',
        model: 'gemini-3.8-flash',
        cached: false,
        content: MOCK_EXPLANATION,
        meta: { promptVersion: 'v1', generatedAt: new Date().toISOString() },
      });

      renderPage();
      await screen.findByRole('heading', { level: 2, name: 'Two Sum' });

      await user.click(screen.getByRole('button', { name: 'Explain Problem' }));

      expect(aiApi.generateAiAssistance).toHaveBeenCalledWith('prob-1', {
        feature: 'explain',
      });

      const result = await screen.findByLabelText(/Explain Problem result/i);
      expect(within(result).getByText(MOCK_EXPLANATION.summary)).toBeInTheDocument();
      expect(within(result).getByText(/What to notice/i)).toBeInTheDocument();
      expect(within(result).getByText(/A hash map answers the complement/i)).toBeInTheDocument();

      // Rest of the page remains intact
      expect(screen.getByRole('heading', { level: 2, name: 'Two Sum' })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /Problem Details/ })).toBeInTheDocument();
      expect(problemsApi.updateProblem).not.toHaveBeenCalled();
    });

    it('handles progressive hints (L1 -> L2) with explicit level selection and without solution dumps', async () => {
      const user = userEvent.setup();
      vi.mocked(aiApi.generateAiAssistance)
        .mockResolvedValueOnce({
          feature: 'hint',
          model: 'gemini-3.8-flash',
          cached: false,
          content: MOCK_HINT_L1,
          meta: { promptVersion: 'v1', generatedAt: new Date().toISOString(), level: 1 },
        })
        .mockResolvedValueOnce({
          feature: 'hint',
          model: 'gemini-3.8-flash',
          cached: false,
          content: MOCK_HINT_L2,
          meta: { promptVersion: 'v1', generatedAt: new Date().toISOString(), level: 2 },
        });

      renderPage();
      await screen.findByRole('heading', { level: 2, name: 'Two Sum' });

      await user.click(screen.getByRole('button', { name: 'Give me a Hint' }));

      expect(aiApi.generateAiAssistance).toHaveBeenLastCalledWith('prob-1', {
        feature: 'hint',
        level: 1,
      });
      expect(await screen.findByText(/Hint 1 of 3/i)).toBeInTheDocument();
      expect(screen.getByText(MOCK_HINT_L1.hint)).toBeInTheDocument();

      // Escalate to level 2
      const levelGroup = screen.getByRole('group', { name: /Hint level/i });
      await user.click(within(levelGroup).getByRole('button', { name: '2' }));

      expect(aiApi.generateAiAssistance).toHaveBeenLastCalledWith('prob-1', {
        feature: 'hint',
        level: 2,
      });
      expect(await screen.findByText(/Hint 2 of 3/i)).toBeInTheDocument();
      expect(screen.getByText(MOCK_HINT_L2.hint)).toBeInTheDocument();

      // Confirm no full code solution was dumped
      expect(screen.queryByText(/class Solution/i)).not.toBeInTheDocument();
      expect(problemsApi.updateProblem).not.toHaveBeenCalled();
    });

    it('analyzes complexity using existing problem notes', async () => {
      const user = userEvent.setup();
      vi.mocked(aiApi.generateAiAssistance).mockResolvedValue({
        feature: 'complexity',
        model: 'gemini-3.8-flash',
        cached: false,
        content: MOCK_COMPLEXITY,
        meta: { promptVersion: 'v1', generatedAt: new Date().toISOString() },
      });

      renderPage();
      await screen.findByRole('heading', { level: 2, name: 'Two Sum' });

      await user.click(screen.getByRole('button', { name: 'Analyze Complexity' }));

      expect(aiApi.generateAiAssistance).toHaveBeenCalledWith('prob-1', {
        feature: 'complexity',
        code: 'Use a hash map for O(n) time and O(n) space.',
      });
      expect(await screen.findByText(/Analyzing your current approach/i)).toBeInTheDocument();
      expect(screen.getByText('Single pass with a hash map.')).toBeInTheDocument();

      // Mastery gates and SRS metrics are untouched
      expect(screen.getByText('Gate A: Solved Status')).toBeInTheDocument();
      expect(problemsApi.updateProblem).not.toHaveBeenCalled();
    });

    it('generates recall questions with collapsed answers to promote active recall', async () => {
      const user = userEvent.setup();
      vi.mocked(aiApi.generateAiAssistance).mockResolvedValue({
        feature: 'recall',
        model: 'gemini-3.8-flash',
        cached: false,
        content: MOCK_RECALL,
        meta: { promptVersion: 'v1', generatedAt: new Date().toISOString() },
      });

      renderPage();
      await screen.findByRole('heading', { level: 2, name: 'Two Sum' });

      await user.click(screen.getByRole('button', { name: 'Generate Recall Questions' }));

      expect(aiApi.generateAiAssistance).toHaveBeenCalledWith('prob-1', {
        feature: 'recall',
      });
      expect(await screen.findByText(MOCK_RECALL.questions[0]!.question)).toBeInTheDocument();

      // Model answer is collapsed in a <details> element
      const answer = screen.getByText(MOCK_RECALL.questions[0]!.answer);
      const disclosure = answer.closest('details');
      expect(disclosure).not.toBeNull();
      expect(disclosure).not.toHaveAttribute('open');
      expect(problemsApi.updateProblem).not.toHaveBeenCalled();
    });

    it('generates revision notes and updates the Problem Detail notes section only after explicit save', async () => {
      const user = userEvent.setup();
      vi.mocked(aiApi.generateAiAssistance).mockResolvedValue({
        feature: 'revision-notes',
        model: 'gemini-3.8-flash',
        cached: false,
        content: MOCK_REVISION_NOTES,
        meta: { promptVersion: 'v1', generatedAt: new Date().toISOString() },
      });
      vi.mocked(problemsApi.updateProblem).mockImplementation(async (id, data) => ({
        ...createMockProblem(),
        id,
        notes: data.notes || '',
      }));

      renderPage();
      await screen.findByRole('heading', { level: 2, name: 'Two Sum' });

      await user.click(screen.getByRole('button', { name: 'Create Revision Notes' }));

      const editor = (await screen.findByLabelText(/Edit before saving/i)) as HTMLTextAreaElement;
      expect(editor.value).toContain('Key insight: Trade space for time with a complement map.');

      // Update must NOT happen automatically
      expect(problemsApi.updateProblem).not.toHaveBeenCalled();

      // Click save
      await user.click(screen.getByRole('button', { name: /Save to problem notes/i }));

      await waitFor(() => {
        expect(problemsApi.updateProblem).toHaveBeenCalledTimes(1);
      });

      const [calledId, payload] = vi.mocked(problemsApi.updateProblem).mock.calls[0]!;
      expect(calledId).toBe('prob-1');
      expect(payload.notes).toContain('AI revision notes');
      expect(payload.notes).toContain('Key insight: Trade space for time');
      expect(Object.keys(payload)).toEqual(['notes']);

      // ProblemDetailPage notes section re-renders dynamically with the new notes
      const notesSection = screen.getByRole('region', { name: /Approach, Invariants & Notes/i });
      expect(within(notesSection).getByText(/Key insight: Trade space for time/i)).toBeInTheDocument();
    });

    it('handles AI failure gracefully with retry and does not crash the page', async () => {
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
          content: MOCK_EXPLANATION,
          meta: { promptVersion: 'v1', generatedAt: new Date().toISOString() },
        });

      renderPage();
      await screen.findByRole('heading', { level: 2, name: 'Two Sum' });

      await user.click(screen.getByRole('button', { name: 'Explain Problem' }));

      expect(await screen.findByText(/temporarily unavailable/i)).toBeInTheDocument();

      // Rest of the page is still accessible and stable
      expect(screen.getByRole('heading', { level: 2, name: 'Two Sum' })).toBeInTheDocument();

      // Retry recovers
      await user.click(screen.getByRole('button', { name: /Retry/i }));
      expect(await screen.findByText(MOCK_EXPLANATION.summary)).toBeInTheDocument();
    });
  });
});
