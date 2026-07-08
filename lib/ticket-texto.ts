// Helpers para armar tickets como texto plano monoespaciado.
//
// Por qué: muchas impresoras térmicas baratas usan en Windows el driver
// "Generic / Text Only", que ignora casi todo el CSS (flexbox, bordes,
// text-align) y solo imprime caracteres de texto tal cual, respetando los
// espacios manuales. Por eso los montos alineados con flex y las líneas
// separadoras con border no salían en la impresora real — hay que armar
// cada línea como un string ya alineado con espacios, no con layout CSS.
//
// MAX = caracteres por línea. Si las líneas se siguen cortando, bajalo un
// poco más (ej. 20); si sobra mucho margen a la derecha, subilo.
export const MAX = 24;

export const truncate = (t: string, max = MAX) =>
  !t ? "" : t.length > max ? t.substring(0, max) : t;

export const addLine = (t = "") => truncate(t);

export const addCenter = (t: string) => {
  const s = truncate(t);
  const pad = Math.max(0, Math.floor((MAX - s.length) / 2));
  return " ".repeat(pad) + s;
};

export const addExtremes = (left: string, right: string) => {
  const r = truncate(right, MAX - 1);
  const l = truncate(left, MAX - r.length - 1);
  const spaces = Math.max(1, MAX - l.length - r.length);
  return l + " ".repeat(spaces) + r;
};

export const addSeparator = () => "-".repeat(MAX);

// Alinea un valor (ej. un monto) contra el borde derecho, en su propia línea.
export const addRight = (t: string) => {
  const s = truncate(t);
  return " ".repeat(Math.max(0, MAX - s.length)) + s;
};

// Corta un texto largo en varias líneas por palabra completa (nunca a la
// mitad de una palabra), para descripciones que no entran en una sola línea
// junto con el monto — ej. "Corte (Peluquero Alejandro)".
export function wrapWords(text: string, max = MAX): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    if (current.length === 0) {
      current = word.length > max ? word.substring(0, max) : word;
    } else if (current.length + 1 + word.length <= max) {
      current += " " + word;
    } else {
      lines.push(current);
      current = word.length > max ? word.substring(0, max) : word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

// Formateamos el monto a mano (en vez de Intl.NumberFormat con style:
// "currency") porque ese formateador inserta un espacio "no separable"
// (U+00A0) entre el "$" y el número, no un espacio normal. Ese carácter no
// es ASCII y una impresora en modo texto puede no reconocerlo y cortar la
// línea justo ahí — es probablemente la causa de que solo se viera el "$".
export function formatoMonto(n: number): string {
  const signo = n < 0 ? "-" : "";
  const entero = Math.round(Math.abs(n));
  const conMiles = entero.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${signo}$${conMiles}`;
}
