// "When should this reminder go out?" — used for templates and for custom
// reminders on a fixture. Either minutes before the start / after the end,
// or a clock time the day before / the same day.

import { t } from '../lib/i18n';
import type { Anchor, Timing } from '../lib/fixtures-api';

export function TimingInput({ value, onChange }: { value: Timing; onChange: (timing: Timing) => void }) {
  const usesClock = value.anchor === 'day_before' || value.anchor === 'same_day';

  function changeAnchor(anchor: Anchor) {
    const clock = anchor === 'day_before' || anchor === 'same_day';
    onChange(
      clock
        ? { anchor, offset_minutes: null, at_time: value.at_time ?? (anchor === 'day_before' ? '19:00' : '09:00') }
        : { anchor, offset_minutes: value.offset_minutes ?? 60, at_time: null },
    );
  }

  return (
    <div className="row" style={{ gap: 8, flexWrap: 'nowrap' }}>
      <select value={value.anchor} onChange={(e) => changeAnchor(e.target.value as Anchor)} aria-label={t('Når', 'When')}>
        <option value="day_before">{t('Dagen før, kl.', 'The day before, at')}</option>
        <option value="same_day">{t('Samme dag, kl.', 'Same day, at')}</option>
        <option value="before_start">{t('Minutter før start', 'Minutes before start')}</option>
        <option value="after_end">{t('Minutter etter slutt', 'Minutes after the end')}</option>
      </select>
      {usesClock ? (
        <input
          type="time"
          value={value.at_time ?? ''}
          onChange={(e) => onChange({ ...value, at_time: e.target.value || null })}
          aria-label={t('Klokkeslett', 'Time of day')}
          style={{ width: 110 }}
        />
      ) : (
        <input
          type="number"
          min={0}
          max={2880}
          step={15}
          value={value.offset_minutes ?? 0}
          onChange={(e) => onChange({ ...value, offset_minutes: Math.max(0, Math.min(2880, Number(e.target.value) || 0)) })}
          aria-label={t('Minutter', 'Minutes')}
          style={{ width: 90 }}
        />
      )}
    </div>
  );
}
