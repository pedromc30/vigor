# Vigor

App móvil (Expo + React Native + TypeScript, backend Supabase) que combina entrenamiento y dieta. Idioma: español.

## Estado por fases

- [x] **Fase 1**: auth, onboarding, perfil y cálculo de calorías/macros
- [x] **Fase 2**: entreno (biblioteca, rutinas, sesión en vivo, 1RM/progresión, historial y volumen semanal)
- [x] **Fase 3**: dieta (diario por comidas, Open Food Facts, escáner, recetas, favoritas, planificador y lista de la compra)
- [ ] Fase 4: progreso, dashboard y notificaciones
- [ ] Fase 5: offline, exportación CSV, RGPD y pulido

## Puesta en marcha

1. Crea un proyecto en Supabase y ejecuta, en orden, `supabase/migrations/0001_profiles.sql` y `supabase/migrations/0002_training.sql` y `supabase/migrations/0003_diet.sql` en el SQL Editor (o con la CLI de Supabase).
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

## Entreno (Fase 2)

- Biblioteca: 46 ejercicios de catálogo (solo lectura) + ejercicios propios por usuario.
- Rutinas con varios días (series, repeticiones objetivo, descanso, notas, día de la semana). Se guardan con la función `save_routine` (transacción única).
- Sesión en vivo: peso, repeticiones y RPE por serie; cada serie se guarda al marcarla; descanso automático con cuenta atrás; muestra la última sesión del ejercicio.
- 1RM con Epley (solo series de hasta 12 repeticiones). Progresión: si se completan todas las series con las repeticiones objetivo, se sugiere +2,5 kg (`PROGRESSION_STEP_KG`).
- Historial de sesiones y volumen semanal (series y kg) por grupo muscular, de lunes a domingo.

## Dieta (Fase 3)

- Diario por comidas (desayuno, comida, merienda, cena, snacks) con barras de kcal, proteína, carbohidratos, grasa y agua frente a tus objetivos. Cada entrada guarda una copia de los macros del momento: editar o borrar un alimento después no cambia el historial.
- Alimentos: propios y de [Open Food Facts](https://world.openfoodfacts.org) (texto o código de barras, con escáner de cámara). Los productos de OFF se guardan en tus alimentos al añadirlos. Se avisa si contienen un alérgeno marcado en tu perfil. Líquidos y sólidos se miden en gramos.
- Recetas con macros por ración calculados automáticamente. Copiar comidas de los últimos 14 días y comidas favoritas.
- Planificador semanal (opcional) y lista de la compra generada a partir de él (las recetas se descomponen en ingredientes).
- Open Food Facts limita las consultas (10/min en búsquedas, 15/min por producto), por eso la búsqueda por texto se lanza al pulsar «Buscar».
- Datos de Open Food Facts: licencia ODbL; pueden contener errores.

## Notas de dependencias

Las versiones de los módulos nativos están fijadas a las que incluye Expo Go para el SDK 58 (`node_modules/expo/bundledNativeModules.json`). Importante: `@react-native-async-storage/async-storage` debe ser la **2.2.0**; la 3.x necesita un módulo nativo que Expo Go no trae y rompe el inicio de sesión en el móvil.
