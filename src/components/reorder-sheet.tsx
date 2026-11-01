import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Modal, PanResponder, Pressable, ScrollView, useWindowDimensions, View, type HostInstance, type ScrollViewInstance } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { dropIndex, moveItem } from '../lib/plan';
import { radius, spacing, useTheme } from '../theme';
import { Button, Text } from './ui';

export const REORDER_ROW_HEIGHT = 56;
const EDGE = 56; // zona (px) junto al borde de la lista en la que el arrastre desplaza la lista
const SCROLL_STEP = 10;

export interface ReorderItem {
  key: string;
  label: string;
  hint?: string;
}

/**
 * Hoja para cambiar el orden de una lista arrastrando el asa de cada fila. Las filas tienen altura fija, así que el
 * destino se calcula con el desplazamiento del dedo; si la lista es larga, se desplaza sola al acercarse a los bordes.
 * El orden solo se aplica al pulsar «Listo». También se puede mover con las acciones de accesibilidad (subir/bajar).
 */
export function ReorderSheet({
  visible,
  title,
  subtitle,
  items,
  onClose,
  onApply,
}: {
  visible: boolean;
  title: string;
  subtitle?: string;
  items: ReorderItem[];
  onClose: () => void;
  onApply: (keys: string[]) => void;
}) {
  const { colors } = useTheme();
  const { height } = useWindowDimensions();
  const [order, setOrder] = useState<string[]>([]);
  const [drag, setDrag] = useState<{ from: number; to: number } | null>(null);
  const dy = useRef(new Animated.Value(0)).current;
  const scrollRef = useRef<ScrollViewInstance>(null);
  const scrollY = useRef(0);
  const viewport = useRef<{ top: number; bottom: number } | null>(null);
  const live = useRef({ from: 0, scrollAtStart: 0, fingerDy: 0, fingerY: 0, timer: null as ReturnType<typeof setInterval> | null });

  // El orden de trabajo se inicia al abrir la hoja; si la pantalla de fondo se vuelve a pintar mientras se arrastra, no se pierde.
  const itemsRef = useRef(items);
  itemsRef.current = items;
  useEffect(() => {
    if (visible) {
      setOrder(itemsRef.current.map((i) => i.key));
      setDrag(null);
      scrollY.current = 0;
    }
  }, [visible]);

  const byKey = useMemo(() => new Map(items.map((i) => [i.key, i])), [items]);
  const count = order.length;

  const stopTimer = () => {
    if (live.current.timer) clearInterval(live.current.timer);
    live.current.timer = null;
  };
  useEffect(() => stopTimer, []);

  const refresh = () => {
    const l = live.current;
    const total = l.fingerDy + (scrollY.current - l.scrollAtStart); // lo que se ha movido el dedo respecto a la lista
    dy.setValue(total);
    setDrag({ from: l.from, to: dropIndex(l.from, total, REORDER_ROW_HEIGHT, count) });
  };

  const begin = (index: number) => {
    const l = live.current;
    l.from = index;
    l.fingerDy = 0;
    l.scrollAtStart = scrollY.current;
    dy.setValue(0);
    setDrag({ from: index, to: index });
    // Autodesplazamiento: mientras el dedo esté cerca del borde de la lista, se desplaza la lista.
    stopTimer();
    l.timer = setInterval(() => {
      const vp = viewport.current;
      if (!vp) return;
      if (l.fingerY < vp.top + EDGE) scrollRef.current?.scrollTo({ y: Math.max(0, scrollY.current - SCROLL_STEP), animated: false });
      else if (l.fingerY > vp.bottom - EDGE) scrollRef.current?.scrollTo({ y: scrollY.current + SCROLL_STEP, animated: false });
      else return;
      refresh();
    }, 16);
  };

  const move = (fingerDy: number, fingerY: number) => {
    live.current.fingerDy = fingerDy;
    live.current.fingerY = fingerY;
    refresh();
  };

  const end = () => {
    stopTimer();
    const l = live.current;
    const total = l.fingerDy + (scrollY.current - l.scrollAtStart);
    const to = dropIndex(l.from, total, REORDER_ROW_HEIGHT, count);
    setOrder((o) => moveItem(o, l.from, to));
    setDrag(null);
    dy.setValue(0);
  };

  const viewportRef = useRef<HostInstance>(null);
  const measureViewport = () => {
    // Posición del área de la lista en la ventana, para el autodesplazamiento. Si no se puede medir, no hay autodesplazamiento.
    try {
      viewportRef.current?.measureInWindow((_x, y, _w, h) => {
        viewport.current = { top: y, bottom: y + h };
      });
    } catch {
      viewport.current = null;
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }}>
        <Pressable accessibilityLabel="Cerrar" style={{ flex: 1 }} onPress={onClose} />
        <View
          style={{
            backgroundColor: colors.background,
            borderTopLeftRadius: radius.lg,
            borderTopRightRadius: radius.lg,
            padding: spacing.lg,
            gap: spacing.md,
            maxHeight: height * 0.85,
            width: '100%',
            maxWidth: 640,
            alignSelf: 'center',
          }}
        >
          <View>
            <Text variant="heading">{title}</Text>
            {subtitle ? (
              <Text variant="caption" muted>
                {subtitle}
              </Text>
            ) : null}
          </View>

          <View ref={viewportRef} style={{ maxHeight: Math.max(REORDER_ROW_HEIGHT * 3, height * 0.85 - 220) }} onLayout={measureViewport}>
            <ScrollView
              ref={scrollRef}
              scrollEnabled={!drag}
              scrollEventThrottle={16}
              onScroll={(e) => {
                scrollY.current = e.nativeEvent.contentOffset.y;
              }}
              style={{ flexGrow: 0 }}
            >
              <View style={{ height: REORDER_ROW_HEIGHT * count }}>
                {order.map((key, index) => (
                  <Row
                    key={key}
                    item={byKey.get(key)}
                    index={index}
                    count={count}
                    drag={drag}
                    dy={dy}
                    onBegin={begin}
                    onMove={move}
                    onEnd={end}
                    onStep={(delta) => setOrder((o) => moveItem(o, index, index + delta))}
                  />
                ))}
              </View>
            </ScrollView>
          </View>

          <Button
            title="Listo"
            onPress={() => {
              onApply(order);
              onClose();
            }}
          />
          <Button title="Cancelar" variant="ghost" onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}

function Row({
  item,
  index,
  count,
  drag,
  dy,
  onBegin,
  onMove,
  onEnd,
  onStep,
}: {
  item?: ReorderItem;
  index: number;
  count: number;
  drag: { from: number; to: number } | null;
  dy: Animated.Value;
  onBegin: (index: number) => void;
  onMove: (dy: number, fingerY: number) => void;
  onEnd: () => void;
  onStep: (delta: number) => void;
}) {
  const { colors } = useTheme();
  // El PanResponder se crea una vez; las funciones vigentes se leen de la referencia.
  const latest = useRef({ index, onBegin, onMove, onEnd });
  latest.current = { index, onBegin, onMove, onEnd };
  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: () => latest.current.onBegin(latest.current.index),
        onPanResponderMove: (_e, g) => latest.current.onMove(g.dy, g.moveY),
        onPanResponderRelease: () => latest.current.onEnd(),
        onPanResponderTerminate: () => latest.current.onEnd(),
      }),
    [],
  );

  const dragging = drag?.from === index;
  // Las filas por las que pasa la fila arrastrada se apartan una posición.
  let shift = 0;
  if (drag && !dragging) {
    if (drag.from < drag.to && index > drag.from && index <= drag.to) shift = -REORDER_ROW_HEIGHT;
    if (drag.from > drag.to && index < drag.from && index >= drag.to) shift = REORDER_ROW_HEIGHT;
  }

  if (!item) return null;
  return (
    <Animated.View
      accessible
      accessibilityLabel={`${item.label}, posición ${index + 1} de ${count}`}
      accessibilityActions={[
        { name: 'increment', label: 'Subir' },
        { name: 'decrement', label: 'Bajar' },
      ]}
      onAccessibilityAction={(e) => {
        if (e.nativeEvent.actionName === 'increment') onStep(-1);
        if (e.nativeEvent.actionName === 'decrement') onStep(1);
      }}
      style={{
        position: 'absolute',
        top: index * REORDER_ROW_HEIGHT,
        left: 0,
        right: 0,
        height: REORDER_ROW_HEIGHT,
        zIndex: dragging ? 10 : 0,
        transform: [{ translateY: dragging ? dy : shift }],
        paddingVertical: 3,
      }}
    >
      <View
        style={{
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.md,
          paddingLeft: spacing.md,
          borderRadius: radius.md,
          borderWidth: dragging ? 2 : 1,
          borderColor: dragging ? colors.primary : colors.border,
          backgroundColor: colors.surface,
          elevation: dragging ? 4 : 0,
        }}
      >
        <Text variant="label" muted style={{ width: 22 }}>
          {index + 1}
        </Text>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text variant="label" numberOfLines={1}>
            {item.label}
          </Text>
          {item.hint ? (
            <Text variant="caption" muted numberOfLines={1}>
              {item.hint}
            </Text>
          ) : null}
        </View>
        <View
          {...pan.panHandlers}
          testID={`reorder-handle-${index}`}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={{ width: 56, height: '100%', alignItems: 'center', justifyContent: 'center' }}
        >
          <Ionicons name="reorder-three" size={28} color={colors.textMuted} />
        </View>
      </View>
    </Animated.View>
  );
}
