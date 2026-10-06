import { describe, expect, it } from 'vitest';
import { formatDecimal, formatNumber } from '../formatting';

describe('formatDecimal', () => {
  it('keeps decimals with German separators regardless of the runtime locale', () => {
    expect(formatDecimal(387.1)).toBe('387,1');
    expect(formatDecimal(1234.5)).toBe('1.234,5');
  });

  it('formats whole numbers without a decimal part', () => {
    expect(formatDecimal(0)).toBe('0');
    expect(formatDecimal(20000)).toBe('20.000');
  });

  it('matches formatNumber for integers so both read the same on screen', () => {
    expect(formatDecimal(30000)).toBe(formatNumber(30000));
  });
});
