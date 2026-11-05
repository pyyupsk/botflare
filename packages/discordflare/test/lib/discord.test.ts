import { afterEach, expect, it, vi } from 'vitest';

import { interactionCallback, putCommands, sendMessage } from '#lib/discord';

const env = { token: 'secret', applicationId: '1', guildId: undefined };

afterEach(() => {
  vi.unstubAllGlobals();
});

it('puts the commands for a server and counts what Discord saved', async () => {
  const fetch = vi.fn(async () => Response.json([{ id: '1' }, { id: '2' }]));
  vi.stubGlobal('fetch', fetch);

  const result = await putCommands({ ...env, guildId: '9' }, []);

  expect(result).toEqual([null, 2]);
  expect(fetch).toHaveBeenCalledWith(
    'https://discord.com/api/v10/applications/1/guilds/9/commands',
    expect.objectContaining({
      method: 'PUT',
      headers: expect.objectContaining({ Authorization: 'Bot secret' }),
    }),
  );
});

it("returns Discord's error instead of throwing", async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response('401: Unauthorized', { status: 401 })),
  );

  const [error, count] = await putCommands(env, []);

  expect(count).toBeNull();
  expect(error?.message).toBe('Discord answered 401: 401: Unauthorized');
});

it('posts an interaction response to its callback url', async () => {
  const fetch = vi.fn(async () => new Response(null, { status: 204 }));
  vi.stubGlobal('fetch', fetch);

  const error = await interactionCallback(
    '5',
    'tok',
    Response.json({ type: 4, data: { content: 'hi' } }),
  );

  expect(error).toBeNull();
  expect(fetch).toHaveBeenCalledWith(
    'https://discord.com/api/v10/interactions/5/tok/callback',
    expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ type: 4, data: { content: 'hi' } }),
    }),
  );
});

it('sends files as multipart, without a JSON content type', async () => {
  const fetch = vi.fn(async () => Response.json({}));
  vi.stubGlobal('fetch', fetch);

  await sendMessage('secret', '42', 'here', { files: [{ name: 'a.txt', data: 'hello' }] });

  const [, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
  expect(init.body).toBeInstanceOf(FormData);
  expect(init.headers).toEqual({ Authorization: 'Bot secret' });
  expect(JSON.parse((init.body as FormData).get('payload_json') as string)).toMatchObject({
    content: 'here',
    attachments: [{ id: '0', filename: 'a.txt' }],
  });
});

it('passes the files of an answer on to the interaction callback', async () => {
  const fetch = vi.fn(async () => new Response(null, { status: 204 }));
  vi.stubGlobal('fetch', fetch);
  const form = new FormData();
  form.append('payload_json', JSON.stringify({ type: 4, data: { content: 'hi' } }));
  form.append('files[0]', new Blob(['hello']), 'a.txt');

  await interactionCallback('5', 'tok', new Response(form));

  const [, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
  const sent = init.body as FormData;
  expect(sent.get('payload_json')).toBe('{"type":4,"data":{"content":"hi"}}');
  expect((sent.get('files[0]') as File).name).toBe('a.txt');
});
