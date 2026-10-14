// KAMERA — the start screen after login (camera-first, as in the sketch).
// This file is `index` so it's what the app opens on; the tab bar order is
// set separately in (tabs)/_layout.tsx.
//
// THE CORE FLOW: photo → recognize → confirm/edit → save. Phases follow the
// sketch's KameraTab:
//   'camera'      → live camera
//   'recognizing' → "Analyserer" while the recognizer + Matvaretabellen matching run
//   'review'      → "Registrert mat": editable list of foods + "Lagre måltid"
//   'saved'       → "Lagret" check mark for a moment, then on to Dagsoversikt
//
// PRIVACY: the photo is deleted from the phone as soon as recognition is
// done, and is never uploaded to our database. Only the resulting food-log
// entry (foods, grams, nutrition, time) is saved.

import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Attribution } from '@/components/Attribution';
import { CameraCapture } from '@/components/CameraCapture';
import { DraftItemRow, type DraftItem } from '@/components/DraftItemRow';
import { FoodSearchModal } from '@/components/FoodSearchModal';
import { ScreenHeader } from '@/components/ScreenHeader';
import { toISODate } from '@/lib/dates';
import { colors, font, radius, spacing } from '@/lib/theme';
import { saveMeal } from '@/meals/meals-api';
import { logRecognitionEvent, matchGuesses } from '@/nutrition/foods-api';
import { defaultAmountGrams } from '@/nutrition/math';
import type { Food } from '@/nutrition/types';
import { activeRecognizer, recognizeFood } from '@/recognition';
import { deleteLocalFile } from '@/recognition/compress-image';

type Phase = 'camera' | 'recognizing' | 'review' | 'saved';

/** How long the "Lagret" check mark shows before switching to Dagsoversikt (sketch: 900 ms). */
const SAVED_PAUSE_MS = 900;

// Simple unique keys for list items that don't have a database id yet.
let keyCounter = 0;
const newKey = () => `item-${++keyCounter}`;

export default function KameraScreen() {
  const [phase, setPhase] = useState<Phase>('camera');
  const [items, setItems] = useState<DraftItem[]>([]);
  const [usedRecognizer, setUsedRecognizer] = useState(false);
  const [saving, setSaving] = useState(false);

  // Search sheet: `searchFor` is the key of the item being swapped, or 'new'
  // to add a new item. null = closed.
  const [searchFor, setSearchFor] = useState<string | 'new' | null>(null);

  // ---------- 1. Recognize + match a photo ----------
  async function recognize(photoUri: string) {
    setPhase('recognizing');
    try {
      const guesses = await recognizeFood({ uri: photoUri });
      const matches = await matchGuesses(guesses);
      logRecognitionEvent(activeRecognizer.id, matches); // fire-and-forget

      setItems(
        matches.map((m) => ({
          key: newKey(),
          food: m.food,
          amountG: m.food ? defaultAmountGrams(m.food) : 100,
          detectedLabel: m.guess.label,
          storableId: m.guess.storableId,
          confidence: m.guess.confidence,
        })),
      );
      setUsedRecognizer(true);
      setPhase('review');
    } catch (e) {
      console.warn('Recognition failed', e);
      Alert.alert('Noe gikk galt', 'Klarte ikke å gjenkjenne maten. Du kan legge til matvarer manuelt.');
      startManual();
    } finally {
      // Privacy by design: throw the photo away whatever happened.
      deleteLocalFile(photoUri);
    }
  }

  function startManual() {
    setItems([]);
    setUsedRecognizer(false);
    setPhase('review');
  }

  // ---------- 2. Edit the list ----------
  function updateItem(key: string, changes: Partial<DraftItem>) {
    setItems((prev) => prev.map((it) => (it.key === key ? { ...it, ...changes } : it)));
  }

  function removeItem(key: string) {
    setItems((prev) => prev.filter((it) => it.key !== key));
  }

  function handleFoodPicked(food: Food) {
    if (searchFor === 'new') {
      setItems((prev) => [
        ...prev,
        // detectedLabel null = "Lagt til manuelt"
        { key: newKey(), food, amountG: defaultAmountGrams(food), detectedLabel: null, storableId: null, confidence: null },
      ]);
    } else if (searchFor) {
      // Swapping keeps the recognizer's label (useful for judging match
      // quality) but the confidence no longer applies to the new food.
      updateItem(searchFor, { food, amountG: defaultAmountGrams(food), confidence: null });
    }
    setSearchFor(null);
  }

  // "Lagre? → Nei" in the sketch: discard and go back to the camera.
  function backToCamera() {
    setItems([]);
    setPhase('camera');
  }

  // ---------- 3. Save ----------
  const allMatched = items.every((it) => it.food !== null);
  const allAmountsValid = items.every((it) => it.amountG > 0);
  const canSave = items.length > 0 && allMatched && allAmountsValid && !saving;

  async function handleSave() {
    setSaving(true);
    try {
      await saveMeal(
        items.map((it) => ({ food_id: it.food!.id, amount_g: it.amountG, detected_label: it.storableId })),
        usedRecognizer ? activeRecognizer.id : null,
      );
      setPhase('saved');
      setTimeout(() => {
        // Switch tab FIRST, then reset this screen once it's out of view —
        // resetting first would flash the camera back on just before leaving.
        // Show TODAY in Dagsoversikt, even if it was left on an older day.
        router.navigate({ pathname: '/today', params: { date: toISODate(new Date()) } });
        setTimeout(backToCamera, 400);
      }, SAVED_PAUSE_MS);
    } catch (e) {
      console.warn('Save failed', e);
      Alert.alert('Kunne ikke lagre', 'Sjekk nettforbindelsen og prøv igjen.');
    } finally {
      setSaving(false);
    }
  }

  // The text the search box starts with when swapping an item.
  const swapping = items.find((it) => it.key === searchFor);
  const initialQuery = swapping ? (swapping.detectedLabel ?? swapping.food?.name_nb ?? '') : '';

  // ---------- Render ----------
  // Each phase is wrapped in <PhaseFade>, so switching between them is a
  // short cross-fade instead of a hard cut.
  if (phase === 'camera') {
    return (
      <PhaseFade>
        <CameraCapture onPhoto={recognize} onManual={startManual} />
      </PhaseFade>
    );
  }

  if (phase === 'recognizing') {
    return (
      <PhaseFade>
        <SafeAreaView style={styles.container} edges={['top']}>
          <ScreenHeader title="Analyserer" />
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.centeredText}>Kjenner igjen maten på bildet…</Text>
          </View>
        </SafeAreaView>
      </PhaseFade>
    );
  }

  if (phase === 'saved') {
    return (
      <PhaseFade>
        <SafeAreaView style={styles.container} edges={['top']}>
          <ScreenHeader title="Lagret" />
          <View style={styles.centered}>
            <View style={styles.savedCircle}>
              <Ionicons name="checkmark" size={24} color={colors.pill.green.text} />
            </View>
            <Text style={styles.centeredText}>Data sendes til database…</Text>
          </View>
        </SafeAreaView>
      </PhaseFade>
    );
  }

  return (
    <PhaseFade>
      <SafeAreaView style={styles.container} edges={['top']}>
        <ScreenHeader title="Registrert mat" onBack={backToCamera} />

        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Text style={styles.intro}>
            {usedRecognizer
              ? 'Dette fant vi i bildet. Juster mengde eller fjern varer ved behov.'
              : 'Legg til det du har spist.'}
          </Text>

          {/* The mock ignores the photo — say so, or testers think recognition is broken. */}
          {usedRecognizer && activeRecognizer.id === 'mock' && (
            <View style={styles.mockBanner}>
              <Text style={styles.mockBannerText}>
                Testmodus: dette er eksempelmatvarer, ikke gjenkjent fra bildet ditt.
              </Text>
            </View>
          )}

          {items.map((item) => (
            <DraftItemRow
              key={item.key}
              item={item}
              onChangeAmount={(grams) => updateItem(item.key, { amountG: grams })}
              onPickFood={() => setSearchFor(item.key)}
              onRemove={() => removeItem(item.key)}
            />
          ))}

          {items.length === 0 && <Text style={styles.noItems}>Ingen varer igjen — legg til mat under.</Text>}

          <Pressable style={styles.addButton} onPress={() => setSearchFor('new')}>
            <Ionicons name="add" size={14} color={colors.primary} />
            <Text style={styles.addButtonText}>Legg til mat som ikke ble oppdaget</Text>
          </Pressable>

          {!allMatched && <Text style={styles.hint}>Velg eller fjern matvarene som ikke ble funnet før du lagrer.</Text>}

          <Attribution recognizer={usedRecognizer ? activeRecognizer.attribution : null} showMatvaretabellen={false} />
        </ScrollView>

        {/* Pinned to the bottom, like in the sketch. */}
        <View style={styles.footer}>
          <Pressable style={[styles.saveButton, !canSave && styles.saveDisabled]} onPress={handleSave} disabled={!canSave}>
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="checkmark" size={16} color={canSave ? '#fff' : colors.muted} />
                <Text style={[styles.saveButtonText, !canSave && { color: colors.muted }]}>Lagre måltid</Text>
              </>
            )}
          </Pressable>
        </View>

        <FoodSearchModal
          key={searchFor ?? 'closed'}
          visible={searchFor !== null}
          initialQuery={initialQuery}
          onSelect={handleFoodPicked}
          onClose={() => setSearchFor(null)}
        />
      </SafeAreaView>
    </PhaseFade>
  );
}

/** Fades its content in when it first appears (Reanimated "entering" animation). */
function PhaseFade({ children }: { children: React.ReactNode }) {
  return (
    <Animated.View entering={FadeIn.duration(180)} style={styles.phase}>
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // Black behind the fade, matching the camera.
  phase: { flex: 1, backgroundColor: '#000' },
  // The whole Kamera tab is slate-900 in the sketch (not the darker slate-950).
  container: { flex: 1, backgroundColor: colors.surface },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  centeredText: { color: colors.mutedLight, fontSize: font.sm },
  savedCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.pill.green.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm, gap: spacing.sm },
  intro: { fontSize: font.xs, color: colors.muted, marginBottom: spacing.xs },
  mockBanner: { backgroundColor: colors.warningBg, borderRadius: radius.md, padding: spacing.md },
  mockBannerText: { color: colors.warning, fontSize: font.xs },
  noItems: { textAlign: 'center', fontSize: font.sm, color: colors.muted, paddingTop: 32 },
  addButton: {
    flexDirection: 'row',
    gap: spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.primaryBorder,
    borderRadius: radius.md,
    paddingVertical: 10,
  },
  addButtonText: { color: colors.primary, fontWeight: '500', fontSize: font.sm },
  hint: { color: colors.warning, fontSize: font.xs, textAlign: 'center' },
  footer: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.lg },
  saveButton: {
    flexDirection: 'row',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveDisabled: { backgroundColor: colors.surfaceRaised },
  saveButtonText: { color: '#fff', fontSize: font.sm, fontWeight: '500' },
});
