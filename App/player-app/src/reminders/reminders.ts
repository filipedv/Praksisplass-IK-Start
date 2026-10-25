// Daily reminders ("Har du logget lunsj?"), from the sketch's "Varsler" setting.
//
// Everything happens ON THE PHONE: the settings are stored locally and the
// reminders are local scheduled notifications (they work in Expo Go — only
// server-sent push notifications need a custom build). Nothing is sent to
// our database.
//
// Note: a local reminder can't check whether you already logged that meal;
// it simply fires at the chosen time every day.
//
// Each scheduled notification has an id with a prefix ("meal-…" here,
// "fixture-…" for match/training reminders in src/fixtures), so one kind can
// be replaced without wiping the other.

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { translate, type Language } from '@/lib/i18n';

export type MealKey = 'frokost' | 'lunsj' | 'middag';

export type ReminderSettings = {
  enabled: boolean;
  meals: Record<MealKey, { on: boolean; hour: number; minute: number }>;
};

const MEAL_WORDS: Record<MealKey, [nb: string, en: string]> = {
  frokost: ['Frokost', 'Breakfast'],
  lunsj: ['Lunsj', 'Lunch'],
  middag: ['Middag', 'Dinner'],
};

/** "Frokost" / "Breakfast" … */
export const mealLabel = (key: MealKey, lang: Language) => MEAL_WORDS[key][lang === 'en' ? 1 : 0];

const DEFAULTS: ReminderSettings = {
  enabled: false,
  meals: {
    frokost: { on: true, hour: 8, minute: 30 },
    lunsj: { on: true, hour: 12, minute: 30 },
    middag: { on: true, hour: 18, minute: 30 },
  },
};

const STORAGE_KEY = 'reminder-settings';
const CHANNEL_ID = 'meal-reminders'; // one Android channel for all our reminders
const ID_PREFIX = 'meal-';

// Show reminders as banners even when the app is open.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/** Saved settings, or the defaults (reminders off). Uses the phone's local storage. */
export function loadReminderSettings(): ReminderSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...DEFAULTS, ...(JSON.parse(raw) as ReminderSettings) } : DEFAULTS;
  } catch {
    return DEFAULTS;
  }
}

/** Android needs a notification channel; returns its id (undefined on iOS). */
export async function ensureAndroidChannel(): Promise<string | undefined> {
  if (Platform.OS !== 'android') return undefined;
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: translate('Påminnelser', 'Reminders'),
    importance: Notifications.AndroidImportance.DEFAULT,
  });
  return CHANNEL_ID;
}

/** Remove our scheduled notifications whose id starts with `prefix`. */
export async function cancelScheduled(prefix: string) {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  for (const n of scheduled) {
    if (n.identifier.startsWith(prefix)) await Notifications.cancelScheduledNotificationAsync(n.identifier);
  }
}

/** Ask for permission to show notifications. Returns false if the user says no. */
export async function requestReminderPermission(): Promise<boolean> {
  // Android needs a channel before the permission prompt can appear.
  await ensureAndroidChannel();
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const asked = await Notifications.requestPermissionsAsync({ ios: { allowAlert: true, allowSound: true } });
  return asked.granted;
}

/**
 * Save the settings and (re)schedule the reminders to match: we cancel all of
 * this app's scheduled reminders and add one daily reminder per meal that's on.
 * The text is fixed when scheduled, so this is called again when the language
 * changes (Innstillinger).
 */
export async function saveReminderSettings(settings: ReminderSettings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // storage unavailable: the reminders below still get scheduled
  }
  await cancelScheduled(ID_PREFIX); // only the meal reminders
  if (!settings.enabled) return;

  for (const key of Object.keys(settings.meals) as MealKey[]) {
    const meal = settings.meals[key];
    if (!meal.on) continue;
    await Notifications.scheduleNotificationAsync({
      identifier: `${ID_PREFIX}${key}`,
      content: {
        title: translate(
          `Har du logget ${mealLabel(key, 'nb').toLowerCase()}?`,
          `Have you logged ${mealLabel(key, 'en').toLowerCase()}?`,
        ),
        body: translate('Ta et bilde av måltidet — det tar bare noen sekunder.', 'Take a photo of your meal — it only takes a few seconds.'),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: meal.hour,
        minute: meal.minute,
        channelId: CHANNEL_ID,
      },
    });
  }
}

/** On sign-out: no reminders for a logged-out phone. */
export async function cancelAllReminders() {
  await Notifications.cancelAllScheduledNotificationsAsync();
}
