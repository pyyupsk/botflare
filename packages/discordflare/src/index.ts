import type {
  APIInteraction,
  APIInteractionResponsePong,
  InteractionType,
} from 'discord-api-types/v10';

import { verify } from '#utils/verify';

const PING: InteractionType.Ping = 1;
const PONG: APIInteractionResponsePong = { type: 1 };
const PUBLIC_KEY = /^[\da-f]{64}$/i;

export type Env = { DISCORD_PUBLIC_KEY: string };

export type Bot = {
  fetch: (request: Request, env: Env) => Promise<Response>;
};

export function bot(): Bot {
  return {
    async fetch(request, env) {
      if (request.method !== 'POST') return new Response(null, { status: 405 });
      if (!PUBLIC_KEY.test(env.DISCORD_PUBLIC_KEY)) {
        return new Response(
          'DISCORD_PUBLIC_KEY must be the 64 hex characters from the Developer Portal',
          { status: 500 },
        );
      }
      const signature = request.headers.get('X-Signature-Ed25519');
      const timestamp = request.headers.get('X-Signature-Timestamp');
      const body = await request.text();
      const valid =
        signature !== null &&
        timestamp !== null &&
        (await verify(env.DISCORD_PUBLIC_KEY, signature, timestamp, body));
      if (!valid) return new Response('invalid request signature', { status: 401 });

      const interaction = JSON.parse(body) as APIInteraction;
      if (interaction.type === PING) return Response.json(PONG);
      return new Response(null, { status: 400 });
    },
  };
}
