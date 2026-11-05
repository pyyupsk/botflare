import { expect, it } from 'vitest';

import { syncEnv } from '#utils/env';

const id = '1509466628683857930';

it('reads the token, application id and optional server id', () => {
  expect(syncEnv({ DISCORD_TOKEN: 't', DISCORD_APPLICATION_ID: id })).toEqual([
    null,
    { token: 't', applicationId: id, guildId: undefined },
  ]);

  expect(
    syncEnv({ DISCORD_TOKEN: 't', DISCORD_APPLICATION_ID: id, DISCORD_GUILD_ID: id })[1],
  ).toEqual({
    token: 't',
    applicationId: id,
    guildId: id,
  });
});

it('names the variable that is missing or wrong', () => {
  expect(syncEnv({ DISCORD_APPLICATION_ID: id })[0]?.message).toContain('DISCORD_TOKEN');
  expect(syncEnv({ DISCORD_TOKEN: 't', DISCORD_APPLICATION_ID: 'abc' })[0]?.message).toContain(
    'DISCORD_APPLICATION_ID',
  );
  expect(
    syncEnv({ DISCORD_TOKEN: 't', DISCORD_APPLICATION_ID: id, DISCORD_GUILD_ID: 'x' })[0]?.message,
  ).toContain('DISCORD_GUILD_ID');
});
