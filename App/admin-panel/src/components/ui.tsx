// Small shared building blocks, styled after the coach dashboard sketch.
// Styles live in index.css; these components only add structure.

import { CircleCheck, CircleDashed, CircleAlert, CircleMinus } from 'lucide-react';
import type { CSSProperties, ReactNode } from 'react';

import { STATUS_COLORS, STATUS_LABELS, type Status } from '../lib/status';

/** Page title + subtitle on the left, actions on the right. */
export function PageHeader({ title, subtitle, actions }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="page-header">
      <div>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {actions && <div className="row">{actions}</div>}
    </div>
  );
}

/** Stat tile: label · value · optional sub line (see the dataviz "stat tile" contract). */
export function StatTile({ label, value, unit, sub }: { label: string; value: ReactNode; unit?: string; sub?: ReactNode }) {
  return (
    <div className="card">
      <div className="stat-label">{label}</div>
      <div className="stat-value">
        {value}
        {unit && <small>{unit}</small>}
      </div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  );
}

// One icon per status, so the meaning never depends on colour alone.
const STATUS_ICONS: Record<Status, typeof CircleCheck> = {
  gray: CircleMinus,
  red: CircleAlert,
  orange: CircleDashed,
  green: CircleCheck,
};

export function StatusIcon({ status, size = 14 }: { status: Status; size?: number }) {
  const Icon = STATUS_ICONS[status];
  return <Icon size={size} color={STATUS_COLORS[status]} aria-hidden />;
}

/** Icon + text label for a status (text stays in ink colour). */
export function StatusLabel({ status, text }: { status: Status; text?: string }) {
  return (
    <span className="pill">
      <StatusIcon status={status} />
      {text ?? STATUS_LABELS[status]}
    </span>
  );
}

/** Value vs goal as a thin bar. Fill is capped at 100 %; the text shows the real value. */
export function Meter({
  label,
  value,
  goal,
  unit,
  color,
}: {
  label?: string;
  value: number;
  goal: number;
  unit: string;
  color: string;
}) {
  const pct = goal > 0 ? Math.min(100, Math.round((value / goal) * 100)) : 0;
  return (
    <div className="meter" title={`${Math.round(value)} av ${goal} ${unit} (${pct} %)`}>
      <div className="meter-top">
        {label ? <span>{label}</span> : <span />}
        <strong>
          {Math.round(value).toLocaleString('nb-NO')} / {goal.toLocaleString('nb-NO')} {unit}
        </strong>
      </div>
      <div className="meter-track" role="meter" aria-valuenow={value} aria-valuemin={0} aria-valuemax={goal}>
        <div className="meter-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

// Light avatar tones from the sketch (emerald / blue / amber / violet).
const AVATAR_TONES: CSSProperties[] = [
  { background: '#d1fae5', color: '#047857' },
  { background: '#dbeafe', color: '#1d4ed8' },
  { background: '#fef3c7', color: '#b45309' },
  { background: '#ede9fe', color: '#6d28d9' },
];

/** Round avatar with initials. The tone is picked from the id so it never changes. */
export function Avatar({ name, id, large }: { name: string; id: string; large?: boolean }) {
  const initials =
    name
      .split(/[\s._-]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('') || '?';
  const tone = AVATAR_TONES[[...id].reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % AVATAR_TONES.length];
  return (
    <span className={`avatar ${large ? 'lg' : ''}`} style={tone} aria-hidden>
      {initials}
    </span>
  );
}

/** A row of mutually exclusive buttons, e.g. "7 dager | 30 dager". */
export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  label,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  label: string; // for screen readers
}) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          className={o.value === value ? 'active' : ''}
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
