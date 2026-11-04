import type { GatewayMessageCreateDispatchData } from 'discord-api-types/v10';
import { expectTypeOf, it } from 'vitest';

import { gateway } from './gateway';

it('types each event handler from the event name', () => {
  gateway({
    intents: 1 << 9,
    events: {
      MESSAGE_CREATE: (message) => {
        expectTypeOf(message).toEqualTypeOf<GatewayMessageCreateDispatchData>();
      },
      // @ts-expect-error
      NOT_AN_EVENT: () => {},
    },
  });
});
