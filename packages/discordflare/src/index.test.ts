import {
  createExecutionContext,
  createScheduledController,
  waitOnExecutionContext,
} from 'cloudflare:test';
import type {
  APIInteraction,
  APIInteractionDataResolvedChannel,
  APIRole,
  APIUser,
} from 'discord-api-types/v10';
import { afterEach, beforeAll, expect, expectTypeOf, it, vi } from 'vitest';

import { bot, command, modal, option, rest } from './index';

const encoder = new TextEncoder();
const hex = (buffer: ArrayBuffer): string =>
  Array.from(new Uint8Array(buffer), (byte) => byte.toString(16).padStart(2, '0')).join('');

async function keyPair(): Promise<CryptoKeyPair> {
  const pair = await crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  if (!('privateKey' in pair)) throw new Error('expected an Ed25519 key pair');

  return pair;
}

let env: { DISCORD_PUBLIC_KEY: string };
let privateKey: CryptoKey;

beforeAll(async () => {
  const pair = await keyPair();
  privateKey = pair.privateKey;

  const raw = (await crypto.subtle.exportKey('raw', pair.publicKey)) as ArrayBuffer;
  env = { DISCORD_PUBLIC_KEY: hex(raw) };
});

async function signed(body: string, key = privateKey): Promise<Request> {
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = await crypto.subtle.sign(
    { name: 'Ed25519' },
    key,
    encoder.encode(timestamp + body),
  );

  return new Request('https://bot.test/', {
    method: 'POST',
    headers: { 'X-Signature-Ed25519': hex(signature), 'X-Signature-Timestamp': timestamp },
    body,
  });
}

const ping = JSON.stringify({ type: 1 });

const roll = command(
  {
    name: 'roll',
    description: 'Roll dice',
    options: {
      dice: option('integer', { description: 'How many dice', required: true }),
      label: option('string', { description: 'A name for the roll' }),
    },
  },
  (c) => {
    expectTypeOf(c.options.dice).toEqualTypeOf<number>();
    expectTypeOf(c.options.label).toEqualTypeOf<string | undefined>();

    return c.reply(`${c.options.label ?? 'roll'}: ${c.options.dice}`);
  },
);

const hello = command({ name: 'hello', description: 'Say hello' }, (c) => {
  // @ts-expect-error
  void c.options.anything;

  return c.reply('hello');
});

const slow = command({ name: 'slow', description: 'Answers late' }, (c) =>
  c.defer(async () => 'done'),
);

const pick = command({ name: 'pick', description: 'Pick one' }, (c) =>
  c.reply('Yes or no?', {
    buttons: [
      { id: 'yes', label: 'Yes' },
      { id: 'no', label: 'No' },
    ],
  }),
);

const feedback = modal(
  {
    id: 'feedback',
    title: 'Feedback',
    fields: { text: { label: 'Your idea' }, note: { label: 'Anything else', required: false } },
  },
  (c) => {
    expectTypeOf(c.fields.text).toEqualTypeOf<string>();
    expectTypeOf(c.fields.note).toEqualTypeOf<string | undefined>();
    // @ts-expect-error
    void c.fields.missing;

    return c.reply(`thanks: ${c.fields.text}`);
  },
);

const ask = command({ name: 'ask', description: 'Ask for feedback' }, (c) => c.modal(feedback));

const whois = command(
  {
    name: 'whois',
    description: 'Names a user, a channel and a role',
    options: {
      user: option('user', { description: 'Who', required: true }),
      where: option('channel', { description: 'Where', required: true }),
      role: option('role', { description: 'Which role' }),
    },
  },
  (c) => {
    expectTypeOf(c.options.user).toEqualTypeOf<APIUser>();
    expectTypeOf(c.options.where).toEqualTypeOf<APIInteractionDataResolvedChannel>();
    expectTypeOf(c.options.role).toEqualTypeOf<APIRole | undefined>();

    return c.reply(
      `${c.options.user.username} in #${c.options.where.name} as ${c.options.role?.name ?? 'nobody'}`,
    );
  },
);

const app = bot({
  commands: [roll, hello, slow, pick, ask, whois],
  buttons: {
    yes: (c) => c.update(`${c.interaction.member?.user.username} said yes`, { buttons: [] }),
    open: (c) => c.modal(feedback),
    page: (c) =>
      c.update(`page ${c.value}`, {
        buttons: [{ id: `page:${Number(c.value) + 1}`, label: 'Next' }],
      }),
  },
  modals: [feedback],
  cron: {
    '0 9 * * *': async (c) => {
      const error = await c.send('42', 'good morning');
      if (error) await c.send('42', `failed: ${error.message}`);
    },
  },
});

let ctx = createExecutionContext();

afterEach(() => {
  ctx = createExecutionContext();
  vi.unstubAllGlobals();
});

function click(id: string): string {
  return JSON.stringify({
    type: 3,
    application_id: '7',
    token: 'interaction-token',
    member: { user: { username: 'yu' } },
    data: { component_type: 2, custom_id: id },
  });
}

function submit(id: string, text: string): string {
  return JSON.stringify({
    type: 5,
    application_id: '7',
    token: 'interaction-token',
    data: {
      custom_id: id,
      components: [
        { type: 18, id: 1, component: { type: 4, id: 2, custom_id: 'text', value: text } },
      ],
    },
  });
}

function slash(name: string, options: { name: string; type: number; value: unknown }[]): string {
  return JSON.stringify({
    type: 2,
    application_id: '7',
    token: 'interaction-token',
    data: { type: 1, name, options },
  });
}

it('answers a signed ping with pong', async () => {
  const res = await app.fetch(await signed(ping), env, ctx);

  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ type: 1 });
});

it('rejects a body that does not match the signature', async () => {
  const req = await signed(ping);
  const tampered = new Request(req, { method: 'POST', body: JSON.stringify({ type: 2 }) });

  expect((await app.fetch(tampered, env, ctx)).status).toBe(401);
});

it('rejects a signature from another key', async () => {
  const other = await keyPair();

  expect((await app.fetch(await signed(ping, other.privateKey), env, ctx)).status).toBe(401);
});

it('rejects missing or malformed signature headers', async () => {
  const bare = new Request('https://bot.test/', { method: 'POST', body: ping });

  expect((await app.fetch(bare, env, ctx)).status).toBe(401);

  const statuses = await Promise.all(
    ['not-hex', 'aa'].map(async (bad) => {
      const req = await signed(ping);
      req.headers.set('X-Signature-Ed25519', bad);

      return (await app.fetch(req, env, ctx)).status;
    }),
  );

  expect(statuses).toEqual([401, 401]);
});

it('rejects methods other than POST', async () => {
  const res = await app.fetch(new Request('https://bot.test/'), env, ctx);

  expect(res.status).toBe(405);
});

it('explains a malformed public key instead of crashing', async () => {
  const res = await app.fetch(await signed(ping), { DISCORD_PUBLIC_KEY: '00' }, ctx);

  expect(res.status).toBe(500);
  expect(await res.text()).toContain('DISCORD_PUBLIC_KEY');
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

it('defers a slow command and edits the answer in when the work is done', async () => {
  const fetch = vi.fn(async () => Response.json({}));
  vi.stubGlobal('fetch', fetch);

  const res = await app.fetch(await signed(slash('slow', [])), env, ctx);
  await waitOnExecutionContext(ctx);

  expect(await res.json()).toEqual({ type: 5 });
  expect(fetch).toHaveBeenCalledWith(
    'https://discord.com/api/v10/webhooks/7/interaction-token/messages/@original',
    expect.objectContaining({
      method: 'PATCH',
      body: JSON.stringify({ content: 'done', allowed_mentions: { parse: [] } }),
    }),
  );
});

it('edits embeds into a deferred answer', async () => {
  const fetch = vi.fn(async () => Response.json({}));
  vi.stubGlobal('fetch', fetch);
  const report = bot({
    commands: [
      command({ name: 'report', description: 'Reports late' }, (c) =>
        c.defer(async () => ({
          content: 'Report',
          embeds: [{ title: 'Uptime', description: '99%' }],
        })),
      ),
    ],
  });

  await report.fetch(await signed(slash('report', [])), env, ctx);
  await waitOnExecutionContext(ctx);

  expect(fetch).toHaveBeenCalledWith(
    expect.stringContaining('/messages/@original'),
    expect.objectContaining({
      body: JSON.stringify({
        content: 'Report',
        allowed_mentions: { parse: [] },
        embeds: [{ title: 'Uptime', description: '99%' }],
      }),
    }),
  );
});

it('edits buttons into a deferred answer', async () => {
  const fetch = vi.fn(async () => Response.json({}));
  vi.stubGlobal('fetch', fetch);
  const later = bot({
    commands: [
      command({ name: 'later', description: 'Asks late' }, (c) =>
        c.defer(async () => ({ content: 'Ready?', buttons: [{ id: 'yes', label: 'Yes' }] })),
      ),
    ],
  });

  await later.fetch(await signed(slash('later', [])), env, ctx);
  await waitOnExecutionContext(ctx);

  expect(fetch).toHaveBeenCalledWith(
    expect.stringContaining('/messages/@original'),
    expect.objectContaining({
      body: JSON.stringify({
        content: 'Ready?',
        allowed_mentions: { parse: [] },
        components: [
          { type: 1, components: [{ type: 2, style: 1, label: 'Yes', custom_id: 'yes' }] },
        ],
      }),
    }),
  );
});

it('replies with buttons', async () => {
  const res = await app.fetch(await signed(slash('pick', [])), env, ctx);

  expect(await res.json()).toMatchObject({
    type: 4,
    data: {
      content: 'Yes or no?',
      allowed_mentions: { parse: [] },
      components: [{ type: 1, components: [{ custom_id: 'yes' }, { custom_id: 'no' }] }],
    },
  });
});

it('runs the handler of the clicked button and updates the message', async () => {
  const res = await app.fetch(await signed(click('yes')), env, ctx);

  expect(await res.json()).toEqual({
    type: 7,
    data: { content: 'yu said yes', allowed_mentions: { parse: [] }, components: [] },
  });
});

it('answers 404 for a button without a handler', async () => {
  const res = await app.fetch(await signed(click('no')), env, ctx);

  expect(res.status).toBe(404);
});

it('opens a modal from a command and from a button', async () => {
  const fromCommand = await app.fetch(await signed(slash('ask', [])), env, ctx);
  const fromButton = await app.fetch(await signed(click('open')), env, ctx);

  const expected = { type: 9, data: { custom_id: 'feedback', title: 'Feedback' } };
  expect(await fromCommand.json()).toMatchObject(expected);
  expect(await fromButton.json()).toMatchObject(expected);
});

it('runs the modal handler with what the user typed', async () => {
  const res = await app.fetch(await signed(submit('feedback', 'ship it')), env, ctx);

  expect(await res.json()).toEqual({
    type: 4,
    data: { content: 'thanks: ship it', allowed_mentions: { parse: [] } },
  });
});

it('answers 404 for a modal the bot does not know', async () => {
  const res = await app.fetch(await signed(submit('nope', 'x')), env, ctx);

  expect(res.status).toBe(404);
});

it('runs the cron job for the trigger and posts to the channel with the bot token', async () => {
  const fetch = vi.fn(async () => Response.json({}));
  vi.stubGlobal('fetch', fetch);

  await app.scheduled(createScheduledController({ cron: '0 9 * * *' }), {
    DISCORD_TOKEN: 'secret',
  });

  expect(fetch).toHaveBeenCalledOnce();
  expect(fetch).toHaveBeenCalledWith(
    'https://discord.com/api/v10/channels/42/messages',
    expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({ Authorization: 'Bot secret' }),
      body: JSON.stringify({ content: 'good morning', allowed_mentions: { parse: [] } }),
    }),
  );
});

it('posts embeds and buttons from a cron job', async () => {
  const fetch = vi.fn(async () => Response.json({}));
  vi.stubGlobal('fetch', fetch);
  const daily = bot({
    commands: [],
    cron: {
      '0 9 * * *': (c) =>
        void c.send('42', '', {
          embeds: [{ title: 'Daily report' }],
          buttons: [{ id: 'more', label: 'More' }],
        }),
    },
  });

  await daily.scheduled(createScheduledController({ cron: '0 9 * * *' }), {
    DISCORD_TOKEN: 'secret',
  });

  expect(fetch).toHaveBeenCalledWith(
    'https://discord.com/api/v10/channels/42/messages',
    expect.objectContaining({
      body: JSON.stringify({
        content: '',
        allowed_mentions: { parse: [] },
        embeds: [{ title: 'Daily report' }],
        components: [
          { type: 1, components: [{ type: 2, style: 1, label: 'More', custom_id: 'more' }] },
        ],
      }),
    }),
  );
});

it("hands Discord's refusal back to the cron job as an error", async () => {
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(new Response('Missing Access', { status: 403 }))
    .mockResolvedValueOnce(Response.json({}));
  vi.stubGlobal('fetch', fetch);

  await app.scheduled(createScheduledController({ cron: '0 9 * * *' }), {
    DISCORD_TOKEN: 'secret',
  });

  expect(fetch).toHaveBeenLastCalledWith(
    'https://discord.com/api/v10/channels/42/messages',
    expect.objectContaining({
      body: JSON.stringify({
        content: 'failed: Discord answered 403: Missing Access',
        allowed_mentions: { parse: [] },
      }),
    }),
  );
});

it('does nothing for a trigger without a job', async () => {
  const fetch = vi.fn();
  vi.stubGlobal('fetch', fetch);

  await app.scheduled(createScheduledController({ cron: '*/5 * * * *' }), {
    DISCORD_TOKEN: 'secret',
  });

  expect(fetch).not.toHaveBeenCalled();
});

it('answers an interaction handed over directly, as the gateway does', async () => {
  const res = await app.answer(
    JSON.parse(slash('roll', [{ name: 'dice', type: 4, value: 4 }])),
    ctx,
  );

  expect(await res.json()).toEqual({
    type: 4,
    data: { content: 'roll: 4', allowed_mentions: { parse: [] } },
  });
});

it('starts the gateway on every cron tick when the bot names its binding', async () => {
  const ensure = vi.fn(async () => {});
  const getByName = vi.fn(() => ({ ensure }));
  const withGateway = bot({ commands: [], gateway: 'GATEWAY' });

  await withGateway.scheduled(createScheduledController({ cron: '*/5 * * * *' }), {
    DISCORD_TOKEN: 'secret',
    GATEWAY: { getByName },
  });

  expect(getByName).toHaveBeenCalledWith('main');
  expect(ensure).toHaveBeenCalledOnce();
});

it('starts the gateway when someone opens the Worker URL', async () => {
  const ensure = vi.fn(async () => {});
  const withGateway = bot({ commands: [], gateway: 'GATEWAY' });

  const res = await withGateway.fetch(
    new Request('https://bot.test/'),
    { ...env, GATEWAY: { getByName: () => ({ ensure }) } },
    ctx,
  );

  expect(await res.text()).toBe('gateway started');
  expect(ensure).toHaveBeenCalledOnce();
});

it('reports deferred work that fails and edits the answer so it does not stay on thinking', async () => {
  const fetch = vi.fn(async () => Response.json({}));
  vi.stubGlobal('fetch', fetch);
  const onError = vi.fn();
  const broken = bot({
    commands: [
      command({ name: 'broken', description: 'Fails late' }, (c) =>
        c.defer(async () => {
          throw new Error('boom');
        }),
      ),
    ],
    onError,
  });

  await broken.fetch(await signed(slash('broken', [])), env, ctx);
  await waitOnExecutionContext(ctx);

  expect(onError).toHaveBeenCalledWith(new Error('boom'), '/broken');
  expect(fetch).toHaveBeenCalledWith(
    expect.stringContaining('/messages/@original'),
    expect.objectContaining({
      body: JSON.stringify({ content: 'Something went wrong.', allowed_mentions: { parse: [] } }),
    }),
  );
});

it('reports an edit that Discord refuses', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response('Unknown Webhook', { status: 404 })),
  );
  const onError = vi.fn();
  const late = bot({ commands: [slow], onError });

  await late.fetch(await signed(slash('slow', [])), env, ctx);
  await waitOnExecutionContext(ctx);

  expect(onError).toHaveBeenCalledWith(new Error('Discord answered 404: Unknown Webhook'), '/slow');
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

it('runs the handler named before the colon and passes what follows as the value', async () => {
  const res = await app.fetch(await signed(click('page:2')), env, ctx);

  expect(await res.json()).toMatchObject({
    type: 7,
    data: {
      content: 'page 2',
      allowed_mentions: { parse: [] },
      components: [{ components: [{ custom_id: 'page:3' }] }],
    },
  });
});

it('keeps the value from the first colon on, colons included', async () => {
  const seen: (string | undefined)[] = [];
  const app2 = bot({
    commands: [],
    buttons: {
      edit: (c) => {
        seen.push(c.value);

        return c.update('ok');
      },
    },
  });

  await app2.fetch(await signed(click('edit')), env, ctx);
  await app2.fetch(await signed(click('edit:a:b')), env, ctx);

  expect(seen).toEqual([undefined, 'a:b']);
});

it('replies and defers so only the user who ran the command sees it', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => Response.json({})),
  );
  const quiet = bot({
    commands: [
      command({ name: 'quiet', description: 'Whispers' }, (c) =>
        c.reply('psst', { ephemeral: true }),
      ),
      command({ name: 'quietlater', description: 'Whispers late' }, (c) =>
        c.defer(async () => 'psst', { ephemeral: true }),
      ),
    ],
  });

  const now = await quiet.fetch(await signed(slash('quiet', [])), env, ctx);
  const later = await quiet.fetch(await signed(slash('quietlater', [])), env, ctx);

  expect(await now.json()).toEqual({
    type: 4,
    data: { content: 'psst', allowed_mentions: { parse: [] }, flags: 64 },
  });
  expect(await later.json()).toEqual({ type: 5, data: { flags: 64 } });
});

it('calls the REST API as the bot, typed from the route', async () => {
  const fetch = vi.fn(async () => Response.json({ roles: [], joined_at: '2026-11-05' }));
  vi.stubGlobal('fetch', fetch);

  const [error, member] = await rest.get('/guilds/{guild_id}/members/{user_id}', {
    path: { guild_id: '1', user_id: '2' },
  });

  expect(error).toBeNull();
  expect(member?.roles).toEqual([]);
  expect(fetch).toHaveBeenCalledWith(
    'https://discord.com/api/v10/guilds/1/members/2',
    expect.objectContaining({ headers: { Authorization: 'Bot secret' } }),
  );
});

it('types the routes, methods and arguments of the REST API', () => {
  expectTypeOf(
    rest.put('/guilds/{guild_id}/members/{user_id}/roles/{role_id}', {
      path: { guild_id: '1', user_id: '2', role_id: '3' },
    }),
  ).resolves.toEqualTypeOf<[Error, null] | [null, null]>();

  // @ts-expect-error the route does not exist
  void rest.get('/guilds/{guild_id}/nothing', { path: { guild_id: '1' } });
  // @ts-expect-error the route has no POST
  void rest.post('/guilds/{guild_id}/members/{user_id}', { path: { guild_id: '1', user_id: '2' } });
  // @ts-expect-error user_id is missing
  void rest.get('/guilds/{guild_id}/members/{user_id}', { path: { guild_id: '1' } });
  void rest.post('/channels/{channel_id}/messages', {
    path: { channel_id: '1' },
    // @ts-expect-error content must be a string
    body: { content: 1 },
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

it('suggests values for the option the user is typing in', async () => {
  const onError = vi.fn();
  const fruits = ['apple', 'apricot', 'banana'];
  const shop = bot({
    onError,
    commands: [
      command(
        {
          name: 'buy',
          description: 'Buy fruit',
          options: {
            fruit: option('string', {
              description: 'Fruit',
              autocomplete: (c) => fruits.filter((f) => f.startsWith(c.value)),
            }),
            count: option('integer', {
              description: 'How many',
              autocomplete: () => {
                throw new Error('no stock');
              },
            }),
            note: option('string', { description: 'Note' }),
          },
        },
        (c) => c.reply('ok'),
      ),
    ],
  });
  const typing = (name: string, value: string): Promise<Response> =>
    shop.answer(
      {
        type: 4,
        data: { type: 1, name: 'buy', options: [{ type: 3, name, value, focused: true }] },
      } as unknown as APIInteraction,
      ctx,
    );

  const fruit = await typing('fruit', 'ap');
  const count = await typing('count', '1');
  const note = await typing('note', 'x');

  expect(await fruit.json()).toEqual({
    type: 8,
    data: {
      choices: [
        { name: 'apple', value: 'apple' },
        { name: 'apricot', value: 'apricot' },
      ],
    },
  });
  expect(await count.json()).toEqual({ type: 8, data: { choices: [] } });
  expect(onError).toHaveBeenCalledWith(new Error('no stock'), '/buy autocomplete');
  expect(note.status).toBe(404);
});

it('types autocomplete suggestions and keeps them apart from choices', () => {
  option('integer', { description: 'x', autocomplete: () => [1, { name: 'Two', value: 2 }] });

  // @ts-expect-error an integer option suggests numbers
  option('integer', { description: 'x', autocomplete: () => ['1'] });
  // @ts-expect-error a boolean option has no autocomplete
  option('boolean', { description: 'x', autocomplete: () => [true] });
  // @ts-expect-error choices and autocomplete do not mix
  option('string', { description: 'x', choices: { A: 'a' }, autocomplete: () => ['a'] });
});
