import { expect, it } from 'vitest';

import { message } from './message';

const button = (i: number) => ({ type: 2, style: 1, label: `B${i}`, custom_id: `b${i}` });

it('sends only the text when there are no buttons', () => {
  expect(message('hi')).toEqual({ content: 'hi' });
});

it('puts buttons in rows of five, the most Discord allows', () => {
  const buttons = Array.from({ length: 7 }, (_, i) => ({ id: `b${i}`, label: `B${i}` }));

  expect(message('pick', { buttons }).components).toEqual([
    { type: 1, components: [0, 1, 2, 3, 4].map(button) },
    { type: 1, components: [5, 6].map(button) },
  ]);
});

it('clears the buttons when given an empty list', () => {
  expect(message('done', { buttons: [] })).toEqual({ content: 'done', components: [] });
});

it('marks an ephemeral message with the ephemeral flag', () => {
  expect(message('secret', { ephemeral: true })).toEqual({ content: 'secret', flags: 64 });
});
