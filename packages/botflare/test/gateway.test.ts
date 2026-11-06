import type { GatewayMessageCreateDispatchData } from 'discord-api-types/v10';
import { expectTypeOf, it } from 'vitest';

import { type Close, gateway } from '#gateway';

it('types each event handler from the event name', () => {
  gateway({
    intents: ['GuildMessages'],
    events: {
      MESSAGE_CREATE: (message, c) => {
        expectTypeOf(message).toEqualTypeOf<GatewayMessageCreateDispatchData>();
        expectTypeOf(c.storage).toEqualTypeOf<DurableObjectStorage>();
      },
      // @ts-expect-error
      NOT_AN_EVENT: () => {},
    },
  });
});

it('hands onClose the close code and what happens next', () => {
  gateway({
    intents: ['Guilds'],
    events: {},
    onClose: (close) => {
      expectTypeOf(close).toEqualTypeOf<Close>();
      expectTypeOf(close.next).toEqualTypeOf<'resume' | 'identify' | 'stop'>();
    },
  });
});

it('accepts only current intent names', () => {
  gateway({
    // @ts-expect-error
    intents: ['NotAnIntent'],
    events: {},
  });

  gateway({
    // @ts-expect-error
    intents: ['GuildBans'],
    events: {},
  });
});
