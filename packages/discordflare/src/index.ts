import type {
  APIChatInputApplicationCommandInteraction,
  APIInteraction,
  APIInteractionResponseChannelMessageWithSource,
  APIInteractionResponseDeferredChannelMessageWithSource,
  APIInteractionResponsePong,
  ApplicationCommandType,
  InteractionType,
} from 'discord-api-types/v10';

import { editOriginal } from '#lib/discord';
import type { Command, Context, Option, OptionValue, Options } from '#utils/command';
import { verify } from '#utils/verify';

const PING: InteractionType.Ping = 1;
const APPLICATION_COMMAND: InteractionType.ApplicationCommand = 2;
const CHAT_INPUT: ApplicationCommandType.ChatInput = 1;
const PONG: APIInteractionResponsePong = { type: 1 };
const DEFERRED: APIInteractionResponseDeferredChannelMessageWithSource = { type: 5 };
const PUBLIC_KEY = /^[\da-f]{64}$/i;

/**
 * Declares one option of a slash command. The handler reads its value from `c.options`,
 * typed from `type`, and `undefined` when the option is not `required`.
 *
 * @param type The value type Discord asks the user for.
 * @param config How Discord shows the option.
 * @param config.description The text Discord shows under the option name.
 * @param config.required Whether the user must fill it in. Defaults to `false`.
 * @returns The option, for the `options` of {@link command}.
 * @example
 * option('integer', { description: 'How many dice', required: true });
 */
export function option<const T extends keyof OptionValue, const R extends boolean = false>(
  type: T,
  config: { description: string; required?: R },
): Option<T, R> {
  return { type, description: config.description, required: (config.required ?? false) as R };
}

/**
 * Declares a slash command and the handler that answers it.
 *
 * @param config What Discord shows for the command.
 * @param config.name The name the user types after `/`.
 * @param config.description The text Discord shows under the name.
 * @param config.options The options, keyed by name, made with {@link option}.
 * @param run Answers the command. It gets the interaction, the typed option values, `reply`
 *   for an answer within 3 seconds and `defer` for work that takes longer.
 * @returns The command, for the `commands` of {@link bot}.
 * @example
 * const greet = command(
 *   { name: 'greet', description: 'Say hi', options: { name: option('string', { description: 'Who', required: true }) } },
 *   (c) => c.reply(`hi ${c.options.name}`),
 * );
 */
export function command<const O extends Options = never>(
  config: { name: string; description: string; options?: O },
  run: (c: Context<O>) => Response | Promise<Response>,
): Command<O> {
  return {
    name: config.name,
    description: config.description,
    options: config.options ?? ({} as O),
    run,
  };
}

function reply(content: string): Response {
  const response: APIInteractionResponseChannelMessageWithSource = { type: 4, data: { content } };
  return Response.json(response);
}

/**
 * Creates a Worker handler for the Interactions Endpoint URL of a Discord application.
 * It rejects requests without a valid Ed25519 signature, answers Discord's PING check
 * and runs the matching command. It reads `DISCORD_PUBLIC_KEY` from the Worker environment:
 * the hex public key of your application in the Discord Developer Portal.
 *
 * @param config What the bot answers.
 * @param config.commands The commands, made with {@link command}.
 * @returns The Worker handler. Export it as the default export of your Worker.
 * @example
 * import { bot, command } from 'discordflare';
 *
 * export default bot({ commands: [command({ name: 'ping', description: 'Pong' }, (c) => c.reply('pong'))] });
 */
export function bot(config: { commands: Command[] }): {
  commands: Command[];
  fetch: (
    request: Request,
    env: { DISCORD_PUBLIC_KEY: string },
    ctx: ExecutionContext,
  ) => Promise<Response>;
} {
  const commands = new Map(config.commands.map((c) => [c.name, c]));

  return {
    commands: config.commands,
    async fetch(request, env, ctx) {
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

      if (interaction.type !== APPLICATION_COMMAND || interaction.data.type !== CHAT_INPUT) {
        return new Response(null, { status: 400 });
      }

      const found = commands.get(interaction.data.name);
      if (!found) return new Response(null, { status: 404 });

      const values = Object.fromEntries(
        (interaction.data.options ?? []).map((o) => [o.name, 'value' in o ? o.value : undefined]),
      );

      const defer = (work: () => Promise<string>): Response => {
        const answer = async (): Promise<void> => {
          await editOriginal(interaction.application_id, interaction.token, await work());
        };
        ctx.waitUntil(answer());

        return Response.json(DEFERRED);
      };

      return found.run({
        interaction: interaction as APIChatInputApplicationCommandInteraction,
        options: values,
        reply,
        defer,
      });
    },
  };
}
