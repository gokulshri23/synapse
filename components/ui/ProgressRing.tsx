import React from 'react';

interface ProgressRingProps {
  percentage: number;
  size?: number;
  strokeWidth?: number;
  label?: string;
  color?: string;
}

export default function ProgressRing({
  percentage,
  size = 60,
  strokeWidth = 6,
  label,
  color = 'var(--amber)'
}: ProgressRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <div className="relative inline-flex flex-col items-center justify-center">
      <div style={{ width: size, height: size }} className="relative">
        <svg className="transform -rotate-90 w-full h-full">
          <circle
            className="text-border"
            strokeWidth={strokeWidth}
            stroke="currentColor"
            fill="transparent"
            r={radius}
            cx={size / 2}
            cy={size / 2}
          />
          <circle
            style={{ stroke: color }}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            fill="transparent"
            r={radius}
            cx={size / 2}
            cy={size / 2}
            className="transition-all duration-1000 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-sm font-semibold text-ink">{Math.round(percentage)}%</span>
        </div>
      </div>
      {label && <span className="mt-2 text-sm font-medium text-muted">{label}</span>}
    </div>
  );
}
