# Vigor

App móvil (Expo + React Native + TypeScript, backend Supabase) que combina entrenamiento y dieta. Idioma: español.

## Estado por fases

- [x] **Fase 1**: auth, onboarding, perfil y cálculo de calorías/macros
- [ ] Fase 2: entreno
- [ ] Fase 3: dieta (Open Food Facts + escáner)
- [ ] Fase 4: progreso, dashboard y notificaciones
- [ ] Fase 5: offline, exportación CSV, RGPD y pulido

## Puesta en marcha

1. Crea un proyecto en Supabase y ejecuta `supabase/migrations/0001_profiles.sql` en el SQL Editor (o con la CLI de Supabase).
2. Copia `.env.example` a `.env` y rellena `EXPO_PUBLIC_SUPABASE_URL` y `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
3. `npm install` y `npx expo start`.
4. Opcional: si desactivas «Confirm email» en Supabase Auth, el registro entra directamente.

## Scripts

- `npm test`: tests de la lógica de cálculo (`src/lib/nutrition.ts`)
- `npm run typecheck`

## Cálculo (Fase 1)

- TMB: Mifflin-St Jeor. Gasto total = TMB × factor (1,2 / 1,375 / 1,55 / 1,725 / 1,9).
- Objetivo: −17,5 % (perder grasa), 0 % (mantener), +7,5 % (ganar músculo). Suelo: 1.200 kcal (mujer) / 1.500 kcal (hombre).
- Macros: proteína 2,2 / 1,8 / 1,8 g/kg según objetivo; grasa = máx(0,8 g/kg, 25 % kcal); carbohidratos = resto.
- Todo editable en Perfil → Editar objetivos.
