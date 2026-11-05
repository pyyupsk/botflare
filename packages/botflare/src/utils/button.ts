import type { Schemas } from '#lib/routes';

/**
 * A button on a message. A button with an `id` runs the handler with that id in the `buttons` of
 * `bot()`, and takes a `style`: `primary` (default), `secondary`, `success` or `danger`. A button
 * with a `url` opens the link and needs no handler. A button needs a `label`, an `emoji` or both.
 * An `emoji` is a Unicode emoji, or a custom emoji such as `<:name:id>`.
 */
export type Button = (
  | {
      /** The handler name, then an optional `:` and a value, such as `page:2`. */
      id: string;
      /** `primary` (default), `secondary`, `success` or `danger`. */
      style?: ButtonStyle;
      url?: never;
    }
  | {
      /** The link the button opens. */
      url: string;
      id?: never;
      style?: never;
    }
) &
  (
    | {
        /** The text on the button. */
        label: string;
        /** A Unicode emoji, or a custom emoji such as `<:name:id>`. */
        emoji?: string;
      }
    | { label?: string; emoji: string }
  ) & {
    /** `true` greys the button out. */
    disabled?: boolean;
  };

type ButtonStyle = 'primary' | 'secondary' | 'success' | 'danger';

const STYLE: Record<ButtonStyle, Schemas['ButtonStyleTypes']> = {
  primary: 1,
  secondary: 2,
  success: 3,
  danger: 4,
};
const LINK: Schemas['ButtonStyleTypes'] = 5;
const CUSTOM_EMOJI = /^<a?:(\w+):(\d+)>$/;

function emojiOf(text: string): Schemas['ComponentEmojiForRequest'] {
  const custom = CUSTOM_EMOJI.exec(text);
  if (!custom?.[1]) return { name: text };

  return { name: custom[1], id: custom[2] };
}

export function buttonComponent(button: Button): Schemas['ButtonComponentForMessageRequest'] {
  const component: Schemas['ButtonComponentForMessageRequest'] = {
    type: 2,
    style: 'url' in button ? LINK : STYLE[button.style ?? 'primary'],
  };

  if (button.label !== undefined) component.label = button.label;
  if ('url' in button) component.url = button.url;
  else component.custom_id = button.id;
  if (button.emoji) component.emoji = emojiOf(button.emoji);
  if (button.disabled) component.disabled = true;

  return component;
}
