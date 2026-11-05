import { createExecutionContext } from 'cloudflare:test';
import type { APIInteraction, APIUser } from 'discord-api-types/v10';
import { afterEach, expect, expectTypeOf, it, vi } from 'vitest';

import { bot, select } from '#index';

let ctx = createExecutionContext();

afterEach(() => {
  ctx = createExecutionContext();
  vi.unstubAllGlobals();
});

const fruit = select(
  'string',
  { id: 'fruit', max: 2, options: { Apple: 'apple', Mango: 'mango' } },
  (c) => {
    expectTypeOf(c.values).toEqualTypeOf<('apple' | 'mango')[]>();

    return c.update(`picked ${c.values.join(', ')}`, { selects: [] });
  },
);

const who = select('user', { id: 'who' }, (c) => {
  expectTypeOf(c.values).toEqualTypeOf<APIUser[]>();

  return c.reply(`hi ${c.values[0]?.username}`);
});

const app = bot({ commands: [], selects: [fruit, who] });

const pick = (data: object): Promise<Response> =>
  app.answer({ type: 3, data } as unknown as APIInteraction, ctx);

it('runs the handler of the menu the user picked from', async () => {
  const fruits = await pick({ component_type: 3, custom_id: 'fruit', values: ['apple', 'mango'] });
  const users = await pick({
    component_type: 5,
    custom_id: 'who',
    values: ['5'],
    resolved: { users: { '5': { username: 'yu' } } },
  });
  const unknown = await pick({ component_type: 3, custom_id: 'nothing', values: [] });

  expect(await fruits.json()).toEqual({
    type: 7,
    data: { content: 'picked apple, mango', allowed_mentions: { parse: [] }, components: [] },
  });
  expect(await users.json()).toEqual({
    type: 4,
    data: { content: 'hi yu', allowed_mentions: { parse: [] } },
  });
  expect(unknown.status).toBe(404);
});

it('asks for options only on a string menu and channel types only on a channel menu', () => {
  // @ts-expect-error a string menu needs options
  select('string', { id: 'x' }, (c) => c.reply('x'));
  // @ts-expect-error a user menu has no options
  select('user', { id: 'x', options: { A: 'a' } }, (c) => c.reply('x'));
  // @ts-expect-error a role menu has no channel types
  select('role', { id: 'x', channelTypes: ['text'] }, (c) => c.reply('x'));
});
