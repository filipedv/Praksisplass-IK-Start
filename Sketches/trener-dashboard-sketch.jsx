import { useState, useId, createContext, useContext } from "react";
import {
  Search,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronRight as ChevronRightIcon,
  Plus,
  User,
  NotebookPen,
  Droplet,
  Trash2,
  AlertTriangle,
  X,
  Edit3,
  SlidersHorizontal,
  Sun,
  Moon,
  Clock,
  TrendingDown,
  Check,
} from "lucide-react";
import { LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

// ---------------------------------------------------------------------------
// Dark mode — driven entirely by JS state (not Tailwind's dark: variant,
// which follows OS preference here rather than a manual toggle). Every
// themed className below is written as "LIGHT dark:DARK" pairs; cx() reads
// that literal pattern at render time and resolves it against isDark.
// ---------------------------------------------------------------------------

const ThemeContext = createContext(false);
function useIsDark() {
  return useContext(ThemeContext);
}

function cx(str, isDark) {
  const tokens = str.split(/\s+/).filter(Boolean);
  const out = [];
  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];
    const next = tokens[i + 1];
    if (next && next.startsWith("dark:")) {
      out.push(isDark ? next.slice(5) : tok);
      i++;
    } else if (tok.startsWith("dark:")) {
      if (isDark) out.push(tok.slice(5));
    } else {
      out.push(tok);
    }
  }
  return out.join(" ");
}

// ---------------------------------------------------------------------------
// Language — Norwegian/English, toggled top-right next to the dark-mode
// button. Covers all interface chrome and app-generated sentences. Coach-
// written notes and allergy entries are left as-is on toggle, same as real
// user content wouldn't retroactively translate itself in a real app.
// ---------------------------------------------------------------------------

const LanguageContext = createContext("no");
function useLang() {
  return useContext(LanguageContext);
}

const TEXT = {
  appTitle: { no: "IK Start · Trenerdashboard", en: "IK Start · Coach Dashboard" },
  coachLabel: { no: "Trener: Ola Nordmann", en: "Coach: Ola Nordmann" },
  toggleDarkOn: { no: "Slå av mørk modus", en: "Turn off dark mode" },
  toggleDarkOff: { no: "Slå på mørk modus", en: "Turn on dark mode" },
  playersHeading: { no: "Mine spillere", en: "My Players" },
  playersSubtitle: { no: (n) => `${n} spillere tildelt deg`, en: (n) => `${n} players assigned to you` },
  todoHeading: { no: "Trenger oppfølging", en: "Needs Follow-up" },
  todoEmpty: { no: "Ingen spillere trenger oppfølging akkurat nå. 🎉", en: "No players need follow-up right now. 🎉" },
  markDone: { no: "Merk som gjort", en: "Mark as done" },
  todayLabel: { no: "I dag", en: "Today" },
  loggedFoodSuffix: { no: "har logget mat", en: "have logged food" },
  sortByLabel: { no: "Sorter etter:", en: "Sort by:" },
  searchPlaceholder: { no: "Søk etter spiller…", en: "Search for a player…" },
  noPlayersFound: { no: "Ingen spillere funnet.", en: "No players found." },
  loggedTodayPill: { no: "Logget i dag", en: "Logged today" },
  lastLoggedPill: { no: (n) => `Sist logget for ${n}d siden`, en: (n) => `Last logged ${n}d ago` },
  backToList: { no: "Tilbake til spillerliste", en: "Back to player list" },
  criticalInfoHeading: { no: "Kritisk informasjon", en: "Critical Information" },
  noAllergies: { no: "Ingen registrerte allergier eller diett-restriksjoner.", en: "No registered allergies or dietary restrictions." },
  addAllergyPlaceholder: { no: "Legg til allergi eller restriksjon…", en: "Add an allergy or restriction…" },
  addLabel: { no: "Legg til", en: "Add" },
  towardGoalsHeading: { no: "Mot dagens mål", en: "Toward Today's Goals" },
  noMealsThisDay: { no: "Ingen måltider registrert denne dagen.", en: "No meals logged this day." },
  goalStatusHeading: { no: "Måloppnåelse — siste 30 dager", en: "Goal Achievement — Last 30 Days" },
  adjustGoals: { no: "Juster mål", en: "Adjust Goals" },
  manualAdjustmentNote: {
    no: "Manuell justering inntil vi legger inn en formel som beregner dette automatisk.",
    en: "Manual adjustment until we add a formula that calculates this automatically.",
  },
  kcalGoalLabel: { no: "Kaloriemål (kcal)", en: "Calorie goal (kcal)" },
  proteinGoalLabel: { no: "Proteinmål (g)", en: "Protein goal (g)" },
  carbsGoalLabel: { no: "Karbomål (g)", en: "Carb goal (g)" },
  fatGoalLabel: { no: "Fettmål (g)", en: "Fat goal (g)" },
  waterGoalLabel: { no: "Væskemål (ml)", en: "Fluid goal (ml)" },
  weightChartHeading: { no: "Vekt over tid", en: "Weight Over Time" },
  heightChartHeading: { no: "Høyde over tid", en: "Height Over Time" },
  weightAlertText: {
    no: (diff, days) =>
      `${diff < 0 ? "Ned" : "Opp"} ${Math.abs(diff)} kg på ${days} dager — sjekk om dette er forventet vekst eller verdt å følge opp. Ikke en diagnose, bare et varsel.`,
    en: (diff, days) =>
      `${diff < 0 ? "Down" : "Up"} ${Math.abs(diff)} kg over ${days} days — worth checking whether this is expected growth or worth following up. Not a diagnosis, just a flag.`,
  },
  addMeasurementHeading: { no: "Legg til måling", en: "Add Measurement" },
  updateMeasurement: { no: "Oppdater måling", en: "Update Measurement" },
  addMeasurement: { no: "Legg til måling", en: "Add Measurement" },
  dateLabel: { no: "Dato", en: "Date" },
  weightKgLabel: { no: "Vekt (kg)", en: "Weight (kg)" },
  heightCmLabel: { no: "Høyde (cm)", en: "Height (cm)" },
  measurementHistoryHeading: { no: "Målehistorikk", en: "Measurement History" },
  noMeasurements: { no: "Ingen målinger registrert ennå.", en: "No measurements recorded yet." },
  notesHeading: { no: "Notater (kun synlig for deg)", en: "Notes (only visible to you)" },
  notePlaceholder: { no: "Skriv et notat…", en: "Write a note…" },
  noNotes: { no: "Ingen notater ennå.", en: "No notes yet." },
};

function translate(lang, key, ...args) {
  const entry = TEXT[key];
  if (!entry) return key;
  const val = entry[lang];
  return typeof val === "function" ? val(...args) : val;
}
function useT() {
  const lang = useLang();
  return (key, ...args) => translate(lang, key, ...args);
}

const POSITION_LABELS = {
  Spiss: { no: "Spiss", en: "Forward" },
  Midtbane: { no: "Midtbane", en: "Midfielder" },
  Forsvar: { no: "Forsvar", en: "Defender" },
  Keeper: { no: "Keeper", en: "Goalkeeper" },
};
function positionLabel(position, lang) {
  return POSITION_LABELS[position]?.[lang] || position;
}

const MEAL_TITLES = { Lunsj: { no: "Lunsj", en: "Lunch" } };
function mealTitleLabel(title, lang) {
  return MEAL_TITLES[title]?.[lang] || title;
}

// Only the fabricated demo values below are translated — anything a coach
// actually types into this field later stays exactly as written.
const ALLERGY_LABELS = {
  Nøtteallergi: { no: "Nøtteallergi", en: "Nut allergy" },
  Laktoseintolerant: { no: "Laktoseintolerant", en: "Lactose intolerant" },
  "Cøliaki (gluten)": { no: "Cøliaki (gluten)", en: "Coeliac (gluten)" },
  Vegetarianer: { no: "Vegetarianer", en: "Vegetarian" },
};
function allergyLabel(text, lang) {
  return ALLERGY_LABELS[text]?.[lang] || text;
}


// ---------------------------------------------------------------------------
// Shared mock food/nutrition data (same shape as the player sketch, trimmed
// to what's needed here — this file is self-contained on purpose).
// ---------------------------------------------------------------------------

const FOODS = [
  { id: "f1", name: "Havregryn (oats)", kcal: 372, protein: 13.5, carbs: 59, fat: 7 },
  { id: "f2", name: "Kyllingfilet, stekt", kcal: 165, protein: 31, carbs: 0, fat: 3.6 },
  { id: "f3", name: "Laks, ovnsbakt", kcal: 208, protein: 20, carbs: 0, fat: 13 },
  { id: "f4", name: "Poteter, kokte", kcal: 87, protein: 1.9, carbs: 20, fat: 0.1 },
  { id: "f5", name: "Brokkoli, kokt", kcal: 35, protein: 2.4, carbs: 4, fat: 0.4 },
  { id: "f6", name: "Banan", kcal: 89, protein: 1.1, carbs: 23, fat: 0.3 },
  { id: "f7", name: "Egg, kokt", kcal: 155, protein: 13, carbs: 1.1, fat: 11 },
  { id: "f9", name: "Melk, lettmelk", kcal: 46, protein: 3.4, carbs: 4.9, fat: 1.5 },
  { id: "f10", name: "Kjøttkaker i brun saus", kcal: 197, protein: 12, carbs: 6, fat: 14 },
];

// Matvaretabellen (the real project's nutrition source) is Norwegian-only —
// these English labels exist purely for a clean bilingual demo here, not
// because the real data source would actually have them.
const FOOD_LABELS_EN = {
  "Havregryn (oats)": "Oats",
  "Kyllingfilet, stekt": "Chicken fillet, fried",
  "Laks, ovnsbakt": "Salmon, oven-baked",
  "Poteter, kokte": "Potatoes, boiled",
  "Brokkoli, kokt": "Broccoli, boiled",
  Banan: "Banana",
  "Egg, kokt": "Egg, boiled",
  "Melk, lettmelk": "Milk, semi-skimmed",
  "Kjøttkaker i brun saus": "Meatballs in brown sauce",
};
function foodNameLabel(name, lang) {
  return lang === "en" ? FOOD_LABELS_EN[name] || name : name;
}

function foodById(id) {
  return FOODS.find((f) => f.id === id);
}

function mealTotals(itemsDetailed) {
  const sum = (fn) =>
    Math.round(itemsDetailed.reduce((s, it) => s + (foodById(it.foodId)[fn] / 100) * it.grams, 0));
  return { kcal: sum("kcal"), protein: sum("protein"), carbs: sum("carbs"), fat: sum("fat") };
}

// ---------------------------------------------------------------------------
// Date helpers — simplified to prev/next day for this dashboard (no month
// calendar here; easy to add later if it turns out to be needed).
// ---------------------------------------------------------------------------

function pad2(n) {
  return n.toString().padStart(2, "0");
}
function toISODate(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}
function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}
function addMonths(date, n) {
  return new Date(date.getFullYear(), date.getMonth() + n, date.getDate());
}
function formatDayDate(date, lang = "no") {
  const s = date.toLocaleDateString(lang === "en" ? "en-GB" : "no-NO", { weekday: "long", day: "numeric", month: "long" });
  return s.charAt(0).toUpperCase() + s.slice(1);
}
function formatShortDate(iso, lang = "no") {
  const s = new Date(iso).toLocaleDateString(lang === "en" ? "en-GB" : "no-NO", { day: "numeric", month: "short" });
  return s;
}

function isSameMonth(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}
function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}
function formatMonthYear(date, lang = "no") {
  const s = date.toLocaleDateString(lang === "en" ? "en-GB" : "no-NO", { month: "long", year: "numeric" });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const TODAY = new Date(2026, 7, 19);
const TODAY_ISO = toISODate(TODAY);

function pseudoRandom(seed) {
  const x = Math.sin(seed * 999) * 10000;
  return x - Math.floor(x);
}

// ---------------------------------------------------------------------------
// Mock squad data
// ---------------------------------------------------------------------------

const AVATAR_TONES = [
  "bg-emerald-100 text-emerald-700",
  "bg-blue-100 text-blue-700",
  "bg-amber-100 text-amber-700",
  "bg-violet-100 text-violet-700",
  "bg-rose-100 text-rose-700",
  "bg-cyan-100 text-cyan-700",
];

const PLAYERS = [
  { id: "p1", name: "Fatima Ali", team: "A-lag", position: "Spiss", lastLoggedDaysAgo: 0, baseWeight: 63, baseHeight: 168, allergies: ["Nøtteallergi"] },
  { id: "p2", name: "Kasper Dahl", team: "A-lag", position: "Midtbane", lastLoggedDaysAgo: 0, baseWeight: 78, baseHeight: 183, allergies: [] },
  { id: "p3", name: "Jonas Reme", team: "A-lag", position: "Forsvar", lastLoggedDaysAgo: 2, baseWeight: 82, baseHeight: 188, allergies: ["Laktoseintolerant"] },
  { id: "p4", name: "Noah Berg", team: "G19", position: "Forsvar", lastLoggedDaysAgo: 1, baseWeight: 74, baseHeight: 181, allergies: [] },
  { id: "p5", name: "Sander Lie", team: "G19", position: "Keeper", lastLoggedDaysAgo: 0, baseWeight: 76, baseHeight: 187, allergies: ["Cøliaki (gluten)"] },
  { id: "p6", name: "Magnus Solberg", team: "G19", position: "Spiss", lastLoggedDaysAgo: 5, baseWeight: 70, baseHeight: 178, allergies: [] },
  { id: "p7", name: "Emil Haugen", team: "G16", position: "Midtbane", lastLoggedDaysAgo: 3, baseWeight: 61, baseHeight: 172, allergies: ["Vegetarianer"] },
  { id: "p8", name: "Oliver Nystrøm", team: "G16", position: "Spiss", lastLoggedDaysAgo: 0, baseWeight: 58, baseHeight: 169, allergies: [] },
];

const INITIAL_ALLERGIES = {};
PLAYERS.forEach((p) => {
  INITIAL_ALLERGIES[p.id] = p.allergies;
});

const WATER_GOAL_ML = 2500;
const GLASS_ML = 500; // 1 glass = 0.5 l
const GLASS_GOAL = Math.round(WATER_GOAL_ML / GLASS_ML);
function glassFill(waterMl, index) {
  const amount = Math.min(Math.max(waterMl - index * GLASS_ML, 0), GLASS_ML);
  return amount / GLASS_ML;
}

// Daily goal status — used for the calendar dots, squad overview, and pie
// chart. Four states so "didn't log" and "logged but far from goal" read as
// the different situations they actually are, instead of both being "red".
// TARGET_KCAL/WATER_GOAL_ML below are just the default starting point for a
// new player — coaches can override every field per player (see "Juster mål"
// on the player dashboard) until the real formula replaces this.
const TARGET_KCAL = 2800;
const DEFAULT_GOALS = {
  kcalGoal: TARGET_KCAL,
  proteinGoal: 140,
  carbsGoal: 350,
  fatGoal: 90,
  waterGoal: WATER_GOAL_ML,
};
function computeStatus(kcal, waterMl, kcalGoal = TARGET_KCAL, waterGoal = WATER_GOAL_ML) {
  if (!kcal) return "gray"; // no meals logged that day
  const kcalFrac = Math.min(kcal / kcalGoal, 1);
  const waterFrac = Math.min((waterMl || 0) / waterGoal, 1);
  const score = (kcalFrac + waterFrac) / 2;
  if (score >= 0.85) return "green";
  if (score >= 0.5) return "orange";
  return "red";
}

const STATUS_ORDER = ["gray", "red", "orange", "green"];
const STATUS_COLORS = { gray: "#94A3B8", red: "#EF4444", orange: "#F59E0B", green: "#10B981" };
const STATUS_LABELS_BY_LANG = {
  no: { gray: "Ikke logget", red: "Langt fra målet", orange: "Nesten nådde målet", green: "Nådde målet" },
  en: { gray: "Not logged", red: "Far from goal", orange: "Almost there", green: "Goal reached" },
};
const STATUS_EXPLANATIONS_BY_LANG = {
  no: {
    gray: "Ingen registrering denne dagen — en oppfølgingssak, ikke nødvendigvis et ernæringsproblem.",
    red: "Logget, men langt unna ernærings- og væskemålet — verdt å ta opp med ernæringsfysiolog.",
    orange: "Kom et stykke på vei, men nådde ikke hele målet.",
    green: "Nådde både ernærings- og væskemålet for dagen.",
  },
  en: {
    gray: "No entry this day — a follow-up matter, not necessarily a nutrition problem.",
    red: "Logged, but far from the calorie and hydration goal — worth raising with the nutritionist.",
    orange: "Made progress, but didn't fully reach the goal.",
    green: "Hit both the calorie and hydration goal for the day.",
  },
};
function statusLabel(key, lang) {
  return STATUS_LABELS_BY_LANG[lang][key];
}
function statusExplanation(key, lang) {
  return STATUS_EXPLANATIONS_BY_LANG[lang][key];
}

// Mock goal-status history per player for days other than "today" (which is
// computed live from the real mock meals/water above). Two separate biases:
// how likely they are to have logged at all, and — if they did — how likely
// that log was close to the goal. Both are worse for players who've gone
// longer without logging, so it lines up with the badge in the player list.
function generateStatusHistory(seed, loggingProb, qualityBias) {
  const map = {};
  for (let d = 1; d <= 90; d++) {
    const iso = toISODate(addDays(TODAY, -d));
    const loggedRoll = pseudoRandom(seed * 137 + d * 7 + 1);
    if (loggedRoll > loggingProb) {
      map[iso] = "gray";
      continue;
    }
    const qualityRoll = pseudoRandom(seed * 277 + d * 13 + 3);
    if (qualityRoll < qualityBias) map[iso] = "green";
    else if (qualityRoll < qualityBias + 0.3) map[iso] = "orange";
    else map[iso] = "red";
  }
  return map;
}

const STATUS_HISTORY = {};
PLAYERS.forEach((p, i) => {
  const loggingProb = Math.max(0.35, 0.95 - p.lastLoggedDaysAgo * 0.1);
  const qualityBias = Math.max(0.15, 0.65 - p.lastLoggedDaysAgo * 0.08);
  STATUS_HISTORY[p.id] = generateStatusHistory(i + 1, loggingProb, qualityBias);
});

// Per-player nutrition goals. Everyone starts on the same flat defaults —
// there's no formula yet — but a coach can override either number for an
// individual player from their dashboard.
const INITIAL_GOALS = {};
PLAYERS.forEach((p) => {
  INITIAL_GOALS[p.id] = { ...DEFAULT_GOALS };
});

// Today's hydration per player — same simplification as meals: only "today"
// is populated for players who logged today.
const TODAY_WATER = {};
PLAYERS.forEach((p, i) => {
  if (p.lastLoggedDaysAgo === 0) {
    TODAY_WATER[p.id] = [900, 1600, 1300, 2200][i % 4];
  }
});

const MEAL_COMBOS = [
  [{ foodId: "f2", grams: 150 }, { foodId: "f4", grams: 180 }],
  [{ foodId: "f3", grams: 125 }, { foodId: "f5", grams: 100 }],
  [{ foodId: "f1", grams: 50 }, { foodId: "f6", grams: 120 }],
  [{ foodId: "f7", grams: 120 }, { foodId: "f9", grams: 200 }],
  [{ foodId: "f10", grams: 200 }, { foodId: "f4", grams: 150 }],
];

// Today's meals per player — only "today" is populated; other days show an
// empty state, same simplification used elsewhere in these sketches.
const TODAY_MEALS = {};
PLAYERS.forEach((p, i) => {
  if (p.lastLoggedDaysAgo === 0) {
    TODAY_MEALS[p.id] = [
      { id: `${p.id}-m1`, time: "12:30", title: "Lunsj", itemsDetailed: MEAL_COMBOS[i % MEAL_COMBOS.length] },
    ];
  }
});

// Shared helper: a player's goal status for today, from the same mock data
// used everywhere else (used by both the squad overview and the player
// dashboard's calendar/pie chart).
function getPlayerTodayStatus(playerId, kcalGoal, waterGoal) {
  const meals = TODAY_MEALS[playerId] || [];
  const kcal = meals.reduce((s, m) => s + mealTotals(m.itemsDetailed).kcal, 0);
  const water = TODAY_WATER[playerId] || 0;
  return computeStatus(kcal, water, kcalGoal, waterGoal);
}

function initialMeasurements(baseWeight, baseHeight, seed) {
  const points = [];
  for (let m = 6; m >= 0; m--) {
    const date = addMonths(TODAY, -m);
    const noise = pseudoRandom(seed + m);
    const weightKg = Math.round((baseWeight - m * 0.5 + (noise - 0.5) * 0.6) * 10) / 10;
    const heightCm = Math.round((baseHeight - m * 0.4 + (noise - 0.5) * 0.4) * 10) / 10;
    points.push({ date: toISODate(date), weightKg, heightCm });
  }
  return points;
}

const INITIAL_MEASUREMENTS = {};
PLAYERS.forEach((p, i) => {
  INITIAL_MEASUREMENTS[p.id] = initialMeasurements(p.baseWeight, p.baseHeight, i + 1);
});

// Inject one realistic "rapid weight change" example so the to-do list and
// the weight-chart alert have something real to demonstrate. Magnus Solberg
// already has a note about inconsistent logging — this ties the same player
// to a genuine weight concern too, which is a believable combination.
{
  const magnus = INITIAL_MEASUREMENTS["p6"];
  if (magnus && magnus.length >= 2) {
    const latest = magnus[magnus.length - 1];
    const prev = magnus[magnus.length - 2];
    latest.weightKg = Math.round((prev.weightKg - 3) * 10) / 10;
  }
}

const INITIAL_NOTES = {
  p3: [{ id: "n1", date: "2026-08-12", text: "Nevnte lett kneplage etter tirsdagens økt. Følg opp med fysio." }],
  p6: [{ id: "n2", date: "2026-08-14", text: "Har logget sjeldnere siste uken. Ta en prat om rutiner." }],
};

// Rapid weight-change detector: compares the latest weigh-in to the closest
// prior one that's roughly 3 weeks earlier (14–35 day window), flagging a
// ±2kg-or-more swing either direction. Placeholder threshold — real
// guidance on what's "concerning" for a growing athlete should come from a
// sports medicine professional, not a hardcoded number.
function detectWeightAlert(measurements) {
  const withWeight = (measurements || [])
    .filter((m) => m.weightKg != null)
    .sort((a, b) => (a.date < b.date ? -1 : 1));
  if (withWeight.length < 2) return null;
  const latest = withWeight[withWeight.length - 1];
  const latestTime = new Date(latest.date).getTime();
  let best = null;
  let bestDistance = Infinity;
  for (const m of withWeight) {
    if (m === latest) continue;
    const days = (latestTime - new Date(m.date).getTime()) / 86400000;
    if (days >= 14 && days <= 35) {
      const distance = Math.abs(days - 21);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = { entry: m, days: Math.round(days) };
      }
    }
  }
  if (!best) return null;
  const diff = Math.round((latest.weightKg - best.entry.weightKg) * 10) / 10;
  if (Math.abs(diff) >= 2) return { diff, days: best.days };
  return null;
}

// Counts "red" (logged but far from goal) days in the last week — used to
// flag a persistent fueling problem rather than a one-off bad day.
function getRecentRedCount(playerId, kcalGoal, waterGoal) {
  let count = 0;
  for (let d = 0; d < 7; d++) {
    const iso = toISODate(addDays(TODAY, -d));
    const status = iso === TODAY_ISO ? getPlayerTodayStatus(playerId, kcalGoal, waterGoal) : STATUS_HISTORY[playerId]?.[iso] || "gray";
    if (status === "red") count++;
  }
  return count;
}

// ---------------------------------------------------------------------------
// Small shared bits
// ---------------------------------------------------------------------------

function Card({ children, className = "" }) {
  const isDark = useIsDark();
  return <div className={cx(`bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm ${className}`, isDark)}>{children}</div>;
}

function StatBlock({ value, unit, label, dot }) {
  const isDark = useIsDark();
  return (
    <div className="flex flex-col items-center flex-1 gap-1.5">
      <span className={cx("text-2xl font-bold text-slate-900 dark:text-white", isDark)}>
        {value}
        {unit && <span className={cx("text-sm font-medium text-slate-400 dark:text-slate-500 ml-0.5", isDark)}>{unit}</span>}
      </span>
      <span className={cx("text-xs text-slate-400 dark:text-slate-500", isDark)}>{label}</span>
      <span className={`w-2 h-2 rounded-full ${dot}`} />
    </div>
  );
}

function NutritionStatGrid({ totals, lang }) {
  return (
    <div className="flex justify-between max-w-md">
      <StatBlock value={totals.kcal} label="kcal" dot="bg-emerald-500" />
      <StatBlock value={totals.protein} unit="g" label="Protein" dot="bg-blue-500" />
      <StatBlock value={totals.carbs} unit="g" label={lang === "en" ? "Carbs" : "Karbo"} dot="bg-amber-400" />
      <StatBlock value={totals.fat} unit="g" label={lang === "en" ? "Fat" : "Fett"} dot="bg-violet-500" />
    </div>
  );
}

function GoalProgressBar({ label, value, goal, unit, color }) {
  const isDark = useIsDark();
  const pct = goal > 0 ? Math.min(100, Math.round((value / goal) * 100)) : 0;
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className={cx("text-xs text-slate-500 dark:text-slate-400", isDark)}>{label}</span>
        <span className={cx("text-xs text-slate-400 dark:text-slate-500", isDark)}>
          {value}/{goal} {unit}
        </span>
      </div>
      <div className={cx("w-full h-1.5 rounded-full bg-slate-100 dark:bg-slate-950 overflow-hidden", isDark)}>
        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

function GoalProgressGrid({ totals, goals, lang }) {
  return (
    <div className="space-y-2.5">
      <GoalProgressBar label={lang === "en" ? "Calories" : "Kalorier"} value={totals.kcal} goal={goals.kcalGoal} unit="kcal" color="#10B981" />
      <GoalProgressBar label="Protein" value={totals.protein} goal={goals.proteinGoal} unit="g" color="#3B82F6" />
      <GoalProgressBar label={lang === "en" ? "Carbs" : "Karbo"} value={totals.carbs} goal={goals.carbsGoal} unit="g" color="#F59E0B" />
      <GoalProgressBar label={lang === "en" ? "Fat" : "Fett"} value={totals.fat} goal={goals.fatGoal} unit="g" color="#8B5CF6" />
    </div>
  );
}

function WaterGlass({ fill = 0, size = 16 }) {
  const h = size * 1.3;
  const clampedFill = Math.max(0, Math.min(1, fill));
  const glassPath = "M2.5 2H17.5L15.3 23C15.2 24.1 14.3 25 13.2 25H6.8C5.7 25 4.8 24.1 4.7 23L2.5 2Z";
  const fillY = 26 - 26 * clampedFill;
  const fillH = 26 * clampedFill;
  const clipId = useId();

  return (
    <svg width={size} height={h} viewBox="0 0 20 26" fill="none">
      <defs>
        <clipPath id={clipId}>
          <rect x="0" y={fillY} width="20" height={fillH} />
        </clipPath>
      </defs>
      <path d={glassPath} className="fill-white stroke-slate-300" strokeWidth="1.5" />
      {clampedFill > 0 && <path d={glassPath} className="fill-blue-500" clipPath={`url(#${clipId})`} />}
      <path d={glassPath} className="stroke-slate-300" strokeWidth="1.5" fill="none" />
    </svg>
  );
}

function GlassRow({ water, size }) {
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: GLASS_GOAL }).map((_, i) => (
        <WaterGlass key={i} fill={glassFill(water, i)} size={size} />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Player list
// ---------------------------------------------------------------------------

const SORT_OPTIONS = [
  { key: "attention", label: { no: "Trenger oppfølging", en: "Needs follow-up" } },
  { key: "name", label: { no: "Navn (A–Å)", en: "Name (A–Z)" } },
  { key: "recent", label: { no: "Nylig aktive", en: "Recently active" } },
];

function PlayerList({ onSelectPlayer, goalsByPlayer, measurementsByPlayer, dismissedTodos, onDismissTodo }) {
  const isDark = useIsDark();
  const lang = useLang();
  const t = useT();
  const [query, setQuery] = useState("");
  const [sortMode, setSortMode] = useState("attention");
  const [checkingIds, setCheckingIds] = useState(new Set());

  const handleCheckTodo = (id) => {
    setCheckingIds((prev) => new Set(prev).add(id));
    setTimeout(() => onDismissTodo(id), 350);
  };

  const squadStatusCounts = { gray: 0, red: 0, orange: 0, green: 0 };
  PLAYERS.forEach((p) => {
    const g = goalsByPlayer[p.id] || { ...DEFAULT_GOALS };
    squadStatusCounts[getPlayerTodayStatus(p.id, g.kcalGoal, g.waterGoal)] += 1;
  });
  const loggedTodayCount = PLAYERS.length - squadStatusCounts.gray;

  // The to-do list: concrete, prioritized reasons to talk to a specific
  // player today, instead of stats a coach has to interpret themselves.
  const todoItems = [];
  PLAYERS.forEach((p) => {
    const g = goalsByPlayer[p.id] || { ...DEFAULT_GOALS };

    if (p.lastLoggedDaysAgo >= 3) {
      const firstName = p.name.split(" ")[0];
      todoItems.push({
        id: `logging:${p.id}`,
        type: "logging",
        playerId: p.id,
        priority: 100 + p.lastLoggedDaysAgo,
        text:
          lang === "en"
            ? `${p.name} hasn't logged in ${p.lastLoggedDaysAgo} days — talk to ${firstName} before training.`
            : `${p.name} har ikke logget på ${p.lastLoggedDaysAgo} dager — snakk med ${firstName} før økt.`,
      });
    }

    const weightAlert = detectWeightAlert(measurementsByPlayer[p.id] || []);
    if (weightAlert) {
      todoItems.push({
        id: `weight:${p.id}`,
        type: "weight",
        playerId: p.id,
        priority: 90 + Math.abs(weightAlert.diff),
        text:
          lang === "en"
            ? `${p.name} has ${weightAlert.diff < 0 ? "lost" : "gained"} ${Math.abs(weightAlert.diff)} kg over ${weightAlert.days} days — worth checking in.`
            : `${p.name} har ${weightAlert.diff < 0 ? "mistet" : "lagt på seg"} ${Math.abs(weightAlert.diff)} kg på ${weightAlert.days} dager — verdt å sjekke inn.`,
      });
    }

    const redCount = getRecentRedCount(p.id, g.kcalGoal, g.waterGoal);
    if (redCount >= 4) {
      todoItems.push({
        id: `nutrition:${p.id}`,
        type: "nutrition",
        playerId: p.id,
        priority: 70 + redCount,
        text:
          lang === "en"
            ? `${p.name} has been far from the nutrition goal on ${redCount} of the last 7 days — consider raising it with the nutritionist.`
            : `${p.name} har vært langt fra ernæringsmålet ${redCount} av siste 7 dager — vurder å ta det opp med ernæringsfysiolog.`,
      });
    }
  });
  const visibleTodoItems = todoItems.filter((item) => !dismissedTodos.has(item.id));
  visibleTodoItems.sort((a, b) => b.priority - a.priority);

  const TODO_ICONS = { logging: Clock, weight: TrendingDown, nutrition: AlertTriangle };

  const filtered = PLAYERS.filter((p) => p.name.toLowerCase().includes(query.toLowerCase()));

  const sorted = [...filtered].sort((a, b) => {
    if (sortMode === "name") return a.name.localeCompare(b.name, "no");
    if (sortMode === "recent") return a.lastLoggedDaysAgo - b.lastLoggedDaysAgo;
    // "attention": worst last-logged first, ties broken by name
    return b.lastLoggedDaysAgo - a.lastLoggedDaysAgo || a.name.localeCompare(b.name, "no");
  });

  return (
    <div>
      <h1 className={cx("text-2xl font-bold text-slate-900 dark:text-white mb-1", isDark)}>{t("playersHeading")}</h1>
      <p className={cx("text-sm text-slate-400 dark:text-slate-500 mb-6", isDark)}>{t("playersSubtitle", PLAYERS.length)}</p>

      {/* To-do list — the first thing a coach should read, before any stats */}
      <Card className="p-5 mb-6">
        <h2 className={cx("text-sm font-bold text-slate-900 dark:text-white mb-3", isDark)}>{t("todoHeading")}</h2>
        {visibleTodoItems.length === 0 ? (
          <p className={cx("text-sm text-slate-500 dark:text-slate-400", isDark)}>{t("todoEmpty")}</p>
        ) : (
          <div className="space-y-2">
            {visibleTodoItems.map((item) => {
              const Icon = TODO_ICONS[item.type];
              return (
                <div
                  key={item.id}
                  className={cx(
                    "w-full flex items-center gap-3 px-3.5 py-3 rounded-xl bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 transition",
                    isDark
                  )}
                >
                  <button onClick={() => onSelectPlayer(item.playerId)} className="flex items-start gap-3 text-left flex-1 min-w-0">
                    <Icon size={16} className="text-amber-500 shrink-0 mt-0.5" />
                    <span className={cx("text-sm text-slate-700 dark:text-slate-200", isDark)}>{item.text}</span>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCheckTodo(item.id);
                    }}
                    title={t("markDone")}
                    className={cx(
                      `shrink-0 w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors ${
                        checkingIds.has(item.id)
                          ? "bg-emerald-500 border-emerald-500"
                          : "bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-600 hover:border-emerald-400"
                      }`,
                      isDark
                    )}
                  >
                    {checkingIds.has(item.id) && <Check size={12} className="text-white" />}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Squad-level overview */}
      <Card className="p-5 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p className={cx("text-xs text-slate-400 dark:text-slate-500 mb-1", isDark)}>{t("todayLabel")}</p>
            <p className={cx("text-2xl font-bold text-slate-900 dark:text-white", isDark)}>
              {loggedTodayCount} {lang === "en" ? "of" : "av"} {PLAYERS.length}{" "}
              <span className={cx("text-sm font-medium text-slate-400 dark:text-slate-500", isDark)}>{t("loggedFoodSuffix")}</span>
            </p>
          </div>
          <div className="flex gap-5">
            {STATUS_ORDER.map((key) => (
              <div key={key} className="text-center">
                <p className="text-lg font-bold" style={{ color: STATUS_COLORS[key] }}>
                  {squadStatusCounts[key]}
                </p>
                <p className={cx("text-xs text-slate-400 dark:text-slate-500", isDark)}>{statusLabel(key, lang)}</p>
              </div>
            ))}
          </div>
        </div>
        <div className={cx("w-full h-2 rounded-full overflow-hidden flex mt-4 bg-slate-100 dark:bg-slate-950", isDark)}>
          {STATUS_ORDER.map((key) => (
            <div
              key={key}
              style={{
                width: `${(squadStatusCounts[key] / PLAYERS.length) * 100}%`,
                backgroundColor: STATUS_COLORS[key],
              }}
            />
          ))}
        </div>
      </Card>

      <div className="flex flex-col gap-3 mb-4">
        <div className={cx("flex items-center gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 max-w-sm", isDark)}>
          <Search size={16} className={cx("text-slate-400 dark:text-slate-500", isDark)} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("searchPlaceholder")}
            className={cx("bg-transparent outline-none text-sm flex-1 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500", isDark)}
          />
        </div>
        <div className="flex items-center gap-2">
          <span className={cx("text-xs text-slate-400 dark:text-slate-500", isDark)}>{t("sortByLabel")}</span>
          {SORT_OPTIONS.map((o) => (
            <button
              key={o.key}
              onClick={() => setSortMode(o.key)}
              className={cx(`px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
                sortMode === o.key
                  ? "bg-slate-800 border-slate-800 text-white"
                  : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400"
              }`, isDark)}
            >
              {o.label[lang]}
            </button>
          ))}
        </div>
      </div>

      <Card className={cx("divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden", isDark)}>
        {sorted.map((p) => {
          const avatarIndex = PLAYERS.findIndex((pl) => pl.id === p.id);
          const loggedToday = p.lastLoggedDaysAgo === 0;
          return (
            <button
              key={p.id}
              onClick={() => onSelectPlayer(p.id)}
              className={cx("w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50 dark:hover:bg-slate-800 transition", isDark)}
            >
              <div className="flex items-center gap-3.5">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold ${
                    AVATAR_TONES[avatarIndex % AVATAR_TONES.length]
                  }`}
                >
                  {p.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")}
                </div>
                <div className="text-left">
                  <p className={cx("text-sm font-medium text-slate-800 dark:text-slate-200", isDark)}>{p.name}</p>
                  <p className={cx("text-xs text-slate-400 dark:text-slate-500", isDark)}>
                    {p.team} · {positionLabel(p.position, lang)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span
                  className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                    loggedToday ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
                  }`}
                >
                  {loggedToday ? t("loggedTodayPill") : t("lastLoggedPill", p.lastLoggedDaysAgo)}
                </span>
                <ChevronRightIcon size={16} className={cx("text-slate-300 dark:text-slate-600", isDark)} />
              </div>
            </button>
          );
        })}
        {sorted.length === 0 && <p className={cx("text-center text-sm text-slate-400 dark:text-slate-500 py-8", isDark)}>{t("noPlayersFound")}</p>}
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Month calendar — same behavior as the player app's, styled as a popover
// for desktop instead of a full-width panel.
// ---------------------------------------------------------------------------

function MonthCalendar({ viewMonth, onPrevMonth, onNextMonth, selectedDate, onSelectDate, getDayStatus }) {
  const isDark = useIsDark();
  const lang = useLang();
  const t = useT();
  const canGoNextMonth = !isSameMonth(viewMonth, TODAY);
  const firstOfMonth = startOfMonth(viewMonth);
  const firstWeekday = (firstOfMonth.getDay() + 6) % 7;
  const daysInMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 0).getDate();

  const cells = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(viewMonth.getFullYear(), viewMonth.getMonth(), d));

  return (
    <div className={cx("absolute top-full mt-2 left-1/2 -translate-x-1/2 w-96 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-lg z-20 p-4", isDark)}>
      <div className="flex items-center justify-between px-1 pb-3">
        <button onClick={onPrevMonth} className={cx("w-7 h-7 flex items-center justify-center text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-md", isDark)}>
          <ChevronLeft size={16} />
        </button>
        <span className={cx("text-sm font-semibold text-slate-900 dark:text-white", isDark)}>{formatMonthYear(viewMonth, lang)}</span>
        <button
          onClick={onNextMonth}
          disabled={!canGoNextMonth}
          className={cx(`w-7 h-7 flex items-center justify-center rounded-md ${
            canGoNextMonth ? "text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800" : "text-transparent pointer-events-none"
          }`, isDark)}
        >
          <ChevronRight size={16} />
        </button>
      </div>
      <div className="grid grid-cols-7">
        {(lang === "en" ? ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"] : ["Ma", "Ti", "On", "To", "Fr", "Lø", "Sø"]).map((w) => (
          <span key={w} className={cx("text-xs text-slate-400 dark:text-slate-500 text-center py-1", isDark)}>
            {w}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-y-2">
        {cells.map((date, i) => {
          if (!date) return <div key={i} />;
          const iso = toISODate(date);
          const future = date > TODAY;
          const isSelected = iso === toISODate(selectedDate);
          const isToday = iso === TODAY_ISO;
          const status = !future ? getDayStatus(date) : null;
          return (
            <button
              key={i}
              disabled={future}
              onClick={() => onSelectDate(date)}
              className="flex flex-col items-center gap-0.5 py-0.5"
            >
              <span
                className={cx(`w-9 h-9 rounded-full text-xs flex items-center justify-center ${
                  future
                    ? "text-slate-300 dark:text-slate-600"
                    : isSelected
                    ? "bg-indigo-600 text-white font-semibold"
                    : isToday
                    ? "text-indigo-600 font-semibold"
                    : "text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                }`, isDark)}
              >
                {date.getDate()}
              </span>
              {status && (
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: STATUS_COLORS[status] }}
                />
              )}
            </button>
          );
        })}
      </div>
      <div className={cx("flex items-center justify-center gap-4 mt-3 pt-3 border-t border-slate-100 dark:border-slate-800", isDark)}>
        {STATUS_ORDER.map((key) => (
          <div key={key} className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: STATUS_COLORS[key] }} />
            <span className={cx("text-xs text-slate-500 dark:text-slate-400", isDark)}>{statusLabel(key, lang)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Player dashboard
// ---------------------------------------------------------------------------

function PlayerDashboard({
  player,
  onBack,
  measurements,
  setMeasurements,
  notes,
  setNotes,
  allergies,
  setAllergies,
  goals,
  setGoals,
}) {
  const isDark = useIsDark();
  const lang = useLang();
  const t = useT();
  const [selectedDate, setSelectedDate] = useState(TODAY);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(startOfMonth(TODAY));
  const [newWeight, setNewWeight] = useState("");
  const [newHeight, setNewHeight] = useState("");
  const [newDate, setNewDate] = useState(TODAY_ISO);
  const [noteText, setNoteText] = useState("");
  const [allergyText, setAllergyText] = useState("");
  const [goalsOpen, setGoalsOpen] = useState(false);

  const selectedDateIso = toISODate(selectedDate);
  const dayMeals = selectedDateIso === TODAY_ISO ? TODAY_MEALS[player.id] || [] : [];
  const dayWater = selectedDateIso === TODAY_ISO ? TODAY_WATER[player.id] || 0 : 0;
  const dayTotals = dayMeals.reduce(
    (acc, m) => {
      const t = mealTotals(m.itemsDetailed);
      return {
        kcal: acc.kcal + t.kcal,
        protein: acc.protein + t.protein,
        carbs: acc.carbs + t.carbs,
        fat: acc.fat + t.fat,
      };
    },
    { kcal: 0, protein: 0, carbs: 0, fat: 0 }
  );
  const canGoNext = selectedDateIso !== TODAY_ISO;

  // Today's status is computed live from the real mock data; other days
  // come from the generated history (or "gray" if truly nothing on record).
  const todayMealsList = TODAY_MEALS[player.id] || [];
  const todayKcalTotal = todayMealsList.reduce((s, m) => s + mealTotals(m.itemsDetailed).kcal, 0);
  const todayWaterVal = TODAY_WATER[player.id] || 0;

  const getDayStatus = (date) => {
    if (date > TODAY) return null;
    const iso = toISODate(date);
    if (iso === TODAY_ISO) return computeStatus(todayKcalTotal, todayWaterVal, goals.kcalGoal, goals.waterGoal);
    return STATUS_HISTORY[player.id]?.[iso] || "gray";
  };

  const pieCounts = { gray: 0, red: 0, orange: 0, green: 0 };
  for (let d = 0; d < 30; d++) {
    pieCounts[getDayStatus(addDays(TODAY, -d))] += 1;
  }
  const pieData = STATUS_ORDER.map((key) => ({
    key,
    name: statusLabel(key, lang),
    value: pieCounts[key],
  }));

  const weightAlert = detectWeightAlert(measurements);

  const addMeasurement = () => {
    if (!newWeight && !newHeight) return;
    setMeasurements((prev) => {
      const existingIdx = prev.findIndex((m) => m.date === newDate);
      const entry = {
        date: newDate,
        weightKg: newWeight ? Number(newWeight) : existingIdx >= 0 ? prev[existingIdx].weightKg : undefined,
        heightCm: newHeight ? Number(newHeight) : existingIdx >= 0 ? prev[existingIdx].heightCm : undefined,
      };
      const next = existingIdx >= 0 ? prev.map((m, i) => (i === existingIdx ? entry : m)) : [...prev, entry];
      return next.sort((a, b) => (a.date < b.date ? -1 : 1));
    });
    setNewWeight("");
    setNewHeight("");
  };

  const isExistingDate = measurements.some((m) => m.date === newDate);

  const loadMeasurementIntoForm = (m) => {
    setNewDate(m.date);
    setNewWeight(m.weightKg != null ? String(m.weightKg) : "");
    setNewHeight(m.heightCm != null ? String(m.heightCm) : "");
  };

  const deleteMeasurement = (date) => {
    setMeasurements((prev) => prev.filter((m) => m.date !== date));
    if (date === newDate) {
      setNewWeight("");
      setNewHeight("");
    }
  };

  const addNote = () => {
    if (!noteText.trim()) return;
    setNotes((prev) => [{ id: `n-${Date.now()}`, date: TODAY_ISO, text: noteText.trim() }, ...prev]);
    setNoteText("");
  };

  const removeNote = (id) => setNotes((prev) => prev.filter((n) => n.id !== id));

  const addAllergy = () => {
    if (!allergyText.trim()) return;
    setAllergies((prev) => [...prev, allergyText.trim()]);
    setAllergyText("");
  };

  const removeAllergy = (index) => setAllergies((prev) => prev.filter((_, i) => i !== index));

  return (
    <div>
      <button
        onClick={onBack}
        className={cx("flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 mb-5", isDark)}
      >
        <ArrowLeft size={16} /> {t("backToList")}
      </button>

      <div className="flex items-center gap-4 mb-6">
        <div className={cx("w-14 h-14 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-400", isDark)}>
          <User size={24} />
        </div>
        <div>
          <h1 className={cx("text-xl font-bold text-slate-900 dark:text-white", isDark)}>{player.name}</h1>
          <p className={cx("text-sm text-slate-400 dark:text-slate-500", isDark)}>
            {player.team} · {positionLabel(player.position, lang)}
          </p>
        </div>
      </div>

      {/* Critical info: allergies / dietary restrictions */}
      <Card className="p-5 mb-6">
        <h3 className={cx("text-sm font-bold text-slate-900 dark:text-white mb-3 flex items-center gap-1.5", isDark)}>
          <AlertTriangle size={15} className={cx("text-slate-400 dark:text-slate-500", isDark)} /> {t("criticalInfoHeading")}
        </h3>
        <div className="flex flex-wrap gap-2 mb-3">
          {allergies.length === 0 && (
            <p className={cx("text-xs text-slate-500 dark:text-slate-400", isDark)}>{t("noAllergies")}</p>
          )}
          {allergies.map((a, i) => (
            <span
              key={i}
              className={cx("inline-flex items-center gap-1.5 bg-slate-100 dark:bg-slate-950 text-slate-700 dark:text-slate-300 text-xs font-medium px-3 py-1.5 rounded-full", isDark)}
            >
              {allergyLabel(a, lang)}
              <button onClick={() => removeAllergy(i)} className={cx("text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200", isDark)}>
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            value={allergyText}
            onChange={(e) => setAllergyText(e.target.value)}
            placeholder={t("addAllergyPlaceholder")}
            className={cx("flex-1 bg-slate-100 dark:bg-slate-950 rounded-lg px-3 py-2 text-sm outline-none", isDark)}
            onKeyDown={(e) => e.key === "Enter" && addAllergy()}
          />
          <button onClick={addAllergy} className="bg-indigo-600 text-white rounded-lg px-3.5 text-sm font-medium">
            {t("addLabel")}
          </button>
        </div>
      </Card>

      {/* Dagsoversikt + goal status side by side */}
      <div className="grid grid-cols-3 gap-6 mb-6 items-start">
        {/* Dagsoversikt */}
        <Card className="p-5 col-span-2">
          <div className="flex items-center justify-center gap-3 mb-4 relative">
            <button
              onClick={() => {
                const d = addDays(selectedDate, -1);
                setSelectedDate(d);
              setCalendarMonth(startOfMonth(d));
            }}
            className={cx("w-8 h-8 flex items-center justify-center text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg", isDark)}
          >
            <ChevronLeft size={18} />
          </button>

          <button
            onClick={() => setCalendarOpen((o) => !o)}
            className={cx("flex items-center gap-1 px-2 py-1 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg", isDark)}
          >
            <h2 className={cx("text-sm font-semibold text-slate-900 dark:text-white", isDark)}>{formatDayDate(selectedDate, lang)}</h2>
            <ChevronDown size={14} className={cx(`text-slate-400 dark:text-slate-500 transition-transform ${calendarOpen ? "rotate-180" : ""}`, isDark)} />
          </button>

          <button
            onClick={() => {
              if (!canGoNext) return;
              const d = addDays(selectedDate, 1);
              setSelectedDate(d);
              setCalendarMonth(startOfMonth(d));
            }}
            disabled={!canGoNext}
            className={cx(`w-8 h-8 flex items-center justify-center rounded-lg ${
              canGoNext ? "text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800" : "text-transparent pointer-events-none"
            }`, isDark)}
          >
            <ChevronRight size={18} />
          </button>

          {calendarOpen && (
            <MonthCalendar
              viewMonth={calendarMonth}
              onPrevMonth={() => setCalendarMonth((m) => addMonths(m, -1))}
              onNextMonth={() => setCalendarMonth((m) => (isSameMonth(m, TODAY) ? m : addMonths(m, 1)))}
              selectedDate={selectedDate}
              getDayStatus={getDayStatus}
              onSelectDate={(date) => {
                setSelectedDate(date);
                setCalendarMonth(startOfMonth(date));
                setCalendarOpen(false);
              }}
            />
          )}
        </div>

        <NutritionStatGrid totals={dayTotals} lang={lang} />

        <div className={cx("mt-5 pt-4 border-t border-slate-100 dark:border-slate-800", isDark)}>
          <span className={cx("text-xs font-medium text-slate-500 dark:text-slate-400 mb-2.5 block", isDark)}>{t("towardGoalsHeading")}</span>
          <GoalProgressGrid totals={dayTotals} goals={goals} lang={lang} />
        </div>

        <div className={cx("mt-5 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between", isDark)}>
          <div className="flex items-center gap-2">
            <Droplet size={16} className="text-blue-500" />
            <span className={cx("text-sm font-medium text-slate-700 dark:text-slate-300", isDark)}>
              {dayWater}/{goals.waterGoal} ml
            </span>
          </div>
          <GlassRow water={dayWater} size={16} />
        </div>

        <div className={cx("mt-5 pt-4 border-t border-slate-100 dark:border-slate-800", isDark)}>
          {dayMeals.length === 0 ? (
            <p className={cx("text-sm text-slate-400 dark:text-slate-500", isDark)}>{t("noMealsThisDay")}</p>
          ) : (
            <div className="space-y-2">
              {dayMeals.map((m) => {
                const t = mealTotals(m.itemsDetailed);
                return (
                  <div key={m.id} className="flex items-center justify-between">
                    <div>
                      <p className={cx("text-sm font-medium text-slate-800 dark:text-slate-200", isDark)}>
                        {mealTitleLabel(m.title, lang)} <span className={cx("text-slate-400 dark:text-slate-500 font-normal", isDark)}>· {m.time}</span>
                      </p>
                      <p className={cx("text-xs text-slate-400 dark:text-slate-500", isDark)}>
                        {m.itemsDetailed.map((it) => foodNameLabel(foodById(it.foodId).name, lang)).join(", ")}
                      </p>
                    </div>
                    <span className={cx("text-sm font-semibold text-slate-700 dark:text-slate-300", isDark)}>{t.kcal} kcal</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Card>

      {/* Goal status pie chart */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className={cx("text-sm font-bold text-slate-900 dark:text-white", isDark)}>{t("goalStatusHeading")}</h3>
          <button
            onClick={() => setGoalsOpen((o) => !o)}
            className={cx("flex items-center gap-1 text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white", isDark)}
          >
            <SlidersHorizontal size={13} /> {t("adjustGoals")}
          </button>
        </div>

        {goalsOpen && (
          <div className={cx("bg-slate-50 dark:bg-slate-800 rounded-xl p-3.5 mb-4 space-y-3", isDark)}>
            <p className={cx("text-xs text-slate-500 dark:text-slate-400", isDark)}>
              {t("manualAdjustmentNote")}
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <label className="block">
                <span className={cx("text-xs text-slate-500 dark:text-slate-400 mb-1 block", isDark)}>{t("kcalGoalLabel")}</span>
                <input
                  type="number"
                  value={goals.kcalGoal}
                  onChange={(e) => setGoals((g) => ({ ...g, kcalGoal: Number(e.target.value) || 0 }))}
                  className={cx("w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm outline-none", isDark)}
                />
              </label>
              <label className="block">
                <span className={cx("text-xs text-slate-500 dark:text-slate-400 mb-1 block", isDark)}>{t("proteinGoalLabel")}</span>
                <input
                  type="number"
                  value={goals.proteinGoal}
                  onChange={(e) => setGoals((g) => ({ ...g, proteinGoal: Number(e.target.value) || 0 }))}
                  className={cx("w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm outline-none", isDark)}
                />
              </label>
              <label className="block">
                <span className={cx("text-xs text-slate-500 dark:text-slate-400 mb-1 block", isDark)}>{t("carbsGoalLabel")}</span>
                <input
                  type="number"
                  value={goals.carbsGoal}
                  onChange={(e) => setGoals((g) => ({ ...g, carbsGoal: Number(e.target.value) || 0 }))}
                  className={cx("w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm outline-none", isDark)}
                />
              </label>
              <label className="block">
                <span className={cx("text-xs text-slate-500 dark:text-slate-400 mb-1 block", isDark)}>{t("fatGoalLabel")}</span>
                <input
                  type="number"
                  value={goals.fatGoal}
                  onChange={(e) => setGoals((g) => ({ ...g, fatGoal: Number(e.target.value) || 0 }))}
                  className={cx("w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm outline-none", isDark)}
                />
              </label>
              <label className="block">
                <span className={cx("text-xs text-slate-500 dark:text-slate-400 mb-1 block", isDark)}>{t("waterGoalLabel")}</span>
                <input
                  type="number"
                  value={goals.waterGoal}
                  onChange={(e) => setGoals((g) => ({ ...g, waterGoal: Number(e.target.value) || 0 }))}
                  className={cx("w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm outline-none", isDark)}
                />
              </label>
            </div>
          </div>
        )}

        <div className="flex flex-col items-center gap-4">
          <ResponsiveContainer width={160} height={160}>
            <PieChart>
              <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={40} outerRadius={70} paddingAngle={2}>
                {pieData.map((d) => (
                  <Cell key={d.key} fill={STATUS_COLORS[d.key]} />
                ))}
              </Pie>
              <Tooltip formatter={(v, n) => [`${v} dager`, n]} />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-2.5 w-full">
            {STATUS_ORDER.map((key) => (
              <div key={key} className="flex items-start gap-2.5">
                <span
                  className="w-2.5 h-2.5 rounded-full mt-1 shrink-0"
                  style={{ backgroundColor: STATUS_COLORS[key] }}
                />
                <p className={cx("text-xs text-slate-600 dark:text-slate-300", isDark)}>
                  <span className={cx("font-semibold text-slate-800 dark:text-slate-200", isDark)}>
                    {statusLabel(key, lang)} ({pieCounts[key]}d)
                  </span>{" "}
                  — {statusExplanation(key, lang)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </Card>
      </div>

      {/* Graphs */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <Card className="p-5">
          <h3 className={cx("text-sm font-bold text-slate-900 dark:text-white mb-3", isDark)}>{t("weightChartHeading")}</h3>
          {weightAlert && (
            <div
              className={cx(
                "flex items-start gap-2 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2.5 mb-3",
                isDark
              )}
            >
              <TrendingDown size={15} className={cx("text-amber-600 dark:text-amber-400 shrink-0 mt-0.5", isDark)} />
              <p className={cx("text-xs text-amber-800 dark:text-amber-200", isDark)}>
                {t("weightAlertText", weightAlert.diff, weightAlert.days)}
              </p>
            </div>
          )}
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={measurements}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis dataKey="date" tickFormatter={(v) => formatShortDate(v, lang)} tick={{ fontSize: 11, fill: "#94A3B8" }} />
              <YAxis tick={{ fontSize: 11, fill: "#94A3B8" }} domain={["auto", "auto"]} unit=" kg" />
              <Tooltip labelFormatter={(v) => formatShortDate(v, lang)} formatter={(v) => [`${v} kg`, lang === "en" ? "Weight" : "Vekt"]} />
              <Line type="monotone" dataKey="weightKg" stroke="#4F46E5" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-5">
          <h3 className={cx("text-sm font-bold text-slate-900 dark:text-white mb-3", isDark)}>{t("heightChartHeading")}</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={measurements}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis dataKey="date" tickFormatter={(v) => formatShortDate(v, lang)} tick={{ fontSize: 11, fill: "#94A3B8" }} />
              <YAxis tick={{ fontSize: 11, fill: "#94A3B8" }} domain={["auto", "auto"]} unit=" cm" />
              <Tooltip labelFormatter={(v) => formatShortDate(v, lang)} formatter={(v) => [`${v} cm`, lang === "en" ? "Height" : "Høyde"]} />
              <Line type="monotone" dataKey="heightCm" stroke="#0EA5E9" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Add measurement + Notes */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="p-5">
          <h3 className={cx("text-sm font-bold text-slate-900 dark:text-white mb-3", isDark)}>{t("addMeasurementHeading")}</h3>
          <div className="space-y-3">
            <label className="block">
              <span className={cx("text-xs text-slate-500 dark:text-slate-400 mb-1 block", isDark)}>{t("dateLabel")}</span>
              <input
                type="date"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
                className={cx("w-full bg-slate-100 dark:bg-slate-950 rounded-lg px-3 py-2 text-sm outline-none", isDark)}
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className={cx("text-xs text-slate-500 dark:text-slate-400 mb-1 block", isDark)}>{t("weightKgLabel")}</span>
                <input
                  value={newWeight}
                  onChange={(e) => setNewWeight(e.target.value)}
                  placeholder="—"
                  className={cx("w-full bg-slate-100 dark:bg-slate-950 rounded-lg px-3 py-2 text-sm outline-none", isDark)}
                />
              </label>
              <label className="block">
                <span className={cx("text-xs text-slate-500 dark:text-slate-400 mb-1 block", isDark)}>{t("heightCmLabel")}</span>
                <input
                  value={newHeight}
                  onChange={(e) => setNewHeight(e.target.value)}
                  placeholder="—"
                  className={cx("w-full bg-slate-100 dark:bg-slate-950 rounded-lg px-3 py-2 text-sm outline-none", isDark)}
                />
              </label>
            </div>
            <button
              onClick={addMeasurement}
              className="w-full bg-indigo-600 text-white rounded-lg py-2.5 text-sm font-medium flex items-center justify-center gap-1.5"
            >
              <Plus size={15} /> {isExistingDate ? t("updateMeasurement") : t("addMeasurement")}
            </button>
          </div>

          <div className={cx("mt-5 pt-4 border-t border-slate-100 dark:border-slate-800", isDark)}>
            <span className={cx("text-xs font-medium text-slate-500 dark:text-slate-400 mb-2 block", isDark)}>{t("measurementHistoryHeading")}</span>
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {[...measurements]
                .sort((a, b) => (a.date < b.date ? 1 : -1))
                .map((m) => (
                  <div key={m.date} className={cx("flex items-center justify-between bg-slate-50 dark:bg-slate-800 rounded-lg px-3 py-2", isDark)}>
                    <div>
                      <p className={cx("text-xs text-slate-400 dark:text-slate-500", isDark)}>{formatShortDate(m.date, lang)}</p>
                      <p className={cx("text-sm text-slate-700 dark:text-slate-300", isDark)}>
                        {m.weightKg != null ? `${m.weightKg} kg` : "—"} · {m.heightCm != null ? `${m.heightCm} cm` : "—"}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => loadMeasurementIntoForm(m)}
                        className={cx("text-slate-400 dark:text-slate-500 hover:text-indigo-600 p-1", isDark)}
                      >
                        <Edit3 size={13} />
                      </button>
                      <button
                        onClick={() => deleteMeasurement(m.date)}
                        className={cx("text-slate-300 dark:text-slate-600 hover:text-red-500 p-1", isDark)}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              {measurements.length === 0 && <p className={cx("text-xs text-slate-400 dark:text-slate-500", isDark)}>{t("noMeasurements")}</p>}
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <h3 className={cx("text-sm font-bold text-slate-900 dark:text-white mb-3 flex items-center gap-1.5", isDark)}>
            <NotebookPen size={15} className={cx("text-slate-400 dark:text-slate-500", isDark)} /> {t("notesHeading")}
          </h3>
          <div className="flex gap-2 mb-3">
            <input
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder={t("notePlaceholder")}
              className={cx("flex-1 bg-slate-100 dark:bg-slate-950 rounded-lg px-3 py-2 text-sm outline-none", isDark)}
              onKeyDown={(e) => e.key === "Enter" && addNote()}
            />
            <button onClick={addNote} className="bg-indigo-600 text-white rounded-lg px-3.5 text-sm font-medium">
              {t("addLabel")}
            </button>
          </div>
          <div className="space-y-2 max-h-52 overflow-y-auto">
            {notes.length === 0 && <p className={cx("text-xs text-slate-400 dark:text-slate-500", isDark)}>{t("noNotes")}</p>}
            {notes.map((n) => (
              <div key={n.id} className={cx("bg-slate-50 dark:bg-slate-800 rounded-lg px-3 py-2 flex items-start justify-between gap-2", isDark)}>
                <div>
                  <p className={cx("text-xs text-slate-400 dark:text-slate-500 mb-0.5", isDark)}>{formatShortDate(n.date, lang)}</p>
                  <p className={cx("text-sm text-slate-700 dark:text-slate-300", isDark)}>{n.text}</p>
                </div>
                <button onClick={() => removeNote(n.id)} className={cx("text-slate-300 dark:text-slate-600 hover:text-red-500 shrink-0", isDark)}>
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Root app
// ---------------------------------------------------------------------------

export default function App() {
  const [selectedPlayerId, setSelectedPlayerId] = useState(null);
  const [measurementsByPlayer, setMeasurementsByPlayer] = useState(INITIAL_MEASUREMENTS);
  const [notesByPlayer, setNotesByPlayer] = useState(INITIAL_NOTES);
  const [allergiesByPlayer, setAllergiesByPlayer] = useState(INITIAL_ALLERGIES);
  const [goalsByPlayer, setGoalsByPlayer] = useState(INITIAL_GOALS);
  const [dismissedTodos, setDismissedTodos] = useState(new Set());
  const [isDark, setIsDark] = useState(false);
  const [lang, setLang] = useState("no");
  const t = (key, ...args) => translate(lang, key, ...args);

  const player = PLAYERS.find((p) => p.id === selectedPlayerId) || null;

  return (
    <LanguageContext.Provider value={lang}>
    <ThemeContext.Provider value={isDark}>
    <div className={cx("min-h-screen w-full bg-slate-100 dark:bg-slate-950 font-sans", isDark)}>
      <div className={cx("border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-8 py-4 flex items-center justify-between", isDark)}>
        <span className={cx("text-sm font-bold text-slate-900 dark:text-white tracking-tight", isDark)}>{t("appTitle")}</span>
        <div className="flex items-center gap-3">
          <span className={cx("text-xs text-slate-400 dark:text-slate-500", isDark)}>{t("coachLabel")}</span>
          <button
            onClick={() => setLang((l) => (l === "no" ? "en" : "no"))}
            title={lang === "no" ? "Switch to English" : "Bytt til norsk"}
            className={cx(
              "px-2.5 h-8 rounded-full flex items-center justify-center text-xs font-semibold text-slate-500 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition",
              isDark
            )}
          >
            {lang === "no" ? "EN" : "NO"}
          </button>
          <button
            onClick={() => setIsDark((d) => !d)}
            title={isDark ? t("toggleDarkOn") : t("toggleDarkOff")}
            className={cx("w-8 h-8 rounded-full flex items-center justify-center text-slate-500 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition", isDark)}
          >
            {isDark ? <Sun size={15} /> : <Moon size={15} />}
          </button>
        </div>
      </div>

      <div className="w-full px-8 py-8">
        {player ? (
          <PlayerDashboard
            player={player}
            onBack={() => setSelectedPlayerId(null)}
            measurements={measurementsByPlayer[player.id] || []}
            setMeasurements={(updater) =>
              setMeasurementsByPlayer((prev) => ({
                ...prev,
                [player.id]: typeof updater === "function" ? updater(prev[player.id] || []) : updater,
              }))
            }
            notes={notesByPlayer[player.id] || []}
            setNotes={(updater) =>
              setNotesByPlayer((prev) => ({
                ...prev,
                [player.id]: typeof updater === "function" ? updater(prev[player.id] || []) : updater,
              }))
            }
            allergies={allergiesByPlayer[player.id] || []}
            setAllergies={(updater) =>
              setAllergiesByPlayer((prev) => ({
                ...prev,
                [player.id]: typeof updater === "function" ? updater(prev[player.id] || []) : updater,
              }))
            }
            goals={goalsByPlayer[player.id] || { ...DEFAULT_GOALS }}
            setGoals={(updater) =>
              setGoalsByPlayer((prev) => ({
                ...prev,
                [player.id]:
                  typeof updater === "function"
                    ? updater(prev[player.id] || { ...DEFAULT_GOALS })
                    : updater,
              }))
            }
          />
        ) : (
          <PlayerList
            onSelectPlayer={setSelectedPlayerId}
            goalsByPlayer={goalsByPlayer}
            measurementsByPlayer={measurementsByPlayer}
            dismissedTodos={dismissedTodos}
            onDismissTodo={(id) => setDismissedTodos((prev) => new Set(prev).add(id))}
          />
        )}
      </div>
    </div>
    </ThemeContext.Provider>
    </LanguageContext.Provider>
  );
}
