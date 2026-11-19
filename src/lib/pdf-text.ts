// Lector mínimo de texto de PDF, sin dependencias nativas: pensado para PDF con texto real (p. ej. los que exporta un
// navegador o un procesador de textos), no para escaneos. Devuelve, por página, las líneas de texto y en cada línea
// sus «celdas» (trozos separados por huecos), de izquierda a derecha. Funciones puras.
import { unzlibSync } from 'fflate';

export interface PdfCell {
  x: number;
  text: string;
}
export type PdfLine = PdfCell[];

const latin1 = (b: Uint8Array) => {
  let s = '';
  for (let i = 0; i < b.length; i += 8192) s += String.fromCharCode(...b.subarray(i, i + 8192));
  return s;
};
const bytesOf = (s: string) => Uint8Array.from(s, (c) => c.charCodeAt(0) & 255);

interface Obj {
  dict: string;
  stream: string | null; // contenido ya descomprimido, en latin1
}

function readObjects(src: string): Map<number, Obj> {
  const out = new Map<number, Obj>();
  const re = /(\d+)\s+\d+\s+obj\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    const start = m.index + m[0].length;
    const end = src.indexOf('endobj', start);
    if (end < 0) break;
    const body = src.slice(start, end);
    const s = /stream\r?\n/.exec(body);
    let dict = body;
    let stream: string | null = null;
    if (s) {
      dict = body.slice(0, s.index);
      const raw = body.slice(s.index + s[0].length);
      const cut = raw.lastIndexOf('endstream');
      const data = cut >= 0 ? raw.slice(0, cut).replace(/\r?\n$/, '') : raw;
      if (/\/FlateDecode/.test(dict)) {
        try {
          stream = latin1(unzlibSync(bytesOf(data)));
        } catch {
          stream = null;
        }
      } else if (!/\/Filter/.test(dict)) stream = data;
    }
    out.set(Number(m[1]), { dict, stream });
    re.lastIndex = end + 6;
  }
  return out;
}

const refOf = (s: string | undefined) => {
  const m = s ? /(\d+)\s+\d+\s+R/.exec(s) : null;
  return m ? Number(m[1]) : null;
};

/** Mapa «código de glifo → texto» de un ToUnicode (bfchar y bfrange). */
function parseCMap(cmap: string): Map<number, string> {
  const map = new Map<number, string>();
  const uni = (hex: string) => {
    let s = '';
    for (let i = 0; i + 3 < hex.length + 1; i += 4) s += String.fromCharCode(parseInt(hex.slice(i, i + 4), 16));
    return s;
  };
  for (const block of cmap.matchAll(/beginbfchar([\s\S]*?)endbfchar/g)) {
    for (const m of block[1].matchAll(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g)) map.set(parseInt(m[1], 16), uni(m[2]));
  }
  for (const block of cmap.matchAll(/beginbfrange([\s\S]*?)endbfrange/g)) {
    for (const m of block[1].matchAll(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*(?:<([0-9A-Fa-f]+)>|\[([^\]]*)\])/g)) {
      const lo = parseInt(m[1], 16);
      const hi = parseInt(m[2], 16);
      if (hi - lo > 65535) continue;
      if (m[3] !== undefined) {
        const base = uni(m[3]);
        for (let c = lo; c <= hi; c++) map.set(c, base.slice(0, -1) + String.fromCharCode(base.charCodeAt(base.length - 1) + (c - lo)));
      } else {
        const items = [...(m[4] ?? '').matchAll(/<([0-9A-Fa-f]+)>/g)];
        for (let c = lo; c <= hi && c - lo < items.length; c++) map.set(c, uni(items[c - lo][1]));
      }
    }
  }
  return map;
}

type Mat = [number, number, number, number, number, number];
const mul = (a: Mat, b: Mat): Mat => [
  a[0] * b[0] + a[1] * b[2],
  a[0] * b[1] + a[1] * b[3],
  a[2] * b[0] + a[3] * b[2],
  a[2] * b[1] + a[3] * b[3],
  a[4] * b[0] + a[5] * b[2] + b[4],
  a[4] * b[1] + a[5] * b[3] + b[5],
];

interface Run {
  x: number;
  y: number;
  text: string;
}

/** Recorre un flujo de contenido y devuelve los trozos de texto con su posición en la página. */
function textRuns(content: string, fonts: Map<string, Map<number, string>>): Run[] {
  const tokens = content.match(/<[0-9A-Fa-f\s]*>|\[|\]|\((?:\\.|[^\\)])*\)|\/[^\s/<>\[\]()]+|[^\s/<>\[\]()]+/g) ?? [];
  const runs: Run[] = [];
  let ctm: Mat = [1, 0, 0, 1, 0, 0];
  const stack: Mat[] = [];
  let tm: Mat = [1, 0, 0, 1, 0, 0];
  let tlm: Mat = tm;
  let font: Map<number, string> | null = null;
  let run: Run | null = null;
  const args: string[] = [];
  const pos = (): [number, number] => {
    const m = mul(tm, ctm);
    return [m[4], m[5]];
  };
  const decode = (hex: string) => {
    let s = '';
    const h = hex.replace(/[<>\s]/g, '');
    for (let i = 0; i + 3 < h.length + 1; i += 4) s += font?.get(parseInt(h.slice(i, i + 4), 16)) ?? '';
    return s;
  };
  const show = (text: string) => {
    if (!text) return;
    if (!run) {
      const [x, y] = pos();
      run = { x, y, text: '' };
      runs.push(run);
    }
    run.text += text;
  };
  const num = (i: number) => Number(args[i]) || 0;
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t === '[') {
      // matriz de TJ: cadenas hexadecimales y ajustes numéricos
      let j = i + 1;
      while (j < tokens.length && tokens[j] !== ']') {
        if (tokens[j].startsWith('<')) show(decode(tokens[j]));
        else if (!tokens[j].startsWith('(') && Number(tokens[j]) < -200) show(' ');
        j++;
      }
      i = j;
      continue;
    }
    if (/^[A-Za-z'"*]+$/.test(t) && !t.startsWith('/')) {
      switch (t) {
        case 'q':
          stack.push(ctm);
          break;
        case 'Q':
          ctm = stack.pop() ?? ctm;
          break;
        case 'cm':
          ctm = mul([num(0), num(1), num(2), num(3), num(4), num(5)], ctm);
          break;
        case 'BT':
          tm = tlm = [1, 0, 0, 1, 0, 0];
          run = null;
          break;
        case 'ET':
          run = null;
          break;
        case 'Tf':
          font = fonts.get(args[0]?.slice(1) ?? '') ?? null;
          break;
        case 'Tm':
          tm = tlm = [num(0), num(1), num(2), num(3), num(4), num(5)];
          run = null;
          break;
        case 'Td':
        case 'TD': {
          // un desplazamiento vertical (o uno brusco) empieza otro trozo; los horizontales pequeños son avances de glifo
          const dy = num(1);
          tm = tlm = mul([1, 0, 0, 1, num(0), dy], tlm);
          if (Math.abs(dy) > 0.001) run = null;
          break;
        }
        case 'T*':
          run = null;
          break;
        case 'Tj':
          if (args[0]?.startsWith('<')) show(decode(args[0]));
          break;
      }
      args.length = 0;
      continue;
    }
    args.push(t);
    if (args.length > 8) args.shift();
  }
  return runs;
}

/** Une los trozos de una misma fila en celdas: los que quedan a menos de `gap` de distancia forman una sola celda. */
function toLines(runs: Run[]): PdfLine[] {
  const rows: { y: number; runs: Run[] }[] = [];
  for (const r of [...runs].sort((a, b) => b.y - a.y)) {
    const row = rows.find((w) => Math.abs(w.y - r.y) < 3);
    if (row) row.runs.push(r);
    else rows.push({ y: r.y, runs: [r] });
  }
  return rows
    .sort((a, b) => b.y - a.y)
    .map((w) =>
      w.runs
        .sort((a, b) => a.x - b.x)
        .map((r) => ({ x: Math.round(r.x), text: r.text.replace(/\s+/g, ' ').trim() }))
        .filter((c) => c.text !== ''),
    )
    .filter((l) => l.length > 0);
}

/** Texto de un PDF, página a página, como líneas de celdas. Lanza si no es un PDF o no tiene texto legible. */
export function readPdfLines(bytes: Uint8Array): PdfLine[][] {
  const src = latin1(bytes);
  if (!src.startsWith('%PDF')) throw new Error('No es un PDF.');
  if (/\/Encrypt\b/.test(src.slice(-2000))) throw new Error('El PDF está protegido con contraseña.');
  const objs = readObjects(src);

  const fontCache = new Map<number, Map<number, string>>();
  const fontMap = (id: number) => {
    let f = fontCache.get(id);
    if (!f) {
      const tu = refOf(/\/ToUnicode\s+([^/>]*)/.exec(objs.get(id)?.dict ?? '')?.[1]);
      const cm = tu !== null ? objs.get(tu)?.stream : null;
      f = cm ? parseCMap(cm) : new Map();
      fontCache.set(id, f);
    }
    return f;
  };

  // páginas en su orden: las hojas del árbol /Pages
  const pageIds: number[] = [];
  const walk = (id: number, depth = 0) => {
    const d = objs.get(id)?.dict ?? '';
    if (depth > 20) return;
    if (/\/Type\s*\/Pages\b/.test(d)) {
      const kids = /\/Kids\s*\[([^\]]*)\]/.exec(d)?.[1] ?? '';
      for (const k of kids.matchAll(/(\d+)\s+\d+\s+R/g)) walk(Number(k[1]), depth + 1);
    } else if (/\/Type\s*\/Page\b/.test(d)) pageIds.push(id);
  };
  const root = [...objs.entries()].find(([, o]) => /\/Type\s*\/Catalog\b/.test(o.dict));
  const pagesRef = refOf(root ? /\/Pages\s+([^/>]*)/.exec(root[1].dict)?.[1] : undefined);
  if (pagesRef !== null) walk(pagesRef);
  if (!pageIds.length) for (const [id, o] of objs) if (/\/Type\s*\/Page\b(?!s)/.test(o.dict)) pageIds.push(id);

  const pages: PdfLine[][] = [];
  for (const id of pageIds) {
    const d = objs.get(id)!.dict;
    const fonts = new Map<string, Map<number, string>>();
    // recursos: pueden estar en el propio diccionario de la página
    const fontDict = /\/Font\s*<<([\s\S]*?)>>/.exec(d)?.[1] ?? '';
    for (const f of fontDict.matchAll(/\/([^\s/<>]+)\s+(\d+)\s+\d+\s+R/g)) fonts.set(f[1], fontMap(Number(f[2])));
    const contentsRaw = /\/Contents\s*(\[[^\]]*\]|\d+\s+\d+\s+R)/.exec(d)?.[1] ?? '';
    const content = [...contentsRaw.matchAll(/(\d+)\s+\d+\s+R/g)].map((m) => objs.get(Number(m[1]))?.stream ?? '').join('\n');
    pages.push(toLines(textRuns(content, fonts)));
  }
  if (!pages.some((p) => p.length)) throw new Error('No se ha encontrado texto en el PDF (puede ser un escaneo o una imagen).');
  return pages;
}
