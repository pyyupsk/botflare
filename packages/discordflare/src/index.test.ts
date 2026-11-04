import { beforeAll, expect, expectTypeOf, it } from 'vitest';

import { bot, command, option } from './index';

const encoder = new TextEncoder();
const hex = (buffer: ArrayBuffer): string =>
  Array.from(new Uint8Array(buffer), (byte) => byte.toString(16).padStart(2, '0')).join('');

async function keyPair(): Promise<CryptoKeyPair> {
  const pair = await crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  if (!('privateKey' in pair)) throw new Error('expected an Ed25519 key pair');

  return pair;
}

let env: { DISCORD_PUBLIC_KEY: string };
let privateKey: CryptoKey;

beforeAll(async () => {
  const pair = await keyPair();
  privateKey = pair.privateKey;

  const raw = (await crypto.subtle.exportKey('raw', pair.publicKey)) as ArrayBuffer;
  env = { DISCORD_PUBLIC_KEY: hex(raw) };
});

async function signed(body: string, key = privateKey): Promise<Request> {
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = await crypto.subtle.sign(
    { name: 'Ed25519' },
    key,
    encoder.encode(timestamp + body),
  );

  return new Request('https://bot.test/', {
    method: 'POST',
    headers: { 'X-Signature-Ed25519': hex(signature), 'X-Signature-Timestamp': timestamp },
    body,
  });
}

const ping = JSON.stringify({ type: 1 });

const roll = command(
  {
    name: 'roll',
    description: 'Roll dice',
    options: {
      dice: option('integer', { description: 'How many dice', required: true }),
      label: option('string', { description: 'A name for the roll' }),
    },
  },
  (c) => {
    expectTypeOf(c.options.dice).toEqualTypeOf<number>();
    expectTypeOf(c.options.label).toEqualTypeOf<string | undefined>();

    return c.reply(`${c.options.label ?? 'roll'}: ${c.options.dice}`);
  },
);

const hello = command({ name: 'hello', description: 'Say hello' }, (c) => {
  // @ts-expect-error
  void c.options.anything;

  return c.reply('hello');
});

const app = bot({ commands: [roll, hello] });

function slash(name: string, options: { name: string; type: number; value: unknown }[]): string {
  return JSON.stringify({ type: 2, data: { type: 1, name, options } });
}

it('answers a signed ping with pong', async () => {
  const res = await app.fetch(await signed(ping), env);

  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ type: 1 });
});

it('rejects a body that does not match the signature', async () => {
  const req = await signed(ping);
  const tampered = new Request(req, { method: 'POST', body: JSON.stringify({ type: 2 }) });

  expect((await app.fetch(tampered, env)).status).toBe(401);
});

it('rejects a signature from another key', async () => {
  const other = await keyPair();

  expect((await app.fetch(await signed(ping, other.privateKey), env)).status).toBe(401);
});

it('rejects missing or malformed signature headers', async () => {
  const bare = new Request('https://bot.test/', { method: 'POST', body: ping });

  expect((await app.fetch(bare, env)).status).toBe(401);

  const statuses = await Promise.all(
    ['not-hex', 'aa'].map(async (bad) => {
      const req = await signed(ping);
      req.headers.set('X-Signature-Ed25519', bad);

      return (await app.fetch(req, env)).status;
    }),
  );

  expect(statuses).toEqual([401, 401]);
});

it('rejects methods other than POST', async () => {
  const res = await app.fetch(new Request('https://bot.test/'), env);

  expect(res.status).toBe(405);
});

it('explains a malformed public key instead of crashing', async () => {
  const res = await app.fetch(await signed(ping), { DISCORD_PUBLIC_KEY: '00' });

  expect(res.status).toBe(500);
  expect(await res.text()).toContain('DISCORD_PUBLIC_KEY');
});

it('runs the matching command with its option values', async () => {
  const body = slash('roll', [
    { name: 'dice', type: 4, value: 3 },
    { name: 'label', type: 3, value: 'attack' },
  ]);
  const res = await app.fetch(await signed(body), env);

  expect(await res.json()).toEqual({ type: 4, data: { content: 'attack: 3' } });
});

it('leaves an optional option undefined when the user skips it', async () => {
  const res = await app.fetch(
    await signed(slash('roll', [{ name: 'dice', type: 4, value: 2 }])),
    env,
  );

  expect(await res.json()).toEqual({ type: 4, data: { content: 'roll: 2' } });
});

it('answers 404 for a command the bot does not know', async () => {
  const res = await app.fetch(await signed(slash('nope', [])), env);

  expect(res.status).toBe(404);
});

it('runs a command that has no options', async () => {
  const res = await app.fetch(await signed(slash('hello', [])), env);

  expect(await res.json()).toEqual({ type: 4, data: { content: 'hello' } });
});
