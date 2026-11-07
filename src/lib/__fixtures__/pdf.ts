// Genera PDF mínimos con texto real (fuente Type0 con ToUnicode, como los que exporta un navegador) para los tests.
import { zlibSync } from 'fflate';

export interface PdfItem {
  x: number;
  y: number; // coordenada de página: crece hacia arriba
  text: string;
}

const hex4 = (n: number) => n.toString(16).padStart(4, '0');
const enc = (s: string) => Uint8Array.from(s, (c) => c.charCodeAt(0) & 255);

/** Un PDF por páginas de elementos de texto. Cada carácter es un glifo cuyo código es su posición en la tabla de la fuente. */
export function makePdf(pages: PdfItem[][], opts: { compress?: boolean } = {}): Uint8Array {
  const chars = [...new Set(pages.flat().flatMap((i) => [...i.text]))];
  const code = (c: string) => chars.indexOf(c) + 1;
  const cmap = `/CIDInit /ProcSet findresource begin\n12 dict begin\nbegincmap\n1 begincodespacerange\n<0000> <FFFF>\nendcodespacerange\n${chars.length} beginbfchar\n${chars
    .map((c, i) => `<${hex4(i + 1)}> <${hex4(c.charCodeAt(0))}>`)
    .join('\n')}\nendbfchar\nendcmap\nend\nend`;
  const objs: string[] = [];
  const pageIds = pages.map((_, i) => 10 + i * 2);
  objs[1] = '<</Type /Catalog /Pages 2 0 R>>';
  objs[2] = `<</Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pages.length}>>`;
  objs[3] = '<</Type /Font /Subtype /Type0 /BaseFont /Test /Encoding /Identity-H /ToUnicode 4 0 R>>';
  const streams = new Map<number, string>();
  streams.set(4, cmap);
  pages.forEach((items, i) => {
    const pid = pageIds[i];
    const content = items
      .map((it) => `BT\n/F1 12 Tf\n1 0 0 1 ${it.x} ${it.y} Tm\n<${[...it.text].map((c) => hex4(code(c))).join('')}> Tj\nET`)
      .join('\n');
    objs[pid] = `<</Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources <</Font <</F1 3 0 R>>>> /Contents ${pid + 1} 0 R>>`;
    streams.set(pid + 1, content);
  });
  let out = '%PDF-1.7\n';
  const parts: (string | Uint8Array)[] = [];
  const push = (x: string | Uint8Array) => parts.push(x);
  push(out);
  objs.forEach((body, id) => {
    if (body !== undefined) push(`${id} 0 obj\n${body}\nendobj\n`);
  });
  for (const [id, data] of streams) {
    const raw = enc(data);
    const body = opts.compress ? zlibSync(raw) : raw;
    const dict = opts.compress ? `<</Length ${body.length} /Filter /FlateDecode>>` : `<</Length ${body.length}>>`;
    push(`${id} 0 obj\n${dict}\nstream\n`);
    push(body);
    push('\nendstream\nendobj\n');
  }
  push('trailer\n<</Root 1 0 R>>\n%%EOF');
  const total = parts.reduce((n, p) => n + (typeof p === 'string' ? p.length : p.length), 0);
  const bytes = new Uint8Array(total);
  let o = 0;
  for (const p of parts) {
    const b = typeof p === 'string' ? enc(p) : p;
    bytes.set(b, o);
    o += b.length;
  }
  return bytes;
}
