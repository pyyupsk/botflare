import type {
  APIChatInputApplicationCommandInteraction,
  APIContextMenuInteraction,
  APIInteraction,
  APIMessageComponentButtonInteraction,
  APIMessageComponentSelectMenuInteraction,
  ApplicationCommandType,
  ComponentType,
  InteractionType,
} from 'discord-api-types/v10';

import { answerAutocomplete } from '#answers/autocomplete';
import { answerButton } from '#answers/button';
import { answerCommand } from '#answers/command';
import { answerMenu } from '#answers/menu';
import { answerModal } from '#answers/modal';
import { answerSelect } from '#answers/select';
import { type Send, sendMessage } from '#lib/discord';
import type { ButtonContext, ErrorHandler, Select } from '#types';
import type { Command, ContextMenu } from '#utils/command';
import type { Modal } from '#utils/modal';
import { PONG } from '#utils/response';
import type { SelectType } from '#utils/select';
import { verify } from '#utils/verify';

const PING: InteractionType.Ping = 1;
const APPLICATION_COMMAND: InteractionType.ApplicationCommand = 2;
const MESSAGE_COMPONENT: InteractionType.MessageComponent = 3;
const AUTOCOMPLETE: InteractionType.ApplicationCommandAutocomplete = 4;
const MODAL_SUBMIT: InteractionType.ModalSubmit = 5;
const CHAT_INPUT: ApplicationCommandType.ChatInput = 1;
const USER_MENU: ApplicationCommandType.User = 2;
const MESSAGE_MENU: ApplicationCommandType.Message = 3;
const BUTTON: ComponentType.Button = 2;
const PUBLIC_KEY = /^[\da-f]{64}$/i;

type CronContext = { controller: ScheduledController; send: Send };

type BotConfig = {
  commands: (Command | ContextMenu)[];
  buttons?: Record<string, (c: ButtonContext) => Response | Promise<Response>>;
  selects?: Select<SelectType, unknown>[];
  modals?: Modal[];
  gateway?: string;
  onError?: ErrorHandler;
  cron?: Record<string, (c: CronContext) => void | Promise<void>>;
};

/** The Worker handler from {@link bot}. */
export type Bot = {
  commands: (Command | ContextMenu)[];
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
 * @param config.commands The commands, made with {@link command} or `contextMenu()`.
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
 *   A button takes a `label`, an `emoji` or both, and a `style`: `primary` (default), `secondary`,
 *   `success` or `danger`. A button with a `url` instead of an `id` opens the link and needs no
 *   handler. `disabled: true` greys a button out. `c.deferUpdate(work)` keeps the message as it is
 *   and edits it with what `work` returns, for a click that takes longer than 3 seconds.
 * @param config.selects The select menus the bot answers, made with `select()`.
 * @returns The Worker handler. Export it as the default export of your Worker. Pass it to
 *   `gateway({ bot })` to answer interactions that arrive over the gateway too.
 * @example
 * import { bot, command } from 'discordflare';
 *
 * export default bot({ commands: [command({ name: 'ping', description: 'Pong' }, (c) => c.reply('pong'))] });
 */
export function bot(config: BotConfig): Bot {
  const commands = new Map<string, Command>();
  const menus = new Map<string, ContextMenu>();
  for (const c of config.commands) {
    if ('menu' in c) menus.set(`${c.menu}:${c.name}`, c);
    else commands.set(c.name, c);
  }
  const modals = new Map((config.modals ?? []).map((m) => [m.id, m]));
  const selects = new Map((config.selects ?? []).map((s) => [s.id, s]));

  const answer = async (
    interaction: APIInteraction,
    ctx: Pick<ExecutionContext, 'waitUntil'>,
  ): Promise<Response> => {
    if (interaction.type === MESSAGE_COMPONENT && interaction.data.component_type !== BUTTON) {
      return answerSelect(
        interaction as APIMessageComponentSelectMenuInteraction,
        selects,
        ctx,
        config.onError,
      );
    }
    if (interaction.type === MESSAGE_COMPONENT && interaction.data.component_type === BUTTON) {
      return answerButton(
        interaction as APIMessageComponentButtonInteraction,
        config.buttons,
        ctx,
        config.onError,
      );
    }
    if (interaction.type === MODAL_SUBMIT) return answerModal(interaction, modals);
    if (interaction.type === AUTOCOMPLETE) {
      return answerAutocomplete(interaction, commands, config.onError);
    }
    if (
      interaction.type === APPLICATION_COMMAND &&
      (interaction.data.type === USER_MENU || interaction.data.type === MESSAGE_MENU)
    ) {
      return answerMenu(interaction as APIContextMenuInteraction, menus, ctx, config.onError);
    }
    if (interaction.type === APPLICATION_COMMAND && interaction.data.type === CHAT_INPUT) {
      return answerCommand(
        interaction as APIChatInputApplicationCommandInteraction,
        commands,
        ctx,
        config.onError,
      );
    }

    return new Response(null, { status: 400 });
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
