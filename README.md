# botflare

[![NPM version](https://img.shields.io/npm/v/botflare?color=f38020&label=)](https://www.npmjs.com/package/botflare)

Build Discord bots that run on Cloudflare Workers, with types from the official Discord API spec.

[👉 Example bot](https://github.com/pyyupsk/botflare/tree/main/examples/basic) · [👉 Discord API spec](https://github.com/discord/discord-api-spec)

botflare is an unofficial library. It is not affiliated with, endorsed by, or sponsored by Discord Inc. or Cloudflare, Inc.

## Features

- Slash commands, subcommands, context menu commands, buttons, select menus, modals and autocomplete
- Option values typed from the options you declare: a `choices` option gives only its values
- The Discord Gateway in a Durable Object, so a bot gets commands and events without a public URL
- `rest` for every Discord route, with path, query, body and result typed from the Discord API spec
- Cron jobs that post to channels, and `onError` for work that runs after Discord has its answer
- Messages ping nobody unless you allow it, even for `@everyone` in the text
- `botflare sync` sends your commands to Discord from the command line

## Install

```sh
npm install botflare
```

## Usage

```ts
import { bot, command, option } from 'botflare';
import { gateway } from 'botflare/gateway';

const roll = command(
  {
    name: 'roll',
    description: 'Roll a die',
    options: { sides: option('integer', { description: 'Sides on the die', min: 2, max: 100 }) },
  },
  (c) => {
    const sides = c.options.sides ?? 6; // number | undefined
    const rolled = 1 + Math.floor(Math.random() * sides);

    return c.reply(`You rolled ${rolled}`, {
      buttons: [{ id: `again:${sides}`, label: 'Roll again', emoji: '🎲' }],
    });
  },
);

const app = bot({
  commands: [roll],
  buttons: {
    again: (c) => c.update(`You rolled ${1 + Math.floor(Math.random() * Number(c.value))}`),
  },
  gateway: 'GATEWAY',
});

export const Gateway = gateway({ intents: ['Guilds'], bot: app, events: {} });

export default app;
```

Bind the `Gateway` class in `wrangler.jsonc`:

```jsonc
{
  "durable_objects": { "bindings": [{ "name": "GATEWAY", "class_name": "Gateway" }] },
  "migrations": [{ "tag": "v1", "new_sqlite_classes": ["Gateway"] }],
}
```

Then run it:

```sh
npx botflare sync src/index.ts # send the commands to Discord
npx wrangler dev                   # open the local URL once to start the gateway
```

`botflare sync` reads `DISCORD_TOKEN`, `DISCORD_APPLICATION_ID` and, for one test server, `DISCORD_GUILD_ID`. The Worker reads `DISCORD_TOKEN`, and `DISCORD_PUBLIC_KEY` for interactions over HTTP.

## API

| Export                                | Use                                                                                       |
| ------------------------------------- | ----------------------------------------------------------------------------------------- |
| `bot(config)`                         | The Worker handler. Checks signatures and answers commands, buttons, menus and modals     |
| `command(config, run)`                | A slash command, or a command with `subcommands`                                          |
| `option(type, config)`                | An option of a command, with `choices`, limits or `autocomplete`                          |
| `contextMenu('user' \| 'message', …)` | An item in the Apps menu of a user or a message                                           |
| `select(type, config, run)`           | A select menu of strings, users, roles, channels or mentionables                          |
| `modal(config, run)`                  | A form in a popup                                                                         |
| `gateway(config)`                     | A Durable Object class that holds the Discord Gateway connection, from `botflare/gateway` |
| `rest`                                | Calls any Discord route as the bot and returns `[error, data]`                            |
| `mention`, `time`                     | Mentions and timestamps for message text                                                  |

A handler answers with one of these:

| Answer                         | What Discord shows                                                                |
| ------------------------------ | --------------------------------------------------------------------------------- |
| `c.reply(text, options)`       | A new message                                                                     |
| `c.defer(work, { ephemeral })` | "Thinking…", then the result of `work`, for work over 3 seconds                   |
| `c.update(text, options)`      | The message of the button or menu, edited                                         |
| `c.deferUpdate(work)`          | The message of the button or menu as it is, then edited with the result of `work` |
| `c.modal(form, value)`         | A form, with `value` back in `c.value`                                            |

Message options are `buttons`, `selects`, `embeds`, `allowedMentions` and `ephemeral`. A command takes `permissions`, `contexts`, `installs` and `locales`. Every config has its description in the editor.

## Gateway events

```ts
export const Gateway = gateway({
  intents: ['Guilds', 'GuildMessages', 'MessageContent'],
  bot: app,
  events: {
    MESSAGE_CREATE: (message, c) => message.content === 'hi' && c.send(message.channel_id, 'hello'),
  },
});
```

Turn on privileged intents, such as `MessageContent`, in the Developer Portal first. If the connection is down, a Durable Object alarm opens it again within a minute.

## REST

```ts
import { rest } from 'botflare';

const [error, member] = await rest.get('/guilds/{guild_id}/members/{user_id}', {
  path: { guild_id, user_id },
});
member?.joined_at; // typed from the Discord API spec
```

On a 429, `rest` waits for `retry_after` and tries again, up to three tries in all.

## Why?

discord.js and discord.py expect a process that stays on, with a WebSocket and a cache in memory. A Worker runs per request and then stops. botflare is built for that model from the start: it answers interactions over HTTP, keeps the gateway connection in a Durable Object, and takes its REST types from the spec that Discord publishes. When Discord adds a route, one script updates the types.

## License

[MIT](https://github.com/pyyupsk/botflare/blob/main/LICENSE) License © 2026 [Pongsakorn Thipayanate](https://github.com/pyyupsk)
