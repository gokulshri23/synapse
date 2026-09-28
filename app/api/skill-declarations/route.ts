import { NextRequest, NextResponse } from 'next/server';
import { 
  createSkillDeclaration, 
  updateSkillDeclaration, 
  getSkillDeclarations, 
  toggleSkillDeclaration,
  normalizeSkillId,
  getVerifiedLevel, 
  canRetakeQuiz 
} from '@/lib/cloudStore';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const userId = searchParams.get('userId');
  const intent = searchParams.get('intent') as 'teach' | 'learn' | null;

  if (!userId) {
    return NextResponse.json({ error: 'userId is required' }, { status: 400 });
  }

  try {
    const declarations = getSkillDeclarations(userId, intent || undefined);
    return NextResponse.json({ declarations });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch declarations' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    if (action === 'toggle') {
      const { userId, skill, intent } = body;
      if (!userId || !skill || !intent) {
        return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
      }

      const result = toggleSkillDeclaration(userId, skill, intent);
      return NextResponse.json({ success: true, ...result });
    }

    if (action === 'create') {
      const { userId, skill, intent } = body;
      if (!userId || !skill || !intent) {
        return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
      }
      
      const declaration = createSkillDeclaration(userId, skill, intent);
      return NextResponse.json({ declaration });
    }

    if (action === 'submit-quiz') {
      const { declarationId, quizScore, intent } = body;
      
      if (!declarationId || typeof quizScore !== 'number' || !intent) {
        return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
      }

      let status: 'pending' | 'verified' | 'rejected' = 'pending';
      let verified_level = 0;

      if (intent === 'teach') {
        if (quizScore >= 85) {
          status = 'verified';
          verified_level = 4;
        } else if (quizScore >= 60) {
          status = 'verified';
          verified_level = 3;
        } else {
          status = 'rejected';
          verified_level = 0;
        }
      } else if (intent === 'learn') {
        status = 'verified';
        if (quizScore <= 20) {
          verified_level = 0;
        } else if (quizScore < 50) {
          verified_level = 1;
        } else if (quizScore < 75) {
          verified_level = 2;
        } else {
          verified_level = 3;
        }
      }

      const updated = updateSkillDeclaration(declarationId, {
        status,
        verified_level,
        quiz_score: quizScore,
      });

      return NextResponse.json({ declaration: updated });
    }

    if (action === 'check-cooldown') {
      const { userId, skill } = body;
      if (!userId || !skill) {
        return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
      }

      const { allowed, hoursRemaining } = canRetakeQuiz(userId, skill);
      return NextResponse.json({ canRetake: allowed, hoursRemaining });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
