// A row of small squares, one per day, coloured by goal status. Always paired
// with a legend (icon + label + count), so colour never carries meaning alone.
// Each square has a tooltip/aria-label with the date and status in words.

import { STATUS_COLORS, STATUS_LABELS, STATUS_ORDER, type Status } from '../lib/status';
import { StatusIcon } from './ui';
import { t } from '../lib/i18n';

export type StripDay = { key: string; title: string; status: Status | null }; // null = future / in progress

type Props = {
  days: StripDay[];
  small?: boolean;
  selectedKey?: string;
  onSelect?: (key: string) => void;
  showLegend?: boolean;
};

export function StatusStrip({ days, small, selectedKey, onSelect, showLegend }: Props) {
  const counts: Record<Status, number> = { gray: 0, red: 0, orange: 0, green: 0 };
  for (const d of days) if (d.status) counts[d.status] += 1;

  return (
    <div className="stack" style={{ gap: 10 }}>
      <div className="strip" role="list">
        {days.map((d) => {
          const label = `${d.title}: ${d.status ? STATUS_LABELS[d.status] : t('pågår', 'in progress')}`;
          return (
            <button
              key={d.key}
              type="button"
              role="listitem"
              className={`strip-cell ${small ? 'small' : ''} ${selectedKey === d.key ? 'selected' : ''}`}
              style={{
                // An unfinished day (today) is drawn as an outline only.
                background: d.status ? STATUS_COLORS[d.status] : 'transparent',
                boxShadow: d.status ? undefined : 'inset 0 0 0 1px var(--baseline)',
                cursor: onSelect ? 'pointer' : 'default',
              }}
              title={label}
              aria-label={label}
              onClick={() => onSelect?.(d.key)}
            />
          );
        })}
      </div>

      {showLegend && (
        <div className="legend">
          {STATUS_ORDER.map((s) => (
            <span key={s} className="legend-item">
              <StatusIcon status={s} />
              <strong>{counts[s]}</strong> {STATUS_LABELS[s]}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
