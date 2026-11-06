import { expect, it, vi } from 'vitest';

import { inflater } from '#utils/inflate';

const hello = { op: 10, d: { heartbeat_interval: 41_250 } };
const tricky = { op: 0, t: 'MESSAGE_CREATE', d: { content: 'a } { " \\" end' } };

// From node:zlib: one deflate context, Z_SYNC_FLUSH after each payload, as the gateway sends.
const HELLO = 'eJyqVsovULIyNNBRSlGyqlbKSE0sKklKTSyJz8wrSS0qS8xRsjIxNDI1qK0FAAAA//8=';
const TRICKY = 'qgarBCosUbJS8nUNDnZ0d413DnJ1DHFVgupOzgdqygPJJyrUKlQrxCgpxMQAidS8FKXaWgAAAAD//w==';

const bytes = (base64: string): Uint8Array<ArrayBuffer> =>
  Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));

it('gives one payload per flush, across a shared zlib context', async () => {
  const got: unknown[] = [];
  const stream = inflater((json) => got.push(JSON.parse(json)), vi.fn());

  const second = bytes(TRICKY);
  stream.push(bytes(HELLO).buffer);
  stream.push(second.slice(0, 5).buffer);
  stream.push(second.slice(5).buffer);

  await vi.waitFor(() => expect(got).toEqual([hello, tricky]));
});

it('splits payloads that arrive in one message', async () => {
  const first = bytes(HELLO);
  const second = bytes(TRICKY);
  const both = new Uint8Array(first.length + second.length);
  both.set(first);
  both.set(second, first.length);

  const got: unknown[] = [];
  inflater((json) => got.push(JSON.parse(json)), vi.fn()).push(both.buffer);

  await vi.waitFor(() => expect(got).toEqual([hello, tricky]));
});

it('reports a broken stream, but not one it closed', async () => {
  const onError = vi.fn();
  inflater(vi.fn(), onError).push(new Uint8Array([1, 2, 3, 4]).buffer);
  await vi.waitFor(() => expect(onError).toHaveBeenCalledOnce());

  const quiet = vi.fn();
  const closed = inflater(vi.fn(), quiet);
  closed.close();
  await new Promise((resolve) => setTimeout(resolve, 20));
  expect(quiet).not.toHaveBeenCalled();
});
