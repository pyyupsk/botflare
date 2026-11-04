import type {
  APIApplicationCommandBasicOption,
  APIChatInputApplicationCommandInteraction,
  ApplicationCommandOptionType,
  RESTPostAPIChatInputApplicationCommandsJSONBody,
} from 'discord-api-types/v10';

export type OptionValue = { string: string; integer: number; number: number; boolean: boolean };

export type Option<T extends keyof OptionValue = keyof OptionValue, R extends boolean = boolean> = {
  type: T;
  description: string;
  required: R;
};

export type Options = Record<string, Option>;

type Values<O extends Options> = {
  [K in keyof O]: O[K] extends Option<infer T, true>
    ? OptionValue[T]
    : OptionValue[O[K]['type']] | undefined;
};

export type Context<O extends Options> = {
  interaction: APIChatInputApplicationCommandInteraction;
  options: Values<O>;
  reply: (content: string) => Response;
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
};

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
