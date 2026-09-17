import { AssessmentQuestion, EvaluationResult, Badge } from './types';

export const FALLBACK_QUESTIONS: Record<string, AssessmentQuestion[]> = {
  React: [
    { question: 'What is a hook in React?', options: ['A function component', 'A special function that lets you "hook into" React features', 'A class method', 'A DOM element'], answerIndex: 1 },
    { question: 'What is the virtual DOM?', options: ['A direct copy of the real DOM', 'A lightweight representation of the real DOM in memory', 'A browser extension', 'A state management tool'], answerIndex: 1 },
    { question: 'Which hook is used to manage side effects?', options: ['useState', 'useReducer', 'useEffect', 'useMemo'], answerIndex: 2 }
  ],
  Python: [
    { question: 'What is a list comprehension?', options: ['A loop', 'A concise way to create lists', 'A class', 'A dictionary'], answerIndex: 1 },
    { question: 'Which keyword is used to define a function?', options: ['def', 'func', 'function', 'fn'], answerIndex: 0 },
    { question: 'What is PEP 8?', options: ['A python framework', 'A style guide for Python code', 'A built-in module', 'A package manager'], answerIndex: 1 }
  ],
  JavaScript: [
    { question: 'What does "use strict" do?', options: ['Enforces strict mode', 'Ignores errors', 'Speeds up execution', 'Makes code async'], answerIndex: 0 },
    { question: 'What is a closure?', options: ['A function combined with its lexical environment', 'A closed block of code', 'A private variable', 'A loop'], answerIndex: 0 },
    { question: 'Which operator is used for strict equality?', options: ['==', '=', '===', '!='], answerIndex: 2 }
  ],
  'Machine Learning': [
    { question: 'What is supervised learning?', options: ['Learning without labels', 'Learning with labeled data', 'Reinforcement learning', 'Clustering'], answerIndex: 1 },
    { question: 'What is overfitting?', options: ['Model performs well on training data but poorly on unseen data', 'Model underperforms on training data', 'Model is too simple', 'Data is too large'], answerIndex: 0 },
    { question: 'Which metric is common for classification?', options: ['MSE', 'RMSE', 'Accuracy', 'R-squared'], answerIndex: 2 }
  ],
  'Data Structures': [
    { question: 'What is a queue?', options: ['LIFO data structure', 'FIFO data structure', 'A tree', 'A graph'], answerIndex: 1 },
    { question: 'What is the time complexity of searching in a BST?', options: ['O(1)', 'O(n)', 'O(log n)', 'O(n^2)'], answerIndex: 2 },
    { question: 'Which data structure uses keys and values?', options: ['Array', 'Stack', 'Hash Table', 'Linked List'], answerIndex: 2 }
  ],
  Programming: [
    { question: 'What is a variable?', options: ['A constant', 'A named memory location for data', 'A function', 'A loop'], answerIndex: 1 },
    { question: 'What is a boolean?', options: ['A string', 'A number', 'A true or false value', 'An object'], answerIndex: 2 },
    { question: 'What does an IDE stand for?', options: ['Integrated Development Environment', 'Internal Design Engine', 'Internet Data Explorer', 'Interactive Dev Environment'], answerIndex: 0 }
  ]
};

export const FALLBACK_EVALUATION: EvaluationResult = {
  correctness: 85,
  quality: 90,
  improvement: 'Consider adding error handling for edge cases and input validation to improve robustness.',
  overall: 88,
  summary: 'Good overall implementation with solid logic. Could benefit from optimization in loops and better error handling.'
};

export const SKILL_TEMPLATES: Record<string, any[]> = {
  React: [
    { name: 'JSX', description: 'JavaScript XML', level: 1, parent: null },
    { name: 'Components', description: 'Building blocks', level: 2, parent: 'JSX' },
    { name: 'State', description: 'Local state management', level: 3, parent: 'Components' },
    { name: 'Props', description: 'Passing data', level: 3, parent: 'Components' },
    { name: 'Hooks', description: 'Function components features', level: 4, parent: 'State' },
  ],
  Python: [
    { name: 'Syntax', description: 'Basic syntax', level: 1, parent: null },
    { name: 'Data Types', description: 'Core data types', level: 2, parent: 'Syntax' },
    { name: 'Control Flow', description: 'Loops and conditionals', level: 3, parent: 'Data Types' },
    { name: 'Functions', description: 'Reusable code blocks', level: 4, parent: 'Control Flow' },
    { name: 'OOP', description: 'Object-oriented programming', level: 5, parent: 'Functions' },
  ],
  'Machine Learning': [
    { name: 'Data Prep', description: 'Cleaning data', level: 1, parent: null },
    { name: 'Supervised Learning', description: 'Labeled data', level: 2, parent: 'Data Prep' },
    { name: 'Unsupervised Learning', description: 'Unlabeled data', level: 2, parent: 'Data Prep' },
    { name: 'Neural Networks', description: 'Deep learning basics', level: 3, parent: 'Supervised Learning' },
    { name: 'Model Evaluation', description: 'Testing models', level: 4, parent: 'Neural Networks' },
  ]
};

export const MOCK_PEERS = [
  { id: '1', name: 'Alice Smith', avatar_url: 'https://ui-avatars.com/api/?name=Alice+Smith&background=D97706&color=fff', skills: [{ name: 'React', mastery: 80 }], needs: ['Python'], offers: ['React', 'JavaScript'], bio: 'Frontend dev learning backend.' },
  { id: '2', name: 'Bob Jones', avatar_url: 'https://ui-avatars.com/api/?name=Bob+Jones&background=D97706&color=fff', skills: [{ name: 'Python', mastery: 90 }], needs: ['React'], offers: ['Python', 'Data Structures'], bio: 'Data scientist exploring UI.' },
  { id: '3', name: 'Charlie Brown', avatar_url: 'https://ui-avatars.com/api/?name=Charlie+Brown&background=D97706&color=fff', skills: [{ name: 'Machine Learning', mastery: 75 }], needs: ['Data Structures'], offers: ['Machine Learning'], bio: 'ML enthusiast.' },
  { id: '4', name: 'Diana Prince', avatar_url: 'https://ui-avatars.com/api/?name=Diana+Prince&background=D97706&color=fff', skills: [{ name: 'JavaScript', mastery: 85 }], needs: ['Machine Learning'], offers: ['JavaScript', 'React'], bio: 'Full-stack JS dev.' },
  { id: '5', name: 'Evan Wright', avatar_url: 'https://ui-avatars.com/api/?name=Evan+Wright&background=D97706&color=fff', skills: [{ name: 'Data Structures', mastery: 95 }], needs: ['JavaScript'], offers: ['Data Structures', 'Python'], bio: 'Algorithm optimizer.' }
];

export const AVAILABLE_SKILLS = ['React', 'Python', 'JavaScript', 'Machine Learning', 'Data Structures'];

export const BADGE_DEFINITIONS: Badge[] = [
  { id: 'b1', name: 'First Steps', description: 'Completed first assessment', icon: '🚀', earned_at: '' },
  { id: 'b2', name: 'Helper', description: 'Completed first peer session', icon: '🤝', earned_at: '' },
  { id: 'b3', name: 'Master', description: 'Mastered a skill', icon: '🏆', earned_at: '' },
  { id: 'b4', name: 'Consistent', description: '7-day streak', icon: '🔥', earned_at: '' },
  { id: 'b5', name: 'Mentor', description: 'Helped 5 peers', icon: '🌟', earned_at: '' }
];

export const XP_VALUES = {
  assessment_complete: 50,
  session_complete: 100,
  teaching: 150,
  daily_mission: 30,
  streak_day: 10
};
