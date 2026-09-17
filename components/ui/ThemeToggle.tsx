'use client';

import React, { useEffect, useState } from 'react';

export default function ThemeToggle({ className = '' }: { className?: string }) {
  const [isDark, setIsDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Check localStorage or document class
    const savedTheme = localStorage.getItem('synapse_theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const shouldBeDark = savedTheme === 'dark' || (!savedTheme && prefersDark);

    if (shouldBeDark) {
      document.documentElement.classList.add('dark');
      setIsDark(true);
    } else {
      document.documentElement.classList.remove('dark');
      setIsDark(false);
    }
  }, []);

  const toggleTheme = () => {
    const nextDark = !isDark;
    setIsDark(nextDark);
    if (nextDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('synapse_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('synapse_theme', 'light');
    }
  };

  if (!mounted) {
    return (
      <div className={`w-9 h-9 rounded-xl bg-card-alt border border-border ${className}`} />
    );
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
      title={isDark ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
      className={`relative w-9 h-9 rounded-xl bg-card-alt border border-border hover:border-amber flex items-center justify-center text-ink transition-all active:scale-95 cursor-pointer shadow-xs ${className}`}
    >
      {isDark ? (
        <span className="text-base select-none animate-scale-in" role="img" aria-label="Moon">
          🌙
        </span>
      ) : (
        <span className="text-base select-none animate-scale-in text-amber" role="img" aria-label="Sun">
          ☀️
        </span>
      )}
    </button>
  );
}
