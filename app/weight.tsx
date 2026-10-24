import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, Card, ErrorText, LinkButton, Screen, Text, TextField } from '../src/components/ui';
import { addDays, dayLabel, toISODate } from '../src/lib/diet-math';
import { METRIC_FIELDS, parseMetricsForm, type MetricKey } from '../src/lib/metrics-form';
import { deleteMetric, listMetrics, saveMetrics, type BodyMetric } from '../src/lib/progress';
import { success } from '../src/lib/haptics';
import { formatKg } from '../src/lib/training-math';
import { useFocusData } from '../src/lib/use-focus-data';
import { useAuth } from '../src/providers/AuthProvider';
import { spacing } from '../src/theme';

const EMPTY: Record<MetricKey, string> = { weight_kg: '', waist_cm: '', hip_cm: '', arm_cm: '', thigh_cm: '' };
const show = (v: number | null) => (v == null ? '' : String(v).replace('.', ','));

export default function Weight() {
  const router = useRouter();
  const { session } = useAuth();
  const today = toISODate(new Date());
  const [date, setDate] = useState(today);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const { data: metrics, error: loadError, reload } = useFocusData(listMetrics);

  // Al cambiar de día (o cargar los datos) se rellena el formulario con lo ya guardado ese día.
  useEffect(() => {
    const m = metrics?.find((x) => x.measured_on === date);
    setForm(m ? { weight_kg: show(m.weight_kg), waist_cm: show(m.waist_cm), hip_cm: show(m.hip_cm), arm_cm: show(m.arm_cm), thigh_cm: show(m.thigh_cm) } : EMPTY);
  }, [date, metrics]);

  // Solo al cambiar de día se limpian el aviso de «Guardado» y los errores.
  useEffect(() => {
    setSaved(false);
    setError(null);
  }, [date]);

  const save = async () => {
    if (!session) return;
    const parsed = parseMetricsForm(form);
    if ('error' in parsed) return setError(parsed.error);
    setSaving(true);
    setError(null);
    try {
      await saveMetrics(session.user.id, date, parsed.values);
      await reload();
      setSaved(true);
      success();
    } catch {
      setError('No se pudo guardar. Comprueba tu conexión.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (m: BodyMetric) => {
    try {
      await deleteMetric(m.id);
      await reload();
    } catch {
      setError('No se pudo borrar el registro.');
    }
  };

  const history = [...(metrics ?? [])].reverse().slice(0, 20);

  return (
    <Screen>
      <Text variant="title">Registrar medidas</Text>
      <Text muted>Pésate siempre en las mismas condiciones (por ejemplo, en ayunas). Todas las medidas son opcionales.</Text>

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <LinkButton title="◀ Anterior" onPress={() => setDate(addDays(date, -1))} />
        <Text variant="label">{dayLabel(date, today)}</Text>
        <LinkButton title="Siguiente ▶" disabled={date >= today} onPress={() => setDate(addDays(date, 1))} />
      </View>

      {METRIC_FIELDS.map((f) => (
        <TextField
          key={f.key}
          label={f.label}
          suffix={f.unit}
          keyboardType="decimal-pad"
          value={form[f.key]}
          onChangeText={(t) => {
            setSaved(false);
            setForm((s) => ({ ...s, [f.key]: t }));
          }}
        />
      ))}
      <ErrorText>{error ?? loadError}</ErrorText>
      {saved ? <Text style={{ fontWeight: '600' }}>Guardado ✓</Text> : null}
      <Button title="Guardar medidas" onPress={save} loading={saving} />

      <Text variant="heading">Historial</Text>
      {metrics && !metrics.length ? <Text muted>Aún no has registrado ninguna medida.</Text> : null}
      {history.map((m) => (
        <Card key={m.id}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.md }}>
            <View style={{ flex: 1 }}>
              <Text variant="label">{dayLabel(m.measured_on, today)}</Text>
              <Text variant="caption" muted>
                {[
                  m.weight_kg != null && `${formatKg(m.weight_kg)} kg`,
                  m.waist_cm != null && `cintura ${formatKg(m.waist_cm)}`,
                  m.hip_cm != null && `cadera ${formatKg(m.hip_cm)}`,
                  m.arm_cm != null && `brazo ${formatKg(m.arm_cm)}`,
                  m.thigh_cm != null && `muslo ${formatKg(m.thigh_cm)}`,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </Text>
            </View>
            <LinkButton title="Borrar" danger onPress={() => void remove(m)} />
          </View>
        </Card>
      ))}
      <Button title="Volver" variant="ghost" onPress={() => router.back()} />
    </Screen>
  );
}
