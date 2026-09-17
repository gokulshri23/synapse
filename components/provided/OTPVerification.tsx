'use client';

import React, { useState, useEffect, useRef } from 'react';

interface OTPVerificationProps {
  onVerified: () => void;
  email: string;
}

export default function OTPVerification({ onVerified, email }: OTPVerificationProps) {
  const [digits, setDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [countdown, setCountdown] = useState(30);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (countdown > 0) {
      timer = setTimeout(() => setCountdown(c => c - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [countdown]);

  const handleChange = (index: number, value: string) => {
    if (!/^[0-9]*$/.test(value)) return;
    
    const newDigits = [...digits];
    newDigits[index] = value.slice(-1);
    setDigits(newDigits);

    if (value && index < 5) {
      inputsRef.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputsRef.current[index - 1]?.focus();
    }
  };

  const handleVerify = () => {
    const code = digits.join('');
    if (code.length < 6) return;
    
    setIsVerifying(true);
    // Simulate delay
    setTimeout(() => {
      setIsVerifying(false);
      setIsSuccess(true);
      setTimeout(() => {
        onVerified();
      }, 1000);
    }, 1500);
  };

  return (
    <div className="w-full max-w-sm mx-auto bg-[var(--card)] p-8 rounded-[24px] shadow-lg flex flex-col items-center">
      <style>{`
        @keyframes orbit {
          0% { transform: rotate(var(--start-angle)) translateX(60px) rotate(calc(var(--start-angle) * -1)); }
          100% { transform: rotate(calc(var(--start-angle) + 360deg)) translateX(60px) rotate(calc((var(--start-angle) + 360deg) * -1)); }
        }
        @keyframes collapse {
          to { transform: scale(0); opacity: 0; }
        }
        @keyframes bounceCheck {
          0% { transform: scale(0); }
          50% { transform: scale(1.2); }
          100% { transform: scale(1); }
        }
        .orbiting {
          animation: orbit 3s linear infinite;
        }
        .collapsing {
          animation: collapse 0.4s ease-in forwards;
        }
        .check-bounce {
          animation: bounceCheck 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
        }
      `}</style>

      <div className="text-center mb-8">
        <h2 className="text-2xl font-serif text-[var(--ink)] mb-2">Verify your identity</h2>
        <p className="text-[var(--muted)] text-sm">We sent a code to <br/><span className="font-medium text-[var(--ink)]">{email}</span></p>
      </div>

      <div className="relative h-32 flex items-center justify-center w-full mb-6">
        {isVerifying ? (
          <>
            <div className="absolute inset-0 flex items-center justify-center">
              <svg className="w-8 h-8 text-[var(--amber)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
              </svg>
            </div>
            <div className="relative w-full h-full flex items-center justify-center">
              {digits.map((digit, index) => (
                <div
                  key={index}
                  className="absolute w-10 h-10 bg-[var(--card-alt)] border border-[var(--border)] rounded-[14px] flex items-center justify-center text-lg font-medium text-[var(--ink)] orbiting"
                  style={{ '--start-angle': `${index * 60}deg` } as React.CSSProperties}
                >
                  {digit}
                </div>
              ))}
            </div>
          </>
        ) : isSuccess ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <svg className="w-16 h-16 text-[var(--ok)] check-bounce" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
              <polyline points="22 4 12 14.01 9 11.01"></polyline>
            </svg>
          </div>
        ) : (
          <div className="flex gap-2 justify-center w-full">
            {digits.map((digit, index) => (
              <input
                key={index}
                ref={el => { inputsRef.current[index] = el; }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={e => handleChange(index, e.target.value)}
                onKeyDown={e => handleKeyDown(index, e)}
                className="w-12 h-12 text-center text-xl font-medium bg-[var(--card-alt)] border border-[var(--border)] rounded-[14px] outline-none focus:border-[var(--amber)] focus:ring-1 focus:ring-[var(--amber)] transition-all"
              />
            ))}
          </div>
        )}
      </div>

      {!isSuccess && !isVerifying && (
        <button
          onClick={handleVerify}
          disabled={digits.join('').length < 6}
          className={`w-full py-3 mb-4 rounded-[14px] font-medium transition-colors ${digits.join('').length === 6 ? 'bg-[var(--amber)] hover:bg-[var(--terracotta)] text-white' : 'bg-[var(--border)] text-[var(--muted)] cursor-not-allowed'}`}
        >
          Verify
        </button>
      )}

      {!isSuccess && !isVerifying && (
        <div className="text-sm text-center">
          {countdown > 0 ? (
            <span className="text-[var(--muted)]">Resend code in {countdown}s</span>
          ) : (
            <button onClick={() => setCountdown(30)} className="text-[var(--amber)] hover:text-[var(--terracotta)] font-medium">
              Resend code
            </button>
          )}
        </div>
      )}
    </div>
  );
}
