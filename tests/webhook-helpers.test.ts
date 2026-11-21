import { describe, expect, it } from 'vitest';
import { getUserKey, isStale } from '../src/resources/webhook-helpers.js';

describe('getUserKey', () => {
  it('prefers the business-scoped user ID', () => {
    expect(getUserKey({ from: '1555', from_user_id: 'US.1' })).toBe('US.1');
    expect(getUserKey({ wa_id: '1555', user_id: 'US.2' })).toBe('US.2');
    expect(getUserKey({ recipient_id: '1555', recipient_user_id: 'US.3' })).toBe('US.3');
  });

  it('falls back to the phone-based ID', () => {
    expect(getUserKey({ from: '1555' })).toBe('1555');
    expect(getUserKey({ wa_id: '1556' })).toBe('1556');
    expect(getUserKey({ recipient_id: '1557' })).toBe('1557');
  });

  it('ignores empty values and returns undefined when nothing is set', () => {
    expect(getUserKey({ from_user_id: '', from: '1555' })).toBe('1555');
    expect(getUserKey({})).toBeUndefined();
  });
});

describe('isStale', () => {
  const now = 1_700_000_000_000;

  it('compares epoch seconds against now in milliseconds', () => {
    expect(isStale('1699999000', { maxAgeSeconds: 500, now })).toBe(true);
    expect(isStale(1_699_999_900, { maxAgeSeconds: 500, now })).toBe(false);
    expect(isStale('1700000000', { maxAgeSeconds: 0, now })).toBe(false);
  });

  it('never treats a non-numeric timestamp as stale', () => {
    expect(isStale('abc', { maxAgeSeconds: 1, now })).toBe(false);
    expect(isStale('', { maxAgeSeconds: 1, now })).toBe(false);
    expect(isStale(Number.NaN, { maxAgeSeconds: 1, now })).toBe(false);
  });

  it('defaults now to the current time', () => {
    const seconds = Math.floor(Date.now() / 1000);
    expect(isStale(seconds, { maxAgeSeconds: 60 })).toBe(false);
    expect(isStale(seconds - 120, { maxAgeSeconds: 60 })).toBe(true);
  });
});
