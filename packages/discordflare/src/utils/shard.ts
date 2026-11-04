import type {
  GatewayCloseCodes,
  GatewayDispatchEvents,
  GatewayDispatchPayload,
  GatewayOpcodes,
  GatewayPresenceUpdateData,
  GatewayReceivePayload,
  GatewaySendPayload,
} from 'discord-api-types/v10';

export type Session = { id: string; url: string; seq: number | null };

const DISPATCH: GatewayOpcodes.Dispatch = 0;
const HEARTBEAT: GatewayOpcodes.Heartbeat = 1;
const IDENTIFY: GatewayOpcodes.Identify = 2;
const PRESENCE_UPDATE: GatewayOpcodes.PresenceUpdate = 3;
const RESUME: GatewayOpcodes.Resume = 6;
const RECONNECT: GatewayOpcodes.Reconnect = 7;
const INVALID_SESSION: GatewayOpcodes.InvalidSession = 9;
const HELLO: GatewayOpcodes.Hello = 10;
const HEARTBEAT_ACK: GatewayOpcodes.HeartbeatAck = 11;

const READY = 'READY' as GatewayDispatchEvents.Ready;
const RESUMED = 'RESUMED' as GatewayDispatchEvents.Resumed;

const FATAL = new Set<GatewayCloseCodes>([4004, 4010, 4011, 4012, 4013, 4014]);
const FRESH = new Set<GatewayCloseCodes>([4007, 4009]);

export function afterClose(code: number): 'stop' | 'identify' | 'resume' {
  if (FATAL.has(code)) return 'stop';

  return FRESH.has(code) ? 'identify' : 'resume';
}

type Identity = { intents: number; presence?: GatewayPresenceUpdateData };

type Hooks = {
  send: (payload: GatewaySendPayload) => void;
  reconnect: (resume: boolean) => void;
  save: (session: Session | null) => void;
  dispatch: (event: GatewayDispatchPayload) => void;
  every: (ms: number, fn: () => void) => () => void;
};

export class Shard {
  private readonly token: string;
  private readonly identity: Identity;
  private readonly hooks: Hooks;
  private session: Session | null;
  private acked = true;
  private stopBeat: (() => void) | undefined;

  constructor(token: string, identity: Identity, session: Session | null, hooks: Hooks) {
    this.token = token;
    this.identity = identity;
    this.session = session;
    this.hooks = hooks;
  }

  handle(payload: GatewayReceivePayload): void {
    switch (payload.op) {
      case HELLO: {
        this.acked = true;
        this.stopBeat?.();
        this.stopBeat = this.hooks.every(payload.d.heartbeat_interval, () => this.beat());

        if (this.session) {
          this.hooks.send({
            op: RESUME,
            d: { token: this.token, session_id: this.session.id, seq: this.session.seq ?? 0 },
          });
        } else {
          this.identify();
        }
        return;
      }
      case HEARTBEAT_ACK:
        this.acked = true;
        return;
      case HEARTBEAT:
        this.hooks.send({ op: HEARTBEAT, d: this.session?.seq ?? null });
        return;
      case RECONNECT:
        this.hooks.reconnect(true);
        return;
      case INVALID_SESSION:
        if (!payload.d) this.forget();
        this.hooks.reconnect(payload.d);
        return;
      case DISPATCH:
        this.onDispatch(payload);
    }
  }

  stop(): void {
    this.stopBeat?.();
    this.stopBeat = undefined;
  }

  private forget(): void {
    this.session = null;
    this.hooks.save(null);
  }

  private onDispatch(payload: GatewayDispatchPayload): void {
    if (payload.t === READY) {
      this.session = {
        id: payload.d.session_id,
        url: payload.d.resume_gateway_url,
        seq: payload.s,
      };
    } else if (this.session) {
      this.session.seq = payload.s;
    }
    if (this.session) this.hooks.save(this.session);

    if (payload.t === RESUMED && this.identity.presence) {
      this.hooks.send({ op: PRESENCE_UPDATE, d: this.identity.presence });
    }

    this.hooks.dispatch(payload);
  }

  private beat(): void {
    if (!this.acked) {
      this.hooks.reconnect(true);
      return;
    }

    this.acked = false;
    this.hooks.send({ op: HEARTBEAT, d: this.session?.seq ?? null });
  }

  private identify(): void {
    this.hooks.send({
      op: IDENTIFY,
      d: {
        token: this.token,
        intents: this.identity.intents,
        properties: { os: 'cloudflare-workers', browser: 'discordflare', device: 'discordflare' },
        ...(this.identity.presence && { presence: this.identity.presence }),
      },
    });
  }
}
