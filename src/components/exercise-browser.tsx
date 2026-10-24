import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { useAuth } from '../providers/AuthProvider';
import { EQUIPMENT, EQUIPMENT_LABELS, MUSCLE_GROUPS, MUSCLE_LABELS, type Equipment, type MuscleGroup } from '../lib/labels';
import { createExercise, deleteExercise, listExercises, type Exercise } from '../lib/training';
import { spacing } from '../theme';
import { Button, Card, ChipSingle, ErrorText, LinkButton, Text, TextField } from './ui';
import { Pressable } from 'react-native';

const normalize = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/**
 * Biblioteca de ejercicios: búsqueda, filtro por grupo muscular y creación de ejercicios propios.
 * Con `onPick` funciona como selector; sin él, al tocar un ejercicio se muestra su descripción.
 */
export function ExerciseBrowser({ onPick }: { onPick?: (e: Exercise) => void }) {
  const { session } = useAuth();
  const [all, setAll] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState<MuscleGroup | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const load = async () => {
    try {
      setError(null);
      setAll(await listExercises());
    } catch {
      setError('No se pudo cargar la biblioteca. Comprueba tu conexión.');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(() => {
    const q = normalize(query.trim());
    return all.filter((e) => (!group || e.muscle_group === group) && (!q || normalize(e.name).includes(q)));
  }, [all, query, group]);

  const remove = async (e: Exercise) => {
    try {
      await deleteExercise(e.id);
      setAll((list) => list.filter((x) => x.id !== e.id));
    } catch {
      setError('No se puede borrar: el ejercicio está en una rutina o tiene historial.');
    }
  };

  if (creating && session) {
    return (
      <ExerciseForm
        userId={session.user.id}
        onCancel={() => setCreating(false)}
        onCreated={(e) => {
          setAll((list) => [...list, e].sort((a, b) => a.name.localeCompare(b.name, 'es')));
          setCreating(false);
          onPick?.(e);
        }}
      />
    );
  }

  return (
    <View style={{ gap: spacing.md }}>
      <TextField label="Buscar" value={query} onChangeText={setQuery} placeholder="Nombre del ejercicio" />
      <ChipSingle
        allLabel="Todos"
        value={group}
        onChange={setGroup}
        options={MUSCLE_GROUPS.map((g) => ({ key: g, label: MUSCLE_LABELS[g] }))}
      />
      <Button title="Crear ejercicio propio" variant="secondary" onPress={() => setCreating(true)} />
      <ErrorText>{error}</ErrorText>
      {loading ? <Text muted>Cargando…</Text> : null}
      {!loading && !filtered.length ? <Text muted>No hay ejercicios que coincidan.</Text> : null}
      {filtered.map((e) => (
        <Card key={e.id}>
          <Pressable
            accessibilityRole="button"
            onPress={() => (onPick ? onPick(e) : setExpanded(expanded === e.id ? null : e.id))}
          >
            <Text variant="label">{e.name}</Text>
            <Text variant="caption" muted>
              {MUSCLE_LABELS[e.muscle_group]} · {EQUIPMENT_LABELS[e.equipment]}
              {e.user_id ? ' · Propio' : ''}
            </Text>
          </Pressable>
          {!onPick && expanded === e.id ? (
            <>
              <Text variant="caption">{e.description || 'Sin descripción.'}</Text>
              {e.user_id ? <LinkButton title="Eliminar ejercicio" danger onPress={() => void remove(e)} /> : null}
            </>
          ) : null}
        </Card>
      ))}
    </View>
  );
}

function ExerciseForm({
  userId,
  onCancel,
  onCreated,
}: {
  userId: string;
  onCancel: () => void;
  onCreated: (e: Exercise) => void;
}) {
  const [name, setName] = useState('');
  const [group, setGroup] = useState<MuscleGroup | null>(null);
  const [equipment, setEquipment] = useState<Equipment | null>(null);
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const trimmed = name.trim();
    if (trimmed.length < 2 || trimmed.length > 80) return setError('El nombre debe tener entre 2 y 80 caracteres.');
    if (!group) return setError('Elige el grupo muscular.');
    if (!equipment) return setError('Elige el material.');
    setSaving(true);
    setError(null);
    try {
      onCreated(
        await createExercise(
          { name: trimmed, muscle_group: group, equipment, description: description.trim() },
          userId,
        ),
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : '';
      setError(msg.includes('duplicate') ? 'Ya tienes un ejercicio con ese nombre.' : 'No se pudo crear el ejercicio.');
      setSaving(false);
    }
  };

  return (
    <View style={{ gap: spacing.md }}>
      <Text variant="heading">Nuevo ejercicio</Text>
      <TextField label="Nombre" value={name} onChangeText={setName} maxLength={80} />
      <Text variant="label">Grupo muscular</Text>
      <ChipSingle
        value={group}
        onChange={setGroup}
        options={MUSCLE_GROUPS.map((g) => ({ key: g, label: MUSCLE_LABELS[g] }))}
      />
      <Text variant="label">Material</Text>
      <ChipSingle
        value={equipment}
        onChange={setEquipment}
        options={EQUIPMENT.map((g) => ({ key: g, label: EQUIPMENT_LABELS[g] }))}
      />
      <TextField
        label="Descripción (opcional)"
        value={description}
        onChangeText={setDescription}
        multiline
        maxLength={1000}
        style={{ minHeight: 80, textAlignVertical: 'top' }}
      />
      <ErrorText>{error}</ErrorText>
      <Button title="Guardar ejercicio" onPress={save} loading={saving} />
      <Button title="Cancelar" variant="ghost" onPress={onCancel} />
    </View>
  );
}
