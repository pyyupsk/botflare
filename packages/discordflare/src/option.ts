import type {
  AutocompleteContext,
  ChannelType,
  Option,
  OptionValue,
  Suggestion,
} from '#utils/option';

type OptionLimits<T extends keyof OptionValue> = T extends 'string'
  ? { minLength?: number; maxLength?: number }
  : T extends 'integer' | 'number'
    ? { min?: number; max?: number }
    : T extends 'channel'
      ? { channelTypes?: ChannelType[] }
      : unknown;

type Choice<T extends keyof OptionValue> = T extends 'string'
  ? string
  : T extends 'integer' | 'number'
    ? number
    : never;

/**
 * Declares one option of a slash command. The handler reads its value from `c.options`,
 * typed from `type`, and `undefined` when the option is not `required`.
 *
 * A `string`, `integer` or `number` option also takes `choices`, keyed by the label Discord shows.
 * The user can pick only those, and the handler gets one of their values. A `string` option takes
 * `minLength` and `maxLength`, an `integer` or `number` option takes `min` and `max`, and a
 * `channel` option takes `channelTypes`, such as `['text', 'forum']`.
 *
 * Instead of fixed `choices`, a `string`, `integer` or `number` option can take `autocomplete`: a
 * function that gets what the user has typed so far as `c.value` and returns up to 25 suggestions,
 * as plain values or as `{ name, value }`. If it throws, `onError` gets the error and Discord shows
 * no suggestions.
 *
 * @param type The value type Discord asks the user for. `user`, `channel` and `role` give the full
 *   object Discord sends with the command, not only its id.
 * @param config How Discord shows the option.
 * @param config.description The text Discord shows under the option name.
 * @param config.required Whether the user must fill it in. Defaults to `false`.
 * @returns The option, for the `options` of {@link command}.
 * @example
 * option('integer', { description: 'How many dice', required: true, min: 1, max: 6 });
 * option('string', { description: 'Color', choices: { Red: 'red', Blue: 'blue' } });
 */
export function option<
  const T extends keyof OptionValue,
  const R extends boolean = false,
  const C extends Record<string, Choice<T>> = never,
>(
  type: T,
  config: { description: string; required?: R; choices?: C } & OptionLimits<T> & {
      autocomplete?: [Choice<T>] extends [never]
        ? never
        : [C] extends [never]
          ? (c: AutocompleteContext) => Suggestion<Choice<T>>[] | Promise<Suggestion<Choice<T>>[]>
          : never;
    },
): Option<T, R, [C] extends [never] ? OptionValue[T] : C[keyof C]> {
  const built: Option = { ...config, type, required: config.required ?? false };

  return built as Option<T, R, [C] extends [never] ? OptionValue[T] : C[keyof C]>;
}
