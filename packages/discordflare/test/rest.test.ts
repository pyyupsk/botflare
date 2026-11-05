import { afterEach, expect, expectTypeOf, it, vi } from 'vitest';

import { rest } from '#index';

afterEach(() => {
  vi.unstubAllGlobals();
});

it('calls the REST API as the bot, typed from the route', async () => {
  const fetch = vi.fn(async () => Response.json({ roles: [], joined_at: '2026-11-05' }));
  vi.stubGlobal('fetch', fetch);

  const [error, member] = await rest.get('/guilds/{guild_id}/members/{user_id}', {
    path: { guild_id: '1', user_id: '2' },
  });

  expect(error).toBeNull();
  expect(member?.roles).toEqual([]);
  expect(fetch).toHaveBeenCalledWith(
    'https://discord.com/api/v10/guilds/1/members/2',
    expect.objectContaining({ headers: { Authorization: 'Bot secret' } }),
  );
});

it('types the routes, methods and arguments of the REST API', () => {
  expectTypeOf(
    rest.put('/guilds/{guild_id}/members/{user_id}/roles/{role_id}', {
      path: { guild_id: '1', user_id: '2', role_id: '3' },
    }),
  ).resolves.toEqualTypeOf<[Error, null] | [null, null]>();

  // @ts-expect-error the route does not exist
  void rest.get('/guilds/{guild_id}/nothing', { path: { guild_id: '1' } });
  // @ts-expect-error the route has no POST
  void rest.post('/guilds/{guild_id}/members/{user_id}', { path: { guild_id: '1', user_id: '2' } });
  // @ts-expect-error user_id is missing
  void rest.get('/guilds/{guild_id}/members/{user_id}', { path: { guild_id: '1' } });
  void rest.post('/channels/{channel_id}/messages', {
    path: { channel_id: '1' },
    // @ts-expect-error content must be a string
    body: { content: 1 },
  });
});
