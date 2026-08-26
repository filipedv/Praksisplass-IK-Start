import { useState, useId } from "react";
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
} from "lucide-react";

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
function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
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
function formatDayDate(date) {
  const s = date.toLocaleDateString("no-NO", { weekday: "long", day: "numeric", month: "long" });
  return s.charAt(0).toUpperCase() + s.slice(1);
}
function formatMonthYear(date) {
  const s = date.toLocaleDateString("no-NO", { month: "long", year: "numeric" });
  return s.charAt(0).toUpperCase() + s.slice(1);
}
function formatShortDate(date) {
  return date.toLocaleDateString("no-NO", { day: "numeric", month: "short" });
}

const TODAY = new Date(2026, 7, 19); // Onsdag 19. august — matches the app's existing sample content
const TODAY_ISO = toISODate(TODAY);
const YESTERDAY_ISO = toISODate(addDays(TODAY, -1));
const DAY_2_ISO = toISODate(addDays(TODAY, -2));
const DAY_3_ISO = toISODate(addDays(TODAY, -3));

// A few days of sample meals so date navigation has something to show.
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
    tags: ["Fin start på dagen", "God karbo før økt"],
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
    tags: ["Bra proteininntak", "Fint utgangspunkt"],
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
    tags: ["God balanse i måltidet", "Fin fiskemiddag"],
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
    tags: ["Fin karbokilde før trening"],
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
    tags: ["Bra proteininntak", "Fint etter økt"],
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
    tags: ["Fin start på dagen"],
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
    tags: ["Solid middag", "God variasjon over uka"],
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

function formatPortions(grams, portionGrams) {
  const p = grams / portionGrams;
  const rounded = Math.round(p * 2) / 2;
  return rounded.toString().replace(".", ",");
}

function mealTotals(itemsDetailed) {
  const sum = (fn) =>
    Math.round(itemsDetailed.reduce((s, it) => s + (foodById(it.foodId)[fn] / 100) * it.grams, 0));
  return { kcal: sum("kcal"), protein: sum("protein"), carbs: sum("carbs"), fat: sum("fat") };
}

function mealItemNames(itemsDetailed) {
  return itemsDetailed.map((it) => foodById(it.foodId).name);
}

// ---------------------------------------------------------------------------
// Small shared bits
// ---------------------------------------------------------------------------

function TopBar({ title, onBack }) {
  return (
    <div className="flex items-center justify-between px-4 pt-3 pb-2 shrink-0">
      <div className="w-8">
        {onBack && (
          <button onClick={onBack} className="p-1 -ml-1 text-slate-500 hover:text-slate-800">
            <ArrowLeft size={20} />
          </button>
        )}
      </div>
      <h1 className="text-base font-semibold text-slate-900 tracking-tight">{title}</h1>
      <div className="w-8" />
    </div>
  );
}

function Card({ children, className = "" }) {
  return <div className={`bg-white rounded-2xl border border-slate-200 shadow-sm ${className}`}>{children}</div>;
}

function Pill({ children, tone = "slate" }) {
  const tones = {
    slate: "bg-slate-100 text-slate-600",
    blue: "bg-blue-50 text-blue-700",
    green: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-800",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${tones[tone]}`}>
      {children}
    </span>
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
function StatBlock({ value, unit, label, dot }) {
  return (
    <div className="flex flex-col items-center flex-1 gap-1.5">
      <span className="text-xl font-bold text-slate-900">
        {value}
        {unit && <span className="text-xs font-medium text-slate-400 ml-0.5">{unit}</span>}
      </span>
      <span className="text-xs text-slate-400">{label}</span>
      <span className={`w-2 h-2 rounded-full ${dot}`} />
    </div>
  );
}

function NutritionStatGrid({ totals }) {
  return (
    <div className="flex justify-between">
      <StatBlock value={totals.kcal} label="kcal" dot="bg-emerald-500" />
      <StatBlock value={totals.protein} unit="g" label="Protein" dot="bg-blue-500" />
      <StatBlock value={totals.carbs} unit="g" label="Karbo" dot="bg-amber-400" />
      <StatBlock value={totals.fat} unit="g" label="Fett" dot="bg-violet-500" />
    </div>
  );
}

function Toggle({ checked, onChange }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`w-11 h-6 rounded-full relative transition-colors ${checked ? "bg-indigo-600" : "bg-slate-200"}`}
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
  return (
    <div className="h-full w-full flex flex-col items-center justify-center px-8 gap-6 bg-white">
      <div className="flex flex-col items-center gap-2">
        <div className="w-14 h-14 rounded-2xl bg-indigo-600 flex items-center justify-center text-white">
          <Utensils size={24} />
        </div>
        <h1 className="text-lg font-bold text-slate-900">Logg inn</h1>
        <p className="text-xs text-slate-400 text-center">Fyll inn relevant innloggingsdata for å fortsette</p>
      </div>
      <div className="w-full space-y-3">
        <input
          placeholder="E-post"
          className="w-full bg-slate-100 rounded-xl px-3.5 py-3 text-sm outline-none placeholder:text-slate-400"
        />
        <input
          placeholder="Passord"
          type="password"
          className="w-full bg-slate-100 rounded-xl px-3.5 py-3 text-sm outline-none placeholder:text-slate-400"
        />
      </div>
      <button onClick={onLogin} className="w-full bg-indigo-600 text-white rounded-xl py-3 text-sm font-medium">
        Logg inn
      </button>
      <button onClick={onSkip} className="text-xs text-slate-400 underline underline-offset-2">
        Fortsett uten innlogging (kun for denne skissen)
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Kameraskjerm (2) — persistent tab. Ta bilde -> Liste (3) -> Lagre?
// Ja -> lagre + gå til Dagsoversikt. Nei -> tilbake til kameraet.
// ---------------------------------------------------------------------------

function KameraTab({ onSaveMeal }) {
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
    <div className="h-full w-full flex flex-col bg-white relative">
      {step !== "capture" && (
        <TopBar
          title={step === "recognizing" ? "Analyserer" : step === "overview" ? "Registrert mat" : "Lagret"}
          onBack={step === "overview" ? discardAndRetake : undefined}
        />
      )}

      {step === "capture" && (
        <div className="flex-1 bg-black flex flex-col relative">
          <div className="flex-1 relative flex items-center justify-center overflow-hidden">
            <ImageIcon size={36} className="text-slate-600" />
            <span className="absolute top-6 left-0 right-0 text-center text-xs text-slate-400">
              Kamera-forhåndsvisning
            </span>
          </div>
          <div className="pt-10 pb-6 flex flex-col items-center gap-3 bg-gradient-to-t from-black/70 via-black/30 to-transparent">
            <p className="text-xs text-white/70 text-center px-8">
              Bildet sendes til gjenkjenning og lagres ikke — kun maten og næringsverdiene blir lagret.
            </p>
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
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-slate-500">
          <Loader2 size={28} className="animate-spin text-indigo-600" />
          <p className="text-sm">Kjenner igjen maten på bildet…</p>
        </div>
      )}

      {step === "overview" && (
        <div className="flex-1 flex flex-col relative overflow-hidden">
          <div className="flex-1 overflow-y-auto px-4 space-y-2">
            <p className="text-xs text-slate-400 mb-1">
              Dette fant vi i bildet. Juster mengde eller fjern varer ved behov.
            </p>

            {items.map((it) => {
              const food = foodById(it.foodId);
              return (
                <Card key={it.id} className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium text-slate-800">{food.name}</p>
                      {it.manual ? (
                        <Pill tone="slate">Lagt til manuelt</Pill>
                      ) : (
                        <Pill tone={it.confidence > 0.85 ? "green" : "amber"}>
                          {Math.round(it.confidence * 100)}% sikker
                        </Pill>
                      )}
                    </div>
                    <button onClick={() => removeItem(it.id)} className="text-slate-300 hover:text-red-500 p-1">
                      <Trash2 size={15} />
                    </button>
                  </div>

                  <div className="flex items-center justify-between mt-3">
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => updateGrams(it.id, it.grams - 10)}
                        className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-slate-500"
                      >
                        <Minus size={12} />
                      </button>
                      <input
                        value={it.grams}
                        onChange={(e) => updateGrams(it.id, Number(e.target.value) || 0)}
                        className="w-12 text-center text-sm outline-none"
                      />
                      <span className="text-xs text-slate-400">g</span>
                      <button
                        onClick={() => updateGrams(it.id, it.grams + 10)}
                        className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-slate-500"
                      >
                        <Plus size={12} />
                      </button>
                    </div>
                    <span className="text-xs text-slate-400">
                      ≈ {formatPortions(it.grams, food.portionGrams)} porsjon
                      {formatPortions(it.grams, food.portionGrams) === "1" ? "" : "er"}
                    </span>
                  </div>
                </Card>
              );
            })}

            {items.length === 0 && (
              <p className="text-center text-sm text-slate-400 pt-8">Ingen varer igjen — legg til mat under.</p>
            )}

            <button
              onClick={() => setShowPicker(true)}
              className="w-full flex items-center justify-center gap-1 py-2.5 text-sm text-indigo-600 font-medium border border-dashed border-indigo-200 rounded-xl"
            >
              <Plus size={14} /> Legg til mat som ikke ble oppdaget
            </button>
            <div className="h-2" />
          </div>

          <div className="p-4 pt-2 shrink-0">
            <button
              onClick={handleSave}
              disabled={items.length === 0}
              className="w-full bg-indigo-600 disabled:bg-slate-200 text-white disabled:text-slate-400 rounded-xl py-3 text-sm font-medium flex items-center justify-center gap-2"
            >
              <Check size={16} /> Lagre måltid
            </button>
          </div>

          {showPicker && (
            <div className="absolute inset-x-0 bottom-0 top-16 bg-white rounded-t-2xl shadow-2xl flex flex-col">
              <div className="flex items-center justify-between px-4 pt-3 pb-2">
                <span className="text-sm font-semibold text-slate-800">Legg til mat</span>
                <button onClick={() => setShowPicker(false)} className="text-slate-400 p-1">
                  <X size={16} />
                </button>
              </div>
              <div className="px-4 pb-2">
                <div className="flex items-center gap-2 bg-slate-100 rounded-xl px-3 py-2">
                  <Search size={14} className="text-slate-400" />
                  <input
                    autoFocus
                    value={pickerQuery}
                    onChange={(e) => setPickerQuery(e.target.value)}
                    placeholder="Søk i matvarer…"
                    className="bg-transparent outline-none text-sm flex-1 placeholder:text-slate-400"
                  />
                </div>
              </div>
              <div className="flex-1 overflow-y-auto px-4 space-y-1.5 pb-4">
                {pickerResults.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => addFood(f)}
                    className="w-full flex items-center justify-between bg-white border border-slate-200 rounded-xl px-3.5 py-2.5"
                  >
                    <span className="text-sm text-slate-700">{f.name}</span>
                    <span className="text-xs text-slate-400">1 porsjon = {f.portionGrams} g</span>
                  </button>
                ))}
                {pickerResults.length === 0 && (
                  <p className="text-center text-xs text-slate-400 pt-6">Ingen treff i Matvaretabellen.</p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {step === "saved" && (
        <div className="flex-1 flex flex-col items-center justify-center gap-3">
          <div className="w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center">
            <Check size={24} className="text-emerald-600" />
          </div>
          <p className="text-sm text-slate-500">Data sendes til database…</p>
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
  const canGoNext = toISODate(selectedDate) !== TODAY_ISO;
  return (
    <div className="flex items-center justify-between px-2 pt-3 pb-2">
      <button onClick={onPrevDay} className="w-9 h-9 flex items-center justify-center text-slate-500 shrink-0">
        <ChevronLeft size={20} />
      </button>
      <button onClick={onToggleCalendar} className="flex items-center gap-1 px-2 py-1">
        <span className="text-sm font-semibold text-slate-900">{formatDayDate(selectedDate)}</span>
        <ChevronDown size={14} className={`text-slate-400 transition-transform ${calendarOpen ? "rotate-180" : ""}`} />
      </button>
      <button
        onClick={onNextDay}
        disabled={!canGoNext}
        className={`w-9 h-9 flex items-center justify-center shrink-0 ${
          canGoNext ? "text-slate-500" : "text-transparent pointer-events-none"
        }`}
      >
        <ChevronRight size={20} />
      </button>
    </div>
  );
}

function MonthCalendar({ viewMonth, onPrevMonth, onNextMonth, selectedDate, onSelectDate }) {
  const canGoNextMonth = !isSameMonth(viewMonth, TODAY);
  const firstOfMonth = startOfMonth(viewMonth);
  const firstWeekday = (firstOfMonth.getDay() + 6) % 7; // Monday = 0
  const daysInMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 0).getDate();

  const cells = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(viewMonth.getFullYear(), viewMonth.getMonth(), d));
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div
      style={{ height: "min(260px, 32vh)" }}
      className="border-b border-slate-200 bg-white flex flex-col overflow-hidden shrink-0"
    >
      <div className="flex items-center justify-between px-4 pt-1 pb-1 shrink-0">
        <button onClick={onPrevMonth} className="w-8 h-8 flex items-center justify-center text-slate-500">
          <ChevronLeft size={18} />
        </button>
        <span className="text-sm font-semibold text-slate-900">{formatMonthYear(viewMonth)}</span>
        <button
          onClick={onNextMonth}
          disabled={!canGoNextMonth}
          className={`w-8 h-8 flex items-center justify-center ${
            canGoNextMonth ? "text-slate-500" : "text-transparent pointer-events-none"
          }`}
        >
          <ChevronRight size={18} />
        </button>
      </div>
      <div className="grid grid-cols-7 px-3 shrink-0">
        {["Ma", "Ti", "On", "To", "Fr", "Lø", "Sø"].map((w) => (
          <span key={w} className="text-xs text-slate-400 text-center py-1">
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
              className={`w-7 h-7 mx-auto rounded-full text-xs flex items-center justify-center ${
                future
                  ? "text-slate-300"
                  : isSelected
                  ? "bg-indigo-600 text-white font-semibold"
                  : isToday
                  ? "text-indigo-600 font-semibold"
                  : "text-slate-700"
              }`}
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
          className="w-full bg-white border border-slate-200 rounded-2xl px-4 py-3 flex items-center justify-between gap-3 active:scale-95 transition"
        >
          <div className="flex items-center gap-2.5">
            <Droplet size={18} className="text-blue-500 shrink-0" />
            <span className="text-sm font-medium text-slate-700">
              {waterTotal}/{WATER_GOAL_ML} ml
            </span>
          </div>
          <GlassRow water={waterTotal} size={20} />
        </button>

        <Card>
          <button onClick={onGoSearch} className="w-full flex items-center justify-between px-4 py-3.5">
            <div className="flex items-center gap-2.5">
              <Search size={16} className="text-slate-400" />
              <span className="text-sm text-slate-700">Søk i matvarer</span>
            </div>
            <ChevronRight size={14} className="text-slate-300" />
          </button>
        </Card>

        <div>
          <h3 className="text-sm font-bold text-slate-900 mb-2">Dagens oversikt</h3>
          <Card className="p-4">
            {viewMode === "adult" ? (
              <NutritionStatGrid totals={dayTotals} />
            ) : (
              <div className="flex flex-wrap gap-2">
                <Pill tone="green">Bra proteininntak i dag</Pill>
                <Pill tone="amber">Prøv å få i deg litt mer grønt</Pill>
                <Pill tone="blue">Husk å drikke vann jevnt</Pill>
              </div>
            )}
          </Card>
        </div>

        <div>
          <h3 className="text-sm font-bold text-slate-900 mb-2">Måltider</h3>
          <Card className="divide-y divide-slate-100">
            {dayMeals.map((m) => {
              const t = mealTotals(m.itemsDetailed);
              return (
                <button
                  key={m.id}
                  onClick={() => onOpenMeal(m.id)}
                  className="w-full flex items-center justify-between p-3.5"
                >
                  <div className="text-left">
                    <p className="text-sm font-medium text-slate-800">
                      {m.title} <span className="text-slate-400 font-normal">· {m.time}</span>
                    </p>
                    <p className="text-xs text-slate-400">{mealItemNames(m.itemsDetailed).join(", ")}</p>
                  </div>
                  {viewMode === "adult" ? (
                    <span className="text-sm font-semibold text-slate-700">{t.kcal} kcal</span>
                  ) : (
                    <Pill tone="green">OK</Pill>
                  )}
                </button>
              );
            })}
            {dayMeals.length === 0 && (
              <p className="text-center text-sm text-slate-400 py-6">Ingen måltider registrert denne dagen.</p>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

function MealDetailScreen({ meal, viewMode, onBack }) {
  const totals = mealTotals(meal.itemsDetailed);

  return (
    <div className="pb-4">
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <button onClick={onBack} className="p-1 -ml-1 text-slate-500">
          <ChevronLeft size={22} />
        </button>
        <h1 className="text-base font-bold text-slate-900">{meal.title}</h1>
        <button className="p-1 -mr-1 text-slate-400">
          <MoreHorizontal size={20} />
        </button>
      </div>

      <div className="px-4">
        <div className="relative h-52 rounded-3xl bg-gradient-to-br from-slate-200 to-slate-300 flex items-center justify-center overflow-hidden mb-4">
          <Utensils size={40} className="text-slate-400" />
          <span className="absolute bottom-3 left-3 bg-black/60 text-white text-xs rounded-full px-3 py-1 flex items-center gap-1.5">
            <Calendar size={12} />
            {formatShortDate(parseISODate(meal.date))} · {meal.time}
          </span>
          <span className="absolute top-3 right-3 bg-white/85 text-slate-500 text-xs rounded-full px-2.5 py-1">
            Bilde ikke lagret
          </span>
        </div>

        <h3 className="text-sm font-bold text-slate-900 mb-2">Næringsoversikt</h3>
        <Card className="p-4 mb-4">
          {viewMode === "adult" ? (
            <NutritionStatGrid totals={totals} />
          ) : (
            <div className="flex flex-wrap gap-2">
              {meal.tags.map((t, i) => (
                <Pill key={i} tone="green">
                  {t}
                </Pill>
              ))}
            </div>
          )}
        </Card>

        <h3 className="text-sm font-bold text-slate-900 mb-2">Måltidsvarer</h3>
        <Card className="divide-y divide-slate-100">
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
                    <p className="text-sm font-medium text-slate-800">{food.name}</p>
                    <p className="text-xs text-slate-400">{it.grams} g</p>
                  </div>
                </div>
                {viewMode === "adult" && <span className="text-sm font-semibold text-slate-700">{kcal} kcal</span>}
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
      <TopBar title="Søk i matvarer" onBack={onBack} />
      <div className="px-4">
        <div className="flex items-center gap-2 bg-slate-100 rounded-xl px-3 py-2 mb-3">
          <Search size={15} className="text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Søk, f.eks. kylling, havregryn…"
            className="bg-transparent outline-none text-sm flex-1 placeholder:text-slate-400"
          />
        </div>

        {!selected && (
          <div className="space-y-1.5">
            {results.map((f) => (
              <button
                key={f.id}
                onClick={() => setSelected(f)}
                className="w-full flex items-center justify-between bg-white border border-slate-200 rounded-xl px-3.5 py-2.5"
              >
                <span className="text-sm text-slate-700">{f.name}</span>
                <ChevronRight size={14} className="text-slate-300" />
              </button>
            ))}
            {query && results.length === 0 && (
              <p className="text-center text-sm text-slate-400 pt-6">Ingen treff i Matvaretabellen.</p>
            )}
          </div>
        )}

        {selected && (
          <Card className="p-4">
            <div className="flex items-center justify-between mb-3">
              <button onClick={() => setSelected(null)} className="text-slate-400">
                <ChevronLeft size={16} />
              </button>
              <span className="text-sm font-medium text-slate-800">{selected.name}</span>
              <div className="w-4" />
            </div>

            <div className="flex bg-slate-100 rounded-lg p-1 mb-4">
              {["grams", "portion"].map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`flex-1 py-1.5 rounded-md text-xs font-medium transition ${
                    mode === m ? "bg-white shadow-sm text-slate-800" : "text-slate-400"
                  }`}
                >
                  {m === "grams" ? "Gram" : "1 porsjon"}
                </button>
              ))}
            </div>

            {mode === "grams" && (
              <div className="flex items-center justify-center gap-3 mb-4">
                <button
                  onClick={() => setGrams((g) => Math.max(0, g - 25))}
                  className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500"
                >
                  <Minus size={14} />
                </button>
                <span className="text-base font-semibold text-slate-800 w-16 text-center">{grams} g</span>
                <button
                  onClick={() => setGrams((g) => g + 25)}
                  className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500"
                >
                  <Plus size={14} />
                </button>
              </div>
            )}
            {mode === "portion" && (
              <p className="text-center text-xs text-slate-400 mb-4">1 porsjon = {selected.portionGrams} g</p>
            )}

            {viewMode === "adult" ? (
              <div className="border-t border-slate-100 pt-3">
                <NutritionStatGrid totals={selectedTotals} />
              </div>
            ) : (
              <div className="border-t border-slate-100 pt-3">
                <Pill tone="green">Sunt valg til et måltid</Pill>
              </div>
            )}
          </Card>
        )}

        <p className="text-xs text-slate-300 text-center mt-6">Næringsdata fra Matvaretabellen</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Water
// ---------------------------------------------------------------------------

function WaterScreen({ total, log, onAddWater, onBack, dateLabel, readOnly }) {
  const pct = Math.min(100, Math.round((total / WATER_GOAL_ML) * 100));

  return (
    <div className="px-4 pb-4">
      <TopBar title="Vann" onBack={onBack} />
      <p className="text-xs text-slate-400 text-center -mt-1 mb-3">{dateLabel}</p>
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
            <span className="text-base font-semibold text-slate-800">{total} ml</span>
            <span className="text-xs text-slate-400">av {WATER_GOAL_ML} ml</span>
          </div>
        </div>
        <div className="mb-4">
          <GlassRow water={total} size={28} />
        </div>
        {readOnly ? (
          <p className="text-xs text-slate-400 text-center">Kan bare registrere vann for i dag.</p>
        ) : (
          <div className="grid grid-cols-3 gap-2 w-full">
            {[200, 330, 500].map((ml) => (
              <button
                key={ml}
                onClick={() => onAddWater(ml)}
                className="bg-blue-50 text-blue-700 rounded-xl py-2.5 text-xs font-medium flex flex-col items-center gap-1"
              >
                <Plus size={13} />+{ml} ml
              </button>
            ))}
          </div>
        )}
      </Card>

      <div className="mt-4">
        <span className="text-xs font-medium text-slate-500">Registreringer</span>
        <div className="space-y-1.5 mt-2">
          {log.length === 0 && <p className="text-xs text-slate-400">Ingen registreringer denne dagen.</p>}
          {log.map((l) => (
            <Card key={l.id} className="p-2.5 flex items-center justify-between">
              <span className="text-xs text-slate-500">{l.time}</span>
              <span className="text-sm font-medium text-slate-700">+{l.ml} ml</span>
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
  return (
    <div className="pb-4">
      <TopBar title="Innstillinger" onBack={onBack} />
      <div className="px-4 space-y-4">
        <Card className="p-4 flex items-center justify-between">
          <span className="text-sm text-slate-700">Varsler</span>
          <Toggle checked={notifications} onChange={setNotifications} />
        </Card>

        <Card className="p-4">
          <span className="text-sm text-slate-700 block mb-2">Måleenhet</span>
          <div className="flex bg-slate-100 rounded-lg p-1">
            {["g", "oz"].map((u) => (
              <button
                key={u}
                onClick={() => setUnit(u)}
                className={`flex-1 py-1.5 rounded-md text-xs font-medium transition ${
                  unit === u ? "bg-white shadow-sm text-slate-800" : "text-slate-400"
                }`}
              >
                {u === "g" ? "Gram" : "Ounce"}
              </button>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

function ProfilinnstillingerScreen({ onBack, weight, setWeight, height, setHeight, age, setAge }) {
  return (
    <div className="pb-4">
      <TopBar title="Profilinnstillinger" onBack={onBack} />
      <div className="px-4 space-y-4">
        <div className="flex flex-col items-center gap-2 py-2">
          <div className="relative">
            <div className="w-20 h-20 rounded-full bg-slate-200 flex items-center justify-center text-slate-500">
              <User size={28} />
            </div>
            <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-indigo-600 border-2 border-white flex items-center justify-center text-white">
              <Edit3 size={12} />
            </div>
          </div>
          <span className="text-xs text-slate-400">Endre profilbilde</span>
        </div>

        <Card className="p-4 space-y-4">
          <label className="block">
            <span className="text-xs text-slate-500 mb-1 block">Vekt (kg)</span>
            <input
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              className="w-full bg-slate-100 rounded-xl px-3.5 py-2.5 text-sm outline-none"
            />
          </label>
          <label className="block">
            <span className="text-xs text-slate-500 mb-1 block">Høyde (cm)</span>
            <input
              value={height}
              onChange={(e) => setHeight(e.target.value)}
              className="w-full bg-slate-100 rounded-xl px-3.5 py-2.5 text-sm outline-none"
            />
          </label>
          <label className="block">
            <span className="text-xs text-slate-500 mb-1 block">Alder (år)</span>
            <input
              value={age}
              onChange={(e) => setAge(e.target.value)}
              className="w-full bg-slate-100 rounded-xl px-3.5 py-2.5 text-sm outline-none"
            />
          </label>
        </Card>

        <button onClick={onBack} className="w-full bg-indigo-600 text-white rounded-xl py-3 text-sm font-medium">
          Lagre
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Profil — player only, hosts the settings sub-flow
// ---------------------------------------------------------------------------

function ProfileScreen({ viewMode, setViewMode, onLogout }) {
  const [sub, setSub] = useState(null); // null | "settings" | "profileSettings"
  const [notifications, setNotifications] = useState(true);
  const [unit, setUnit] = useState("g");
  const [weight, setWeight] = useState(78);
  const [height, setHeight] = useState(182);
  const [age, setAge] = useState(19);

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
      <TopBar title="Profil" />
      <Card className="p-0 mb-4 overflow-hidden">
        <button
          onClick={() => setSub("profileSettings")}
          className="w-full p-4 flex items-center gap-3 active:bg-slate-50"
        >
          <div className="w-11 h-11 rounded-full bg-slate-200 flex items-center justify-center text-slate-500">
            <User size={18} />
          </div>
          <div className="text-left">
            <p className="text-sm font-medium text-slate-800">Filip H.</p>
            <p className="text-xs text-slate-400">Spiller · A-lag</p>
          </div>
          <ChevronRight size={14} className="text-slate-300 ml-auto" />
        </button>
      </Card>

      <Card className="p-4 mb-4">
        <p className="text-xs font-medium text-slate-500 mb-1">Forhåndsvis som</p>
        <p className="text-xs text-slate-400 mb-3">
          I appen settes dette automatisk ut fra fødselsdato. Bryteren her er kun for å vise begge tilstander i
          denne skissen.
        </p>
        <div className="flex bg-slate-100 rounded-lg p-1">
          {[
            { key: "adult", label: "Voksen (tall)" },
            { key: "youth", label: "Ung spiller (veiledning)" },
          ].map((o) => (
            <button
              key={o.key}
              onClick={() => setViewMode(o.key)}
              className={`flex-1 py-1.5 rounded-md text-xs font-medium transition ${
                viewMode === o.key ? "bg-white shadow-sm text-slate-800" : "text-slate-400"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </Card>

      <Card className="divide-y divide-slate-100">
        <button onClick={() => setSub("settings")} className="w-full flex items-center justify-between px-4 py-3">
          <span className="text-sm text-slate-700">Innstillinger</span>
          <ChevronRight size={14} className="text-slate-300" />
        </button>
        <button className="w-full flex items-center justify-between px-4 py-3">
          <span className="text-sm text-slate-700">Personvernnotater</span>
          <ChevronRight size={14} className="text-slate-300" />
        </button>
        <button onClick={onLogout} className="w-full flex items-center justify-between px-4 py-3">
          <span className="text-sm text-slate-700">Logg ut</span>
          <ChevronRight size={14} className="text-slate-300" />
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
      tags: ["Fint sammensatt måltid", "God variasjon"],
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

  const dateLabelForWater = selectedDateIso === TODAY_ISO ? "I dag" : formatDayDate(selectedDate);

  return (
    <div className="min-h-screen w-full bg-slate-100 flex items-center justify-center p-4 font-sans">
      <div
        style={{ width: "min(380px, 92vw)", height: "min(780px, 90vh)", borderRadius: "2.5rem" }}
        className="bg-slate-50 border border-slate-200 shadow-xl relative overflow-hidden flex flex-col"
      >
        {!(loggedIn && tab === "kamera") && (
          <div className="flex items-center justify-between px-6 pt-3 pb-1 text-xs text-slate-400 shrink-0">
            <span>9:41</span>
            <span className="text-xs uppercase tracking-wide">Skisse · ingen backend</span>
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

            <div className="shrink-0 border-t border-slate-200 bg-white px-2 py-2.5 flex justify-between">
              {TABS.map((t) => {
                const Icon = t.icon;
                const active = tab === t.key;
                return (
                  <button
                    key={t.key}
                    onClick={() => handleTab(t.key)}
                    className="flex-1 flex items-center justify-center py-1"
                  >
                    <Icon size={22} className={active ? "text-indigo-600" : "text-slate-300"} />
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
