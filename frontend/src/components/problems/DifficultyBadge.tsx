import React from 'react';
import { DifficultyType } from '../../types';
import { Badge } from '../ui/Badge';
import { difficultyTone } from './badgeTones';

interface DifficultyBadgeProps {
  difficulty: DifficultyType;
}

/**
 * Difficulty pill — the shared `Badge` primitive with the tracker tone mapping, so the
 * table, the cards, Problem Detail and Review History can never disagree about what an
 * Easy/Medium/Hard chip looks like. The label and the leading dot are unchanged.
 */
export const DifficultyBadge: React.FC<DifficultyBadgeProps> = ({ difficulty }) => (
  <Badge tone={difficultyTone(difficulty)} shape="pill" dot>
    {difficulty}
  </Badge>
);
