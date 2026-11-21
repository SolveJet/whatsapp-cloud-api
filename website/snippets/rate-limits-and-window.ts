import {
  WhatsAppClient,
  WhatsAppErrorCode,
  WhatsAppRateLimitError,
  WhatsAppReEngagementError,
} from '@solvejet/whatsapp-cloud-api';

// #region client
// Defaults: timeoutMs 30000 per attempt, maxRetries 2 (so up to 3 attempts).
const client = new WhatsAppClient({
  accessToken: process.env.WHATSAPP_ACCESS_TOKEN!,
  phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID!,
  maxRetries: 3,
});
// #endregion

// #region handle
try {
  await client.messages.sendText('15551234567', 'Your order has shipped.');
} catch (error) {
  if (error instanceof WhatsAppReEngagementError) {
    // Code 131047: more than 24 hours since the user last replied.
    // Send an approved template instead.
    await client.messages.sendTemplate('15551234567', {
      name: 'order_update',
      language: { code: 'en_US' },
    });
  } else if (error instanceof WhatsAppRateLimitError) {
    // Retries are already exhausted when this reaches you.
    console.warn(error.code, error.retryAfterMs);
  } else {
    throw error;
  }
}
// #endregion

// #region codes
// Compare against a named constant instead of a number.
const reEngagement: number = WhatsAppErrorCode.RE_ENGAGEMENT_MESSAGE; // 131047
const throughput: number = WhatsAppErrorCode.RATE_LIMIT_HIT; // 130429
// #endregion

console.log(reEngagement, throughput);
