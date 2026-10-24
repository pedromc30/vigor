// Lógica pura de dieta: macros por cantidad, recetas, totales, fechas, alérgenos y lista de la compra.

export const MEALS = ['desayuno', 'comida', 'merienda', 'cena', 'snacks'] as const;
export type Meal = (typeof MEALS)[number];

export const MEAL_LABELS: Record<Meal, string> = {
  desayuno: 'Desayuno',
  comida: 'Comida',
  merienda: 'Merienda',
  cena: 'Cena',
  snacks: 'Snacks',
};

export interface Macros {
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

export interface Per100 {
  kcal_100g: number;
  protein_100g: number;
  carbs_100g: number;
  fat_100g: number;
}

export const ZERO_MACROS: Macros = { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 };

const r2 = (n: number) => Math.round(n * 100) / 100;

export function roundMacros(m: Macros): Macros {
  return { kcal: r2(m.kcal), protein_g: r2(m.protein_g), carbs_g: r2(m.carbs_g), fat_g: r2(m.fat_g) };
}

/** Macros de `grams` gramos de un alimento con valores por 100 g. */
export function macrosForGrams(food: Per100, grams: number): Macros {
  const k = grams / 100;
  return roundMacros({
    kcal: food.kcal_100g * k,
    protein_g: food.protein_100g * k,
    carbs_g: food.carbs_100g * k,
    fat_g: food.fat_100g * k,
  });
}

export function sumMacros(list: Macros[]): Macros {
  return roundMacros(
    list.reduce(
      (acc, m) => ({
        kcal: acc.kcal + m.kcal,
        protein_g: acc.protein_g + m.protein_g,
        carbs_g: acc.carbs_g + m.carbs_g,
        fat_g: acc.fat_g + m.fat_g,
      }),
      ZERO_MACROS,
    ),
  );
}

export function scaleMacros(m: Macros, factor: number): Macros {
  return roundMacros({
    kcal: m.kcal * factor,
    protein_g: m.protein_g * factor,
    carbs_g: m.carbs_g * factor,
    fat_g: m.fat_g * factor,
  });
}

export interface RecipeIngredient {
  food: Per100;
  grams: number;
}

/** Macros totales de todos los ingredientes de una receta. */
export function recipeTotals(items: RecipeIngredient[]): Macros {
  return sumMacros(items.map((i) => macrosForGrams(i.food, i.grams)));
}

/** Macros de una ración: total de la receta entre el número de raciones que salen. */
export function recipePerServing(items: RecipeIngredient[], servings: number): Macros {
  if (servings <= 0) return ZERO_MACROS;
  return scaleMacros(recipeTotals(items), 1 / servings);
}

/** Cantidad de una entrada del diario: gramos (alimentos) o raciones (recetas). */
export interface Quantified extends Macros {
  quantity_g: number | null;
  servings: number | null;
}

/** Cambia la cantidad de una entrada y reescala sus macros de forma proporcional. */
export function rescaleEntry<T extends Quantified>(entry: T, newQuantity: number): T {
  const old = entry.quantity_g ?? entry.servings;
  if (!old || old <= 0 || newQuantity <= 0) return entry;
  const scaled = scaleMacros(entry, newQuantity / old);
  return entry.quantity_g != null ? { ...entry, ...scaled, quantity_g: newQuantity } : { ...entry, ...scaled, servings: newQuantity };
}

/** Parte consumida respecto al objetivo, en [0, 1] para pintar barras; el exceso se indica aparte. */
export function progress(consumed: number, target: number | null | undefined): number {
  if (!target || target <= 0) return 0;
  return Math.min(1, Math.max(0, consumed / target));
}

// ---------- Fechas (siempre en hora local, formato AAAA-MM-DD) ----------

export function toISODate(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export function fromISODate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(iso: string, n: number): string {
  const d = fromISODate(iso);
  d.setDate(d.getDate() + n);
  return toISODate(d);
}

/** Día de la semana ISO: 1 = lunes … 7 = domingo. */
export function isoWeekday(iso: string): number {
  const d = fromISODate(iso).getDay();
  return d === 0 ? 7 : d;
}

export function dayLabel(iso: string, todayIso: string): string {
  if (iso === todayIso) return 'Hoy';
  if (iso === addDays(todayIso, -1)) return 'Ayer';
  if (iso === addDays(todayIso, 1)) return 'Mañana';
  return fromISODate(iso).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' });
}

// ---------- Alérgenos ----------

/** Etiquetas de Open Food Facts (sin el prefijo de idioma) asociadas a cada alergia del perfil. */
export const ALLERGY_TO_TAGS: Record<string, string[]> = {
  gluten: ['gluten'],
  lactosa: ['milk'],
  lacteos: ['milk'],
  huevo: ['eggs'],
  pescado: ['fish'],
  crustaceos: ['crustaceans'],
  moluscos: ['molluscs'],
  cacahuete: ['peanuts'],
  frutos_secos: ['nuts'],
  soja: ['soybeans'],
  apio: ['celery'],
  mostaza: ['mustard'],
  sesamo: ['sesame-seeds'],
  sulfitos: ['sulphur-dioxide-and-sulphites'],
  altramuces: ['lupin'],
};

/**
 * Alergias del usuario que coinciden con los alérgenos declarados de un alimento.
 * Devuelve las claves del perfil. Las alergias escritas a mano (texto libre) no se pueden cruzar.
 */
export function allergenMatches(userAllergies: string[], foodAllergens: string[]): string[] {
  const tags = new Set(foodAllergens.map((t) => t.replace(/^[a-z]{2}:/, '').toLowerCase()));
  return userAllergies.filter((a) => (ALLERGY_TO_TAGS[a] ?? []).some((t) => tags.has(t)));
}

// ---------- Lista de la compra ----------

export interface PlanLine {
  food_id: string | null;
  recipe_id: string | null;
  name: string;
  quantity_g: number | null;
  servings: number | null;
}

export interface ShoppingRecipe {
  servings: number;
  items: { food_id: string; name: string; grams: number }[];
}

export interface ShoppingItem {
  key: string;
  name: string;
  grams: number;
}

/**
 * Suma las cantidades de todo lo planificado. Las recetas se descomponen en ingredientes
 * proporcionalmente a las raciones planificadas.
 */
export function buildShoppingList(lines: PlanLine[], recipes: Record<string, ShoppingRecipe>): ShoppingItem[] {
  const map = new Map<string, ShoppingItem>();
  const add = (key: string, name: string, grams: number) => {
    const cur = map.get(key);
    if (cur) cur.grams += grams;
    else map.set(key, { key, name, grams });
  };

  for (const l of lines) {
    if (l.recipe_id && recipes[l.recipe_id]) {
      const r = recipes[l.recipe_id];
      const factor = (l.servings ?? 1) / (r.servings || 1);
      for (const it of r.items) add(`food:${it.food_id}`, it.name, it.grams * factor);
    } else if (l.food_id && l.quantity_g) {
      add(`food:${l.food_id}`, l.name, l.quantity_g);
    }
    // Entradas sin alimento ni receta (borrados) no se pueden comprar.
  }
  return [...map.values()]
    .map((i) => ({ ...i, grams: Math.round(i.grams) }))
    .sort((a, b) => a.name.localeCompare(b.name, 'es'));
}

/** 250 → "250 g"; 1500 → "1,5 kg". */
export function formatGrams(g: number): string {
  if (g >= 1000) return `${String(Math.round(g / 100) / 10).replace('.', ',')} kg`;
  return `${Math.round(g)} g`;
}

export function formatMl(ml: number): string {
  return ml >= 1000 ? `${String(Math.round(ml / 100) / 10).replace('.', ',')} L` : `${Math.round(ml)} ml`;
}
