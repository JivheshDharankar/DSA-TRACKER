import { Pattern, IPattern } from '../models/Pattern.model.js';

export const INITIAL_PATTERNS: Array<Omit<IPattern, 'createdAt' | 'updatedAt'>> = [
  {
    name: 'Two Pointers',
    slug: 'two-pointers',
    description:
      'A technique where two pointer indices iterate across data structures in tandem (often towards each other or in the same direction at different paces) to solve searching/matching problems in linear time with O(1) extra space.',
    recognitionSignals: [
      'Input array or string is sorted (or sorting is allowed)',
      'Need to find pairs, triplets, or subarrays meeting target sum/condition',
      'Comparing elements from both ends moving towards the center',
      'Need to reverse or palindrome-check a sequence in-place',
    ],
    commonMistakes: [
      'Forgetting to sort the array before applying the two-pointer approach',
      'Incorrect while-loop termination condition causing index out-of-bounds or infinite loops (e.g. left < right vs left <= right)',
      'Not skipping duplicates properly when searching for unique pairs or triplets',
    ],
    prerequisites: ['Arrays', 'Basic loops', 'Sorting'],
  },
  {
    name: 'Sliding Window',
    slug: 'sliding-window',
    description:
      'A technique that maintains a contiguous subarray or substring window of variable or fixed size to track or optimize aggregated metrics (sum, max, distinct characters) in O(N) time.',
    recognitionSignals: [
      'Problem involves contiguous sequences (subarrays, substrings)',
      'Requires finding minimum, maximum, longest, or shortest subarray satisfying a condition',
      'Brute force O(N^2) or O(N^3) recalculates repeated overlapping intervals',
    ],
    commonMistakes: [
      'Expanding right pointer without properly contracting left pointer when condition violates',
      'Failing to handle empty inputs or inputs shorter than window size K',
      'State corruption in frequency map/hash table when removing elements from window',
    ],
    prerequisites: ['Hash Maps', 'Arrays', 'Two Pointers'],
  },
  {
    name: 'Fast & Slow Pointers',
    slug: 'fast-and-slow-pointers',
    description:
      'Also known as Floyd\'s Cycle Detection (Tortoise and Hare) algorithm, it uses two pointers moving at different speeds (e.g. 1 step vs 2 steps) to detect cycles or find midpoints in linear data structures.',
    recognitionSignals: [
      'Detecting cycles or loops in LinkedLists or state transitions',
      'Finding the middle node of a LinkedList in a single pass',
      'Finding the start of a cycle or cycle length',
      'Detecting loops in finite integer sequences (e.g. Happy Number)',
    ],
    commonMistakes: [
      'Dereferencing null pointer when advancing fast pointer (always check fast && fast.next)',
      'Incorrect mathematical reset when calculating the cycle entrance (slow to head, both move 1 step)',
    ],
    prerequisites: ['LinkedLists', 'Pointers'],
  },
  {
    name: 'Merge Intervals',
    slug: 'merge-intervals',
    description:
      'An efficient pattern for dealing with overlapping time intervals or ranges by sorting intervals by their start times and greedily merging or intersecting them.',
    recognitionSignals: [
      'Input contains a set of intervals (start, end) or scheduling times',
      'Requires finding overlapping intervals, merging mutually inclusive intervals, or finding open slots',
      'Keywords: "meeting rooms", "calendar conflict", "time intervals", "insert interval"',
    ],
    commonMistakes: [
      'Forgetting to sort intervals by start time before processing',
      'Failing to take max(end1, end2) when extending the merged interval boundary',
      'Off-by-one errors when comparing strict overlap (startB <= endA vs startB < endA)',
    ],
    prerequisites: ['Intervals', 'Sorting', 'Greedy'],
  },
  {
    name: 'Cyclic Sort',
    slug: 'cyclic-sort',
    description:
      'An in-place O(N) time and O(1) space sorting algorithm for arrays containing numbers in a given continuous range [1, N] or [0, N]. It places each number at its correct index in a single pass.',
    recognitionSignals: [
      'Input is an array of integers in range [1, N] or [0, N] with missing or duplicated values',
      'Problem asks to find missing numbers, duplicate numbers, or corrupt pairs in O(N) time and O(1) extra space',
    ],
    commonMistakes: [
      'Using a standard for-loop and unconditionally incrementing index i instead of while loop (only increment i when nums[i] is in correct spot)',
      'Infinite loops caused by swapping equal duplicate values (always compare nums[i] with nums[nums[i] - 1])',
    ],
    prerequisites: ['Arrays', 'Swapping'],
  },
  {
    name: 'In-place Reversal of a LinkedList',
    slug: 'in-place-reversal-of-a-linkedlist',
    description:
      'Reversing links between nodes of a LinkedList in-place without allocating auxiliary memory for new nodes by maintaining prev, curr, and next pointers.',
    recognitionSignals: [
      'LinkedList problem requiring reversal of the whole list, sub-segment [left, right], or k-group chunks',
      'Constraint requires O(1) auxiliary space',
    ],
    commonMistakes: [
      'Losing reference to the remaining list before updating curr.next',
      'Failing to reconnect the sublist boundaries back to the prefix and suffix lists',
      'Forgetting to use a dummy head node when reversing subsegments starting at index 1',
    ],
    prerequisites: ['LinkedLists', 'Pointer manipulation'],
  },
  {
    name: 'Tree Breadth-First Search (BFS)',
    slug: 'tree-breadth-first-search',
    description:
      'Traversing trees or hierarchical graphs level-by-level using a FIFO Queue to process all nodes at depth d before moving to depth d+1.',
    recognitionSignals: [
      'Tree traversal level-by-level or zigzag/zigzag order',
      'Finding shortest path in unweighted tree or graph',
      'Finding minimum depth of a binary tree or level averages/maximums',
      'Connecting level order right-pointers',
    ],
    commonMistakes: [
      'Not capturing the queue size at the beginning of each level loop, causing mixing of levels',
      'Memory issues when queue grows to O(W) where W is maximum tree width',
    ],
    prerequisites: ['Binary Trees', 'Queue data structure'],
  },
  {
    name: 'Tree Depth-First Search (DFS)',
    slug: 'tree-depth-first-search',
    description:
      'Traversing trees recursively (or via an explicit stack) along each branch down to the leaf nodes (Pre-order, In-order, Post-order) to aggregate paths, validate properties, or find ancestors.',
    recognitionSignals: [
      'Finding root-to-leaf paths that sum to a target',
      'Validating Binary Search Tree (BST) properties',
      'Finding Lowest Common Ancestor (LCA)',
      'Calculating tree diameter, maximum path sum, or height',
    ],
    commonMistakes: [
      'Not returning base case on null node, causing NullPointerExceptions',
      'Modifying shared path state without backtracking (pop) on recursive return',
      'Confusing subtree return values with global max tracker updates',
    ],
    prerequisites: ['Binary Trees', 'Recursion', 'Call Stack'],
  },
  {
    name: 'Two Heaps',
    slug: 'two-heaps',
    description:
      'Using a Max-Heap and a Min-Heap concurrently to partition a stream or collection of numbers into two halves, enabling O(1) access to median or extreme boundary values.',
    recognitionSignals: [
      'Finding the running median of a data stream',
      'Finding sliding window median',
      'Balancing elements where we constantly need access to largest of smaller half and smallest of larger half',
    ],
    commonMistakes: [
      'Letting the size of the two heaps differ by more than 1',
      'Inserting directly into wrong heap without balancing values (max of maxHeap <= min of minHeap)',
      'Handling floating-point division when calculating median from even total elements',
    ],
    prerequisites: ['Heap / Priority Queue', 'Binary Trees'],
  },
  {
    name: 'Subsets & Backtracking',
    slug: 'subsets-and-backtracking',
    description:
      'Systematically building candidate solutions step-by-step and abandoning (backtracking) paths as soon as it is determined they cannot lead to a valid solution (permutations, combinations, subsets).',
    recognitionSignals: [
      'Generating all combinations, subsets, permutations, or partitions',
      'Constraint satisfaction problems (N-Queens, Sudoku solver, Word Search)',
      'Input size N is relatively small (N <= 20)',
    ],
    commonMistakes: [
      'Forgetting to create a shallow/deep copy of current path before pushing into final result list',
      'Failing to undo the choice (backtrack step) after recursive return',
      'Not sorting and skipping duplicates for combinations with duplicate input elements',
    ],
    prerequisites: ['Recursion', 'Combinatorics'],
  },
  {
    name: 'Modified Binary Search',
    slug: 'modified-binary-search',
    description:
      'Extending classic O(log N) binary search to rotated sorted arrays, unknown length streams, peak-finding, or search space reduction on answers (Binary Search on Result).',
    recognitionSignals: [
      'Sorted or partially rotated sorted array',
      'Need search time better than O(N) -> O(log N)',
      'Optimization problem asking for "minimum possible maximum" or "maximum possible minimum" where feasibility is monotonic',
    ],
    commonMistakes: [
      'Integer overflow with (low + high) / 2 instead of low + Math.floor((high - low) / 2)',
      'Infinite loops from improper boundary shifts (low = mid vs low = mid + 1)',
      'Not checking which half of a rotated array is cleanly sorted',
    ],
    prerequisites: ['Binary Search', 'Sorted Arrays'],
  },
  {
    name: 'Top K Elements',
    slug: 'top-k-elements',
    description:
      'Using a Min-Heap of size K (or Quickselect) to find the K largest or K most frequent elements in an unsorted collection in O(N log K) time without sorting the whole array.',
    recognitionSignals: [
      'Find the Kth largest/smallest element',
      'Find the top K frequent words or numbers',
      'Rearrange string so no two adjacent characters are identical',
    ],
    commonMistakes: [
      'Using a Max-Heap of size N instead of a Min-Heap of size K for K largest (wasting memory)',
      'Forgetting to pop from min-heap when size exceeds K',
    ],
    prerequisites: ['Heap / Priority Queue', 'Hash Maps'],
  },
  {
    name: 'K-way Merge',
    slug: 'k-way-merge',
    description:
      'Using a Min-Heap to merge K sorted arrays, lists, or streams into a single sorted list in O(N log K) time where N is the total number of elements.',
    recognitionSignals: [
      'Merge K sorted linked lists or sorted arrays',
      'Find Kth smallest number in M sorted lists or matrix',
      'Smallest range covering elements from K lists',
    ],
    commonMistakes: [
      'Pushing entire lists into heap instead of just the head elements of each active list',
      'Not tracking the source list/index metadata along with the element value in the heap node',
    ],
    prerequisites: ['Priority Queue', 'LinkedLists', 'Sorting'],
  },
  {
    name: '0/1 Knapsack (Dynamic Programming)',
    slug: '0-1-knapsack',
    description:
      'A foundational dynamic programming pattern where each item can either be chosen once (1) or excluded (0) to maximize profit within a capacity constraint.',
    recognitionSignals: [
      'Given a set of items with weights and values, find subset satisfying weight limit with optimal value',
      'Partition array into two subsets with equal sum or minimum sum difference',
      'Count of subsets with a given sum',
    ],
    commonMistakes: [
      'Iterating capacity forwards instead of backwards when optimizing space to a 1D DP array',
      'Off-by-one errors with base cases (capacity 0 vs 0 items available)',
    ],
    prerequisites: ['Dynamic Programming', 'Recursion with Memoization'],
  },
  {
    name: 'Unbounded Knapsack',
    slug: 'unbounded-knapsack',
    description:
      'A dynamic programming pattern where an infinite supply of each item is available and can be selected multiple times to achieve a target capacity or cost.',
    recognitionSignals: [
      'Coin Change (minimum coins to make amount)',
      'Coin Change II (total unique combinations to make amount)',
      'Rod cutting problem',
    ],
    commonMistakes: [
      'Confusing order of nested loops (permutations vs combinations in coin change)',
      'Initializing DP array with 0 instead of infinity (or vice versa) for minimization problems',
    ],
    prerequisites: ['Dynamic Programming', '0/1 Knapsack'],
  },
  {
    name: 'Fibonacci Numbers / State DP',
    slug: 'fibonacci-numbers-state-dp',
    description:
      'Solving multi-step decision problems where state at step i depends directly on the results of preceding (i-1, i-2, ...) subproblems (e.g. Climbing Stairs, House Robber).',
    recognitionSignals: [
      'Finding total ways to reach step N taking 1 or 2 steps at a time',
      'Cannot take adjacent elements (House Robber)',
      'State transitions only depend on the previous 1 or 2 computed states',
    ],
    commonMistakes: [
      'Allocating O(N) array when only previous 2 variables are needed (O(1) space optimization)',
      'Incorrect base cases for n = 0 or n = 1',
    ],
    prerequisites: ['Dynamic Programming', 'State Transitions'],
  },
  {
    name: 'Longest Common Subsequence (LCS)',
    slug: 'longest-common-subsequence',
    description:
      'A 2D DP pattern for comparing two strings or sequences to determine the length/content of their longest shared subsequence, edit distance, or transformation cost.',
    recognitionSignals: [
      'Matching or transforming string A into string B',
      'Edit distance (insertions, deletions, substitutions)',
      'Shortest common supersequence or distinct subsequences',
    ],
    commonMistakes: [
      'Failing to handle empty string base cases',
      'Incorrect indexing (1-indexed DP table vs 0-indexed string characters)',
    ],
    prerequisites: ['2D Dynamic Programming', 'Strings'],
  },
  {
    name: 'Longest Increasing Subsequence (LIS)',
    slug: 'longest-increasing-subsequence',
    description:
      'Finding the longest strictly increasing (or non-decreasing) subsequence in an array in O(N^2) via DP or O(N log N) via Patience Sorting with binary search.',
    recognitionSignals: [
      'Finding longest ordered subset of numbers where relative order is preserved',
      'Russian Doll Envelopes, Box Stacking, or Building Bridges',
    ],
    commonMistakes: [
      'Confusing contiguous subarray with non-contiguous subsequence',
      'Using lower_bound vs upper_bound in O(N log N) binary search for strictly increasing vs non-decreasing',
    ],
    prerequisites: ['Dynamic Programming', 'Binary Search'],
  },
  {
    name: 'Palindromic Subsequence / Substring',
    slug: 'palindromic-subsequence-substring',
    description:
      'A DP / interval pattern centered on finding or counting palindromes by expanding around centers or computing DP tables along diagonal lengths.',
    recognitionSignals: [
      'Longest palindromic substring or subsequence',
      'Palindromic partitioning (minimum cuts)',
      'Count of distinct or total palindromic substrings',
    ],
    commonMistakes: [
      'Only expanding around single character centers and missing even-length palindrome centers (i, i+1)',
      'Improper iteration order in 2D DP (must iterate by substring length or right-to-left)',
    ],
    prerequisites: ['Two Pointers', '2D Dynamic Programming'],
  },
  {
    name: 'Topological Sort (Graph BFS / Kahn\'s)',
    slug: 'topological-sort',
    description:
      'Linear ordering of vertices in a Directed Acyclic Graph (DAG) such that for every directed edge u -> v, u comes before v, using in-degree arrays and a queue.',
    recognitionSignals: [
      'Tasks or courses with prerequisite dependencies (Course Schedule I & II)',
      'Compiling build dependencies or determining valid workflow order',
      'Detecting directed cycles in dependency graphs',
    ],
    commonMistakes: [
      'Applying topological sort to graphs that contain cycles without verifying all nodes were processed',
      'Not updating in-degrees correctly when removing processed parents',
    ],
    prerequisites: ['Graphs', 'Queue (BFS)', 'Adjacency Lists'],
  },
  {
    name: 'Graph DFS / Connected Components',
    slug: 'graph-dfs-connected-components',
    description:
      'Exploring reachable nodes in graphs or matrices using recursion/visited sets to count islands, find connected components, or traverse paths.',
    recognitionSignals: [
      'Number of Islands / Max Area of Island in 2D grid',
      'Flood fill / word search in grid',
      'Detecting cycles in undirected graphs',
      'Bipartite graph testing with 2-coloring',
    ],
    commonMistakes: [
      'Forgetting to mark cell/node as visited before recursive calls, causing infinite stack overflow',
      'Off-by-one boundary checks when traversing 4-directional or 8-directional neighbors',
    ],
    prerequisites: ['Graphs', 'Recursion', '2D Arrays'],
  },
  {
    name: 'Union Find (Disjoint Set Union)',
    slug: 'union-find-disjoint-set',
    description:
      'A data structure tracking partition of a set into disjoint connected subsets with near O(1) amortized `find` (with path compression) and `union` (by rank/size).',
    recognitionSignals: [
      'Dynamic connectivity in undirected graphs (redundant connection, accounts merge)',
      'Kruskal\'s Minimum Spanning Tree algorithm',
      'Checking if adding an edge forms a cycle in an undirected graph',
    ],
    commonMistakes: [
      'Forgetting path compression in find(x): `parent[x] = find(parent[x])`',
      'Unifying roots directly without finding canonical representative of both sets first',
    ],
    prerequisites: ['Trees', 'Graphs', 'Amortized Analysis'],
  },
  {
    name: 'Shortest Path (Dijkstra\'s & Bellman-Ford)',
    slug: 'shortest-path-algorithms',
    description:
      'Finding the shortest path from a starting vertex to all other vertices in a weighted graph using greedy priority queues (Dijkstra) or edge relaxations (Bellman-Ford).',
    recognitionSignals: [
      'Network delay time, cheapest flights within K stops, path with minimum effort',
      'Graph with positive edge weights (Dijkstra) or negative edge weights (Bellman-Ford)',
    ],
    commonMistakes: [
      'Using standard BFS on weighted graphs (BFS only finds shortest path on unweighted graphs)',
      'Not skipping outdated heap entries with larger distance than current best recorded distance',
    ],
    prerequisites: ['Graphs', 'Priority Queue', 'Greedy'],
  },
  {
    name: 'Monotonic Stack',
    slug: 'monotonic-stack',
    description:
      'A stack that maintains its elements in strictly increasing or decreasing order to find the next/previous greater or smaller element in O(N) total time.',
    recognitionSignals: [
      'Next Greater Element / Daily Temperatures',
      'Largest Rectangle in Histogram / Maximal Rectangle',
      'Trapping Rain Water (stack-based approach)',
    ],
    commonMistakes: [
      'Pushing values instead of indices onto the stack (indices are needed to compute widths/distances)',
      'Mixing up strictly greater vs greater-or-equal condition when popping elements',
    ],
    prerequisites: ['Stack data structure', 'Arrays'],
  },
  {
    name: 'Monotonic Queue',
    slug: 'monotonic-queue',
    description:
      'A double-ended queue (deque) maintaining monotonic order to find the maximum or minimum in a sliding window in amortized O(1) per element (O(N) overall).',
    recognitionSignals: [
      'Sliding Window Maximum / Minimum',
      'Constrained Subsequence Sum',
      'Jump Game VI',
    ],
    commonMistakes: [
      'Not evicting indices that have fallen out of the sliding window from the front of the deque',
      'Failing to pop smaller elements from the back before adding a new element',
    ],
    prerequisites: ['Deque', 'Sliding Window'],
  },
  {
    name: 'Trie (Prefix Tree)',
    slug: 'trie-prefix-tree',
    description:
      'A tree-like data structure used to efficiently store and retrieve keys in a dataset of strings, providing O(L) search, insert, and prefix lookup where L is string length.',
    recognitionSignals: [
      'Prefix search, autocomplete, spell-checking',
      'Word Search II (finding multiple dictionary words in a grid)',
      'Maximum XOR of Two Numbers in an Array (Bitwise Trie)',
    ],
    commonMistakes: [
      'Forgetting to flag `isEndOfWord = true` at the final character node',
      'Not allocating children map/array properly leading to runtime errors',
    ],
    prerequisites: ['Trees', 'Strings', 'Hash Maps'],
  },
  {
    name: 'Bit Manipulation / XOR Tricks',
    slug: 'bit-manipulation-xor',
    description:
      'Using bitwise operators (&, |, ^, ~, <<, >>) to manipulate binary representations for O(1) arithmetic, subset generation, parity checking, and finding unique numbers.',
    recognitionSignals: [
      'Single Number (finding unique element where others appear twice)',
      'Counting set bits (Hamming weight, Brian Kernighan\'s algorithm)',
      'Bitmask dynamic programming (travelling salesman, small N sets)',
    ],
    commonMistakes: [
      'Operator precedence bugs (e.g. `a & b == 0` evaluates as `a & (b == 0)`, use `(a & b) == 0`)',
      '32-bit signed integer overflow on bit shifts in JavaScript/TypeScript',
    ],
    prerequisites: ['Binary Arithmetic', 'Logic Gates'],
  },
  {
    name: 'Segment Tree / Fenwick Tree (BIT)',
    slug: 'segment-tree-fenwick-tree',
    description:
      'Tree data structures supporting range queries (sum, min, max, gcd) and point/range updates in O(log N) time on dynamic arrays.',
    recognitionSignals: [
      'Range Sum / Min / Max queries with frequent point or range updates',
      'Count of smaller numbers after self / Inversion count',
      'Dynamic frequency tables',
    ],
    commonMistakes: [
      '1-based indexing errors in Fenwick tree (`i += i & (-i)`)',
      'Allocating insufficient space for segment tree (needs 4 * N array size)',
    ],
    prerequisites: ['Binary Trees', 'Recursion', 'Binary Arithmetic'],
  },
  {
    name: 'Matrix Traversal & Grid Search',
    slug: 'matrix-traversal-grid-search',
    description:
      'Structured exploration of 2D grids (spiral order, diagonal traversal, rotate image, word search) maintaining coordinate bounds and direction vectors.',
    recognitionSignals: [
      '2D grid manipulation (Spiral Matrix, Set Matrix Zeroes, Rotate Matrix)',
      'Pathfinding in maze grids with obstacles',
    ],
    commonMistakes: [
      'Row/col coordinate mixups (grid[r][c] vs grid[x][y])',
      'Overwriting values in-place without temporary markers or bitwise flags in Set Matrix Zeroes',
    ],
    prerequisites: ['2D Arrays', 'Coordinate Systems'],
  },
  {
    name: 'Divide and Conquer',
    slug: 'divide-and-conquer',
    description:
      'Breaking a problem down into two or more smaller independent subproblems of the same type, solving them recursively, and combining their results (e.g. Merge Sort, Closest Pair of Points).',
    recognitionSignals: [
      'Problem can be split into non-overlapping subproblems solved identically',
      'Merge Sort, Quick Select, Fast Power (x^n in O(log N))',
      'Constructing balanced BST from sorted sequence',
    ],
    commonMistakes: [
      'Incorrect base cases leading to infinite recursion',
      'Subproblems overlapping without memoization (which would become Dynamic Programming)',
    ],
    prerequisites: ['Recursion', 'Sorting'],
  },
];

/**
 * Idempotently seeds the 30 DSA patterns into the database.
 * Uses bulkWrite with upsert to avoid duplicate key errors.
 */
export async function seedPatterns(): Promise<number> {
  const operations = INITIAL_PATTERNS.map((pattern) => ({
    updateOne: {
      filter: { slug: pattern.slug },
      update: { $set: pattern },
      upsert: true,
    },
  }));

  const result = await Pattern.bulkWrite(operations);
  const totalCount = await Pattern.countDocuments();
  console.log(
    `✅ Patterns seeded idempotently: ${result.upsertedCount} inserted, ${result.modifiedCount} updated. Total patterns in DB: ${totalCount}`
  );
  return totalCount;
}
