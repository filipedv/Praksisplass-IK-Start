// Shrinks a photo before it leaves the phone: smaller upload, faster, and we
// send no more detail than the recognizer needs.

import { File } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

/**
 * Resize to `maxWidth` pixels wide and re-encode as JPEG.
 * Returns the image as base64 text. The temporary resized file is deleted
 * straight away — we never keep a copy of the photo.
 */
export async function compressToBase64(uri: string, maxWidth = 512, quality = 0.7): Promise<string> {
  const rendered = await ImageManipulator.manipulate(uri).resize({ width: maxWidth }).renderAsync();
  const result = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: quality, base64: true });

  deleteLocalFile(result.uri);

  if (!result.base64) throw new Error('Image compression returned no data');
  return result.base64;
}

/** Delete a local temp file, ignoring "already gone" errors. */
export function deleteLocalFile(uri: string) {
  try {
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch {
    // Not fatal: it's in the OS cache folder, which the OS clears anyway.
  }
}
