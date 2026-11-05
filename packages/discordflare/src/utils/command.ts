import type {
  APIApplicationCommandInteractionDataOption,
  APIChatInputApplicationCommandInteraction,
  APIMessage,
  APIMessageApplicationCommandInteraction,
  APIUser,
  APIUserApplicationCommandInteraction,
  ApplicationCommandOptionType,
} from 'discord-api-types/v10';

import type { Schemas } from '#lib/routes';
import type { MessageOptions, ReplyOptions } from '#utils/message';
import type { Modal } from '#utils/modal';
import {
  type CommandOption,
  type Option,
  type Options,
  type OptionValue,
  optionsPayload,
} from '#utils/option';

export type Context<O extends Options> = {
  interaction: APIChatInputApplicationCommandInteraction;
  options: {
    [K in keyof O]: O[K] extends Option<keyof OptionValue, infer R, infer V>
      ? R extends true
        ? V
        : V | undefined
      : never;
  };
  reply: (content: string, options?: ReplyOptions) => Response;
  defer: (
    work: () => Promise<string | ({ content: string } & MessageOptions)>,
    options?: { ephemeral?: boolean },
  ) => Response;
  modal: (modal: Modal) => Response;
};

export type Command<O extends Options = Options> =
  | {
      name: string;
      description: string;
      options: O;
      run(c: Context<O>): Response | Promise<Response>;
    }
  | { name: string; description: string; subcommands: Command[] };

export type MenuType = 'user' | 'message';

export type MenuContext<T extends MenuType> = {
  interaction: T extends 'user'
    ? APIUserApplicationCommandInteraction
    : APIMessageApplicationCommandInteraction;
  target: T extends 'user' ? APIUser : APIMessage;
  reply: Context<Options>['reply'];
  defer: Context<Options>['defer'];
  modal: Context<Options>['modal'];
};

export type ContextMenu<T extends MenuType = MenuType> = {
  menu: T;
  name: string;
  run(c: MenuContext<T>): Response | Promise<Response>;
};

const SUBCOMMAND: ApplicationCommandOptionType.Subcommand = 1;
const GROUP: ApplicationCommandOptionType.SubcommandGroup = 2;

function childPayload(child: Command): CommandOption {
  const { name, description } = child;
  if (!('subcommands' in child)) {
    return {
      type: SUBCOMMAND,
      name,
      description,
      options: optionsPayload(child.options),
    } as CommandOption;
  }

  return {
    type: GROUP,
    name,
    description,
    options: child.subcommands.map(childPayload),
  } as CommandOption;
}

export function payload(
  command: Command | ContextMenu,
): Schemas['ApplicationCommandUpdateRequest'] {
  if ('menu' in command) return { type: command.menu === 'user' ? 2 : 3, name: command.name };

  const { name, description } = command;
  const options =
    'subcommands' in command
      ? command.subcommands.map(childPayload)
      : optionsPayload(command.options);

  return { type: 1, name, description, options };
}

export function findCommand(
  commands: Map<string, Command>,
  data: { name: string; options?: APIApplicationCommandInteractionDataOption[] },
): {
  found: Command | undefined;
  given: APIApplicationCommandInteractionDataOption[];
  path: string;
} {
  const path = [data.name];
  let found = commands.get(data.name);
  let given = data.options ?? [];
  while (found && 'subcommands' in found) {
    const picked = given[0];
    found = found.subcommands.find((child) => child.name === picked?.name);
    path.push(picked?.name ?? '');
    given = picked && 'options' in picked ? (picked.options ?? []) : [];
  }

  return { found, given, path: `/${path.join(' ')}` };
}
