import { expect, expectTypeOf, it } from 'vitest';

import { command, option } from '#index';
import { payload } from '#utils/command';
import { optionValues } from '#utils/option';

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

it('tells Discord which options autocomplete', () => {
  const find = command(
    {
      name: 'find',
      description: 'Find',
      options: { q: option('string', { description: 'Query', autocomplete: () => [] }) },
    },
    (c) => c.reply('ok'),
  );

  expect(payload(find).options).toEqual([
    { name: 'q', description: 'Query', type: 3, required: false, autocomplete: true },
  ]);
});

it('resolves users with their member, mentionables and attachments', () => {
  const values = optionValues(
    [
      { type: 6, name: 'who', value: '5' },
      { type: 9, name: 'anyone', value: '5' },
      { type: 9, name: 'group', value: '8' },
      { type: 11, name: 'file', value: '3' },
    ] as Parameters<typeof optionValues>[0],
    {
      users: { '5': { id: '5', username: 'yu' } },
      members: { '5': { nick: 'Yu' } },
      roles: { '8': { id: '8', name: 'mods' } },
      attachments: { '3': { id: '3', filename: 'cat.png' } },
    } as unknown as Parameters<typeof optionValues>[1],
  );

  expect(values).toEqual({
    who: { id: '5', username: 'yu', member: { nick: 'Yu' } },
    anyone: { id: '5', username: 'yu', member: { nick: 'Yu' } },
    group: { id: '8', name: 'mods' },
    file: { id: '3', filename: 'cat.png' },
  });
});

it('sends mentionable and attachment options as types 9 and 11', () => {
  const upload = command(
    {
      name: 'upload',
      description: 'Upload',
      options: {
        file: option('attachment', { description: 'File', required: true }),
        notify: option('mentionable', { description: 'Who to tell' }),
      },
    },
    (c) => c.reply('ok'),
  );

  expect(payload(upload).options?.map((o) => o?.type)).toEqual([11, 9]);
});
