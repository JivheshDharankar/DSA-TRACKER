import { useState, useEffect, useCallback } from 'react';
import {
  Problem,
  SectionType,
  ProblemQueryParams,
  PaginationMeta,
  CreateProblemInput,
  UpdateProblemInput,
} from '../types';
import {
  fetchProblems,
  createProblem,
  updateProblem,
  deleteProblem,
} from '../api/problems.api';

interface UseProblemsResult {
  problems: Problem[];
  pagination: PaginationMeta;
  isLoading: boolean;
  error: string | null;
  filters: ProblemQueryParams;
  updateFilters: (newFilters: Partial<ProblemQueryParams>) => void;
  resetFilters: () => void;
  handleCreateProblem: (data: CreateProblemInput) => Promise<void>;
  handleUpdateProblem: (id: string, data: UpdateProblemInput) => Promise<void>;
  handleDeleteProblem: (id: string) => Promise<void>;
  refreshProblems: () => Promise<void>;
}

export const useProblems = (section: SectionType): UseProblemsResult => {
  const [problems, setProblems] = useState<Problem[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [filters, setFilters] = useState<ProblemQueryParams>({
    section,
    page: 1,
    limit: 20,
    sortBy: 'sNo',
    sortOrder: 'asc',
  });

  const loadProblems = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await fetchProblems({
        ...filters,
        section, // Guarantee section lock
      });
      setProblems(result.items);
      setPagination(result.pagination);
    } catch (err: unknown) {
      const errorObj = err as { message?: string };
      setError(errorObj.message || 'Failed to load problems.');
    } finally {
      setIsLoading(false);
    }
  }, [filters, section]);

  useEffect(() => {
    loadProblems();
  }, [loadProblems]);

  const updateFilters = (newFilters: Partial<ProblemQueryParams>) => {
    setFilters((prev) => ({
      ...prev,
      ...newFilters,
    }));
  };

  const resetFilters = () => {
    setFilters({
      section,
      page: 1,
      limit: 20,
      sortBy: 'sNo',
      sortOrder: 'asc',
      search: undefined,
      difficulty: undefined,
      status: undefined,
      retentionLevel: undefined,
      masteryStatus: undefined,
      source: undefined,
      topic: undefined,
    });
  };

  const handleCreate = async (data: CreateProblemInput) => {
    await createProblem(data);
    await loadProblems();
  };

  const handleUpdate = async (id: string, data: UpdateProblemInput) => {
    await updateProblem(id, data);
    await loadProblems();
  };

  const handleDelete = async (id: string) => {
    await deleteProblem(id);
    await loadProblems();
  };

  return {
    problems,
    pagination,
    isLoading,
    error,
    filters,
    updateFilters,
    resetFilters,
    handleCreateProblem: handleCreate,
    handleUpdateProblem: handleUpdate,
    handleDeleteProblem: handleDelete,
    refreshProblems: loadProblems,
  };
};
