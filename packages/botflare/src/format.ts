type Id = string | { id: string };

const idOf = (target: Id): string => (typeof target === 'string' ? target : target.id);

/**
 * Writes a mention for message text. A mention shows as a link to the user, role, channel or
 * command. It pings nobody unless the message allows it with `allowedMentions`.
 *
 * @example
 * c.reply(`${mention.user(c.interaction.member.user)} joined ${mention.channel('123')}`);
 */
export const mention: {
  user: (user: Id) => string;
  role: (role: Id) => string;
  channel: (channel: Id) => string;
  command: (name: string, id: string) => string;
} = {
  user: (user) => `<@${idOf(user)}>`,
  role: (role) => `<@&${idOf(role)}>`,
  channel: (channel) => `<#${idOf(channel)}>`,
  command: (name, id) => `</${name}:${id}>`,
};

const STYLE = {
  'short-time': 't',
  'long-time': 'T',
  'short-date': 'd',
  'long-date': 'D',
  short: 'f',
  long: 'F',
  relative: 'R',
} as const;

/**
 * Writes a timestamp for message text. Discord shows it in the time zone and language of each
 * reader.
 *
 * @param date The moment, as a `Date` or as milliseconds since 1970, such as `Date.now()`.
 * @param style How Discord shows it: `short` (default, such as "5 November 2026 12:30"), `long`,
 *   `short-date`, `long-date`, `short-time`, `long-time` or `relative` (such as "in 2 hours").
 * @returns The timestamp markup, such as `<t:1762338600:R>`.
 * @example
 * c.reply(`The event starts ${time(start, 'relative')}`);
 */
export function time(date: Date | number, style: keyof typeof STYLE = 'short'): string {
  const seconds = Math.floor(Number(date) / 1000);

  return `<t:${seconds}:${STYLE[style]}>`;
}
