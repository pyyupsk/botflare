import type { APIModalSubmitInteraction } from 'discord-api-types/v10';

import { type AnswerContext, followUps } from '#answers/follow';
import type { ErrorHandler } from '#types';
import { splitId } from '#utils/id';
import { fieldValues, type Modal } from '#utils/modal';
import { replyResponse } from '#utils/response';

export function answerModal(
  interaction: APIModalSubmitInteraction,
  modals: Map<string, Modal>,
  ctx: AnswerContext,
  onError?: ErrorHandler,
): Response | Promise<Response> {
  const { name, value } = splitId(interaction.data.custom_id);
  const submitted = modals.get(name);
  if (!submitted) return new Response(null, { status: 404 });

  return submitted.run({
    interaction,
    value,
    fields: fieldValues(interaction.data.components),
    reply: replyResponse,
    ...followUps(interaction, ctx, `modal ${name}`, onError),
  });
}
