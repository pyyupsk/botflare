import { createExecutionContext } from 'cloudflare:test';
import type { APIInteraction } from 'discord-api-types/v10';
import { afterEach, expect, it, vi } from 'vitest';

import { bot, command, option } from '#index';

let ctx = createExecutionContext();

afterEach(() => {
  ctx = createExecutionContext();
  vi.unstubAllGlobals();
});

it('suggests values for the option the user is typing in', async () => {
  const onError = vi.fn();
  const fruits = ['apple', 'apricot', 'banana'];
  const shop = bot({
    onError,
    commands: [
      command(
        {
          name: 'buy',
          description: 'Buy fruit',
          options: {
            fruit: option('string', {
              description: 'Fruit',
              autocomplete: (c) => fruits.filter((f) => f.startsWith(c.value)),
            }),
            count: option('integer', {
              description: 'How many',
              autocomplete: () => {
                throw new Error('no stock');
              },
            }),
            note: option('string', { description: 'Note' }),
          },
        },
        (c) => c.reply('ok'),
      ),
    ],
  });
  const typing = (name: string, value: string): Promise<Response> =>
    shop.answer(
      {
        type: 4,
        data: { type: 1, name: 'buy', options: [{ type: 3, name, value, focused: true }] },
      } as unknown as APIInteraction,
      ctx,
    );

  const fruit = await typing('fruit', 'ap');
  const count = await typing('count', '1');
  const note = await typing('note', 'x');

  expect(await fruit.json()).toEqual({
    type: 8,
    data: {
      choices: [
        { name: 'apple', value: 'apple' },
        { name: 'apricot', value: 'apricot' },
      ],
    },
  });
  expect(await count.json()).toEqual({ type: 8, data: { choices: [] } });
  expect(onError).toHaveBeenCalledWith(new Error('no stock'), '/buy autocomplete');
  expect(note.status).toBe(404);
});

it('types autocomplete suggestions and keeps them apart from choices', () => {
  option('integer', { description: 'x', autocomplete: () => [1, { name: 'Two', value: 2 }] });

  // @ts-expect-error an integer option suggests numbers
  option('integer', { description: 'x', autocomplete: () => ['1'] });
  // @ts-expect-error a boolean option has no autocomplete
  option('boolean', { description: 'x', autocomplete: () => [true] });
  // @ts-expect-error choices and autocomplete do not mix
  option('string', { description: 'x', choices: { A: 'a' }, autocomplete: () => ['a'] });
});
