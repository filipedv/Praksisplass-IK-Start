// A date/time field that works on both platforms:
//   - iOS: the system's compact picker (tap to open), right in the row
//   - Android: a button that opens the system dialog
// `mode="time"` for reminders, `mode="datetime"` for "when did you eat this?".

import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text } from 'react-native';

import { colors, font, radius, spacing } from '@/lib/theme';
import { useI18n } from '@/lib/i18n';

type Props = {
  value: Date;
  onChange: (date: Date) => void;
  mode: 'time' | 'datetime';
  maximumDate?: Date; // e.g. "now" — you can't eat in the future
  accessibilityLabel: string;
};

export function DateTimeField({ value, onChange, mode, maximumDate, accessibilityLabel }: Props) {
  const { locale } = useI18n();
  // Android opens date and time as two separate dialogs.
  const [androidStep, setAndroidStep] = useState<'closed' | 'date' | 'time'>('closed');

  if (Platform.OS === 'ios') {
    return (
      <DateTimePicker
        value={value}
        mode={mode}
        display="compact"
        maximumDate={maximumDate}
        locale={locale}
        themeVariant="dark"
        accessibilityLabel={accessibilityLabel}
        onChange={(_e: DateTimePickerEvent, date?: Date) => date && onChange(date)}
      />
    );
  }

  const text =
    mode === 'time'
      ? value.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
      : value.toLocaleString(locale, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

  return (
    <>
      <Pressable
        style={styles.button}
        onPress={() => setAndroidStep(mode === 'time' ? 'time' : 'date')}
        accessibilityLabel={accessibilityLabel}
        hitSlop={8}>
        <Text style={styles.text}>{text}</Text>
      </Pressable>
      {androidStep !== 'closed' && (
        <DateTimePicker
          value={value}
          mode={androidStep}
          maximumDate={maximumDate}
          onChange={(event: DateTimePickerEvent, date?: Date) => {
            if (event.type !== 'set' || !date) return setAndroidStep('closed');
            if (androidStep === 'date' && mode === 'datetime') {
              // Keep the time, take the new date, then ask for the time.
              const next = new Date(value);
              next.setFullYear(date.getFullYear(), date.getMonth(), date.getDate());
              onChange(next);
              setAndroidStep('time');
            } else {
              onChange(date);
              setAndroidStep('closed');
            }
          }}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  button: { backgroundColor: colors.surfaceRaised, borderRadius: radius.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, minHeight: 36, justifyContent: 'center' },
  text: { color: colors.text, fontSize: font.sm, fontWeight: '500' },
});
