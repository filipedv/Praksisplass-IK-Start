// Bottom tabs, matching the sketch: icon-only, slate-900 bar, indigo when active.
//
// The ORDER here is the order in the tab bar: Dagsoversikt / Kamera / Profil.
// Which tab opens first is decided by the file names instead: `index.tsx`
// (Kamera) is the start route, so the app is camera-first like the sketch.

import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';

import { colors } from '@/lib/theme';
import { useI18n } from '@/lib/i18n';

export default function TabLayout() {
  const { t } = useI18n();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.faint,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        // A short cross-fade when switching tabs, instead of a hard cut.
        animation: 'fade',
        // Dark behind every tab, so nothing light shows during the fade.
        sceneStyle: { backgroundColor: colors.background },
      }}>
      <Tabs.Screen
        name="today"
        options={{
          title: t('Dagsoversikt', 'Daily overview'), // read out by screen readers
          tabBarIcon: ({ color }) => <Ionicons name="restaurant-outline" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="index"
        options={{
          title: t('Kamera', 'Camera'),
          tabBarIcon: ({ color }) => <Ionicons name="camera-outline" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t('Profil', 'Profile'),
          tabBarIcon: ({ color }) => <Ionicons name="person-outline" size={22} color={color} />,
        }}
      />
    </Tabs>
  );
}
