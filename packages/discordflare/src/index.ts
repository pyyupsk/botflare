import { env as workerEnv } from 'cloudflare:workers';
import type {
  APIChatInputApplicationCommandInteraction,
  APIInteraction,
  APIMessageComponentButtonInteraction,
  ApplicationCommandType,
  ComponentType,
  InteractionType,
} from 'discord-api-types/v10';

import { editOriginal, type Send, sendMessage } from '#lib/discord';
import { createRest, type Rest } from '#lib/rest';
import type { Schemas } from '#lib/routes';
import {
  type Command,
  type Context,
  type Option,
  type OptionValue,
  type Options,
  type ChannelType,
  type AutocompleteContext,
  findCommand,
  optionValues,
  type Suggestion,
} from '#utils/command';
import { message, type MessageOptions, type ReplyOptions } from '#utils/message';
import { type Fields, type Modal, fieldValues, modalData } from '#utils/modal';
import { verify } from '#utils/verify';

const PING: InteractionType.Ping = 1;
const APPLICATION_COMMAND: InteractionType.ApplicationCommand = 2;
const MESSAGE_COMPONENT: InteractionType.MessageComponent = 3;
const AUTOCOMPLETE: InteractionType.ApplicationCommandAutocomplete = 4;
const MODAL_SUBMIT: InteractionType.ModalSubmit = 5;
const MAX_CHOICES = 25;
const CHAT_INPUT: ApplicationCommandType.ChatInput = 1;
const BUTTON: ComponentType.Button = 2;
const PONG: Schemas['PongInteractionCallbackRequest'] = { type: 1 };
const DEFERRED: Schemas['CreateMessageInteractionCallbackRequest'] = { type: 5 };
const DEFERRED_EPHEMERAL: Schemas['CreateMessageInteractionCallbackRequest'] = {
  type: 5,
  data: { flags: 64 },
};
const PUBLIC_KEY = /^[\da-f]{64}$/i;

/**
 * Gets an error from work that runs after Discord has its answer: the work of `c.defer()`, a gateway
 * event handler, or a request to Discord that failed. `where` names the command, event or step.
 */
export type ErrorHandler = (error: unknown, where: string) => void | Promise<void>;

type OptionLimits<T extends keyof OptionValue> = T extends 'string'
  ? { minLength?: number; maxLength?: number }
  : T extends 'integer' | 'number'
    ? { min?: number; max?: number }
    : T extends 'channel'
      ? { channelTypes?: ChannelType[] }
      : unknown;

type Choice<T extends keyof OptionValue> = T extends 'string'
  ? string
  : T extends 'integer' | 'number'
    ? number
    : never;

/**
 * Declares one option of a slash command. The handler reads its value from `c.options`,
 * typed from `type`, and `undefined` when the option is not `required`.
 *
 * A `string`, `integer` or `number` option also takes `choices`, keyed by the label Discord shows.
 * The user can pick only those, and the handler gets one of their values. A `string` option takes
 * `minLength` and `maxLength`, an `integer` or `number` option takes `min` and `max`, and a
 * `channel` option takes `channelTypes`, such as `['text', 'forum']`.
 *
 * Instead of fixed `choices`, a `string`, `integer` or `number` option can take `autocomplete`: a
 * function that gets what the user has typed so far as `c.value` and returns up to 25 suggestions,
 * as plain values or as `{ name, value }`. If it throws, `onError` gets the error and Discord shows
 * no suggestions.
 *
 * @param type The value type Discord asks the user for. `user`, `channel` and `role` give the full
 *   object Discord sends with the command, not only its id.
 * @param config How Discord shows the option.
 * @param config.description The text Discord shows under the option name.
 * @param config.required Whether the user must fill it in. Defaults to `false`.
 * @returns The option, for the `options` of {@link command}.
 * @example
 * option('integer', { description: 'How many dice', required: true, min: 1, max: 6 });
 * option('string', { description: 'Color', choices: { Red: 'red', Blue: 'blue' } });
 */
export function option<
  const T extends keyof OptionValue,
  const R extends boolean = false,
  const C extends Record<string, Choice<T>> = never,
>(
  type: T,
  config: { description: string; required?: R; choices?: C } & OptionLimits<T> & {
      autocomplete?: [Choice<T>] extends [never]
        ? never
        : [C] extends [never]
          ? (c: AutocompleteContext) => Suggestion<Choice<T>>[] | Promise<Suggestion<Choice<T>>[]>
          : never;
    },
): Option<T, R, [C] extends [never] ? OptionValue[T] : C[keyof C]> {
  const built: Option = { ...config, type, required: config.required ?? false };

  return built as Option<T, R, [C] extends [never] ? OptionValue[T] : C[keyof C]>;
}

/**
 * Declares a slash command and the handler that answers it. To split a command into subcommands,
 * such as `/config get` and `/config set`, pass `subcommands` instead of `options` and `run`: a list
 * of commands made with `command()`. A subcommand that has `subcommands` of its own becomes a group,
 * such as `/config role add`. Discord allows one group level only.
 *
 * @param config What Discord shows for the command.
 * @param config.name The name the user types after `/`.
 * @param config.description The text Discord shows under the name.
 * @param config.options The options, keyed by name, made with {@link option}.
 * @param run Answers the command. It gets the interaction, the typed option values, `reply`
 *   for an answer within 3 seconds and `defer` for work that takes longer. Pass
 *   `{ ephemeral: true }` to either so only the user who ran the command sees the answer, `buttons`
 *   to add buttons and `embeds` to add embeds. The work of `defer` returns the text, or
 *   `{ content, buttons, embeds }`.
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
): Command<O>;
export function command(config: {
  name: string;
  description: string;
  subcommands: Command[];
}): Command;
export function command(
  config: { name: string; description: string; options?: Options; subcommands?: Command[] },
  run?: (c: Context<Options>) => Response | Promise<Response>,
): Command {
  const { name, description, subcommands } = config;
  if (subcommands) return { name, description, subcommands };

  return { name, description, options: config.options ?? {}, run: run as NonNullable<typeof run> };
}

/**
 * Declares a modal: a form Discord shows in a popup. Open it with `c.modal()` from a command or a
 * button, and add it to the `modals` of {@link bot} so the bot gets what the user typed.
 *
 * @param config What Discord shows in the popup.
 * @param config.id The id Discord sends back when the user submits the form.
 * @param config.title The title of the popup.
 * @param config.fields The text fields, keyed by name. A field is required unless `required` is `false`.
 * @param run Answers the submitted form. `c.fields` holds the text of each field, keyed by name.
 *   A field that is not required and left empty is `undefined`.
 * @returns The modal, for `c.modal()` and the `modals` of {@link bot}.
 * @example
 * const feedback = modal(
 *   { id: 'feedback', title: 'Feedback', fields: { text: { label: 'Your idea', style: 'paragraph' } } },
 *   (c) => c.reply(`Thanks: ${c.fields.text}`),
 * );
 */
export function modal<const F extends Fields>(
  config: { id: string; title: string; fields: F },
  run: Modal<F>['run'],
): Modal<F> {
  return { id: config.id, title: config.title, fields: config.fields, run };
}

function showModal(form: Modal): Response {
  const response: Schemas['ModalInteractionCallbackRequest'] = { type: 9, data: modalData(form) };

  return Response.json(response);
}

function reply(content: string, options?: ReplyOptions): Response {
  const response: Schemas['CreateMessageInteractionCallbackRequest'] = {
    type: 4,
    data: message(content, options),
  };

  return Response.json(response);
}

function update(content: string, options?: MessageOptions): Response {
  const response: Schemas['UpdateMessageInteractionCallbackRequest'] = {
    type: 7,
    data: message(content, options),
  };

  return Response.json(response);
}

type ButtonContext = {
  interaction: APIMessageComponentButtonInteraction;
  value: string | undefined;
  reply: typeof reply;
  update: typeof update;
  modal: typeof showModal;
};

type CronContext = { controller: ScheduledController; send: Send };

type BotConfig = {
  commands: Command[];
  buttons?: Record<string, (c: ButtonContext) => Response | Promise<Response>>;
  modals?: Modal[];
  gateway?: string;
  onError?: ErrorHandler;
  cron?: Record<string, (c: CronContext) => void | Promise<void>>;
};

/** The Worker handler from {@link bot}. */
export type Bot = {
  commands: Command[];
  fetch: (
    request: Request,
    env: { DISCORD_PUBLIC_KEY: string } & Record<string, unknown>,
    ctx: ExecutionContext,
  ) => Promise<Response>;
  scheduled: (
    controller: ScheduledController,
    env: { DISCORD_TOKEN: string } & Record<string, unknown>,
  ) => Promise<void>;
  answer: (
    interaction: APIInteraction,
    ctx: Pick<ExecutionContext, 'waitUntil'>,
  ) => Promise<Response>;
};

/**
 * Calls the Discord REST API as the bot, with `DISCORD_TOKEN` from the Worker environment. Each
 * method takes a route from the Discord API spec, such as `'/guilds/{guild_id}/roles'`, and
 * types its `path`, `query`, `body` and result from that route. It returns `[error, data]` and
 * does not throw. When Discord answers 429, it waits for `retry_after` and tries again, up to
 * three tries in all.
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

async function startGateway(env: Record<string, unknown>, name: string): Promise<void> {
  const namespace = env[name] as DurableObjectNamespace;
  const stub = namespace.getByName('main') as unknown as { ensure(): Promise<void> };
  await stub.ensure();
}

/**
 * Creates a Worker handler for the Interactions Endpoint URL of a Discord application.
 * It rejects requests without a valid Ed25519 signature, answers Discord's PING check
 * and runs the matching command. It reads `DISCORD_PUBLIC_KEY` from the Worker environment:
 * the hex public key of your application in the Discord Developer Portal.
 *
 * @param config What the bot answers.
 * @param config.commands The commands, made with {@link command}.
 * @param config.modals The modals the bot answers, made with {@link modal}.
 * @param config.onError Gets errors from deferred work. If that work fails, the bot also edits the
 *   answer to "Something went wrong." so it does not stay on "thinking…".
 * @param config.gateway The name of the Durable Object binding that holds the class from `gateway()`.
 *   Open the Worker URL once after the first deploy to start the connection. A GET request or any
 *   Cron Trigger starts it again if it is down.
 * @param config.cron Runs on a Cron Trigger, keyed by the cron expression from your Wrangler config.
 *   `c.send` posts a message to a channel with `DISCORD_TOKEN`, with optional `buttons` and `embeds`,
 *   and returns an `Error` if Discord refuses.
 * @param config.buttons Answers a click, keyed by the button id given to `reply`. An id such as
 *   `page:2` runs the `page` handler with `c.value` set to `'2'`. `update` edits the message that
 *   holds the button. Pass `{ buttons: [] }` to remove them.
 * @returns The Worker handler. Export it as the default export of your Worker. Pass it to
 *   `gateway({ bot })` to answer interactions that arrive over the gateway too.
 * @example
 * import { bot, command } from 'discordflare';
 *
 * export default bot({ commands: [command({ name: 'ping', description: 'Pong' }, (c) => c.reply('pong'))] });
 */
export function bot(config: BotConfig): Bot {
  const commands = new Map(config.commands.map((c) => [c.name, c]));
  const modals = new Map((config.modals ?? []).map((m) => [m.id, m]));

  const answer = async (
    interaction: APIInteraction,
    ctx: Pick<ExecutionContext, 'waitUntil'>,
  ): Promise<Response> => {
    if (interaction.type === MESSAGE_COMPONENT && interaction.data.component_type === BUTTON) {
      const id = interaction.data.custom_id;
      const colon = id.indexOf(':');
      const name = colon === -1 ? id : id.slice(0, colon);
      const clicked = config.buttons?.[name];
      if (!clicked) return new Response(null, { status: 404 });

      return clicked({
        interaction: interaction as APIMessageComponentButtonInteraction,
        value: colon === -1 ? undefined : id.slice(colon + 1),
        reply,
        update,
        modal: showModal,
      });
    }

    if (interaction.type === MODAL_SUBMIT) {
      const submitted = modals.get(interaction.data.custom_id);
      if (!submitted) return new Response(null, { status: 404 });

      return submitted.run({
        interaction,
        fields: fieldValues(interaction.data.components),
        reply,
      });
    }

    if (interaction.type === AUTOCOMPLETE) {
      const { found, given, path } = findCommand(commands, interaction.data);
      const focused = given.find((o) => 'focused' in o && o.focused);
      const suggest =
        found && 'options' in found && focused
          ? found.options[focused.name]?.autocomplete
          : undefined;
      if (!suggest || !focused || !('value' in focused)) return new Response(null, { status: 404 });

      let suggestions: Suggestion<unknown>[] = [];
      try {
        suggestions = await suggest({ interaction, value: String(focused.value) });
      } catch (error) {
        await config.onError?.(error, `${path} autocomplete`);
      }

      const choices = suggestions
        .slice(0, MAX_CHOICES)
        .map((s) => (typeof s === 'object' && s !== null ? s : { name: String(s), value: s }));
      const response = {
        type: 8,
        data: { choices },
      } as Schemas['ApplicationCommandAutocompleteCallbackRequest'];

      return Response.json(response);
    }

    if (interaction.type !== APPLICATION_COMMAND || interaction.data.type !== CHAT_INPUT) {
      return new Response(null, { status: 400 });
    }

    const { found, given, path: where } = findCommand(commands, interaction.data);
    if (!found || !('run' in found)) return new Response(null, { status: 404 });

    const values = optionValues(given, interaction.data.resolved);

    const defer: Context<Options>['defer'] = (work, options) => {
      const finish = async (): Promise<void> => {
        let edit = message('Something went wrong.');
        try {
          const done = await work();
          edit =
            typeof done === 'string'
              ? message(done)
              : message(done.content, { buttons: done.buttons, embeds: done.embeds });
        } catch (error) {
          await config.onError?.(error, where);
        }

        const failed = await editOriginal(interaction.application_id, interaction.token, edit);
        if (failed) await config.onError?.(failed, where);
      };
      ctx.waitUntil(finish());

      return Response.json(options?.ephemeral ? DEFERRED_EPHEMERAL : DEFERRED);
    };

    return found.run({
      interaction: interaction as APIChatInputApplicationCommandInteraction,
      options: values,
      reply,
      defer,
      modal: showModal,
    });
  };

  return {
    commands: config.commands,
    answer,
    async scheduled(controller, env) {
      if (config.gateway) await startGateway(env, config.gateway);

      const job = config.cron?.[controller.cron];
      if (!job) return;

      await job({
        controller,
        send: (channelId, content, options) =>
          sendMessage(env.DISCORD_TOKEN, channelId, content, options),
      });
    },
    async fetch(request, env, ctx) {
      if (request.method === 'GET' && config.gateway) {
        await startGateway(env, config.gateway);
        return new Response('gateway started');
      }

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

      return answer(interaction, ctx);
    },
  };
}
