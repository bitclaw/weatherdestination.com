const linearToSrgb = (val: number): number => {
  if (val <= 0.0031308) return 12.92 * val;
  return 1.055 * val ** (1 / 2.4) - 0.055;
};

export const oklchToHex = (oklchString: string): string => {
  const match = oklchString.match(
    /oklch\s*\(\s*([0-9.]+)(%?)\s+([0-9.]+)\s+([0-9.]+)(?:deg)?\s*\)/i
  );
  if (!match) throw new Error(`Invalid OKLCH string: "${oklchString}"`);

  const [, rawL, pct, rawC, rawH] = match as [
    string,
    string,
    string,
    string,
    string
  ];
  let l = parseFloat(rawL);
  const isPercent = pct === '%';
  const c = parseFloat(rawC);
  const h = parseFloat(rawH);

  if (isPercent) l = l / 100;

  const hRad = (h * Math.PI) / 180;
  const a = c * Math.cos(hRad);
  const b = c * Math.sin(hRad);

  const l_ = l + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = l - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = l - 0.0894841775 * a - 1.291485548 * b;

  const l3 = l_ * l_ * l_;
  const m3 = m_ * m_ * m_;
  const s3 = s_ * s_ * s_;

  const toHex = (ch: number) =>
    Math.max(0, Math.min(255, Math.round(linearToSrgb(ch) * 255)))
      .toString(16)
      .padStart(2, '0');

  const r = +4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3;
  const g = -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3;
  const bCh = -0.0041960863 * l3 - 0.7034186147 * m3 + 1.707614701 * s3;

  return `#${toHex(r)}${toHex(g)}${toHex(bCh)}`;
};

export const extractCssVar = (css: string, varName: string): string | null => {
  const rootBlock = css.match(/:root\s*\{([^}]+)\}/)?.[1] ?? '';
  return (
    rootBlock.match(new RegExp(`${varName}:\\s*(oklch\\([^)]+\\))`))?.[1] ??
    null
  );
};
