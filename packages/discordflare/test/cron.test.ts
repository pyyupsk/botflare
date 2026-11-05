import { createScheduledController } from 'cloudflare:test';
import { afterEach, expect, it, vi } from 'vitest';

import { bot } from '#index';
import { app } from '#test/fixtures';

afterEach(() => {
  vi.unstubAllGlobals();
});

it('runs the cron job for the trigger and posts to the channel with the bot token', async () => {
  const fetch = vi.fn(async () => Response.json({}));
  vi.stubGlobal('fetch', fetch);

  await app.scheduled(createScheduledController({ cron: '0 9 * * *' }), {
    DISCORD_TOKEN: 'secret',
  });

  expect(fetch).toHaveBeenCalledOnce();
  expect(fetch).toHaveBeenCalledWith(
    'https://discord.com/api/v10/channels/42/messages',
    expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({ Authorization: 'Bot secret' }),
      body: JSON.stringify({ content: 'good morning', allowed_mentions: { parse: [] } }),
    }),
  );
});

it('posts embeds and buttons from a cron job', async () => {
  const fetch = vi.fn(async () => Response.json({}));
  vi.stubGlobal('fetch', fetch);
  const daily = bot({
    commands: [],
    cron: {
      '0 9 * * *': (c) =>
        void c.send('42', '', {
          embeds: [{ title: 'Daily report' }],
          buttons: [{ id: 'more', label: 'More' }],
        }),
    },
  });

  await daily.scheduled(createScheduledController({ cron: '0 9 * * *' }), {
    DISCORD_TOKEN: 'secret',
  });

  expect(fetch).toHaveBeenCalledWith(
    'https://discord.com/api/v10/channels/42/messages',
    expect.objectContaining({
      body: JSON.stringify({
        content: '',
        allowed_mentions: { parse: [] },
        embeds: [{ title: 'Daily report' }],
        components: [
          { type: 1, components: [{ type: 2, style: 1, label: 'More', custom_id: 'more' }] },
        ],
      }),
    }),
  );
});

it("hands Discord's refusal back to the cron job as an error", async () => {
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(new Response('Missing Access', { status: 403 }))
    .mockResolvedValueOnce(Response.json({}));
  vi.stubGlobal('fetch', fetch);

  await app.scheduled(createScheduledController({ cron: '0 9 * * *' }), {
    DISCORD_TOKEN: 'secret',
  });

  expect(fetch).toHaveBeenLastCalledWith(
    'https://discord.com/api/v10/channels/42/messages',
    expect.objectContaining({
      body: JSON.stringify({
        content: 'failed: Discord answered 403: Missing Access',
        allowed_mentions: { parse: [] },
      }),
    }),
  );
});

it('does nothing for a trigger without a job', async () => {
  const fetch = vi.fn();
  vi.stubGlobal('fetch', fetch);

  await app.scheduled(createScheduledController({ cron: '*/5 * * * *' }), {
    DISCORD_TOKEN: 'secret',
  });

  expect(fetch).not.toHaveBeenCalled();
});

it('starts the gateway on every cron tick when the bot names its binding', async () => {
  const ensure = vi.fn(async () => {});
  const getByName = vi.fn(() => ({ ensure }));
  const withGateway = bot({ commands: [], gateway: 'GATEWAY' });

  await withGateway.scheduled(createScheduledController({ cron: '*/5 * * * *' }), {
    DISCORD_TOKEN: 'secret',
    GATEWAY: { getByName },
  });

  expect(getByName).toHaveBeenCalledWith('main');
  expect(ensure).toHaveBeenCalledOnce();
});
