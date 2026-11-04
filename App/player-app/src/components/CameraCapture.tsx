// The live camera view the Kamera tab opens straight into (as in the sketch):
// full-screen preview, the privacy line, and a big white shutter button.
// Beside the shutter: pick from photos (left) and add without a photo (right).

import Ionicons from '@expo/vector-icons/Ionicons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useFocusEffect } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useRef, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, font, radius, spacing } from '@/lib/theme';
import { useI18n } from '@/lib/i18n';

type Props = {
  onPhoto: (uri: string) => void; // a local file:// URI
  onManual: () => void;
};

export function CameraCapture({ onPhoto, onManual }: Props) {
  const { t } = useI18n();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [busy, setBusy] = useState(false);

  // Only run the camera while this tab is on screen. When you switch tabs the
  // preview is unmounted, so the camera is never running in the background.
  const [isFocused, setIsFocused] = useState(false);
  useFocusEffect(
    useCallback(() => {
      setIsFocused(true);
      return () => setIsFocused(false);
    }, []),
  );

  async function takePhoto() {
    if (!cameraRef.current || busy) return;
    setBusy(true); // stops double taps
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.6 });
      if (photo?.uri) onPhoto(photo.uri);
    } finally {
      setBusy(false);
    }
  }

  async function pickFromLibrary() {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.6 });
    if (!result.canceled && result.assets?.[0]) onPhoto(result.assets[0].uri);
  }

  // Permission still loading.
  if (!permission) return <View style={styles.black} />;

  // No permission (yet): explain why, and ask.
  if (!permission.granted) {
    return (
      <SafeAreaView style={[styles.black, styles.center]}>
        <Ionicons name="camera-outline" size={36} color={colors.faint} />
        <Text style={styles.permissionTitle}>{t('Tilgang til kamera', 'Camera access')}</Text>
        <Text style={styles.permissionText}>
          {t(
            'Appen bruker kameraet til å ta bilde av måltidet ditt. Bildet lagres ikke.',
            'The app uses the camera to take a photo of your meal. The photo is not stored.',
          )}
        </Text>
        {permission.canAskAgain ? (
          <Pressable style={styles.permissionButton} onPress={requestPermission}>
            <Text style={styles.permissionButtonText}>{t('Gi tilgang', 'Allow access')}</Text>
          </Pressable>
        ) : (
          // The user said no before; iOS/Android only let us ask once.
          <Pressable style={styles.permissionButton} onPress={() => Linking.openSettings()}>
            <Text style={styles.permissionButtonText}>{t('Åpne Innstillinger', 'Open Settings')}</Text>
          </Pressable>
        )}
        <Pressable onPress={pickFromLibrary} hitSlop={8}>
          <Text style={styles.link}>{t('Velg fra bilder i stedet', 'Choose from photos instead')}</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.black}>
      {isFocused && <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" />}

      <SafeAreaView style={styles.overlay} edges={['top']}>
        <View style={styles.bottom}>
          <Text style={styles.privacy}>
            {t(
              'Bildet sendes til gjenkjenning og lagres ikke — kun maten og næringsverdiene blir lagret.',
              'The photo is sent for recognition and not stored — only the food and nutrition values are saved.',
            )}
          </Text>

          <View style={styles.controls}>
            <Pressable style={styles.sideButton} onPress={pickFromLibrary} accessibilityLabel={t('Velg fra bilder', 'Choose from photos')}>
              <Ionicons name="images-outline" size={24} color="#fff" />
            </Pressable>

            <Pressable
              style={({ pressed }) => [styles.shutter, (pressed || busy) && { opacity: 0.6 }]}
              onPress={takePhoto}
              disabled={busy}
              accessibilityLabel={t('Ta bilde', 'Take photo')}>
              <View style={styles.shutterInner} />
            </Pressable>

            <Pressable style={styles.sideButton} onPress={onManual} accessibilityLabel={t('Legg til uten bilde', 'Add without a photo')}>
              <Ionicons name="create-outline" size={24} color="#fff" />
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  black: { flex: 1, backgroundColor: '#000' },
  center: { alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.md },
  overlay: { flex: 1, justifyContent: 'flex-end' },
  // Sketch: pt-10 pb-6 on a gradient that fades the photo to black at the bottom.
  // (A flat translucent band here — a real gradient would need another library.)
  bottom: { paddingTop: spacing.xl, paddingBottom: spacing.xl, gap: spacing.md, alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.35)' },
  privacy: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: font.xs,
    textAlign: 'center',
    paddingHorizontal: 32,
    // A soft shadow keeps the text readable on bright food photos.
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowRadius: 4,
  },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 48 },
  sideButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(15,23,42,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutter: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 4,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterInner: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#fff' },
  permissionTitle: { color: colors.text, fontSize: 18, fontWeight: '700' },
  permissionText: { color: colors.mutedLight, textAlign: 'center', lineHeight: 20 },
  permissionButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    marginTop: spacing.sm,
  },
  permissionButtonText: { color: '#fff', fontWeight: '700' },
  link: { color: colors.primary, padding: spacing.sm },
});
