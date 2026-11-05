import { createExecutionContext } from 'cloudflare:test';
import type { APIInteraction, APIMessage, APIUser } from 'discord-api-types/v10';
import { afterEach, expect, expectTypeOf, it, vi } from 'vitest';

import { bot, command, contextMenu } from '#index';

let ctx = createExecutionContext();

afterEach(() => {
  ctx = createExecutionContext();
  vi.unstubAllGlobals();
});

const avatar = contextMenu('user', { name: 'Inspect' }, (c) => {
  expectTypeOf(c.target).toEqualTypeOf<APIUser>();

  return c.reply(`user ${c.target.username}`);
});

const quote = contextMenu('message', { name: 'Inspect' }, (c) => {
  expectTypeOf(c.target).toEqualTypeOf<APIMessage>();

  return c.reply(`message ${c.target.content}`);
});

const inspect = command({ name: 'Inspect', description: 'Slash' }, (c) => c.reply('slash'));

const app = bot({ commands: [avatar, quote, inspect] });

const run = (type: number, data: object): Promise<Response> =>
  app.answer(
    { type: 2, data: { name: 'Inspect', type, ...data } } as unknown as APIInteraction,
    ctx,
  );

it('runs the menu for the kind of thing the user clicked, apart from a slash command of that name', async () => {
  const user = await run(2, { target_id: '5', resolved: { users: { '5': { username: 'yu' } } } });
  const message = await run(3, {
    target_id: '9',
    resolved: { messages: { '9': { content: 'hi' } } },
  });
  const slash = await run(1, { options: [] });

  expect(await user.json()).toMatchObject({ type: 4, data: { content: 'user yu' } });
  expect(await message.json()).toMatchObject({ type: 4, data: { content: 'message hi' } });
  expect(await slash.json()).toMatchObject({ type: 4, data: { content: 'slash' } });
});

it('answers 404 for a menu the bot does not know', async () => {
  const res = await app.answer(
    {
      type: 2,
      data: { name: 'Other', type: 2, target_id: '5', resolved: { users: {} } },
    } as unknown as APIInteraction,
    ctx,
  );

  expect(res.status).toBe(404);
});
