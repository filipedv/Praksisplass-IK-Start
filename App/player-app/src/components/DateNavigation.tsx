// Date navigation from the sketch (DateHeader + MonthCalendar):
//
//   ‹      Onsdag 14. oktober ⌄      ›
//
// The arrows move one day; › is hidden on today (no logging the future).
// Tapping the date opens a month calendar: Monday-first weeks, future days
// greyed out, selected day filled indigo, today in indigo text.

import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { addMonths, formatDayDate, formatMonthYear, isSameMonth, isToday, startOfDay, toISODate } from '@/lib/dates';
import { colors, font, spacing } from '@/lib/theme';

type HeaderProps = {
  selectedDate: Date;
  calendarOpen: boolean;
  onPrevDay: () => void;
  onNextDay: () => void;
  onToggleCalendar: () => void;
};

export function DateHeader({ selectedDate, calendarOpen, onPrevDay, onNextDay, onToggleCalendar }: HeaderProps) {
  const canGoNext = !isToday(selectedDate);
  return (
    <View style={styles.header}>
      <Pressable style={styles.arrow} onPress={onPrevDay} accessibilityLabel="Forrige dag">
        <Ionicons name="chevron-back" size={20} color={colors.iconSoft} />
      </Pressable>
      <Pressable style={styles.dateButton} onPress={onToggleCalendar} accessibilityLabel="Velg dato">
        <Text style={styles.dateText}>{formatDayDate(selectedDate)}</Text>
        <Ionicons name={calendarOpen ? 'chevron-up' : 'chevron-down'} size={14} color={colors.muted} />
      </Pressable>
      {/* Keep the space when hidden so the date stays centred. */}
      <Pressable
        style={[styles.arrow, !canGoNext && { opacity: 0 }]}
        onPress={onNextDay}
        disabled={!canGoNext}
        accessibilityLabel="Neste dag">
        <Ionicons name="chevron-forward" size={20} color={colors.iconSoft} />
      </Pressable>
    </View>
  );
}

type CalendarProps = {
  viewMonth: Date; // any date in the month being shown
  selectedDate: Date;
  onChangeMonth: (month: Date) => void;
  onSelectDate: (date: Date) => void;
};

const WEEKDAYS = ['Ma', 'Ti', 'On', 'To', 'Fr', 'Lø', 'Sø'];

export function MonthCalendar({ viewMonth, selectedDate, onChangeMonth, onSelectDate }: CalendarProps) {
  const today = startOfDay(new Date());
  const canGoNextMonth = !isSameMonth(viewMonth, today);

  // Build the grid: blank cells before the 1st (weeks start on Monday),
  // then every day, then blanks to fill the last week.
  const year = viewMonth.getFullYear();
  const month = viewMonth.getMonth();
  const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7; // JS: Sunday = 0 → Monday = 0
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);

  const selectedIso = toISODate(selectedDate);
  const todayIso = toISODate(today);

  return (
    <View style={styles.calendar}>
      <View style={styles.monthRow}>
        <Pressable style={styles.monthArrow} onPress={() => onChangeMonth(addMonths(viewMonth, -1))} accessibilityLabel="Forrige måned">
          <Ionicons name="chevron-back" size={18} color={colors.iconSoft} />
        </Pressable>
        <Text style={styles.monthText}>{formatMonthYear(viewMonth)}</Text>
        <Pressable
          style={[styles.monthArrow, !canGoNextMonth && { opacity: 0 }]}
          onPress={() => onChangeMonth(addMonths(viewMonth, 1))}
          disabled={!canGoNextMonth}
          accessibilityLabel="Neste måned">
          <Ionicons name="chevron-forward" size={18} color={colors.iconSoft} />
        </Pressable>
      </View>

      <View style={styles.grid}>
        {WEEKDAYS.map((w) => (
          <Text key={w} style={[styles.cell, styles.weekday]}>
            {w}
          </Text>
        ))}
        {cells.map((date, i) => {
          if (!date) return <View key={i} style={styles.cell} />;
          const iso = toISODate(date);
          const future = date > today;
          const selected = iso === selectedIso;
          const isTodayCell = iso === todayIso;
          return (
            <View key={i} style={styles.cell}>
              <Pressable
                disabled={future}
                onPress={() => onSelectDate(date)}
                style={[styles.day, selected && styles.daySelected]}
                accessibilityLabel={date.toLocaleDateString('nb-NO')}>
                <Text
                  style={[
                    styles.dayText,
                    future && styles.dayFuture,
                    isTodayCell && !selected && styles.dayToday,
                    selected && styles.dayTextSelected,
                  ]}>
                  {date.getDate()}
                </Text>
              </Pressable>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.sm, paddingTop: spacing.md, paddingBottom: spacing.sm },
  arrow: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  dateButton: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: spacing.sm, paddingVertical: 4 },
  dateText: { fontSize: font.sm, fontWeight: '600', color: colors.text },
  calendar: {
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderColor: colors.border,
    paddingBottom: spacing.sm,
  },
  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: 4 },
  monthArrow: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  monthText: { fontSize: font.sm, fontWeight: '600', color: colors.text },
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: spacing.md },
  cell: { width: `${100 / 7}%`, alignItems: 'center', paddingVertical: 2 },
  weekday: { fontSize: font.xs, color: colors.muted, textAlign: 'center', paddingVertical: 4 },
  day: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  daySelected: { backgroundColor: colors.primary },
  dayText: { fontSize: font.xs, color: colors.iconSoft },
  dayFuture: { color: colors.border }, // slate-700
  dayToday: { color: colors.primary, fontWeight: '600' },
  dayTextSelected: { color: '#fff', fontWeight: '600' },
});
