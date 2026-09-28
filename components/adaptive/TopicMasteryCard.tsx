'use client';

import React, { useState, useEffect } from 'react';
import { TopicMastery } from '@/lib/types';
import WhyThisModal from './WhyThisModal';

interface TopicMasteryCardProps {
  userId: string;
  skill: string;
  onLaunchImprovement?: (action: string, topic: string) => void;
}

export default function TopicMasteryCard({
  userId,
  skill,
  onLaunchImprovement,
}: TopicMasteryCardProps) {
  const [topics, setTopics] = useState<TopicMastery[]>([]);
  const [loading, setLoading] = useState(true);
  const [evaluatingTopic, setEvaluatingTopic] = useState<string | null>(null);
  const [recommendation, setRecommendation] = useState<any | null>(null);
  const [whyDecision, setWhyDecision] = useState<any | null>(null);

  const fetchTopics = async () => {
    try {
      setLoading(true);
      const res = await fetch(
        `/api/topic-mastery?userId=${encodeURIComponent(userId)}&skill=${encodeURIComponent(skill)}`
      );
      if (res.ok) {
        const data = await res.json();
        setTopics(data.topics || []);
      }
    } catch (e) {
      console.error('Failed to load topic mastery:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (userId && skill) {
      fetchTopics();
    }
  }, [userId, skill]);

  const handleImproveTopic = async (topic: TopicMastery) => {
    setEvaluatingTopic(topic.topic);
    const scoreVal = topic.mastery_pct ?? topic.mastery ?? 0;
    try {
      const res = await fetch('/api/adaptive-engine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'evaluate',
          userId,
          skill,
          topic: topic.topic,
          score: scoreVal,
          weakSubtopics: [topic.topic],
        }),
      });

      const data = await res.json();
      if (data.success && data.decision) {
        setRecommendation({
          topic: topic.topic,
          action: data.action,
          decision: data.decision,
        });
      }
    } catch (e) {
      console.error('Adaptive engine evaluation failed:', e);
    } finally {
      setEvaluatingTopic(null);
    }
  };

  const getStatusBadge = (topic: TopicMastery) => {
    const answeredCount = topic.questions_answered ?? topic.answered ?? 0;
    const masteryVal = topic.mastery_pct ?? topic.mastery ?? 0;

    if (answeredCount < 3) {
      return (
        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-card-alt text-muted border border-border">
          Not enough data yet
        </span>
      );
    }

    if (masteryVal < 50) {
      return (
        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-bad/10 text-bad border border-bad/20">
          Weak ({masteryVal}%)
        </span>
      );
    }

    if (masteryVal < 70) {
      return (
        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber/10 text-amber border border-amber/20">
          Developing ({masteryVal}%)
        </span>
      );
    }

    return (
      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-ok/10 text-ok border border-ok/20">
        Strong ({masteryVal}%)
      </span>
    );
  };

  return (
    <div className="bg-card border border-border rounded-[22px] p-6 shadow-xs space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-border">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm">📊</span>
            <h3 className="font-serif font-bold text-base text-ink">
              Topic-Level Mastery Breakdown
            </h3>
          </div>
          <p className="text-xs text-muted mt-0.5">
            Strict empirical mastery calculated from proctored quizzes &amp; peer problem sessions.
          </p>
        </div>

        <button
          type="button"
          onClick={fetchTopics}
          className="text-xs text-muted hover:text-ink font-medium px-2.5 py-1 rounded-lg bg-card-alt border border-border transition-colors cursor-pointer"
        >
          ↻ Refresh
        </button>
      </div>

      {/* Active Adaptive Recommendation Notice */}
      {recommendation && (
        <div className="p-4 bg-amber/10 border border-amber/25 rounded-2xl space-y-2 animate-fade-in">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="text-sm">🎯</span>
              <span className="text-xs font-bold text-ink">
                Adaptive Recommendation for {recommendation.topic}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setWhyDecision(recommendation.decision)}
              className="text-xs font-bold text-amber hover:text-terracotta underline cursor-pointer"
            >
              [Why this?]
            </button>
          </div>
          <p className="text-xs text-muted">
            {recommendation.decision.reason_text}
          </p>
          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={() => {
                if (onLaunchImprovement) {
                  onLaunchImprovement(recommendation.action, recommendation.topic);
                }
                setRecommendation(null);
              }}
              className="px-3 py-1.5 bg-amber hover:bg-terracotta text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              Start Practice ({recommendation.action.replace('_', ' ')}) →
            </button>
            <button
              type="button"
              onClick={() => setRecommendation(null)}
              className="px-3 py-1.5 text-xs text-muted hover:text-ink cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="py-8 text-center text-xs text-muted">
          <div className="w-5 h-5 border-2 border-amber border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          Loading topic mastery records...
        </div>
      ) : topics.length === 0 ? (
        <div className="p-4 text-center text-xs text-muted bg-card-alt rounded-xl border border-dashed border-border">
          No topic data yet for {skill}. Take a quiz or start a session to establish your baseline.
        </div>
      ) : (
        <div className="space-y-3">
          {topics.map((item) => {
            const answeredCount = item.questions_answered ?? item.answered ?? 0;
            const masteryVal = item.mastery_pct ?? item.mastery ?? 0;
            const hasEnoughData = answeredCount >= 3;
            const isWeak = hasEnoughData && masteryVal < 50;

            return (
              <div
                key={item.id || item.topic}
                className="p-3.5 bg-card-alt rounded-2xl border border-border space-y-2 hover:border-amber/30 transition-all"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-xs text-ink">{item.topic}</span>
                    <span className="text-[10px] text-muted">
                      ({answeredCount} question{answeredCount === 1 ? '' : 's'})
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {getStatusBadge(item)}

                    {isWeak && (
                      <button
                        type="button"
                        onClick={() => handleImproveTopic(item)}
                        disabled={evaluatingTopic === item.topic}
                        className="px-2.5 py-1 bg-amber hover:bg-terracotta disabled:opacity-50 text-white font-bold text-[11px] rounded-lg shadow-xs transition-colors cursor-pointer flex items-center gap-1"
                      >
                        {evaluatingTopic === item.topic ? (
                          <>
                            <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            <span>Evaluating...</span>
                          </>
                        ) : (
                          <>
                            <span>⚡</span>
                            <span>Improve this</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>

                {/* Mastery Bar */}
                <div className="flex items-center gap-3">
                  <div className="h-2 flex-1 bg-border rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${
                        !hasEnoughData
                          ? 'bg-muted/40'
                          : masteryVal >= 70
                          ? 'bg-ok'
                          : masteryVal >= 50
                          ? 'bg-amber'
                          : 'bg-bad'
                      }`}
                      style={{
                        width: hasEnoughData ? `${Math.max(5, masteryVal)}%` : '15%',
                      }}
                    />
                  </div>
                  <span className="text-xs font-mono font-bold text-ink shrink-0">
                    {hasEnoughData ? `${masteryVal}%` : '—'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Why This Modal for Topic Recommendation */}
      {whyDecision && (
        <WhyThisModal
          isOpen={!!whyDecision}
          onClose={() => setWhyDecision(null)}
          directDecision={whyDecision}
        />
      )}
    </div>
  );
}
