import { DurableObject } from 'cloudflare:workers';
import type {
  GatewayDispatchEvents,
  GatewayDispatchPayload,
  GatewayPresenceUpdateData,
  GatewayReceivePayload,
} from 'discord-api-types/v10';

import type { Bot } from '#bot';
import { interactionCallback, type Send, sendMessage } from '#lib/discord';
import type { ErrorHandler } from '#types';
import { type Intent, intentBits } from '#utils/intents';
import { afterClose, type Session, Shard } from '#utils/shard';

const GATEWAY = 'wss://gateway.discord.gg';
const WATCH_MS = 60_000;
const INTERACTION_CREATE = 'INTERACTION_CREATE' as GatewayDispatchEvents.InteractionCreate;

type GatewayConfig = {
  intents: Intent[];
  presence?: GatewayPresenceUpdateData;
  bot?: Pick<Bot, 'answer'>;
  onError?: ErrorHandler;
  events: {
    [P in GatewayDispatchPayload as P['t']]?: (data: P['d'], c: { send: Send }) => unknown;
  };
};

/**
 * Creates a Durable Object class that keeps one connection to the Discord Gateway open and runs your
 * handler for each event. Export it under the `class_name` of a SQLite Durable Object binding in your
 * Wrangler config, and give that binding name to `bot({ gateway })` so a Cron Trigger starts and
 * reconnects it.
 * It reads `DISCORD_TOKEN` from the Worker environment.
 *
 * @param config What the bot listens to.
 * @param config.intents The names of the gateway intents the bot needs, such as `'GuildMessages'`.
 *   Turn on privileged ones, such as `'MessageContent'`, in the Developer Portal first.
 * @param config.presence The status the bot shows while it is connected.
 * @param config.events A handler per dispatch event name. `c.send` posts a message to a channel,
 *   with optional `buttons` and `embeds`.
 * @param config.onError Gets errors from event handlers and from answering interactions.
 * @param config.bot The bot from `bot()`. Its handlers answer the commands, buttons and modals that
 *   arrive over the gateway, so the application needs no Interactions Endpoint URL.
 * @returns The Durable Object class.
 * @example
 * import { bot } from 'discordflare';
 * import { gateway } from 'discordflare/gateway';
 *
 * const app = bot({ commands: [], gateway: 'GATEWAY' });
 *
 * export const Gateway = gateway({
 *   intents: ['Guilds', 'GuildMessages'],
 *   bot: app,
 *   events: { MESSAGE_CREATE: (message, c) => c.send(message.channel_id, 'heard you') },
 * });
 *
 * export default app;
 */
export function gateway(
  config: GatewayConfig,
): new (
  ctx: DurableObjectState,
  env: { DISCORD_TOKEN: string },
) => DurableObject<{ DISCORD_TOKEN: string }> & { ensure(): Promise<void> } {
  return class Gateway extends DurableObject<{ DISCORD_TOKEN: string }> {
    private ws: WebSocket | undefined;
    private shard: Shard | undefined;
    private stopped = false;

    async ensure(): Promise<void> {
      if (!(await this.ctx.storage.getAlarm()))
        await this.ctx.storage.setAlarm(Date.now() + WATCH_MS);

      if (!this.ws && !this.stopped) this.dial();
    }

    override async alarm(): Promise<void> {
      await this.ensure();
    }

    private dial(): void {
      const identity = { intents: intentBits(config.intents), presence: config.presence };
      const stored = this.ctx.storage.kv.get<Session>('session');
      const saved = stored?.intents === identity.intents ? stored : null;

      const ws = new WebSocket(`${saved?.url ?? GATEWAY}/?v=10&encoding=json`);
      const send: Send = (channelId, content, options) =>
        sendMessage(this.env.DISCORD_TOKEN, channelId, content, options);

      const shard = new Shard(this.env.DISCORD_TOKEN, identity, saved, {
        send: (payload) => ws.send(JSON.stringify(payload)),
        reconnect: (resume) => {
          if (this.ws !== ws) return;

          this.drop();
          ws.close(4000);
          this.after(resume ? 'resume' : 'identify');
        },
        save: (session) =>
          session
            ? this.ctx.storage.kv.put('session', session)
            : this.ctx.storage.kv.delete('session'),
        dispatch: (event) => {
          if (event.t === INTERACTION_CREATE && config.bot) {
            const { answer } = config.bot;
            const respond = async (): Promise<void> => {
              try {
                const response = await answer(event.d, this.ctx);
                if (!response.ok) return;

                const failed = await interactionCallback(event.d.id, event.d.token, response);
                if (failed) await config.onError?.(failed, event.t);
              } catch (error) {
                await config.onError?.(error, event.t);
              }
            };
            this.ctx.waitUntil(respond());
          }

          const handler = config.events[event.t] as
            | ((data: unknown, c: { send: typeof send }) => unknown)
            | undefined;
          if (!handler) return;

          const run = async (): Promise<void> => {
            try {
              await handler(event.d, { send });
            } catch (error) {
              await config.onError?.(error, event.t);
            }
          };
          this.ctx.waitUntil(run());
        },
        every: (ms, fn) => {
          let interval: ReturnType<typeof setInterval> | null = null;
          const first = setTimeout(() => {
            fn();
            interval = setInterval(fn, ms);
          }, ms * Math.random());

          return () => {
            clearTimeout(first);
            clearInterval(interval);
          };
        },
      });

      this.ws = ws;
      this.shard = shard;

      ws.addEventListener('message', (event) => {
        if (this.ws === ws) shard.handle(JSON.parse(String(event.data)) as GatewayReceivePayload);
      });
      ws.addEventListener('close', (event) => {
        if (this.ws !== ws) return;

        this.drop();
        this.after(afterClose(event.code));
      });
    }

    private drop(): void {
      this.shard?.stop();
      this.shard = undefined;
      this.ws = undefined;
    }

    private after(next: 'stop' | 'identify' | 'resume'): void {
      if (next === 'stop') {
        this.stopped = true;
        return;
      }

      if (next === 'identify') this.ctx.storage.kv.delete('session');
      setTimeout(() => this.dial(), 1000 + Math.random() * 4000);
    }
  };
}
