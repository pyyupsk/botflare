import type { APIMessageComponentSelectMenuInteraction } from 'discord-api-types/v10';

import { deferUpdate } from '#answers/defer';
import type { ErrorHandler, Select } from '#types';
import { modalResponse, replyResponse, updateResponse } from '#utils/response';
import { type SelectType, selectValues } from '#utils/select';

export function answerSelect(
  interaction: APIMessageComponentSelectMenuInteraction,
  selects: Map<string, Select<SelectType, unknown>>,
  ctx: Pick<ExecutionContext, 'waitUntil'>,
  onError?: ErrorHandler,
): Response | Promise<Response> {
  const picked = selects.get(interaction.data.custom_id);
  if (!picked) return new Response(null, { status: 404 });

  return picked.run({
    interaction,
    values: selectValues(interaction),
    reply: replyResponse,
    update: updateResponse,
    modal: modalResponse,
    deferUpdate: deferUpdate(interaction, ctx, `select ${interaction.data.custom_id}`, onError),
  });
}
