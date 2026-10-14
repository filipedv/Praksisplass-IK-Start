// Types mirroring the `foods` table (see supabase/migrations).

/** Keys used in foods.nutrition and meal_items.nutrition. */
export type NutrientKey =
  | 'energy_kcal'
  | 'energy_kj'
  | 'protein_g'
  | 'fat_g'
  | 'saturated_fat_g'
  | 'carbs_g'
  | 'sugars_g'
  | 'added_sugar_g'
  | 'fiber_g'
  | 'salt_g';

/** A key is missing when Matvaretabellen has no value for that nutrient. */
export type Nutrition = Partial<Record<NutrientKey, number>>;

/** A household portion, e.g. { name: "stk", grams: 120 }. */
export type Portion = { name: string; grams: number };

export type Food = {
  id: string;
  source: 'matvaretabellen' | 'custom';
  name_nb: string;
  name_en: string | null;
  nutrition: Nutrition; // per 100 g
  portions: Portion[]; // first = preferred
};

/** A food returned by the search_foods() database function. */
export type FoodSearchResult = Food & { score: number };

/** Norwegian labels for the nutrients we display. */
export const NUTRIENT_LABELS: Record<NutrientKey, string> = {
  energy_kcal: 'Energi (kcal)',
  energy_kj: 'Energi (kJ)',
  protein_g: 'Protein',
  fat_g: 'Fett',
  saturated_fat_g: 'Mettet fett',
  carbs_g: 'Karbohydrater',
  sugars_g: 'Sukkerarter',
  added_sugar_g: 'Tilsatt sukker',
  fiber_g: 'Kostfiber',
  salt_g: 'Salt',
};
