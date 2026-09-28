'use client';

import React, { useState } from 'react';
import WhyThisModal from './WhyThisModal';

export interface SessionSummaryCardProps {
  topic: string;
  partnerName: string;
  durationMinutes: number;
  beforeScore: number | null;
  afterScore: number | null;
  improvement: number | null;
  whatYouLearned?: string[];
  aiSummary?: string;
  nextRecommendation?: {
    action: string;
    reason_code?: string;
    reason_text?: string;
    decision_id?: string;
    kind?: string;
    evidence?: Record<string, any>;
    details?: Record<string, any>;
  };
  onClose?: () => void;
  onActionClick?: (action: string) => void;
}

export default function SessionSummaryCard({
  topic,
  partnerName,
  durationMinutes,
  beforeScore,
  afterScore,
  improvement,
  whatYouLearned = [],
  aiSummary,
  nextRecommendation,
  onClose,
  onActionClick,
}: SessionSummaryCardProps) {
  const [showWhyModal, setShowWhyModal] = useState(false);

  const getActionLabel = (action?: string) => {
    switch (action) {
      case 'daily_mission':
        return 'Launch 10-Minute Daily Mission';
      case 'revision_node':
        return 'Review Prerequisite Basics';
      case 'targeted_practice':
        return 'Start 3-Question Practice Drill';
      case 'ai_explanation':
        return 'Read AI Interactive Breakdown';
      case 'peer_rematch':
        return 'Find Compatible Alternative Peer';
      case 'joint_concept_and_video':
        return 'Watch Curated Educational Tutorial';
      case 'network_gap_retry':
        return 'Join Campus Study Group';
      default:
        return 'Continue Learning Path';
    }
  };

  return (
    <div className="bg-card border border-border rounded-[22px] p-6 shadow-xl space-y-5 animate-scale-in text-ink max-w-2xl w-full">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-border">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-amber">
              Session Concluded
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-card-alt border border-border text-muted font-medium">
              {durationMinutes} min session
            </span>
          </div>
          <h2 className="text-xl font-serif font-bold text-ink mt-0.5">
            {topic} with {partnerName}
          </h2>
        </div>

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-card-alt border border-border flex items-center justify-center text-xs text-muted hover:text-ink cursor-pointer transition-colors"
          >
            ✕
          </button>
        )}
      </div>

      {/* 3 Metric Score Tiles: Strict real DB numbers rule, "—" if skipped */}
      <div className="grid grid-cols-3 gap-3 text-center">
        {/* Pre-quiz score */}
        <div className="p-3 bg-card-alt rounded-2xl border border-border">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted block mb-1">
            Pre-Quiz
          </span>
          <div className="text-2xl font-serif font-bold text-ink">
            {beforeScore !== null ? `${beforeScore}%` : '—'}
          </div>
          <span className="text-[10px] text-muted">
            {beforeScore !== null ? 'Baseline score' : 'Quiz skipped'}
          </span>
        </div>

        {/* Post-quiz score */}
        <div className="p-3 bg-card-alt rounded-2xl border border-border">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted block mb-1">
            Post-Quiz
          </span>
          <div className="text-2xl font-serif font-bold text-ink">
            {afterScore !== null ? `${afterScore}%` : '—'}
          </div>
          <span className="text-[10px] text-muted">
            {afterScore !== null ? 'Exit mastery' : 'Quiz skipped'}
          </span>
        </div>

        {/* Improvement */}
        <div className="p-3 bg-card-alt rounded-2xl border border-border">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted block mb-1">
            Improvement
          </span>
          <div
            className={`text-2xl font-serif font-bold ${
              improvement === null
                ? 'text-muted'
                : improvement > 0
                ? 'text-ok'
                : improvement < 0
                ? 'text-bad'
                : 'text-ink'
            }`}
          >
            {improvement !== null
              ? `${improvement >= 0 ? '+' : ''}${improvement} pts`
              : '—'}
          </div>
          <span className="text-[10px] text-muted">
            {improvement !== null ? 'Net delta' : 'Both quizzes required'}
          </span>
        </div>
      </div>

      {/* AI Summary / Context */}
      {aiSummary && (
        <div className="p-3.5 bg-card-alt/70 border border-border rounded-xl text-xs text-muted leading-relaxed">
          {aiSummary}
        </div>
      )}

      {/* What You Learned Bullets */}
      {whatYouLearned && whatYouLearned.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted">
            What You Covered
          </h3>
          <ul className="space-y-1.5">
            {whatYouLearned.map((item, idx) => (
              <li key={idx} className="flex items-start gap-2 text-xs text-ink">
                <span className="text-ok font-bold">✓</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Next Recommendation from Section 3 Adaptive Engine with [Why this?] link */}
      {nextRecommendation && (
        <div className="p-4 bg-amber/10 border border-amber/25 rounded-2xl space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber">
              Autonomous Next Step
            </span>
            <button
              type="button"
              onClick={() => setShowWhyModal(true)}
              className="text-xs font-bold text-amber hover:text-terracotta underline flex items-center gap-1 cursor-pointer transition-colors"
            >
              <span>[Why this?]</span>
            </button>
          </div>

          <div>
            <h4 className="font-semibold text-sm text-ink mb-1">
              {getActionLabel(nextRecommendation.action)}
            </h4>
            <p className="text-xs text-muted leading-relaxed">
              {nextRecommendation.reason_text ||
                'Personalized next step generated by the adaptive engine to maximize mastery retention.'}
            </p>
          </div>

          {onActionClick && (
            <button
              type="button"
              onClick={() => onActionClick(nextRecommendation.action)}
              className="w-full py-2.5 px-4 bg-amber hover:bg-terracotta text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              Start Recommended Action →
            </button>
          )}
        </div>
      )}

      {/* Why This Modal */}
      {showWhyModal && (
        <WhyThisModal
          isOpen={showWhyModal}
          onClose={() => setShowWhyModal(false)}
          decisionId={nextRecommendation?.decision_id}
          directDecision={nextRecommendation}
        />
      )}
    </div>
  );
}
