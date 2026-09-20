import { NextResponse } from 'next/server';
import { submitPeerRating } from '@/lib/cloudStore';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { raterId, rateeId, sessionId, stars, comment } = body;

    if (!raterId || !rateeId || !stars) {
      return NextResponse.json(
        { error: 'Missing required rating fields (raterId, rateeId, stars)' },
        { status: 400 }
      );
    }

    const numStars = Math.max(1, Math.min(5, Number(stars) || 5));
    const result = submitPeerRating({
      raterId: String(raterId),
      rateeId: String(rateeId),
      sessionId: sessionId ? String(sessionId) : 'session_default',
      stars: numStars,
      comment: comment ? String(comment) : 'Great collaborative study session!',
    });

    return NextResponse.json({
      success: true,
      rating: result.rating,
      updatedRatee: result.updatedRatee,
    });
  } catch (error: any) {
    console.error('Error in /api/rate-peer:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to submit peer rating' },
      { status: 500 }
    );
  }
}
