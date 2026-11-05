import type {
  APIInteractionDataResolvedChannel,
  APIInteractionDataResolvedGuildMember,
  APIRole,
  APIUser,
} from 'discord-api-types/v10';
import { expectTypeOf } from 'vitest';

import { type Bot, bot, command, modal, option } from '#index';
import type { Command } from '#utils/command';

const encoder = new TextEncoder();
const hex = (buffer: ArrayBuffer): string =>
  Array.from(new Uint8Array(buffer), (byte) => byte.toString(16).padStart(2, '0')).join('');

export async function keyPair(): Promise<CryptoKeyPair> {
  const pair = await crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  if (!('privateKey' in pair)) throw new Error('expected an Ed25519 key pair');

  return pair;
}

const pair = await keyPair();
const privateKey = pair.privateKey;
const raw = (await crypto.subtle.exportKey('raw', pair.publicKey)) as ArrayBuffer;

export const env: { DISCORD_PUBLIC_KEY: string } = { DISCORD_PUBLIC_KEY: hex(raw) };

export async function signed(body: string, key: CryptoKey = privateKey): Promise<Request> {
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

export const ping: string = JSON.stringify({ type: 1 });

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

export const slow: Command = command({ name: 'slow', description: 'Answers late' }, (c) =>
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
    expectTypeOf(c.options.user).toEqualTypeOf<
      APIUser & { member?: APIInteractionDataResolvedGuildMember }
    >();
    expectTypeOf(c.options.where).toEqualTypeOf<APIInteractionDataResolvedChannel>();
    expectTypeOf(c.options.role).toEqualTypeOf<APIRole | undefined>();

    return c.reply(
      `${c.options.user.username} in #${c.options.where.name} as ${c.options.role?.name ?? 'nobody'}`,
    );
  },
);

export const app: Bot = bot({
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

export function click(id: string): string {
  return JSON.stringify({
    type: 3,
    application_id: '7',
    token: 'interaction-token',
    member: { user: { username: 'yu' } },
    data: { component_type: 2, custom_id: id },
  });
}

export function submit(id: string, text: string): string {
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

export function slash(
  name: string,
  options: { name: string; type: number; value: unknown }[],
): string {
  return JSON.stringify({
    type: 2,
    application_id: '7',
    token: 'interaction-token',
    data: { type: 1, name, options },
  });
}
