import { describe, expect, it } from 'bun:test';
import { extractDarkBlock } from '../../scripts/extract-dark-block';

describe('extractDarkBlock', () => {
  it('finds a non-empty .dark block in the real styles.css', async () => {
    const stylesSource = await Bun.file(
      new URL('../styles.css', import.meta.url)
    ).text();
    const darkVars = extractDarkBlock(stylesSource);
    expect(darkVars).not.toBeNull();
    expect(darkVars?.length).toBeGreaterThan(0);
    expect(darkVars).toContain('--background:');
  });

  it('returns null when no .dark block is present', () => {
    expect(extractDarkBlock(':root { --background: white; }')).toBeNull();
  });
});
