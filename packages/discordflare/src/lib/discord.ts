import type {
  RESTPatchAPIWebhookWithTokenMessageJSONBody,
  RESTPostAPIChannelMessageJSONBody,
  RESTPutAPIApplicationCommandsJSONBody,
} from 'discord-api-types/v10';

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

export async function editOriginal(
  applicationId: string,
  token: string,
  content: string,
): Promise<Error | null> {
  const body: RESTPatchAPIWebhookWithTokenMessageJSONBody = { content };

  const res = await fetch(`${API}/webhooks/${applicationId}/${token}/messages/@original`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) return new Error(`Discord answered ${res.status}: ${await res.text()}`);

  return null;
}

export async function sendMessage(
  token: string,
  channelId: string,
  content: string,
): Promise<Error | null> {
  const body: RESTPostAPIChannelMessageJSONBody = { content };

  const res = await fetch(`${API}/channels/${channelId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bot ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) return new Error(`Discord answered ${res.status}: ${await res.text()}`);

  return null;
}
