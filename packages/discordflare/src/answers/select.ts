import type { APIMessageComponentSelectMenuInteraction } from 'discord-api-types/v10';

import type { Select } from '#types';
import { modalResponse, replyResponse, updateResponse } from '#utils/response';
import { type SelectType, selectValues } from '#utils/select';

export function answerSelect(
  interaction: APIMessageComponentSelectMenuInteraction,
  selects: Map<string, Select<SelectType, unknown>>,
): Response | Promise<Response> {
  const picked = selects.get(interaction.data.custom_id);
  if (!picked) return new Response(null, { status: 404 });

  return picked.run({
    interaction,
    values: selectValues(interaction),
    reply: replyResponse,
    update: updateResponse,
    modal: modalResponse,
  });
}
