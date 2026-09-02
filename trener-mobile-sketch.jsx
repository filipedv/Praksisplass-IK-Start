import { useState, useId, createContext, useContext } from "react";
import {
  Search,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  ChevronRight as ChevronRightIcon,
  Clock,
  TrendingDown,
  AlertTriangle,
  Check,
  X,
  User,
  Users,
  ClipboardList,
  NotebookPen,
  Droplet,
  Trash2,
  Sun,
  Moon,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Dark mode + language — same JS-driven approach as the desktop dashboard
// (Tailwind's dark: variant follows OS preference here, not a manual
// toggle, so this is resolved at render time instead).
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
  sketchLabel: { no: "Skisse · trener (mobil)", en: "Sketch · coach (mobile)" },
  toggleDarkOn: { no: "Slå av mørk modus", en: "Turn off dark mode" },
  toggleDarkOff: { no: "Slå på mørk modus", en: "Turn on dark mode" },
  todoHeading: { no: "Trenger oppfølging", en: "Needs Follow-up" },
  todoSubtitle: { no: (n, total) => `${n} av ${total} har logget mat i dag`, en: (n, total) => `${n} of ${total} have logged food today` },
  todoEmpty: { no: "Ingen spillere trenger oppfølging akkurat nå. 🎉", en: "No players need follow-up right now. 🎉" },
  playersHeading: { no: "Spillere", en: "Players" },
  searchPlaceholder: { no: "Søk etter spiller…", en: "Search for a player…" },
  noPlayersFound: { no: "Ingen spillere funnet.", en: "No players found." },
  loggedTodayPill: { no: "I dag", en: "Today" },
  lastLoggedPill: { no: (n) => `${n}d siden`, en: (n) => `${n}d ago` },
  criticalInfoHeading: { no: "Kritisk informasjon", en: "Critical Information" },
  noAllergies: { no: "Ingen registrerte allergier eller restriksjoner.", en: "No registered allergies or restrictions." },
  addPlaceholder: { no: "Legg til…", en: "Add…" },
  addLabel: { no: "Legg til", en: "Add" },
  noMealsThisDay: { no: "Ingen måltider registrert denne dagen.", en: "No meals logged this day." },
  notesHeading: { no: "Notater", en: "Notes" },
  notePlaceholder: { no: "Skriv et notat…", en: "Write a note…" },
  noNotes: { no: "Ingen notater ennå.", en: "No notes yet." },
  tabTodo: { no: "Oppfølging", en: "Follow-up" },
  tabPlayers: { no: "Spillere", en: "Players" },
  carbsLabel: { no: "Karbo", en: "Carbs" },
  fatLabel: { no: "Fett", en: "Fat" },
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
// Only the fabricated demo values are translated — anything a coach
// actually types into these fields later stays exactly as written.
const ALLERGY_LABELS = {
  Nøtteallergi: { no: "Nøtteallergi", en: "Nut allergy" },
  Laktoseintolerant: { no: "Laktoseintolerant", en: "Lactose intolerant" },
  "Cøliaki (gluten)": { no: "Cøliaki (gluten)", en: "Coeliac (gluten)" },
  Vegetarianer: { no: "Vegetarianer", en: "Vegetarian" },
};
function allergyLabel(text, lang) {
  return ALLERGY_LABELS[text]?.[lang] || text;
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
  "Melk, lettmelk": "Milk, semi-skimmed",
  "Kjøttkaker i brun saus": "Meatballs in brown sauce",
};
function foodNameLabel(name, lang) {
  return lang === "en" ? FOOD_LABELS_EN[name] || name : name;
}

// ---------------------------------------------------------------------------
// Self-contained mock data — same shape as the desktop dashboard, trimmed to
// what a stripped-down mobile view actually needs. No per-player goal
// tuning here (goal-tuning stays desktop-only), so status always uses the
// same flat default target.
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
function foodById(id) {
  return FOODS.find((f) => f.id === id);
}
function mealTotals(itemsDetailed) {
  const sum = (fn) => Math.round(itemsDetailed.reduce((s, it) => s + (foodById(it.foodId)[fn] / 100) * it.grams, 0));
  return { kcal: sum("kcal"), protein: sum("protein"), carbs: sum("carbs"), fat: sum("fat") };
}

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

const TODAY = new Date(2026, 7, 19);
const TODAY_ISO = toISODate(TODAY);

function pseudoRandom(seed) {
  const x = Math.sin(seed * 999) * 10000;
  return x - Math.floor(x);
}

const WATER_GOAL_ML = 2500;
const GLASS_ML = 500;
const GLASS_GOAL = Math.round(WATER_GOAL_ML / GLASS_ML);
function glassFill(waterMl, index) {
  const amount = Math.min(Math.max(waterMl - index * GLASS_ML, 0), GLASS_ML);
  return amount / GLASS_ML;
}

const TARGET_KCAL = 2800;
const DEFAULT_GOALS = { kcalGoal: TARGET_KCAL, waterGoal: WATER_GOAL_ML };
function computeStatus(kcal, waterMl) {
  if (!kcal) return "gray";
  const kcalFrac = Math.min(kcal / DEFAULT_GOALS.kcalGoal, 1);
  const waterFrac = Math.min((waterMl || 0) / DEFAULT_GOALS.waterGoal, 1);
  const score = (kcalFrac + waterFrac) / 2;
  if (score >= 0.85) return "green";
  if (score >= 0.5) return "orange";
  return "red";
}

const AVATAR_TONES = [
  "bg-emerald-100 text-emerald-700",
  "bg-blue-100 text-blue-700",
  "bg-amber-100 text-amber-700",
  "bg-violet-100 text-violet-700",
  "bg-rose-100 text-rose-700",
  "bg-cyan-100 text-cyan-700",
];

const PLAYERS = [
  { id: "p1", name: "Fatima Ali", team: "A-lag", position: "Spiss", lastLoggedDaysAgo: 0, baseWeight: 63, allergies: ["Nøtteallergi"] },
  { id: "p2", name: "Kasper Dahl", team: "A-lag", position: "Midtbane", lastLoggedDaysAgo: 0, baseWeight: 78, allergies: [] },
  { id: "p3", name: "Jonas Reme", team: "A-lag", position: "Forsvar", lastLoggedDaysAgo: 2, baseWeight: 82, allergies: ["Laktoseintolerant"] },
  { id: "p4", name: "Noah Berg", team: "G19", position: "Forsvar", lastLoggedDaysAgo: 1, baseWeight: 74, allergies: [] },
  { id: "p5", name: "Sander Lie", team: "G19", position: "Keeper", lastLoggedDaysAgo: 0, baseWeight: 76, allergies: ["Cøliaki (gluten)"] },
  { id: "p6", name: "Magnus Solberg", team: "G19", position: "Spiss", lastLoggedDaysAgo: 5, baseWeight: 70, allergies: [] },
  { id: "p7", name: "Emil Haugen", team: "G16", position: "Midtbane", lastLoggedDaysAgo: 3, baseWeight: 61, allergies: ["Vegetarianer"] },
  { id: "p8", name: "Oliver Nystrøm", team: "G16", position: "Spiss", lastLoggedDaysAgo: 0, baseWeight: 58, allergies: [] },
];
const INITIAL_ALLERGIES = {};
PLAYERS.forEach((p) => {
  INITIAL_ALLERGIES[p.id] = p.allergies;
});

const MEAL_COMBOS = [
  [{ foodId: "f2", grams: 150 }, { foodId: "f4", grams: 180 }],
  [{ foodId: "f3", grams: 125 }, { foodId: "f5", grams: 100 }],
  [{ foodId: "f1", grams: 50 }, { foodId: "f6", grams: 120 }],
  [{ foodId: "f7", grams: 120 }, { foodId: "f9", grams: 200 }],
  [{ foodId: "f10", grams: 200 }, { foodId: "f4", grams: 150 }],
];
const TODAY_MEALS = {};
const TODAY_WATER = {};
PLAYERS.forEach((p, i) => {
  if (p.lastLoggedDaysAgo === 0) {
    TODAY_MEALS[p.id] = [{ id: `${p.id}-m1`, time: "12:30", title: "Lunsj", itemsDetailed: MEAL_COMBOS[i % MEAL_COMBOS.length] }];
    TODAY_WATER[p.id] = [900, 1600, 1300, 2200][i % 4];
  }
});

// Same weight-drop injection as the desktop dashboard, so the mobile to-do
// list can demonstrate the same alert.
function initialWeights(baseWeight, seed) {
  const points = [];
  for (let m = 6; m >= 0; m--) {
    const date = addMonths(TODAY, -m);
    const noise = pseudoRandom(seed + m);
    points.push({ date: toISODate(date), weightKg: Math.round((baseWeight - m * 0.5 + (noise - 0.5) * 0.6) * 10) / 10 });
  }
  return points;
}
const MEASUREMENTS = {};
PLAYERS.forEach((p, i) => {
  MEASUREMENTS[p.id] = initialWeights(p.baseWeight, i + 1);
});
{
  const magnus = MEASUREMENTS["p6"];
  const latest = magnus[magnus.length - 1];
  const prev = magnus[magnus.length - 2];
  latest.weightKg = Math.round((prev.weightKg - 3) * 10) / 10;
}

function detectWeightAlert(measurements) {
  const withWeight = measurements.filter((m) => m.weightKg != null).sort((a, b) => (a.date < b.date ? -1 : 1));
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

function getPlayerTodayStatus(playerId) {
  const meals = TODAY_MEALS[playerId] || [];
  const kcal = meals.reduce((s, m) => s + mealTotals(m.itemsDetailed).kcal, 0);
  const water = TODAY_WATER[playerId] || 0;
  return computeStatus(kcal, water);
}
function getRecentRedCount(playerId) {
  let count = 0;
  for (let d = 0; d < 7; d++) {
    const iso = toISODate(addDays(TODAY, -d));
    const status = iso === TODAY_ISO ? getPlayerTodayStatus(playerId) : STATUS_HISTORY[playerId]?.[iso] || "gray";
    if (status === "red") count++;
  }
  return count;
}

const INITIAL_NOTES = {
  p3: [{ id: "n1", date: "2026-08-12", text: "Nevnte lett kneplage etter tirsdagens økt. Følg opp med fysio." }],
  p6: [{ id: "n2", date: "2026-08-14", text: "Har logget sjeldnere siste uken. Ta en prat om rutiner." }],
};

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
    <div className="flex flex-col items-center flex-1 gap-1">
      <span className={cx("text-lg font-bold text-slate-900 dark:text-white", isDark)}>
        {value}
        {unit && <span className={cx("text-xs font-medium text-slate-400 dark:text-slate-500 ml-0.5", isDark)}>{unit}</span>}
      </span>
      <span className={cx("text-xs text-slate-400 dark:text-slate-500", isDark)}>{label}</span>
      <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
    </div>
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

// ---------------------------------------------------------------------------
// Oppfølging — the home tab. Same to-do logic as desktop, checkbox to
// dismiss. This is the first thing a coach should see on their phone.
// ---------------------------------------------------------------------------

function TodoTab({ dismissedTodos, onDismiss, onOpenPlayer }) {
  const isDark = useIsDark();
  const lang = useLang();
  const t = useT();
  const [checkingIds, setCheckingIds] = useState(new Set());

  const handleCheck = (id) => {
    setCheckingIds((prev) => new Set(prev).add(id));
    setTimeout(() => onDismiss(id), 350);
  };

  const todoItems = [];
  PLAYERS.forEach((p) => {
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
    const weightAlert = detectWeightAlert(MEASUREMENTS[p.id] || []);
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
    const redCount = getRecentRedCount(p.id);
    if (redCount >= 4) {
      todoItems.push({
        id: `nutrition:${p.id}`,
        type: "nutrition",
        playerId: p.id,
        priority: 70 + redCount,
        text:
          lang === "en"
            ? `${p.name} has been far from the nutrition goal on ${redCount} of the last 7 days.`
            : `${p.name} har vært langt fra ernæringsmålet ${redCount} av siste 7 dager.`,
      });
    }
  });
  const visible = todoItems.filter((i) => !dismissedTodos.has(i.id));
  visible.sort((a, b) => b.priority - a.priority);
  const ICONS = { logging: Clock, weight: TrendingDown, nutrition: AlertTriangle };

  const loggedToday = PLAYERS.filter((p) => p.lastLoggedDaysAgo === 0).length;

  return (
    <div className="px-4 pb-4">
      <div className="pt-3 pb-2">
        <p className={cx("text-xs text-slate-400 dark:text-slate-500", isDark)}>{formatDayDate(TODAY, lang)}</p>
        <h1 className={cx("text-lg font-bold text-slate-900 dark:text-white", isDark)}>{t("todoHeading")}</h1>
        <p className={cx("text-xs text-slate-400 dark:text-slate-500 mt-0.5", isDark)}>{t("todoSubtitle", loggedToday, PLAYERS.length)}</p>
      </div>

      {visible.length === 0 ? (
        <Card className="p-6 text-center">
          <p className={cx("text-sm text-slate-500 dark:text-slate-400", isDark)}>{t("todoEmpty")}</p>
        </Card>
      ) : (
        <div className="space-y-2 mt-2">
          {visible.map((item) => {
            const Icon = ICONS[item.type];
            return (
              <div
                key={item.id}
                className={cx("w-full flex items-center gap-3 px-3.5 py-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700", isDark)}
              >
                <button onClick={() => onOpenPlayer(item.playerId)} className="flex items-start gap-3 text-left flex-1 min-w-0">
                  <Icon size={16} className="text-amber-500 shrink-0 mt-0.5" />
                  <span className={cx("text-sm text-slate-700 dark:text-slate-200", isDark)}>{item.text}</span>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCheck(item.id);
                  }}
                  className={cx(
                    `shrink-0 w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors ${
                      checkingIds.has(item.id)
                        ? "bg-emerald-500 border-emerald-500"
                        : "bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-600"
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
    </div>
  );
}

// ---------------------------------------------------------------------------
// Spillere — search + list, sorted needs-attention-first (fixed, no picker,
// keeping this screen simple on a small display).
// ---------------------------------------------------------------------------

function PlayersTab({ onOpenPlayer }) {
  const isDark = useIsDark();
  const lang = useLang();
  const t = useT();
  const [query, setQuery] = useState("");
  const filtered = PLAYERS.filter((p) => p.name.toLowerCase().includes(query.toLowerCase())).sort(
    (a, b) => b.lastLoggedDaysAgo - a.lastLoggedDaysAgo || a.name.localeCompare(b.name, "no")
  );

  return (
    <div className="px-4 pb-4">
      <h1 className={cx("text-lg font-bold text-slate-900 dark:text-white pt-3 pb-3", isDark)}>{t("playersHeading")}</h1>
      <div className={cx("flex items-center gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 mb-3", isDark)}>
        <Search size={16} className={cx("text-slate-400 dark:text-slate-500", isDark)} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("searchPlaceholder")}
          className={cx("bg-transparent outline-none text-sm flex-1 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500", isDark)}
        />
      </div>
      <Card className="divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
        {filtered.map((p) => {
          const avatarIndex = PLAYERS.findIndex((pl) => pl.id === p.id);
          const loggedToday = p.lastLoggedDaysAgo === 0;
          return (
            <button key={p.id} onClick={() => onOpenPlayer(p.id)} className="w-full flex items-center justify-between px-4 py-3.5">
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold ${AVATAR_TONES[avatarIndex % AVATAR_TONES.length]}`}>
                  {p.name.split(" ").map((n) => n[0]).join("")}
                </div>
                <div className="text-left">
                  <p className={cx("text-sm font-medium text-slate-800 dark:text-slate-100", isDark)}>{p.name}</p>
                  <p className={cx("text-xs text-slate-400 dark:text-slate-500", isDark)}>
                    {p.team} · {positionLabel(p.position, lang)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={cx(
                    `text-xs font-medium px-2 py-0.5 rounded-full ${
                      loggedToday
                        ? "bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400"
                        : "bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-400"
                    }`,
                    isDark
                  )}
                >
                  {loggedToday ? t("loggedTodayPill") : t("lastLoggedPill", p.lastLoggedDaysAgo)}
                </span>
                <ChevronRightIcon size={14} className={cx("text-slate-300 dark:text-slate-600", isDark)} />
              </div>
            </button>
          );
        })}
        {filtered.length === 0 && <p className={cx("text-center text-sm text-slate-400 dark:text-slate-500 py-8", isDark)}>{t("noPlayersFound")}</p>}
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Player detail — critical info, a simplified Dagsoversikt (today only,
// prev/next day, no month calendar), and quick notes. No graphs, no
// measurement entry, no goal-tuning — those stay on the desktop dashboard.
// ---------------------------------------------------------------------------

function PlayerDetail({ player, onBack, allergies, setAllergies, notes, setNotes }) {
  const isDark = useIsDark();
  const lang = useLang();
  const t = useT();
  const [selectedDate, setSelectedDate] = useState(TODAY);
  const [allergyText, setAllergyText] = useState("");
  const [noteText, setNoteText] = useState("");

  const selectedDateIso = toISODate(selectedDate);
  const dayMeals = selectedDateIso === TODAY_ISO ? TODAY_MEALS[player.id] || [] : [];
  const dayWater = selectedDateIso === TODAY_ISO ? TODAY_WATER[player.id] || 0 : 0;
  const dayTotals = dayMeals.reduce(
    (acc, m) => {
      const t = mealTotals(m.itemsDetailed);
      return { kcal: acc.kcal + t.kcal, protein: acc.protein + t.protein, carbs: acc.carbs + t.carbs, fat: acc.fat + t.fat };
    },
    { kcal: 0, protein: 0, carbs: 0, fat: 0 }
  );
  const canGoNext = selectedDateIso !== TODAY_ISO;

  const addAllergy = () => {
    if (!allergyText.trim()) return;
    setAllergies((prev) => [...prev, allergyText.trim()]);
    setAllergyText("");
  };
  const removeAllergy = (i) => setAllergies((prev) => prev.filter((_, idx) => idx !== i));

  const addNote = () => {
    if (!noteText.trim()) return;
    setNotes((prev) => [{ id: `n-${Date.now()}`, date: TODAY_ISO, text: noteText.trim() }, ...prev]);
    setNoteText("");
  };
  const removeNote = (id) => setNotes((prev) => prev.filter((n) => n.id !== id));

  return (
    <div className="px-4 pb-4">
      <div className="flex items-center gap-2 pt-3 pb-3">
        <button onClick={onBack} className={cx("p-1 -ml-1 text-slate-500 dark:text-slate-300", isDark)}>
          <ArrowLeft size={20} />
        </button>
        <div className={cx("w-9 h-9 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-300", isDark)}>
          <User size={16} />
        </div>
        <div>
          <p className={cx("text-sm font-semibold text-slate-900 dark:text-white", isDark)}>{player.name}</p>
          <p className={cx("text-xs text-slate-400 dark:text-slate-500", isDark)}>
            {player.team} · {positionLabel(player.position, lang)}
          </p>
        </div>
      </div>

      {/* Critical info */}
      <Card className="p-4 mb-4">
        <h3 className={cx("text-sm font-bold text-slate-900 dark:text-white mb-2.5 flex items-center gap-1.5", isDark)}>
          <AlertTriangle size={14} className={cx("text-slate-400 dark:text-slate-500", isDark)} /> {t("criticalInfoHeading")}
        </h3>
        <div className="flex flex-wrap gap-1.5 mb-2.5">
          {allergies.length === 0 && <p className={cx("text-xs text-slate-500 dark:text-slate-400", isDark)}>{t("noAllergies")}</p>}
          {allergies.map((a, i) => (
            <span key={i} className={cx("inline-flex items-center gap-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-medium px-2.5 py-1 rounded-full", isDark)}>
              {allergyLabel(a, lang)}
              <button onClick={() => removeAllergy(i)} className={cx("text-slate-400 dark:text-slate-500", isDark)}>
                <X size={11} />
              </button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            value={allergyText}
            onChange={(e) => setAllergyText(e.target.value)}
            placeholder={t("addPlaceholder")}
            className={cx("flex-1 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white rounded-lg px-3 py-2 text-sm outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500", isDark)}
            onKeyDown={(e) => e.key === "Enter" && addAllergy()}
          />
          <button onClick={addAllergy} className="bg-indigo-600 text-white rounded-lg px-3 text-sm font-medium">
            {t("addLabel")}
          </button>
        </div>
      </Card>

      {/* Simplified Dagsoversikt */}
      <Card className="p-4 mb-4">
        <div className="flex items-center justify-center gap-3 mb-3">
          <button onClick={() => setSelectedDate((d) => addDays(d, -1))} className={cx("w-7 h-7 flex items-center justify-center text-slate-500 dark:text-slate-300", isDark)}>
            <ChevronLeft size={16} />
          </button>
          <h2 className={cx("text-sm font-semibold text-slate-900 dark:text-white", isDark)}>{formatDayDate(selectedDate, lang)}</h2>
          <button
            onClick={() => canGoNext && setSelectedDate((d) => addDays(d, 1))}
            disabled={!canGoNext}
            className={cx(`w-7 h-7 flex items-center justify-center ${canGoNext ? "text-slate-500 dark:text-slate-300" : "text-transparent pointer-events-none"}`, isDark)}
          >
            <ChevronRight size={16} />
          </button>
        </div>

        <div className="flex justify-between max-w-xs mx-auto">
          <StatBlock value={dayTotals.kcal} label="kcal" dot="bg-emerald-500" />
          <StatBlock value={dayTotals.protein} unit="g" label="Protein" dot="bg-blue-500" />
          <StatBlock value={dayTotals.carbs} unit="g" label={t("carbsLabel")} dot="bg-amber-400" />
          <StatBlock value={dayTotals.fat} unit="g" label={t("fatLabel")} dot="bg-violet-500" />
        </div>

        <div className={cx("flex items-center justify-between mt-4 pt-3 border-t border-slate-100 dark:border-slate-800", isDark)}>
          <div className="flex items-center gap-2">
            <Droplet size={14} className="text-blue-500" />
            <span className={cx("text-xs font-medium text-slate-700 dark:text-slate-300", isDark)}>
              {dayWater}/{WATER_GOAL_ML} ml
            </span>
          </div>
          <GlassRow water={dayWater} size={13} />
        </div>

        <div className={cx("mt-4 pt-3 border-t border-slate-100 dark:border-slate-800", isDark)}>
          {dayMeals.length === 0 ? (
            <p className={cx("text-xs text-slate-400 dark:text-slate-500", isDark)}>{t("noMealsThisDay")}</p>
          ) : (
            <div className="space-y-2">
              {dayMeals.map((m) => {
                const mt = mealTotals(m.itemsDetailed);
                return (
                  <div key={m.id} className="flex items-center justify-between">
                    <div>
                      <p className={cx("text-xs font-medium text-slate-800 dark:text-slate-100", isDark)}>
                        {mealTitleLabel(m.title, lang)} <span className={cx("text-slate-400 dark:text-slate-500 font-normal", isDark)}>· {m.time}</span>
                      </p>
                      <p className={cx("text-xs text-slate-400 dark:text-slate-500", isDark)}>
                        {m.itemsDetailed.map((it) => foodNameLabel(foodById(it.foodId).name, lang)).join(", ")}
                      </p>
                    </div>
                    <span className={cx("text-xs font-semibold text-slate-700 dark:text-slate-300", isDark)}>{mt.kcal} kcal</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Card>

      {/* Quick notes */}
      <Card className="p-4">
        <h3 className={cx("text-sm font-bold text-slate-900 dark:text-white mb-2.5 flex items-center gap-1.5", isDark)}>
          <NotebookPen size={14} className={cx("text-slate-400 dark:text-slate-500", isDark)} /> {t("notesHeading")}
        </h3>
        <div className="flex gap-2 mb-3">
          <input
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder={t("notePlaceholder")}
            className={cx("flex-1 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white rounded-lg px-3 py-2 text-sm outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500", isDark)}
            onKeyDown={(e) => e.key === "Enter" && addNote()}
          />
          <button onClick={addNote} className="bg-indigo-600 text-white rounded-lg px-3 text-sm font-medium">
            {t("addLabel")}
          </button>
        </div>
        <div className="space-y-2">
          {notes.length === 0 && <p className={cx("text-xs text-slate-400 dark:text-slate-500", isDark)}>{t("noNotes")}</p>}
          {notes.map((n) => (
            <div key={n.id} className={cx("bg-slate-50 dark:bg-slate-800 rounded-lg px-3 py-2 flex items-start justify-between gap-2", isDark)}>
              <div>
                <p className={cx("text-xs text-slate-400 dark:text-slate-500 mb-0.5", isDark)}>{n.date}</p>
                <p className={cx("text-sm text-slate-700 dark:text-slate-200", isDark)}>{n.text}</p>
              </div>
              <button onClick={() => removeNote(n.id)} className={cx("text-slate-300 dark:text-slate-600 shrink-0", isDark)}>
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Root app
// ---------------------------------------------------------------------------

export default function App() {
  const [tab, setTab] = useState("todo");
  const [selectedPlayerId, setSelectedPlayerId] = useState(null);
  const [dismissedTodos, setDismissedTodos] = useState(new Set());
  const [allergiesByPlayer, setAllergiesByPlayer] = useState(INITIAL_ALLERGIES);
  const [notesByPlayer, setNotesByPlayer] = useState(INITIAL_NOTES);
  const [isDark, setIsDark] = useState(false);
  const [lang, setLang] = useState("no");
  const t = (key, ...args) => translate(lang, key, ...args);

  const player = PLAYERS.find((p) => p.id === selectedPlayerId) || null;

  const TABS = [
    { key: "todo", label: t("tabTodo"), icon: ClipboardList },
    { key: "players", label: t("tabPlayers"), icon: Users },
  ];

  return (
    <LanguageContext.Provider value={lang}>
    <ThemeContext.Provider value={isDark}>
    <div className="min-h-screen w-full bg-slate-100 flex items-center justify-center p-4 font-sans">
      <div
        style={{ width: "min(380px, 92vw)", height: "min(780px, 90vh)", borderRadius: "2.5rem" }}
        className={cx("bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 shadow-xl relative overflow-hidden flex flex-col", isDark)}
      >
        <div className="flex items-center justify-between px-5 pt-3 pb-1.5 shrink-0">
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

        <div className="flex-1 overflow-y-auto pb-2">
          {player ? (
            <PlayerDetail
              player={player}
              onBack={() => setSelectedPlayerId(null)}
              allergies={allergiesByPlayer[player.id] || []}
              setAllergies={(updater) =>
                setAllergiesByPlayer((prev) => ({
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
            />
          ) : tab === "todo" ? (
            <TodoTab
              dismissedTodos={dismissedTodos}
              onDismiss={(id) => setDismissedTodos((prev) => new Set(prev).add(id))}
              onOpenPlayer={setSelectedPlayerId}
            />
          ) : (
            <PlayersTab onOpenPlayer={setSelectedPlayerId} />
          )}
        </div>

        {!player && (
          <div className={cx("shrink-0 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-2 flex justify-between", isDark)}>
            {TABS.map((tb) => {
              const Icon = tb.icon;
              const active = tab === tb.key;
              return (
                <button key={tb.key} onClick={() => setTab(tb.key)} className="flex-1 flex flex-col items-center gap-0.5 py-1">
                  <Icon size={20} className={active ? "text-indigo-600" : "text-slate-300"} />
                  <span className={`text-xs ${active ? "text-indigo-600 font-medium" : "text-slate-300"}`}>{tb.label}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
    </ThemeContext.Provider>
    </LanguageContext.Provider>
  );
}
