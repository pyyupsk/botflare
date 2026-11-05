import type { Select, SelectContext, SelectValue } from '#types';
import type { ChannelType } from '#utils/option';
import type { SelectType } from '#utils/select';

type SelectConfig<T extends SelectType, O> = {
  /** The id Discord sends back with the pick. */
  id: string;
  /** The text the menu shows before a pick. */
  placeholder?: string;
  /** The fewest items the user must pick. Defaults to 1. */
  min?: number;
  /** The most items the user can pick. Defaults to 1. */
  max?: number;
  /** The items of a `string` menu, keyed by the label Discord shows. */
  options?: O;
} & (T extends 'string' ? { options: unknown } : unknown) &
  (T extends 'channel'
    ? {
        /** The channel types the user can pick, such as `['text', 'forum']`. */
        channelTypes?: ChannelType[];
      }
    : unknown);

/**
 * Declares a select menu and the handler that runs when the user picks from it. Put it in the
 * `selects` of a message, such as `c.reply('Pick one', { selects: [menu] })`, and in the `selects` of
 * {@link bot} so the bot gets the pick. Each menu takes a row of its own, above the buttons.
 *
 * A `string` menu lists `options`, keyed by the label Discord shows, and the handler gets the picked
 * values. A `user`, `role`, `channel` or `mentionable` menu lets the user pick from the server, and
 * the handler gets the full objects Discord resolved. A `channel` menu takes `channelTypes`.
 *
 * @param type What the user picks from.
 * @param config How Discord shows the menu.
 * @param run Answers the pick. `c.values` holds the picked items.
 * @returns The select menu.
 * @example
 * const fruit = select('string', { id: 'fruit', options: { Apple: 'apple', Mango: 'mango' } }, (c) =>
 *   c.update(`picked ${c.values.join(', ')}`),
 * );
 */
export function select<
  const T extends SelectType,
  const O extends Record<string, T extends 'string' ? string : never> = never,
>(
  type: T,
  config: SelectConfig<T, O>,
  run: (
    c: SelectContext<[O] extends [never] ? SelectValue[T] : O[keyof O]>,
  ) => Response | Promise<Response>,
): Select<T, [O] extends [never] ? SelectValue[T] : O[keyof O]> {
  return { ...config, type, run };
}
