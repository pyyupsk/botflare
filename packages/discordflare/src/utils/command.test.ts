import { expect, it } from 'vitest';

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
