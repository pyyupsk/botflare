import type { APIMessageComponentSelectMenuInteraction } from 'discord-api-types/v10';

import type { Schemas } from '#lib/routes';
import { CHANNEL_TYPES, type ChannelType } from '#utils/option';

export type SelectType = 'string' | 'user' | 'role' | 'channel' | 'mentionable';

export type SelectMenu = {
  type: SelectType;
  id: string;
  placeholder?: string;
  min?: number;
  max?: number;
  options?: Record<string, string>;
  channelTypes?: ChannelType[];
};

const COMPONENT: Record<SelectType, 3 | 5 | 6 | 7 | 8> = {
  string: 3,
  user: 5,
  role: 6,
  mentionable: 7,
  channel: 8,
};

export function selectRow(menu: SelectMenu): Schemas['ActionRowComponentForMessageRequest'] {
  const component: Record<string, unknown> = { type: COMPONENT[menu.type], custom_id: menu.id };

  if (menu.placeholder !== undefined) component.placeholder = menu.placeholder;
  if (menu.min !== undefined) component.min_values = menu.min;
  if (menu.max !== undefined) component.max_values = menu.max;
  if (menu.options) {
    component.options = Object.entries(menu.options).map(([label, value]) => ({ label, value }));
  }
  if (menu.channelTypes) component.channel_types = menu.channelTypes.map((t) => CHANNEL_TYPES[t]);

  return {
    type: 1,
    components: [component as Schemas['ActionRowComponentForMessageRequest']['components'][number]],
  };
}

export function selectValues(interaction: APIMessageComponentSelectMenuInteraction): unknown[] {
  const { data } = interaction;
  const resolved = 'resolved' in data ? data.resolved : undefined;

  return data.values.map((id) => {
    if (!resolved) return id;
    if ('users' in resolved && resolved.users?.[id]) return resolved.users[id];
    if ('roles' in resolved && resolved.roles?.[id]) return resolved.roles[id];
    if ('channels' in resolved && resolved.channels?.[id]) return resolved.channels[id];

    return id;
  });
}
