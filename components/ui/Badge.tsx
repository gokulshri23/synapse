import React from 'react';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'amber' | 'ok' | 'bad' | 'muted' | 'outline';
  className?: string;
}

export default function Badge({ children, variant = 'amber', className = '' }: BadgeProps) {
  const variants = {
    amber: 'bg-amber/10 text-amber',
    ok: 'bg-ok/10 text-emerald-600',
    bad: 'bg-bad/10 text-bad',
    muted: 'bg-card-alt text-muted',
    outline: 'border border-border text-ink bg-transparent'
  };

  const classes = [
    'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
    variants[variant],
    className
  ].filter(Boolean).join(' ');

  return (
    <span className={classes}>
      {children}
    </span>
  );
}
