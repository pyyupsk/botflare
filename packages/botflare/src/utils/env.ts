export type SyncEnv = { token: string; applicationId: string; guildId: string | undefined };

const SNOWFLAKE = /^\d{17,20}$/;

export function syncEnv(vars: Record<string, string | undefined>): [Error, null] | [null, SyncEnv] {
  const token = vars.DISCORD_TOKEN;
  const applicationId = vars.DISCORD_APPLICATION_ID;
  const guildId = vars.DISCORD_GUILD_ID || undefined;

  if (!token) return [new Error('DISCORD_TOKEN is missing'), null];
  if (!applicationId || !SNOWFLAKE.test(applicationId)) {
    return [
      new Error('DISCORD_APPLICATION_ID must be the application id from the Developer Portal'),
      null,
    ];
  }
  if (guildId && !SNOWFLAKE.test(guildId)) {
    return [new Error('DISCORD_GUILD_ID must be a server id'), null];
  }

  return [null, { token, applicationId, guildId }];
}
