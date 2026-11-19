import { parseDietText } from '../diet-text';

const sample = `Lunes
Desayuno: avena 40 g, leche 200 ml
Media mañana: 1 plátano
Comida
Arroz 80 g con pollo 150 g
Ensalada
Cena - Tortilla de 2 huevos
Total: 2.100 kcal · 150 g proteína · 220 g hidratos · 60 g grasa
Martes
Desayuno: tostadas con tomate
`;

describe('parseDietText', () => {
  const p = parseDietText(sample);
  const of = (day: number, meal: string) => p.entries.filter((e) => e.weekday === day && e.meal === meal);

  it('coloca cada comida en su día, con el contenido en la misma línea o en las de debajo', () => {
    expect(p.layout).toBe('photo');
    expect(of(1, 'desayuno').length).toBeGreaterThanOrEqual(2); // avena y leche
    expect(of(1, 'snacks').length).toBe(1);
    expect(of(1, 'comida').length).toBeGreaterThanOrEqual(2); // arroz con pollo + ensalada
    expect(of(1, 'cena').length).toBe(1);
    expect(of(2, 'desayuno').length).toBeGreaterThanOrEqual(1);
    expect(p.entries.every((e) => e.weekday === 1 || e.weekday === 2)).toBe(true);
  });
  it('reconoce los totales del día como objetivos', () => {
    expect(p.dayTargets?.['1']).toEqual({ kcal: 2100, protein_g: 150, carbs_g: 220, fat_g: 60 });
    expect(p.dayTargets?.['2']).toBeUndefined();
    expect(p.targets.kcal).toBe(2100);
  });
  it('avisa de que el texto de una foto puede tener errores', () => {
    expect(p.notes.join(' ')).toMatch(/foto/i);
  });
  it('reconoce días con adornos: «Día 3 - Miércoles», «JUEVES:», «Viernes · entreno»', () => {
    const t = parseDietText('Día 3 - Miércoles\nCena: sopa\nJUEVES:\nCena: pasta\nViernes · entreno\nCena: pizza');
    expect(t.entries.map((e) => e.weekday)).toEqual([3, 4, 5]);
  });
  it('sin día en la foto usa el día elegido; sin ninguno, avisa y no inventa', () => {
    const a = parseDietText('Desayuno: café\nCena: sopa', 4);
    expect(a.entries.length).toBe(2);
    expect(a.entries.every((e) => e.weekday === 4)).toBe(true);
    const b = parseDietText('Desayuno: café\nCena: sopa');
    expect(b.entries).toEqual([]);
    expect(b.skipped.length).toBeGreaterThan(0);
    expect(b.notes.join(' ')).toMatch(/ning[uú]n d[ií]a/i);
  });
  it('una frase de comida no se confunde con un título', () => {
    const t = parseDietText('Lunes\nComida: pollo\nComida de pollo con arroz y verduras al horno');
    expect(t.entries.length).toBeGreaterThanOrEqual(1);
    expect(t.entries.some((e) => /pollo con arroz/i.test(e.name) || /pollo/i.test(e.name))).toBe(true);
  });
  it('texto vacío no rompe', () => {
    const t = parseDietText('');
    expect(t.entries).toEqual([]);
  });
});
