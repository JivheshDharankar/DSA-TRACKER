# DSA Tracker — MERN Stack Spaced Repetition Platform

> A production-grade, personal DSA learning and long-term retention platform built with the MERN stack (React, Vite, Node.js, Express, MongoDB, TypeScript).

---

## 1. Project Overview

**DSA Tracker** is engineered for structured problem tracking and long-term retention using active recall and adaptive spaced repetition.

### Key Conceptual Features:
- **Two Distinct Trackers**:
  - **College DSA**: For coursework, lectures, lab assignments, and semester exams.
  - **Personal DSA**: For independent problem solving, LeetCode mastery, and MAANG interview preparation (with optional LeetCode Number identification).
- **System-Generated S.No.**: Independent, zero-gap sequential numbers per user per section (`College: 1, 2, 3...` and `Personal: 1, 2, 3...`).
- **Strict Data Isolation**: Multi-tenant architecture ensuring complete data privacy across users.
- **SOLID Clean Architecture**: Layered separation of concerns (Controllers → Services → Repositories → Models).
- **Spaced Repetition Foundation**: Ready for deterministic adaptive milestone progression (`0d → 1d → 3d → 7d → 14d → 30d → 60d → 120d → 240d → 365d`) in Phase 4.

---

## 2. SOLID Architectural Design (Phase 3)

| Principle | Implementation in Phase 3 |
| :--- | :--- |
| **S — Single Responsibility** | • **Controllers** (`problem.controller.ts`) handle only HTTP request parsing and response envelopes.<br>• **Services** (`problem.service.ts`) orchestrate business rules, domain invariants, and pagination.<br>• **Repositories** (`problem.repository.ts`, `problemSequence.repository.ts`) encapsulate raw MongoDB queries and ensure `userId` scoping.<br>• **Validators** (`problem.validator.ts`) handle input schema parsing and sanitization.<br>• **UI Components** (`ProblemTable`, `ProblemCardList`, `ProblemModal`) focus strictly on presentation. |
| **O — Open/Closed** | • The `Problem` model and `ProblemService` are designed to allow future spaced repetition metadata and pattern relations to be attached without mutating core CRUD logic. |
| **L — Liskov Substitution** | • `ProblemRepository` and `ProblemSequenceRepository` fulfill typed interfaces (`IProblemRepository`, `IProblemSequenceRepository`), enabling seamless mocking in unit tests. |
| **I — Interface Segregation** | • Discrete interfaces are defined for problem creation (`CreateProblemInput`), updates (`UpdateProblemInput`), query filters (`ListProblemsQuery`), and sequence generation (`IProblemSequenceRepository`). |
| **D — Dependency Inversion** | • `ProblemService` depends on repository abstractions injected via constructor defaults, decoupling business logic from direct Mongoose global instances. |

---

## 3. Data Privacy & Ownership Model

> [!IMPORTANT]
> **User data privacy is non-negotiable**.
> - Every database query and mutation is strictly scoped to `req.user.userId` obtained from the cryptographically verified JWT session cookie.
> - Client-supplied `userId` fields in request bodies or query parameters are **never trusted**.
> - Attempting to view, update, or delete another user's problem returns a safe **`404 NOT_FOUND`** to eliminate enumeration vulnerabilities.

---

## 4. Display S.No. Sequencing System

- **MongoDB `_id`** is the true database identity.
- **S.No.** is a user-facing display identifier managed via a dedicated `ProblemSequence` collection with a unique compound index on `{ userId: 1, section: 1 }`.
- **Atomic Counter Allocation**: Uses MongoDB atomic `$inc` within `findOneAndUpdate`, ensuring non-colliding sequential numbers (`1, 2, 3...`) even under rapid concurrent requests.
- **Deletion Behavior & Gaps**: Deleting a problem (e.g. deleting `#2` from `1, 2, 3`) leaves remaining problems unchanged (`1, 3`). The next created problem receives `#4`. Gaps are preserved and never reused.

---

## 5. Dual Problem Links & LeetCode Identification (Phase 3.1)

- **Independent Optional Links**: Replaces single `problemLink` with independent `collegeLink` and `leetcodeLink`.
- **Flexible Matrix**: A single logical problem can have `only collegeLink`, `only leetcodeLink`, `both`, or `neither` (zero duplication of records).
- **Independent LeetCode #**: `leetcodeNumber` remains an optional positive integer decoupled from links.
- **Safe Non-Destructive Migration**: In the `Problem` model's JSON transform, legacy documents containing `problemLink` are preserved and dynamically mapped (`leetcode.com` → `leetcodeLink`, others → `collegeLink`) without destructive writes.
- **UI Integration**:
  - **College DSA & Personal DSA Tables**: Dedicated `College` (`College ↗`) and `LeetCode` (`LeetCode ↗`) columns with glowing badges.
  - **Problem Details & Cards**: Independent clickable external link buttons with safe `rel="noopener noreferrer"` attributes.
  - **Create / Edit Modal**: Clean dual URL inputs with URL validation and optional LeetCode #.

---

## 6. Spaced Repetition Engine & Day-Based Timing (Phase 4)

- **Backend-Authoritative Scheduling**: The backend is the sole authority calculating stages, intervals, lateness, retention, and next review dates.
- **Milestone Progression Intervals**:
  - `Stage 0 → 0d` (Initial / Created)
  - `Stage 1 → 1d`
  - `Stage 2 → 3d`
  - `Stage 3 → 7d`
  - `Stage 4 → 14d`
  - `Stage 5 → 30d`
  - `Stage 6 → 60d`
  - `Stage 7 → 120d`
  - `Stage 8 → 240d`
  - `Stage 9 → 365d`
- **Adaptive Recall Outcomes**:
  - `EASY`: Advances stage + 1 (capped at Stage 9 / 365d), promotes retention (`Learning → Familiar → Independent → Strong`), exits recovery mode if active.
  - `STRUGGLED`: Conservative progression (advances at stages 0-1, holds stage for higher tiers), advances recovery step.
  - `HINT`: Holds stage or drops 1 stage, schedules near review (3-7 days).
  - `FORGOT`: Enters short-term recovery sequence (`1d → 3d → 7d → 14d`) without erasing baseline stage or history.
- **Calendar-Day Timing Semantics**:
  - Compares UTC calendar days between `scheduledReviewAt` and `reviewedAt`.
  - Timing Status: `ON_TIME` (`latenessDays = 0`), `LATE` (`latenessDays = diffDays`), `EARLY` (`latenessDays = Math.abs(diffDays)`).
  - `latenessDays` is **strictly non-negative**.
  - **No hours/minutes in UI**: Displayed strictly as `"On time"`, `"Late by 1 day"`, `"Late by 15 days"`, `"Early by 2 days"`.
- **Review Date Anchor**: Next review date is calculated from the **actual review calendar date** (`reviewedAt + newIntervalDays`), preventing overdue snowballing.
- **Independence of Recall & Timing**: Lateness never penalizes recall quality (e.g. `Late by 3 days + EASY` remains `recallResult: 'EASY'`).
- **Append-Only Revision History**: Every completed review creates an immutable `RevisionHistory` record.
- **Active Recall Session UI**: Solution notes remain **strictly hidden** during cold attempt and are revealed only during self-evaluation.

---

## 7. API Endpoints (`/api/v1`)

### Authentication (`/api/v1/auth`)
- `POST /api/v1/auth/register` — Register account & set HTTP-only cookie.
- `POST /api/v1/auth/login` — Sign in & set HTTP-only cookie.
- `POST /api/v1/auth/logout` — Clear session cookie.
- `GET /api/v1/auth/me` — Return current authenticated user profile.

### Problem Management (`/api/v1/problems`) *(All require authentication)*
- `POST /api/v1/problems` — Create problem with atomic S.No assignment, Day 0 spaced repetition state, and dual links.
- `GET /api/v1/problems` — Filtered, paginated list of problems (supports `section`, `topic`, `difficulty`, `source`, `status`, `retentionLevel`, `search`, `sortBy`, `sortOrder`, `page`, `limit`).
- `GET /api/v1/problems/:id` — Get problem details (scoped to owner).
- `PATCH /api/v1/problems/:id` — Update problem fields (strictly prohibits modifying `section`, `sNo`, `userId`, or `_id`).
- `DELETE /api/v1/problems/:id` — Delete problem (scoped to owner, preserves numbering gaps).

### Problem Mastery (`/api/v1/problems/:problemId/mastery`) *(All require authentication)*
- `GET /api/v1/problems/:problemId/mastery` — Retrieve mastery status (`UNLOCKED` | `LOCKED`), lock version, timestamps, and full 5-gate qualification breakdown.
- `POST /api/v1/problems/:problemId/mastery/evaluate` — Evaluates all 5 qualification gates server-side and atomically transitions eligible problems from `UNLOCKED` to `LOCKED`.

### Spaced Repetition & Reviews (`/api/v1/reviews`) *(All require authentication)*
- `POST /api/v1/reviews` — Submit revision result (`problemId`, `recallResult`, `timeSpentSeconds?`, `coldSolve?`). Backend calculates adaptive schedule and appends history.
- `GET /api/v1/reviews/due` — Retrieve due problems where `nextReviewDate <= now`, ordered by most overdue first with section filtering.
- `GET /api/v1/reviews/problem/:problemId` — Retrieve chronologically ordered revision history for a problem.

### Pattern Library & Mastery (`/api/v1/patterns`) *(All require authentication)*
- `GET /api/v1/patterns` — Retrieve all 30 foundational DSA patterns with user-specific 5-factor mastery scores and difficulty breakdowns.
- `GET /api/v1/patterns/:id` — Retrieve pattern details, recognition signals, pitfalls, and user's associated problems.
- `POST /api/v1/patterns/attach` — Attach a pattern to a user problem with confidence (`LOW`, `MEDIUM`, `HIGH`) and primary flag.
- `POST /api/v1/patterns/detach` — Detach a pattern from a user problem.
- `POST /api/v1/patterns/sync` — Atomically sync patterns associated with a user problem.
- `GET /api/v1/patterns/problem/:problemId` — List all patterns attached to a problem.

### Command Center Dashboard (`/api/v1/dashboard`) *(Requires authentication)*
- `GET /api/v1/dashboard` — Unified derived read-model returning review queue metrics, problem & section stats, recall performance, retention distribution, calendar-day timing, 365-day UTC heatmap, streaks, Phase 5 pattern mastery summaries, and recent activity feed.

---

## 8. Technology Stack

- **Frontend**: React.js 18+, TypeScript, Vite 6+, React Router 6+, Axios
- **Styling**: CSS Modules + Custom Design Tokens (Dark-first glassmorphism, glowing badges, amber mastery aesthetics)
- **Backend**: Node.js LTS, Express.js 4+, TypeScript, Mongoose 8+
- **Database**: MongoDB (Multi-tenant indexing, atomic concurrency locks, transaction-safe sequences)
- **Testing**: Vitest, Supertest, MongoMemoryServer

---

## 9. Development & Verification Guide

### Prerequisites
- Node.js 18+ & npm
- Local MongoDB instance or Docker MongoDB

### Backend Setup & Test Execution
```bash
cd backend
npm install
npm run build
npm test
```

### Frontend Setup & Build
```bash
cd frontend
npm install
npm run build
```

---

## 10. Development Phases Roadmap

| Phase | Description | Status |
| :--- | :--- | :--- |
| **Phase 1** | **MERN Foundation, Routing, Health Check & Error Handling** | ✅ **Complete** |
| **Phase 2** | **Authentication & Security (JWT, HTTP-only Cookies, Route Guards)** | ✅ **Complete** |
| **Phase 3** | **Problem Management (College & Personal DSA, Atomic S.No., CRUD, Filtering)** | ✅ **Complete** |
| **Phase 3.1** | **Dual Problem Links & LeetCode Number Decoupling (Non-destructive Migration & UI)** | ✅ **Complete** |
| **Phase 4** | **Spaced Repetition Engine & Revision History (Active Recall UI, Calendar-Day Timing)** | ✅ **Complete** |
| **Phase 5** | **DSA Pattern Library & Multi-Factor Mastery Engine (30 Patterns, 5-Factor Score, UI)** | ✅ **Complete** |
| **Phase 6** | **Command Center Dashboard, Analytics, Streaks & Activity Heatmaps** | ✅ **Complete** |
| **Phase 7** | **Random Recall Chamber & Pattern Transfer Testing** | ✅ **Complete** |
| **Phase 8** | **Problem-Level Locked Mastery, Multi-Gate Qualification & Completion System** | ✅ **Complete** |

---

## 11. Phase 5 Architecture — Pattern Library & Mastery Engine

### 1. Global Pattern Catalog (30 Foundational DSA Patterns)
- Seeded idempotently via `bulkWrite` on backend startup (`slug` unique index).
- Includes comprehensive educational metadata: recognition signals, common pitfalls/mistakes, and prerequisites.

### 2. User-Scoped ProblemPattern Associations
- Many-to-many relationship tracked in dedicated `ProblemPattern` collection (`userId`, `problemId`, `patternId`, `confidence`, `isPrimary`).
- Strict user data isolation: pattern documents never store mutable user state; mastery is calculated purely on-the-fly from the user's problems and revision history.

### 3. Deterministic 5-Factor Mastery Calculator
$$\text{Score} = 0.25 \times \text{Coverage} + 0.25 \times \text{IndependentRecall} + 0.20 \times \text{RecallQuality} + 0.15 \times \text{RecentConsistency} + 0.15 \times \text{TransferEvidence}$$
- **Coverage (25%)**: Breadth-oriented formula: $60\% \times \min(100, (\text{solvedCount}/10)\times 100) + 40\% \times \min(100, (\text{totalCount}/15)\times 100)$.
- **Independent Recall (25%)**: Cold-solve reproduction rate strictly on sessions where `coldSolve === true`.
- **Recall Quality (20%)**: Overall revision performance across all scheduled reviews.
- **Recent Consistency (15%)**: Weighted recency of the last 5 sessions with weights `[5, 4, 3, 2, 1]`.
- **Transfer Evidence (15%)**: Distinct problem variants solved independently ($\min(100, (\text{distinctCount}/8)\times 100)$).
- **Mastery Thresholds**: `Strong` ($\ge 85$), `Independent` ($65-84$), `Familiar` ($35-64$), `Learning` ($< 35$).

---

## 12. Phase 6 Architecture — Command Center Dashboard & Activity Heatmaps

### 1. Unified Derived Read-Model Principle
- **Single Authoritative Endpoint**: `GET /api/v1/dashboard` supplies the entire command center in a single authenticated HTTP request.
- **Zero Database State Duplication**: No redundant mutable counters (e.g. `user.totalSolved` or `user.currentStreak`). All statistics are computed on-the-fly from authoritative collections (`Problem`, `RevisionHistory`, `ProblemPattern`, `Pattern`) using parallel MongoDB `$facet` aggregation pipelines.

### 2. Dashboard Analytics & Metric Definitions
- **Review Queue Hero**:
  - `dueNow`: Problems with `nextReviewDate <= now`.
  - `overdue`: Problems with `nextReviewDate < startOfTodayUTC`.
  - `dueToday`: Problems scheduled within `startOfTodayUTC` to `endOfTodayUTC`.
  - `upcoming`: Problems scheduled strictly after `endOfTodayUTC`.
- **Problem & Section Statistics**:
  - `Total`, `Solved`, `Attempted`, `Not Started`.
  - Independent breakdown for **College DSA** and **Personal DSA**.
- **Review Performance & Recall Accuracy**:
  - Outcome counts for `EASY`, `STRUGGLED`, `HINT`, `FORGOT`.
  - `Independent Cold Solves`: Total revision sessions where `coldSolve === true`.
  - `Success Rate`: $\frac{\text{EASY} + \text{STRUGGLED}}{\text{Total Reviews}} \times 100$.
- **Retention Distribution**:
  - Problem counts across retention tiers: `Learning`, `Familiar`, `Independent`, `Strong`.
- **Calendar-Day Revision Timing**:
  - Counts for `On Time`, `Late`, `Early`.
  - `averageLatenessDays`: Mean calendar days late across overdue revisions (always non-negative whole integer days; never displayed in hours/minutes).

### 3. UTC Date Policy & Practice Activity Heatmap
- **Strict UTC Calendar Alignment**: All daily grouping and streak boundaries use UTC `YYYY-MM-DD`.
- **365-Day Sliding Window**: Returns complete 365 days up to today, filling missing dates with `{ count: 0, level: 0 }`.
- **Intensity Buckets**: `Level 0` (0), `Level 1` (1), `Level 2` (2–3), `Level 3` (4–6), `Level 4` (7+ reviews).
- **Interactive UI**: Fully accessible SVG/HTML 52-week grid with month/day headers, keyboard focus, ARIA labels, and breakdown tooltips.

### 4. Streak Calculation Algorithm
- **Active Day Definition**: Any UTC calendar day with $\ge 1$ logged review in `RevisionHistory`. Multiple reviews on the same day count as one active day.
- **Active Today**: Current streak counts consecutively backwards from today.
- **Active Yesterday (Preserved)**: If 0 reviews logged today but $\ge 1$ review logged yesterday, the streak remains intact and counts consecutively backwards from yesterday.
- **Broken Streak**: If 0 reviews logged today and 0 reviews logged yesterday, current streak resets to `0`.
- **Longest Streak**: Maximum unbroken sequence of consecutive active calendar days across all historical records.

### 5. Phase 5 Pattern Mastery Integration
- **Direct Calculator Reuse**: Delegates directly to Phase 5's `PatternMasteryCalculator` with identical 5-factor scoring and thresholds.
- **Strongest Patterns**: Top 3 patterns with highest mastery score (descending score, then name ascending).
- **Needs Practice Patterns**: Top 3 patterns prioritized strictly by mastery tier:
  1. `Learning` (Priority 1)
  2. `Familiar` (Priority 2)
  3. `Independent` (Priority 3)
  4. `Strong` (Priority 4)
  *(Within the same tier, sorted by lower score first, then name ascending)*.

### 6. Recent Activity Feed
- Returns latest 10 `RevisionHistory` entries with populated problem titles, difficulty badges, section, recall outcome pills, cold-solve badges, primary pattern tags, and formatted dates.

### 7. User Privacy & Security
- All aggregations and queries are strictly scoped to `req.user.userId` from the verified JWT cookie.
- Client attempts to supply `userId` in query parameters or request bodies are ignored.
- User A can never observe or infer User B's metrics, streaks, problems, or reviews.

---

## 13. Phase 8 Architecture — Problem-Level Locked Mastery & 4-Gate Completion System

### 1. Proof-of-Learning Philosophy
A problem should **not** become locked merely because it was solved once, has a high retention score, or was answered correctly once in a review. **Locked Mastery** represents verifiable proof of durable, long-term conceptual understanding across independent solving, spaced repetition, cold reproduction, and recent review success.

`masteryStatus` is **orthogonal** to `retentionLevel`:
- `retentionLevel` (`Learning` → `Familiar` → `Independent` → `Strong`) tracks the continuous Spaced Repetition maturity curve.
- `masteryStatus` (`UNLOCKED` | `LOCKED`) is a binary, evidence-based completion seal that unlocks only when all 4 qualification gates are satisfied simultaneously.

### 2. The 4 Qualification Gates

| Gate | Name | Requirement | Evaluation Criteria |
| :--- | :--- | :--- | :--- |
| **Gate A** | **Solved Status** | Problem Status must be `Solved` | `problem.status === 'Solved'` |
| **Gate B** | **Spaced Repetition Evidence** | $\ge 3$ successful reviews & Stage $\ge 3$ reached | Total reviews with `EASY` or `STRUGGLED` $\ge 3$ AND at least one review reached `newStage >= 3` (7-day interval or higher). |
| **Gate C** | **Independent Cold Recall** | $\ge 2$ successful cold solves | $\ge 2$ `RevisionHistory` entries with `coldSolve === true` and outcome `EASY` or `STRUGGLED`. |
| **Gate D** | **Recent Review Success** | Most recent review was a success | The most recent `RevisionHistory` review outcome must be `EASY` or `STRUGGLED`. |

### 3. Gate D Deterministic Tie-Breaker
When multiple reviews share identical millisecond timestamps:
1. Sort by `reviewedAt DESC`.
2. Tie-breaker: sort by MongoDB `_id` string descending (`_id DESC`).

### 4. Server-Authoritative Lock & Unlock Transitions
- **`UNLOCKED → LOCKED`**: Occurs when all 4 gates are satisfied and the user triggers evaluation or successfully completes a qualifying review. Increments `lockVersion` by $+1$, sets `lockedAt = now`, and records an immutable `MasteryEvent` with `reason: 'QUALIFICATION_MET'`.
- **`LOCKED → UNLOCKED`**: Occurs automatically upon a genuine failure (`SRS HINT/FORGOT`). Increments `lockVersion` by $+1$, sets `unlockedAt = now`, and records an immutable `MasteryEvent` with `reason: 'SRS_FAILURE'`.
- **No Manual Unlock**: The client cannot manually downgrade or unlock a problem. There is no `/unlock` endpoint, no manual unlock service, and no frontend unlock button.
- **Idempotency**: Repeated evaluation of an already locked or ineligible problem produces **zero** state mutations, zero version increments, and zero duplicate events.

### 5. Safe Post-Event Mastery Hooks
Mastery hooks in `ReviewService` execute after authoritative core data is persisted:
- If a post-event hook unexpectedly fails, it logs an observable error and **never rolls back** the already-persisted review or corrupts SRS state.

### 6. Concurrency Guarantees
- **Atomic Optimistic Locking**: Transitions use `Problem.findOneAndUpdate({ _id, userId, masteryStatus: 'UNLOCKED' }, { $set: { masteryStatus: 'LOCKED' }, $inc: { lockVersion: 1 } })` (and vice-versa).
- Under concurrent evaluation or failure requests, **exactly one** transition succeeds, `lockVersion` increments by exactly 1, and exactly one `MasteryEvent` is recorded.

---

> [!NOTE]
> **Implementation Status**: Core SRS-centric architecture is complete and fully verified with **106/106 passing backend tests**, clean TypeScript/Vite builds, and complete cross-user security isolation.


