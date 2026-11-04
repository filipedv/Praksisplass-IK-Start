// A small SVG column chart: one value per day, plus an optional goal line.
// Hand-built (no chart library) and following the dataviz rules:
//   - one series, one colour, so no legend box (the card title names it)
//   - columns at most 24 px wide, 4 px rounded top, square at the baseline,
//     2 px gap between neighbours
//   - hairline solid gridlines at round tick values; the goal is a solid
//     reference line with a direct label ("Mål 2 800")
//   - hover/keyboard tooltip per column; the hit area is the whole day slot,
//     not just the painted bar
//   - while new data loads, the old chart stays, dimmed (no flash)
// Every value here is also in the day table below the charts (table view).

import { useEffect, useRef, useState } from 'react';
import { locale, t } from '../lib/i18n';

export type ColumnDatum = {
  key: string; // e.g. "2026-10-14"
  label: string; // short x-axis label, e.g. "14."
  title: string; // tooltip heading, e.g. "Tirsdag 14. oktober"
  value: number;
};

type Props = {
  data: ColumnDatum[];
  unit: string;
  color: string; // CSS colour (a series variable)
  goal?: number;
  height?: number;
  loading?: boolean;
  selectedKey?: string;
  onSelect?: (key: string) => void;
  ariaLabel: string;
};

const PAD = { top: 18, right: 8, bottom: 24, left: 48 };
const MAX_BAR = 24;
const GAP = 2;
const RADIUS = 4;

/** A "nice" step (1, 2, 2.5 or 5 × 10ⁿ) so ticks land on round numbers. */
function niceStep(max: number, targetTicks = 4) {
  const raw = max / targetTicks;
  const magnitude = 10 ** Math.floor(Math.log10(raw || 1));
  const steps = [1, 2, 2.5, 5, 10];
  return (steps.find((s) => s * magnitude >= raw) ?? 10) * magnitude;
}

/** Path for a column with rounded TOP corners only (square on the baseline). */
function columnPath(x: number, y: number, w: number, h: number) {
  const r = Math.min(RADIUS, w / 2, h);
  return `M${x},${y + h} V${y + r} Q${x},${y} ${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y + h} Z`;
}

export function ColumnChart({ data, unit, color, goal, height = 190, loading, selectedKey, onSelect, ariaLabel }: Props) {
  // Measure our own width so the SVG is drawn at real pixel size (crisp text).
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(600);
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(240, entry.contentRect.width)));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const [hover, setHover] = useState<number | null>(null);

  const plotW = width - PAD.left - PAD.right;
  const plotH = height - PAD.top - PAD.bottom;
  const maxValue = Math.max(goal ?? 0, ...data.map((d) => d.value), 1);
  const step = niceStep(maxValue * 1.05);
  const yMax = Math.ceil((maxValue * 1.05) / step) * step;
  const ticks = Array.from({ length: Math.round(yMax / step) + 1 }, (_, i) => i * step);
  const y = (v: number) => PAD.top + plotH - (v / yMax) * plotH;

  const slot = plotW / Math.max(data.length, 1);
  const barW = Math.max(2, Math.min(MAX_BAR, slot - GAP));
  // Show at most one x label per ~44 px so they never collide.
  const labelEvery = Math.max(1, Math.ceil(data.length / Math.max(1, Math.floor(plotW / 44))));

  const hovered = hover !== null ? data[hover] : null;
  const fmt = (v: number) => Math.round(v).toLocaleString(locale());

  return (
    <div ref={wrapRef} className={`chart ${loading ? 'loading' : ''}`}>
      <svg width={width} height={height} role="img" aria-label={ariaLabel}>
        {/* Gridlines + y ticks (recessive) */}
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={width - PAD.right} y1={y(t)} y2={y(t)} stroke={t === 0 ? 'var(--baseline)' : 'var(--grid)'} />
            <text x={PAD.left - 8} y={y(t)} dy="0.32em" textAnchor="end">
              {fmt(t)}
            </text>
          </g>
        ))}

        {/* Columns */}
        {data.map((d, i) => {
          const cx = PAD.left + slot * i + slot / 2;
          const h = Math.max(0, PAD.top + plotH - y(d.value));
          const dim = hover !== null && hover !== i;
          return (
            <g key={d.key}>
              {h > 0 && (
                <path
                  className="bar"
                  d={columnPath(cx - barW / 2, y(d.value), barW, h)}
                  fill={color}
                  opacity={dim ? 0.45 : selectedKey && selectedKey !== d.key ? 0.7 : 1}
                />
              )}
              {i % labelEvery === 0 && (
                <text x={cx} y={height - 6} textAnchor="middle">
                  {d.label}
                </text>
              )}
              {/* Invisible hit area: the whole slot, focusable for keyboard users */}
              <rect
                className="bar-hit"
                x={PAD.left + slot * i}
                y={PAD.top}
                width={slot}
                height={plotH}
                tabIndex={0}
                aria-label={`${d.title}: ${fmt(d.value)} ${unit}`}
                onPointerEnter={() => setHover(i)}
                onPointerLeave={() => setHover(null)}
                onFocus={() => setHover(i)}
                onBlur={() => setHover(null)}
                onClick={() => onSelect?.(d.key)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') onSelect?.(d.key);
                }}
              />
            </g>
          );
        })}

        {/* Goal: solid reference line + direct label (drawn last, on top) */}
        {goal !== undefined && goal > 0 && (
          <g pointerEvents="none">
            <line x1={PAD.left} x2={width - PAD.right} y1={y(goal)} y2={y(goal)} stroke="var(--text-2)" strokeWidth={1} />
            <text className="goal-label" x={width - PAD.right} y={y(goal) - 6} textAnchor="end">
              {t('Mål', 'Goal')} {fmt(goal)} {unit}
            </text>
          </g>
        )}
      </svg>

      {hovered && hover !== null && (
        <div
          className="tooltip"
          style={{ left: PAD.left + slot * hover + slot / 2, top: y(hovered.value) }}>
          <span className="muted">{hovered.title}</span>
          <strong>
            {fmt(hovered.value)} {unit}
          </strong>
          {goal ? <span className="muted">{t(`${Math.round((hovered.value / goal) * 100)} % av målet`, `${Math.round((hovered.value / goal) * 100)}% of goal`)}</span> : null}
        </div>
      )}
    </div>
  );
}
