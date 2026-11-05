import type {
  APIApplicationCommandAutocompleteInteraction,
  APIApplicationCommandInteractionDataOption,
  APIChatInputApplicationCommandInteractionData,
  APIInteractionDataResolvedChannel,
  APIRole,
  APIUser,
  ApplicationCommandOptionType,
} from 'discord-api-types/v10';

import type { Schemas } from '#lib/routes';

export type OptionValue = {
  string: string;
  integer: number;
  number: number;
  boolean: boolean;
  user: APIUser;
  channel: APIInteractionDataResolvedChannel;
  role: APIRole;
};

export type ChannelType =
  | 'text'
  | 'voice'
  | 'category'
  | 'announcement'
  | 'announcement_thread'
  | 'public_thread'
  | 'private_thread'
  | 'stage'
  | 'directory'
  | 'forum';

export const CHANNEL_TYPES: Record<ChannelType, Schemas['ChannelTypes']> = {
  text: 0,
  voice: 2,
  category: 4,
  announcement: 5,
  announcement_thread: 10,
  public_thread: 11,
  private_thread: 12,
  stage: 13,
  directory: 14,
  forum: 15,
};

export type Option<
  T extends keyof OptionValue = keyof OptionValue,
  R extends boolean = boolean,
  V = OptionValue[T],
> = {
  type: T;
  description: string;
  required: R;
  choices?: Record<string, V>;
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  channelTypes?: ChannelType[];
  autocomplete?: (c: AutocompleteContext) => Suggestion<V>[] | Promise<Suggestion<V>[]>;
};

export type AutocompleteContext = {
  interaction: APIApplicationCommandAutocompleteInteraction;
  value: string;
};

export type Suggestion<V> = V | { name: string; value: V };

export type Options = Record<string, Option<keyof OptionValue, boolean, unknown>>;

const OPTION_TYPE: Record<keyof OptionValue, ApplicationCommandOptionType> = {
  string: 3,
  integer: 4,
  number: 10,
  boolean: 5,
  user: 6,
  channel: 7,
  role: 8,
};

const USER: ApplicationCommandOptionType.User = 6;
const CHANNEL: ApplicationCommandOptionType.Channel = 7;
const ROLE: ApplicationCommandOptionType.Role = 8;

export type CommandOption = NonNullable<
  Schemas['ApplicationCommandUpdateRequest']['options']
>[number];

export function optionsPayload(options: Options): CommandOption[] {
  return Object.entries(options)
    .map(([name, o]) => {
      const built: Record<string, unknown> = {
        name,
        description: o.description,
        type: OPTION_TYPE[o.type],
        required: o.required,
      };

      if (o.choices) {
        built.choices = Object.entries(o.choices).map(([label, value]) => ({ name: label, value }));
      }
      if (o.min !== undefined) built.min_value = o.min;
      if (o.max !== undefined) built.max_value = o.max;
      if (o.minLength !== undefined) built.min_length = o.minLength;
      if (o.maxLength !== undefined) built.max_length = o.maxLength;
      if (o.channelTypes) built.channel_types = o.channelTypes.map((t) => CHANNEL_TYPES[t]);
      if (o.autocomplete) built.autocomplete = true;

      return built as CommandOption;
    })
    .toSorted((a, b) => Number(b.required) - Number(a.required));
}

export function optionValues(
  options: APIApplicationCommandInteractionDataOption[],
  resolved: APIChatInputApplicationCommandInteractionData['resolved'],
): Record<string, OptionValue[keyof OptionValue] | undefined> {
  const values: Record<string, OptionValue[keyof OptionValue] | undefined> = {};

  for (const o of options) {
    if (!('value' in o)) continue;

    const id = String(o.value);
    if (o.type === USER) values[o.name] = resolved?.users?.[id];
    else if (o.type === CHANNEL) values[o.name] = resolved?.channels?.[id];
    else if (o.type === ROLE) values[o.name] = resolved?.roles?.[id];
    else values[o.name] = o.value;
  }

  return values;
}
