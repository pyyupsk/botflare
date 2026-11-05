import type { Command, Context } from '#utils/command';
import type { Options } from '#utils/option';

/**
 * Declares a slash command and the handler that answers it. To split a command into subcommands,
 * such as `/config get` and `/config set`, pass `subcommands` instead of `options` and `run`: a list
 * of commands made with `command()`. A subcommand that has `subcommands` of its own becomes a group,
 * such as `/config role add`. Discord allows one group level only.
 *
 * @param config What Discord shows for the command.
 * @param config.name The name the user types after `/`.
 * @param config.description The text Discord shows under the name.
 * @param config.options The options, keyed by name, made with {@link option}.
 * @param run Answers the command. It gets the interaction, the typed option values, `reply`
 *   for an answer within 3 seconds and `defer` for work that takes longer. Pass
 *   `{ ephemeral: true }` to either so only the user who ran the command sees the answer, `buttons`
 *   to add buttons and `embeds` to add embeds. Messages ping nobody, even for `@everyone` or `<@id>`
 *   in the text. To ping, pass `allowedMentions`, such as `{ users: [id] }` or `{ parse: ['roles'] }`. The work of `defer` returns the text, or
 *   `{ content, buttons, embeds }`.
 * @returns The command, for the `commands` of {@link bot}.
 * @example
 * const greet = command(
 *   { name: 'greet', description: 'Say hi', options: { name: option('string', { description: 'Who', required: true }) } },
 *   (c) => c.reply(`hi ${c.options.name}`),
 * );
 */
export function command<const O extends Options = never>(
  config: { name: string; description: string; options?: O },
  run: (c: Context<O>) => Response | Promise<Response>,
): Command<O>;
export function command(config: {
  name: string;
  description: string;
  subcommands: Command[];
}): Command;
export function command(
  config: { name: string; description: string; options?: Options; subcommands?: Command[] },
  run?: (c: Context<Options>) => Response | Promise<Response>,
): Command {
  const { name, description, subcommands } = config;
  if (subcommands) return { name, description, subcommands };

  return { name, description, options: config.options ?? {}, run: run as NonNullable<typeof run> };
}
