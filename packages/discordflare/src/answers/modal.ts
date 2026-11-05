import type { APIModalSubmitInteraction } from 'discord-api-types/v10';

import { fieldValues, type Modal } from '#utils/modal';
import { replyResponse } from '#utils/response';

export function answerModal(
  interaction: APIModalSubmitInteraction,
  modals: Map<string, Modal>,
): Response | Promise<Response> {
  const submitted = modals.get(interaction.data.custom_id);
  if (!submitted) return new Response(null, { status: 404 });

  return submitted.run({
    interaction,
    fields: fieldValues(interaction.data.components),
    reply: replyResponse,
  });
}
