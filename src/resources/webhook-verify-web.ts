/**
 * `X-Hub-Signature-256` verification built on Web Crypto, for runtimes without
 * `node:crypto` (Cloudflare Workers, Deno, Bun, browsers' workers). Uses only
 * `globalThis.crypto`, `TextEncoder` and standard globals.
 */
import { isNonEmptyString, toHashable } from './webhook-core.js';

const SIGNATURE_PATTERN = /^sha256=([0-9a-f]{64})$/;
const MAX_CACHED_KEYS = 16;

const keyCache = new Map<string, Promise<CryptoKey>>();

const importKey = (secret: string): Promise<CryptoKey> => {
  const cached = keyCache.get(secret);
  if (cached !== undefined) {
    return cached;
  }
  const pending = globalThis.crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify'],
  );
  keyCache.set(secret, pending);
  pending.catch(() => {
    keyCache.delete(secret);
  });
  while (keyCache.size > MAX_CACHED_KEYS) {
    const oldest = keyCache.keys().next();
    if (oldest.done === true) {
      break;
    }
    keyCache.delete(oldest.value);
  }
  return pending;
};

const hexToBytes = (hex: string): Uint8Array<ArrayBuffer> => {
  const bytes = new Uint8Array(hex.length / 2);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
};

/**
 * Verifies the `X-Hub-Signature-256` header against the HMAC-SHA256 of the raw
 * request body using Web Crypto. The comparison is constant time
 * (`crypto.subtle.verify`). It never throws on malformed input.
 *
 * The header must be `sha256=` followed by exactly 64 lowercase hex digits.
 * Every secret is checked and the results are combined, so the time taken does
 * not reveal which secret matched. Empty or non-string secrets are ignored.
 *
 * SECURITY: `rawBody` MUST be the raw request bytes exactly as received.
 *
 * @param rawBody - The raw body as a string, `Uint8Array` or `ArrayBuffer`.
 * @param signatureHeader - The `X-Hub-Signature-256` header value, if present.
 * @param secrets - One App Secret, or several to accept during rotation.
 * @returns `true` only when the header is well formed and matches a secret.
 */
export const verifySignatureAsync = async (
  rawBody: string | Uint8Array | ArrayBuffer,
  signatureHeader: string | undefined,
  secrets: string | readonly string[],
): Promise<boolean> => {
  const hashable = toHashable(rawBody);
  if (hashable === undefined || typeof signatureHeader !== 'string') {
    return false;
  }
  const match = SIGNATURE_PATTERN.exec(signatureHeader);
  if (match === null || match[1] === undefined) {
    return false;
  }
  const list: readonly unknown[] = Array.isArray(secrets)
    ? (secrets as readonly unknown[])
    : [secrets];
  const usable = list.filter(isNonEmptyString);
  if (usable.length === 0) {
    return false;
  }
  const bodyBytes: Uint8Array<ArrayBuffer> =
    typeof hashable === 'string' ? new TextEncoder().encode(hashable) : new Uint8Array(hashable);
  const signature = hexToBytes(match[1]);
  const results = await Promise.all(
    usable.map(async (secret) => {
      try {
        const key = await importKey(secret);
        return await globalThis.crypto.subtle.verify('HMAC', key, signature, bodyBytes);
      } catch {
        return false;
      }
    }),
  );
  return results.some(Boolean);
};
