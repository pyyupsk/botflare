import type { Schemas } from '#lib/routes';

export type Button = (
  | { id: string; style?: ButtonStyle; url?: never }
  | { url: string; id?: never; style?: never }
) &
  ({ label: string; emoji?: string } | { label?: string; emoji: string }) & { disabled?: boolean };

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
