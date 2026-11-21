/**
 * Small helpers for working with parsed webhook data. Runtime-neutral: no
 * `node:*` imports.
 */
import type { IncomingMessage, UnknownIncomingMessage } from '../types/webhooks.js';

const KNOWN_MESSAGE_TYPES = [
  'text',
  'image',
  'video',
  'audio',
  'document',
  'sticker',
  'location',
  'contacts',
  'interactive',
  'button',
  'reaction',
  'system',
  'order',
  'unsupported',
  'edit',
  'revoke',
] as const satisfies readonly IncomingMessage['type'][];

/** Compile-time check: fails when a union member's `type` is missing from the list above. */
type AssertAllTypesListed =
  Exclude<IncomingMessage['type'], (typeof KNOWN_MESSAGE_TYPES)[number]> extends never
    ? true
    : never;
const allTypesListed: AssertAllTypesListed = true;
void allTypesListed;

const knownMessageTypes: ReadonlySet<string> = new Set<string>(KNOWN_MESSAGE_TYPES);

/**
 * Narrows a message to the {@link IncomingMessage} union. Returns `false` for a
 * message whose `type` this SDK version does not model, so new Meta message
 * types can be handled separately instead of falling into a union branch.
 *
 * @param message - A message returned by `extractMessages` or a message event.
 */
export const isKnownMessage = (
  message: IncomingMessage | UnknownIncomingMessage,
): message is IncomingMessage =>
  typeof message.type === 'string' && knownMessageTypes.has(message.type);

/** Any object carrying user or phone identifiers, such as a message, status or contact. */
export interface UserKeySource {
  from_user_id?: string | undefined;
  user_id?: string | undefined;
  recipient_user_id?: string | undefined;
  from?: string | undefined;
  wa_id?: string | undefined;
  recipient_id?: string | undefined;
}

const firstNonEmpty = (...values: readonly (string | undefined)[]): string | undefined => {
  for (const value of values) {
    if (typeof value === 'string' && value.length > 0) {
      return value;
    }
  }
  return undefined;
};

/**
 * Returns a stable identifier for the user behind a message, status or contact.
 * The business-scoped user ID (`from_user_id`, `user_id`, `recipient_user_id`)
 * wins when present, then the phone-based ID (`from`, `wa_id`, `recipient_id`).
 * Returns `undefined` when none is set.
 */
export const getUserKey = (source: UserKeySource): string | undefined =>
  firstNonEmpty(source.from_user_id, source.user_id, source.recipient_user_id) ??
  firstNonEmpty(source.from, source.wa_id, source.recipient_id);

/** Options for {@link isStale}. */
export interface IsStaleOptions {
  /** Events older than this many seconds are stale. */
  maxAgeSeconds: number;
  /** The current time in epoch milliseconds. Defaults to `Date.now()`. */
  now?: number;
}

/**
 * Returns `true` when a webhook timestamp (Unix epoch seconds, as a string or
 * number) is older than `maxAgeSeconds`. A timestamp that is not a finite
 * number is never stale.
 */
export const isStale = (
  timestampSeconds: string | number,
  { maxAgeSeconds, now = Date.now() }: IsStaleOptions,
): boolean => {
  const seconds =
    typeof timestampSeconds === 'number' ? timestampSeconds : Number(timestampSeconds);
  if (typeof timestampSeconds === 'string' && timestampSeconds.trim() === '') {
    return false;
  }
  if (!Number.isFinite(seconds)) {
    return false;
  }
  return now - seconds * 1000 > maxAgeSeconds * 1000;
};
