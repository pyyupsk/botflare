import { expect, it } from 'vitest';

import { intentBits } from './intents';

it('adds up the bits of the named intents', () => {
  expect(intentBits(['Guilds', 'GuildMessages', 'MessageContent'])).toBe(1 + 512 + 32768);
});

it('counts a repeated intent once', () => {
  expect(intentBits(['Guilds', 'Guilds'])).toBe(1);
});
