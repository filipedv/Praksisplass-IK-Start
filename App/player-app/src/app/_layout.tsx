// Root layout: wraps the whole app in the login session, and decides which
// screens exist depending on whether you're logged in.
//
// Stack.Protected (Expo Router) hides a group of screens unless `guard` is
// true — so logged-out users can only ever reach /login.
//
// It also keeps the match/training reminders on the phone up to date: every
// time the app opens or comes back to the front (see src/fixtures).

import { DarkTheme, SplashScreen, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { SessionProvider, useSession } from '@/auth/session-context';
import { syncFixtureReminders } from '@/fixtures/fixtures';
import { colors } from '@/lib/theme';

// Keep the splash screen up until we know whether there's a saved login.
SplashScreen.preventAutoHideAsync();

// React Navigation draws its own backgrounds (behind screens, during
// transitions). Its default theme is LIGHT, which shows up as white flashes in
// a dark app — so we give it our dark colours.
const navigationTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: colors.background,
    card: colors.surface,
    border: colors.border,
    primary: colors.primary,
    text: colors.text,
  },
};

export default function RootLayout() {
  return (
    <ThemeProvider value={navigationTheme}>
      <SessionProvider>
        {/* Light status-bar text, since the whole app is dark. */}
        <StatusBar style="light" />
        <RootNavigator />
      </SessionProvider>
    </ThemeProvider>
  );
}

/** Re-schedule the fixture reminders now, and whenever the app returns to the front. */
function useFixtureReminderSync(userId: string | undefined) {
  useEffect(() => {
    if (!userId) return;
    const sync = () => void syncFixtureReminders(userId).catch((e) => console.warn('Fixture reminder sync failed', e));
    sync();
    const subscription = AppState.addEventListener('change', (state) => state === 'active' && sync());
    return () => subscription.remove();
  }, [userId]);
}

function RootNavigator() {
  const { session, isLoading } = useSession();
  useFixtureReminderSync(session?.user.id);

  if (isLoading) return null; // splash screen still showing
  SplashScreen.hide();

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
      <Stack.Protected guard={!!session}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="meal/[id]" />
        <Stack.Screen name="water" />
        <Stack.Screen name="search" />
        <Stack.Screen name="settings" />
        <Stack.Screen name="password" />
        <Stack.Screen name="profile-settings" />
        <Stack.Screen name="privacy" />
      </Stack.Protected>

      <Stack.Protected guard={!session}>
        <Stack.Screen name="login" />
      </Stack.Protected>
    </Stack>
  );
}
