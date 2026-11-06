<img src="https://raw.githubusercontent.com/pyyupsk/botflare/main/apps/docs/public/favicon.svg" width="56" height="56" alt="botflare logo" />

# botflare

[![NPM version](https://img.shields.io/npm/v/botflare?color=c6f432&label=npm&logo=npm&logoColor=white)](https://www.npmjs.com/package/botflare)
[![Install size](https://img.shields.io/npm/unpacked-size/botflare?color=c6f432&label=size)](https://www.npmjs.com/package/botflare)
[![CI](https://github.com/pyyupsk/botflare/actions/workflows/ci.yml/badge.svg)](https://github.com/pyyupsk/botflare/actions/workflows/ci.yml)
[![Docs](https://github.com/pyyupsk/botflare/actions/workflows/docs.yml/badge.svg)](https://pyyupsk.github.io/botflare/)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-f38020?logo=cloudflareworkers&logoColor=white)](https://workers.cloudflare.com)
[![Discord API](https://img.shields.io/badge/Discord-API%20spec-5865f2?logo=discord&logoColor=white)](https://github.com/discord/discord-api-spec)
[![License](https://img.shields.io/github/license/pyyupsk/botflare?color=c6f432)](https://github.com/pyyupsk/botflare/blob/main/LICENSE)

Build Discord bots that run on Cloudflare Workers, with types from the official Discord API spec.

[📖 Documentation](https://pyyupsk.github.io/botflare/) · [🚀 Getting started](https://pyyupsk.github.io/botflare/guides/getting-started/) · [🧩 API reference](https://pyyupsk.github.io/botflare/api/) · [🤖 Example bot](https://github.com/pyyupsk/botflare/tree/main/examples/basic) · [📝 Changelog](https://github.com/pyyupsk/botflare/releases)

## Features

- ⚡ Slash commands, subcommands, context menus, buttons, select menus, modals and autocomplete
- 🧠 Option values typed from the options you declare. A `choices` option gives only its values
- 🔌 The Discord Gateway in a Durable Object, so a bot gets events without a public URL
- 🛰️ `rest` for every Discord route, with path, query, body and result typed from the spec
- ⏰ Cron jobs that post to channels
- 🔕 Messages ping nobody unless you allow it, even for `@everyone` in the text
- 🛠️ `botflare sync` sends your commands to Discord from the command line

## Install

```sh
npm install botflare
```

## Usage

```ts
import { bot, command, option } from 'botflare';

const roll = command(
  {
    name: 'roll',
    description: 'Roll a die',
    options: { sides: option('integer', { description: 'Sides on the die', min: 2, max: 100 }) },
  },
  (c) => c.reply(`You rolled ${1 + Math.floor(Math.random() * (c.options.sides ?? 6))}`),
);

export default bot({ commands: [roll] });
```

```sh
npx botflare sync src/index.ts # send the commands to Discord
npx wrangler deploy            # then set the Interactions Endpoint URL to the Worker
```

The guides cover [answers](https://pyyupsk.github.io/botflare/guides/answers/), [components](https://pyyupsk.github.io/botflare/guides/components/), [gateway events](https://pyyupsk.github.io/botflare/guides/gateway-events/) and [REST](https://pyyupsk.github.io/botflare/guides/rest/). They also cover [cron](https://pyyupsk.github.io/botflare/guides/cron/), [deploy](https://pyyupsk.github.io/botflare/guides/deploy/) and a bot without a public URL.

## Why?

discord.js and discord.py expect a process that stays on, with a WebSocket and a cache in memory. A Worker runs per request and then stops. botflare answers interactions over HTTP, keeps the gateway connection in a Durable Object, and takes its REST types from the spec that Discord publishes.

botflare is an unofficial library. It is not affiliated with, endorsed by, or sponsored by Discord Inc. or Cloudflare, Inc.

## License

[MIT](https://github.com/pyyupsk/botflare/blob/main/LICENSE) License © 2026 [Pongsakorn Thipayanate](https://github.com/pyyupsk)
