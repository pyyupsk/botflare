import type { GatewayMessageCreateDispatchData } from 'discord-api-types/v10';
import { expectTypeOf, it } from 'vitest';

import { gateway } from '#gateway';

it('types each event handler from the event name', () => {
  gateway({
    intents: ['GuildMessages'],
    events: {
      MESSAGE_CREATE: (message) => {
        expectTypeOf(message).toEqualTypeOf<GatewayMessageCreateDispatchData>();
      },
      // @ts-expect-error
      NOT_AN_EVENT: () => {},
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
