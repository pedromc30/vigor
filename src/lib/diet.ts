import { supabase } from './supabase';
import { addDays, type Macros, type Meal } from './diet-math';
import type { OffFood } from './openfoodfacts';

export interface Food {
  id: string;
  user_id: string;
  source: 'custom' | 'off';
  barcode: string | null;
  name: string;
  brand: string;
  serving_g: number;
  kcal_100g: number;
  protein_100g: number;
  carbs_100g: number;
  fat_100g: number;
  allergens: string[];
}

export type FoodDraft = Omit<Food, 'id' | 'user_id'>;

export interface RecipeItem {
  id: string;
  food_id: string;
  grams: number;
  position: number;
  foods: Food | null;
}

export interface Recipe {
  id: string;
  name: string;
  servings: number;
  notes: string;
  recipe_items: RecipeItem[];
}

/** Lo que se guarda en una entrada del diario o del plan (con una copia de los macros del momento). */
export interface EntryDraft extends Macros {
  meal: Meal;
  food_id: string | null;
  recipe_id: string | null;
  name: string;
  quantity_g: number | null;
  servings: number | null;
}

export interface LogEntry extends EntryDraft {
  id: string;
  log_date: string;
  created_at: string;
}

export interface PlanEntry extends EntryDraft {
  id: string;
  weekday: number;
}

export interface Favorite {
  id: string;
  name: string;
  items: Omit<EntryDraft, 'meal'>[];
}

function check<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}

const n = (v: unknown) => Number(v);

function normFood(f: Food): Food {
  return {
    ...f,
    serving_g: n(f.serving_g),
    kcal_100g: n(f.kcal_100g),
    protein_100g: n(f.protein_100g),
    carbs_100g: n(f.carbs_100g),
    fat_100g: n(f.fat_100g),
  };
}

function normEntry<T extends EntryDraft>(e: T): T {
  return {
    ...e,
    quantity_g: e.quantity_g == null ? null : n(e.quantity_g),
    servings: e.servings == null ? null : n(e.servings),
    kcal: n(e.kcal),
    protein_g: n(e.protein_g),
    carbs_g: n(e.carbs_g),
    fat_g: n(e.fat_g),
  };
}

// ---------- Alimentos ----------

export async function listFoods(): Promise<Food[]> {
  return (check(await supabase.from('foods').select('*').order('name')) as Food[]).map(normFood);
}

export async function createFood(userId: string, f: FoodDraft): Promise<Food> {
  return normFood(check(await supabase.from('foods').insert({ ...f, user_id: userId }).select('*').single()) as Food);
}

export async function deleteFood(id: string) {
  const { error } = await supabase.from('foods').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

/** Guarda un producto de Open Food Facts en los alimentos del usuario (una vez por código de barras). */
export async function saveOffFood(userId: string, off: OffFood): Promise<Food> {
  if (off.barcode) {
    const { data, error } = await supabase.from('foods').select('*').eq('barcode', off.barcode).maybeSingle();
    if (error) throw new Error(error.message);
    if (data) return normFood(data as Food);
  }
  return createFood(userId, { source: 'off', ...off });
}

// ---------- Recetas ----------

const RECIPE_SELECT = '*, recipe_items(id, food_id, grams, position, foods(*))';

function normRecipe(r: Recipe): Recipe {
  return {
    ...r,
    servings: n(r.servings),
    recipe_items: (r.recipe_items ?? [])
      .map((i) => ({ ...i, grams: n(i.grams), foods: i.foods ? normFood(i.foods) : null }))
      .sort((a, b) => a.position - b.position),
  };
}

export async function listRecipes(): Promise<Recipe[]> {
  return (check(await supabase.from('recipes').select(RECIPE_SELECT).order('name')) as unknown as Recipe[]).map(normRecipe);
}

export async function getRecipe(id: string): Promise<Recipe | null> {
  const { data, error } = await supabase.from('recipes').select(RECIPE_SELECT).eq('id', id).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? normRecipe(data as unknown as Recipe) : null;
}

export async function getRecipesByIds(ids: string[]): Promise<Recipe[]> {
  if (!ids.length) return [];
  return (check(await supabase.from('recipes').select(RECIPE_SELECT).in('id', ids)) as unknown as Recipe[]).map(normRecipe);
}

export interface RecipeInput {
  id: string | null;
  name: string;
  servings: number;
  notes: string;
  items: { food_id: string; grams: number; position: number }[];
}

export async function saveRecipe(r: RecipeInput): Promise<string> {
  const { data, error } = await supabase.rpc('save_recipe', {
    p_id: r.id,
    p_name: r.name,
    p_servings: r.servings,
    p_notes: r.notes,
    p_items: r.items,
  });
  if (error) throw new Error(error.message);
  return data as string;
}

export async function deleteRecipe(id: string) {
  const { error } = await supabase.from('recipes').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

// ---------- Diario ----------

/** Quita referencias a alimentos o recetas que ya no existen (p. ej. en favoritas antiguas). */
async function sanitizeRefs<T extends { food_id: string | null; recipe_id: string | null }>(items: T[]): Promise<T[]> {
  const foodIds = [...new Set(items.map((i) => i.food_id).filter(Boolean))] as string[];
  const recipeIds = [...new Set(items.map((i) => i.recipe_id).filter(Boolean))] as string[];
  const [foods, recipes] = await Promise.all([
    foodIds.length ? supabase.from('foods').select('id').in('id', foodIds) : { data: [], error: null },
    recipeIds.length ? supabase.from('recipes').select('id').in('id', recipeIds) : { data: [], error: null },
  ]);
  const okFoods = new Set((check(foods) as { id: string }[]).map((r) => r.id));
  const okRecipes = new Set((check(recipes) as { id: string }[]).map((r) => r.id));
  return items.map((i) => ({
    ...i,
    food_id: i.food_id && okFoods.has(i.food_id) ? i.food_id : null,
    recipe_id: i.recipe_id && okRecipes.has(i.recipe_id) ? i.recipe_id : null,
  }));
}

export async function getLogs(date: string): Promise<LogEntry[]> {
  const rows = check(
    await supabase.from('meal_logs').select('*').eq('log_date', date).order('created_at'),
  ) as LogEntry[];
  return rows.map(normEntry);
}

export async function addLogs(userId: string, date: string, drafts: EntryDraft[]): Promise<void> {
  if (!drafts.length) return;
  const clean = await sanitizeRefs(drafts);
  const { error } = await supabase.from('meal_logs').insert(clean.map((d) => ({ ...d, user_id: userId, log_date: date })));
  if (error) throw new Error(error.message);
}

export async function updateLog(id: string, patch: Partial<EntryDraft>) {
  const { error } = await supabase.from('meal_logs').update(patch).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function deleteLog(id: string) {
  const { error } = await supabase.from('meal_logs').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

/** Entradas de una comida de los últimos `days` días anteriores a `beforeDate`, para copiarlas. */
export async function getRecentMealLogs(meal: Meal, beforeDate: string, days = 14): Promise<LogEntry[]> {
  const rows = check(
    await supabase
      .from('meal_logs')
      .select('*')
      .eq('meal', meal)
      .gte('log_date', addDays(beforeDate, -days))
      .lt('log_date', beforeDate)
      .order('log_date', { ascending: false })
      .order('created_at'),
  ) as LogEntry[];
  return rows.map(normEntry);
}

// ---------- Agua ----------

export async function getWaterMl(date: string): Promise<number> {
  const rows = check(await supabase.from('water_logs').select('ml').eq('log_date', date)) as { ml: number }[];
  return rows.reduce((sum, r) => sum + n(r.ml), 0);
}

export async function addWater(userId: string, date: string, ml: number) {
  const { error } = await supabase.from('water_logs').insert({ user_id: userId, log_date: date, ml });
  if (error) throw new Error(error.message);
}

/** Deshace el último registro de agua del día. */
export async function undoWater(date: string) {
  const { data, error } = await supabase
    .from('water_logs')
    .select('id')
    .eq('log_date', date)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return;
  const del = await supabase.from('water_logs').delete().eq('id', (data as { id: string }).id);
  if (del.error) throw new Error(del.error.message);
}

// ---------- Favoritas ----------

export async function listFavorites(): Promise<Favorite[]> {
  const rows = check(await supabase.from('favorite_meals').select('*').order('name')) as Favorite[];
  return rows.map((f) => ({ ...f, items: f.items.map((i) => normEntry({ meal: 'snacks', ...i })).map(({ meal: _m, ...rest }) => rest) }));
}

export async function saveFavorite(userId: string, name: string, drafts: EntryDraft[]) {
  const items = drafts.map(({ meal: _meal, ...rest }) => rest);
  const { error } = await supabase.from('favorite_meals').insert({ user_id: userId, name, items });
  if (error) throw new Error(error.message);
}

export async function deleteFavorite(id: string) {
  const { error } = await supabase.from('favorite_meals').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

// ---------- Planificador semanal ----------

export async function listPlan(): Promise<PlanEntry[]> {
  const rows = check(await supabase.from('meal_plan_entries').select('*').order('created_at')) as PlanEntry[];
  return rows.map(normEntry);
}

export async function addPlanEntries(userId: string, weekday: number, drafts: EntryDraft[]) {
  if (!drafts.length) return;
  const clean = await sanitizeRefs(drafts);
  const { error } = await supabase
    .from('meal_plan_entries')
    .insert(clean.map((d) => ({ ...d, user_id: userId, weekday })));
  if (error) throw new Error(error.message);
}

export async function deletePlanEntry(id: string) {
  const { error } = await supabase.from('meal_plan_entries').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

export async function clearPlanDay(weekday: number) {
  const { error } = await supabase.from('meal_plan_entries').delete().eq('weekday', weekday);
  if (error) throw new Error(error.message);
}
