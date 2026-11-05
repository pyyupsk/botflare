import { createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { afterEach, expect, it, vi } from 'vitest';

import { bot, command } from '#index';
import { app, env, signed, slash, slow } from '#test/fixtures';

let ctx = createExecutionContext();

afterEach(() => {
  ctx = createExecutionContext();
  vi.unstubAllGlobals();
});

it('defers a slow command and edits the answer in when the work is done', async () => {
  const fetch = vi.fn(async () => Response.json({}));
  vi.stubGlobal('fetch', fetch);

  const res = await app.fetch(await signed(slash('slow', [])), env, ctx);
  await waitOnExecutionContext(ctx);

  expect(await res.json()).toEqual({ type: 5 });
  expect(fetch).toHaveBeenCalledWith(
    'https://discord.com/api/v10/webhooks/7/interaction-token/messages/@original',
    expect.objectContaining({
      method: 'PATCH',
      body: JSON.stringify({ content: 'done', allowed_mentions: { parse: [] } }),
    }),
  );
});

it('edits embeds into a deferred answer', async () => {
  const fetch = vi.fn(async () => Response.json({}));
  vi.stubGlobal('fetch', fetch);
  const report = bot({
    commands: [
      command({ name: 'report', description: 'Reports late' }, (c) =>
        c.defer(async () => ({
          content: 'Report',
          embeds: [{ title: 'Uptime', description: '99%' }],
        })),
      ),
    ],
  });

  await report.fetch(await signed(slash('report', [])), env, ctx);
  await waitOnExecutionContext(ctx);

  expect(fetch).toHaveBeenCalledWith(
    expect.stringContaining('/messages/@original'),
    expect.objectContaining({
      body: JSON.stringify({
        content: 'Report',
        allowed_mentions: { parse: [] },
        embeds: [{ title: 'Uptime', description: '99%' }],
      }),
    }),
  );
});

it('edits buttons into a deferred answer', async () => {
  const fetch = vi.fn(async () => Response.json({}));
  vi.stubGlobal('fetch', fetch);
  const later = bot({
    commands: [
      command({ name: 'later', description: 'Asks late' }, (c) =>
        c.defer(async () => ({ content: 'Ready?', buttons: [{ id: 'yes', label: 'Yes' }] })),
      ),
    ],
  });

  await later.fetch(await signed(slash('later', [])), env, ctx);
  await waitOnExecutionContext(ctx);

  expect(fetch).toHaveBeenCalledWith(
    expect.stringContaining('/messages/@original'),
    expect.objectContaining({
      body: JSON.stringify({
        content: 'Ready?',
        allowed_mentions: { parse: [] },
        components: [
          { type: 1, components: [{ type: 2, style: 1, label: 'Yes', custom_id: 'yes' }] },
        ],
      }),
    }),
  );
});

it('reports deferred work that fails and edits the answer so it does not stay on thinking', async () => {
  const fetch = vi.fn(async () => Response.json({}));
  vi.stubGlobal('fetch', fetch);
  const onError = vi.fn();
  const broken = bot({
    commands: [
      command({ name: 'broken', description: 'Fails late' }, (c) =>
        c.defer(async () => {
          throw new Error('boom');
        }),
      ),
    ],
    onError,
  });

  await broken.fetch(await signed(slash('broken', [])), env, ctx);
  await waitOnExecutionContext(ctx);

  expect(onError).toHaveBeenCalledWith(new Error('boom'), '/broken');
  expect(fetch).toHaveBeenCalledWith(
    expect.stringContaining('/messages/@original'),
    expect.objectContaining({
      body: JSON.stringify({ content: 'Something went wrong.', allowed_mentions: { parse: [] } }),
    }),
  );
});

it('reports an edit that Discord refuses', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response('Unknown Webhook', { status: 404 })),
  );
  const onError = vi.fn();
  const late = bot({ commands: [slow], onError });

  await late.fetch(await signed(slash('slow', [])), env, ctx);
  await waitOnExecutionContext(ctx);

  expect(onError).toHaveBeenCalledWith(new Error('Discord answered 404: Unknown Webhook'), '/slow');
});

it('replies and defers so only the user who ran the command sees it', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => Response.json({})),
  );
  const quiet = bot({
    commands: [
      command({ name: 'quiet', description: 'Whispers' }, (c) =>
        c.reply('psst', { ephemeral: true }),
      ),
      command({ name: 'quietlater', description: 'Whispers late' }, (c) =>
        c.defer(async () => 'psst', { ephemeral: true }),
      ),
    ],
  });

  const now = await quiet.fetch(await signed(slash('quiet', [])), env, ctx);
  const later = await quiet.fetch(await signed(slash('quietlater', [])), env, ctx);

  expect(await now.json()).toEqual({
    type: 4,
    data: { content: 'psst', allowed_mentions: { parse: [] }, flags: 64 },
  });
  expect(await later.json()).toEqual({ type: 5, data: { flags: 64 } });
});
