import {
  createExecutionContext,
  createScheduledController,
  waitOnExecutionContext,
} from 'cloudflare:test';
import { afterEach, beforeAll, expect, expectTypeOf, it, vi } from 'vitest';

import { bot, command, modal, option } from './index';

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
  c.reply('Yes or no?', [
    { id: 'yes', label: 'Yes' },
    { id: 'no', label: 'No' },
  ]),
);

const feedback = modal(
  { id: 'feedback', title: 'Feedback', fields: { text: { label: 'Your idea' } } },
  (c) => {
    expectTypeOf(c.fields.text).toEqualTypeOf<string>();
    // @ts-expect-error
    void c.fields.missing;

    return c.reply(`thanks: ${c.fields.text}`);
  },
);

const ask = command({ name: 'ask', description: 'Ask for feedback' }, (c) => c.modal(feedback));

const app = bot({
  commands: [roll, hello, slow, pick, ask],
  buttons: {
    yes: (c) => c.update(`${c.interaction.member?.user.username} said yes`, []),
    open: (c) => c.modal(feedback),
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

  expect(await res.json()).toEqual({ type: 4, data: { content: 'attack: 3' } });
});

it('leaves an optional option undefined when the user skips it', async () => {
  const res = await app.fetch(
    await signed(slash('roll', [{ name: 'dice', type: 4, value: 2 }])),
    env,
    ctx,
  );

  expect(await res.json()).toEqual({ type: 4, data: { content: 'roll: 2' } });
});

it('answers 404 for a command the bot does not know', async () => {
  const res = await app.fetch(await signed(slash('nope', [])), env, ctx);

  expect(res.status).toBe(404);
});

it('runs a command that has no options', async () => {
  const res = await app.fetch(await signed(slash('hello', [])), env, ctx);

  expect(await res.json()).toEqual({ type: 4, data: { content: 'hello' } });
});

it('defers a slow command and edits the answer in when the work is done', async () => {
  const fetch = vi.fn(async () => Response.json({}));
  vi.stubGlobal('fetch', fetch);

  const res = await app.fetch(await signed(slash('slow', [])), env, ctx);
  await waitOnExecutionContext(ctx);

  expect(await res.json()).toEqual({ type: 5 });
  expect(fetch).toHaveBeenCalledWith(
    'https://discord.com/api/v10/webhooks/7/interaction-token/messages/@original',
    expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ content: 'done' }) }),
  );
});

it('replies with buttons', async () => {
  const res = await app.fetch(await signed(slash('pick', [])), env, ctx);

  expect(await res.json()).toMatchObject({
    type: 4,
    data: {
      content: 'Yes or no?',
      components: [{ type: 1, components: [{ custom_id: 'yes' }, { custom_id: 'no' }] }],
    },
  });
});

it('runs the handler of the clicked button and updates the message', async () => {
  const res = await app.fetch(await signed(click('yes')), env, ctx);

  expect(await res.json()).toEqual({ type: 7, data: { content: 'yu said yes', components: [] } });
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

  expect(await res.json()).toEqual({ type: 4, data: { content: 'thanks: ship it' } });
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
      body: JSON.stringify({ content: 'good morning' }),
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
      body: JSON.stringify({ content: 'failed: Discord answered 403: Missing Access' }),
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

  expect(await res.json()).toEqual({ type: 4, data: { content: 'roll: 4' } });
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
    expect.objectContaining({ body: JSON.stringify({ content: 'Something went wrong.' }) }),
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
