#!/usr/bin/env node
import { registerHooks } from 'node:module';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

import { cancel, intro, outro, spinner } from '@clack/prompts';

import { putCommands } from '#lib/discord';
import { type Command, type ContextMenu, payload } from '#utils/command';
import { syncEnv } from '#utils/env';

const plural = (n: number): string => `${n} command${n === 1 ? '' : 's'}`;

const WORKERS_STUB = `data:text/javascript,${encodeURIComponent(
  [
    'export const env = {};',
    'export const exports = {};',
    'export function waitUntil() {}',
    'export class DurableObject {}',
    'export class WorkerEntrypoint {}',
    'export class WorkflowEntrypoint {}',
    'export class RpcTarget {}',
  ].join('\n'),
)}`;

registerHooks({
  resolve: (specifier, context, next) =>
    specifier.startsWith('cloudflare:')
      ? { url: WORKERS_STUB, shortCircuit: true }
      : next(specifier, context),
});

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

  let mod: { default?: { commands?: (Command | ContextMenu)[] } };
  try {
    mod = await import(pathToFileURL(resolve(entry)).href);
  } catch (error) {
    cancel(`Cannot load ${entry}: ${error instanceof Error ? error.message : String(error)}`);
    return 1;
  }

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
