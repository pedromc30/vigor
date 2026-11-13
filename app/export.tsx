import { useState } from 'react';
import { useRouter } from 'expo-router';
import { ActionSheet } from '../src/components/action-sheet';
import { Button, Card, ChipSingle, ErrorText, Screen, Text } from '../src/components/ui';
import { CSV_EXCEL_ES, CSV_STANDARD } from '../src/lib/csv';
import { DATASETS, loadExcelSheets, loadTable, saveAndShare, saveAndShareXlsx, type DatasetKey, type ExcelExport } from '../src/lib/export';
import { offline } from '../src/lib/supabase';
import { spacing } from '../src/theme';

export default function ExportScreen() {
  const router = useRouter();
  const [format, setFormat] = useState<'excel' | 'standard'>('excel');
  const [busy, setBusy] = useState<DatasetKey | ExcelExport | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  /** Comprueba conexión y envía lo pendiente: la exportación debe reflejar todo lo que hay en tu cuenta. */
  const guarded = async (key: DatasetKey | ExcelExport, job: () => Promise<void>) => {
    setBusy(key);
    setError(null);
    setMessage(null);
    try {
      if (!(await offline.probe())) throw new Error('offline');
      if (offline.queue.count > 0) await offline.flush();
      if (offline.queue.count > 0) throw new Error('pending');
      await job();
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

  const runCsv = (key: DatasetKey) =>
    guarded(key, async () => {
      const table = await loadTable(key);
      if (!table.rows.length) {
        setMessage('No hay datos de este tipo para exportar.');
        return;
      }
      const how = await saveAndShare(table, format === 'excel' ? CSV_EXCEL_ES : CSV_STANDARD);
      setMessage(how === 'downloaded' ? `Archivo descargado (${table.rows.length} filas).` : `Exportadas ${table.rows.length} filas.`);
    });

  const runExcel = (kind: ExcelExport) =>
    guarded(kind, async () => {
      const book = await loadExcelSheets(kind);
      if (!book) {
        setMessage('No hay datos de este tipo para exportar.');
        return;
      }
      const how = await saveAndShareXlsx(book.filename, book.sheets);
      setMessage(how === 'downloaded' ? 'Archivo de Excel descargado.' : 'Archivo de Excel listo para compartir.');
    });

  return (
    <Screen>
      <Text variant="title">Exportar datos</Text>
      <Text muted>Descarga tus datos en Excel o en CSV. También sirve para llevártelos a otra aplicación.</Text>

      <Card>
        <Text variant="heading">Exportar datos</Text>
        <Text variant="caption" muted>
          Archivo de Excel con una columna por día (las fechas arriba) y una fila por dato, con los colores de la app. Elige si quieres la dieta, los entrenos o ambos (un solo archivo con dos hojas).
        </Text>
        <Button title="Exportar datos" onPress={() => setSheetOpen(true)} loading={busy === 'dieta' || busy === 'entrenos' || busy === 'ambos'} disabled={busy !== null} />
      </Card>

      <ActionSheet
        visible={sheetOpen}
        title="¿Qué quieres exportar?"
        onClose={() => setSheetOpen(false)}
        actions={[
          { label: 'Exportar dieta', icon: 'nutrition-outline', onPress: () => void runExcel('dieta') },
          { label: 'Exportar entrenos', icon: 'barbell-outline', onPress: () => void runExcel('entrenos') },
          { label: 'Exportar dieta y entrenos', icon: 'documents-outline', onPress: () => void runExcel('ambos') },
        ]}
      />

      <Text variant="heading">Otros datos en CSV</Text>

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
          <Button title="Exportar" variant="secondary" onPress={() => void runCsv(d.key)} loading={busy === d.key} disabled={busy !== null && busy !== d.key} />
        </Card>
      ))}
      <Text variant="caption" muted style={{ paddingBottom: spacing.sm }}>
        Las fotos de progreso y los archivos de dieta no van en el CSV. Para conservarlos, abre cada foto en Progreso → Fotos o cada archivo en Dieta → Archivos de dieta y usa «Guardar / compartir» o «Compartir» antes de eliminar tu cuenta.
      </Text>
      <Button title="Volver" variant="ghost" onPress={() => router.back()} />
    </Screen>
  );
}
