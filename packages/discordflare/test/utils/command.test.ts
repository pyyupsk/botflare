import { expect, it } from 'vitest';

import { command, contextMenu, option } from '#index';
import { payload } from '#utils/command';

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

it('sends subcommands as type 1 and groups as type 2', () => {
  const config = command({
    name: 'config',
    description: 'Settings',
    subcommands: [
      command({ name: 'get', description: 'Show' }, (c) => c.reply('ok')),
      command({
        name: 'role',
        description: 'Roles',
        subcommands: [
          command(
            {
              name: 'add',
              description: 'Add',
              options: { who: option('user', { description: 'Who' }) },
            },
            (c) => c.reply('ok'),
          ),
        ],
      }),
    ],
  });

  expect(payload(config)).toEqual({
    type: 1,
    name: 'config',
    description: 'Settings',
    options: [
      { type: 1, name: 'get', description: 'Show', options: [] },
      {
        type: 2,
        name: 'role',
        description: 'Roles',
        options: [
          {
            type: 1,
            name: 'add',
            description: 'Add',
            options: [{ name: 'who', description: 'Who', type: 6, required: false }],
          },
        ],
      },
    ],
  });
});

it('sends a context menu with its type and name only', () => {
  const user = contextMenu('user', { name: 'Show avatar' }, (c) => c.reply('ok'));
  const msg = contextMenu('message', { name: 'Quote' }, (c) => c.reply('ok'));

  expect(payload(user)).toEqual({ type: 2, name: 'Show avatar' });
  expect(payload(msg)).toEqual({ type: 3, name: 'Quote' });
});
