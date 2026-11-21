import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WhatsAppWebhookError } from '../src/errors.js';
import { createMemoryDedupe } from '../src/resources/webhook-dedupe.js';

describe('createMemoryDedupe', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-01T00:00:00Z'));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('records a key on first sight and reports it afterwards', () => {
    const dedupe = createMemoryDedupe();
    expect(dedupe.seen('a')).toBe(false);
    expect(dedupe.seen('a')).toBe(true);
    expect(dedupe.seen('b')).toBe(false);
  });

  it('forgets keys after the ttl', () => {
    const dedupe = createMemoryDedupe({ ttlMs: 1000 });
    dedupe.seen('a');
    vi.advanceTimersByTime(999);
    expect(dedupe.seen('a')).toBe(true);
    vi.advanceTimersByTime(1001);
    expect(dedupe.seen('a')).toBe(false);
  });

  it('evicts the least recently seen key at maxEntries', () => {
    const dedupe = createMemoryDedupe({ maxEntries: 2 });
    dedupe.seen('a');
    dedupe.seen('b');
    expect(dedupe.seen('a')).toBe(true); // refreshes a, so b is now oldest
    dedupe.seen('c'); // evicts b
    expect(dedupe.seen('a')).toBe(true);
    expect(dedupe.seen('b')).toBe(false);
  });

  it('forget lets a key through again', () => {
    const dedupe = createMemoryDedupe();
    dedupe.seen('a');
    void dedupe.forget?.('a');
    expect(dedupe.seen('a')).toBe(false);
  });

  it('only one of several concurrent callers sees a key as new', async () => {
    const dedupe = createMemoryDedupe();
    const results = await Promise.all(Array.from({ length: 5 }, async () => dedupe.seen('same')));
    expect(results.filter((seen) => !seen)).toHaveLength(1);
  });

  it('rejects invalid options', () => {
    expect(() => createMemoryDedupe({ ttlMs: 0 })).toThrow(WhatsAppWebhookError);
    expect(() => createMemoryDedupe({ maxEntries: 1.5 })).toThrow(WhatsAppWebhookError);
  });
});
