import { describe, expect, it } from 'vitest';
import { getTagColor, tagColorStyle } from '../../src/renderer/utils/tagColors';

describe('tagColors', () => {
  it('returns a hex color string for any tag', () => {
    const color = getTagColor('bug');
    expect(color).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it('returns the same color for the same tag (deterministic)', () => {
    expect(getTagColor('feature')).toBe(getTagColor('feature'));
    expect(getTagColor('urgent')).toBe(getTagColor('urgent'));
  });

  it('returns different colors for different tags', () => {
    const colors = new Set(['alpha', 'beta', 'gamma', 'delta', 'epsilon'].map(getTagColor));
    expect(colors.size).toBeGreaterThan(1);
  });

  it('handles empty string', () => {
    const color = getTagColor('');
    expect(color).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it('handles special characters and unicode', () => {
    expect(getTagColor('café')).toMatch(/^#[0-9a-f]{6}$/i);
    expect(getTagColor('🔥')).toMatch(/^#[0-9a-f]{6}$/i);
    expect(getTagColor('tag with spaces')).toMatch(/^#[0-9a-f]{6}$/i);
  });

  describe('tagColorStyle', () => {
    it('returns an object with color, background, and borderColor', () => {
      const style = tagColorStyle('bug');
      expect(style).toHaveProperty('color');
      expect(style).toHaveProperty('background');
      expect(style).toHaveProperty('borderColor');
    });

    it('uses the tag color as the color property', () => {
      const style = tagColorStyle('feature');
      expect(style.color).toBe(getTagColor('feature'));
    });

    it('background and borderColor reference the tag color via color-mix', () => {
      const style = tagColorStyle('test');
      const color = getTagColor('test');
      expect(style.background).toContain(color);
      expect(style.background).toContain('color-mix');
      expect(style.borderColor).toContain(color);
      expect(style.borderColor).toContain('color-mix');
    });

    it('is deterministic for the same tag', () => {
      expect(tagColorStyle('deploy')).toEqual(tagColorStyle('deploy'));
    });
  });
});
