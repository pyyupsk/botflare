import type { MessageFlags } from 'discord-api-types/v10';

import type { Schemas } from '#lib/routes';
import { type Button, buttonComponent } from '#utils/button';
import { type SelectMenu, selectRow } from '#utils/select';
import { attachmentsOf, type Upload } from '#utils/upload';

export type MessageOptions = {
  buttons?: Button[];
  selects?: SelectMenu[];
  embeds?: Schemas['RichEmbed'][];
  allowedMentions?: Schemas['MessageAllowedMentionsRequest'];
  files?: Upload[];
};

export type ReplyOptions = MessageOptions & { ephemeral?: boolean };

export type FollowUps = {
  after(work: () => Promise<void>): void;
  followUp(content: string, options?: ReplyOptions): Promise<Error | null>;
  editReply(content: string, options?: MessageOptions): Promise<Error | null>;
  deleteReply(): Promise<Error | null>;
};

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
  if (options.files?.length) data.attachments = attachmentsOf(options.files);
  if (!options.buttons && !options.selects) return data;

  const rows = (options.selects ?? []).map(selectRow);
  const buttons = options.buttons ?? [];
  for (let i = 0; i < buttons.length; i += PER_ROW) {
    rows.push({
      type: 1,
      components: buttons.slice(i, i + PER_ROW).map(buttonComponent),
    });
  }
  data.components = rows;

  return data;
}
