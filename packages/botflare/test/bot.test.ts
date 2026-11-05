import { createExecutionContext } from 'cloudflare:test';
import { afterEach, expect, it, vi } from 'vitest';

import { bot } from '#index';
import { app, env, keyPair, ping, signed, slash } from '#test/fixtures';

let ctx = createExecutionContext();

afterEach(() => {
  ctx = createExecutionContext();
  vi.unstubAllGlobals();
});

it('answers a signed ping with pong', async () => {
  const res = await app.fetch(await signed(ping), env, ctx);

  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ type: 1 });
});

it('rejects a body that does not match the signature', async () => {
  const req = await signed(ping);
  const tampered = new Request(req, { method: 'POST', body: JSON.stringify({ type: 2 }) });

  expect((await app.fetch(tampered, env, ctx)).status).toBe(401);
});

it('rejects a signature from another key', async () => {
  const other = await keyPair();

  expect((await app.fetch(await signed(ping, other.privateKey), env, ctx)).status).toBe(401);
});

it('rejects missing or malformed signature headers', async () => {
  const bare = new Request('https://bot.test/', { method: 'POST', body: ping });

  expect((await app.fetch(bare, env, ctx)).status).toBe(401);

  const statuses = await Promise.all(
    ['not-hex', 'aa'].map(async (bad) => {
      const req = await signed(ping);
      req.headers.set('X-Signature-Ed25519', bad);

      return (await app.fetch(req, env, ctx)).status;
    }),
  );

  expect(statuses).toEqual([401, 401]);
});

it('rejects methods other than POST', async () => {
  const res = await app.fetch(new Request('https://bot.test/'), env, ctx);

  expect(res.status).toBe(405);
});

it('explains a malformed public key instead of crashing', async () => {
  const res = await app.fetch(await signed(ping), { DISCORD_PUBLIC_KEY: '00' }, ctx);

  expect(res.status).toBe(500);
  expect(await res.text()).toContain('DISCORD_PUBLIC_KEY');
});

it('answers an interaction handed over directly, as the gateway does', async () => {
  const res = await app.answer(
    JSON.parse(slash('roll', [{ name: 'dice', type: 4, value: 4 }])),
    ctx,
  );

  expect(await res.json()).toEqual({
    type: 4,
    data: { content: 'roll: 4', allowed_mentions: { parse: [] } },
  });
});

it('starts the gateway when someone opens the Worker URL', async () => {
  const ensure = vi.fn(async () => {});
  const withGateway = bot({ commands: [], gateway: 'GATEWAY' });

  const res = await withGateway.fetch(
    new Request('https://bot.test/'),
    { ...env, GATEWAY: { getByName: () => ({ ensure }) } },
    ctx,
  );

  expect(await res.text()).toBe('gateway started');
  expect(ensure).toHaveBeenCalledOnce();
});
