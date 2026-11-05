import { afterEach, expect, it, vi } from 'vitest';

import { callDiscord } from '#lib/rest';

afterEach(() => {
  vi.unstubAllGlobals();
});

it('fills the path and adds the query', async () => {
  const fetch = vi.fn(async () => Response.json([]));
  vi.stubGlobal('fetch', fetch);

  await callDiscord('secret', 'get', '/channels/{channel_id}/messages', {
    path: { channel_id: 'a/b' },
    query: { limit: 5, before: undefined },
  });

  expect(fetch).toHaveBeenCalledWith(
    'https://discord.com/api/v10/channels/a%2Fb/messages?limit=5',
    { method: 'GET', headers: { Authorization: 'Bot secret' }, body: undefined },
  );
});

it('sends the body as JSON', async () => {
  const fetch = vi.fn(async () => Response.json({ id: '1' }));
  vi.stubGlobal('fetch', fetch);

  await callDiscord('secret', 'post', '/channels/{channel_id}/messages', {
    path: { channel_id: '1' },
    body: { content: 'hi' },
  });

  expect(fetch).toHaveBeenCalledWith('https://discord.com/api/v10/channels/1/messages', {
    method: 'POST',
    headers: { Authorization: 'Bot secret', 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: 'hi' }),
  });
});

it('waits and tries again when Discord answers 429', async () => {
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(Response.json({ retry_after: 0 }, { status: 429 }))
    .mockResolvedValueOnce(Response.json({ id: '1' }));
  vi.stubGlobal('fetch', fetch);

  const result = await callDiscord('secret', 'get', '/users/@me');

  expect(result).toEqual([null, { id: '1' }]);
  expect(fetch).toHaveBeenCalledTimes(2);
});

it('gives up after three tries', async () => {
  const fetch = vi.fn(async () => Response.json({ retry_after: 0 }, { status: 429 }));
  vi.stubGlobal('fetch', fetch);

  const [error] = await callDiscord('secret', 'get', '/users/@me');

  expect(error?.message).toContain('Discord answered 429');
  expect(fetch).toHaveBeenCalledTimes(3);
});

it('gives null for 204 No Content', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(null, { status: 204 })),
  );

  const result = await callDiscord('secret', 'delete', '/channels/{channel_id}', {
    path: { channel_id: '1' },
  });

  expect(result).toEqual([null, null]);
});
