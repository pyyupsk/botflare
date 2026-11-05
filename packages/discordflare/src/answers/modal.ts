import type { APIModalSubmitInteraction } from 'discord-api-types/v10';

import { splitId } from '#utils/id';
import { fieldValues, type Modal } from '#utils/modal';
import { replyResponse } from '#utils/response';

export function answerModal(
  interaction: APIModalSubmitInteraction,
  modals: Map<string, Modal>,
): Response | Promise<Response> {
  const { name, value } = splitId(interaction.data.custom_id);
  const submitted = modals.get(name);
  if (!submitted) return new Response(null, { status: 404 });

  return submitted.run({
    interaction,
    value,
    fields: fieldValues(interaction.data.components),
    reply: replyResponse,
  });
}
