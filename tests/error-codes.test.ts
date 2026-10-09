import { describe, expect, it } from 'vitest';
import { WhatsAppErrorCode } from '../src/index.js';
import {
  WhatsAppApiError,
  WhatsAppAuthenticationError,
  WhatsAppRateLimitError,
  WhatsAppReEngagementError,
  errorFromResponse,
} from '../src/errors.js';

describe('WhatsAppErrorCode constants', () => {
  it('exposes the expected numeric values', () => {
    expect(WhatsAppErrorCode.AUTH_EXCEPTION).toBe(0);
    expect(WhatsAppErrorCode.PERMISSION_DENIED).toBe(10);
    expect(WhatsAppErrorCode.API_METHOD).toBe(100);
    expect(WhatsAppErrorCode.ACCESS_TOKEN_EXPIRED).toBe(190);
    expect(WhatsAppErrorCode.INVALID_PHONE_NUMBER).toBe(1013);
    expect(WhatsAppErrorCode.RATE_LIMIT_HIT).toBe(130429);
    expect(WhatsAppErrorCode.MESSAGE_UNDELIVERABLE).toBe(131026);
    expect(WhatsAppErrorCode.BUSINESS_ACCOUNT_RESTRICTED).toBe(131031);
    expect(WhatsAppErrorCode.RE_ENGAGEMENT_MESSAGE).toBe(131047);
    expect(WhatsAppErrorCode.SPAM_RATE_LIMIT_HIT).toBe(131048);
    expect(WhatsAppErrorCode.MEDIA_DOWNLOAD_ERROR).toBe(131053);
    expect(WhatsAppErrorCode.TOO_MANY_MESSAGES).toBe(131056);
    expect(WhatsAppErrorCode.TEMPLATE_PARAM_MISMATCH).toBe(132000);
    expect(WhatsAppErrorCode.TEMPLATE_NOT_EXIST).toBe(132001);
    expect(WhatsAppErrorCode.ACCOUNT_LIMIT_REACHED).toBe(133016);
  });

  it('is frozen at runtime', () => {
    expect(Object.isFrozen(WhatsAppErrorCode)).toBe(true);
  });
});

const envelope = (code: number) => ({
  error: { message: 'boom', type: 'OAuthException', code },
});

describe('error mapping stability through WhatsAppErrorCode values', () => {
  it('maps ACCESS_TOKEN_EXPIRED to WhatsAppAuthenticationError', () => {
    const error = errorFromResponse(400, envelope(WhatsAppErrorCode.ACCESS_TOKEN_EXPIRED));
    expect(error).toBeInstanceOf(WhatsAppAuthenticationError);
  });

  it('maps the rate-limit code set to WhatsAppRateLimitError', () => {
    for (const code of [
      WhatsAppErrorCode.RATE_LIMIT_HIT,
      WhatsAppErrorCode.TOO_MANY_MESSAGES,
      WhatsAppErrorCode.ACCOUNT_LIMIT_REACHED,
    ]) {
      const error = errorFromResponse(400, envelope(code));
      expect(error).toBeInstanceOf(WhatsAppRateLimitError);
    }
  });

  it('maps RE_ENGAGEMENT_MESSAGE to WhatsAppReEngagementError', () => {
    const error = errorFromResponse(400, envelope(WhatsAppErrorCode.RE_ENGAGEMENT_MESSAGE));
    expect(error).toBeInstanceOf(WhatsAppReEngagementError);
  });

  it('leaves API_METHOD as a plain WhatsAppApiError', () => {
    const error = errorFromResponse(400, envelope(WhatsAppErrorCode.API_METHOD));
    expect(error).toBeInstanceOf(WhatsAppApiError);
    expect(error).not.toBeInstanceOf(WhatsAppRateLimitError);
    expect(error).not.toBeInstanceOf(WhatsAppReEngagementError);
    expect(error).not.toBeInstanceOf(WhatsAppAuthenticationError);
  });
});
