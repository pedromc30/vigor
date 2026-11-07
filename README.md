# Vigor

App móvil (Expo + React Native + TypeScript, backend Supabase) que combina entrenamiento y dieta. Idioma: español.

## Estado por fases

- [x] **Fase 1**: auth, onboarding, perfil y cálculo de calorías/macros
- [x] **Fase 2**: entreno (biblioteca, rutinas, sesión en vivo, 1RM/progresión, historial y volumen semanal)
- [x] **Fase 3**: dieta (diario por comidas, Open Food Facts, escáner, recetas, favoritas, planificador y lista de la compra)
- [x] **Fase 4**: progreso (peso, perímetros, fotos privadas), gráficas, ajuste semanal, dashboard y recordatorios
- [x] **Fase 5**: funcionamiento sin conexión con sincronización, exportación a CSV, RGPD y pulido visual

## Puesta en marcha

1. Crea un proyecto en Supabase y ejecuta, en orden, `supabase/migrations/0001_profiles.sql` y `supabase/migrations/0002_training.sql` y `supabase/migrations/0003_diet.sql` y `supabase/migrations/0004_progress.sql` en el SQL Editor (o con la CLI de Supabase).
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

### Mejoras del entreno (migración `0006_training_improvements.sql`)

- **Repeticiones fijas o en rango** por ejercicio de rutina (`3 × 8` o `3 × 6–8`): se guardan `reps_min` y `reps_max` (fijo = ambos iguales); `reps_target` se mantiene como el máximo para no romper la versión anterior de la app ni las exportaciones. **Doble progresión:** se sugiere subir carga (+2,5 kg) cuando todas las series *normales* llegan al máximo del rango (en modo fijo, al número fijo).
- **Tipos de serie:** normal, aproximación (`A`) y dropset (`D`) en `workout_sets.set_type`. La aproximación **no cuenta** para el volumen (semanal, de sesión e historial), el 1RM, la progresión ni la gráfica de cargas. Los dropsets cuentan en volumen y 1RM, pero no en la progresión (que solo mira las series normales). Las series se pueden borrar (con confirmación si ya están registradas). Los tipos de serie no forman parte de la plantilla de la rutina: se añaden durante la sesión.
- **Orden de las series:** `set_index` es la identidad de la serie y no cambia; `sort_order` es su orden en pantalla, así se pueden insertar series intermedias. En series antiguas (sin `sort_order`) manda `set_index`.
- **Reordenar ejercicios** arrastrando el asa de cada fila, en el editor de rutinas (`routine_exercises.position`) y en la sesión en vivo. En la sesión el orden vive en `workout_sessions.plan` (una lista ordenada) y solo afecta a esa sesión; las series se guardan con `position` = `slot` del ejercicio (identificador estable que se asigna al reordenar), de modo que cambiar el orden no toca las series ya registradas.
- **RPE** con desplegable de 1 a 10 (más «Sin RPE»). Los valores antiguos con decimales se siguen mostrando tal cual en las series ya registradas.
- **Aviso de fin de descanso:** al empezar el descanso se programa una notificación local para su hora de fin (se cancela y se reprograma al saltar, alargar o acortar). Con la app abierta no sale la notificación: la pantalla vibra y muestra un aviso. Pide el permiso de notificaciones la primera vez que se usa el temporizador. **Requiere una build de EAS** (no funciona en Expo Go para Android, igual que los recordatorios).

### Logros y evolución de cargas (migración `0007_goals_achievements.sql`)

- **Objetivos por ejercicio** (`exercise_goals`): «peso × repeticiones», de carga (sentadilla 100 kg × 1) o de repeticiones con un peso dado (dominadas 12 reps con peso corporal = 0 kg; press de banca 80 kg × 8). Se cumplen con una serie *normal* que alcance a la vez la carga y las repeticiones. Se crean, editan y borran desde Progreso → Logros. Un objetivo que ya está cumplido con el historial se rechaza (hay que pedir uno mayor). El progreso en % es la mejor marca actual frente al objetivo (nunca marca 100 % sin cumplirlo).
- **Récords personales automáticos**, al guardar cada serie normal (la regla está en `src/lib/achievements.ts`): de **peso** (más carga que nunca), de **repeticiones** (más repeticiones que nunca con un peso igual o mayor) y de **1RM estimado** (Epley, hasta 12 repeticiones). La primera serie de un ejercicio solo fija la marca de partida. Las series de aproximación y los dropsets **no** generan logros ni récords.
- **Celebración** al conseguir un récord o un objetivo: aviso breve con vibración, sin bloquear el entreno (si se consiguen varios, salen en cola). Cada logro se guarda en `achievements` con fecha, ejercicio, valor y la serie que lo consiguió.
- **Historial anterior:** la primera vez que se abre Progreso o Logros se recorre el historial con la misma regla y los récords que ya había se guardan **sin celebrarlos** (es idempotente y se hace una vez por usuario).
- **Deshacer una serie** (o borrar su sesión) elimina sus logros en cascada, y si era el que cumplía un objetivo, el objetivo vuelve a estar pendiente (trigger de la base de datos).
- **Sin conexión:** los logros y los cambios de objetivos se encolan como las series; los récords se detectan con el historial leído al empezar la sesión (si no se pudo leer, no se detectan logros esa vez, pero la serie se guarda igual).
- **Evolución de cargas** (Progreso): selector de ejercicio, de métrica (peso máximo, 1RM estimado, repeticiones totales o volumen de la sesión) y de rango (1 mes, 3 meses, 6 meses, 1 año, todo). Solo series normales. Los puntos con récord se marcan en naranja; al tocar un punto se ve la sesión (series con peso × repeticiones × RPE). Con menos de 2 sesiones del ejercicio se explica por qué no hay gráfica.
- Los objetivos y los logros están en la **exportación CSV** y se borran con la cuenta.

## Dieta (Fase 3)

- Diario por comidas (desayuno, comida, merienda, cena, snacks) con barras de kcal, proteína, carbohidratos, grasa y agua frente a tus objetivos. Cada entrada guarda una copia de los macros del momento: editar o borrar un alimento después no cambia el historial.
- Alimentos: propios y de [Open Food Facts](https://world.openfoodfacts.org) (texto o código de barras, con escáner de cámara). Los productos de OFF se guardan en tus alimentos al añadirlos. Se avisa si contienen un alérgeno marcado en tu perfil. Líquidos y sólidos se miden en gramos.
- Recetas con macros por ración calculados automáticamente. Copiar comidas de los últimos 14 días y comidas favoritas.
- Planificador semanal (opcional) y lista de la compra generada a partir de él (las recetas se descomponen en ingredientes).
- Open Food Facts limita las consultas (10/min en búsquedas, 15/min por producto), por eso la búsqueda por texto se lanza al pulsar «Buscar».
- Datos de Open Food Facts: licencia ODbL; pueden contener errores.

### Archivos de dieta (migración `0008_diet_files.sql`)

- Dieta → **Archivos de dieta**: adjunta la dieta que te dé tu dietista como PDF, imagen, Word, Excel o texto (también se puede hacer una foto), de hasta **10 MB** cada uno. Se pueden abrir (enlace temporal firmado), compartir y eliminar.
- Se guardan en un espacio de Storage **privado** (`diet-files`), en la carpeta de cada usuario con un nombre generado, y su índice en la tabla `diet_files` (RLS: cada usuario solo ve lo suyo). El tipo y el tamaño se comprueban en la app y también en la base de datos y en el bucket.
- Se borran al eliminar la cuenta (igual que las fotos de progreso) y su índice va en la exportación CSV (los archivos no).
- Usa `expo-document-picker`, que requiere recompilar la app. Para adjuntar hace falta conexión.
- **Usar en mi dieta (migración `0009_diet_files_csv.sql`, permite CSV):** los archivos Excel (`.xlsx`) y CSV se pueden leer **en el móvil**, sin enviar nada a terceros (`src/lib/spreadsheet.ts` lee el `.xlsx` como ZIP+XML con `fflate`; `src/lib/diet-import.ts` interpreta la tabla). Antes de aplicar nada se muestra una pantalla de revisión (qué se ha leído, avisos, lo que no se ha podido colocar, días a importar con interruptor y «Sustituir esos días» o «Añadir a lo que hay»). Rellena el **planificador semanal** y, si el archivo los indica, los **objetivos diarios** (kcal, proteína, carbohidratos, grasa; se marcan como editados a mano).
  - Formatos que reconoce: días en columnas y comidas en filas; días en filas y comidas en columnas; y una fila por alimento con columnas «Día», «Comida» y «Alimento» (y opcionalmente cantidad, kcal y macros). Las celdas con varios alimentos se separan por salto de línea, «;» o « + », y se reconocen cantidades como «150 g de pollo» o «250 ml de leche».
  - **Límites:** no lee PDF, Word ni fotos, ni Excel antiguos (`.xls`; hay que guardarlos como `.xlsx` o CSV). Las calorías y macros solo se rellenan si el archivo las trae por alimento (formato de lista); si no, los alimentos entran sin calorías (1 ración o la cantidad en gramos). Una hoja con otra estructura no se reconoce y se explica qué busca la app. Ver `src/lib/diet-import.ts` para las reglas exactas.

## Notas de dependencias

Las versiones de los módulos nativos están fijadas a las que incluye Expo Go para el SDK 58 (`node_modules/expo/bundledNativeModules.json`). Importante: `@react-native-async-storage/async-storage` debe ser la **2.2.0**; la 3.x necesita un módulo nativo que Expo Go no trae y rompe el inicio de sesión en el móvil.

## Progreso (Fase 4)

- **Peso y perímetros:** una fila por día (peso, cintura, cadera, brazo, muslo; todo opcional). La gráfica muestra los pesajes y la media móvil de 7 días.
- **Fotos de progreso:** bucket privado `progress-photos`; cada usuario solo accede a su carpeta `<user_id>/…` y las imágenes se muestran con URL firmadas de 1 h. Al eliminar la cuenta se borran primero los archivos (Storage no se vacía solo).
- **Gráficas:** tendencia de peso, calorías de los últimos 14 días frente al objetivo, adherencia semanal (8 semanas) y mejor carga por sesión de cada ejercicio. Cada una tiene lectura al tocar y vista en tabla.
- **Cumplimiento:** un día de dieta cuenta como cumplido si las kcal están dentro de ±10 % del objetivo. La adherencia de entreno es sesiones hechas / días de entreno por semana de tu perfil. La *racha* exige además haber entrenado los días con entreno programado.
- **Ajuste semanal (heurístico, no consejo médico):** con ≥ 4 pesajes en 2 semanas (≥ 10 días entre el primero y el último) y comida registrada ≥ 7 de los últimos 14 días, si la tendencia no va hacia tu objetivo propone ±100-200 kcal (perder: pendiente > −0,1 kg/sem; ganar: < +0,05 kg/sem; mantener: |pendiente| > 0,25 kg/sem; y +100 si pierdes más del 1 % del peso por semana). Solo se aplica si lo aceptas; la proteína y la grasa se mantienen y los carbohidratos absorben el cambio. No vuelve a proponer durante 14 días.
- **Recordatorios locales** (entreno en los días programados, comidas, agua y pesaje semanal) con `expo-notifications`. Se programan en el dispositivo, nada se envía a un servidor. **No funcionan en Expo Go para Android** (esa versión de Expo Go no incluye un módulo nativo que la librería necesita para cargarse): requieren una build de desarrollo (`eas build --profile development`) o de producción. En Expo Go la pantalla lo explica y la app no falla.

## Sin conexión (Fase 5)

Una capa entre la app y Supabase (`src/lib/offline`) hace lo siguiente:

- **Lecturas:** guarda en el dispositivo la última respuesta de cada consulta (acotada: 150 entradas, 250 KB por entrada) y, sin red, devuelve esa copia.
- **Escrituras sin red** (entrenos y series, diario de comidas, agua y medidas): se guardan en una cola en el dispositivo, **se ven al instante** en pantalla y se envían **en orden** al volver la conexión (se comprueba al abrir la app, al volver a primer plano y cada 15 s). Los ids se crean en el móvil, así que un reenvío nunca duplica datos. Borrar o editar algo que aún no se había enviado se fusiona en la cola en lugar de enviar peticiones de más.
- **Conflictos:** gana la última escritura (no hay edición simultánea de los mismos datos). Si el servidor rechaza un cambio de forma definitiva (4xx), se descarta y la app lo avisa.
- **Sesión:** si abres la app sin red con el token caducado, se recupera la sesión guardada y se usan los datos del dispositivo; al volver la red se renueva sola.
- **Un aviso flotante** indica «Sin conexión», los cambios pendientes, «Sincronizando…» o los cambios rechazados.
- **Lo que sigue necesitando conexión:** crear o editar rutinas, recetas, alimentos propios, el planificador, el perfil y los objetivos, las fotos, Open Food Facts, exportar datos y eliminar la cuenta. Las pantallas lo indican con un mensaje.
- **Al cerrar sesión o eliminar la cuenta** se borran la copia y la cola del dispositivo. Si hay cambios sin enviar al cerrar sesión, la app avisa de que se perderían.
- Supabase reintenta solo las consultas fallidas; está desactivado (`db: { retry: false }`) porque sin red tardaba ~11 s en dar error.

## Exportar datos (CSV)

Perfil → **Exportar datos (CSV)**: un archivo por tipo (perfil, entrenos, rutinas, diario, agua, medidas, alimentos, recetas, planificador e índice de fotos), en formato *Excel España* (`;` y decimales con coma) o *estándar* (`,` y punto). Lleva BOM UTF-8 y neutraliza los textos que una hoja de cálculo interpretaría como fórmula. Se descarga siempre del servidor (hace falta conexión) tras enviar lo pendiente. Las fotos se guardan una a una desde su pantalla.

## RGPD

- Consentimiento explícito para datos de salud en el onboarding (fecha y versión guardadas); se muestra en **Perfil → Privacidad y datos**.
- Derechos: acceso/portabilidad (CSV), rectificación (editar perfil), supresión (eliminar cuenta: borra primero los archivos de fotos del Storage y después la cuenta; el resto se elimina en cascada).
- RLS en todas las tablas y bucket privado con URL firmadas.

## Antes de publicar la app

Esto no está hecho y es responsabilidad de quien publique:

1. Indicar el responsable del tratamiento en `.env` (`EXPO_PUBLIC_LEGAL_NAME`, `EXPO_PUBLIC_LEGAL_EMAIL`). **Los textos de privacidad son orientativos: hay que revisarlos con un profesional** (política de privacidad, términos, edad mínima, registro de actividades de tratamiento, contrato de encargado con Supabase).
2. Supabase: configurar un SMTP propio, plantillas y URL de redirección del correo de confirmación, recuperación de contraseña, y revisar la región de los datos.
3. Compilar con EAS (`eas build`): los **recordatorios no funcionan en Expo Go para Android**, y las tiendas exigen una URL de política de privacidad.
4. Los datos guardados en el dispositivo para el modo sin conexión no se cifran de forma adicional (los protege el sistema del móvil).
