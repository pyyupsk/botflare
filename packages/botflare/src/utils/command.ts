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
import { type Locales, localePayload } from '#utils/locale';
import type { FollowUps, MessageOptions, ReplyOptions } from '#utils/message';
import type { Modal } from '#utils/modal';
import {
  type CommandOption,
  type Option,
  type Options,
  type OptionValue,
  optionsPayload,
} from '#utils/option';
import { type Permission, permissionBits } from '#utils/permissions';

/** What the handler of a slash command gets. */
export type Context<O extends Options> = {
  /** The interaction as Discord sent it. */
  interaction: APIChatInputApplicationCommandInteraction;
  /** The option values, keyed by name. An option that is not required can be `undefined`. */
  options: {
    [K in keyof O]: O[K] extends Option<keyof OptionValue, infer R, infer V>
      ? R extends true
        ? V
        : V | undefined
      : never;
  };
  /** Answers within 3 seconds. Return what it gives. */
  reply: (content: string, options?: ReplyOptions) => Response;
  /**
   * Shows "thinking…" now, then edits the answer to what `work` returns: the text, or
   * `{ content, buttons, embeds }`. Use it for work that takes longer than 3 seconds.
   */
  defer: (
    work: () => Promise<string | ({ content: string } & MessageOptions)>,
    options?: { ephemeral?: boolean },
  ) => Response;
  /** Opens a modal made with `modal()`. `value` comes back to its handler as `c.value`. */
  modal: (modal: Modal, value?: string) => Response;
} & FollowUps;

/** Who sees a command or a context menu item, and where. */
export type Access = {
  /**
   * The name and description in other languages, keyed by Discord locale, such as
   * `{ th: { name: 'ทอย', description: 'ทอยลูกเต๋า' } }`. The handler still gets the default name.
   */
  locales?: Locales;
  /**
   * Who sees it by default: members with all of these permissions, such as `['ManageGuild']`.
   * Pass `[]` to show it to admins only. Server admins can change this in Server Settings.
   * Applies to a top-level command only.
   */
  permissions?: Permission[];
  /** Where it shows: `guild`, `bot_dm` or `private_channel`. */
  contexts?: ('guild' | 'bot_dm' | 'private_channel')[];
  /** How the app must be installed for it: `guild` or `user`. */
  installs?: ('guild' | 'user')[];
};

const CONTEXT = { guild: 0, bot_dm: 1, private_channel: 2 } as const;
const INSTALL = { guild: 0, user: 1 } as const;

function accessPayload(access: Access): Partial<Schemas['ApplicationCommandUpdateRequest']> {
  const fields: Partial<Schemas['ApplicationCommandUpdateRequest']> = localePayload(access.locales);
  if (access.permissions) fields.default_member_permissions = permissionBits(access.permissions);
  if (access.contexts) fields.contexts = access.contexts.map((c) => CONTEXT[c]);
  if (access.installs) fields.integration_types = access.installs.map((i) => INSTALL[i]);

  return fields;
}

export type Command<O extends Options = Options> =
  | ({
      name: string;
      description: string;
      options: O;
      run(c: Context<O>): Response | Promise<Response>;
    } & Access)
  | ({ name: string; description: string; subcommands: Command[] } & Access);

export type MenuType = 'user' | 'message';

export type MenuContext<T extends MenuType> = {
  interaction: T extends 'user'
    ? APIUserApplicationCommandInteraction
    : APIMessageApplicationCommandInteraction;
  target: T extends 'user' ? APIUser : APIMessage;
  reply: Context<Options>['reply'];
  defer: Context<Options>['defer'];
  modal: Context<Options>['modal'];
} & FollowUps;

export type ContextMenu<T extends MenuType = MenuType> = {
  menu: T;
  name: string;
  run(c: MenuContext<T>): Response | Promise<Response>;
} & Access;

const SUBCOMMAND: ApplicationCommandOptionType.Subcommand = 1;
const GROUP: ApplicationCommandOptionType.SubcommandGroup = 2;

function childPayload(child: Command): CommandOption {
  const { name, description } = child;
  if (!('subcommands' in child)) {
    return {
      type: SUBCOMMAND,
      name,
      description,
      ...localePayload(child.locales),
      options: optionsPayload(child.options),
    } as CommandOption;
  }

  return {
    type: GROUP,
    name,
    description,
    ...localePayload(child.locales),
    options: child.subcommands.map(childPayload),
  } as CommandOption;
}

export function payload(
  command: Command | ContextMenu,
): Schemas['ApplicationCommandUpdateRequest'] {
  const access = accessPayload(command);
  if ('menu' in command) {
    delete access.description_localizations;
    return { type: command.menu === 'user' ? 2 : 3, name: command.name, ...access };
  }

  const { name, description } = command;
  const options =
    'subcommands' in command
      ? command.subcommands.map(childPayload)
      : optionsPayload(command.options);

  return { type: 1, name, description, options, ...access };
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
