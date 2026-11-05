import type { APIMessageComponentSelectMenuInteraction } from 'discord-api-types/v10';
import { expect, it } from 'vitest';

import { selectRow, selectValues } from '#utils/select';

it('puts each menu in a row of its own in the shape Discord expects', () => {
  const fruit = selectRow({
    type: 'string',
    id: 'fruit',
    placeholder: 'Pick fruit',
    max: 2,
    options: { Apple: 'apple' },
  });
  const where = selectRow({ type: 'channel', id: 'where', channelTypes: ['text'] });

  expect(fruit).toEqual({
    type: 1,
    components: [
      {
        type: 3,
        custom_id: 'fruit',
        placeholder: 'Pick fruit',
        max_values: 2,
        options: [{ label: 'Apple', value: 'apple' }],
      },
    ],
  });
  expect(where).toEqual({
    type: 1,
    components: [{ type: 8, custom_id: 'where', channel_types: [0] }],
  });
});

it('gives the objects Discord resolved, or the picked strings', () => {
  const users = selectValues({
    data: {
      component_type: 5,
      custom_id: 'who',
      values: ['5'],
      resolved: { users: { '5': { username: 'yu' } } },
    },
  } as unknown as APIMessageComponentSelectMenuInteraction);
  const strings = selectValues({
    data: { component_type: 3, custom_id: 'fruit', values: ['apple'] },
  } as unknown as APIMessageComponentSelectMenuInteraction);

  expect(users).toEqual([{ username: 'yu' }]);
  expect(strings).toEqual(['apple']);
});
