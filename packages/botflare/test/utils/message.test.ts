import { expect, it } from 'vitest';

import { message } from '#utils/message';

const button = (i: number) => ({ type: 2, style: 1, label: `B${i}`, custom_id: `b${i}` });

it('sends only the text when there are no buttons', () => {
  expect(message('hi')).toEqual({ content: 'hi', allowed_mentions: { parse: [] } });
});

it('puts buttons in rows of five, the most Discord allows', () => {
  const buttons = Array.from({ length: 7 }, (_, i) => ({ id: `b${i}`, label: `B${i}` }));

  expect(message('pick', { buttons }).components).toEqual([
    { type: 1, components: [0, 1, 2, 3, 4].map(button) },
    { type: 1, components: [5, 6].map(button) },
  ]);
});

it('clears the buttons when given an empty list', () => {
  expect(message('done', { buttons: [] })).toEqual({
    content: 'done',
    allowed_mentions: { parse: [] },
    components: [],
  });
});

it('marks an ephemeral message with the ephemeral flag', () => {
  expect(message('secret', { ephemeral: true })).toEqual({
    content: 'secret',
    allowed_mentions: { parse: [] },
    flags: 64,
  });
});

it('adds embeds next to the text', () => {
  const embeds = [{ title: 'Status', color: 0x57f287, fields: [{ name: 'Ping', value: '12 ms' }] }];

  expect(message('', { embeds })).toEqual({ content: '', allowed_mentions: { parse: [] }, embeds });
});

it('pings nobody unless the message allows it', () => {
  const everyone = message('@everyone look');
  const one = message('<@5> look', { allowedMentions: { users: ['5'] } });

  expect(everyone.allowed_mentions).toEqual({ parse: [] });
  expect(one.allowed_mentions).toEqual({ users: ['5'] });
});

it('puts select menus above the buttons', () => {
  const data = message('pick', {
    selects: [{ type: 'role', id: 'role' }],
    buttons: [{ id: 'done', label: 'Done' }],
  });

  expect(data.components?.map((row) => row.type === 1 && row.components[0]?.type)).toEqual([6, 2]);
});

it('lists each file as an attachment of the message', () => {
  const data = message('report', {
    files: [{ name: 'report.csv', data: 'a,b', description: 'The report' }],
  });

  expect(data.attachments).toEqual([
    { id: '0', filename: 'report.csv', description: 'The report' },
  ]);
});
