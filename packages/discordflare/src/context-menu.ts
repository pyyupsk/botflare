import type { Locale } from 'discord-api-types/v10';

import type { Access, ContextMenu, MenuContext, MenuType } from '#utils/command';

/**
 * Declares a context menu command: an item in the Apps menu when the user right-clicks a user or a
 * message. Add it to the `commands` of {@link bot}, next to the slash commands. It has no options
 * and no description. The handler gets the user or the message as `c.target`.
 *
 * @param menu Whether the item shows on a `user` or on a `message`.
 * @param config What Discord shows.
 * @param config.name The name of the item, such as `Report message`.
 * @param config.permissions Who sees the item by default, as in {@link command}.
 * @param config.contexts Where the item shows, as in {@link command}.
 * @param config.installs How the app must be installed for the item, as in {@link command}.
 * @param config.locales The name in other languages, keyed by Discord locale.
 * @param run Answers the click, with `reply`, `defer` and `modal` as in a slash command.
 * @returns The context menu command, for the `commands` of {@link bot}.
 * @example
 * const avatar = contextMenu('user', { name: 'Show avatar' }, (c) => c.reply(c.target.username));
 */
export function contextMenu<const T extends MenuType>(
  menu: T,
  config: { name: string; locales?: Partial<Record<`${Locale}`, { name: string }>> } & Omit<
    Access,
    'locales'
  >,
  run: (c: MenuContext<T>) => Response | Promise<Response>,
): ContextMenu<T> {
  return { ...config, menu, run };
}
