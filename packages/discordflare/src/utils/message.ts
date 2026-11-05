import type { MessageFlags } from 'discord-api-types/v10';

import type { Schemas } from '#lib/routes';

export type Button = { id: string; label: string };

export type ReplyOptions = { buttons?: Button[]; ephemeral?: boolean };

const PER_ROW = 5;
const EPHEMERAL: MessageFlags.Ephemeral = 64;

export function message(
  content: string,
  options: ReplyOptions = {},
): Schemas['IncomingWebhookInteractionRequest'] {
  const data: Schemas['IncomingWebhookInteractionRequest'] = { content };
  if (options.ephemeral) data.flags = EPHEMERAL;
  if (!options.buttons) return data;

  const rows: Schemas['ActionRowComponentForMessageRequest'][] = [];
  for (let i = 0; i < options.buttons.length; i += PER_ROW) {
    rows.push({
      type: 1,
      components: options.buttons
        .slice(i, i + PER_ROW)
        .map((b) => ({ type: 2, style: 1, label: b.label, custom_id: b.id })),
    });
  }
  data.components = rows;

  return data;
}
