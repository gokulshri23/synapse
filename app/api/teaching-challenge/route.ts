import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { updateSkillDeclaration } from '@/lib/cloudStore';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
const model = 'gemini-2.0-flash';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { action } = body;

        if (action === 'generate') {
            const { skill, subtopic } = body;
            const topic = subtopic || skill;
            const prompt = `Generate a teaching challenge prompt for the topic: ${topic}. The challenge should ask the user: 'Explain ${topic} to a complete beginner in under 200 words. Use simple language, at least one analogy, and one concrete example.' Return only the prompt string.`;

            const response = await ai.models.generateContent({ model, contents: prompt });
            return NextResponse.json({ challengePrompt: response.text });
        } else if (action === 'evaluate') {
            const { declarationId, skill, explanation, subtopic } = body;
            const topic = subtopic || skill;
            
            const prompt = `Evaluate the following explanation of ${topic} based on these criteria (assign a 0-100 score for each):
- Accuracy: Is the content factually correct?
- Clarity: Is it clear and well-structured?
- Beginner-friendliness: Would a complete beginner understand this? (Did they use simple language, an analogy, and a concrete example?)

Explanation provided by the user:
"""
${explanation}
"""

Return ONLY a valid JSON object with the keys "accuracy", "clarity", "beginnerFriendliness" (all numbers), and "feedback" (string detailing what was good and what could be improved).`;

            const response = await ai.models.generateContent({ model, contents: prompt });
            let accuracy = 0, clarity = 0, beginnerFriendliness = 0, feedback = "Could not parse evaluation.";
            
            try {
                let text = response.text || "{}";
                text = text.replace(/```json\s*/, '').replace(/```\s*/, '').trim();
                const data = JSON.parse(text);
                accuracy = typeof data.accuracy === 'number' ? data.accuracy : 50;
                clarity = typeof data.clarity === 'number' ? data.clarity : 50;
                beginnerFriendliness = typeof data.beginnerFriendliness === 'number' ? data.beginnerFriendliness : 50;
                feedback = typeof data.feedback === 'string' ? data.feedback : "Evaluated successfully.";
            } catch (e) {
                console.error("Failed to parse Gemini output", e);
                // Sensible fallback scores
                accuracy = 50;
                clarity = 50;
                beginnerFriendliness = 50;
                feedback = "Failed to parse AI evaluation. Provided fallback scores.";
            }

            const average = (accuracy + clarity + beginnerFriendliness) / 3;
            let status: 'verified' | 'rejected' = 'rejected';
            let verified_level = 0;
            let passed = false;

            if (average >= 85) {
                status = 'verified';
                verified_level = 4;
                passed = true;
            } else if (average >= 60) {
                status = 'verified';
                verified_level = 3;
                passed = true;
            } else {
                status = 'rejected';
                verified_level = 0;
                passed = false;
            }

            if (declarationId) {
                updateSkillDeclaration(declarationId, {
                    status,
                    verified_level,
                    evidence_url: explanation,
                    quiz_score: average
                });
            }

            return NextResponse.json({
                result: {
                    accuracy,
                    clarity,
                    beginnerFriendliness,
                    average,
                    feedback,
                    passed,
                    assignedLevel: verified_level
                }
            });
        }
        
        return NextResponse.json({ error: 'Invalid action specified' }, { status: 400 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
