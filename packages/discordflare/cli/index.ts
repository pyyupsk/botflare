#!/usr/bin/env node
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

import { cancel, intro, outro, spinner } from '@clack/prompts';

import { putCommands } from '#lib/discord';
import { type Command, payload } from '#utils/command';
import { syncEnv } from '#utils/env';

const plural = (n: number): string => `${n} command${n === 1 ? '' : 's'}`;

async function main(): Promise<number> {
  intro('discordflare sync');

  const { positionals } = parseArgs({ allowPositionals: true });
  const [task, entry] = positionals;
  if (task !== 'sync' || !entry) {
    cancel('Usage: discordflare sync <worker entry>');
    return 1;
  }

  const [envError, env] = syncEnv(process.env);
  if (envError) {
    cancel(envError.message);
    return 1;
  }

  const mod = (await import(pathToFileURL(resolve(entry)).href)) as {
    default?: { commands?: Command[] };
  };
  const commands = mod.default?.commands;
  if (!commands) {
    cancel(`${entry} must export default bot({ commands })`);
    return 1;
  }

  const target = env.guildId ? `server ${env.guildId}` : 'every server';
  const progress = spinner();
  progress.start(`Sending ${plural(commands.length)} to ${target}`);

  const [putError, count] = await putCommands(env, commands.map(payload));
  if (putError) {
    progress.error(putError.message);
    return 1;
  }

  progress.stop(`Discord saved ${plural(count)}`);
  outro(`Type / in ${env.guildId ? 'the server' : 'a server with the bot'} to try them.`);

  return 0;
}

process.exitCode = await main();
