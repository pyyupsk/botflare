import type {
  APIChatInputApplicationCommandInteraction,
  APIInteraction,
  APIInteractionResponseChannelMessageWithSource,
  APIInteractionResponseDeferredChannelMessageWithSource,
  APIInteractionResponsePong,
  APIInteractionResponseUpdateMessage,
  APIMessageComponentButtonInteraction,
  APIModalInteractionResponse,
  ApplicationCommandType,
  ComponentType,
  InteractionType,
} from 'discord-api-types/v10';

import { editOriginal, sendMessage } from '#lib/discord';
import type { Command, Context, Option, OptionValue, Options } from '#utils/command';
import { type Button, message } from '#utils/message';
import { type Fields, type Modal, fieldValues, modalData } from '#utils/modal';
import { verify } from '#utils/verify';

const PING: InteractionType.Ping = 1;
const APPLICATION_COMMAND: InteractionType.ApplicationCommand = 2;
const MESSAGE_COMPONENT: InteractionType.MessageComponent = 3;
const MODAL_SUBMIT: InteractionType.ModalSubmit = 5;
const CHAT_INPUT: ApplicationCommandType.ChatInput = 1;
const BUTTON: ComponentType.Button = 2;
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

/**
 * Declares a modal: a form Discord shows in a popup. Open it with `c.modal()` from a command or a
 * button, and add it to the `modals` of {@link bot} so the bot gets what the user typed.
 *
 * @param config What Discord shows in the popup.
 * @param config.id The id Discord sends back when the user submits the form.
 * @param config.title The title of the popup.
 * @param config.fields The text fields, keyed by name. A field is required unless `required` is `false`.
 * @param run Answers the submitted form. `c.fields` holds the text of each field, keyed by name.
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
  const response: APIModalInteractionResponse = { type: 9, data: modalData(form) };

  return Response.json(response);
}

function reply(content: string, buttons?: Button[]): Response {
  const response: APIInteractionResponseChannelMessageWithSource = {
    type: 4,
    data: message(content, buttons),
  };

  return Response.json(response);
}

function update(content: string, buttons?: Button[]): Response {
  const response: APIInteractionResponseUpdateMessage = {
    type: 7,
    data: message(content, buttons),
  };

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
 * @param config.modals The modals the bot answers, made with {@link modal}.
 * @param config.gateway The name of the Durable Object binding that holds the class from `gateway()`.
 *   Every Cron Trigger then starts the gateway connection or reconnects it.
 * @param config.cron Runs on a Cron Trigger, keyed by the cron expression from your Wrangler config.
 *   `c.send` posts a message to a channel with `DISCORD_TOKEN` and returns an `Error` if Discord refuses.
 * @param config.buttons Answers a click, keyed by the button id given to `reply`. `update` edits the
 *   message that holds the button. Pass `[]` as its buttons to remove them.
 * @returns The Worker handler. Export it as the default export of your Worker. Pass it to
 *   `gateway({ bot })` to answer interactions that arrive over the gateway too.
 * @example
 * import { bot, command } from 'discordflare';
 *
 * export default bot({ commands: [command({ name: 'ping', description: 'Pong' }, (c) => c.reply('pong'))] });
 */
export function bot(config: {
  commands: Command[];
  buttons?: Record<
    string,
    (c: {
      interaction: APIMessageComponentButtonInteraction;
      reply: typeof reply;
      update: typeof update;
      modal: typeof showModal;
    }) => Response | Promise<Response>
  >;
  modals?: Modal[];
  gateway?: string;
  cron?: Record<
    string,
    (c: {
      controller: ScheduledController;
      send: (channelId: string, content: string) => Promise<Error | null>;
    }) => void | Promise<void>
  >;
}): {
  commands: Command[];
  fetch: (
    request: Request,
    env: { DISCORD_PUBLIC_KEY: string },
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
} {
  const commands = new Map(config.commands.map((c) => [c.name, c]));
  const modals = new Map((config.modals ?? []).map((m) => [m.id, m]));

  const answer = async (
    interaction: APIInteraction,
    ctx: Pick<ExecutionContext, 'waitUntil'>,
  ): Promise<Response> => {
    if (interaction.type === MESSAGE_COMPONENT && interaction.data.component_type === BUTTON) {
      const clicked = config.buttons?.[interaction.data.custom_id];
      if (!clicked) return new Response(null, { status: 404 });

      return clicked({
        interaction: interaction as APIMessageComponentButtonInteraction,
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

    if (interaction.type !== APPLICATION_COMMAND || interaction.data.type !== CHAT_INPUT) {
      return new Response(null, { status: 400 });
    }

    const found = commands.get(interaction.data.name);
    if (!found) return new Response(null, { status: 404 });

    const values = Object.fromEntries(
      (interaction.data.options ?? []).map((o) => [o.name, 'value' in o ? o.value : undefined]),
    );

    const defer = (work: () => Promise<string>): Response => {
      const finish = async (): Promise<void> => {
        await editOriginal(interaction.application_id, interaction.token, await work());
      };
      ctx.waitUntil(finish());

      return Response.json(DEFERRED);
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
      if (config.gateway) {
        const namespace = env[config.gateway] as DurableObjectNamespace;
        const stub = namespace.getByName('main') as unknown as { ensure(): Promise<void> };
        await stub.ensure();
      }

      const job = config.cron?.[controller.cron];
      if (!job) return;

      await job({
        controller,
        send: (channelId, content) => sendMessage(env.DISCORD_TOKEN, channelId, content),
      });
    },
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

      return answer(interaction, ctx);
    },
  };
}
