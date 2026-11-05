import { afterEach, expect, it, vi } from 'vitest';

import { interactionCallback, putCommands } from '#lib/discord';

const env = { token: 'secret', applicationId: '1', guildId: undefined };

afterEach(() => {
  vi.unstubAllGlobals();
});

it('puts the commands for a server and counts what Discord saved', async () => {
  const fetch = vi.fn(async () => Response.json([{ id: '1' }, { id: '2' }]));
  vi.stubGlobal('fetch', fetch);

  const result = await putCommands({ ...env, guildId: '9' }, []);

  expect(result).toEqual([null, 2]);
  expect(fetch).toHaveBeenCalledWith(
    'https://discord.com/api/v10/applications/1/guilds/9/commands',
    expect.objectContaining({
      method: 'PUT',
      headers: expect.objectContaining({ Authorization: 'Bot secret' }),
    }),
  );
});

it("returns Discord's error instead of throwing", async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response('401: Unauthorized', { status: 401 })),
  );

  const [error, count] = await putCommands(env, []);

  expect(count).toBeNull();
  expect(error?.message).toBe('Discord answered 401: 401: Unauthorized');
});

it('posts an interaction response to its callback url', async () => {
  const fetch = vi.fn(async () => new Response(null, { status: 204 }));
  vi.stubGlobal('fetch', fetch);

  const error = await interactionCallback(
    '5',
    'tok',
    Response.json({ type: 4, data: { content: 'hi' } }),
  );

  expect(error).toBeNull();
  expect(fetch).toHaveBeenCalledWith(
    'https://discord.com/api/v10/interactions/5/tok/callback',
    expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ type: 4, data: { content: 'hi' } }),
    }),
  );
});
