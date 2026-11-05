import type {
  APIApplicationCommandAutocompleteInteraction,
  APIApplicationCommandInteractionDataOption,
  APIChatInputApplicationCommandInteractionData,
  APIAttachment,
  APIInteractionDataResolvedChannel,
  APIInteractionDataResolvedGuildMember,
  APIRole,
  APIUser,
  ApplicationCommandOptionType,
} from 'discord-api-types/v10';

import type { Schemas } from '#lib/routes';
import { type Locales, localePayload } from '#utils/locale';

export type OptionValue = {
  string: string;
  integer: number;
  number: number;
  boolean: boolean;
  user: APIUser & { member?: APIInteractionDataResolvedGuildMember };
  channel: APIInteractionDataResolvedChannel;
  role: APIRole;
  mentionable: (APIUser & { member?: APIInteractionDataResolvedGuildMember }) | APIRole;
  attachment: APIAttachment;
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
  locales?: Locales;
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
  mentionable: 9,
  attachment: 11,
};

const USER: ApplicationCommandOptionType.User = 6;
const CHANNEL: ApplicationCommandOptionType.Channel = 7;
const ROLE: ApplicationCommandOptionType.Role = 8;
const MENTIONABLE: ApplicationCommandOptionType.Mentionable = 9;
const ATTACHMENT: ApplicationCommandOptionType.Attachment = 11;

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
      Object.assign(built, localePayload(o.locales));

      return built as CommandOption;
    })
    .toSorted((a, b) => Number(b.required) - Number(a.required));
}

function userWithMember(
  resolved: APIChatInputApplicationCommandInteractionData['resolved'],
  id: string,
): OptionValue['user'] | undefined {
  const user = resolved?.users?.[id];
  if (!user) return undefined;

  const member = resolved?.members?.[id];

  return member ? { ...user, member } : user;
}

export function optionValues(
  options: APIApplicationCommandInteractionDataOption[],
  resolved: APIChatInputApplicationCommandInteractionData['resolved'],
): Record<string, OptionValue[keyof OptionValue] | undefined> {
  const values: Record<string, OptionValue[keyof OptionValue] | undefined> = {};

  for (const o of options) {
    if (!('value' in o)) continue;

    const id = String(o.value);
    if (o.type === USER) values[o.name] = userWithMember(resolved, id);
    else if (o.type === CHANNEL) values[o.name] = resolved?.channels?.[id];
    else if (o.type === ROLE) values[o.name] = resolved?.roles?.[id];
    else if (o.type === MENTIONABLE)
      values[o.name] = userWithMember(resolved, id) ?? resolved?.roles?.[id];
    else if (o.type === ATTACHMENT) values[o.name] = resolved?.attachments?.[id];
    else values[o.name] = o.value;
  }

  return values;
}
