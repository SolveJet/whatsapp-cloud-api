/**
 * Duplicate-delivery tracking for webhook handlers. Runtime-neutral: no
 * Node-only imports.
 */
import { WhatsAppWebhookError } from '../errors.js';

/** Storage used to skip events Meta delivers more than once. */
export interface WebhookDedupe {
  /**
   * Returns `true` when `key` was seen before. Otherwise records it and returns
   * `false`, as one atomic step so two concurrent calls cannot both see a key
   * as new.
   */
  seen(key: string): boolean | Promise<boolean>;
  /** Removes a key so a retried delivery of the same event is processed again. */
  forget?(key: string): void | Promise<void>;
}

/** Options for {@link createMemoryDedupe}. */
export interface MemoryDedupeOptions {
  /** How long a key is remembered, in milliseconds. Defaults to one hour. */
  ttlMs?: number;
  /** Maximum number of keys kept; the oldest is evicted first. Defaults to 10,000. */
  maxEntries?: number;
}

const requirePositiveInteger = (value: number, name: string): number => {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new WhatsAppWebhookError(`${name} must be a positive integer.`);
  }
  return value;
};

/**
 * Creates an in-memory {@link WebhookDedupe} with a time limit and a size cap.
 *
 * The store lives in one process. Serverless instances and multi-process
 * servers do not share it, so duplicates that reach a different instance are
 * not caught; implement {@link WebhookDedupe} on a shared store for that.
 */
export const createMemoryDedupe = (options: MemoryDedupeOptions = {}): WebhookDedupe => {
  const ttlMs = requirePositiveInteger(options.ttlMs ?? 3_600_000, 'ttlMs');
  const maxEntries = requirePositiveInteger(options.maxEntries ?? 10_000, 'maxEntries');
  // Map iteration follows insertion order, so the first key is the oldest.
  const entries = new Map<string, number>();

  return {
    seen(key: string): boolean {
      const now = Date.now();
      const expiresAt = entries.get(key);
      if (expiresAt !== undefined) {
        entries.delete(key);
        if (expiresAt > now) {
          entries.set(key, expiresAt);
          return true;
        }
      }
      entries.set(key, now + ttlMs);
      while (entries.size > maxEntries) {
        const oldest = entries.keys().next();
        if (oldest.done === true) {
          break;
        }
        entries.delete(oldest.value);
      }
      return false;
    },
    forget(key: string): void {
      entries.delete(key);
    },
  };
};
