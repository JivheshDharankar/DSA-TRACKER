import { User } from '../../src/types';

export const createMockUser = (overrides: Partial<User> = {}): User => {
  return {
    id: 'user-1',
    name: 'Ada Lovelace',
    email: 'ada@example.com',
    createdAt: '2026-09-01T00:00:00.000Z',
    ...overrides,
  };
};
