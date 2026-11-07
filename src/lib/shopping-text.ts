// Saca los ingredientes (con sus cantidades) de un texto de comida como
// «Gachas: 70 g de avena cocida en 250 ml de leche + 30 g de proteína whey + 1 plátano + 1 cucharada de aceite».
// Se usa para la lista de la compra de dietas importadas, cuyas entradas no están enlazadas a un alimento de la app.
// Es una estimación a partir del texto: reconoce «N g/ml/kg de X», «N cucharada(s)/cucharadita(s) de X» y «N unidades de X».
const WORD = '[a-záéíóúüñ]+';
// Nombre de un ingrediente: palabras unidas por «de/del», hasta una palabra que lo corta (con, y, en, o, al, cocida…)
const NOUN = `${WORD}(?:\\s+(?:de|del)\\s+${WORD})*(?:\\s+(?!con\\b|y\\b|en\\b|o\\b|al\\b|a\\b|la\\b|cocid|escurrid|picad|de\\b)${WORD})*`;

export interface TextIngredient {
  name: string;
  grams?: number;
  units?: number;
}

const clean = (name: string) =>
  name
    .replace(/\s+/g, ' ')
    .replace(/^(lata|latas|bote|botes)\s+de\s+/i, '')
    .trim();

const num = (s: string) => Number(s.replace(',', '.'));
const UNIT_G = (u: string) => (/^kg$/i.test(u) ? 1000 : 1);

export function ingredientsFromText(input: string): TextIngredient[] {
  let t = ' ' + input.toLowerCase().replace(/\([^)]*\)/g, ' ').replace(/^[^:]{1,40}:\s*/, ' ') + ' ';
  const out: TextIngredient[] = [];

  // 1) cucharadas y cucharaditas (1 cucharada = 10 g, 1 cucharadita = 5 g)
  t = t.replace(new RegExp(`(\\d+|una?)\\s+cucharad(a|as|ita|itas)(\\s+y\\s+media)?\\s+de\\s+(${WORD})`, 'g'), (_, n: string, kind: string, media: string | undefined, what: string) => {
    const count = (/^un/.test(n) ? 1 : Number(n)) + (media ? 0.5 : 0);
    out.push({ name: what, grams: count * (kind.startsWith('ita') ? 5 : 10) });
    return ' ';
  });

  // 2) «70 g de avena», «250 ml de leche semidesnatada», «1,5 kg de patata»
  t = t.replace(new RegExp(`(\\d+(?:[.,]\\d+)?)\\s*(g|gr|ml|kg)\\s+de\\s+(${NOUN})`, 'g'), (_, n: string, unit: string, what: string) => {
    out.push({ name: clean(what), grams: num(n) * UNIT_G(unit) });
    return ' ';
  });

  // 3) unidades: «1 plátano», «2 huevos», «4 tortitas de arroz», «1 lata de atún»
  t = t.replace(new RegExp(`(?<![\\d.,])(\\d+)\\s+(?!g\\b|gr\\b|ml\\b|kg\\b|%|cucharad)(${NOUN})`, 'g'), (_, n: string, what: string) => {
    out.push({ name: clean(what), units: Number(n) });
    return ' ';
  });

  return out.filter((i) => i.name.length >= 2 && ((i.grams ?? 0) > 0 || (i.units ?? 0) > 0));
}
