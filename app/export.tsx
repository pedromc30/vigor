import { useState } from 'react';
import { useRouter } from 'expo-router';
import { Button, Card, ChipSingle, ErrorText, Screen, Text } from '../src/components/ui';
import { CSV_EXCEL_ES, CSV_STANDARD } from '../src/lib/csv';
import { DATASETS, loadTable, saveAndShare, type DatasetKey } from '../src/lib/export';
import { offline } from '../src/lib/supabase';
import { spacing } from '../src/theme';

export default function ExportScreen() {
  const router = useRouter();
  const [format, setFormat] = useState<'excel' | 'standard'>('excel');
  const [busy, setBusy] = useState<DatasetKey | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async (key: DatasetKey) => {
    setBusy(key);
    setError(null);
    setMessage(null);
    try {
      // La exportación debe reflejar todo lo que hay en tu cuenta: hace falta conexión y enviar antes lo pendiente.
      if (!(await offline.probe())) throw new Error('offline');
      if (offline.queue.count > 0) await offline.flush();
      if (offline.queue.count > 0) throw new Error('pending');
      const table = await loadTable(key);
      if (!table.rows.length) {
        setMessage('No hay datos de este tipo para exportar.');
        return;
      }
      const how = await saveAndShare(table, format === 'excel' ? CSV_EXCEL_ES : CSV_STANDARD);
      setMessage(how === 'downloaded' ? `Archivo descargado (${table.rows.length} filas).` : `Exportadas ${table.rows.length} filas.`);
    } catch (e) {
      const m = e instanceof Error ? e.message : '';
      setError(
        m === 'offline'
          ? 'Necesitas conexión para exportar tus datos completos.'
          : m === 'pending'
            ? 'Aún hay cambios sin enviar. Inténtalo de nuevo cuando termine la sincronización.'
            : 'No se pudo exportar. Comprueba tu conexión e inténtalo de nuevo.',
      );
    } finally {
      setBusy(null);
    }
  };

  return (
    <Screen>
      <Text variant="title">Exportar datos</Text>
      <Text muted>Descarga tus datos en CSV, un archivo por tipo. También sirve para llevártelos a otra aplicación.</Text>

      <Text variant="label">Formato</Text>
      <ChipSingle
        value={format}
        onChange={(v) => setFormat(v ?? 'excel')}
        options={[
          { key: 'excel', label: 'Excel (España)' },
          { key: 'standard', label: 'Estándar' },
        ]}
      />
      <Text variant="caption" muted>
        {format === 'excel'
          ? 'Separador «;» y decimales con coma: se abre bien con doble clic en Excel con configuración española.'
          : 'Separador «,» y decimales con punto: formato habitual para programas y otras hojas de cálculo.'}
      </Text>

      <ErrorText>{error}</ErrorText>
      {message ? <Text style={{ fontWeight: '600' }}>{message}</Text> : null}

      {DATASETS.map((d) => (
        <Card key={d.key}>
          <Text variant="heading">{d.label}</Text>
          <Text variant="caption" muted>
            {d.hint}
          </Text>
          <Button title="Exportar" variant="secondary" onPress={() => void run(d.key)} loading={busy === d.key} disabled={busy !== null && busy !== d.key} />
        </Card>
      ))}
      <Text variant="caption" muted style={{ paddingBottom: spacing.sm }}>
        Las fotos de progreso no van en el CSV. Para conservarlas abre cada foto en Progreso → Fotos y usa «Guardar / compartir» antes de eliminar tu cuenta.
      </Text>
      <Button title="Volver" variant="ghost" onPress={() => router.back()} />
    </Screen>
  );
}
