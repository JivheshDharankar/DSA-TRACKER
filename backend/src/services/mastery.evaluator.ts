export interface MasteryGateResult {
  passed: boolean;
  [key: string]: unknown;
}

export interface GateADetails extends MasteryGateResult {
  passed: boolean;
  status: string;
  requiredStatus: string;
}

export interface GateBDetails extends MasteryGateResult {
  passed: boolean;
  successfulReviewsCount: number;
  requiredReviewsCount: number;
  hasStageThreeMilestone: boolean;
  maxStageReached: number;
}

export interface GateCDetails extends MasteryGateResult {
  passed: boolean;
  qualifyingColdSolvesCount: number;
  requiredColdSolvesCount: number;
}

export interface GateDDetails extends MasteryGateResult {
  passed: boolean;
  latestOutcome: string | null;
  latestTimestamp: string | null;
  totalReviewsCount: number;
}

export interface MasteryEvaluationBreakdown {
  isEligible: boolean;
  gates: {
    solved: GateADetails;
    srsEvidence: GateBDetails;
    coldRecall: GateCDetails;
    recentSuccess: GateDDetails;
  };
}

export interface EvaluatorProblemInput {
  status: string;
}

export interface EvaluatorReviewInput {
  _id: { toString(): string } | string;
  reviewedAt: Date;
  recallResult: 'EASY' | 'STRUGGLED' | 'HINT' | 'FORGOT' | string;
  newStage: number;
  previousStage?: number;
  coldSolve?: boolean | null;
}

export class LockedMasteryEvaluator {
  /**
   * Pure deterministic evaluator for Locked Mastery qualification gates (4-gate SRS-only design).
   * Gate A: Problem status is Solved.
   * Gate B: At least 3 successful SRS reviews (EASY/STRUGGLED), with at least one reaching repetitionStage >= 3.
   * Gate C: At least 2 successful cold solves (coldSolve === true AND EASY/STRUGGLED).
   * Gate D: The most recent RevisionHistory review is successful (EASY/STRUGGLED).
   */
  static evaluate(
    problem: EvaluatorProblemInput,
    reviews: EvaluatorReviewInput[]
  ): MasteryEvaluationBreakdown {
    // 1. GATE A: Problem must be Solved
    const isSolved = problem.status === 'Solved';
    const gateA: GateADetails = {
      passed: isSolved,
      status: problem.status,
      requiredStatus: 'Solved',
    };

    // 2. GATE B: SRS Evidence (>= 3 successful reviews AND at least one review with stage >= 3)
    let successfulReviewsCount = 0;
    let maxStageReached = 0;
    let hasStageThreeMilestone = false;

    for (const rev of reviews) {
      const isSuccess = rev.recallResult === 'EASY' || rev.recallResult === 'STRUGGLED';
      if (isSuccess) {
        successfulReviewsCount++;
        const reachedStage = Math.max(rev.newStage ?? 0, rev.previousStage ?? 0);
        if (reachedStage > maxStageReached) {
          maxStageReached = reachedStage;
        }
        if (reachedStage >= 3) {
          hasStageThreeMilestone = true;
        }
      }
    }

    const gateBPassed = successfulReviewsCount >= 3 && hasStageThreeMilestone;
    const gateB: GateBDetails = {
      passed: gateBPassed,
      successfulReviewsCount,
      requiredReviewsCount: 3,
      hasStageThreeMilestone,
      maxStageReached,
    };

    // 3. GATE C: Independent Cold Recall (>= 2 successful cold solves)
    let qualifyingColdSolvesCount = 0;
    for (const rev of reviews) {
      if (
        rev.coldSolve === true &&
        (rev.recallResult === 'EASY' || rev.recallResult === 'STRUGGLED')
      ) {
        qualifyingColdSolvesCount++;
      }
    }

    const gateCPassed = qualifyingColdSolvesCount >= 2;
    const gateC: GateCDetails = {
      passed: gateCPassed,
      qualifyingColdSolvesCount,
      requiredColdSolvesCount: 2,
    };

    // 4. GATE D: Recent RevisionHistory Success (most recent review must be EASY or STRUGGLED)
    let gateDPassed = false;
    let latestOutcome: string | null = null;
    let latestTimestamp: string | null = null;

    if (reviews.length > 0) {
      // Deterministic Sort: reviewedAt DESC, then MongoDB _id string DESC
      const sortedReviews = [...reviews].sort((a, b) => {
        const timeDiff = new Date(b.reviewedAt).getTime() - new Date(a.reviewedAt).getTime();
        if (timeDiff !== 0) {
          return timeDiff;
        }
        const aId = typeof a._id === 'string' ? a._id : a._id.toString();
        const bId = typeof b._id === 'string' ? b._id : b._id.toString();
        return bId.localeCompare(aId);
      });

      const latestReview = sortedReviews[0]!;
      latestOutcome = latestReview.recallResult;
      latestTimestamp = new Date(latestReview.reviewedAt).toISOString();
      gateDPassed = latestReview.recallResult === 'EASY' || latestReview.recallResult === 'STRUGGLED';
    }

    const gateD: GateDDetails = {
      passed: gateDPassed,
      latestOutcome,
      latestTimestamp,
      totalReviewsCount: reviews.length,
    };

    // Overall eligibility: ALL 4 gates must be simultaneously true
    const isEligible = gateA.passed && gateB.passed && gateC.passed && gateD.passed;

    return {
      isEligible,
      gates: {
        solved: gateA,
        srsEvidence: gateB,
        coldRecall: gateC,
        recentSuccess: gateD,
      },
    };
  }
}
