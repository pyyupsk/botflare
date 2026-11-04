import type {
  GatewayPresenceUpdateData,
  GatewaySendPayload,
  PresenceUpdateStatus,
} from 'discord-api-types/v10';
import { expect, it } from 'vitest';

import { afterClose, type Session, Shard } from './shard';

const presence: GatewayPresenceUpdateData = {
  status: 'idle' as PresenceUpdateStatus.Idle,
  since: null,
  afk: false,
  activities: [{ name: 'Custom Status', type: 4, state: 'testing' }],
};

function setup(session: Session | null = null, withPresence = false) {
  const sent: GatewaySendPayload[] = [];
  const reconnects: boolean[] = [];
  const saved: (Session | null)[] = [];
  let beat: (() => void) | undefined;

  const shard = new Shard('TOKEN', { intents: 513, ...(withPresence && { presence }) }, session, {
    send: (p) => sent.push(p),
    reconnect: (resume) => reconnects.push(resume),
    save: (s) => saved.push(s && { ...s }),
    dispatch: () => {},
    every: (_ms, fn) => {
      beat = fn;
      return () => {};
    },
  });
  const hello = () => shard.handle({ op: 10, d: { heartbeat_interval: 41_250 } } as never);

  return { shard, sent, reconnects, saved, hello, beat: () => beat?.() };
}

it('identifies a new session with the configured intents', () => {
  const { sent, hello } = setup();

  hello();

  expect(sent[0]).toMatchObject({ op: 2, d: { token: 'TOKEN', intents: 513 } });
  expect(sent[0]?.d).not.toHaveProperty('presence');
});

it('sends the presence when the bot sets one', () => {
  const { sent, hello } = setup(null, true);

  hello();

  expect(sent[0]).toMatchObject({ op: 2, d: { presence } });
});

it('resumes a saved session from its last sequence', () => {
  const { sent, hello } = setup({ id: 'abc', url: 'wss://resume', seq: 42 });

  hello();

  expect(sent[0]).toEqual({ op: 6, d: { token: 'TOKEN', session_id: 'abc', seq: 42 } });
});

it('stores the session on READY and advances its sequence on later events', () => {
  const { shard, saved } = setup();

  shard.handle({
    op: 0,
    t: 'READY',
    s: 1,
    d: { session_id: 's1', resume_gateway_url: 'wss://r' },
  } as never);
  shard.handle({ op: 0, t: 'GUILD_CREATE', s: 2, d: {} } as never);

  expect(saved).toEqual([
    { id: 's1', url: 'wss://r', seq: 1 },
    { id: 's1', url: 'wss://r', seq: 2 },
  ]);
});

it('reconnects and resumes when a heartbeat gets no ack before the next one', () => {
  const { shard, sent, reconnects, hello, beat } = setup();

  hello();
  beat();
  expect(sent.at(-1)).toEqual({ op: 1, d: null });

  shard.handle({ op: 11 } as never);
  beat();
  expect(reconnects).toEqual([]);

  beat();
  expect(reconnects).toEqual([true]);
});

it('forgets a session that cannot resume', () => {
  const { shard, reconnects, saved } = setup({ id: 'abc', url: 'wss://r', seq: 9 });

  shard.handle({ op: 9, d: false } as never);

  expect(saved).toEqual([null]);
  expect(reconnects).toEqual([false]);
});

it('sends the presence again after a resume', () => {
  const { shard, sent } = setup({ id: 'abc', url: 'wss://r', seq: 9 }, true);

  shard.handle({ op: 0, t: 'RESUMED', s: 10, d: {} } as never);

  expect(sent).toEqual([{ op: 3, d: presence }]);
});

it('splits close codes into stop, identify and resume', () => {
  expect(afterClose(4004)).toBe('stop');
  expect(afterClose(4014)).toBe('stop');
  expect(afterClose(4009)).toBe('identify');
  expect(afterClose(1006)).toBe('resume');
});
