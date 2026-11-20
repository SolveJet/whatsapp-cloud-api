import { WhatsAppClient } from '@solvejet/whatsapp-cloud-api';
import type { IncomingMessage } from '@solvejet/whatsapp-cloud-api';

/** Reads a required environment variable. */
export function requireEnv(name: string): string {
  const value = process.env[name];
  if (value === undefined || value === '') {
    throw new Error(`Missing environment variable ${name}`);
  }
  return value;
}

export const client = new WhatsAppClient({
  accessToken: requireEnv('WHATSAPP_ACCESS_TOKEN'),
  phoneNumberId: requireEnv('WHATSAPP_PHONE_NUMBER_ID'),
});

/**
 * Echoes a text message back to its sender. Uses the phone number in `from`
 * when Meta sends one, otherwise the business-scoped user ID in `from_user_id`
 * (users who enabled WhatsApp usernames may not share a phone number).
 */
export async function echoText(message: IncomingMessage): Promise<void> {
  if (message.type !== 'text') return;
  const to = message.from
    ? message.from
    : message.from_user_id
      ? { bsuid: message.from_user_id }
      : undefined;
  if (to === undefined) return;
  await client.messages.sendText(to, `You said: ${message.text.body}`);
}

/**
 * Handles every message in a delivery independently: one failure is logged and
 * does not stop the rest. Never rejects, so callers may `await` it (serverless)
 * or call it without awaiting (long-running servers).
 */
export async function processMessages(messages: IncomingMessage[]): Promise<void> {
  const results = await Promise.allSettled(messages.map((message) => echoText(message)));
  for (const result of results) {
    if (result.status === 'rejected') console.error('Failed to handle message:', result.reason);
  }
}
