import { createExecutionContext } from 'cloudflare:test';
import type { APIInteraction } from 'discord-api-types/v10';
import { afterEach, expect, it, vi } from 'vitest';

import { bot, command, option } from '#index';
import { app, env, signed, slash } from '#test/fixtures';

let ctx = createExecutionContext();

afterEach(() => {
  ctx = createExecutionContext();
  vi.unstubAllGlobals();
});

it('runs the matching command with its option values', async () => {
  const body = slash('roll', [
    { name: 'dice', type: 4, value: 3 },
    { name: 'label', type: 3, value: 'attack' },
  ]);
  const res = await app.fetch(await signed(body), env, ctx);

  expect(await res.json()).toEqual({
    type: 4,
    data: { content: 'attack: 3', allowed_mentions: { parse: [] } },
  });
});

it('leaves an optional option undefined when the user skips it', async () => {
  const res = await app.fetch(
    await signed(slash('roll', [{ name: 'dice', type: 4, value: 2 }])),
    env,
    ctx,
  );

  expect(await res.json()).toEqual({
    type: 4,
    data: { content: 'roll: 2', allowed_mentions: { parse: [] } },
  });
});

it('answers 404 for a command the bot does not know', async () => {
  const res = await app.fetch(await signed(slash('nope', [])), env, ctx);

  expect(res.status).toBe(404);
});

it('runs a command that has no options', async () => {
  const res = await app.fetch(await signed(slash('hello', [])), env, ctx);

  expect(await res.json()).toEqual({
    type: 4,
    data: { content: 'hello', allowed_mentions: { parse: [] } },
  });
});

it('gives user, channel and role options as the objects Discord resolved', async () => {
  const body = JSON.stringify({
    type: 2,
    application_id: '7',
    token: 'interaction-token',
    data: {
      type: 1,
      name: 'whois',
      options: [
        { name: 'user', type: 6, value: '11' },
        { name: 'where', type: 7, value: '22' },
        { name: 'role', type: 8, value: '33' },
      ],
      resolved: {
        users: { '11': { id: '11', username: 'yu' } },
        channels: { '22': { id: '22', name: 'general', type: 0 } },
        roles: { '33': { id: '33', name: 'member' } },
      },
    },
  });

  const res = await app.fetch(await signed(body), env, ctx);

  expect(await res.json()).toEqual({
    type: 4,
    data: { content: 'yu in #general as member', allowed_mentions: { parse: [] } },
  });
});

it('answers a subcommand inside a group with its own options', async () => {
  const onError = vi.fn();
  const settings = bot({
    onError,
    commands: [
      command({
        name: 'config',
        description: 'Settings',
        subcommands: [
          command({ name: 'get', description: 'Show' }, (c) => c.reply('got')),
          command({
            name: 'role',
            description: 'Roles',
            subcommands: [
              command(
                {
                  name: 'add',
                  description: 'Add a role',
                  options: { who: option('user', { description: 'Who', required: true }) },
                },
                (c) => c.reply(`added ${c.options.who.username}`),
              ),
            ],
          }),
        ],
      }),
    ],
  });
  const run = (options: unknown[]): Promise<Response> =>
    settings.answer(
      {
        type: 2,
        data: {
          type: 1,
          name: 'config',
          options,
          resolved: { users: { '5': { username: 'yu' } } },
        },
      } as unknown as APIInteraction,
      ctx,
    );

  const added = await run([
    {
      type: 2,
      name: 'role',
      options: [{ type: 1, name: 'add', options: [{ type: 6, name: 'who', value: '5' }] }],
    },
  ]);
  const got = await run([{ type: 1, name: 'get', options: [] }]);
  const missing = await run([{ type: 1, name: 'nothing', options: [] }]);

  expect(await added.json()).toEqual({
    type: 4,
    data: { content: 'added yu', allowed_mentions: { parse: [] } },
  });
  expect(await got.json()).toEqual({
    type: 4,
    data: { content: 'got', allowed_mentions: { parse: [] } },
  });
  expect(missing.status).toBe(404);
});
