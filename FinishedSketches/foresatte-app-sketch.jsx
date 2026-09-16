import { useState, useId, createContext, useContext } from "react";
import {
  Camera,
  Search,
  Droplet,
  User,
  Plus,
  Minus,
  Check,
  X,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  Trash2,
  ArrowLeft,
  Loader2,
  Image as ImageIcon,
  Utensils,
  Calendar,
  MoreHorizontal,
  Edit3,
  Users,
  Sun,
  Moon,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Dark mode + language — JS-driven (Tailwind's dark: variant follows OS
// preference in this environment, not a manual toggle, so this is resolved
// at render time instead via a small helper).
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

const LanguageContext = createContext("no");
function useLang() {
  return useContext(LanguageContext);
}

const TEXT = {
  sketchLabel: { no: "Skisse · ingen backend", en: "Sketch · no backend" },
  toggleDarkOn: { no: "Slå av mørk modus", en: "Turn off dark mode" },
  toggleDarkOff: { no: "Slå på mørk modus", en: "Turn on dark mode" },
  loginHeading: { no: "Logg inn", en: "Log in" },
  loginSubtitle: { no: "Fyll inn relevant innloggingsdata for å fortsette", en: "Fill in your login details to continue" },
  emailPlaceholder: { no: "E-post", en: "Email" },
  passwordPlaceholder: { no: "Passord", en: "Password" },
  loginButton: { no: "Logg inn", en: "Log in" },
  skipLogin: { no: "Fortsett uten innlogging (kun for denne skissen)", en: "Continue without logging in (this sketch only)" },
  analyzing: { no: "Analyserer", en: "Analyzing" },
  registeredFood: { no: "Registrert mat", en: "Registered food" },
  saved: { no: "Lagret", en: "Saved" },
  cameraPreview: { no: "Kamera-forhåndsvisning", en: "Camera preview" },
  privacyNote: {
    no: "Bildet sendes til gjenkjenning og lagres ikke — kun maten og næringsverdiene blir lagret.",
    en: "The photo is sent for recognition and not stored — only the food and its nutrition values are saved.",
  },
  recognizing: { no: "Kjenner igjen maten på bildet…", en: "Recognizing the food in the photo…" },
  overviewIntro: { no: "Dette fant vi i bildet. Juster mengde eller fjern varer ved behov.", en: "This is what we found in the photo. Adjust the amount or remove items if needed." },
  addedManually: { no: "Lagt til manuelt", en: "Added manually" },
  confident: { no: (n) => `${n}% sikker`, en: (n) => `${n}% confident` },
  noItemsLeft: { no: "Ingen varer igjen — legg til mat under.", en: "No items left — add food below." },
  addUndetectedFood: { no: "Legg til mat som ikke ble oppdaget", en: "Add food that wasn't detected" },
  saveMeal: { no: "Lagre måltid", en: "Save meal" },
  addFoodHeading: { no: "Legg til mat", en: "Add food" },
  searchFoodsPlaceholder: { no: "Søk i matvarer…", en: "Search foods…" },
  noMatvaretabellenHits: { no: "Ingen treff i Matvaretabellen.", en: "No matches in Matvaretabellen." },
  onePortionEquals: { no: (g) => `1 porsjon = ${g} g`, en: (g) => `1 portion = ${g} g` },
  sendingToDatabase: { no: "Data sendes til database…", en: "Sending data to database…" },
  waterRowSuffix: { no: "ml", en: "ml" },
  searchFoods: { no: "Søk i matvarer", en: "Search foods" },
  todaysOverview: { no: "Dagens oversikt", en: "Today's overview" },
  meals: { no: "Måltider", en: "Meals" },
  noMealsThisDay: { no: "Ingen måltider registrert denne dagen.", en: "No meals logged this day." },
  ok: { no: "OK", en: "OK" },
  youthPill1: { no: "Bra proteininntak i dag", en: "Good protein intake today" },
  youthPill2: { no: "Prøv å få i deg litt mer grønt", en: "Try to get a bit more veg in" },
  youthPill3: { no: "Husk å drikke vann jevnt", en: "Remember to drink water steadily" },
  imageNotStored: { no: "Bilde ikke lagret", en: "Photo not stored" },
  nutritionOverview: { no: "Næringsoversikt", en: "Nutrition overview" },
  mealItems: { no: "Måltidsvarer", en: "Meal items" },
  searchTitle: { no: "Søk i matvarer", en: "Search foods" },
  searchPlaceholder: { no: "Søk, f.eks. kylling, havregryn…", en: "Search, e.g. chicken, oats…" },
  gramsTab: { no: "Gram", en: "Grams" },
  portionTab: { no: "1 porsjon", en: "1 portion" },
  healthyChoicePill: { no: "Sunt valg til et måltid", en: "A healthy choice for a meal" },
  matvaretabellenSource: { no: "Næringsdata fra Matvaretabellen", en: "Nutrition data from Matvaretabellen" },
  waterTitle: { no: "Vann", en: "Water" },
  today: { no: "I dag", en: "Today" },
  ofGoal: { no: (g) => `av ${g} ml`, en: (g) => `of ${g} ml` },
  waterReadOnly: { no: "Kan bare registrere vann for i dag.", en: "You can only log water for today." },
  registrations: { no: "Registreringer", en: "Log" },
  noRegistrationsThisDay: { no: "Ingen registreringer denne dagen.", en: "No entries this day." },
  settingsTitle: { no: "Innstillinger", en: "Settings" },
  notifications: { no: "Varsler", en: "Notifications" },
  measurementUnit: { no: "Måleenhet", en: "Measurement unit" },
  gramUnit: { no: "Gram", en: "Grams" },
  ounceUnit: { no: "Ounce", en: "Ounces" },
  profileSettingsTitle: { no: "Profilinnstillinger", en: "Profile settings" },
  changeProfilePicture: { no: "Endre profilbilde", en: "Change profile picture" },
  weightKg: { no: "Vekt (kg)", en: "Weight (kg)" },
  heightCm: { no: "Høyde (cm)", en: "Height (cm)" },
  ageYears: { no: "Alder (år)", en: "Age (years)" },
  save: { no: "Lagre", en: "Save" },
  profileTitle: { no: "Profil", en: "Profile" },
  playerRole: { no: "Spiller", en: "Player" },
  previewAs: { no: "Forhåndsvis som", en: "Preview as" },
  previewAsNote: {
    no: "I appen settes dette automatisk ut fra fødselsdato. Bryteren her er kun for å vise begge tilstander i denne skissen.",
    en: "In the app this is set automatically from date of birth. This switch is only here to show both states in this sketch.",
  },
  adultNumbers: { no: "Voksen (tall)", en: "Adult (numbers)" },
  youthGuidance: { no: "Ung spiller (veiledning)", en: "Young player (guidance)" },
  settingsRow: { no: "Innstillinger", en: "Settings" },
  privacyNotesRow: { no: "Personvernnotater", en: "Privacy notes" },
  logOut: { no: "Logg ut", en: "Log out" },
  newMealTitle: { no: "Nytt måltid", en: "New meal" },
  guardianCardTitle: { no: "Foresatte", en: "Guardians" },
  guardianCardSubtitle: { no: "Mor og Far", en: "Mother and Father" },
  guardianScreenTitle: { no: "Foresatte", en: "Guardians" },
  guardianIntro: { no: "Registrer høyden til foresatte på spillerens profil.", en: "Register the guardians' height on the player's profile." },
  motherHeightLabel: { no: "Mor — høyde (cm)", en: "Mother — height (cm)" },
  fatherHeightLabel: { no: "Far — høyde (cm)", en: "Father — height (cm)" },
  motherPhoneLabel: { no: "Mor — telefon (nødkontakt)", en: "Mother — phone (emergency contact)" },
  fatherPhoneLabel: { no: "Far — telefon (nødkontakt)", en: "Father — phone (emergency contact)" },
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

const MEAL_TITLES = {
  Frokost: { no: "Frokost", en: "Breakfast" },
  Lunsj: { no: "Lunsj", en: "Lunch" },
  Middag: { no: "Middag", en: "Dinner" },
  "Nytt måltid": { no: "Nytt måltid", en: "New meal" },
};
function mealTitleLabel(title, lang) {
  return MEAL_TITLES[title]?.[lang] || title;
}
// Matvaretabellen (the real project's nutrition source) is Norwegian-only —
// these English labels exist purely for a clean bilingual demo here.
const FOOD_LABELS_EN = {
  "Havregryn (oats)": "Oats",
  "Kyllingfilet, stekt": "Chicken fillet, fried",
  "Laks, ovnsbakt": "Salmon, oven-baked",
  "Poteter, kokte": "Potatoes, boiled",
  "Brokkoli, kokt": "Broccoli, boiled",
  Banan: "Banana",
  "Egg, kokt": "Egg, boiled",
  Brunost: "Brown cheese",
  "Melk, lettmelk": "Milk, semi-skimmed",
  "Kjøttkaker i brun saus": "Meatballs in brown sauce",
};
function foodNameLabel(name, lang) {
  return lang === "en" ? FOOD_LABELS_EN[name] || name : name;
}

// ---------------------------------------------------------------------------
// Mock data (stands in for Supabase / Matvaretabellen / the recognizer)
// ---------------------------------------------------------------------------

const FOODS = [
  { id: "f1", name: "Havregryn (oats)", portionGrams: 40, kcal: 372, protein: 13.5, carbs: 59, fat: 7 },
  { id: "f2", name: "Kyllingfilet, stekt", portionGrams: 125, kcal: 165, protein: 31, carbs: 0, fat: 3.6 },
  { id: "f3", name: "Laks, ovnsbakt", portionGrams: 125, kcal: 208, protein: 20, carbs: 0, fat: 13 },
  { id: "f4", name: "Poteter, kokte", portionGrams: 150, kcal: 87, protein: 1.9, carbs: 20, fat: 0.1 },
  { id: "f5", name: "Brokkoli, kokt", portionGrams: 80, kcal: 35, protein: 2.4, carbs: 4, fat: 0.4 },
  { id: "f6", name: "Banan", portionGrams: 120, kcal: 89, protein: 1.1, carbs: 23, fat: 0.3 },
  { id: "f7", name: "Egg, kokt", portionGrams: 60, kcal: 155, protein: 13, carbs: 1.1, fat: 11 },
  { id: "f8", name: "Brunost", portionGrams: 20, kcal: 358, protein: 9, carbs: 30, fat: 27 },
  { id: "f9", name: "Melk, lettmelk", portionGrams: 200, kcal: 46, protein: 3.4, carbs: 4.9, fat: 1.5 },
  { id: "f10", name: "Kjøttkaker i brun saus", portionGrams: 150, kcal: 197, protein: 12, carbs: 6, fat: 14 },
];

const RECOGNIZED_MOCK = [
  { id: "r1", foodId: "f2", confidence: 0.91, grams: 150 },
  { id: "r2", foodId: "f4", confidence: 0.84, grams: 210 },
  { id: "r3", foodId: "f5", confidence: 0.77, grams: 90 },
];

// ---------------------------------------------------------------------------
// Date helpers — the app has a fixed "today" for this mockup so the sample
// data stays consistent no matter when it's opened.
// ---------------------------------------------------------------------------

function pad2(n) {
  return n.toString().padStart(2, "0");
}
function toISODate(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}
function parseISODate(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}
function isSameMonth(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}
function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}
function addMonths(date, n) {
  return new Date(date.getFullYear(), date.getMonth() + n, 1);
}
function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}
function formatDayDate(date, lang = "no") {
  const s = date.toLocaleDateString(lang === "en" ? "en-GB" : "no-NO", { weekday: "long", day: "numeric", month: "long" });
  return s.charAt(0).toUpperCase() + s.slice(1);
}
function formatMonthYear(date, lang = "no") {
  const s = date.toLocaleDateString(lang === "en" ? "en-GB" : "no-NO", { month: "long", year: "numeric" });
  return s.charAt(0).toUpperCase() + s.slice(1);
}
function formatShortDate(date, lang = "no") {
  return date.toLocaleDateString(lang === "en" ? "en-GB" : "no-NO", { day: "numeric", month: "short" });
}

const TODAY = new Date(2026, 7, 19); // Onsdag 19. august — matches the app's existing sample content
const TODAY_ISO = toISODate(TODAY);
const YESTERDAY_ISO = toISODate(addDays(TODAY, -1));
const DAY_2_ISO = toISODate(addDays(TODAY, -2));
const DAY_3_ISO = toISODate(addDays(TODAY, -3));

// A few days of sample meals so date navigation has something to show.
// Tags are {no,en} pairs since they're app-generated qualitative feedback,
// not something a person actually typed.
const MEALS_SEED = [
  {
    id: "m1",
    time: "08:10",
    date: TODAY_ISO,
    title: "Frokost",
    itemsDetailed: [
      { foodId: "f1", grams: 40 },
      { foodId: "f6", grams: 120 },
      { foodId: "f9", grams: 200 },
    ],
    tags: [
      { no: "Fin start på dagen", en: "Nice start to the day" },
      { no: "God karbo før økt", en: "Good carbs before training" },
    ],
  },
  {
    id: "m2",
    time: "07:50",
    date: YESTERDAY_ISO,
    title: "Frokost",
    itemsDetailed: [
      { foodId: "f7", grams: 120 },
      { foodId: "f1", grams: 40 },
    ],
    tags: [
      { no: "Bra proteininntak", en: "Good protein intake" },
      { no: "Fint utgangspunkt", en: "Nice starting point" },
    ],
  },
  {
    id: "m3",
    time: "13:15",
    date: YESTERDAY_ISO,
    title: "Lunsj",
    itemsDetailed: [
      { foodId: "f3", grams: 125 },
      { foodId: "f4", grams: 150 },
      { foodId: "f5", grams: 80 },
    ],
    tags: [
      { no: "God balanse i måltidet", en: "Good balance in the meal" },
      { no: "Fin fiskemiddag", en: "Nice fish dinner" },
    ],
  },
  {
    id: "m4",
    time: "08:00",
    date: DAY_2_ISO,
    title: "Frokost",
    itemsDetailed: [
      { foodId: "f1", grams: 40 },
      { foodId: "f9", grams: 200 },
    ],
    tags: [{ no: "Fin karbokilde før trening", en: "Good carb source before training" }],
  },
  {
    id: "m5",
    time: "12:30",
    date: DAY_2_ISO,
    title: "Lunsj",
    itemsDetailed: [
      { foodId: "f2", grams: 150 },
      { foodId: "f4", grams: 180 },
    ],
    tags: [
      { no: "Bra proteininntak", en: "Good protein intake" },
      { no: "Fint etter økt", en: "Nice post-training meal" },
    ],
  },
  {
    id: "m6",
    time: "08:05",
    date: DAY_3_ISO,
    title: "Frokost",
    itemsDetailed: [
      { foodId: "f7", grams: 120 },
      { foodId: "f6", grams: 120 },
    ],
    tags: [{ no: "Fin start på dagen", en: "Nice start to the day" }],
  },
  {
    id: "m7",
    time: "18:20",
    date: DAY_3_ISO,
    title: "Middag",
    itemsDetailed: [
      { foodId: "f10", grams: 200 },
      { foodId: "f4", grams: 150 },
    ],
    tags: [
      { no: "Solid middag", en: "Solid dinner" },
      { no: "God variasjon over uka", en: "Good variety over the week" },
    ],
  },
];

// Sample water intake per date, keyed by ISO date string.
const WATER_SEED = {
  [TODAY_ISO]: {
    total: 600,
    log: [
      { id: 1, ml: 330, time: "07:45" },
      { id: 2, ml: 270, time: "09:30" },
    ],
  },
  [YESTERDAY_ISO]: {
    total: 2100,
    log: [
      { id: 3, ml: 600, time: "19:00" },
      { id: 4, ml: 500, time: "14:40" },
      { id: 5, ml: 600, time: "11:15" },
      { id: 6, ml: 400, time: "08:00" },
    ],
  },
  [DAY_2_ISO]: {
    total: 1800,
    log: [
      { id: 7, ml: 600, time: "17:30" },
      { id: 8, ml: 600, time: "13:00" },
      { id: 9, ml: 600, time: "09:00" },
    ],
  },
  [DAY_3_ISO]: {
    total: 2500,
    log: [
      { id: 10, ml: 500, time: "20:00" },
      { id: 11, ml: 500, time: "17:00" },
      { id: 12, ml: 500, time: "14:00" },
      { id: 13, ml: 500, time: "11:00" },
      { id: 14, ml: 500, time: "08:30" },
    ],
  },
};

const WATER_GOAL_ML = 2500;
const GLASS_ML = 500; // 1 glass = 0.5 l
const GLASS_GOAL = Math.round(WATER_GOAL_ML / GLASS_ML);
function glassFill(waterMl, index) {
  const amount = Math.min(Math.max(waterMl - index * GLASS_ML, 0), GLASS_ML);
  return amount / GLASS_ML;
}
const AVATAR_TONES = [
  "bg-emerald-100 text-emerald-700",
  "bg-blue-100 text-blue-700",
  "bg-amber-100 text-amber-700",
  "bg-violet-100 text-violet-700",
];

function foodById(id) {
  return FOODS.find((f) => f.id === id);
}

function formatPortions(grams, portionGrams, lang = "no") {
  const p = grams / portionGrams;
  const rounded = Math.round(p * 2) / 2;
  return lang === "en" ? rounded.toString() : rounded.toString().replace(".", ",");
}

function mealTotals(itemsDetailed) {
  const sum = (fn) =>
    Math.round(itemsDetailed.reduce((s, it) => s + (foodById(it.foodId)[fn] / 100) * it.grams, 0));
  return { kcal: sum("kcal"), protein: sum("protein"), carbs: sum("carbs"), fat: sum("fat") };
}

function mealItemNames(itemsDetailed, lang) {
  return itemsDetailed.map((it) => foodNameLabel(foodById(it.foodId).name, lang));
}

// ---------------------------------------------------------------------------
// Small shared bits
// ---------------------------------------------------------------------------

function TopBar({ title, onBack }) {
  const isDark = useIsDark();
  return (
    <div className="flex items-center justify-between px-4 pt-3 pb-2 shrink-0">
      <div className="w-8">
        {onBack && (
          <button onClick={onBack} className={cx("p-1 -ml-1 text-slate-500 dark:text-slate-300 hover:text-slate-800 dark:hover:text-white", isDark)}>
            <ArrowLeft size={20} />
          </button>
        )}
      </div>
      <h1 className={cx("text-base font-semibold text-slate-900 dark:text-white tracking-tight", isDark)}>{title}</h1>
      <div className="w-8" />
    </div>
  );
}

function Card({ children, className = "" }) {
  const isDark = useIsDark();
  return <div className={cx(`bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm ${className}`, isDark)}>{children}</div>;
}

function Pill({ children, tone = "slate" }) {
  const isDark = useIsDark();
  const tones = {
    slate: "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300",
    blue: "bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300",
    green: "bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300",
    amber: "bg-amber-50 dark:bg-amber-950 text-amber-800 dark:text-amber-300",
    red: "bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300",
  };
  return (
    <span className={cx(`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${tones[tone]}`, isDark)}>
      {children}
    </span>
  );
}

function WaterGlass({ fill = 0, size = 16 }) {
  const isDark = useIsDark();
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
      <path d={glassPath} className={cx("fill-white dark:fill-slate-900 stroke-slate-300 dark:stroke-slate-600", isDark)} strokeWidth="1.5" />
      {clampedFill > 0 && <path d={glassPath} className="fill-blue-500" clipPath={`url(#${clipId})`} />}
      <path d={glassPath} className={cx("stroke-slate-300 dark:stroke-slate-600", isDark)} strokeWidth="1.5" fill="none" />
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
function StatBlock({ value, unit, label, dot }) {
  const isDark = useIsDark();
  return (
    <div className="flex flex-col items-center flex-1 gap-1.5">
      <span className={cx("text-xl font-bold text-slate-900 dark:text-white", isDark)}>
        {value}
        {unit && <span className={cx("text-xs font-medium text-slate-400 dark:text-slate-500 ml-0.5", isDark)}>{unit}</span>}
      </span>
      <span className={cx("text-xs text-slate-400 dark:text-slate-500", isDark)}>{label}</span>
      <span className={`w-2 h-2 rounded-full ${dot}`} />
    </div>
  );
}

function NutritionStatGrid({ totals }) {
  const lang = useLang();
  return (
    <div className="flex justify-between">
      <StatBlock value={totals.kcal} label="kcal" dot="bg-emerald-500" />
      <StatBlock value={totals.protein} unit="g" label="Protein" dot="bg-blue-500" />
      <StatBlock value={totals.carbs} unit="g" label={lang === "en" ? "Carbs" : "Karbo"} dot="bg-amber-400" />
      <StatBlock value={totals.fat} unit="g" label={lang === "en" ? "Fat" : "Fett"} dot="bg-violet-500" />
    </div>
  );
}

function Toggle({ checked, onChange }) {
  const isDark = useIsDark();
  return (
    <button
      onClick={() => onChange(!checked)}
      className={cx(`w-11 h-6 rounded-full relative transition-colors ${checked ? "bg-indigo-600" : "bg-slate-200 dark:bg-slate-700"}`, isDark)}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
          checked ? "translate-x-5" : ""
        }`}
      />
    </button>
  );
}

// ---------------------------------------------------------------------------
// Login skjerm (1) — gates the app on first login, per the flow diagram
// ---------------------------------------------------------------------------

function LoginScreen({ onLogin, onSkip }) {
  const isDark = useIsDark();
  const t = useT();
  return (
    <div className={cx("h-full w-full flex flex-col items-center justify-center px-8 gap-6 bg-white dark:bg-slate-900", isDark)}>
      <div className="flex flex-col items-center gap-2">
        <div className="w-14 h-14 rounded-2xl bg-indigo-600 flex items-center justify-center text-white">
          <Utensils size={24} />
        </div>
        <h1 className={cx("text-lg font-bold text-slate-900 dark:text-white", isDark)}>{t("loginHeading")}</h1>
        <p className={cx("text-xs text-slate-400 dark:text-slate-500 text-center", isDark)}>{t("loginSubtitle")}</p>
      </div>
      <div className="w-full space-y-3">
        <input
          placeholder={t("emailPlaceholder")}
          className={cx("w-full bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl px-3.5 py-3 text-sm outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500", isDark)}
        />
        <input
          placeholder={t("passwordPlaceholder")}
          type="password"
          className={cx("w-full bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl px-3.5 py-3 text-sm outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500", isDark)}
        />
      </div>
      <button onClick={onLogin} className="w-full bg-indigo-600 text-white rounded-xl py-3 text-sm font-medium">
        {t("loginButton")}
      </button>
      <button onClick={onSkip} className={cx("text-xs text-slate-400 dark:text-slate-500 underline underline-offset-2", isDark)}>
        {t("skipLogin")}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Kameraskjerm (2) — persistent tab. Ta bilde -> Liste (3) -> Lagre?
// Ja -> lagre + gå til Dagsoversikt. Nei -> tilbake til kameraet.
// ---------------------------------------------------------------------------

function KameraTab({ onSaveMeal }) {
  const isDark = useIsDark();
  const lang = useLang();
  const t = useT();
  const [step, setStep] = useState("capture"); // capture | recognizing | overview | saved
  const [items, setItems] = useState([]);
  const [showPicker, setShowPicker] = useState(false);
  const [pickerQuery, setPickerQuery] = useState("");

  const startRecognizing = () => {
    setStep("recognizing");
    setTimeout(() => {
      setItems(RECOGNIZED_MOCK.map((r) => ({ ...r, manual: false })));
      setStep("overview");
    }, 1400);
  };

  const updateGrams = (id, grams) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, grams: Math.max(0, grams) } : it)));
  };

  const removeItem = (id) => setItems((prev) => prev.filter((it) => it.id !== id));

  const addFood = (food) => {
    setItems((prev) => [
      ...prev,
      { id: `manual-${Date.now()}`, foodId: food.id, confidence: null, grams: food.portionGrams, manual: true },
    ]);
    setShowPicker(false);
    setPickerQuery("");
  };

  const handleSave = () => {
    setStep("saved");
    setTimeout(() => onSaveMeal(items), 900);
  };

  // "Lagre? -> Nei": discard and loop back to the camera, per the diagram.
  const discardAndRetake = () => {
    setItems([]);
    setStep("capture");
  };

  const pickerResults = FOODS.filter((f) => f.name.toLowerCase().includes(pickerQuery.toLowerCase()));

  return (
    <div className={cx("h-full w-full flex flex-col bg-white dark:bg-slate-900 relative", isDark)}>
      {step !== "capture" && (
        <TopBar
          title={step === "recognizing" ? t("analyzing") : step === "overview" ? t("registeredFood") : t("saved")}
          onBack={step === "overview" ? discardAndRetake : undefined}
        />
      )}

      {step === "capture" && (
        <div className="flex-1 bg-black flex flex-col relative">
          <div className="flex-1 relative flex items-center justify-center overflow-hidden">
            <ImageIcon size={36} className="text-slate-600" />
            <span className="absolute top-6 left-0 right-0 text-center text-xs text-slate-400">
              {t("cameraPreview")}
            </span>
          </div>
          <div className="pt-10 pb-6 flex flex-col items-center gap-3 bg-gradient-to-t from-black/70 via-black/30 to-transparent">
            <p className="text-xs text-white/70 text-center px-8">{t("privacyNote")}</p>
            <button
              onClick={startRecognizing}
              className="w-20 h-20 rounded-full border-4 border-white flex items-center justify-center active:scale-95 transition"
            >
              <div className="w-16 h-16 rounded-full bg-white" />
            </button>
          </div>
        </div>
      )}

      {step === "recognizing" && (
        <div className={cx("flex-1 flex flex-col items-center justify-center gap-3 text-slate-500 dark:text-slate-400", isDark)}>
          <Loader2 size={28} className="animate-spin text-indigo-600" />
          <p className="text-sm">{t("recognizing")}</p>
        </div>
      )}

      {step === "overview" && (
        <div className="flex-1 flex flex-col relative overflow-hidden">
          <div className="flex-1 overflow-y-auto px-4 space-y-2">
            <p className={cx("text-xs text-slate-400 dark:text-slate-500 mb-1", isDark)}>{t("overviewIntro")}</p>

            {items.map((it) => {
              const food = foodById(it.foodId);
              const portionStr = formatPortions(it.grams, food.portionGrams, lang);
              return (
                <Card key={it.id} className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className={cx("text-sm font-medium text-slate-800 dark:text-slate-100", isDark)}>{foodNameLabel(food.name, lang)}</p>
                      {it.manual ? (
                        <Pill tone="slate">{t("addedManually")}</Pill>
                      ) : (
                        <Pill tone={it.confidence > 0.85 ? "green" : "amber"}>{t("confident", Math.round(it.confidence * 100))}</Pill>
                      )}
                    </div>
                    <button onClick={() => removeItem(it.id)} className={cx("text-slate-300 dark:text-slate-600 hover:text-red-500 p-1", isDark)}>
                      <Trash2 size={15} />
                    </button>
                  </div>

                  <div className="flex items-center justify-between mt-3">
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => updateGrams(it.id, it.grams - 10)}
                        className={cx("w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-300", isDark)}
                      >
                        <Minus size={12} />
                      </button>
                      <input
                        value={it.grams}
                        onChange={(e) => updateGrams(it.id, Number(e.target.value) || 0)}
                        className={cx("w-12 text-center text-sm outline-none bg-transparent text-slate-900 dark:text-white", isDark)}
                      />
                      <span className={cx("text-xs text-slate-400 dark:text-slate-500", isDark)}>g</span>
                      <button
                        onClick={() => updateGrams(it.id, it.grams + 10)}
                        className={cx("w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-300", isDark)}
                      >
                        <Plus size={12} />
                      </button>
                    </div>
                    <span className={cx("text-xs text-slate-400 dark:text-slate-500", isDark)}>
                      ≈ {portionStr} {lang === "en" ? (portionStr === "1" ? "portion" : "portions") : `porsjon${portionStr === "1" ? "" : "er"}`}
                    </span>
                  </div>
                </Card>
              );
            })}

            {items.length === 0 && (
              <p className={cx("text-center text-sm text-slate-400 dark:text-slate-500 pt-8", isDark)}>{t("noItemsLeft")}</p>
            )}

            <button
              onClick={() => setShowPicker(true)}
              className={cx("w-full flex items-center justify-center gap-1 py-2.5 text-sm text-indigo-600 font-medium border border-dashed border-indigo-200 dark:border-indigo-800 rounded-xl", isDark)}
            >
              <Plus size={14} /> {t("addUndetectedFood")}
            </button>
            <div className="h-2" />
          </div>

          <div className="p-4 pt-2 shrink-0">
            <button
              onClick={handleSave}
              disabled={items.length === 0}
              className={cx("w-full bg-indigo-600 disabled:bg-slate-200 dark:disabled:bg-slate-800 text-white disabled:text-slate-400 dark:disabled:text-slate-500 rounded-xl py-3 text-sm font-medium flex items-center justify-center gap-2", isDark)}
            >
              <Check size={16} /> {t("saveMeal")}
            </button>
          </div>

          {showPicker && (
            <div className={cx("absolute inset-x-0 bottom-0 top-16 bg-white dark:bg-slate-900 rounded-t-2xl shadow-2xl flex flex-col", isDark)}>
              <div className="flex items-center justify-between px-4 pt-3 pb-2">
                <span className={cx("text-sm font-semibold text-slate-800 dark:text-slate-100", isDark)}>{t("addFoodHeading")}</span>
                <button onClick={() => setShowPicker(false)} className={cx("text-slate-400 dark:text-slate-500 p-1", isDark)}>
                  <X size={16} />
                </button>
              </div>
              <div className="px-4 pb-2">
                <div className={cx("flex items-center gap-2 bg-slate-100 dark:bg-slate-800 rounded-xl px-3 py-2", isDark)}>
                  <Search size={14} className={cx("text-slate-400 dark:text-slate-500", isDark)} />
                  <input
                    autoFocus
                    value={pickerQuery}
                    onChange={(e) => setPickerQuery(e.target.value)}
                    placeholder={t("searchFoodsPlaceholder")}
                    className={cx("bg-transparent outline-none text-sm flex-1 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500", isDark)}
                  />
                </div>
              </div>
              <div className="flex-1 overflow-y-auto px-4 space-y-1.5 pb-4">
                {pickerResults.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => addFood(f)}
                    className={cx("w-full flex items-center justify-between bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5", isDark)}
                  >
                    <span className={cx("text-sm text-slate-700 dark:text-slate-200", isDark)}>{foodNameLabel(f.name, lang)}</span>
                    <span className={cx("text-xs text-slate-400 dark:text-slate-500", isDark)}>{t("onePortionEquals", f.portionGrams)}</span>
                  </button>
                ))}
                {pickerResults.length === 0 && (
                  <p className={cx("text-center text-xs text-slate-400 dark:text-slate-500 pt-6", isDark)}>{t("noMatvaretabellenHits")}</p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {step === "saved" && (
        <div className="flex-1 flex flex-col items-center justify-center gap-3">
          <div className={cx("w-14 h-14 rounded-full bg-emerald-50 dark:bg-emerald-950 flex items-center justify-center", isDark)}>
            <Check size={24} className={cx("text-emerald-600 dark:text-emerald-400", isDark)} />
          </div>
          <p className={cx("text-sm text-slate-500 dark:text-slate-400", isDark)}>{t("sendingToDatabase")}</p>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Date navigation — day header with prev/next arrows, and a month calendar
// that drops down when the date label is tapped.
// ---------------------------------------------------------------------------

function DateHeader({ selectedDate, onPrevDay, onNextDay, onToggleCalendar, calendarOpen }) {
  const isDark = useIsDark();
  const lang = useLang();
  const canGoNext = toISODate(selectedDate) !== TODAY_ISO;
  return (
    <div className="flex items-center justify-between px-2 pt-3 pb-2">
      <button onClick={onPrevDay} className={cx("w-9 h-9 flex items-center justify-center text-slate-500 dark:text-slate-300 shrink-0", isDark)}>
        <ChevronLeft size={20} />
      </button>
      <button onClick={onToggleCalendar} className="flex items-center gap-1 px-2 py-1">
        <span className={cx("text-sm font-semibold text-slate-900 dark:text-white", isDark)}>{formatDayDate(selectedDate, lang)}</span>
        <ChevronDown size={14} className={cx(`text-slate-400 dark:text-slate-500 transition-transform ${calendarOpen ? "rotate-180" : ""}`, isDark)} />
      </button>
      <button
        onClick={onNextDay}
        disabled={!canGoNext}
        className={cx(
          `w-9 h-9 flex items-center justify-center shrink-0 ${
            canGoNext ? "text-slate-500 dark:text-slate-300" : "text-transparent pointer-events-none"
          }`,
          isDark
        )}
      >
        <ChevronRight size={20} />
      </button>
    </div>
  );
}

function MonthCalendar({ viewMonth, onPrevMonth, onNextMonth, selectedDate, onSelectDate }) {
  const isDark = useIsDark();
  const lang = useLang();
  const canGoNextMonth = !isSameMonth(viewMonth, TODAY);
  const firstOfMonth = startOfMonth(viewMonth);
  const firstWeekday = (firstOfMonth.getDay() + 6) % 7; // Monday = 0
  const daysInMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 0).getDate();

  const cells = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(viewMonth.getFullYear(), viewMonth.getMonth(), d));
  while (cells.length % 7 !== 0) cells.push(null);

  const weekdayLabels = lang === "en" ? ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"] : ["Ma", "Ti", "On", "To", "Fr", "Lø", "Sø"];

  return (
    <div
      style={{ height: "min(260px, 32vh)" }}
      className={cx("border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 flex flex-col overflow-hidden shrink-0", isDark)}
    >
      <div className="flex items-center justify-between px-4 pt-1 pb-1 shrink-0">
        <button onClick={onPrevMonth} className={cx("w-8 h-8 flex items-center justify-center text-slate-500 dark:text-slate-300", isDark)}>
          <ChevronLeft size={18} />
        </button>
        <span className={cx("text-sm font-semibold text-slate-900 dark:text-white", isDark)}>{formatMonthYear(viewMonth, lang)}</span>
        <button
          onClick={onNextMonth}
          disabled={!canGoNextMonth}
          className={cx(
            `w-8 h-8 flex items-center justify-center ${
              canGoNextMonth ? "text-slate-500 dark:text-slate-300" : "text-transparent pointer-events-none"
            }`,
            isDark
          )}
        >
          <ChevronRight size={18} />
        </button>
      </div>
      <div className="grid grid-cols-7 px-3 shrink-0">
        {weekdayLabels.map((w) => (
          <span key={w} className={cx("text-xs text-slate-400 dark:text-slate-500 text-center py-1", isDark)}>
            {w}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7 px-3 gap-y-1 flex-1 overflow-y-auto pb-2">
        {cells.map((date, i) => {
          if (!date) return <div key={i} />;
          const iso = toISODate(date);
          const future = date > TODAY;
          const isSelected = iso === toISODate(selectedDate);
          const isToday = iso === TODAY_ISO;
          return (
            <button
              key={i}
              disabled={future}
              onClick={() => onSelectDate(date)}
              className={cx(
                `w-7 h-7 mx-auto rounded-full text-xs flex items-center justify-center ${
                  future
                    ? "text-slate-300 dark:text-slate-700"
                    : isSelected
                    ? "bg-indigo-600 text-white font-semibold"
                    : isToday
                    ? "text-indigo-600 font-semibold"
                    : "text-slate-700 dark:text-slate-300"
                }`,
                isDark
              )}
            >
              {date.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Dagsoversikt (4) — dashboard + meal list for the selected date
// ---------------------------------------------------------------------------

function MealsScreen({
  viewMode,
  selectedDate,
  calendarOpen,
  calendarMonth,
  onPrevDay,
  onNextDay,
  onToggleCalendar,
  onPrevMonth,
  onNextMonth,
  onSelectDate,
  dayMeals,
  waterTotal,
  onGoWater,
  onGoSearch,
  onOpenMeal,
}) {
  const isDark = useIsDark();
  const lang = useLang();
  const t = useT();
  const dayTotals = dayMeals.reduce(
    (acc, m) => {
      const tt = mealTotals(m.itemsDetailed);
      return {
        kcal: acc.kcal + tt.kcal,
        protein: acc.protein + tt.protein,
        carbs: acc.carbs + tt.carbs,
        fat: acc.fat + tt.fat,
      };
    },
    { kcal: 0, protein: 0, carbs: 0, fat: 0 }
  );

  return (
    <div className="pb-4">
      <DateHeader
        selectedDate={selectedDate}
        onPrevDay={onPrevDay}
        onNextDay={onNextDay}
        onToggleCalendar={onToggleCalendar}
        calendarOpen={calendarOpen}
      />
      {calendarOpen && (
        <MonthCalendar
          viewMonth={calendarMonth}
          onPrevMonth={onPrevMonth}
          onNextMonth={onNextMonth}
          selectedDate={selectedDate}
          onSelectDate={onSelectDate}
        />
      )}

      <div className="px-4 pt-3 space-y-4">
        <button
          onClick={onGoWater}
          className={cx("w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl px-4 py-3 flex items-center justify-between gap-3 active:scale-95 transition", isDark)}
        >
          <div className="flex items-center gap-2.5">
            <Droplet size={18} className="text-blue-500 shrink-0" />
            <span className={cx("text-sm font-medium text-slate-700 dark:text-slate-200", isDark)}>
              {waterTotal}/{WATER_GOAL_ML} {t("waterRowSuffix")}
            </span>
          </div>
          <GlassRow water={waterTotal} size={20} />
        </button>

        <Card>
          <button onClick={onGoSearch} className="w-full flex items-center justify-between px-4 py-3.5">
            <div className="flex items-center gap-2.5">
              <Search size={16} className={cx("text-slate-400 dark:text-slate-500", isDark)} />
              <span className={cx("text-sm text-slate-700 dark:text-slate-200", isDark)}>{t("searchFoods")}</span>
            </div>
            <ChevronRight size={14} className={cx("text-slate-300 dark:text-slate-600", isDark)} />
          </button>
        </Card>

        <div>
          <h3 className={cx("text-sm font-bold text-slate-900 dark:text-white mb-2", isDark)}>{t("todaysOverview")}</h3>
          <Card className="p-4">
            {viewMode === "adult" ? (
              <NutritionStatGrid totals={dayTotals} />
            ) : (
              <div className="flex flex-wrap gap-2">
                <Pill tone="green">{t("youthPill1")}</Pill>
                <Pill tone="red">{t("youthPill2")}</Pill>
                <Pill tone="blue">{t("youthPill3")}</Pill>
              </div>
            )}
          </Card>
        </div>

        <div>
          <h3 className={cx("text-sm font-bold text-slate-900 dark:text-white mb-2", isDark)}>{t("meals")}</h3>
          <Card className="divide-y divide-slate-100 dark:divide-slate-800">
            {dayMeals.map((m) => {
              const tt = mealTotals(m.itemsDetailed);
              return (
                <button
                  key={m.id}
                  onClick={() => onOpenMeal(m.id)}
                  className="w-full flex items-center justify-between p-3.5"
                >
                  <div className="text-left">
                    <p className={cx("text-sm font-medium text-slate-800 dark:text-slate-100", isDark)}>
                      {mealTitleLabel(m.title, lang)} <span className={cx("text-slate-400 dark:text-slate-500 font-normal", isDark)}>· {m.time}</span>
                    </p>
                    <p className={cx("text-xs text-slate-400 dark:text-slate-500", isDark)}>{mealItemNames(m.itemsDetailed, lang).join(", ")}</p>
                  </div>
                  {viewMode === "adult" ? (
                    <span className={cx("text-sm font-semibold text-slate-700 dark:text-slate-200", isDark)}>{tt.kcal} kcal</span>
                  ) : (
                    <Pill tone="green">{t("ok")}</Pill>
                  )}
                </button>
              );
            })}
            {dayMeals.length === 0 && (
              <p className={cx("text-center text-sm text-slate-400 dark:text-slate-500 py-6", isDark)}>{t("noMealsThisDay")}</p>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

function MealDetailScreen({ meal, viewMode, onBack }) {
  const isDark = useIsDark();
  const lang = useLang();
  const t = useT();
  const totals = mealTotals(meal.itemsDetailed);

  return (
    <div className="pb-4">
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <button onClick={onBack} className={cx("p-1 -ml-1 text-slate-500 dark:text-slate-300", isDark)}>
          <ChevronLeft size={22} />
        </button>
        <h1 className={cx("text-base font-bold text-slate-900 dark:text-white", isDark)}>{mealTitleLabel(meal.title, lang)}</h1>
        <button className={cx("p-1 -mr-1 text-slate-400 dark:text-slate-500", isDark)}>
          <MoreHorizontal size={20} />
        </button>
      </div>

      <div className="px-4">
        <div className={cx("relative h-52 rounded-3xl bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-800 dark:to-slate-700 flex items-center justify-center overflow-hidden mb-4", isDark)}>
          <Utensils size={40} className={cx("text-slate-400 dark:text-slate-500", isDark)} />
          <span className="absolute bottom-3 left-3 bg-black/60 text-white text-xs rounded-full px-3 py-1 flex items-center gap-1.5">
            <Calendar size={12} />
            {formatShortDate(parseISODate(meal.date), lang)} · {meal.time}
          </span>
          <span className={cx("absolute top-3 right-3 bg-white/85 dark:bg-slate-900/85 text-slate-500 dark:text-slate-400 text-xs rounded-full px-2.5 py-1", isDark)}>
            {t("imageNotStored")}
          </span>
        </div>

        <h3 className={cx("text-sm font-bold text-slate-900 dark:text-white mb-2", isDark)}>{t("nutritionOverview")}</h3>
        <Card className="p-4 mb-4">
          {viewMode === "adult" ? (
            <NutritionStatGrid totals={totals} />
          ) : (
            <div className="flex flex-wrap gap-2">
              {meal.tags.map((tag, i) => (
                <Pill key={i} tone="green">
                  {tag[lang]}
                </Pill>
              ))}
            </div>
          )}
        </Card>

        <h3 className={cx("text-sm font-bold text-slate-900 dark:text-white mb-2", isDark)}>{t("mealItems")}</h3>
        <Card className="divide-y divide-slate-100 dark:divide-slate-800">
          {meal.itemsDetailed.map((it, i) => {
            const food = foodById(it.foodId);
            const kcal = Math.round((food.kcal / 100) * it.grams);
            return (
              <div key={i} className="flex items-center justify-between p-3.5">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold ${
                      AVATAR_TONES[i % AVATAR_TONES.length]
                    }`}
                  >
                    {food.name.charAt(0)}
                  </div>
                  <div>
                    <p className={cx("text-sm font-medium text-slate-800 dark:text-slate-100", isDark)}>{foodNameLabel(food.name, lang)}</p>
                    <p className={cx("text-xs text-slate-400 dark:text-slate-500", isDark)}>{it.grams} g</p>
                  </div>
                </div>
                {viewMode === "adult" && <span className={cx("text-sm font-semibold text-slate-700 dark:text-slate-200", isDark)}>{kcal} kcal</span>}
              </div>
            );
          })}
        </Card>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

function SearchScreen({ viewMode, onBack }) {
  const isDark = useIsDark();
  const lang = useLang();
  const t = useT();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(null);
  const [mode, setMode] = useState("grams");
  const [grams, setGrams] = useState(100);

  const results = FOODS.filter((f) => f.name.toLowerCase().includes(query.toLowerCase()));
  const factor = selected ? (mode === "grams" ? grams / 100 : selected.portionGrams / 100) : 1;
  const selectedTotals = selected
    ? {
        kcal: Math.round(selected.kcal * factor),
        protein: Math.round(selected.protein * factor),
        carbs: Math.round(selected.carbs * factor),
        fat: Math.round(selected.fat * factor),
      }
    : null;

  return (
    <div className="pb-4">
      <TopBar title={t("searchTitle")} onBack={onBack} />
      <div className="px-4">
        <div className={cx("flex items-center gap-2 bg-slate-100 dark:bg-slate-800 rounded-xl px-3 py-2 mb-3", isDark)}>
          <Search size={15} className={cx("text-slate-400 dark:text-slate-500", isDark)} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("searchPlaceholder")}
            className={cx("bg-transparent outline-none text-sm flex-1 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500", isDark)}
          />
        </div>

        {!selected && (
          <div className="space-y-1.5">
            {results.map((f) => (
              <button
                key={f.id}
                onClick={() => setSelected(f)}
                className={cx("w-full flex items-center justify-between bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5", isDark)}
              >
                <span className={cx("text-sm text-slate-700 dark:text-slate-200", isDark)}>{foodNameLabel(f.name, lang)}</span>
                <ChevronRight size={14} className={cx("text-slate-300 dark:text-slate-600", isDark)} />
              </button>
            ))}
            {query && results.length === 0 && (
              <p className={cx("text-center text-sm text-slate-400 dark:text-slate-500 pt-6", isDark)}>{t("noMatvaretabellenHits")}</p>
            )}
          </div>
        )}

        {selected && (
          <Card className="p-4">
            <div className="flex items-center justify-between mb-3">
              <button onClick={() => setSelected(null)} className={cx("text-slate-400 dark:text-slate-500", isDark)}>
                <ChevronLeft size={16} />
              </button>
              <span className={cx("text-sm font-medium text-slate-800 dark:text-slate-100", isDark)}>{foodNameLabel(selected.name, lang)}</span>
              <div className="w-4" />
            </div>

            <div className={cx("flex bg-slate-100 dark:bg-slate-800 rounded-lg p-1 mb-4", isDark)}>
              {["grams", "portion"].map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={cx(
                    `flex-1 py-1.5 rounded-md text-xs font-medium transition ${
                      mode === m ? "bg-white dark:bg-slate-700 shadow-sm text-slate-800 dark:text-white" : "text-slate-400 dark:text-slate-500"
                    }`,
                    isDark
                  )}
                >
                  {m === "grams" ? t("gramsTab") : t("portionTab")}
                </button>
              ))}
            </div>

            {mode === "grams" && (
              <div className="flex items-center justify-center gap-3 mb-4">
                <button
                  onClick={() => setGrams((g) => Math.max(0, g - 25))}
                  className={cx("w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-300", isDark)}
                >
                  <Minus size={14} />
                </button>
                <span className={cx("text-base font-semibold text-slate-800 dark:text-white w-16 text-center", isDark)}>{grams} g</span>
                <button
                  onClick={() => setGrams((g) => g + 25)}
                  className={cx("w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-300", isDark)}
                >
                  <Plus size={14} />
                </button>
              </div>
            )}
            {mode === "portion" && (
              <p className={cx("text-center text-xs text-slate-400 dark:text-slate-500 mb-4", isDark)}>{t("onePortionEquals", selected.portionGrams)}</p>
            )}

            {viewMode === "adult" ? (
              <div className={cx("border-t border-slate-100 dark:border-slate-800 pt-3", isDark)}>
                <NutritionStatGrid totals={selectedTotals} />
              </div>
            ) : (
              <div className={cx("border-t border-slate-100 dark:border-slate-800 pt-3", isDark)}>
                <Pill tone="green">{t("healthyChoicePill")}</Pill>
              </div>
            )}
          </Card>
        )}

        <p className={cx("text-xs text-slate-300 dark:text-slate-600 text-center mt-6", isDark)}>{t("matvaretabellenSource")}</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Water
// ---------------------------------------------------------------------------

function WaterScreen({ total, log, onAddWater, onBack, dateLabel, readOnly }) {
  const isDark = useIsDark();
  const t = useT();
  const pct = Math.min(100, Math.round((total / WATER_GOAL_ML) * 100));

  return (
    <div className="px-4 pb-4">
      <TopBar title={t("waterTitle")} onBack={onBack} />
      <p className={cx("text-xs text-slate-400 dark:text-slate-500 text-center -mt-1 mb-3", isDark)}>{dateLabel}</p>
      <Card className="p-6 flex flex-col items-center">
        <div className="relative w-32 h-32 mb-4">
          <svg viewBox="0 0 100 100" className="w-32 h-32 -rotate-90">
            <circle cx="50" cy="50" r="44" fill="none" stroke="#EEF2F6" strokeWidth="10" />
            <circle
              cx="50"
              cy="50"
              r="44"
              fill="none"
              stroke="#3B82F6"
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={`${(pct / 100) * 276} 276`}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <Droplet size={16} className="text-blue-500 mb-0.5" />
            <span className={cx("text-base font-semibold text-slate-800 dark:text-white", isDark)}>{total} ml</span>
            <span className={cx("text-xs text-slate-400 dark:text-slate-500", isDark)}>{t("ofGoal", WATER_GOAL_ML)}</span>
          </div>
        </div>
        <div className="mb-4">
          <GlassRow water={total} size={28} />
        </div>
        {readOnly ? (
          <p className={cx("text-xs text-slate-400 dark:text-slate-500 text-center", isDark)}>{t("waterReadOnly")}</p>
        ) : (
          <div className="grid grid-cols-3 gap-2 w-full">
            {[200, 330, 500].map((ml) => (
              <button
                key={ml}
                onClick={() => onAddWater(ml)}
                className={cx("bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 rounded-xl py-2.5 text-xs font-medium flex flex-col items-center gap-1", isDark)}
              >
                <Plus size={13} />+{ml} ml
              </button>
            ))}
          </div>
        )}
      </Card>

      <div className="mt-4">
        <span className={cx("text-xs font-medium text-slate-500 dark:text-slate-400", isDark)}>{t("registrations")}</span>
        <div className="space-y-1.5 mt-2">
          {log.length === 0 && <p className={cx("text-xs text-slate-400 dark:text-slate-500", isDark)}>{t("noRegistrationsThisDay")}</p>}
          {log.map((l) => (
            <Card key={l.id} className="p-2.5 flex items-center justify-between">
              <span className={cx("text-xs text-slate-500 dark:text-slate-400", isDark)}>{l.time}</span>
              <span className={cx("text-sm font-medium text-slate-700 dark:text-slate-200", isDark)}>+{l.ml} ml</span>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Innstillinger (5) & Profilinnstillinger (6)
// ---------------------------------------------------------------------------

function InnstillingerScreen({ onBack, notifications, setNotifications, unit, setUnit }) {
  const isDark = useIsDark();
  const t = useT();
  return (
    <div className="pb-4">
      <TopBar title={t("settingsTitle")} onBack={onBack} />
      <div className="px-4 space-y-4">
        <Card className="p-4 flex items-center justify-between">
          <span className={cx("text-sm text-slate-700 dark:text-slate-200", isDark)}>{t("notifications")}</span>
          <Toggle checked={notifications} onChange={setNotifications} />
        </Card>

        <Card className="p-4">
          <span className={cx("text-sm text-slate-700 dark:text-slate-200 block mb-2", isDark)}>{t("measurementUnit")}</span>
          <div className={cx("flex bg-slate-100 dark:bg-slate-800 rounded-lg p-1", isDark)}>
            {["g", "oz"].map((u) => (
              <button
                key={u}
                onClick={() => setUnit(u)}
                className={cx(
                  `flex-1 py-1.5 rounded-md text-xs font-medium transition ${
                    unit === u ? "bg-white dark:bg-slate-700 shadow-sm text-slate-800 dark:text-white" : "text-slate-400 dark:text-slate-500"
                  }`,
                  isDark
                )}
              >
                {u === "g" ? t("gramUnit") : t("ounceUnit")}
              </button>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

function ProfilinnstillingerScreen({ onBack, weight, setWeight, height, setHeight, age, setAge }) {
  const isDark = useIsDark();
  const t = useT();
  return (
    <div className="pb-4">
      <TopBar title={t("profileSettingsTitle")} onBack={onBack} />
      <div className="px-4 space-y-4">
        <div className="flex flex-col items-center gap-2 py-2">
          <div className="relative">
            <div className={cx("w-20 h-20 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-300", isDark)}>
              <User size={28} />
            </div>
            <div className={cx("absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-indigo-600 border-2 border-white dark:border-slate-900 flex items-center justify-center text-white", isDark)}>
              <Edit3 size={12} />
            </div>
          </div>
          <span className={cx("text-xs text-slate-400 dark:text-slate-500", isDark)}>{t("changeProfilePicture")}</span>
        </div>

        <Card className="p-4 space-y-4">
          <label className="block">
            <span className={cx("text-xs text-slate-500 dark:text-slate-400 mb-1 block", isDark)}>{t("weightKg")}</span>
            <input
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              className={cx("w-full bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl px-3.5 py-2.5 text-sm outline-none", isDark)}
            />
          </label>
          <label className="block">
            <span className={cx("text-xs text-slate-500 dark:text-slate-400 mb-1 block", isDark)}>{t("heightCm")}</span>
            <input
              value={height}
              onChange={(e) => setHeight(e.target.value)}
              className={cx("w-full bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl px-3.5 py-2.5 text-sm outline-none", isDark)}
            />
          </label>
          <label className="block">
            <span className={cx("text-xs text-slate-500 dark:text-slate-400 mb-1 block", isDark)}>{t("ageYears")}</span>
            <input
              value={age}
              onChange={(e) => setAge(e.target.value)}
              className={cx("w-full bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl px-3.5 py-2.5 text-sm outline-none", isDark)}
            />
          </label>
        </Card>

        <button onClick={onBack} className="w-full bg-indigo-600 text-white rounded-xl py-3 text-sm font-medium">
          {t("save")}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Foresatte's own addition on top of the player's Profil: register height
// for Mor / Far.
// ---------------------------------------------------------------------------

function GuardianScreen({
  onBack,
  motherHeight,
  setMotherHeight,
  fatherHeight,
  setFatherHeight,
  motherPhone,
  setMotherPhone,
  fatherPhone,
  setFatherPhone,
}) {
  const isDark = useIsDark();
  const t = useT();
  return (
    <div className="pb-4">
      <TopBar title={t("guardianScreenTitle")} onBack={onBack} />
      <div className="px-4 space-y-4">
        <div className="flex flex-col items-center gap-2 py-2">
          <div className={cx("w-16 h-16 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-300", isDark)}>
            <Users size={26} />
          </div>
          <span className={cx("text-xs text-slate-400 dark:text-slate-500 text-center px-6", isDark)}>{t("guardianIntro")}</span>
        </div>

        <Card className="p-4 space-y-4">
          <label className="block">
            <span className={cx("text-xs text-slate-500 dark:text-slate-400 mb-1 block", isDark)}>{t("motherHeightLabel")}</span>
            <input
              value={motherHeight}
              onChange={(e) => setMotherHeight(e.target.value)}
              className={cx("w-full bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl px-3.5 py-2.5 text-sm outline-none", isDark)}
            />
          </label>
          <label className="block">
            <span className={cx("text-xs text-slate-500 dark:text-slate-400 mb-1 block", isDark)}>{t("motherPhoneLabel")}</span>
            <input
              type="tel"
              value={motherPhone}
              onChange={(e) => setMotherPhone(e.target.value)}
              placeholder="+47 900 00 000"
              className={cx("w-full bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl px-3.5 py-2.5 text-sm outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500", isDark)}
            />
          </label>
        </Card>

        <Card className="p-4 space-y-4">
          <label className="block">
            <span className={cx("text-xs text-slate-500 dark:text-slate-400 mb-1 block", isDark)}>{t("fatherHeightLabel")}</span>
            <input
              value={fatherHeight}
              onChange={(e) => setFatherHeight(e.target.value)}
              className={cx("w-full bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl px-3.5 py-2.5 text-sm outline-none", isDark)}
            />
          </label>
          <label className="block">
            <span className={cx("text-xs text-slate-500 dark:text-slate-400 mb-1 block", isDark)}>{t("fatherPhoneLabel")}</span>
            <input
              type="tel"
              value={fatherPhone}
              onChange={(e) => setFatherPhone(e.target.value)}
              placeholder="+47 900 00 000"
              className={cx("w-full bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl px-3.5 py-2.5 text-sm outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500", isDark)}
            />
          </label>
        </Card>

        <button onClick={onBack} className="w-full bg-indigo-600 text-white rounded-xl py-3 text-sm font-medium">
          {t("save")}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Profil — player only, hosts the settings sub-flow
// ---------------------------------------------------------------------------

function ProfileScreen({ viewMode, setViewMode, onLogout }) {
  const isDark = useIsDark();
  const t = useT();
  const [sub, setSub] = useState(null); // null | "settings" | "profileSettings" | "guardians"
  const [notifications, setNotifications] = useState(true);
  const [unit, setUnit] = useState("g");
  const [weight, setWeight] = useState(78);
  const [height, setHeight] = useState(182);
  const [age, setAge] = useState(19);
  const [motherHeight, setMotherHeight] = useState(168);
  const [fatherHeight, setFatherHeight] = useState(182);
  const [motherPhone, setMotherPhone] = useState("+47 901 23 456");
  const [fatherPhone, setFatherPhone] = useState("+47 934 56 789");

  if (sub === "profileSettings") {
    return (
      <ProfilinnstillingerScreen
        onBack={() => setSub(null)}
        weight={weight}
        setWeight={setWeight}
        height={height}
        setHeight={setHeight}
        age={age}
        setAge={setAge}
      />
    );
  }

  if (sub === "guardians") {
    return (
      <GuardianScreen
        onBack={() => setSub(null)}
        motherHeight={motherHeight}
        setMotherHeight={setMotherHeight}
        fatherHeight={fatherHeight}
        setFatherHeight={setFatherHeight}
        motherPhone={motherPhone}
        setMotherPhone={setMotherPhone}
        fatherPhone={fatherPhone}
        setFatherPhone={setFatherPhone}
      />
    );
  }

  if (sub === "settings") {
    return (
      <InnstillingerScreen
        onBack={() => setSub(null)}
        notifications={notifications}
        setNotifications={setNotifications}
        unit={unit}
        setUnit={setUnit}
      />
    );
  }

  return (
    <div className="px-4 pb-4">
      <TopBar title={t("profileTitle")} />
      <Card className="p-0 mb-4 overflow-hidden">
        <button
          onClick={() => setSub("guardians")}
          className={cx("w-full p-4 flex items-center gap-3 active:bg-slate-50 dark:active:bg-slate-800", isDark)}
        >
          <div className={cx("w-11 h-11 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-300", isDark)}>
            <Users size={18} />
          </div>
          <div className="text-left">
            <p className={cx("text-sm font-medium text-slate-800 dark:text-slate-100", isDark)}>{t("guardianCardTitle")}</p>
            <p className={cx("text-xs text-slate-400 dark:text-slate-500", isDark)}>{t("guardianCardSubtitle")}</p>
          </div>
          <ChevronRight size={14} className={cx("text-slate-300 dark:text-slate-600 ml-auto", isDark)} />
        </button>
      </Card>

      <Card className="p-0 mb-4 overflow-hidden">
        <button
          onClick={() => setSub("profileSettings")}
          className={cx("w-full p-4 flex items-center gap-3 active:bg-slate-50 dark:active:bg-slate-800", isDark)}
        >
          <div className={cx("w-11 h-11 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-300", isDark)}>
            <User size={18} />
          </div>
          <div className="text-left">
            <p className={cx("text-sm font-medium text-slate-800 dark:text-slate-100", isDark)}>Filip H.</p>
            <p className={cx("text-xs text-slate-400 dark:text-slate-500", isDark)}>
              {t("playerRole")} · A-lag
            </p>
          </div>
          <ChevronRight size={14} className={cx("text-slate-300 dark:text-slate-600 ml-auto", isDark)} />
        </button>
      </Card>

      <Card className="p-4 mb-4">
        <p className={cx("text-xs font-medium text-slate-500 dark:text-slate-400 mb-1", isDark)}>{t("previewAs")}</p>
        <p className={cx("text-xs text-slate-400 dark:text-slate-500 mb-3", isDark)}>{t("previewAsNote")}</p>
        <div className={cx("flex bg-slate-100 dark:bg-slate-800 rounded-lg p-1", isDark)}>
          {[
            { key: "adult", label: t("adultNumbers") },
            { key: "youth", label: t("youthGuidance") },
          ].map((o) => (
            <button
              key={o.key}
              onClick={() => setViewMode(o.key)}
              className={cx(
                `flex-1 py-1.5 rounded-md text-xs font-medium transition ${
                  viewMode === o.key ? "bg-white dark:bg-slate-700 shadow-sm text-slate-800 dark:text-white" : "text-slate-400 dark:text-slate-500"
                }`,
                isDark
              )}
            >
              {o.label}
            </button>
          ))}
        </div>
      </Card>

      <Card className="divide-y divide-slate-100 dark:divide-slate-800">
        <button onClick={() => setSub("settings")} className="w-full flex items-center justify-between px-4 py-3">
          <span className={cx("text-sm text-slate-700 dark:text-slate-200", isDark)}>{t("settingsRow")}</span>
          <ChevronRight size={14} className={cx("text-slate-300 dark:text-slate-600", isDark)} />
        </button>
        <button className="w-full flex items-center justify-between px-4 py-3">
          <span className={cx("text-sm text-slate-700 dark:text-slate-200", isDark)}>{t("privacyNotesRow")}</span>
          <ChevronRight size={14} className={cx("text-slate-300 dark:text-slate-600", isDark)} />
        </button>
        <button onClick={onLogout} className="w-full flex items-center justify-between px-4 py-3">
          <span className={cx("text-sm text-slate-700 dark:text-slate-200", isDark)}>{t("logOut")}</span>
          <ChevronRight size={14} className={cx("text-slate-300 dark:text-slate-600", isDark)} />
        </button>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Root app
// ---------------------------------------------------------------------------

const TABS = [
  { key: "dagsoversikt", label: "Dagsoversikt", icon: Utensils },
  { key: "kamera", label: "Kamera", icon: Camera },
  { key: "profile", label: "Profil", icon: User },
];

export default function App() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [tab, setTab] = useState("kamera");
  const [dagView, setDagView] = useState("list"); // list | mealDetail | search | water
  const [selectedMealId, setSelectedMealId] = useState(null);
  const [selectedDate, setSelectedDate] = useState(TODAY);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(startOfMonth(TODAY));
  const [viewMode, setViewMode] = useState("adult");
  const [meals, setMeals] = useState(MEALS_SEED);
  const [waterData, setWaterData] = useState(WATER_SEED);
  const [isDark, setIsDark] = useState(true);
  const [lang, setLang] = useState("no");
  const t = (key, ...args) => translate(lang, key, ...args);

  const selectedDateIso = toISODate(selectedDate);
  const dayMeals = meals.filter((m) => m.date === selectedDateIso);
  const dayWater = waterData[selectedDateIso] || { total: 0, log: [] };
  const selectedMeal = meals.find((m) => m.id === selectedMealId) || null;

  const handleSaveMeal = (items) => {
    const newMeal = {
      id: `m-${Date.now()}`,
      time: new Date().toLocaleTimeString("no-NO", { hour: "2-digit", minute: "2-digit" }),
      date: TODAY_ISO,
      title: "Nytt måltid",
      itemsDetailed: items.map((it) => ({ foodId: it.foodId, grams: it.grams })),
      tags: [
        { no: "Fint sammensatt måltid", en: "Well-composed meal" },
        { no: "God variasjon", en: "Good variety" },
      ],
    };
    setMeals((prev) => [newMeal, ...prev]);
    setSelectedMealId(null);
    setDagView("list");
    setSelectedDate(TODAY);
    setCalendarOpen(false);
    setTab("dagsoversikt");
  };

  const handleAddWater = (ml) => {
    if (selectedDateIso !== TODAY_ISO) return; // only today can be edited
    setWaterData((prev) => {
      const existing = prev[selectedDateIso] || { total: 0, log: [] };
      return {
        ...prev,
        [selectedDateIso]: {
          total: existing.total + ml,
          log: [
            { id: Date.now(), ml, time: new Date().toLocaleTimeString("no-NO", { hour: "2-digit", minute: "2-digit" }) },
            ...existing.log,
          ],
        },
      };
    });
  };

  const handleTab = (key) => {
    setTab(key);
    setDagView("list");
    setSelectedMealId(null);
    setSelectedDate(TODAY);
    setCalendarMonth(startOfMonth(TODAY));
    setCalendarOpen(false);
  };

  const handleLogout = () => {
    setLoggedIn(false);
    setTab("kamera");
    setDagView("list");
    setSelectedMealId(null);
    setSelectedDate(TODAY);
    setCalendarOpen(false);
  };

  const goPrevDay = () => {
    const d = addDays(selectedDate, -1);
    setSelectedDate(d);
    setCalendarMonth(startOfMonth(d));
  };

  const goNextDay = () => {
    if (selectedDateIso === TODAY_ISO) return;
    const d = addDays(selectedDate, 1);
    setSelectedDate(d);
    setCalendarMonth(startOfMonth(d));
  };

  const selectDateFromCalendar = (date) => {
    setSelectedDate(date);
    setCalendarMonth(startOfMonth(date));
    setCalendarOpen(false);
  };

  const dateLabelForWater = selectedDateIso === TODAY_ISO ? t("today") : formatDayDate(selectedDate, lang);

  return (
    <LanguageContext.Provider value={lang}>
    <ThemeContext.Provider value={isDark}>
    <div className="min-h-screen w-full bg-slate-100 flex items-center justify-center p-4 font-sans">
      <div
        style={{ width: "min(380px, 92vw)", height: "min(780px, 90vh)", borderRadius: "2.5rem" }}
        className={cx("bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 shadow-xl relative overflow-hidden flex flex-col", isDark)}
      >
        {!(loggedIn && tab === "kamera") && (
          <div className="flex items-center justify-between px-5 pt-3 pb-1 shrink-0">
            <span className={cx("text-xs text-slate-400 dark:text-slate-500", isDark)}>9:41</span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setLang((l) => (l === "no" ? "en" : "no"))}
                title={lang === "no" ? "Switch to English" : "Bytt til norsk"}
                className={cx(
                  "px-2 h-7 rounded-full flex items-center justify-center text-xs font-semibold text-slate-500 dark:text-slate-300 bg-slate-200 dark:bg-slate-800",
                  isDark
                )}
              >
                {lang === "no" ? "EN" : "NO"}
              </button>
              <button
                onClick={() => setIsDark((d) => !d)}
                title={isDark ? t("toggleDarkOn") : t("toggleDarkOff")}
                className={cx("w-7 h-7 rounded-full flex items-center justify-center text-slate-500 dark:text-slate-300 bg-slate-200 dark:bg-slate-800", isDark)}
              >
                {isDark ? <Sun size={13} /> : <Moon size={13} />}
              </button>
            </div>
          </div>
        )}

        {!loggedIn ? (
          <div className="flex-1 overflow-hidden">
            <LoginScreen onLogin={() => setLoggedIn(true)} onSkip={() => setLoggedIn(true)} />
          </div>
        ) : (
          <>
            <div className={`flex-1 ${tab === "kamera" ? "overflow-hidden" : "overflow-y-auto pb-2"}`}>
              {tab === "kamera" && <KameraTab onSaveMeal={handleSaveMeal} />}
              {tab === "dagsoversikt" && dagView === "mealDetail" && selectedMeal && (
                <MealDetailScreen
                  meal={selectedMeal}
                  viewMode={viewMode}
                  onBack={() => {
                    setDagView("list");
                    setSelectedMealId(null);
                  }}
                />
              )}
              {tab === "dagsoversikt" && dagView === "search" && (
                <SearchScreen viewMode={viewMode} onBack={() => setDagView("list")} />
              )}
              {tab === "dagsoversikt" && dagView === "water" && (
                <WaterScreen
                  total={dayWater.total}
                  log={dayWater.log}
                  onAddWater={handleAddWater}
                  onBack={() => setDagView("list")}
                  dateLabel={dateLabelForWater}
                  readOnly={selectedDateIso !== TODAY_ISO}
                />
              )}
              {tab === "dagsoversikt" && dagView === "list" && (
                <MealsScreen
                  viewMode={viewMode}
                  selectedDate={selectedDate}
                  calendarOpen={calendarOpen}
                  calendarMonth={calendarMonth}
                  onPrevDay={goPrevDay}
                  onNextDay={goNextDay}
                  onToggleCalendar={() => setCalendarOpen((o) => !o)}
                  onPrevMonth={() => setCalendarMonth((m) => addMonths(m, -1))}
                  onNextMonth={() => setCalendarMonth((m) => (isSameMonth(m, TODAY) ? m : addMonths(m, 1)))}
                  onSelectDate={selectDateFromCalendar}
                  dayMeals={dayMeals}
                  waterTotal={dayWater.total}
                  onGoWater={() => {
                    setCalendarOpen(false);
                    setDagView("water");
                  }}
                  onGoSearch={() => {
                    setCalendarOpen(false);
                    setDagView("search");
                  }}
                  onOpenMeal={(id) => {
                    setCalendarOpen(false);
                    setSelectedMealId(id);
                    setDagView("mealDetail");
                  }}
                />
              )}
              {tab === "profile" && <ProfileScreen viewMode={viewMode} setViewMode={setViewMode} onLogout={handleLogout} />}
            </div>

            <div className={cx("shrink-0 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-2.5 flex justify-between", isDark)}>
              {TABS.map((tb) => {
                const Icon = tb.icon;
                const active = tab === tb.key;
                return (
                  <button
                    key={tb.key}
                    onClick={() => handleTab(tb.key)}
                    className="flex-1 flex items-center justify-center py-1"
                  >
                    <Icon size={22} className={active ? "text-indigo-600" : cx("text-slate-300 dark:text-slate-600", isDark)} />
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
    </ThemeContext.Provider>
    </LanguageContext.Provider>
  );
}
