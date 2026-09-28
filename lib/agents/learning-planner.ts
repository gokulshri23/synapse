import { Skill, DailyMission } from '@/lib/types';

/**
 * Authentic Industry-Standard Roadmaps based on roadmap.sh curriculum specifications
 */
const TEMPLATES: Record<string, Partial<Skill>[]> = {
  react: [
    {
      name: 'Modern JS (ES6+) & DOM Prerequisites',
      description: 'Arrow functions, destructuring, promises, closures, spread/rest, and browser DOM tree',
      mastery_pct: 0,
      level: 1,
      status: 'active',
      parent_skill_id: null,
      order_index: 0,
    },
    {
      name: 'JSX & Rendering Architecture',
      description: 'Virtual DOM, reconciliation, React.createElement, conditional rendering, and keys',
      mastery_pct: 0,
      level: 1,
      status: 'locked',
      parent_skill_id: null,
      order_index: 1,
    },
    {
      name: 'Component Architecture & Props',
      description: 'Functional components, prop contracts, composition over inheritance, and children props',
      mastery_pct: 0,
      level: 2,
      status: 'locked',
      parent_skill_id: null,
      order_index: 2,
    },
    {
      name: 'State Management & Lifecycle',
      description: 'useState, state batching, immutability, lifting state, controlled form components',
      mastery_pct: 0,
      level: 2,
      status: 'locked',
      parent_skill_id: null,
      order_index: 3,
    },
    {
      name: 'Hooks Deep Dive & Custom Hooks',
      description: 'useEffect lifecycle, useRef DOM references, useMemo, useCallback, and reusable custom hooks',
      mastery_pct: 0,
      level: 3,
      status: 'locked',
      parent_skill_id: null,
      order_index: 4,
    },
    {
      name: 'Global State & Context API',
      description: 'useContext, useReducer patterns, global store architecture, Zustand & Redux Toolkit',
      mastery_pct: 0,
      level: 3,
      status: 'locked',
      parent_skill_id: null,
      order_index: 5,
    },
    {
      name: 'Client-Side Routing & Navigation',
      description: 'React Router v6+, layout routes, dynamic URL parameters, navigation guards',
      mastery_pct: 0,
      level: 4,
      status: 'locked',
      parent_skill_id: null,
      order_index: 6,
    },
    {
      name: 'Data Fetching & Server State',
      description: 'TanStack Query (React Query), SWR, optimistic UI updates, cache invalidation',
      mastery_pct: 0,
      level: 4,
      status: 'locked',
      parent_skill_id: null,
      order_index: 7,
    },
    {
      name: 'Full-Stack Next.js & Server Components',
      description: 'App Router, React Server Components (RSC), SSR/SSG, Server Actions, streaming',
      mastery_pct: 0,
      level: 5,
      status: 'locked',
      parent_skill_id: null,
      order_index: 8,
    },
    {
      name: 'Performance Optimization & Profiling',
      description: 'Code splitting, React.lazy, Suspense, memory leak prevention, Web Vitals profiling',
      mastery_pct: 0,
      level: 5,
      status: 'locked',
      parent_skill_id: null,
      order_index: 9,
    },
  ],
  python: [
    {
      name: 'Syntax, Data Types & Control Flow',
      description: 'Variables, dynamic typing, conditionals, loops (for/while), list & dict comprehensions',
      mastery_pct: 0,
      level: 1,
      status: 'active',
      parent_skill_id: null,
      order_index: 0,
    },
    {
      name: 'Data Structures & Collections',
      description: 'Lists, tuples, dictionaries, sets, collections (Counter, defaultdict, deque), slicing',
      mastery_pct: 0,
      level: 1,
      status: 'locked',
      parent_skill_id: null,
      order_index: 1,
    },
    {
      name: 'Functions, Scopes & Decorators',
      description: 'First-class functions, *args/**kwargs, closures, decorators, lambda functions',
      mastery_pct: 0,
      level: 2,
      status: 'locked',
      parent_skill_id: null,
      order_index: 2,
    },
    {
      name: 'Generators, Iterators & Memory',
      description: 'Iterables protocol, yield expressions, generator pipelines, lazy evaluation',
      mastery_pct: 0,
      level: 2,
      status: 'locked',
      parent_skill_id: null,
      order_index: 3,
    },
    {
      name: 'Object-Oriented Programming (OOP)',
      description: 'Classes, inheritance, polymorphism, encapsulation, dunder methods (__init__, __str__, __repr__)',
      mastery_pct: 0,
      level: 3,
      status: 'locked',
      parent_skill_id: null,
      order_index: 4,
    },
    {
      name: 'File I/O, Serialization & Exceptions',
      description: 'Context managers (with), custom exception hierarchies, JSON, CSV parsing, pickle',
      mastery_pct: 0,
      level: 3,
      status: 'locked',
      parent_skill_id: null,
      order_index: 5,
    },
    {
      name: 'Modules, Virtual Envs & Packaging',
      description: 'Import resolution, __name__ == __main__, pip, virtualenv, pyproject.toml',
      mastery_pct: 0,
      level: 4,
      status: 'locked',
      parent_skill_id: null,
      order_index: 6,
    },
    {
      name: 'Concurrency: Asyncio & Multiprocessing',
      description: 'Global Interpreter Lock (GIL), threading vs multiprocessing, asyncio event loop',
      mastery_pct: 0,
      level: 4,
      status: 'locked',
      parent_skill_id: null,
      order_index: 7,
    },
    {
      name: 'Web Frameworks & APIs (FastAPI/Django)',
      description: 'FastAPI routing, Pydantic type validation, asynchronous endpoints, ORM models',
      mastery_pct: 0,
      level: 5,
      status: 'locked',
      parent_skill_id: null,
      order_index: 8,
    },
    {
      name: 'Testing, Typing & Profiling',
      description: 'pytest suites, mocking, mypy static type checking, cProfile performance analysis',
      mastery_pct: 0,
      level: 5,
      status: 'locked',
      parent_skill_id: null,
      order_index: 9,
    },
  ],
  javascript: [
    {
      name: 'Variables, Scopes & Memory Model',
      description: 'var/let/const, temporal dead zone, execution context, call stack, hoisting',
      mastery_pct: 0,
      level: 1,
      status: 'active',
      parent_skill_id: null,
      order_index: 0,
    },
    {
      name: 'Data Types, Coercion & Operators',
      description: 'Primitives vs references, type coercion rules, strict equality, truthy/falsy',
      mastery_pct: 0,
      level: 1,
      status: 'locked',
      parent_skill_id: null,
      order_index: 1,
    },
    {
      name: 'Functions, Closures & Lexical Scope',
      description: 'Higher-order functions, closure retention, IIFEs, recursion, function currying',
      mastery_pct: 0,
      level: 2,
      status: 'locked',
      parent_skill_id: null,
      order_index: 2,
    },
    {
      name: 'The "this" Keyword & Object Prototypes',
      description: 'Explicit binding (call/apply/bind), arrow function lexical this, prototype chain',
      mastery_pct: 0,
      level: 2,
      status: 'locked',
      parent_skill_id: null,
      order_index: 3,
    },
    {
      name: 'DOM Manipulation & Event Architecture',
      description: 'DOM tree traversal, event bubbling, capturing, event delegation, custom events',
      mastery_pct: 0,
      level: 3,
      status: 'locked',
      parent_skill_id: null,
      order_index: 4,
    },
    {
      name: 'Asynchronous JS & The Event Loop',
      description: 'Macrotasks vs microtasks, Promises architecture, async/await, fetch API, abort controller',
      mastery_pct: 0,
      level: 3,
      status: 'locked',
      parent_skill_id: null,
      order_index: 5,
    },
    {
      name: 'Modern ES6+ Features & Modules',
      description: 'Destructuring, rest/spread, Symbol, BigInt, ES Modules (import/export), dynamic imports',
      mastery_pct: 0,
      level: 4,
      status: 'locked',
      parent_skill_id: null,
      order_index: 6,
    },
    {
      name: 'Browser Storage & Web APIs',
      description: 'localStorage, sessionStorage, IndexedDB, Web Workers, Intersection Observer',
      mastery_pct: 0,
      level: 4,
      status: 'locked',
      parent_skill_id: null,
      order_index: 7,
    },
    {
      name: 'Error Handling, Debugging & DevTools',
      description: 'Error classes, try/catch/finally, Chrome DevTools breakpoints, memory profiling',
      mastery_pct: 0,
      level: 5,
      status: 'locked',
      parent_skill_id: null,
      order_index: 8,
    },
    {
      name: 'Modern Tooling, Bundlers & TypeScript',
      description: 'Vite, esbuild, Babel, npm dependencies, static type checking with TypeScript',
      mastery_pct: 0,
      level: 5,
      status: 'locked',
      parent_skill_id: null,
      order_index: 9,
    },
  ],
  'machine learning': [
    {
      name: 'Mathematics for Machine Learning',
      description: 'Linear algebra, matrix decomposition, multivariate calculus, probability distributions',
      mastery_pct: 0,
      level: 1,
      status: 'active',
      parent_skill_id: null,
      order_index: 0,
    },
    {
      name: 'Data Preprocessing & Exploration',
      description: 'Pandas data wrangling, missing data imputation, feature scaling, outlier detection',
      mastery_pct: 0,
      level: 1,
      status: 'locked',
      parent_skill_id: null,
      order_index: 1,
    },
    {
      name: 'Feature Engineering & Selection',
      description: 'One-hot encoding, binning, interaction terms, PCA dimensionality reduction',
      mastery_pct: 0,
      level: 2,
      status: 'locked',
      parent_skill_id: null,
      order_index: 2,
    },
    {
      name: 'Supervised Learning: Regression',
      description: 'Linear, Ridge, Lasso regression, gradient descent optimization, MSE/R2 evaluation',
      mastery_pct: 0,
      level: 2,
      status: 'locked',
      parent_skill_id: null,
      order_index: 3,
    },
    {
      name: 'Supervised Learning: Classification',
      description: 'Logistic regression, Decision Trees, Random Forests, SVM, ROC-AUC metrics',
      mastery_pct: 0,
      level: 3,
      status: 'locked',
      parent_skill_id: null,
      order_index: 4,
    },
    {
      name: 'Unsupervised Learning & Clustering',
      description: 'K-Means, hierarchical clustering, DBSCAN, silhouette score, anomaly detection',
      mastery_pct: 0,
      level: 3,
      status: 'locked',
      parent_skill_id: null,
      order_index: 5,
    },
    {
      name: 'Model Evaluation & Cross-Validation',
      description: 'K-Fold cross-validation, hyperparameter tuning, Grid/Random Search, bias-variance',
      mastery_pct: 0,
      level: 4,
      status: 'locked',
      parent_skill_id: null,
      order_index: 6,
    },
    {
      name: 'Neural Networks & Deep Learning Intro',
      description: 'Perceptrons, forward/backpropagation, activation functions (ReLU, Sigmoid), PyTorch',
      mastery_pct: 0,
      level: 4,
      status: 'locked',
      parent_skill_id: null,
      order_index: 7,
    },
    {
      name: 'Computer Vision & NLP Foundations',
      description: 'Convolutional layers (CNNs), tokenization, text embeddings, Transformer attention',
      mastery_pct: 0,
      level: 5,
      status: 'locked',
      parent_skill_id: null,
      order_index: 8,
    },
    {
      name: 'MLOps, Serialization & API Serving',
      description: 'Model saving (ONNX, joblib), FastAPI model serving, pipeline deployment, drift monitoring',
      mastery_pct: 0,
      level: 5,
      status: 'locked',
      parent_skill_id: null,
      order_index: 9,
    },
  ],
  'data structures': [
    {
      name: 'Complexity Analysis (Big-O Notation)',
      description: 'Time & space complexity, asymptotic bounds, worst/average/best case tradeoffs',
      mastery_pct: 0,
      level: 1,
      status: 'active',
      parent_skill_id: null,
      order_index: 0,
    },
    {
      name: 'Arrays, Strings & Two-Pointer Patterns',
      description: 'Sliding window, prefix sums, two-pointer technique, Kadane’s maximum subarray',
      mastery_pct: 0,
      level: 1,
      status: 'locked',
      parent_skill_id: null,
      order_index: 1,
    },
    {
      name: 'Linked Lists & Fast/Slow Pointers',
      description: 'Singly & doubly linked lists, cycle detection (Floyd’s algorithm), list reversal',
      mastery_pct: 0,
      level: 2,
      status: 'locked',
      parent_skill_id: null,
      order_index: 2,
    },
    {
      name: 'Stacks, Queues & Monotonic Structures',
      description: 'LIFO/FIFO mechanisms, monotonic stacks, next greater element, sliding window maximum',
      mastery_pct: 0,
      level: 2,
      status: 'locked',
      parent_skill_id: null,
      order_index: 3,
    },
    {
      name: 'Hash Tables & Collision Resolution',
      description: 'Hash functions, chaining vs open addressing, frequency counters, amortized O(1)',
      mastery_pct: 0,
      level: 3,
      status: 'locked',
      parent_skill_id: null,
      order_index: 4,
    },
    {
      name: 'Recursion & Backtracking Algorithms',
      description: 'Call stack tracing, subsets generation, permutations, N-Queens problem',
      mastery_pct: 0,
      level: 3,
      status: 'locked',
      parent_skill_id: null,
      order_index: 5,
    },
    {
      name: 'Trees & Binary Search Trees (BST)',
      description: 'Pre/In/Post-order traversals, level-order (BFS), BST search/insert, lowest common ancestor',
      mastery_pct: 0,
      level: 4,
      status: 'locked',
      parent_skill_id: null,
      order_index: 6,
    },
    {
      name: 'Heaps & Priority Queues',
      description: 'Min/Max binary heaps, heapify operations, Top-K frequent elements, Dijkstra prep',
      mastery_pct: 0,
      level: 4,
      status: 'locked',
      parent_skill_id: null,
      order_index: 7,
    },
    {
      name: 'Graphs & Network Traversal',
      description: 'Adjacency list representations, BFS/DFS, topological sorting, connected components',
      mastery_pct: 0,
      level: 5,
      status: 'locked',
      parent_skill_id: null,
      order_index: 8,
    },
    {
      name: 'Dynamic Programming & Memoization',
      description: 'Overlapping subproblems, 1D/2D table DP, 0/1 Knapsack, Longest Common Subsequence',
      mastery_pct: 0,
      level: 5,
      status: 'locked',
      parent_skill_id: null,
      order_index: 9,
    },
  ],
};

/**
 * Generates an authentic Skill Tree strictly tailored to assessed score and level.
 * When the user scores 0% (or has level 0), Sector 1 starts at 0% and ALL subsequent sectors are LOCKED.
 */
export function generateSkillTree(
  domain: string,
  levelInput?: string | number,
  scoreInput?: number
): Skill[] {
  const key = domain ? domain.toLowerCase().trim() : 'react';

  // Find best matching template
  let template = TEMPLATES[key];
  if (!template) {
    if (key.includes('py')) template = TEMPLATES.python;
    else if (key.includes('react') || key.includes('next') || key.includes('web')) template = TEMPLATES.react;
    else if (key.includes('machine') || key.includes('ml') || key.includes('ai')) template = TEMPLATES['machine learning'];
    else if (key.includes('script') || key.includes('js') || key.includes('node')) template = TEMPLATES.javascript;
    else if (key.includes('data') || key.includes('algo') || key.includes('structure')) template = TEMPLATES['data structures'];
    else template = TEMPLATES.react;
  }

  // Parse level and enforce diagnostic score authority
  let numericLevel = 0;
  if (typeof levelInput === 'number') {
    numericLevel = Math.max(0, Math.min(5, levelInput));
  } else if (typeof levelInput === 'string') {
    const match = levelInput.match(/\d+/);
    if (match) {
      numericLevel = parseInt(match[0], 10);
    } else if (levelInput.toLowerCase().includes('advanced') || levelInput.toLowerCase().includes('expert')) {
      numericLevel = 4;
    } else if (levelInput.toLowerCase().includes('intermediate')) {
      numericLevel = 3;
    } else if (levelInput.toLowerCase().includes('beginner')) {
      numericLevel = 1;
    } else {
      numericLevel = 0;
    }
  }

  // CRITICAL FIX: If user attempted diagnostic quiz and got 0% (or < 25%),
  // force Level 0! Sector 1 starts at 0% and NOTHING else is unlocked!
  if (typeof scoreInput === 'number') {
    if (scoreInput <= 15) {
      numericLevel = 0;
    } else if (scoreInput < 45) {
      numericLevel = Math.min(1, numericLevel);
    } else if (scoreInput < 70) {
      numericLevel = Math.min(2, numericLevel);
    } else if (scoreInput < 85) {
      numericLevel = Math.min(3, numericLevel);
    }
  }

  return template.map((s, i) => {
    let status: Skill['status'] = 'locked';
    let mastery = 0;

    if (numericLevel === 0) {
      // Level 0: Completely fresh. Topic 0 is active at initial score (or 0%).
      // All other topics are strictly locked!
      if (i === 0) {
        status = 'active';
        mastery = typeof scoreInput === 'number' && scoreInput > 0 ? scoreInput : 0;
      } else {
        status = 'locked';
        mastery = 0;
      }
    } else if (i < numericLevel) {
      // Prior topics are mastered
      status = 'mastered';
      mastery = 85 + Math.min(15, (i + 1) * 3);
    } else if (i === numericLevel) {
      // Current active topic frontier
      status = 'active';
      mastery = typeof scoreInput === 'number' && scoreInput > 0 ? Math.min(45, scoreInput) : 20;
    } else {
      // Future topics are locked
      status = 'locked';
      mastery = 0;
    }

    return {
      id: crypto.randomUUID(),
      user_id: '',
      name: s.name || 'Skill',
      mastery_pct: mastery,
      level: s.level ?? (i + 1),
      status,
      parent_skill_id: null,
      description: s.description || '',
      order_index: s.order_index ?? i,
    };
  });
}

export function generateDailyMission(skills: Skill[]): DailyMission {
  const activeSkills = skills.filter((s) => s.status === 'active' && s.mastery_pct < 85);
  const focus = activeSkills.length > 0 ? activeSkills[0] : skills[0];
  const missions = [
    {
      title: `Implement ${focus.name} Pattern`,
      desc: `Write a robust implementation demonstrating ${focus.name}. Focus on architectural clarity, error handling, and clean typing.`,
    },
    {
      title: `Debug & Optimize ${focus.name}`,
      desc: `Refactor an unoptimized ${focus.name} implementation to improve performance and prevent common edge-case bugs.`,
    },
    {
      title: `Peer Code Review: ${focus.name}`,
      desc: `Review and annotate a simulated peer implementation of ${focus.name} providing 3 actionable architectural improvements.`,
    },
  ];

  const selected = missions[Math.floor(Math.random() * missions.length)];
  return {
    id: crypto.randomUUID(),
    user_id: '',
    title: selected.title,
    description: selected.desc,
    xp_reward: 50,
    completed: false,
    skill_name: focus.name,
    date: new Date().toISOString().split('T')[0],
  };
}

/**
 * PART 3: One rule, one function to map entry test score to a single unlocked roadmap node.
 * Strict non-overlapping score bands:
 *  0 <= score < 40  -> Level 1 (Node 0 unlocked)
 * 40 <= score < 70  -> Level 2 (Node 0 completed, Node 1 unlocked) -> 66% is strictly Level 2!
 * 70 <= score < 85  -> Level 3 (Nodes 0, 1 completed, Node 2 unlocked)
 * 85 <= score <= 100 -> Level 4 (Nodes 0, 1, 2 completed, Node 3 unlocked)
 * Enforces: EXACTLY ONE node has status = 'unlocked'.
 */
export function applyEntryResultToNodes(
  skill: string,
  score: number,
  topicResults?: Record<string, number>
): Array<{
  topic: string;
  order_index: number;
  status: 'locked' | 'unlocked' | 'completed';
  description: string;
}> {
  const normSkill = (skill || '').trim().toLowerCase();
  let template = TEMPLATES[normSkill];
  if (!template) {
    if (normSkill.includes('py')) template = TEMPLATES.python;
    else if (normSkill.includes('react') || normSkill.includes('web')) template = TEMPLATES.react;
    else if (normSkill.includes('machine') || normSkill.includes('ml')) template = TEMPLATES['machine learning'];
    else if (normSkill.includes('script') || normSkill.includes('js')) template = TEMPLATES.javascript;
    else if (normSkill.includes('data') || normSkill.includes('algo')) template = TEMPLATES['data structures'];
    else template = TEMPLATES.react;
  }

  const cleanScore = Math.max(0, Math.min(100, Math.round(score)));
  let completedCount = 0;
  let unlockedIndex = 0;

  if (topicResults && Object.keys(topicResults).length > 0) {
    // Check per-topic results
    const completedSet = new Set<number>();
    template.forEach((t, idx) => {
      const s = topicResults[t.name || ''];
      if (typeof s === 'number' && s >= 70) {
        completedSet.add(idx);
      }
    });

    let firstIncomplete = -1;
    for (let i = 0; i < template.length; i++) {
      if (!completedSet.has(i)) {
        firstIncomplete = i;
        break;
      }
    }
    unlockedIndex = firstIncomplete !== -1 ? firstIncomplete : template.length - 1;
    completedCount = unlockedIndex;
  } else {
    // Non-overlapping score bands
    let level = 1;
    if (cleanScore >= 85) level = 4;
    else if (cleanScore >= 70) level = 3;
    else if (cleanScore >= 40) level = 2; // 66% falls strictly here
    else level = 1;

    completedCount = level - 1;
    unlockedIndex = level - 1;
  }

  return template.map((item, idx) => {
    let status: 'locked' | 'unlocked' | 'completed' = 'locked';
    if (idx < completedCount) {
      status = 'completed';
    } else if (idx === unlockedIndex) {
      status = 'unlocked';
    } else {
      status = 'locked';
    }

    return {
      topic: item.name || `Topic ${idx + 1}`,
      order_index: idx,
      status,
      description: item.description || '',
    };
  });
}

