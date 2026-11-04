import type { RESTPutAPIApplicationCommandsJSONBody } from 'discord-api-types/v10';

import type { SyncEnv } from '#utils/env';

const API = 'https://discord.com/api/v10';

export async function putCommands(
  env: SyncEnv,
  body: RESTPutAPIApplicationCommandsJSONBody,
): Promise<[Error, null] | [null, number]> {
  const scope = env.guildId ? `/guilds/${env.guildId}` : '';
  const url = `${API}/applications/${env.applicationId}${scope}/commands`;

  const res = await fetch(url, {
    method: 'PUT',
    headers: { Authorization: `Bot ${env.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) return [new Error(`Discord answered ${res.status}: ${await res.text()}`), null];

  const saved = (await res.json()) as unknown[];

  return [null, saved.length];
}
