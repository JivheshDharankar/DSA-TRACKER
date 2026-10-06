import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useProblems } from '../../src/hooks/useProblems';
import * as problemsApi from '../../src/api/problems.api';
import { createMockProblem, createMockPaginatedProblems } from '../fixtures/problem.fixture';

vi.mock('../../src/api/problems.api', () => ({
  fetchProblems: vi.fn(),
  createProblem: vi.fn(),
  updateProblem: vi.fn(),
  deleteProblem: vi.fn(),
}));

describe('useProblems hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('initializes in loading state and fetches problems for the designated section', async () => {
    const mockData = createMockPaginatedProblems(2, { section: 'COLLEGE' });
    vi.mocked(problemsApi.fetchProblems).mockResolvedValue(mockData);

    const { result } = renderHook(() => useProblems('COLLEGE'));

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.problems).toHaveLength(2);
    expect(result.current.pagination.total).toBe(2);
    expect(result.current.error).toBeNull();
    expect(problemsApi.fetchProblems).toHaveBeenCalledWith(
      expect.objectContaining({
        section: 'COLLEGE',
        page: 1,
        limit: 20,
      })
    );
  });

  it('guarantees section lock when section is PERSONAL', async () => {
    const mockData = createMockPaginatedProblems(1, { section: 'PERSONAL' });
    vi.mocked(problemsApi.fetchProblems).mockResolvedValue(mockData);

    const { result } = renderHook(() => useProblems('PERSONAL'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(problemsApi.fetchProblems).toHaveBeenCalledWith(
      expect.objectContaining({
        section: 'PERSONAL',
      })
    );
  });

  it('handles empty response cleanly without crash', async () => {
    vi.mocked(problemsApi.fetchProblems).mockResolvedValue({
      items: [],
      pagination: { page: 1, limit: 20, total: 0, totalPages: 1 },
    });

    const { result } = renderHook(() => useProblems('COLLEGE'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.problems).toEqual([]);
    expect(result.current.pagination.total).toBe(0);
    expect(result.current.error).toBeNull();
  });

  it('catches API failure and extracts user-friendly error via getErrorMessage', async () => {
    vi.mocked(problemsApi.fetchProblems).mockRejectedValue({
      message: 'Failed to fetch section problems from database',
      code: 'DB_ERROR',
    });

    const { result } = renderHook(() => useProblems('COLLEGE'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBe('Failed to fetch section problems from database');
    expect(result.current.problems).toEqual([]);
  });

  it('updates filters and triggers refetch with updated parameters', async () => {
    const initialData = createMockPaginatedProblems(2);
    const filteredData = createMockPaginatedProblems(1, { difficulty: 'Hard' });

    vi.mocked(problemsApi.fetchProblems)
      .mockResolvedValueOnce(initialData)
      .mockResolvedValueOnce(filteredData);

    const { result } = renderHook(() => useProblems('COLLEGE'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    act(() => {
      result.current.updateFilters({ difficulty: 'Hard', page: 1 });
    });

    await waitFor(() => {
      expect(problemsApi.fetchProblems).toHaveBeenLastCalledWith(
        expect.objectContaining({
          section: 'COLLEGE',
          difficulty: 'Hard',
          page: 1,
        })
      );
    });

    expect(result.current.problems).toHaveLength(1);
  });

  it('resets filters back to default section query params', async () => {
    const mockData = createMockPaginatedProblems(2);
    vi.mocked(problemsApi.fetchProblems).mockResolvedValue(mockData);

    const { result } = renderHook(() => useProblems('COLLEGE'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    act(() => {
      result.current.updateFilters({ search: 'Graph', difficulty: 'Hard' });
    });

    act(() => {
      result.current.resetFilters();
    });

    await waitFor(() => {
      expect(result.current.filters.search).toBeUndefined();
      expect(result.current.filters.difficulty).toBeUndefined();
      expect(result.current.filters.section).toBe('COLLEGE');
    });
  });

  it('handleCreateProblem calls createProblem API, returns the created Problem with id, and refreshes problem list', async () => {
    const initialData = createMockPaginatedProblems(1);
    const refreshedData = createMockPaginatedProblems(2);
    const mockCreated = createMockProblem({ id: 'prob-created-456', title: 'New Problem' });

    vi.mocked(problemsApi.fetchProblems)
      .mockResolvedValueOnce(initialData)
      .mockResolvedValueOnce(refreshedData);
    vi.mocked(problemsApi.createProblem).mockResolvedValue(mockCreated);

    const { result } = renderHook(() => useProblems('COLLEGE'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    let returnedProblem: any;
    await act(async () => {
      returnedProblem = await result.current.handleCreateProblem({
        section: 'COLLEGE',
        title: 'New Problem',
        topic: 'Graphs',
        difficulty: 'Medium',
        source: 'Lecture',
        dateLearned: '2026-09-20T00:00:00.000Z',
        status: 'Not Started',
        retentionLevel: 'Learning',
      });
    });

    // 1. handleCreateProblem calls the create API
    expect(problemsApi.createProblem).toHaveBeenCalledTimes(1);
    // 2. The created Problem object is returned
    expect(returnedProblem).toBeDefined();
    // 3. The returned object contains the created id
    expect(returnedProblem.id).toBe('prob-created-456');
    expect(returnedProblem.title).toBe('New Problem');
    // Problem list is refreshed
    expect(problemsApi.fetchProblems).toHaveBeenCalledTimes(2);
  });

  it('handleUpdateProblem calls updateProblem API and refreshes problem list', async () => {
    const initialData = createMockPaginatedProblems(1);
    const refreshedData = createMockPaginatedProblems(1, { title: 'Updated Title' });

    vi.mocked(problemsApi.fetchProblems)
      .mockResolvedValueOnce(initialData)
      .mockResolvedValueOnce(refreshedData);
    vi.mocked(problemsApi.updateProblem).mockResolvedValue(
      createMockProblem({ id: 'prob-1', title: 'Updated Title' })
    );

    const { result } = renderHook(() => useProblems('COLLEGE'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await result.current.handleUpdateProblem('prob-1', {
        title: 'Updated Title',
      });
    });

    expect(problemsApi.updateProblem).toHaveBeenCalledWith('prob-1', {
      title: 'Updated Title',
    });
    expect(problemsApi.fetchProblems).toHaveBeenCalledTimes(2);
  });

  it('handleDeleteProblem calls deleteProblem API and refreshes problem list', async () => {
    const initialData = createMockPaginatedProblems(1);
    const refreshedData = createMockPaginatedProblems(0);

    vi.mocked(problemsApi.fetchProblems)
      .mockResolvedValueOnce(initialData)
      .mockResolvedValueOnce(refreshedData);
    vi.mocked(problemsApi.deleteProblem).mockResolvedValue(undefined);

    const { result } = renderHook(() => useProblems('COLLEGE'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await result.current.handleDeleteProblem('prob-1');
    });

    expect(problemsApi.deleteProblem).toHaveBeenCalledWith('prob-1');
    expect(problemsApi.fetchProblems).toHaveBeenCalledTimes(2);
  });
});
