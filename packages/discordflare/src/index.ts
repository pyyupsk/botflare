import type {
  APIChatInputApplicationCommandInteraction,
  APIInteraction,
  APIInteractionResponseChannelMessageWithSource,
  APIInteractionResponsePong,
  ApplicationCommandType,
  InteractionType,
} from 'discord-api-types/v10';

import { verify } from '#utils/verify';

const PING: InteractionType.Ping = 1;
const APPLICATION_COMMAND: InteractionType.ApplicationCommand = 2;
const CHAT_INPUT: ApplicationCommandType.ChatInput = 1;
const PONG: APIInteractionResponsePong = { type: 1 };
const PUBLIC_KEY = /^[\da-f]{64}$/i;

type OptionValue = { string: string; integer: number; number: number; boolean: boolean };

type Option<T extends keyof OptionValue = keyof OptionValue, R extends boolean = boolean> = {
  type: T;
  description: string;
  required: R;
};

type Options = Record<string, Option>;

type Values<O extends Options> = {
  [K in keyof O]: O[K] extends Option<infer T, true>
    ? OptionValue[T]
    : OptionValue[O[K]['type']] | undefined;
};

type Context<O extends Options> = {
  interaction: APIChatInputApplicationCommandInteraction;
  options: Values<O>;
  reply: (content: string) => Response;
};

type Command<O extends Options = Options> = {
  name: string;
  description: string;
  options: O;
  run(c: Context<O>): Response | Promise<Response>;
};

/**
 * Bindings the bot reads from the Worker environment.
 * `DISCORD_PUBLIC_KEY` is the hex public key from your application in the Discord Developer Portal.
 */
export type Env = { DISCORD_PUBLIC_KEY: string };

/** A Worker handler that answers Discord interactions. Export it as the default export of your Worker. */
export type Bot = {
  fetch: (request: Request, env: Env) => Promise<Response>;
};

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
 * @param run Answers the command. It gets the interaction, the typed option values and `reply`.
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
 * and runs the matching command.
 *
 * @param config What the bot answers.
 * @param config.commands The commands, made with {@link command}.
 * @returns The Worker handler.
 * @example
 * import { bot, command } from 'discordflare';
 *
 * export default bot({ commands: [command({ name: 'ping', description: 'Pong' }, (c) => c.reply('pong'))] });
 */
export function bot(config: { commands: Command[] }): Bot {
  const commands = new Map(config.commands.map((c) => [c.name, c]));

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

      if (interaction.type !== APPLICATION_COMMAND || interaction.data.type !== CHAT_INPUT) {
        return new Response(null, { status: 400 });
      }

      const found = commands.get(interaction.data.name);
      if (!found) return new Response(null, { status: 404 });

      const values = Object.fromEntries(
        (interaction.data.options ?? []).map((o) => [o.name, 'value' in o ? o.value : undefined]),
      );

      return found.run({
        interaction: interaction as APIChatInputApplicationCommandInteraction,
        options: values,
        reply,
      });
    },
  };
}
