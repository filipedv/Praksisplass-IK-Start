// EMPTY SLOT for a general multimodal vision model (e.g. Claude with vision),
// so we can compare it against FatSecret later.
//
// When building it, follow the same rules as the FatSecret adapter:
//   - call it through a server-side proxy (the API key must never be in the app),
//   - compress the image first (see ./compress-image.ts),
//   - ask the model for food LABELS ONLY — ignore any nutrition it offers;
//     nutrition always comes from Matvaretabellen,
//   - route the request to an EU region before real players use it (GDPR).

import type { FoodRecognizer } from './types';

export const visionRecognizer: FoodRecognizer = {
  id: 'vision',
  attribution: null,

  async recognizeFood() {
    throw new Error('The vision recognizer is not implemented yet. Set EXPO_PUBLIC_RECOGNIZER=mock.');
  },
};
