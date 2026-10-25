// Types mirroring the database tables (see supabase/migrations).
// Keep in sync with player-app/src/nutrition/types.ts.

import { t } from './i18n';

export type Role = 'player' | 'coach' | 'guardian' | 'admin';

// `get` = worked out each time it's read, so the text follows the language.
export const ROLE_LABELS: Record<Role, string> = {
  get player() { return t('Spiller', 'Player'); },
  get coach() { return t('Trener', 'Coach'); },
  get guardian() { return t('Foresatt', 'Guardian'); },
  get admin() { return t('Administrator', 'Administrator'); },
};

export type Profile = {
  id: string;
  display_name: string;
  role: Role;
  is_active: boolean;
  created_at: string;
  team_id: string | null;
};

/** The columns every profiles query selects (keep in sync with Profile). */
export const PROFILE_COLUMNS = 'id, display_name, role, is_active, created_at, team_id';

/** A team (A-lag, G19 …). Goal fields: null = use the club default. */
export type Team = {
  id: string;
  name: string;
  sort_order: number;
  goal_kcal: number | null;
  goal_protein_g: number | null;
  goal_carbs_g: number | null;
  goal_fat_g: number | null;
  goal_water_ml: number | null;
};

/** One row of the change log (audit_log). */
export type AuditEntry = {
  id: number;
  at: string;
  actor_id: string | null;
  actor_name: string | null;
  action: 'insert' | 'update' | 'delete';
  table_name: string;
  record_id: string | null;
  subject_user_id: string | null;
  changes: Record<string, [unknown, unknown]>;
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

/** Display order + labels for the nutrients we store (per 100 g). */
export const NUTRIENTS: { key: NutrientKey; label: string; unit: string }[] = [
  { key: 'energy_kcal', get label() { return t('Energi', 'Energy'); }, unit: 'kcal' },
  { key: 'energy_kj', get label() { return t('Energi', 'Energy'); }, unit: 'kJ' },
  { key: 'protein_g', label: 'Protein', unit: 'g' },
  { key: 'fat_g', get label() { return t('Fett', 'Fat'); }, unit: 'g' },
  { key: 'saturated_fat_g', get label() { return t('Mettet fett', 'Saturated fat'); }, unit: 'g' },
  { key: 'carbs_g', get label() { return t('Karbohydrater', 'Carbohydrates'); }, unit: 'g' },
  { key: 'sugars_g', get label() { return t('Sukkerarter', 'Sugars'); }, unit: 'g' },
  { key: 'added_sugar_g', get label() { return t('Tilsatt sukker', 'Added sugar'); }, unit: 'g' },
  { key: 'fiber_g', get label() { return t('Kostfiber', 'Fibre'); }, unit: 'g' },
  { key: 'salt_g', label: 'Salt', unit: 'g' },
];

export type Portion = { name: string; grams: number };

/** A row from search_foods() — like Food, without search_keywords, plus a 0–1 score. */
export type SearchFood = Omit<Food, 'search_keywords'> & { score: number };

/** Database JSON → our food shape (jsonb columns arrive as generic JSON). */
export function toSearchFood(row: {
  id: string;
  source: string;
  name_nb: string;
  name_en: string | null;
  nutrition: unknown;
  portions: unknown;
  score: number;
}): SearchFood {
  return {
    ...row,
    source: row.source as Food['source'],
    nutrition: (row.nutrition ?? {}) as Nutrition,
    portions: (row.portions ?? []) as Portion[],
  };
}

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
export type Meal = { id: string; eaten_at: string; recognizer: string | null; admin_changed_at: string | null; meal_items: MealItem[] };
export type WaterLog = { id: string; amount_ml: number; logged_at: string };

export type ClubSettings = {
  foods_seeded_at?: string | null;
  fatsecret_trial_started_on?: string | null;
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
