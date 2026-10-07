import { describe, expect, it } from 'vitest';
import { DEFAULT_API_VERSION, WhatsAppClient } from '../src/index.js';

describe('WhatsAppClient', () => {
  it('defaults to the current API version', () => {
    const client = new WhatsAppClient({ accessToken: 'test-token' });
    expect(client.getApiVersion()).toBe('v23.0');
    expect(DEFAULT_API_VERSION).toBe('v23.0');
  });

  it('honors an explicit API version', () => {
    const client = new WhatsAppClient({ accessToken: 'test-token', apiVersion: 'v22.0' });
    expect(client.getApiVersion()).toBe('v22.0');
  });

  it('stores and exposes config fields', () => {
    const client = new WhatsAppClient({
      accessToken: 'test-token',
      phoneNumberId: '1234567890',
      businessAccountId: '0987654321',
    });
    expect(client.getPhoneNumberId()).toBe('1234567890');
    expect(client.getBusinessAccountId()).toBe('0987654321');
  });

  it('resolves a versioned base URL', () => {
    const client = new WhatsAppClient({ accessToken: 'test-token' });
    expect(client.getBaseUrl()).toBe('https://graph.facebook.com/v23.0');
    expect(client.getBaseUrl()).toContain(client.getApiVersion());
  });

  it('trims trailing slashes from a custom base URL', () => {
    const client = new WhatsAppClient({
      accessToken: 'test-token',
      baseUrl: 'https://example.test/',
      apiVersion: 'v23.0',
    });
    expect(client.getBaseUrl()).toBe('https://example.test/v23.0');
  });

  it('rejects an empty access token', () => {
    expect(() => new WhatsAppClient({ accessToken: '' })).toThrow(/accessToken/);
  });
});
