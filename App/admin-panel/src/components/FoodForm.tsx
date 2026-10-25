// Form for creating or editing a CUSTOM food. Values are per 100 g, like
// Matvaretabellen. An empty nutrient field is stored as "missing", not 0.

import { useState, type FormEvent } from 'react';

import { NUTRIENTS, type Food, type NutrientKey, type Nutrition, type Portion } from '../lib/types';
import { t } from '../lib/i18n';

/** What the form produces — the database fills in id, source and created_at. */
export type FoodDraft = Pick<Food, 'name_nb' | 'name_en' | 'search_keywords' | 'nutrition' | 'portions'>;

type Props = {
  initial: FoodDraft;
  submitLabel: string;
  onSubmit: (draft: FoodDraft) => Promise<string | null>; // returns an error message or null
  onCancel: () => void;
  onDelete?: () => void;
};

export function FoodForm({ initial, submitLabel, onSubmit, onCancel, onDelete }: Props) {
  // Inputs hold text; we convert to numbers when saving.
  const [nameNb, setNameNb] = useState(initial.name_nb);
  const [nameEn, setNameEn] = useState(initial.name_en ?? '');
  const [keywords, setKeywords] = useState(initial.search_keywords.join(', '));
  const [nutrients, setNutrients] = useState<Record<NutrientKey, string>>(() => {
    const values = {} as Record<NutrientKey, string>;
    for (const { key } of NUTRIENTS) values[key] = initial.nutrition[key]?.toString() ?? '';
    return values;
  });
  const [portions, setPortions] = useState<{ name: string; grams: string }[]>(() =>
    initial.portions.map((p) => ({ name: p.name, grams: p.grams.toString() })),
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    // ---- Validate and convert ----
    if (!nameNb.trim()) return setError(t('Norsk navn er påkrevd.', 'Norwegian name is required.'));

    const nutrition: Nutrition = {};
    for (const { key, label } of NUTRIENTS) {
      const raw = nutrients[key].trim().replace(',', '.'); // accept "1,5"
      if (raw === '') continue; // missing value
      const value = Number(raw);
      if (!Number.isFinite(value) || value < 0) return setError(`${label}: ${t('må være et tall ≥ 0.', 'must be a number ≥ 0.')}`);
      nutrition[key] = value;
    }
    if (nutrition.energy_kcal === undefined) return setError(t('Energi (kcal) er påkrevd.', 'Energy (kcal) is required.'));

    const cleanPortions: Portion[] = [];
    for (const p of portions) {
      if (!p.name.trim() && !p.grams.trim()) continue; // empty row
      const grams = Number(p.grams.replace(',', '.'));
      if (!p.name.trim() || !Number.isFinite(grams) || grams <= 0) {
        return setError(t('Hver porsjon trenger et navn og et antall gram > 0.', 'Each portion needs a name and a number of grams > 0.'));
      }
      cleanPortions.push({ name: p.name.trim(), grams });
    }

    setBusy(true);
    const result = await onSubmit({
      name_nb: nameNb.trim(),
      name_en: nameEn.trim() || null,
      search_keywords: keywords
        .split(',')
        .map((k) => k.trim())
        .filter(Boolean),
      nutrition,
      portions: cleanPortions,
    });
    setBusy(false);
    if (result) setError(result);
  }

  return (
    <form className="stack" onSubmit={handleSubmit}>
      <label>
        {t('Norsk navn *', 'Norwegian name *')}
        <input value={nameNb} onChange={(e) => setNameNb(e.target.value)} required />
      </label>
      <label>
        {t('Engelsk navn', 'English name')}
        <input value={nameEn} onChange={(e) => setNameEn(e.target.value)} placeholder={t('f.eks. chicken breast', 'e.g. chicken breast')} />
      </label>
      <label>
        {t('Søkeord (kommaseparert)', 'Search words (comma-separated)')}
        <input value={keywords} onChange={(e) => setKeywords(e.target.value)} placeholder={t('f.eks. kyllingbryst, filet', 'e.g. kyllingbryst, filet')} />
      </label>

      <strong>{t('Næringsinnhold per 100 g', 'Nutrition per 100 g')}</strong>
      <div className="grid-2">
        {NUTRIENTS.map(({ key, label, unit }) => (
          <label key={key}>
            {label} ({unit}){key === 'energy_kcal' ? ' *' : ''}
            <input
              inputMode="decimal"
              value={nutrients[key]}
              onChange={(e) => setNutrients({ ...nutrients, [key]: e.target.value })}
            />
          </label>
        ))}
      </div>

      <strong>{t('Porsjoner', 'Portions')}</strong>
      <p className="muted small" style={{ margin: 0 }}>
        {t(
          'Den første porsjonen er standardmengden i appen og brukes til «≈ 1 porsjon».',
          'The first portion is the default amount in the app and is used for “≈ 1 portion”. Portion names are shown to players in Norwegian.',
        )}
      </p>
      {portions.map((p, i) => (
        <div key={i} className="row">
          <input
            placeholder={t('navn, f.eks. porsjon', 'name (Norwegian), e.g. porsjon')}
            value={p.name}
            onChange={(e) => setPortions(portions.map((q, j) => (j === i ? { ...q, name: e.target.value } : q)))}
          />
          <input
            style={{ width: 90 }}
            inputMode="decimal"
            placeholder={t('gram', 'grams')}
            value={p.grams}
            onChange={(e) => setPortions(portions.map((q, j) => (j === i ? { ...q, grams: e.target.value } : q)))}
          />
          <button type="button" onClick={() => setPortions(portions.filter((_, j) => j !== i))}>
            {t('Fjern', 'Remove')}
          </button>
        </div>
      ))}
      <button type="button" onClick={() => setPortions([...portions, { name: '', grams: '' }])}>
        + {t('Legg til porsjon', 'Add portion')}
      </button>

      {error && <p className="error">{error}</p>}
      <div className="row">
        <button type="submit" className="primary" disabled={busy}>
          {busy ? t('Lagrer…', 'Saving…') : submitLabel}
        </button>
        <button type="button" onClick={onCancel}>
          {t('Avbryt', 'Cancel')}
        </button>
        {onDelete && (
          <button type="button" className="danger" onClick={onDelete} style={{ marginLeft: 'auto' }}>
            {t('Slett', 'Delete')}
          </button>
        )}
      </div>
    </form>
  );
}
