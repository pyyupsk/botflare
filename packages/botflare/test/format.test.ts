import { expect, it } from 'vitest';

import { mention, time } from '#index';

it('writes mentions from an id or from an object with an id', () => {
  expect(mention.user('5')).toBe('<@5>');
  expect(mention.user({ id: '5' })).toBe('<@5>');
  expect(mention.role('6')).toBe('<@&6>');
  expect(mention.channel({ id: '7' })).toBe('<#7>');
  expect(mention.command('roll', '8')).toBe('</roll:8>');
});

it('writes timestamps in whole seconds, in each style', () => {
  const start = new Date('2026-11-05T12:30:00.900Z');

  expect(time(start)).toBe('<t:1793881800:f>');
  expect(time(start.getTime(), 'relative')).toBe('<t:1793881800:R>');
  expect(time(start, 'long-date')).toBe('<t:1793881800:D>');
});
