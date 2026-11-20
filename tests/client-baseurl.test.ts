import { describe, expect, it } from 'vitest';
import { WhatsAppClient } from '../src/index.js';

const make = (baseUrl: string, apiVersion = 'v22.0'): WhatsAppClient =>
  new WhatsAppClient({ accessToken: 'test-token', baseUrl, apiVersion });

describe('baseUrl trailing slash trimming', () => {
  it('trims a single trailing slash', () => {
    expect(make('https://graph.facebook.com/').getBaseUrl()).toBe('https://graph.facebook.com/v22.0');
  });

  it('trims several trailing slashes', () => {
    expect(make('https://graph.facebook.com//').getBaseUrl()).toBe('https://graph.facebook.com/v22.0');
  });

  it('leaves a base URL without trailing slashes unchanged', () => {
    expect(make('https://graph.facebook.com').getBaseUrl()).toBe('https://graph.facebook.com/v22.0');
  });

  it('keeps inner slashes', () => {
    expect(make('https://example.com/proxy//x/').getBaseUrl()).toBe('https://example.com/proxy//x/v22.0');
  });

  it('handles a long run of slashes followed by another character in linear time', () => {
    const baseUrl = `https://example.com${'/'.repeat(100000)}x`;
    const start = performance.now();
    const client = make(baseUrl);
    const result = client.getBaseUrl();
    const elapsed = performance.now() - start;
    expect(result).toBe(`${baseUrl}/v22.0`);
    expect(elapsed).toBeLessThan(500);
  });

  it('handles a very long run of trailing slashes', () => {
    const start = performance.now();
    const result = make(`https://example.com${'/'.repeat(100000)}`).getBaseUrl();
    expect(result).toBe('https://example.com/v22.0');
    expect(performance.now() - start).toBeLessThan(500);
  });
});
