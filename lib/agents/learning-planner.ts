import { Skill, DailyMission } from '@/lib/types';

const TEMPLATES: Record<string, Partial<Skill>[]> = {
  react: [
    { name: 'JSX Fundamentals', description: 'Core JSX syntax, expressions, and rendering', mastery_pct: 0, level: 1, status: 'active', parent_skill_id: null, order_index: 0 },
    { name: 'Components & Props', description: 'Functional components, prop types, and composition', mastery_pct: 0, level: 1, status: 'locked', parent_skill_id: null, order_index: 1 },
    { name: 'State Management', description: 'useState, lifting state, controlled components', mastery_pct: 0, level: 2, status: 'locked', parent_skill_id: null, order_index: 2 },
    { name: 'Hooks Deep Dive', description: 'useEffect, useRef, useMemo, useCallback, custom hooks', mastery_pct: 0, level: 3, status: 'locked', parent_skill_id: null, order_index: 3 },
    { name: 'Context & Reducers', description: 'useContext, useReducer, global state patterns', mastery_pct: 0, level: 3, status: 'locked', parent_skill_id: null, order_index: 4 },
    { name: 'React Router', description: 'Client-side routing, dynamic routes, navigation', mastery_pct: 0, level: 4, status: 'locked', parent_skill_id: null, order_index: 5 },
    { name: 'Performance', description: 'React.memo, code splitting, Suspense, profiling', mastery_pct: 0, level: 5, status: 'locked', parent_skill_id: null, order_index: 6 },
  ],
  python: [
    { name: 'Python Basics', description: 'Variables, data types, operators, I/O', mastery_pct: 0, level: 1, status: 'active', parent_skill_id: null, order_index: 0 },
    { name: 'Control Flow', description: 'If/else, loops, comprehensions', mastery_pct: 0, level: 1, status: 'locked', parent_skill_id: null, order_index: 1 },
    { name: 'Functions & Modules', description: 'Defining functions, imports, packages', mastery_pct: 0, level: 2, status: 'locked', parent_skill_id: null, order_index: 2 },
    { name: 'OOP in Python', description: 'Classes, inheritance, polymorphism, dunder methods', mastery_pct: 0, level: 3, status: 'locked', parent_skill_id: null, order_index: 3 },
    { name: 'File I/O & Exceptions', description: 'Reading/writing files, error handling, context managers', mastery_pct: 0, level: 3, status: 'locked', parent_skill_id: null, order_index: 4 },
    { name: 'Libraries & Frameworks', description: 'NumPy, pandas, Flask/Django basics', mastery_pct: 0, level: 4, status: 'locked', parent_skill_id: null, order_index: 5 },
  ],
  'machine learning': [
    { name: 'Math Foundations', description: 'Linear algebra, calculus, probability for ML', mastery_pct: 0, level: 1, status: 'active', parent_skill_id: null, order_index: 0 },
    { name: 'Data Preprocessing', description: 'Cleaning, normalization, feature engineering', mastery_pct: 0, level: 2, status: 'locked', parent_skill_id: null, order_index: 1 },
    { name: 'Supervised Learning', description: 'Regression, classification, decision trees, SVM', mastery_pct: 0, level: 3, status: 'locked', parent_skill_id: null, order_index: 2 },
    { name: 'Model Evaluation', description: 'Cross-validation, metrics, bias-variance tradeoff', mastery_pct: 0, level: 3, status: 'locked', parent_skill_id: null, order_index: 3 },
    { name: 'Neural Networks', description: 'Perceptrons, backpropagation, deep learning intro', mastery_pct: 0, level: 4, status: 'locked', parent_skill_id: null, order_index: 4 },
  ],
  javascript: [
    { name: 'Syntax & Basics', description: 'Variables, types, operators, control flow', mastery_pct: 0, level: 1, status: 'active', parent_skill_id: null, order_index: 0 },
    { name: 'DOM Manipulation', description: 'Selecting, modifying, and creating elements', mastery_pct: 0, level: 2, status: 'locked', parent_skill_id: null, order_index: 1 },
    { name: 'Async Programming', description: 'Promises, async/await, fetch API', mastery_pct: 0, level: 3, status: 'locked', parent_skill_id: null, order_index: 2 },
    { name: 'ES6+ Features', description: 'Destructuring, spread, modules, iterators', mastery_pct: 0, level: 3, status: 'locked', parent_skill_id: null, order_index: 3 },
    { name: 'Advanced Patterns', description: 'Closures, prototypes, design patterns, testing', mastery_pct: 0, level: 4, status: 'locked', parent_skill_id: null, order_index: 4 },
  ],
  'data structures': [
    { name: 'Arrays & Strings', description: 'Array operations, string manipulation, two pointers', mastery_pct: 0, level: 1, status: 'active', parent_skill_id: null, order_index: 0 },
    { name: 'Linked Lists', description: 'Singly/doubly linked lists, fast/slow pointers', mastery_pct: 0, level: 2, status: 'locked', parent_skill_id: null, order_index: 1 },
    { name: 'Stacks & Queues', description: 'Stack operations, BFS with queues, monotonic stacks', mastery_pct: 0, level: 2, status: 'locked', parent_skill_id: null, order_index: 2 },
    { name: 'Trees & Graphs', description: 'Binary trees, BST, DFS/BFS, graph traversal', mastery_pct: 0, level: 3, status: 'locked', parent_skill_id: null, order_index: 3 },
    { name: 'Dynamic Programming', description: 'Memoization, tabulation, common DP patterns', mastery_pct: 0, level: 4, status: 'locked', parent_skill_id: null, order_index: 4 },
  ],
};

export function generateSkillTree(domain: string, _level: string): Skill[] {
  const key = domain.toLowerCase();
  const template = TEMPLATES[key] || TEMPLATES.react;
  return template.map((s, i) => ({
    id: crypto.randomUUID(),
    user_id: '',
    name: s.name || 'Skill',
    mastery_pct: s.mastery_pct ?? 0,
    level: s.level ?? 1,
    status: (i === 0 ? 'active' : s.status ?? 'locked') as Skill['status'],
    parent_skill_id: i > 0 ? null : null,
    description: s.description || '',
    order_index: s.order_index ?? i,
  }));
}

export function generateDailyMission(skills: Skill[]): DailyMission {
  const activeSkills = skills.filter(s => s.status === 'active' && s.mastery_pct < 85);
  const focus = activeSkills.length > 0 ? activeSkills[0] : skills[0];
  const missions = [
    { title: 'Implement a Custom Hook', desc: 'Create a useLocalStorage hook. Focus on type safety and error handling.' },
    { title: 'Debug the Broken Component', desc: 'Fix the 3 bugs in the provided component and write a test case.' },
    { title: 'Refactor to Composition', desc: 'Refactor the monolithic component into 3 smaller, reusable components.' },
    { title: 'Build a Mini Feature', desc: 'Implement a search filter with debouncing and loading states.' },
    { title: 'Code Review Challenge', desc: 'Review the provided pull request and write constructive feedback.' },
  ];
  const mission = missions[Math.floor(Date.now() / 86400000) % missions.length];
  return {
    id: `mission-${Date.now()}`,
    user_id: '',
    title: mission.title,
    description: `${mission.desc} Focus area: ${focus?.name || 'General Practice'}.`,
    xp_reward: 50,
    completed: false,
    skill_name: focus?.name || 'General',
    date: new Date().toISOString().split('T')[0],
  };
}
