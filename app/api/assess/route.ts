import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { AssessmentQuestion } from '@/lib/types';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || 'dummy' });

const FALLBACK_QUESTIONS: Record<string, AssessmentQuestion[]> = {
  react: [
    { question: 'What is a hook?', options: ['A UI component', 'A function to use state', 'A class method', 'A router'], answerIndex: 1 },
    { question: 'Which hook manages state?', options: ['useEffect', 'useContext', 'useState', 'useReducer'], answerIndex: 2 },
    { question: 'What is JSX?', options: ['A template engine', 'Syntax extension for JS', 'A database query language', 'A styling library'], answerIndex: 1 },
  ],
  python: [
    { question: 'What is a list in Python?', options: ['A tuple', 'A dictionary', 'A mutable sequence', 'A string'], answerIndex: 2 },
    { question: 'Which keyword is used to define a function?', options: ['func', 'def', 'function', 'fn'], answerIndex: 1 },
    { question: 'What is a decorator?', options: ['A class', 'A variable', 'A function that modifies another function', 'A module'], answerIndex: 2 },
  ],
  javascript: [
    { question: 'What is closure?', options: ['A locked file', 'A function bundled with its lexical environment', 'A loop', 'A database connection'], answerIndex: 1 },
  ],
  ml: [
    { question: 'What is overfitting?', options: ['Model learns noise', 'Model is too simple', 'High bias', 'Underperforming on training data'], answerIndex: 0 },
  ],
  ds: [
    { question: 'What is a DataFrame?', options: ['A picture frame', 'A 2D labeled data structure', 'A database table', 'A network packet'], answerIndex: 1 },
  ],
  generic: [
    { question: 'What is the time complexity of binary search?', options: ['O(n)', 'O(log n)', 'O(n^2)', 'O(1)'], answerIndex: 1 },
    { question: 'What is polymorphism?', options: ['Data hiding', 'Multiple inheritance', 'Ability to take many forms', 'Encapsulation'], answerIndex: 2 },
    { question: 'What is HTTP?', options: ['HyperText Transfer Protocol', 'High Text Transfer Protocol', 'Hyper Transfer Text Protocol', 'Hyper Transfer Protocol'], answerIndex: 0 },
  ]
};

export async function POST(req: Request) {
  try {
    const body = await req.json();

    if (body.action === 'grade' || body.questions) {
      const { questions, answers, skill } = body;
      let correct = 0;
      for (let i = 0; i < questions.length; i++) {
        if (answers[i] === questions[i].answerIndex) {
          correct++;
        }
      }
      const total = questions.length;
      const score = (correct / total) * 100;
      return NextResponse.json({ score, correct, total, feedback: `You got ${correct} out of ${total} correct.` });
    }

    const { skill, level } = body;
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3.6-flash',
        contents: `Generate 3 multiple choice questions for ${skill} at ${level} level. 
        Return strictly JSON as an array of objects: [{ "question": "string", "options": ["string", "string", "string", "string"], "answerIndex": number }]. Do not include any other text.`
      });
      
      let text = response.text || '';
      if (text.startsWith('```json')) {
        text = text.replace(/^```json\n/, '').replace(/\n```$/, '');
      } else if (text.startsWith('```')) {
        text = text.replace(/^```\n/, '').replace(/\n```$/, '');
      }
      
      const questions: AssessmentQuestion[] = JSON.parse(text);
      return NextResponse.json({ questions });
    } catch (e) {
      const lowerSkill = (skill || '').toLowerCase();
      const fallbacks = FALLBACK_QUESTIONS[lowerSkill] || FALLBACK_QUESTIONS.generic;
      return NextResponse.json({ questions: fallbacks });
    }
  } catch (error) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
