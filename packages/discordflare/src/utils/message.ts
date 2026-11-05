import type { MessageFlags } from 'discord-api-types/v10';

import type { Schemas } from '#lib/routes';
import { type SelectMenu, selectRow } from '#utils/select';

export type Button = { id: string; label: string };

export type MessageOptions = {
  buttons?: Button[];
  selects?: SelectMenu[];
  embeds?: Schemas['RichEmbed'][];
  allowedMentions?: Schemas['MessageAllowedMentionsRequest'];
};

export type ReplyOptions = MessageOptions & { ephemeral?: boolean };

const PER_ROW = 5;
const EPHEMERAL: MessageFlags.Ephemeral = 64;
const NO_PINGS: Schemas['MessageAllowedMentionsRequest'] = { parse: [] };

export function message(
  content: string,
  options: ReplyOptions = {},
): Schemas['IncomingWebhookInteractionRequest'] {
  const data: Schemas['IncomingWebhookInteractionRequest'] = {
    content,
    allowed_mentions: options.allowedMentions ?? NO_PINGS,
  };
  if (options.ephemeral) data.flags = EPHEMERAL;
  if (options.embeds) data.embeds = options.embeds;
  if (!options.buttons && !options.selects) return data;

  const rows = (options.selects ?? []).map(selectRow);
  const buttons = options.buttons ?? [];
  for (let i = 0; i < buttons.length; i += PER_ROW) {
    rows.push({
      type: 1,
      components: buttons
        .slice(i, i + PER_ROW)
        .map((b) => ({ type: 2, style: 1, label: b.label, custom_id: b.id })),
    });
  }
  data.components = rows;

  return data;
}
