// Extracts the .dark { ... } token block from styles.css so it can be
// injected as a standalone <style> after Beasties runs (see
// inline-critical-css.ts) - Beasties strips the .dark block from critical
// CSS since the prerendered DOM it analyzes never has the `dark` class.
export function extractDarkBlock(css: string): string | null {
  const match = css.match(/\.dark\s*{([\s\S]*?)\n}/);
  return match?.[1]?.trim() ?? null;
}
