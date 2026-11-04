import { DurableObject } from 'cloudflare:workers';
import type {
  GatewayDispatchEvents,
  GatewayDispatchPayload,
  GatewayPresenceUpdateData,
  GatewayReceivePayload,
} from 'discord-api-types/v10';

import type { bot } from '#index';
import { interactionCallback, sendMessage } from '#lib/discord';
import { afterClose, type Session, Shard } from '#utils/shard';

const GATEWAY = 'wss://gateway.discord.gg';
const WATCH_MS = 60_000;
const INTERACTION_CREATE = 'INTERACTION_CREATE' as GatewayDispatchEvents.InteractionCreate;

/**
 * Creates a Durable Object class that keeps one connection to the Discord Gateway open and runs your
 * handler for each event. Export it under the `class_name` of a SQLite Durable Object binding in your
 * Wrangler config, then call `ensure()` on it from a Cron Trigger so it starts and reconnects.
 * It reads `DISCORD_TOKEN` from the Worker environment.
 *
 * @param config What the bot listens to.
 * @param config.intents The gateway intents, a sum of `GatewayIntentBits` values.
 * @param config.presence The status the bot shows while it is connected.
 * @param config.events A handler per dispatch event name. `c.send` posts a message to a channel.
 * @param config.bot The bot from {@link bot}. Its handlers answer the commands, buttons and modals that
 *   arrive over the gateway, so the application needs no Interactions Endpoint URL.
 * @returns The Durable Object class.
 * @example
 * import { gateway } from 'discordflare/gateway';
 *
 * export const Gateway = gateway({
 *   intents: 1 << 9,
 *   events: { MESSAGE_CREATE: (message, c) => c.send(message.channel_id, 'heard you') },
 * });
 *
 * export default {
 *   async scheduled(_controller, env) {
 *     await env.GATEWAY.getByName('main').ensure();
 *   },
 * };
 */
export function gateway(config: {
  intents: number;
  presence?: GatewayPresenceUpdateData;
  bot?: Pick<ReturnType<typeof bot>, 'answer'>;
  events: {
    [P in GatewayDispatchPayload as P['t']]?: (
      data: P['d'],
      c: { send: (channelId: string, content: string) => Promise<Error | null> },
    ) => unknown;
  };
}): new (
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
      const saved = this.ctx.storage.kv.get<Session>('session') ?? null;
      const ws = new WebSocket(`${saved?.url ?? GATEWAY}/?v=10&encoding=json`);
      const send = (channelId: string, content: string): Promise<Error | null> =>
        sendMessage(this.env.DISCORD_TOKEN, channelId, content);

      const shard = new Shard(this.env.DISCORD_TOKEN, config, saved, {
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
              const response = await answer(event.d, this.ctx);
              if (response.ok) await interactionCallback(event.d.id, event.d.token, response);
            };
            this.ctx.waitUntil(respond());
          }

          const handler = config.events[event.t] as
            | ((data: unknown, c: { send: typeof send }) => unknown)
            | undefined;
          this.ctx.waitUntil(Promise.resolve(handler?.(event.d, { send })));
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
