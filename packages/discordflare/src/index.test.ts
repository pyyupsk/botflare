import { beforeAll, expect, it } from 'vitest';

import { bot } from './index';

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

it('answers a signed ping with pong', async () => {
  const res = await bot().fetch(await signed(ping), env);
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ type: 1 });
});

it('rejects a body that does not match the signature', async () => {
  const req = await signed(ping);
  const tampered = new Request(req, { method: 'POST', body: JSON.stringify({ type: 2 }) });
  expect((await bot().fetch(tampered, env)).status).toBe(401);
});

it('rejects a signature from another key', async () => {
  const other = await keyPair();
  expect((await bot().fetch(await signed(ping, other.privateKey), env)).status).toBe(401);
});

it('rejects missing or malformed signature headers', async () => {
  const bare = new Request('https://bot.test/', { method: 'POST', body: ping });
  expect((await bot().fetch(bare, env)).status).toBe(401);
  for (const bad of ['not-hex', 'aa']) {
    const req = await signed(ping);
    req.headers.set('X-Signature-Ed25519', bad);
    expect((await bot().fetch(req, env)).status).toBe(401);
  }
});

it('rejects methods other than POST', async () => {
  const res = await bot().fetch(new Request('https://bot.test/'), env);
  expect(res.status).toBe(405);
});

it('explains a malformed public key instead of crashing', async () => {
  const res = await bot().fetch(await signed(ping), { DISCORD_PUBLIC_KEY: '00' });
  expect(res.status).toBe(500);
  expect(await res.text()).toContain('DISCORD_PUBLIC_KEY');
});
