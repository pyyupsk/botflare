import { expect, expectTypeOf, it } from 'vitest';

import { command, option } from '#index';

import { payload } from './command';

it('turns a command into the body Discord expects, required options first', () => {
  const roll = command(
    {
      name: 'roll',
      description: 'Roll dice',
      options: {
        label: option('string', { description: 'A name' }),
        dice: option('integer', { description: 'How many', required: true }),
      },
    },
    (c) => c.reply('ok'),
  );

  expect(payload(roll)).toEqual({
    type: 1,
    name: 'roll',
    description: 'Roll dice',
    options: [
      { name: 'dice', description: 'How many', type: 4, required: true },
      { name: 'label', description: 'A name', type: 3, required: false },
    ],
  });
});

it('sends choices, limits and channel types in the names Discord expects', () => {
  const pick = command(
    {
      name: 'pick',
      description: 'Pick',
      options: {
        color: option('string', { description: 'Color', choices: { Red: 'red' }, maxLength: 10 }),
        dice: option('integer', { description: 'Dice', min: 1, max: 6 }),
        where: option('channel', { description: 'Where', channelTypes: ['text', 'forum'] }),
      },
    },
    (c) => c.reply('ok'),
  );

  expect(payload(pick).options).toEqual([
    {
      name: 'color',
      description: 'Color',
      type: 3,
      required: false,
      choices: [{ name: 'Red', value: 'red' }],
      max_length: 10,
    },
    { name: 'dice', description: 'Dice', type: 4, required: false, min_value: 1, max_value: 6 },
    { name: 'where', description: 'Where', type: 7, required: false, channel_types: [0, 15] },
  ]);
});

it('narrows a value to its choices and allows each limit only on its own type', () => {
  command(
    {
      name: 'paint',
      description: 'Paint',
      options: {
        color: option('string', {
          description: 'Color',
          required: true,
          choices: { Red: 'red', Blue: 'blue' },
        }),
        size: option('integer', { description: 'Size', choices: { Small: 1, Big: 3 } }),
      },
    },
    (c) => {
      expectTypeOf(c.options.color).toEqualTypeOf<'red' | 'blue'>();
      expectTypeOf(c.options.size).toEqualTypeOf<1 | 3 | undefined>();

      return c.reply('ok');
    },
  );

  // @ts-expect-error a string option has no min
  option('string', { description: 'x', min: 1 });
  // @ts-expect-error a boolean option has no choices
  option('boolean', { description: 'x', choices: { Yes: true } });
  // @ts-expect-error an integer choice must be a number
  option('integer', { description: 'x', choices: { One: '1' } });
  // @ts-expect-error not a channel type
  option('channel', { description: 'x', channelTypes: ['dm'] });
});
