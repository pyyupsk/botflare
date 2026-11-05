import type { MessageFlags } from 'discord-api-types/v10';

import type { Schemas } from '#lib/routes';
import { type Button, buttonComponent } from '#utils/button';
import { type SelectMenu, selectRow } from '#utils/select';
import { attachmentsOf, type Upload } from '#utils/upload';

/** What a message holds besides its text. */
export type MessageOptions = {
  /** Buttons, five to a row. Pass `[]` to remove the buttons of the message. */
  buttons?: Button[];
  /** Select menus made with `select()`, one to a row, above the buttons. */
  selects?: SelectMenu[];
  /** Embeds, as in the Discord API, such as `{ title, description }`. */
  embeds?: Schemas['RichEmbed'][];
  /**
   * Who the message pings. By default it pings nobody, even for `@everyone` or `<@id>` in the
   * text. Pass `{ users: [id] }` or `{ parse: ['roles'] }` to ping.
   */
  allowedMentions?: Schemas['MessageAllowedMentionsRequest'];
  /** Files to attach. */
  files?: Upload[];
};

/** {@link MessageOptions} for the first answer or a follow-up. */
export type ReplyOptions = MessageOptions & {
  /** `true` shows the message to the user who ran the interaction only. */
  ephemeral?: boolean;
};

/** Calls that send more after the first answer. Each returns an `Error` if Discord refuses. */
export type FollowUps = {
  /**
   * Runs `work` once Discord has the first answer. Call it before you return the answer. `work`
   * can call the other follow-up calls.
   */
  after(work: () => Promise<void>): void;
  /** Sends a new message. */
  followUp(content: string, options?: ReplyOptions): Promise<Error | null>;
  /** Edits the first answer. */
  editReply(content: string, options?: MessageOptions): Promise<Error | null>;
  /** Deletes the first answer. */
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
