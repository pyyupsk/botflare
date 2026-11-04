import type {
  APIApplicationCommandBasicOption,
  APIChatInputApplicationCommandInteraction,
  APIChatInputApplicationCommandInteractionData,
  APIInteractionDataResolvedChannel,
  APIRole,
  APIUser,
  ApplicationCommandOptionType,
  RESTPostAPIChatInputApplicationCommandsJSONBody,
} from 'discord-api-types/v10';

import type { ReplyOptions } from '#utils/message';
import type { Modal } from '#utils/modal';

export type OptionValue = {
  string: string;
  integer: number;
  number: number;
  boolean: boolean;
  user: APIUser;
  channel: APIInteractionDataResolvedChannel;
  role: APIRole;
};

export type Option<T extends keyof OptionValue = keyof OptionValue, R extends boolean = boolean> = {
  type: T;
  description: string;
  required: R;
};

export type Options = Record<string, Option>;

export type Context<O extends Options> = {
  interaction: APIChatInputApplicationCommandInteraction;
  options: {
    [K in keyof O]: O[K] extends Option<infer T, true>
      ? OptionValue[T]
      : OptionValue[O[K]['type']] | undefined;
  };
  reply: (content: string, options?: ReplyOptions) => Response;
  defer: (work: () => Promise<string>, options?: { ephemeral?: boolean }) => Response;
  modal: (modal: Modal) => Response;
};

export type Command<O extends Options = Options> = {
  name: string;
  description: string;
  options: O;
  run(c: Context<O>): Response | Promise<Response>;
};

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

export function payload(command: Command): RESTPostAPIChatInputApplicationCommandsJSONBody {
  const options = Object.entries(command.options)
    .map(
      ([name, o]) =>
        ({
          name,
          description: o.description,
          type: OPTION_TYPE[o.type],
          required: o.required,
        }) as APIApplicationCommandBasicOption,
    )
    .toSorted((a, b) => Number(b.required) - Number(a.required));

  return { type: 1, name: command.name, description: command.description, options };
}

export function optionValues(
  data: APIChatInputApplicationCommandInteractionData,
): Record<string, OptionValue[keyof OptionValue] | undefined> {
  const values: Record<string, OptionValue[keyof OptionValue] | undefined> = {};

  for (const o of data.options ?? []) {
    if (!('value' in o)) continue;

    const id = String(o.value);
    if (o.type === USER) values[o.name] = data.resolved?.users?.[id];
    else if (o.type === CHANNEL) values[o.name] = data.resolved?.channels?.[id];
    else if (o.type === ROLE) values[o.name] = data.resolved?.roles?.[id];
    else values[o.name] = o.value;
  }

  return values;
}
