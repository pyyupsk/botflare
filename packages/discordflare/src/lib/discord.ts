import type {
  RESTPatchAPIWebhookWithTokenMessageJSONBody,
  RESTPutAPIApplicationCommandsJSONBody,
} from 'discord-api-types/v10';

import { callDiscord } from '#lib/rest';
import type { SyncEnv } from '#utils/env';

export async function putCommands(
  env: SyncEnv,
  body: RESTPutAPIApplicationCommandsJSONBody,
): Promise<[Error, null] | [null, number]> {
  const route = env.guildId
    ? '/applications/{application_id}/guilds/{guild_id}/commands'
    : '/applications/{application_id}/commands';
  const path = { application_id: env.applicationId, guild_id: env.guildId ?? '' };

  const [error, saved] = await callDiscord<unknown[]>(env.token, 'put', route, { path, body });
  if (error) return [error, null];

  return [null, saved.length];
}

export async function editOriginal(
  applicationId: string,
  token: string,
  body: RESTPatchAPIWebhookWithTokenMessageJSONBody,
): Promise<Error | null> {
  const [error] = await callDiscord(
    null,
    'patch',
    '/webhooks/{webhook_id}/{webhook_token}/messages/@original',
    {
      path: { webhook_id: applicationId, webhook_token: token },
      body,
    },
  );

  return error;
}

export type Send = (channelId: string, content: string) => Promise<Error | null>;

export async function sendMessage(
  token: string,
  channelId: string,
  content: string,
): Promise<Error | null> {
  const [error] = await callDiscord(token, 'post', '/channels/{channel_id}/messages', {
    path: { channel_id: channelId },
    body: { content },
  });

  return error;
}

export async function interactionCallback(
  id: string,
  token: string,
  response: Response,
): Promise<Error | null> {
  const [error] = await callDiscord(
    null,
    'post',
    '/interactions/{interaction_id}/{interaction_token}/callback',
    {
      path: { interaction_id: id, interaction_token: token },
      body: await response.json(),
    },
  );

  return error;
}
