import { supabase } from './supabase';
import type { ActivityLevel, Goal, Sex } from './nutrition';

export type DietPreference = 'omnivore' | 'vegetarian' | 'vegan';

export const CONSENT_VERSION = '2026-10-v1';

export interface Profile {
  id: string;
  sex: Sex | null;
  age: number | null;
  height_cm: number | null;
  weight_kg: number | null;
  activity_level: ActivityLevel | null;
  goal: Goal | null;
  training_days_per_week: number | null;
  diet_preference: DietPreference | null;
  allergies: string[];
  target_kcal: number | null;
  target_protein_g: number | null;
  target_fat_g: number | null;
  target_carbs_g: number | null;
  targets_manual: boolean;
  water_goal_ml: number;
  health_consent_at: string | null;
  consent_version: string | null;
  onboarding_completed_at: string | null;
}

export type ProfileUpdate = Partial<Omit<Profile, 'id'>>;

export async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
  if (error) throw error;
  return data as Profile | null;
}

export async function upsertProfile(userId: string, values: ProfileUpdate): Promise<Profile> {
  const { data, error } = await supabase
    .from('profiles')
    .upsert({ id: userId, ...values })
    .select('*')
    .single();
  if (error) throw error;
  return data as Profile;
}

export async function deleteAccount(): Promise<void> {
  const { error } = await supabase.rpc('delete_my_account');
  if (error) throw error;
}
