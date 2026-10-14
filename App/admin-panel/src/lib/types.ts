// Types mirroring the database tables (see supabase/migrations).
// Keep in sync with player-app/src/nutrition/types.ts.

export type Role = 'player' | 'coach' | 'guardian' | 'admin';

export const ROLE_LABELS: Record<Role, string> = {
  player: 'Spiller',
  coach: 'Trener',
  guardian: 'Foresatt',
  admin: 'Administrator',
};

export type Profile = {
  id: string;
  display_name: string;
  role: Role;
  is_active: boolean;
  created_at: string;
};

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

export type Nutrition = Partial<Record<NutrientKey, number>>;

/** Display order + Norwegian labels for the nutrients we store (per 100 g). */
export const NUTRIENTS: { key: NutrientKey; label: string; unit: string }[] = [
  { key: 'energy_kcal', label: 'Energi', unit: 'kcal' },
  { key: 'energy_kj', label: 'Energi', unit: 'kJ' },
  { key: 'protein_g', label: 'Protein', unit: 'g' },
  { key: 'fat_g', label: 'Fett', unit: 'g' },
  { key: 'saturated_fat_g', label: 'Mettet fett', unit: 'g' },
  { key: 'carbs_g', label: 'Karbohydrater', unit: 'g' },
  { key: 'sugars_g', label: 'Sukkerarter', unit: 'g' },
  { key: 'added_sugar_g', label: 'Tilsatt sukker', unit: 'g' },
  { key: 'fiber_g', label: 'Kostfiber', unit: 'g' },
  { key: 'salt_g', label: 'Salt', unit: 'g' },
];

export type Portion = { name: string; grams: number };

export type Food = {
  id: string;
  source: 'matvaretabellen' | 'custom';
  name_nb: string;
  name_en: string | null;
  search_keywords: string[];
  nutrition: Nutrition;
  portions: Portion[];
};

export type MealItem = { id: string; food_name: string; amount_g: number; nutrition: Nutrition; detected_label: string | null };
export type Meal = { id: string; eaten_at: string; recognizer: string | null; meal_items: MealItem[] };
export type WaterLog = { id: string; amount_ml: number; logged_at: string };

export type ClubSettings = {
  club_name: string;
  default_goal_kcal: number;
  default_goal_protein_g: number;
  default_goal_carbs_g: number;
  default_goal_fat_g: number;
  default_goal_water_ml: number;
  updated_at: string;
};

export type RecognitionEvent = {
  id: string;
  provider: string;
  labels: string[];
  unmatched_labels: string[];
  created_at: string;
};
