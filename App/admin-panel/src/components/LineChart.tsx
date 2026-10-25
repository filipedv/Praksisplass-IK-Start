// A small SVG line chart for values measured on irregular dates (weight,
// height). Hand-built like ColumnChart, following the dataviz rules:
//   - one series, one colour, so no legend box (the card title names it)
//   - x is real time (a gap of three weeks looks like three weeks)
//   - y is zoomed to the data (a weight line from 0 kg would be flat), with
//     round tick values and recessive hairline gridlines
//   - 2 px line, 8 px markers with a 2 px surface ring, the latest value
//     labelled directly
//   - hover/keyboard tooltip per point, with a hit area larger than the dot
// The same numbers are in the measurement history list (table view).

import { useEffect, useRef, useState } from 'react';
import { locale, t } from '../lib/i18n';

export type LinePoint = { key: string; date: string; value: number; title: string };

type Props = {
  data: LinePoint[]; // oldest first
  unit: string;
  color: string;
  decimals?: number;
  height?: number;
  ariaLabel: string;
};

const PAD = { top: 18, right: 56, bottom: 24, left: 44 };
const DAY = 86_400_000;

function niceStep(range: number, targetTicks = 4) {
  const raw = range / targetTicks;
  const magnitude = 10 ** Math.floor(Math.log10(raw || 1));
  return ([1, 2, 2.5, 5, 10].find((s) => s * magnitude >= raw) ?? 10) * magnitude;
}

const time = (iso: string) => new Date(`${iso}T12:00`).getTime();
const shortDate = (iso: string) => new Date(`${iso}T12:00`).toLocaleDateString(locale(), { day: 'numeric', month: 'short' });

export function LineChart({ data, unit, color, decimals = 1, height = 180, ariaLabel }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(500);
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(240, entry.contentRect.width)));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const [hover, setHover] = useState<number | null>(null);

  if (data.length === 0) {
    return (
      <div ref={wrapRef} className="chart-empty muted small">
        {t('Ingen målinger ennå.', 'No measurements yet.')}
      </div>
    );
  }

  const fmt = (v: number) => v.toLocaleString(locale(), { maximumFractionDigits: decimals });
  const plotW = width - PAD.left - PAD.right;
  const plotH = height - PAD.top - PAD.bottom;

  // y: zoom to the data with a little room, on round ticks (at least a 4-unit span).
  const values = data.map((d) => d.value);
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const span = Math.max(hi - lo, 4);
  const step = niceStep(span * 1.2);
  const yMin = Math.floor((lo - span * 0.1) / step) * step;
  const yMax = Math.ceil((hi + span * 0.1) / step) * step;
  const ticks = Array.from({ length: Math.round((yMax - yMin) / step) + 1 }, (_, i) => yMin + i * step);
  const y = (v: number) => PAD.top + plotH - ((v - yMin) / (yMax - yMin)) * plotH;

  // x: real time. A single point sits in the middle.
  const t0 = time(data[0].date);
  const t1 = Math.max(time(data[data.length - 1].date), t0 + DAY);
  const x = (iso: string) => (data.length === 1 ? PAD.left + plotW / 2 : PAD.left + ((time(iso) - t0) / (t1 - t0)) * plotW);

  const path = data.map((d, i) => `${i === 0 ? 'M' : 'L'}${x(d.date).toFixed(1)},${y(d.value).toFixed(1)}`).join(' ');
  const last = data[data.length - 1];
  const hovered = hover !== null ? data[hover] : null;

  return (
    <div ref={wrapRef} className="chart">
      <svg width={width} height={height} role="img" aria-label={ariaLabel}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={width - PAD.right} y1={y(t)} y2={y(t)} stroke="var(--grid)" />
            <text x={PAD.left - 8} y={y(t)} dy="0.32em" textAnchor="end">
              {fmt(t)}
            </text>
          </g>
        ))}

        {/* x labels: first and last date (more would crowd irregular dates) */}
        <text x={x(data[0].date)} y={height - 6} textAnchor={data.length === 1 ? 'middle' : 'start'}>
          {shortDate(data[0].date)}
        </text>
        {data.length > 1 && (
          <text x={x(last.date)} y={height - 6} textAnchor="end">
            {shortDate(last.date)}
          </text>
        )}

        <path d={path} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

        {data.map((d, i) => (
          <g key={d.key}>
            <circle
              cx={x(d.date)}
              cy={y(d.value)}
              r={hover === i ? 5 : 4}
              fill={color}
              stroke="var(--card)"
              strokeWidth={2}
            />
            {/* Bigger invisible hit area, focusable for keyboard users */}
            <circle
              className="bar-hit"
              cx={x(d.date)}
              cy={y(d.value)}
              r={12}
              tabIndex={0}
              aria-label={`${d.title}: ${fmt(d.value)} ${unit}`}
              onPointerEnter={() => setHover(i)}
              onPointerLeave={() => setHover(null)}
              onFocus={() => setHover(i)}
              onBlur={() => setHover(null)}
            />
          </g>
        ))}

        {/* Direct label on the latest value */}
        <text className="goal-label" x={x(last.date) + 10} y={y(last.value)} dy="0.32em">
          {fmt(last.value)} {unit}
        </text>
      </svg>

      {hovered && (
        <div className="tooltip" style={{ left: x(hovered.date), top: y(hovered.value) }}>
          <span className="muted">{hovered.title}</span>
          <strong>
            {fmt(hovered.value)} {unit}
          </strong>
        </div>
      )}
    </div>
  );
}
