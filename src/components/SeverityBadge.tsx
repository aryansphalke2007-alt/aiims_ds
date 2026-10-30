import React from 'react';
import { SeverityLevel } from '../types';

interface SeverityBadgeProps {
  severity: SeverityLevel;
  showDescription?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export const severityConfig: Record<
  SeverityLevel,
  { label: string; name: string; color: string; bg: string; border: string; desc: string }
> = {
  1: {
    label: 'ESI 1',
    name: 'Resuscitation',
    color: 'text-rose-700',
    bg: 'bg-rose-50',
    border: 'border-rose-200',
    desc: 'Immediate life-saving intervention required',
  },
  2: {
    label: 'ESI 2',
    name: 'Emergent',
    color: 'text-amber-700',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    desc: 'High risk, severe pain, or altered mental status',
  },
  3: {
    label: 'ESI 3',
    name: 'Urgent',
    color: 'text-yellow-800',
    bg: 'bg-yellow-50',
    border: 'border-yellow-200',
    desc: 'Multiple clinical resources required, stable vitals',
  },
  4: {
    label: 'ESI 4',
    name: 'Less Urgent',
    color: 'text-emerald-700',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    desc: 'One resource required (e.g. X-ray, simple suture)',
  },
  5: {
    label: 'ESI 5',
    name: 'Non-Urgent',
    color: 'text-sky-700',
    bg: 'bg-sky-50',
    border: 'border-sky-200',
    desc: 'No diagnostic resources needed, medication refill',
  },
};

export const SeverityBadge: React.FC<SeverityBadgeProps> = ({
  severity,
  showDescription = false,
  size = 'md',
}) => {
  const config = severityConfig[severity] || severityConfig[5];

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-xs font-semibold px-2.5 py-1',
    lg: 'text-sm font-semibold px-3 py-1.5',
  }[size];

  return (
    <div className="inline-flex items-center gap-1.5">
      <span
        className={`inline-flex items-center gap-1 rounded border font-mono tracking-wide ${config.bg} ${config.color} ${config.border} ${sizeClasses}`}
      >
        <span>{config.label}</span>
        <span className="font-normal opacity-80">·</span>
        <span>{config.name}</span>
      </span>
      {showDescription && (
        <span className="text-xs text-slate-500 hidden sm:inline">{config.desc}</span>
      )}
    </div>
  );
};
