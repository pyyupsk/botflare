import { createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { afterEach, expect, it, vi } from 'vitest';

import { bot, command } from '#index';
import { env, signed, slash } from '#test/fixtures';

let ctx = createExecutionContext();

afterEach(() => {
  ctx = createExecutionContext();
  vi.unstubAllGlobals();
});

const WEBHOOK = 'https://discord.com/api/v10/webhooks/7/interaction-token';

it('follows up, edits and deletes the reply after Discord has it', async () => {
  const fetch = vi.fn(async (_url: string, _init: RequestInit) => Response.json({}));
  vi.stubGlobal('fetch', fetch);
  const poll = bot({
    commands: [
      command({ name: 'poll', description: 'Poll' }, (c) => {
        c.after(async () => {
          await c.followUp('second', { ephemeral: true });
          await c.editReply('first, edited');
          await c.deleteReply();
        });

        return c.reply('first');
      }),
    ],
  });

  const res = await poll.fetch(await signed(slash('poll', [])), env, ctx);
  await waitOnExecutionContext(ctx);

  expect(await res.json()).toMatchObject({ type: 4, data: { content: 'first' } });
  expect(fetch.mock.calls.map(([url, init]) => [init.method, url])).toEqual([
    ['POST', WEBHOOK],
    ['PATCH', `${WEBHOOK}/messages/@original`],
    ['DELETE', `${WEBHOOK}/messages/@original`],
  ]);
  expect(JSON.parse(fetch.mock.calls[0]?.[1].body as string)).toMatchObject({
    content: 'second',
    flags: 64,
  });
});

it('reports an error from after work', async () => {
  const onError = vi.fn();
  const broken = bot({
    onError,
    commands: [
      command({ name: 'broken', description: 'Broken' }, (c) => {
        c.after(async () => {
          throw new Error('boom');
        });

        return c.reply('ok');
      }),
    ],
  });

  await broken.fetch(await signed(slash('broken', [])), env, ctx);
  await waitOnExecutionContext(ctx);

  expect(onError).toHaveBeenCalledWith(new Error('boom'), '/broken after');
});
