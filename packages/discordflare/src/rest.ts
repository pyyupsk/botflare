import { env as workerEnv } from 'cloudflare:workers';

import { createRest, type Rest } from '#lib/rest';

/**
 * Calls the Discord REST API as the bot, with `DISCORD_TOKEN` from the Worker environment. Each
 * method takes a route from the Discord API spec, such as `'/guilds/{guild_id}/roles'`, and
 * types its `path`, `query`, `body` and result from that route. It returns `[error, data]` and
 * does not throw. When Discord answers 429, it waits for `retry_after` and tries again, up to
 * three tries in all.
 *
 * A request that is not a GET takes `reason`, the text that shows in the audit log of the server.
 *
 * @example
 * import { rest } from 'discordflare';
 *
 * const [error, member] = await rest.get('/guilds/{guild_id}/members/{user_id}', {
 *   path: { guild_id: guildId, user_id: userId },
 * });
 * if (!error) await rest.put('/guilds/{guild_id}/members/{user_id}/roles/{role_id}', {
 *   path: { guild_id: guildId, user_id: member.user.id, role_id: roleId },
 * });
 */
export const rest: Rest = createRest(
  () => (workerEnv as { DISCORD_TOKEN?: unknown }).DISCORD_TOKEN,
);
