import { createExecutionContext } from 'cloudflare:test';
import { afterEach, expect, it, vi } from 'vitest';

import { bot, command, modal } from '#index';
import { app, click, env, signed, slash, submit } from '#test/fixtures';

let ctx = createExecutionContext();

afterEach(() => {
  ctx = createExecutionContext();
  vi.unstubAllGlobals();
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

it('carries a value from opening the form to the handler', async () => {
  const rename = modal(
    { id: 'rename', title: 'Rename', fields: { text: { label: 'New name' } } },
    (c) => c.reply(`renamed ${c.value} to ${c.fields.text}`),
  );
  const forms = bot({
    commands: [command({ name: 'edit', description: 'Edit' }, (c) => c.modal(rename, 'item-7'))],
    modals: [rename],
  });

  const opened = await forms.fetch(await signed(slash('edit', [])), env, ctx);
  const submitted = await forms.fetch(await signed(submit('rename:item-7', 'Lamp')), env, ctx);

  expect(await opened.json()).toMatchObject({ type: 9, data: { custom_id: 'rename:item-7' } });
  expect(await submitted.json()).toMatchObject({ data: { content: 'renamed item-7 to Lamp' } });
});
