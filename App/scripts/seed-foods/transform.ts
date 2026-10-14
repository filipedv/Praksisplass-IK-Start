// Turns one Matvaretabellen food (Norwegian + English versions) into a row
// for our `foods` table. Kept separate from seed.ts so it's easy to test.

// --- Shape of the Matvaretabellen API (only the fields we use) ---
type Quantity = { quantity?: number; unit?: string };

export type MvtFood = {
  foodId: string;
  foodName: string;
  searchKeywords?: string[];
  calories?: Quantity;
  energy?: Quantity;
  portions?: { portionName: string; quantity: number; unit: string }[];
  constituents?: (Quantity & { nutrientId: string })[];
};

// --- Shape of a row in our `foods` table ---
export type FoodRow = {
  source: 'matvaretabellen';
  source_id: string;
  name_nb: string;
  name_en: string | null;
  search_keywords: string[];
  nutrition: Record<string, number>;
  portions: { name: string; grams: number }[];
};

// Matvaretabellen nutrient id  →  our key in foods.nutrition (all per 100 g).
// Keep this list in sync with NUTRIENT_LABELS in the player app and admin panel.
const NUTRIENT_MAP: Record<string, string> = {
  Protein: 'protein_g',
  Fett: 'fat_g',
  Mettet: 'saturated_fat_g',
  Karbo: 'carbs_g',
  'Mono+Di': 'sugars_g', // total mono- and disaccharides
  Sukker: 'added_sugar_g', // "tilsatt sukker" in Matvaretabellen
  Fiber: 'fiber_g',
  NaCl: 'salt_g',
};

export function toFoodRow(nb: MvtFood, en: MvtFood | undefined): FoodRow {
  const nutrition: Record<string, number> = {};

  // Energy is stored outside `constituents` in the API.
  if (typeof nb.calories?.quantity === 'number') nutrition.energy_kcal = nb.calories.quantity;
  if (typeof nb.energy?.quantity === 'number') nutrition.energy_kj = nb.energy.quantity;

  for (const c of nb.constituents ?? []) {
    const key = NUTRIENT_MAP[c.nutrientId];
    // Some constituents have no quantity (= not analysed). Skip those rather
    // than pretending they are 0.
    if (key && typeof c.quantity === 'number') nutrition[key] = c.quantity;
  }

  // Put "porsjon" first if it exists — it's the most natural unit to show.
  const portions = (nb.portions ?? [])
    .filter((p) => p.unit === 'g' && p.quantity > 0)
    .map((p) => ({ name: p.portionName, grams: p.quantity }))
    .sort((a, b) => Number(b.name === 'porsjon') - Number(a.name === 'porsjon'));

  return {
    source: 'matvaretabellen',
    source_id: nb.foodId,
    name_nb: nb.foodName,
    name_en: en?.foodName ?? null,
    search_keywords: [...(nb.searchKeywords ?? []), ...(en?.searchKeywords ?? [])],
    nutrition,
    portions,
  };
}
