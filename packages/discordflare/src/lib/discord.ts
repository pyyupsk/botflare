import { callDiscord } from '#lib/rest';
import type { Schemas } from '#lib/routes';
import type { SyncEnv } from '#utils/env';

export async function putCommands(
  env: SyncEnv,
  body: Schemas['ApplicationCommandUpdateRequest'][],
): Promise<[Error, null] | [null, number]> {
  const [error, saved] = env.guildId
    ? await callDiscord(
        env.token,
        'put',
        '/applications/{application_id}/guilds/{guild_id}/commands',
        {
          path: { application_id: env.applicationId, guild_id: env.guildId },
          body,
        },
      )
    : await callDiscord(env.token, 'put', '/applications/{application_id}/commands', {
        path: { application_id: env.applicationId },
        body,
      });
  if (error) return [error, null];

  return [null, saved?.length ?? 0];
}

export async function editOriginal(
  applicationId: string,
  token: string,
  body: Schemas['IncomingWebhookUpdateRequestPartial'],
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
      body: JSON.parse(await response.text()) as Schemas['create_interaction_response_body'],
    },
  );

  return error;
}
