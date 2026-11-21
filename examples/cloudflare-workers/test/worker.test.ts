import { createExecutionContext, env, waitOnExecutionContext } from 'cloudflare:test';
import { createTestRequest, buildWebhookPayload } from '@solvejet/whatsapp-cloud-api/testing';
import { describe, expect, it } from 'vitest';
import worker from '../src/index';

const call = async (request: Request): Promise<Response> => {
  const ctx = createExecutionContext();
  const response = await worker.fetch(request, env as never, ctx);
  await waitOnExecutionContext(ctx);
  return response;
};

describe('webhook worker (workerd)', () => {
  it('answers the verification handshake', async () => {
    const url =
      'https://example.test/?hub.mode=subscribe&hub.verify_token=worker-token&hub.challenge=42';
    const response = await call(new Request(url));
    expect(response.status).toBe(200);
    expect(await response.text()).toBe('42');
  });

  it('runs in workerd', () => {
    expect(navigator.userAgent).toBe('Cloudflare-Workers');
  });

  it('rejects a wrong verify token', async () => {
    const url = 'https://example.test/?hub.mode=subscribe&hub.verify_token=nope&hub.challenge=42';
    expect((await call(new Request(url))).status).toBe(403);
  });

  it('accepts a signed delivery', async () => {
    const request = await createTestRequest({
      payload: buildWebhookPayload('text'),
      secret: 'worker-secret',
    });
    expect((await call(request)).status).toBe(200);
  });

  it('rejects a bad signature', async () => {
    const request = await createTestRequest({
      payload: buildWebhookPayload('text'),
      secret: 'attacker',
    });
    expect((await call(request)).status).toBe(401);
  });
});
