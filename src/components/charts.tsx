import { useState, type ReactNode } from 'react';
import { Pressable, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Line, Path, Rect, Text as SvgText } from 'react-native-svg';
import { niceTicks } from '../lib/progress-math';
import { spacing, useTheme } from '../theme';
import { Text } from './ui';

// Gráficas SVG sencillas siguiendo las pautas de visualización: líneas de 2 px, barras de ≤ 24 px con
// extremo redondeado, cuadrícula de 1 px muy suave, marcadores con anillo del color de la superficie,
// una sola escala vertical, texto siempre en colores de texto (nunca en el color de la serie), leyenda
// cuando hay ≥ 2 series y vista en tabla como alternativa accesible.

const PAD = { left: 44, right: 12, top: 12, bottom: 26 };

function useWidth(initial = 320) {
  const [w, setW] = useState(initial);
  return { width: w, onLayout: (e: LayoutChangeEvent) => setW(Math.max(200, Math.round(e.nativeEvent.layout.width))) };
}

export interface LegendItem {
  label: string;
  color: string;
  kind?: 'line' | 'dot' | 'bar';
}

export function Legend({ items }: { items: LegendItem[] }) {
  if (items.length < 2) return null; // una sola serie: el título ya dice qué se pinta
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
      {items.map((i) => (
        <View key={i.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View
            style={{
              width: i.kind === 'line' ? 16 : 10,
              height: i.kind === 'line' ? 2 : 10,
              borderRadius: i.kind === 'bar' ? 2 : i.kind === 'dot' ? 5 : 1,
              backgroundColor: i.color,
            }}
          />
          <Text variant="caption" muted>
            {i.label}
          </Text>
        </View>
      ))}
    </View>
  );
}

/** Cabecera de una gráfica: título, subtítulo opcional y lectura del punto seleccionado. */
export function ChartFrame({
  title,
  subtitle,
  readout,
  legend,
  table,
  children,
}: {
  title: string;
  subtitle?: string;
  readout?: string | null;
  legend?: LegendItem[];
  table?: { headers: string[]; rows: string[][] };
  children: ReactNode;
}) {
  const [showTable, setShowTable] = useState(false);
  const { colors } = useTheme();
  return (
    <View style={{ gap: spacing.sm }}>
      <View>
        <Text variant="heading">{title}</Text>
        {subtitle ? (
          <Text variant="caption" muted>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {legend ? <Legend items={legend} /> : null}
      <Text variant="label" style={{ minHeight: 20 }} accessibilityLiveRegion="polite">
        {readout ?? ' '}
      </Text>
      {children}
      {table ? (
        <>
          <Pressable accessibilityRole="button" onPress={() => setShowTable((v) => !v)} hitSlop={8} style={{ minHeight: 32, justifyContent: 'center' }}>
            <Text variant="label" style={{ color: colors.primary }}>
              {showTable ? 'Ocultar tabla' : 'Ver como tabla'}
            </Text>
          </Pressable>
          {showTable ? (
            <View style={{ gap: 2 }}>
              <View style={{ flexDirection: 'row' }}>
                {table.headers.map((h) => (
                  <Text key={h} variant="caption" style={{ flex: 1, fontWeight: '700' }}>
                    {h}
                  </Text>
                ))}
              </View>
              {table.rows.map((r, i) => (
                <View key={i} style={{ flexDirection: 'row' }}>
                  {r.map((c, j) => (
                    <Text key={j} variant="caption" muted style={{ flex: 1 }}>
                      {c}
                    </Text>
                  ))}
                </View>
              ))}
            </View>
          ) : null}
        </>
      ) : null}
    </View>
  );
}

export interface LineSeries {
  label: string;
  color: string;
  /** t = posición horizontal (días desde el inicio), v = valor */
  points: { t: number; v: number }[];
  /** Solo marcadores, sin línea (mediciones sueltas). */
  dotsOnly?: boolean;
}

export function LineChart({
  series,
  xLabels,
  height = 190,
  format = (v) => String(v),
  referenceLine,
  selected,
  onSelect,
  ariaLabel,
}: {
  series: LineSeries[];
  xLabels: { t: number; label: string }[];
  height?: number;
  format?: (v: number) => string;
  referenceLine?: { value: number; label: string };
  /** Índice del punto seleccionado dentro de la serie 0. */
  selected?: number | null;
  onSelect?: (index: number) => void;
  ariaLabel: string;
}) {
  const { colors } = useTheme();
  const { width, onLayout } = useWidth();
  const all = series.flatMap((s) => s.points);
  if (!all.length) return <View onLayout={onLayout} />;

  const tMin = Math.min(...all.map((p) => p.t));
  const tMax = Math.max(...all.map((p) => p.t));
  const vals = [...all.map((p) => p.v), ...(referenceLine ? [referenceLine.value] : [])];
  const lo = Math.min(...vals);
  const hi = Math.max(...vals);
  const pad = hi === lo ? 1 : (hi - lo) * 0.08;
  const ticks = niceTicks(lo - pad, hi + pad, 4);
  const yMin = ticks[0];
  const yMax = ticks[ticks.length - 1];
  const innerW = width - PAD.left - PAD.right;
  const innerH = height - PAD.top - PAD.bottom;
  const x = (t: number) => PAD.left + (tMax === tMin ? innerW / 2 : ((t - tMin) / (tMax - tMin)) * innerW);
  const y = (v: number) => PAD.top + (yMax === yMin ? innerH / 2 : (1 - (v - yMin) / (yMax - yMin)) * innerH);
  const sel = selected != null ? series[0]?.points[selected] : undefined;

  return (
    <View onLayout={onLayout} accessible accessibilityRole="image" accessibilityLabel={ariaLabel}>
      <Svg width={width} height={height}>
        {ticks.map((t) => (
          <Line key={t} x1={PAD.left} x2={width - PAD.right} y1={y(t)} y2={y(t)} stroke={colors.border} strokeWidth={1} />
        ))}
        {ticks.map((t) => (
          <SvgText key={`l${t}`} x={PAD.left - 6} y={y(t) + 4} fontSize={11} fill={colors.textMuted} textAnchor="end">
            {format(t)}
          </SvgText>
        ))}
        {xLabels.map((l, i) => (
          <SvgText
            key={`${l.t}-${i}`}
            x={x(l.t)}
            y={height - 6}
            fontSize={11}
            fill={colors.textMuted}
            textAnchor={i === 0 ? 'start' : i === xLabels.length - 1 ? 'end' : 'middle'}
          >
            {l.label}
          </SvgText>
        ))}
        {referenceLine ? (
          <>
            <Line x1={PAD.left} x2={width - PAD.right} y1={y(referenceLine.value)} y2={y(referenceLine.value)} stroke={colors.textMuted} strokeWidth={1} />
            <SvgText x={width - PAD.right} y={y(referenceLine.value) - 4} fontSize={11} fill={colors.textMuted} textAnchor="end">
              {referenceLine.label}
            </SvgText>
          </>
        ) : null}
        {sel ? <Line x1={x(sel.t)} x2={x(sel.t)} y1={PAD.top} y2={PAD.top + innerH} stroke={colors.textMuted} strokeWidth={1} /> : null}
        {series.map((s) =>
          !s.dotsOnly && s.points.length > 1 ? (
            <Path
              key={s.label}
              d={s.points.map((p, i) => `${i ? 'L' : 'M'}${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ')}
              stroke={s.color}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
              fill="none"
            />
          ) : null,
        )}
        {series.map((s) =>
          s.dotsOnly || s.points.length === 1 || s.points.length <= 12
            ? s.points.map((p, i) => <Circle key={`${s.label}${i}`} cx={x(p.t)} cy={y(p.v)} r={4} fill={s.color} stroke={colors.surface} strokeWidth={2} />)
            : null,
        )}
        {sel ? <Circle cx={x(sel.t)} cy={y(sel.v)} r={6} fill={series[0].color} stroke={colors.surface} strokeWidth={2} /> : null}
        {onSelect
          ? series[0].points.map((p, i) => (
              <Circle key={`hit${i}`} cx={x(p.t)} cy={y(p.v)} r={16} fill="transparent" onPress={() => onSelect(i)} />
            ))
          : null}
      </Svg>
    </View>
  );
}

export interface BarSeries {
  label: string;
  color: string;
  values: (number | null)[];
}

/** Barra con el extremo superior redondeado (4 px) y la base recta, anclada al eje. */
function barPath(x: number, y: number, w: number, h: number) {
  const r = Math.min(4, w / 2, h);
  return `M${x},${y + h} L${x},${y + r} Q${x},${y} ${x + r},${y} L${x + w - r},${y} Q${x + w},${y} ${x + w},${y + r} L${x + w},${y + h} Z`;
}

export function BarChart({
  categories,
  series,
  height = 190,
  format = (v) => String(v),
  target,
  maxValue,
  selected,
  onSelect,
  ariaLabel,
}: {
  categories: string[];
  series: BarSeries[];
  height?: number;
  format?: (v: number) => string;
  target?: { value: number; label: string };
  /** Fija el máximo del eje (p. ej. 100 para porcentajes). */
  maxValue?: number;
  selected?: number | null;
  onSelect?: (index: number) => void;
  ariaLabel: string;
}) {
  const { colors } = useTheme();
  const { width, onLayout } = useWidth();
  const values = series.flatMap((s) => s.values.filter((v): v is number => v != null));
  if (!categories.length) return <View onLayout={onLayout} />;

  const top = maxValue ?? Math.max(1, ...values, target?.value ?? 0);
  const ticks = niceTicks(0, top * 1.05, 4);
  const yMax = maxValue ?? ticks[ticks.length - 1];
  const shownTicks = maxValue ? ticks.filter((t) => t <= maxValue) : ticks;
  const innerW = width - PAD.left - PAD.right;
  const innerH = height - PAD.top - PAD.bottom;
  const slot = innerW / categories.length;
  const gap = 2; // separación de 2 px entre barras contiguas
  const barW = Math.min(24, (slot * 0.7 - gap * (series.length - 1)) / series.length);
  const groupW = barW * series.length + gap * (series.length - 1);
  const y = (v: number) => PAD.top + (1 - v / yMax) * innerH;
  const every = Math.max(1, Math.ceil(categories.length / Math.floor(innerW / 34)));

  return (
    <View onLayout={onLayout} accessible accessibilityRole="image" accessibilityLabel={ariaLabel}>
      <Svg width={width} height={height}>
        {shownTicks.map((t) => (
          <Line key={t} x1={PAD.left} x2={width - PAD.right} y1={y(t)} y2={y(t)} stroke={colors.border} strokeWidth={1} />
        ))}
        {shownTicks.map((t) => (
          <SvgText key={`l${t}`} x={PAD.left - 6} y={y(t) + 4} fontSize={11} fill={colors.textMuted} textAnchor="end">
            {format(t)}
          </SvgText>
        ))}
        {categories.map((c, i) =>
          i % every === 0 ? (
            <SvgText key={c + i} x={PAD.left + slot * i + slot / 2} y={height - 6} fontSize={11} fill={colors.textMuted} textAnchor="middle">
              {c}
            </SvgText>
          ) : null,
        )}
        {categories.map((c, i) =>
          series.map((s, si) => {
            const v = s.values[i];
            if (v == null || v <= 0) return null;
            const h = Math.max(2, (v / yMax) * innerH);
            const bx = PAD.left + slot * i + (slot - groupW) / 2 + si * (barW + gap);
            return (
              <Path
                key={`${s.label}${i}`}
                d={barPath(bx, PAD.top + innerH - h, barW, h)}
                fill={s.color}
                opacity={selected != null && selected !== i ? 0.45 : 1}
              />
            );
          }),
        )}
        {target ? (
          <>
            <Line x1={PAD.left} x2={width - PAD.right} y1={y(target.value)} y2={y(target.value)} stroke={colors.textMuted} strokeWidth={1} />
            <SvgText x={width - PAD.right} y={y(target.value) - 4} fontSize={11} fill={colors.textMuted} textAnchor="end">
              {target.label}
            </SvgText>
          </>
        ) : null}
        <Line x1={PAD.left} x2={width - PAD.right} y1={PAD.top + innerH} y2={PAD.top + innerH} stroke={colors.textMuted} strokeWidth={1} />
        {onSelect
          ? categories.map((c, i) => (
              <Rect key={`hit${i}`} x={PAD.left + slot * i} y={PAD.top} width={slot} height={innerH} fill="transparent" onPress={() => onSelect(i)} />
            ))
          : null}
      </Svg>
    </View>
  );
}
