import { createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { afterEach, expect, it, vi } from 'vitest';

import { bot } from '#index';
import { app, click, env, signed, slash } from '#test/fixtures';

let ctx = createExecutionContext();

afterEach(() => {
  ctx = createExecutionContext();
  vi.unstubAllGlobals();
});

it('replies with buttons', async () => {
  const res = await app.fetch(await signed(slash('pick', [])), env, ctx);

  expect(await res.json()).toMatchObject({
    type: 4,
    data: {
      content: 'Yes or no?',
      allowed_mentions: { parse: [] },
      components: [{ type: 1, components: [{ custom_id: 'yes' }, { custom_id: 'no' }] }],
    },
  });
});

it('runs the handler of the clicked button and updates the message', async () => {
  const res = await app.fetch(await signed(click('yes')), env, ctx);

  expect(await res.json()).toEqual({
    type: 7,
    data: { content: 'yu said yes', allowed_mentions: { parse: [] }, components: [] },
  });
});

it('answers 404 for a button without a handler', async () => {
  const res = await app.fetch(await signed(click('no')), env, ctx);

  expect(res.status).toBe(404);
});

it('runs the handler named before the colon and passes what follows as the value', async () => {
  const res = await app.fetch(await signed(click('page:2')), env, ctx);

  expect(await res.json()).toMatchObject({
    type: 7,
    data: {
      content: 'page 2',
      allowed_mentions: { parse: [] },
      components: [{ components: [{ custom_id: 'page:3' }] }],
    },
  });
});

it('keeps the value from the first colon on, colons included', async () => {
  const seen: (string | undefined)[] = [];
  const app2 = bot({
    commands: [],
    buttons: {
      edit: (c) => {
        seen.push(c.value);

        return c.update('ok');
      },
    },
  });

  await app2.fetch(await signed(click('edit')), env, ctx);
  await app2.fetch(await signed(click('edit:a:b')), env, ctx);

  expect(seen).toEqual([undefined, 'a:b']);
});

it('keeps the message while slow work runs, then edits it in', async () => {
  const fetch = vi.fn(async () => Response.json({}));
  vi.stubGlobal('fetch', fetch);
  const slowButtons = bot({
    commands: [],
    buttons: {
      refresh: (c) => c.deferUpdate(async () => ({ content: 'fresh', buttons: [] })),
    },
  });

  const res = await slowButtons.fetch(await signed(click('refresh')), env, ctx);
  await waitOnExecutionContext(ctx);

  expect(await res.json()).toEqual({ type: 6 });
  expect(fetch).toHaveBeenCalledWith(
    'https://discord.com/api/v10/webhooks/7/interaction-token/messages/@original',
    expect.objectContaining({
      method: 'PATCH',
      body: JSON.stringify({ content: 'fresh', allowed_mentions: { parse: [] }, components: [] }),
    }),
  );
});
