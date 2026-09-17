'use client';

import React, { useState, useEffect } from 'react';

interface DeleteButtonProps {
  onDelete: () => void;
  label?: string;
  size?: 'sm' | 'md';
  className?: string;
}

export default function DeleteButton({ onDelete, label = 'Delete', size = 'md', className = '' }: DeleteButtonProps) {
  const [step, setStep] = useState<0 | 1 | 2>(0);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (step === 1) {
      timer = setTimeout(() => setStep(0), 3000);
    }
    return () => clearTimeout(timer);
  }, [step]);

  const handleClick = () => {
    if (step === 0) {
      setStep(1);
    } else if (step === 1) {
      setStep(2);
      setTimeout(() => {
        onDelete();
      }, 400); // Wait for animation
    }
  };

  const sizeClasses = size === 'sm' ? 'px-2 py-1 text-xs' : 'px-4 py-2 text-sm';
  const iconSize = size === 'sm' ? 'w-4 h-4' : 'w-5 h-5';

  return (
    <button
      onClick={handleClick}
      className={`relative inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors overflow-hidden bg-transparent ${step === 0 ? 'text-[var(--muted)] hover:text-[var(--bad)] hover:bg-[var(--bad)]/5' : ''} ${step === 1 ? 'text-[var(--bad)] bg-[var(--bad)]/10 ring-1 ring-[var(--bad)]/20' : ''} ${step === 2 ? 'text-transparent bg-[var(--bad)]/20' : ''} ${sizeClasses} ${className}`}
      style={{ minWidth: step > 0 ? '100px' : 'auto' }}
    >
      <style>{`
        @keyframes slideInTrash {
          to { transform: translateX(20px) scaleX(0); opacity: 0; }
        }
        @keyframes openLid {
          to { transform: rotate(-30deg) translateY(-2px); }
        }
        @keyframes deleteShake {
          0%, 100% { transform: translateX(0) scale(1); opacity: 1; }
          20% { transform: translateX(-4px) scale(0.9); }
          40% { transform: translateX(4px) scale(0.7); }
          60% { transform: translateX(-4px) scale(0.5); }
          80% { transform: translateX(4px) scale(0.2); }
          100% { transform: translateX(0) scale(0); opacity: 0; }
        }
        .slide-trash {
          animation: slideInTrash 0.3s ease-in forwards;
        }
        .lid-open {
          animation: openLid 0.3s ease-out forwards;
          transform-origin: left bottom;
        }
        .do-delete {
          animation: deleteShake 0.4s ease-in forwards;
        }
      `}</style>

      <div className={`flex items-center justify-center relative ${step === 2 ? 'do-delete' : ''}`}>
        {/* Trash Icon */}
        <div className="relative">
          <svg className={`${iconSize}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path className={`${step === 1 ? 'lid-open' : ''}`} d="M3 6h18 M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0v14m4-14v14m4-14v14" />
          </svg>
        </div>
        
        {/* Label */}
        {step === 0 && (
          <span className="ml-1">{label}</span>
        )}
        
        {/* Animated label going into trash */}
        {step === 1 && (
          <span className="absolute left-6 whitespace-nowrap slide-trash pointer-events-none text-[var(--muted)]">
            {label}
          </span>
        )}

        {/* Confirm Text */}
        {step === 1 && (
          <span className="ml-2 animate-pulse whitespace-nowrap">
            Confirm?
          </span>
        )}
      </div>
    </button>
  );
}
