// Root layout: wraps the whole app in the login session, and decides which
// screens exist depending on whether you're logged in.
//
// Stack.Protected (Expo Router) hides a group of screens unless `guard` is
// true — so logged-out users can only ever reach /login.

import { DarkTheme, SplashScreen, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { SessionProvider, useSession } from '@/auth/session-context';
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

function RootNavigator() {
  const { session, isLoading } = useSession();

  if (isLoading) return null; // splash screen still showing
  SplashScreen.hide();

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
      <Stack.Protected guard={!!session}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="meal/[id]" />
        <Stack.Screen name="water" />
        <Stack.Screen name="privacy" />
      </Stack.Protected>

      <Stack.Protected guard={!session}>
        <Stack.Screen name="login" />
      </Stack.Protected>
    </Stack>
  );
}
