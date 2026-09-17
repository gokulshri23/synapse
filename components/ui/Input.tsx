"use client";

import React, { forwardRef } from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement | HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
  textarea?: boolean;
}

const Input = forwardRef<HTMLInputElement | HTMLTextAreaElement, InputProps>(
  ({ label, error, hint, textarea, className = '', ...props }, ref) => {
    const inputClasses = [
      'w-full bg-card-alt border border-border rounded-[14px] text-ink p-2.5 transition-colors focus:outline-none focus:border-amber focus:ring-1 focus:ring-amber',
      error ? 'border-bad focus:border-bad focus:ring-bad' : '',
      className
    ].filter(Boolean).join(' ');

    return (
      <div className="w-full flex flex-col gap-1.5">
        {label && <label className="text-sm font-medium text-ink">{label}</label>}
        {textarea ? (
          <textarea
            ref={ref as React.Ref<HTMLTextAreaElement>}
            className={inputClasses}
            {...(props as React.TextareaHTMLAttributes<HTMLTextAreaElement>)}
          />
        ) : (
          <input
            ref={ref as React.Ref<HTMLInputElement>}
            className={inputClasses}
            {...(props as React.InputHTMLAttributes<HTMLInputElement>)}
          />
        )}
        {error && <span className="text-sm text-bad">{error}</span>}
        {hint && !error && <span className="text-sm text-muted">{hint}</span>}
      </div>
    );
  }
);

Input.displayName = 'Input';

export default Input;
