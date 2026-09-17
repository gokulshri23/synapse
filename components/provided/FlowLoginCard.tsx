'use client';

import React, { useState, useRef, FormEvent } from 'react';
import Link from 'next/link';

interface FlowLoginCardProps {
  onSubmit: (data: { email: string; password: string; fullName?: string; isSignUp: boolean }) => Promise<{ success: boolean; error?: string }>;
  onGoogleLogin?: () => void;
  onDemoLogin?: () => void;
  defaultMode?: 'login' | 'signup';
}

export default function FlowLoginCard({
  onSubmit,
  onGoogleLogin,
  onDemoLogin,
  defaultMode = 'login',
}: FlowLoginCardProps) {
  const [mode, setMode] = useState<'login' | 'signup'>(defaultMode);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const isSignUp = mode === 'signup';

  const passwordsMatch = !isSignUp || (password.length > 0 && password === confirmPassword);
  const passwordsMismatch = isSignUp && confirmPassword.length > 0 && password !== confirmPassword;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!email.trim() || !password) {
      setErrorMessage('Please fill in all required fields.');
      return;
    }

    if (isSignUp) {
      if (!fullName.trim()) {
        setErrorMessage('Please enter your full name.');
        return;
      }
      if (password.length < 6) {
        setErrorMessage('Password must be at least 6 characters long.');
        return;
      }
      if (password !== confirmPassword) {
        setErrorMessage('Passwords do not match. Please verify your confirm password.');
        return;
      }
    }

    setIsSubmitting(true);

    try {
      const result = await onSubmit({
        email: email.trim(),
        password,
        fullName: isSignUp ? fullName.trim() : undefined,
        isSignUp,
      });

      if (!result.success) {
        setIsSubmitting(false);
        setErrorMessage(result.error || 'Authentication failed. Please try again.');
        return;
      }

      // Only animate melt on CONFIRMED success
      if (cardRef.current) {
        const anim = cardRef.current.animate(
          [
            { transform: 'scale(1)', filter: 'blur(0px)', opacity: 1 },
            { transform: 'scale(1.02)', filter: 'blur(0px)', opacity: 1, offset: 0.25 },
            { transform: 'translateY(32px) scale(0.96)', filter: 'blur(4px)', opacity: 0 }
          ],
          {
            duration: 500,
            easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
            fill: 'forwards',
          }
        );
        await anim.finished;
      }
    } catch (err: any) {
      setIsSubmitting(false);
      setErrorMessage(err?.message || 'An unexpected error occurred. You can use Quick Demo mode.');
    }
  };

  return (
    <div
      ref={cardRef}
      className="relative w-full max-w-[460px] bg-[var(--card)] rounded-[24px] border border-[var(--border)] shadow-xl p-7 sm:p-9 overflow-hidden isolation-auto transition-all"
    >
      <style>{`
        @keyframes floatBlob1 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(25px, -20px) scale(1.12); }
        }
        @keyframes floatBlob2 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(-20px, 25px) scale(0.92); }
        }
        @keyframes shakeError {
          0%, 100% { transform: translateX(0); }
          20%, 60% { transform: translateX(-5px); }
          40%, 80% { transform: translateX(5px); }
        }
        .anim-shake { animation: shakeError 0.35s ease-in-out; }
      `}</style>

      {/* Organic Warm Metaball Ambient Glow */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none opacity-40">
        <div
          className="absolute -top-16 -left-12 w-52 h-52 rounded-full bg-[var(--amber)] filter blur-[50px]"
          style={{ animation: 'floatBlob1 9s ease-in-out infinite' }}
        />
        <div
          className="absolute -bottom-20 -right-16 w-64 h-64 rounded-full bg-[var(--terracotta)] filter blur-[60px]"
          style={{ animation: 'floatBlob2 11s ease-in-out infinite' }}
        />
      </div>

      <div className="relative z-10 flex flex-col gap-5">
        {/* Mode Selector Tabs */}
        <div className="flex bg-[var(--card-alt)] p-1 rounded-[16px] border border-[var(--border)]">
          <button
            type="button"
            onClick={() => { setMode('login'); setErrorMessage(null); }}
            className={`flex-1 py-2.5 text-sm font-semibold rounded-[12px] transition-all ${
              !isSignUp
                ? 'bg-[var(--card)] text-[var(--ink)] shadow-sm border border-[var(--border)]'
                : 'text-[var(--muted)] hover:text-[var(--ink)]'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => { setMode('signup'); setErrorMessage(null); }}
            className={`flex-1 py-2.5 text-sm font-semibold rounded-[12px] transition-all ${
              isSignUp
                ? 'bg-[var(--card)] text-[var(--ink)] shadow-sm border border-[var(--border)]'
                : 'text-[var(--muted)] hover:text-[var(--ink)]'
            }`}
          >
            Create Account
          </button>
        </div>

        {/* Heading */}
        <div className="text-center">
          <h2 className="text-2xl sm:text-3xl font-serif font-bold text-[var(--ink)] tracking-tight">
            {isSignUp ? 'Create your account' : 'Welcome back'}
          </h2>
          <p className="text-[var(--muted)] text-sm mt-1">
            {isSignUp
              ? 'Join peers in collaborative skill mastery'
              : 'Enter your credentials to continue learning'}
          </p>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="anim-shake p-3.5 rounded-[14px] bg-[var(--bad)]/10 border border-[var(--bad)]/25 text-[var(--bad)] text-sm flex items-start gap-2.5">
            <span className="text-base leading-none mt-0.5">⚠️</span>
            <div className="flex-1 leading-snug">{errorMessage}</div>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Full Name (Sign Up only) */}
          {isSignUp && (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)] ml-1">
                Full Name
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required={isSignUp}
                placeholder="Alex Morgan"
                className="w-full px-4 py-3 bg-[var(--card-alt)] border border-[var(--border)] rounded-[14px] text-[var(--ink)] placeholder-[var(--muted)]/50 text-sm outline-none focus:border-[var(--amber)] focus:ring-2 focus:ring-[var(--amber)]/20 transition-all"
              />
            </div>
          )}

          {/* Email */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)] ml-1">
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="alex@example.com"
              className="w-full px-4 py-3 bg-[var(--card-alt)] border border-[var(--border)] rounded-[14px] text-[var(--ink)] placeholder-[var(--muted)]/50 text-sm outline-none focus:border-[var(--amber)] focus:ring-2 focus:ring-[var(--amber)]/20 transition-all"
            />
          </div>

          {/* Password */}
          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between items-center ml-1">
              <label className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
                {isSignUp ? 'New Password' : 'Password'}
              </label>
              {!isSignUp && (
                <Link
                  href="/forgot-password"
                  className="text-xs font-medium text-[var(--amber)] hover:text-[var(--terracotta)] transition-colors"
                >
                  Forgot password?
                </Link>
              )}
            </div>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                placeholder={isSignUp ? 'Min. 6 characters' : '••••••••'}
                className="w-full px-4 py-3 pr-11 bg-[var(--card-alt)] border border-[var(--border)] rounded-[14px] text-[var(--ink)] placeholder-[var(--muted)]/50 text-sm outline-none focus:border-[var(--amber)] focus:ring-2 focus:ring-[var(--amber)]/20 transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted)] hover:text-[var(--ink)] p-1 text-xs"
              >
                {showPassword ? '🙈' : '👁️'}
              </button>
            </div>
          </div>

          {/* Confirm Password (Sign Up only) */}
          {isSignUp && (
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between items-center ml-1">
                <label className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
                  Confirm Password
                </label>
                {passwordsMismatch && (
                  <span className="text-[11px] font-medium text-[var(--bad)]">
                    Passwords do not match
                  </span>
                )}
                {confirmPassword && passwordsMatch && (
                  <span className="text-[11px] font-medium text-[var(--ok)]">
                    ✓ Matches
                  </span>
                )}
              </div>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required={isSignUp}
                  minLength={6}
                  placeholder="Re-enter your password"
                  className={`w-full px-4 py-3 pr-11 bg-[var(--card-alt)] border rounded-[14px] text-[var(--ink)] placeholder-[var(--muted)]/50 text-sm outline-none transition-all ${
                    passwordsMismatch
                      ? 'border-[var(--bad)] focus:ring-2 focus:ring-[var(--bad)]/20'
                      : 'border-[var(--border)] focus:border-[var(--amber)] focus:ring-2 focus:ring-[var(--amber)]/20'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  tabIndex={-1}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted)] hover:text-[var(--ink)] p-1 text-xs"
                >
                  {showConfirmPassword ? '🙈' : '👁️'}
                </button>
              </div>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full mt-2 py-3.5 px-4 bg-[var(--amber)] hover:bg-[var(--terracotta)] text-white font-semibold rounded-[14px] shadow-sm hover:shadow transition-all active:scale-[0.99] disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer"
          >
            {isSubmitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                <span>{isSignUp ? 'Creating account...' : 'Signing in...'}</span>
              </>
            ) : (
              <span>{isSignUp ? 'Create Account' : 'Sign In'}</span>
            )}
          </button>
        </form>

        {/* Quick Demo Access Button */}
        {onDemoLogin && (
          <div className="pt-1">
            <button
              type="button"
              onClick={onDemoLogin}
              className="w-full py-2.5 px-4 bg-[var(--amber)]/10 hover:bg-[var(--amber)]/20 text-[var(--terracotta)] border border-[var(--amber)]/30 rounded-[14px] text-xs font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>⚡</span>
              <span>Explore as Demo Learner (Instant Access)</span>
            </button>
          </div>
        )}

        {/* Divider */}
        <div className="relative flex items-center my-1">
          <div className="flex-grow border-t border-[var(--border)]" />
          <span className="flex-shrink-0 mx-3 text-[var(--muted)] text-xs uppercase tracking-wider">
            or continue with
          </span>
          <div className="flex-grow border-t border-[var(--border)]" />
        </div>

        {/* Google OAuth Button */}
        <button
          onClick={onGoogleLogin}
          type="button"
          className="w-full py-3 px-4 flex items-center justify-center gap-3 bg-[var(--card)] border border-[var(--border)] hover:bg-[var(--card-alt)] text-[var(--ink)] font-medium text-sm rounded-[14px] shadow-xs hover:border-[var(--border-dashed)] transition-all cursor-pointer"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
          Continue with Google
        </button>
      </div>
    </div>
  );
}
