import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { AssessmentQuestion } from '@/lib/types';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || 'dummy' });

const FALLBACK_10_QUESTIONS: Record<string, AssessmentQuestion[]> = {
  react: [
    { question: 'What is the primary function of React components?', options: ['Manage SQL databases', 'Return reusable UI elements describing what should appear on screen', 'Handle HTTP socket clustering', 'Directly manipulate the browser DOM imperatively'], answerIndex: 1 },
    { question: 'Which hook should be used to store a counter value that updates and triggers re-renders?', options: ['useRef', 'useEffect', 'useState', 'useMemo'], answerIndex: 2 },
    { question: 'What is the purpose of the dependency array in useEffect?', options: ['Specify component styles', 'Control when the effect callback re-runs based on changed values', 'Define prop types', 'Import external npm libraries'], answerIndex: 1 },
    { question: 'Why should you never mutate React state directly like `state.count = 5`?', options: ['JavaScript syntax prohibits it', 'React will not detect the change and will not trigger a re-render', 'It crashes the browser tab', 'It deletes the variable from memory'], answerIndex: 1 },
    { question: 'What is the Virtual DOM in React?', options: ['A physical VR display', 'An in-memory lightweight representation of the real DOM used for reconciliation', 'A direct replacement for HTML5', 'A database engine inside React'], answerIndex: 1 },
    { question: 'When rendering a dynamic list in React with .map(), why is the `key` prop essential?', options: ['It provides CSS styling to each item', 'It helps React identify which items have changed, been added, or removed', 'It acts as an event listener', 'It makes the list items clickable'], answerIndex: 1 },
    { question: 'Which hook provides access to a mutable ref object whose .current property persists without triggering re-renders?', options: ['useState', 'useReducer', 'useRef', 'useCallback'], answerIndex: 2 },
    { question: 'What is the main advantage of custom hooks in React?', options: ['They make components run in multi-threaded web workers', 'They allow extracting and reusing stateful logic across multiple components', 'They bypass the virtual DOM', 'They eliminate the need for functional components'], answerIndex: 1 },
    { question: 'What does the useMemo hook optimize?', options: ['Network request speeds', 'Caches expensive calculation results between re-renders unless dependencies change', 'Server-side rendering latency', 'Component mounting animations'], answerIndex: 1 },
    { question: 'In React 18+, how does Suspense help with asynchronous data fetching?', options: ['It lets components display a fallback UI while waiting for asynchronous operations or code to load', 'It cancels all pending requests', 'It converts async code into synchronous execution', 'It automatically creates database tables'], answerIndex: 0 },
  ],
  python: [
    { question: 'What is the output type of `type([1, 2, 3])` in Python?', options: ['tuple', 'set', 'list', 'dict'], answerIndex: 2 },
    { question: 'Which keyword is used to handle exceptions in Python?', options: ['catch', 'except', 'rescue', 'handle'], answerIndex: 1 },
    { question: 'What is the difference between a list and a tuple in Python?', options: ['Lists are immutable; tuples are mutable', 'Lists are mutable; tuples are immutable', 'Lists only hold integers; tuples hold strings', 'There is no difference'], answerIndex: 1 },
    { question: 'How do you create a dictionary in Python with keys "a" and "b"?', options: ['{"a": 1, "b": 2}', '["a": 1, "b": 2]', '("a" => 1, "b" => 2)', 'set("a"=1, "b"=2)'], answerIndex: 0 },
    { question: 'What does the `self` parameter represent inside an instance method of a Python class?', options: ['The global module namespace', 'The instance of the class that called the method', 'The parent class constructor', 'The Python interpreter pointer'], answerIndex: 1 },
    { question: 'What is a Python decorator?', options: ['A visual GUI style', 'A function that takes another function as an argument and extends its behavior without modifying it', 'A comment block before a function', 'A special variable type'], answerIndex: 1 },
    { question: 'What does list comprehension `[x**2 for x in range(5) if x % 2 == 0]` evaluate to?', options: ['[0, 4, 16]', '[1, 9]', '[0, 1, 4, 9, 16]', '[4, 16]'], answerIndex: 0 },
    { question: 'What is the purpose of Python generators and the `yield` statement?', options: ['They generate random numbers', 'They produce a sequence of values lazily on-the-fly without storing the entire list in memory', 'They terminate a program execution', 'They compile Python into C code'], answerIndex: 1 },
    { question: 'What does `*args` and `**kwargs` allow in a function definition?', options: ['Strict type enforcement', 'Passing variable numbers of positional and keyword arguments to a function', 'Exporting functions to other files', 'Thread-safe memory locks'], answerIndex: 1 },
    { question: 'What is the Global Interpreter Lock (GIL) in standard CPython?', options: ['A security firewall preventing file access', 'A mutex that allows only one native thread to execute Python bytecodes at a time', 'A tool for compiling Python packages', 'A memory leak detector'], answerIndex: 1 },
  ],
  javascript: [
    { question: 'What is the difference between `let` and `var` in JavaScript?', options: ['`var` is block-scoped; `let` is function-scoped', '`let` is block-scoped; `var` is function-scoped', 'There is no difference', '`let` cannot be reassigned'], answerIndex: 1 },
    { question: 'What is a closure in JavaScript?', options: ['A function bundled with references to its surrounding lexical environment', 'A method to close browser windows', 'A loop termination condition', 'An encrypted cookie'], answerIndex: 0 },
    { question: 'What does `===` compare that `==` does not?', options: ['Both value and data type without type coercion', 'Memory address only', 'String length only', 'Function prototypes'], answerIndex: 0 },
    { question: 'Which method creates a new array populated with the results of calling a provided function on every element?', options: ['forEach', 'map', 'filter', 'reduce'], answerIndex: 1 },
    { question: 'What is the Event Loop in JavaScript responsible for?', options: ['Compiling HTML into CSS', 'Monitoring the Call Stack and moving callbacks from the Task Queue to the stack when empty', 'Managing database connections', 'Handling operating system file I/O'], answerIndex: 1 },
    { question: 'How do Promises help handle asynchronous operations compared to callback pyramids of doom?', options: ['They eliminate asynchronous execution', 'They allow chaining asynchronous steps with .then() and catching errors cleanly with .catch()', 'They run JavaScript code on the GPU', 'They guarantee zero latency'], answerIndex: 1 },
    { question: 'What does `async/await` syntax provide over raw Promise chains?', options: ['Faster network transfer speeds', 'A way to write asynchronous code that reads sequentially like synchronous code', 'Multi-core parallel processing', 'Automatic memory allocation'], answerIndex: 1 },
    { question: 'What is the purpose of the `bind()` method in JavaScript?', options: ['To create a new function that has its `this` keyword set to the provided value', 'To combine two strings', 'To join two arrays together', 'To lock an object properties'], answerIndex: 0 },
    { question: 'What is prototype inheritance in JavaScript?', options: ['Objects inherit properties and methods directly from other objects via a prototype chain', 'Classes are compiled into C++ structs', 'Functions cannot access parent variables', 'Variables are globally scoped'], answerIndex: 0 },
    { question: 'What is the difference between microtasks (e.g., Promise.then) and macrotasks (e.g., setTimeout)?', options: ['Microtasks have lower priority than macrotasks', 'All microtasks in the microtask queue are executed before the next macrotask is processed from the task queue', 'They run at the exact same time in parallel threads', 'Macrotasks run before microtasks'], answerIndex: 1 },
  ],
  'machine learning': [
    { question: 'What is the fundamental difference between Supervised and Unsupervised Learning?', options: ['Supervised uses labeled training data; unsupervised learns patterns from unlabeled data', 'Supervised requires GPUs; unsupervised does not', 'Supervised cannot do classification', 'There is no difference'], answerIndex: 0 },
    { question: 'What does "overfitting" mean in a machine learning model?', options: ['The model is too simple and has high bias', 'The model memorizes training noise and fails to generalize to unseen test data', 'The training dataset has too many columns', 'The loss function is undefined'], answerIndex: 1 },
    { question: 'What is the purpose of a validation dataset during model training?', options: ['To tune hyperparameters and detect overfitting without leaking test data', 'To calculate the final test accuracy for the client', 'To increase the training dataset size', 'To generate synthetic image data'], answerIndex: 0 },
    { question: 'What does the loss function measure?', options: ['How fast the GPU fans spin', 'The discrepancy between model predictions and actual ground truth targets', 'The size of the model file on disk', 'The number of layers in a neural network'], answerIndex: 1 },
    { question: 'What is Gradient Descent used for in machine learning?', options: ['An optimization algorithm to minimize the loss function by iteratively updating model weights in the direction of steepest descent', 'A sorting algorithm for large arrays', 'A technique to normalize image pixels', 'A method to compress trained models'], answerIndex: 0 },
    { question: 'What does an activation function (like ReLU) introduce to a neural network?', options: ['Linear equations only', 'Non-linearity, enabling the network to learn complex non-linear patterns', 'Garbage collection triggers', 'Faster hard drive reading'], answerIndex: 1 },
    { question: 'What does the Precision metric measure in binary classification?', options: ['Proportion of true positive predictions among all positive predictions made', 'Proportion of all correct predictions', 'Number of total samples evaluated', 'Average training loss per epoch'], answerIndex: 0 },
    { question: 'What problem does Regularization (like L1 Lasso or L2 Ridge) primarily address?', options: ['Memory leaks', 'Preventing overfitting by penalizing large model weight values', 'Accelerating matrix multiplications', 'Balancing unskewed classes'], answerIndex: 1 },
    { question: 'What is the key advantage of Convolutional Neural Networks (CNNs) for image tasks?', options: ['They process text faster than transformers', 'They exploit spatial locality and translation invariance through weight sharing and filters', 'They require no training parameters', 'They only work on 1D arrays'], answerIndex: 1 },
    { question: 'What is the self-attention mechanism in the Transformer architecture?', options: ['A mechanism that computes pairwise correlation weights between all tokens in a sequence regardless of distance', 'A method to ignore past tokens', 'A technique to train models with no data', 'A simple feedforward perceptron'], answerIndex: 0 },
  ],
  'data structures': [
    { question: 'What is the average time complexity of looking up an element in a Hash Table?', options: ['O(N)', 'O(log N)', 'O(1)', 'O(N^2)'], answerIndex: 2 },
    { question: 'Which data structure follows the First-In, First-Out (FIFO) principle?', options: ['Stack', 'Queue', 'Binary Search Tree', 'Min-Heap'], answerIndex: 1 },
    { question: 'What is the worst-case time complexity of searching in an unbalanced Binary Search Tree (BST)?', options: ['O(1)', 'O(log N)', 'O(N)', 'O(N log N)'], answerIndex: 2 },
    { question: 'Which data structure is naturally used to implement recursion and Depth-First Search (DFS)?', options: ['FIFO Queue', 'Call Stack', 'Hash Map', 'Circular Buffer'], answerIndex: 1 },
    { question: 'What is the time complexity of finding the minimum element in a Min-Heap?', options: ['O(1)', 'O(log N)', 'O(N)', 'O(N^2)'], answerIndex: 0 },
    { question: 'What is the main advantage of a Doubly Linked List over a Singly Linked List?', options: ['Requires less memory per node', 'Allows bidirectional traversal (both forwards and backwards) and O(1) removal given a node reference', 'Has faster sequential access than an array', 'Sorts elements automatically on insert'], answerIndex: 1 },
    { question: 'Which algorithm is best suited for finding the shortest path in an unweighted graph?', options: ['Depth-First Search (DFS)', 'Breadth-First Search (BFS)', 'Kruskal Algorithm', 'Binary Search'], answerIndex: 1 },
    { question: 'What is the space complexity of an adjacency matrix representation for a graph with V vertices?', options: ['O(V)', 'O(V + E)', 'O(V^2)', 'O(E log V)'], answerIndex: 2 },
    { question: 'In Dynamic Programming, what are the two core properties a problem must have?', options: ['High recursion and fast I/O', 'Optimal substructure and overlapping subproblems', 'Binary tree structure and sorted arrays', 'Prime number constraints and loops'], answerIndex: 1 },
    { question: 'What is a Trie (Prefix Tree) primarily used for?', options: ['Fast retrieval and prefix searching of strings or words in O(L) time where L is word length', 'Graph coloring algorithms', 'Mathematical matrix inversion', 'Rendering 3D polygon meshes'], answerIndex: 0 },
  ],
  'system design': [
    { question: 'What is the primary trade-off stated by the CAP Theorem in distributed systems?', options: ['Cost, Availability, Performance', 'Consistency, Availability, Partition tolerance', 'Concurrency, Atomicity, Persistence', 'Caching, Asynchrony, Parallelism'], answerIndex: 1 },
    { question: 'What is the main function of a reverse proxy like NGINX?', options: ['Directly query the database', 'Route client requests to backend servers, handle SSL termination, and load balance', 'Compile JavaScript code', 'Replace DNS servers'], answerIndex: 1 },
    { question: 'Which caching eviction policy removes the item that has not been accessed for the longest period of time?', options: ['FIFO (First In First Out)', 'LRU (Least Recently Used)', 'LFU (Least Frequently Used)', 'Random Eviction'], answerIndex: 1 },
    { question: 'What is Database Sharding?', options: ['Creating index trees on a single table', 'Horizontally partitioning data across multiple database instances to scale write and storage capacity', 'Taking nightly database backups', 'Encrypting database columns'], answerIndex: 1 },
    { question: 'What problem does Consistent Hashing solve in distributed caching?', options: ['Minimizes key remapping when cache nodes are added or removed', 'Sorts cache keys alphabetically', 'Compresses cache memory by 90%', 'Eliminates cache misses entirely'], answerIndex: 0 },
    { question: 'What is the purpose of a Message Queue (e.g. Kafka, RabbitMQ)?', options: ['To decouple services and buffer asynchronous tasks between producers and consumers', 'To render UI buttons', 'To execute SQL joins faster', 'To replace HTTPS with UDP'], answerIndex: 0 },
    { question: 'What is the difference between vertical scaling and horizontal scaling?', options: ['Vertical scaling adds more CPU/RAM to a single machine; horizontal scaling adds more machine nodes to a cluster', 'Vertical scaling is cheaper than horizontal', 'Horizontal scaling only works on Windows', 'There is no difference'], answerIndex: 0 },
    { question: 'What is a CDN (Content Delivery Network) used for?', options: ['To cache and deliver static assets (images, CSS, JS) from edge servers close to users geographically', 'To run backend database transactions', 'To compile TypeScript', 'To generate SSL certificates'], answerIndex: 0 },
    { question: 'What does Idempotency mean in API design?', options: ['The API is encrypted', 'An operation can be applied multiple times without changing the result beyond the initial application', 'The API returns JSON only', 'The endpoint requires no authentication'], answerIndex: 1 },
    { question: 'What is the primary role of a Circuit Breaker pattern in microservices?', options: ['Prevent cascading failures by failing fast when a downstream service is unresponsive', 'Accelerate CPU clock speed', 'Automatically bill cloud users', 'Encrypt socket packets'], answerIndex: 0 },
  ],
  databases: [
    { question: 'What do the ACID properties stand for in relational databases?', options: ['Atomicity, Consistency, Isolation, Durability', 'Accuracy, Concurrency, Indexing, Data', 'Asynchrony, Caching, Iteration, Deletion', 'Allocation, Clustering, Integrity, Distribution'], answerIndex: 0 },
    { question: 'What is the main purpose of an index on a database column (such as a B-Tree index)?', options: ['Enforce SSL encryption', 'Significantly speed up data retrieval queries at the cost of additional storage and write overhead', 'Compress table rows into zip files', 'Automatically format dates'], answerIndex: 1 },
    { question: 'What type of JOIN returns all records from the left table and matched records from the right table?', options: ['INNER JOIN', 'LEFT OUTER JOIN', 'FULL JOIN', 'CROSS JOIN'], answerIndex: 1 },
    { question: 'What is database normalization primarily designed to reduce?', options: ['Network latency', 'Data redundancy and update anomalies', 'RAM usage', 'SQL query complexity'], answerIndex: 1 },
    { question: 'What is the key difference between SQL and NoSQL document databases?', options: ['SQL uses structured relational tables with schemas; NoSQL uses flexible semi-structured JSON documents', 'NoSQL cannot store numbers', 'SQL is only used on client browsers', 'NoSQL requires no servers'], answerIndex: 0 },
    { question: 'What is a database transaction deadlock?', options: ['A corrupt hard drive sector', 'A situation where two or more transactions each hold locks that the other needs, blocking each other indefinitely', 'A query timeout after 30 seconds', 'A syntax error in a stored procedure'], answerIndex: 1 },
    { question: 'What is the difference between optimistic locking and pessimistic locking?', options: ['Optimistic verifies changes haven’t conflicted before committing; pessimistic locks the row upfront', 'Optimistic uses Redis; pessimistic uses PostgreSQL', 'Optimistic only works on reads', 'There is no difference'], answerIndex: 0 },
    { question: 'What does EXPLAIN ANALYZE do in PostgreSQL or MySQL?', options: ['Generates synthetic table data', 'Shows the query execution plan, index usage, and actual execution time taken by each node', 'Backs up the database', 'Runs automated unit tests on stored procedures'], answerIndex: 1 },
    { question: 'What is the Write-Ahead Logging (WAL) mechanism used for?', options: ['To guarantee durability and atomicity by recording changes to a log before writing them to data files', 'To send email logs to admins', 'To monitor web traffic', 'To format SQL syntax'], answerIndex: 0 },
    { question: 'What is database connection pooling?', options: ['Reusing a cache of pre-established database connections rather than creating new connections per request', 'Sharing data between competitors', 'Cleaning up old table rows', 'Running queries in parallel on the GPU'], answerIndex: 0 },
  ],
  devops: [
    { question: 'What is Docker containerization?', options: ['A virtual machine running a full guest OS', 'Packaging an application and all its dependencies into an isolated, lightweight container image that runs consistently anywhere', 'A cloud storage drive', 'A database management system'], answerIndex: 1 },
    { question: 'What is the purpose of Kubernetes in modern software infrastructure?', options: ['Automating deployment, scaling, and management of containerized applications across a cluster', 'Writing backend REST APIs', 'Compiling C++ code', 'Designing website logos'], answerIndex: 0 },
    { question: 'What is a CI/CD pipeline?', options: ['Continuous Integration and Continuous Deployment: automating testing, building, and deploying code changes', 'A customer relationship management tool', 'A network cable between servers', 'A payment processing service'], answerIndex: 0 },
    { question: 'What does Infrastructure as Code (IaC) like Terraform enable?', options: ['Provisioning and managing cloud infrastructure using declarative configuration files instead of manual console clicks', 'Writing CSS in Python', 'Compiling code on the CPU', 'Creating database tables in Excel'], answerIndex: 0 },
    { question: 'What is the difference between Blue-Green deployment and Canary deployment?', options: ['Blue-Green switches 100% traffic between two identical environments; Canary rolls out to a small percentage of users first', 'Blue-Green is for frontend; Canary is for backend', 'Canary uses Docker; Blue-Green does not', 'There is no difference'], answerIndex: 0 },
    { question: 'What is Prometheus commonly used for in DevOps?', options: ['Monitoring, metrics collection, and alerting in time-series data', 'Writing unit tests in Go', 'Building Docker images', 'Managing DNS records'], answerIndex: 0 },
    { question: 'What is a reverse proxy SSL termination?', options: ['Handling HTTPS decryption at the proxy load balancer so internal microservices can communicate over HTTP', 'Deleting expired certificates', 'Blocking all external web traffic', 'Creating self-signed certificates'], answerIndex: 0 },
    { question: 'What is the principle of least privilege in cloud security (IAM)?', options: ['Granting users and services only the minimum permissions necessary to perform their required tasks', 'Giving all developers admin root access', 'Storing passwords in environment files', 'Disabling firewalls for speed'], answerIndex: 0 },
    { question: 'What is a health check endpoint (e.g. /healthz) used for in container orchestrators?', options: ['Allowing Kubernetes or load balancers to monitor whether a container is alive and ready to receive traffic', 'Running nightly database migrations', 'Sending emails to developers', 'Displaying website analytics'], answerIndex: 0 },
    { question: 'What is the main benefit of immutable infrastructure?', options: ['Servers are never modified after deployment; updates deploy new instances and retire old ones, preventing configuration drift', 'Servers cannot be deleted', 'Disks cannot be written to', 'Servers run without electricity'], answerIndex: 0 },
  ]
};

export async function POST(req: Request) {
  try {
    const body = await req.json();

    if (body.action === 'grade' || body.questions) {
      const { questions, answers } = body;
      let correct = 0;
      for (let i = 0; i < questions.length; i++) {
        if (answers[i] === questions[i].answerIndex) {
          correct++;
        }
      }
      const total = questions.length;
      const score = Math.round((correct / Math.max(total, 1)) * 100);
      return NextResponse.json({ score, correct, total, feedback: `You scored ${score}% (${correct}/${total} correct).` });
    }

    const { skill, level, mode, retake, previousQuestions } = body;
    const lowerSkill = (skill || 'react').toLowerCase().trim();

    try {
      let prompt = `Generate 10 progressive multiple choice questions for ${skill} ranging from foundational principles to intermediate and architectural design.
Each question must have exactly 4 options. Return strictly JSON as an array of objects: [{"question": "string", "options": ["string","string","string","string"], "answerIndex": number}]. Do not include any markdown backticks or commentary outside the JSON array.`;

      if (mode === 'placement-diagnostic') {
        prompt = `Generate exactly 10 comprehensive diagnostic placement questions for ${skill}.
These help map the learner's baseline starting proficiency from Level 0 (no knowledge) up to Level 3 (proficient).
Question breakdown:
- Questions 1-3: Core basic concepts, terminology, syntax
- Questions 4-7: Practical usage, state management, common patterns, debugging
- Questions 8-10: Advanced patterns, edge cases, performance considerations, best practices
Each question must have 4 options and answerIndex (0-3). Return ONLY a JSON array of 10 objects: [{"question": "string", "options": ["A","B","C","D"], "answerIndex": number}].`;
      } else if (mode === 'teaching-verification') {
        prompt = `Generate 10 challenging multiple-choice questions to verify if someone is qualified to TEACH ${skill}. Focus on pedagogy, common misconceptions, edge cases, and code design. Return ONLY a JSON array of 10 objects: [{"question": "string", "options": ["A","B","C","D"], "answerIndex": number}].`;
      }

      if (retake && Array.isArray(previousQuestions) && previousQuestions.length > 0) {
        const prevText = previousQuestions.map((q: any) => q.question).join(' | ');
        prompt += `\nIMPORTANT: Do not duplicate these questions: [${prevText}]`;
      }

      const response = await ai.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: prompt
      });

      let text = (response.text || '').trim();
      text = text.replace(/```json\s*/, '').replace(/```\s*/, '').trim();

      const questions: AssessmentQuestion[] = JSON.parse(text);
      if (Array.isArray(questions) && questions.length >= 5) {
        return NextResponse.json({ questions: questions.slice(0, 10) });
      }
    } catch (e) {
      console.warn('[assess] AI generation fallback:', e);
    }

    // High-quality domain fallback with 10 questions
    let picked = FALLBACK_10_QUESTIONS.react;
    for (const k of Object.keys(FALLBACK_10_QUESTIONS)) {
      if (lowerSkill.includes(k) || k.includes(lowerSkill)) {
        picked = FALLBACK_10_QUESTIONS[k];
        break;
      }
    }
    return NextResponse.json({ questions: picked });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Invalid request' }, { status: 400 });
  }
}
