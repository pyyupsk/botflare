import { expect, it } from 'vitest';

import { modal } from '#index';

import { fieldValues, modalData } from './modal';

it('wraps each field in a label, required unless the field says otherwise', () => {
  const form = modal(
    {
      id: 'feedback',
      title: 'Feedback',
      fields: {
        name: { label: 'Name', required: false },
        text: { label: 'Your idea', style: 'paragraph' },
      },
    },
    (c) => c.reply('ok'),
  );

  expect(modalData(form)).toEqual({
    custom_id: 'feedback',
    title: 'Feedback',
    components: [
      {
        type: 18,
        label: 'Name',
        component: { type: 4, custom_id: 'name', style: 1, required: false },
      },
      {
        type: 18,
        label: 'Your idea',
        component: { type: 4, custom_id: 'text', style: 2, required: true },
      },
    ],
  });
});

it('reads the typed text from labels and from older action rows', () => {
  const values = fieldValues([
    { type: 18, id: 1, component: { type: 4, id: 2, custom_id: 'text', value: 'ship it' } },
    { type: 1, components: [{ type: 4, id: 3, custom_id: 'name', value: 'yu' }] },
  ]);

  expect(values).toEqual({ text: 'ship it', name: 'yu' });
});
